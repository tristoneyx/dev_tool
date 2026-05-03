import { ipc } from "../../lib/ipc";
import type { DiffTree } from "../../types/ipc";

export const diffApi = {
  diff: (left: string, right: string) =>
    ipc<DiffTree>("json_diff", { left, right }),
};
