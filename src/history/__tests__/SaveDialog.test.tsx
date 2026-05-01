import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "../../i18n";
import { SaveDialog } from "../SaveDialog";

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

describe("SaveDialog", () => {
  it("disables Overwrite when loadedId is null", () => {
    render(
      <SaveDialog
        open
        defaultTitle="t"
        loadedId={null}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /overwrite/i })).toBeDisabled();
  });

  it("enables Overwrite when loadedId is set and emits overwrite mode", () => {
    const onSave = vi.fn();
    render(
      <SaveDialog
        open
        defaultTitle="t"
        loadedId={42}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /overwrite/i }));
    expect(onSave).toHaveBeenCalledWith({ mode: "overwrite", id: 42, title: "t" });
  });

  it("calls onSave with mode=new when New clicked", () => {
    const onSave = vi.fn();
    render(
      <SaveDialog
        open
        defaultTitle="t"
        loadedId={null}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^new$/i }));
    expect(onSave).toHaveBeenCalledWith({ mode: "new", title: "t" });
  });
});
