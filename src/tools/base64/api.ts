import { ipc } from "../../lib/ipc";

// Tauri 2.x: the JS side MUST send args in camelCase. The framework
// auto-translates them to the Rust function's snake_case parameter
// names — sending snake_case directly fails with
// "command X missing required key XX".
export const base64Api = {
  encode: (input: string, urlSafe: boolean) =>
    ipc<string>("base64_encode", { input, urlSafe }),
  decode: (input: string, urlSafe: boolean) =>
    ipc<string>("base64_decode", { input, urlSafe }),
};
