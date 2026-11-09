import { describe, expect, it } from "vitest";
import { BOT_MARK, parseCommand, parseTarget } from "./commands.js";

describe("parseTarget", () => {
  it.each([
    ["@ivan_petrov", { kind: "username", value: "ivan_petrov" }],
    ["t.me/ivan_petrov", { kind: "username", value: "ivan_petrov" }],
    ["https://t.me/ivan_petrov/", { kind: "username", value: "ivan_petrov" }],
    ["+7 (999) 123-45-67", { kind: "phone", value: "+79991234567" }],
    ["Рабочая группа", { kind: "title", value: "Рабочая группа" }],
    ["  Мама  ", { kind: "title", value: "Мама" }],
  ])("parses %j", (input, expected) => {
    expect(parseTarget(input)).toEqual(expected);
  });

  it.each(["", "   ", "@ab", "@1abc", "+12"])("rejects %j", (input) => {
    expect(parseTarget(input)).toBeNull();
  });
});

describe("parseCommand", () => {
  it("parses confirm and cancel", () => {
    expect(parseCommand("+")).toEqual({ type: "confirm" });
    expect(parseCommand(" - ")).toEqual({ type: "cancel" });
  });

  it("parses .to with a target, case-insensitive command", () => {
    expect(parseCommand(".TO @ivan_petrov")).toEqual({
      type: "setTarget",
      query: { kind: "username", value: "ivan_petrov" },
    });
  });

  it("reports .to without argument", () => {
    expect(parseCommand(".to")).toMatchObject({ type: "error" });
  });

  it("reports .to with an invalid username", () => {
    expect(parseCommand(".to @x")).toMatchObject({ type: "error" });
  });

  it("parses .status and .help", () => {
    expect(parseCommand(".status")).toEqual({ type: "status" });
    expect(parseCommand(".help")).toEqual({ type: "help" });
  });

  it("reports unknown dot-commands", () => {
    expect(parseCommand(".foo bar")).toMatchObject({ type: "error" });
  });

  it("treats other text as plain text, preserving inner newlines", () => {
    expect(parseCommand("  Привет,\nкак дела?  ")).toEqual({
      type: "text",
      text: "Привет,\nкак дела?",
    });
  });

  it("does not treat '+1' or 'a - b' as commands", () => {
    expect(parseCommand("+1")).toEqual({ type: "text", text: "+1" });
    expect(parseCommand("a - b")).toEqual({ type: "text", text: "a - b" });
  });

  it("ignores empty messages and the bot's own replies", () => {
    expect(parseCommand("   ")).toEqual({ type: "ignore" });
    expect(parseCommand(`${BOT_MARK} Черновик → Иван`)).toEqual({ type: "ignore" });
  });
});
