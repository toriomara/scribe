/**
 * Draft workflow as a pure reducer: (state, event) -> (state, effects).
 * Generic over the Telegram peer type so it can be tested without Telegram.
 */
import { withMark } from "./commands.js";

export interface Recipient<P> {
  peer: P;
  name: string;
}

export interface Draft<P> {
  text: string;
  recipient: Recipient<P>;
}

export interface State<P> {
  recipient: Recipient<P> | null;
  draft: Draft<P> | null;
}

export type Event<P> =
  | { type: "recipientResolved"; recipient: Recipient<P> }
  | { type: "transcribed"; text: string }
  | { type: "text"; text: string }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "status" }
  | { type: "help" }
  | { type: "sent"; draft: Draft<P> }
  | { type: "sendFailed"; draft: Draft<P>; reason: string };

export type Effect<P> =
  | { type: "reply"; text: string }
  | { type: "send"; draft: Draft<P> };

export interface Transition<P> {
  state: State<P>;
  effects: Effect<P>[];
}

export function initialState<P>(): State<P> {
  return { recipient: null, draft: null };
}

const reply = <P>(text: string): Effect<P> => ({ type: "reply", text: withMark(text) });

export const HELP_TEXT = [
  "Scribe — голос в текст от вашего имени.",
  "",
  ".to @username | +79991234567 | Название чата — выбрать получателя",
  "🎤 голосовое — распознать в черновик",
  "+ — отправить черновик",
  "- — отменить черновик",
  "любой текст при открытом черновике — заменить текст черновика",
  ".status — текущий получатель и черновик",
].join("\n");

function preview<P>(draft: Draft<P>, prefix = "Черновик"): string {
  return `${prefix} → ${draft.recipient.name}:\n\n${draft.text}\n\n+ отправить · - отменить · или пришлите исправленный текст`;
}

export function reduce<P>(state: State<P>, event: Event<P>): Transition<P> {
  switch (event.type) {
    case "recipientResolved":
      return {
        state: { ...state, recipient: event.recipient },
        effects: [reply(`Получатель: ${event.recipient.name}. Записывайте голосовое.`)],
      };

    case "transcribed": {
      if (!state.recipient) {
        return {
          state,
          effects: [reply("Сначала выберите получателя: .to @username")],
        };
      }
      const text = event.text.trim();
      if (text === "") {
        return { state, effects: [reply("Не удалось разобрать речь. Попробуйте ещё раз.")] };
      }
      const draft: Draft<P> = { text, recipient: state.recipient };
      const prefix = state.draft ? "Новый черновик (предыдущий заменён)" : "Черновик";
      return { state: { ...state, draft }, effects: [reply(preview(draft, prefix))] };
    }

    case "text": {
      // Without an open draft, Saved Messages are just the user's notes.
      if (!state.draft) return { state, effects: [] };
      const draft: Draft<P> = { ...state.draft, text: event.text };
      return { state: { ...state, draft }, effects: [reply(preview(draft, "Черновик обновлён"))] };
    }

    case "confirm":
      if (!state.draft) return { state, effects: [reply("Нет черновика для отправки.")] };
      return { state: { ...state, draft: null }, effects: [{ type: "send", draft: state.draft }] };

    case "cancel":
      if (!state.draft) return { state, effects: [reply("Нет черновика.")] };
      return { state: { ...state, draft: null }, effects: [reply("Черновик удалён.")] };

    case "sent":
      return { state, effects: [reply(`✅ Отправлено → ${event.draft.recipient.name}`)] };

    case "sendFailed":
      // Restore the draft unless the user already started a new one.
      return {
        state: state.draft ? state : { ...state, draft: event.draft },
        effects: [reply(`❌ Не удалось отправить: ${event.reason}. Черновик сохранён, + чтобы повторить.`)],
      };

    case "status": {
      const who = state.recipient ? state.recipient.name : "не выбран";
      const text = state.draft ? `\n\n${preview(state.draft)}` : "\nЧерновика нет.";
      return { state, effects: [reply(`Получатель: ${who}.${text}`)] };
    }

    case "help":
      return { state, effects: [reply(HELP_TEXT)] };
  }
}
