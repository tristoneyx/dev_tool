use crate::domain::history::{
    HistoryContent, HistoryItem, ParseToolKindError, SaveMode, SaveRequest, ToolKind,
};
use crate::error::AppError;
use rusqlite::{params, Connection};
fn now_millis() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn row_to_item(
    id: i64,
    tool: String,
    title: String,
    content: String,
    created_at: i64,
    updated_at: i64,
) -> Result<HistoryItem, AppError> {
    let tool: ToolKind = tool
        .parse()
        .map_err(|e: ParseToolKindError| AppError::Internal(format!("unknown tool kind: {}", e.0)))?;
    let content: HistoryContent = serde_json::from_str(&content)?;
    Ok(HistoryItem {
        id,
        tool,
        title,
        content,
        created_at,
        updated_at,
    })
}

pub fn save(conn: &Connection, req: SaveRequest) -> Result<HistoryItem, AppError> {
    let tool = req.content.tool();
    let content_json = serde_json::to_string(&req.content)?;
    let now = now_millis();

    let id = match req.mode {
        SaveMode::New => {
            conn.execute(
                "INSERT INTO history (tool, title, content, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?4)",
                params![tool.as_str(), req.title, content_json, now],
            )?;
            conn.last_insert_rowid()
        }
        SaveMode::Overwrite { id } => {
            let updated = conn.execute(
                "UPDATE history SET title = ?1, content = ?2, updated_at = ?3
                 WHERE id = ?4 AND tool = ?5",
                params![req.title, content_json, now, id, tool.as_str()],
            )?;
            if updated == 0 {
                return Err(AppError::Internal(format!(
                    "history item {id} not found for tool {}",
                    tool.as_str()
                )));
            }
            id
        }
    };
    get(conn, id)
}

pub fn get(conn: &Connection, id: i64) -> Result<HistoryItem, AppError> {
    let row: (i64, String, String, String, i64, i64) = conn.query_row(
        "SELECT id, tool, title, content, created_at, updated_at FROM history WHERE id = ?1",
        params![id],
        |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
            ))
        },
    )?;
    let (id, tool, title, content, c, u) = row;
    row_to_item(id, tool, title, content, c, u)
}

pub fn list(
    conn: &Connection,
    tool: ToolKind,
    search: Option<&str>,
) -> Result<Vec<HistoryItem>, AppError> {
    let raw_rows: Vec<(i64, String, String, String, i64, i64)> = if let Some(q) = search {
        let pattern = format!("%{q}%");
        let mut stmt = conn.prepare(
            "SELECT id, tool, title, content, created_at, updated_at
             FROM history WHERE tool = ?1 AND title LIKE ?2
             ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map(params![tool.as_str(), pattern], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
        rows
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, tool, title, content, created_at, updated_at
             FROM history WHERE tool = ?1
             ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map(params![tool.as_str()], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
        rows
    };

    raw_rows
        .into_iter()
        .map(|(id, tool, title, content, c, u)| row_to_item(id, tool, title, content, c, u))
        .collect()
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), AppError> {
    let n = conn.execute("DELETE FROM history WHERE id = ?1", params![id])?;
    if n == 0 {
        return Err(AppError::Internal(format!("history item {id} not found")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::db::DbHandle;

    fn db() -> DbHandle {
        DbHandle::open_in_memory().unwrap()
    }

    fn sample_request(input: &str) -> SaveRequest {
        SaveRequest {
            mode: SaveMode::New,
            title: format!("Title for {input}"),
            content: HistoryContent::JsonViewer {
                input: input.into(),
            },
        }
    }

    #[test]
    fn save_new_returns_item_with_id_and_timestamps() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let item = save(&conn, sample_request("a")).unwrap();
        assert!(item.id > 0);
        assert_eq!(item.created_at, item.updated_at);
        assert_eq!(item.tool, ToolKind::JsonViewer);
    }

    #[test]
    fn list_filters_by_tool_and_orders_by_updated_at_desc() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let a = save(&conn, sample_request("a")).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(2));
        let b = save(&conn, sample_request("b")).unwrap();
        let mut other = sample_request("c");
        other.content = HistoryContent::Escape {
            input: "x".into(),
            direction: crate::domain::history::EscapeDirection::Escape,
        };
        let _other = save(&conn, other).unwrap();

        let items = list(&conn, ToolKind::JsonViewer, None).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, b.id);
        assert_eq!(items[1].id, a.id);
    }

    #[test]
    fn list_search_filters_by_title_substring() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let _ = save(&conn, sample_request("alpha")).unwrap();
        let _ = save(&conn, sample_request("beta")).unwrap();
        let items = list(&conn, ToolKind::JsonViewer, Some("alp")).unwrap();
        assert_eq!(items.len(), 1);
    }

    #[test]
    fn save_overwrite_preserves_created_at_and_bumps_updated_at() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let original = save(&conn, sample_request("a")).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(2));

        let req = SaveRequest {
            mode: SaveMode::Overwrite { id: original.id },
            title: "renamed".into(),
            content: HistoryContent::JsonViewer {
                input: "new".into(),
            },
        };
        let updated = save(&conn, req).unwrap();
        assert_eq!(updated.id, original.id);
        assert_eq!(updated.created_at, original.created_at);
        assert!(updated.updated_at > original.updated_at);
        assert_eq!(updated.title, "renamed");
    }

    #[test]
    fn save_overwrite_rejects_unknown_id() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let req = SaveRequest {
            mode: SaveMode::Overwrite { id: 99999 },
            title: "x".into(),
            content: HistoryContent::JsonViewer { input: "y".into() },
        };
        let err = save(&conn, req).unwrap_err();
        assert!(matches!(err, AppError::Internal(_)));
    }

    #[test]
    fn delete_removes_row() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let item = save(&conn, sample_request("a")).unwrap();
        delete(&conn, item.id).unwrap();
        let err = get(&conn, item.id).unwrap_err();
        assert!(matches!(err, AppError::Db(_)));
    }
}
