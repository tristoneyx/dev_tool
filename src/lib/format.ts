import i18n from "../i18n";

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - ts);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return i18n.t("common.just_now");
  const min = Math.floor(sec / 60);
  if (min < 60) return i18n.t("common.ago_minute", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return i18n.t("common.ago_hour", { n: hr });
  const day = Math.floor(hr / 24);
  return i18n.t("common.ago_day", { n: day });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return i18n.t("common.size_bytes", { n: bytes });
  if (bytes < 1024 * 1024) return i18n.t("common.size_kb", { n: (bytes / 1024).toFixed(1) });
  return i18n.t("common.size_mb", { n: (bytes / (1024 * 1024)).toFixed(1) });
}
