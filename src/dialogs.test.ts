import { describe, expect, it } from "vitest";
import { matchDialog } from "./dialogs.js";

const dialogs = [
  { title: "Мама", id: 1 },
  { title: "Рабочая группа", id: 2 },
  { title: "Рабочая группа (архив)", id: 3 },
  { title: "Алёна", id: 4 },
  { title: "Иван Петров", id: 5 },
  { title: "Иван Сидоров", id: 6 },
];

describe("matchDialog", () => {
  it("finds an exact match, ignoring case and extra spaces", () => {
    expect(matchDialog(dialogs, "  мАМа ")).toEqual({ type: "found", item: dialogs[0] });
  });

  it("prefers an exact match over partial ones", () => {
    expect(matchDialog(dialogs, "рабочая группа")).toMatchObject({ type: "found", item: { id: 2 } });
  });

  it("treats ё and е as the same letter", () => {
    expect(matchDialog(dialogs, "Алена")).toMatchObject({ type: "found", item: { id: 4 } });
  });

  it("finds a unique partial match", () => {
    expect(matchDialog(dialogs, "сидор")).toMatchObject({ type: "found", item: { id: 6 } });
  });

  it("reports ambiguity with candidate titles", () => {
    expect(matchDialog(dialogs, "иван")).toEqual({
      type: "ambiguous",
      titles: ["Иван Петров", "Иван Сидоров"],
    });
  });

  it("reports not found", () => {
    expect(matchDialog(dialogs, "Бухгалтерия")).toEqual({ type: "notFound" });
    expect(matchDialog(dialogs, "   ")).toEqual({ type: "notFound" });
  });
});
