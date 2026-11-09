import { describe, expect, it } from "vitest";
import { BOT_MARK } from "./commands.js";
import { type Effect, type Event, type State, initialState, reduce } from "./state.js";

type Peer = string;
const ivan = { peer: "ivan-peer", name: "Иван" };
const group = { peer: "group-peer", name: "Рабочая группа" };

function run(events: Event<Peer>[], start: State<Peer> = initialState()) {
  let state = start;
  let effects: Effect<Peer>[] = [];
  for (const event of events) {
    ({ state, effects } = reduce(state, event));
  }
  return { state, effects };
}

function replies(effects: Effect<Peer>[]): string[] {
  return effects.flatMap((e) => (e.type === "reply" ? [e.text] : []));
}

describe("reduce", () => {
  it("every reply carries the bot mark", () => {
    const { effects } = run([{ type: "help" }]);
    expect(replies(effects).every((t) => t.startsWith(BOT_MARK))).toBe(true);
  });

  it("asks for a recipient when a voice arrives first", () => {
    const { state, effects } = run([{ type: "transcribed", text: "привет" }]);
    expect(state.draft).toBeNull();
    expect(replies(effects)[0]).toContain(".to");
  });

  it("happy path: recipient -> voice -> confirm sends the draft", () => {
    const { state, effects } = run([
      { type: "recipientResolved", recipient: ivan },
      { type: "transcribed", text: "  Буду через десять минут  " },
      { type: "confirm" },
    ]);
    expect(effects).toEqual([
      { type: "send", draft: { text: "Буду через десять минут", recipient: ivan } },
    ]);
    expect(state.draft).toBeNull();
    expect(state.recipient).toEqual(ivan);
  });

  it("draft keeps the recipient chosen at recording time", () => {
    const { effects } = run([
      { type: "recipientResolved", recipient: ivan },
      { type: "transcribed", text: "текст" },
      { type: "recipientResolved", recipient: group },
      { type: "confirm" },
    ]);
    expect(effects[0]).toMatchObject({ type: "send", draft: { recipient: ivan } });
  });

  it("plain text replaces the draft text and shows a new preview", () => {
    const { state, effects } = run([
      { type: "recipientResolved", recipient: ivan },
      { type: "transcribed", text: "черновик" },
      { type: "text", text: "исправлено" },
    ]);
    expect(state.draft?.text).toBe("исправлено");
    expect(replies(effects)[0]).toContain("исправлено");
  });

  it("plain text without a draft is ignored (user notes)", () => {
    const { state, effects } = run([
      { type: "recipientResolved", recipient: ivan },
      { type: "text", text: "купить хлеб" },
    ]);
    expect(effects).toEqual([]);
    expect(state.draft).toBeNull();
  });

  it("a second voice replaces the draft and says so", () => {
    const { state, effects } = run([
      { type: "recipientResolved", recipient: ivan },
      { type: "transcribed", text: "первый" },
      { type: "transcribed", text: "второй" },
    ]);
    expect(state.draft?.text).toBe("второй");
    expect(replies(effects)[0]).toContain("предыдущий заменён");
  });

  it("empty transcription does not create a draft", () => {
    const { state, effects } = run([
      { type: "recipientResolved", recipient: ivan },
      { type: "transcribed", text: "   " },
    ]);
    expect(state.draft).toBeNull();
    expect(replies(effects)[0]).toContain("Не удалось");
  });

  it("cancel removes the draft; confirm/cancel without draft just reply", () => {
    const cancelled = run([
      { type: "recipientResolved", recipient: ivan },
      { type: "transcribed", text: "x" },
      { type: "cancel" },
    ]);
    expect(cancelled.state.draft).toBeNull();
    expect(run([{ type: "confirm" }]).effects).toEqual([
      { type: "reply", text: `${BOT_MARK} Нет черновика для отправки.` },
    ]);
    expect(run([{ type: "cancel" }]).effects[0]).toMatchObject({ type: "reply" });
  });

  it("sendFailed restores the draft so + can retry", () => {
    const draft = { text: "x", recipient: ivan };
    const { state, effects } = run([
      { type: "recipientResolved", recipient: ivan },
      { type: "sendFailed", draft, reason: "FLOOD_WAIT" },
    ]);
    expect(state.draft).toEqual(draft);
    expect(replies(effects)[0]).toContain("FLOOD_WAIT");
  });

  it("sendFailed does not overwrite a newer draft", () => {
    const old = { text: "old", recipient: ivan };
    const { state } = run([
      { type: "recipientResolved", recipient: ivan },
      { type: "transcribed", text: "new" },
      { type: "sendFailed", draft: old, reason: "x" },
    ]);
    expect(state.draft?.text).toBe("new");
  });

  it("sent confirms with the recipient name", () => {
    const { effects } = run([{ type: "sent", draft: { text: "x", recipient: group } }]);
    expect(replies(effects)[0]).toContain("Рабочая группа");
  });

  it("status reports recipient and draft", () => {
    const { effects } = run([
      { type: "recipientResolved", recipient: ivan },
      { type: "transcribed", text: "текст" },
      { type: "status" },
    ]);
    const [text] = replies(effects);
    expect(text).toContain("Иван");
    expect(text).toContain("текст");
  });
});
