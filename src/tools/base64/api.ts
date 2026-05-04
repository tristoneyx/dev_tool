import { ipc } from "../../lib/ipc";

export const base64Api = {
  encode: (input: string, urlSafe: boolean) =>
    ipc<string>("base64_encode", { input, urlSafe }),
  decode: (input: string, urlSafe: boolean) =>
    ipc<string>("base64_decode", { input, urlSafe }),
};
