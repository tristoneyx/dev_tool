import { describe, expect, it } from "vitest";
import { formatRelativeTime, formatBytes } from "../format";

describe("formatRelativeTime", () => {
  it("returns 'just now' for less than a minute ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 30_000, now)).toBe("just now");
  });

  it("returns minutes for under an hour", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
  });

  it("returns hours for under a day", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
  });

  it("returns days otherwise", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 4 * 86_400_000, now)).toBe("4d ago");
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });
  it("formats kilobytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it("formats megabytes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
