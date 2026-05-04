import { ipc } from "../../lib/ipc";

// NOTE: Tauri 2.x converts camelCase JS arg names to snake_case Rust param
// names by default, but the codebase has no existing multi-word args to
// validate that convention against. Send snake_case directly to be explicit
// and avoid silent undefined-argument bugs.
export const base64Api = {
  encode: (input: string, urlSafe: boolean) =>
    ipc<string>("base64_encode", { input, url_safe: urlSafe }),
  decode: (input: string, urlSafe: boolean) =>
    ipc<string>("base64_decode", { input, url_safe: urlSafe }),
};
