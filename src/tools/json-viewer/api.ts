import { ipc } from "../../lib/ipc";
import type { JsonTree } from "../../types/ipc";

export const jsonApi = {
  parse: (input: string) => ipc<JsonTree>("json_parse", { input }),
  parseNested: (input: string) => ipc<JsonTree>("json_parse_nested", { input }),
  format: (input: string, indent: number) =>
    ipc<string>("json_format", { input, indent }),
  unescape: (input: string) => ipc<string>("json_unescape", { input }),
  escape: (input: string) => ipc<string>("json_escape", { input }),
};
