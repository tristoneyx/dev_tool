import { ipc } from "../../lib/ipc";

export const escapeApi = {
  escape: (input: string) => ipc<string>("json_escape", { input }),
  unescape: (input: string) => ipc<string>("json_unescape", { input }),
};
