use crate::error::AppError;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub struct DbHandle {
    pub conn: Mutex<Connection>,
}

impl DbHandle {
    pub fn open(path: &Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        let handle = Self { conn: Mutex::new(conn) };
        handle.migrate()?;
        Ok(handle)
    }

    pub fn open_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
        let handle = Self { conn: Mutex::new(conn) };
        handle.migrate()?;
        Ok(handle)
    }

    fn migrate(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().expect("db poisoned");
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                tool        TEXT NOT NULL,
                title       TEXT NOT NULL,
                content     TEXT NOT NULL,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_history_tool_updated ON history(tool, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_history_title ON history(title);
            "#,
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_in_memory_runs_migration() {
        let db = DbHandle::open_in_memory().unwrap();
        let conn = db.conn.lock().unwrap();
        let table_exists: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='history'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(table_exists, 1);
    }

    #[test]
    fn open_creates_parent_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let nested = tmp.path().join("does/not/exist/db.sqlite");
        let db = DbHandle::open(&nested).unwrap();
        drop(db);
        assert!(nested.exists());
    }

    #[test]
    fn migration_is_idempotent() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("db.sqlite");
        let db = DbHandle::open(&path).unwrap();
        drop(db);
        // Reopen — migrate again, no error.
        let _db = DbHandle::open(&path).unwrap();
    }
}
