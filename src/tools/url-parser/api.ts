import { ipc } from "../../lib/ipc";
import type { UrlParts } from "../../types/ipc";

export const urlApi = {
  parse: (input: string) => ipc<UrlParts>("url_parse", { input }),
  build: (parts: UrlParts) => ipc<string>("url_build", { parts }),
};
