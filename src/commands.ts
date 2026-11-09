/**
 * Parses text messages the user writes in Saved Messages.
 * Pure: no Telegram dependency.
 */

/** Prefix of every message Scribe itself posts, so it never reacts to its own replies. */
export const BOT_MARK = "🤖";

export function withMark(text: string): string {
  return `${BOT_MARK} ${text}`;
}

export type TargetQuery =
  | { kind: "username"; value: string }
  | { kind: "phone"; value: string }
  | { kind: "title"; value: string };

export type Command =
  | { type: "setTarget"; query: TargetQuery }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "status" }
  | { type: "help" }
  | { type: "text"; text: string }
  | { type: "ignore" }
  | { type: "error"; message: string };

const USERNAME_RE = /^[a-z][a-z0-9_]{3,31}$/i;
const TME_RE = /^(?:https?:\/\/)?t\.me\/([a-z][a-z0-9_]{3,31})\/?$/i;

export function parseTarget(raw: string): TargetQuery | null {
  const input = raw.trim();
  if (input === "") return null;

  const link = TME_RE.exec(input);
  if (link?.[1]) return { kind: "username", value: link[1] };

  if (input.startsWith("@")) {
    const name = input.slice(1);
    return USERNAME_RE.test(name) ? { kind: "username", value: name } : null;
  }

  if (/^\+[\d\s()-]+$/.test(input)) {
    const digits = input.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15
      ? { kind: "phone", value: `+${digits}` }
      : null;
  }

  return { kind: "title", value: input };
}

export function parseCommand(raw: string): Command {
  const text = raw.trim();
  if (text === "" || text.startsWith(BOT_MARK)) return { type: "ignore" };

  if (text === "+") return { type: "confirm" };
  if (text === "-") return { type: "cancel" };

  const match = /^\.(\w+)(?:\s+([\s\S]*))?$/.exec(text);
  if (match?.[1]) {
    const name = match[1].toLowerCase();
    const arg = match[2]?.trim() ?? "";
    switch (name) {
      case "to": {
        if (arg === "") {
          return { type: "error", message: "Укажите получателя: .to @username, .to +79991234567 или .to Название чата" };
        }
        const query = parseTarget(arg);
        return query
          ? { type: "setTarget", query }
          : { type: "error", message: `Не понял получателя «${arg}»` };
      }
      case "status":
        return { type: "status" };
      case "help":
        return { type: "help" };
      default:
        return { type: "error", message: `Неизвестная команда .${name}. Напишите .help` };
    }
  }

  return { type: "text", text };
}
