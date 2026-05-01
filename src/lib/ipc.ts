import { invoke } from "@tauri-apps/api/core";
import type { AppError } from "../types/ipc";

export class IpcError extends Error {
  constructor(public readonly app: AppError) {
    super(app.message);
    this.name = "IpcError";
  }
}

function isAppError(e: unknown): e is AppError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
}

export async function ipc<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (raw) {
    if (isAppError(raw)) {
      throw new IpcError(raw);
    }
    throw new IpcError({
      code: "internal",
      message: typeof raw === "string" ? raw : JSON.stringify(raw),
    });
  }
}
