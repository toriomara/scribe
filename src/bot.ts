/**
 * Telegram adapter: listens to Saved Messages, feeds the pure reducer,
 * and performs its effects (replies, sending drafts).
 */
import { Api, type TelegramClient } from "telegram";
import type { Entity } from "telegram/define.js";
import { NewMessage, type NewMessageEvent } from "telegram/events/index.js";
import { type TargetQuery, parseCommand, withMark } from "./commands.js";
import { matchDialog } from "./dialogs.js";
import { type Draft, type Event, type Recipient, initialState, reduce } from "./state.js";
import type { Transcriber } from "./transcriber.js";

type Peer = Api.TypeInputPeer;

export interface BotOptions {
  client: TelegramClient;
  transcriber: Transcriber;
  maxVoiceSeconds: number;
}

const DIALOG_SCAN_LIMIT = 500;

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function entityName(entity: Entity): string {
  if (entity instanceof Api.User) {
    const full = [entity.firstName, entity.lastName].filter(Boolean).join(" ");
    return full || (entity.username ? `@${entity.username}` : "пользователь");
  }
  return "title" in entity && typeof entity.title === "string" ? entity.title : "чат";
}

function audioAttributes(doc: Api.Document): { duration?: number; fileName?: string } {
  let duration: number | undefined;
  let fileName: string | undefined;
  for (const attr of doc.attributes) {
    if (attr instanceof Api.DocumentAttributeAudio) duration = attr.duration;
    if (attr instanceof Api.DocumentAttributeFilename) fileName = attr.fileName;
  }
  return { ...(duration !== undefined && { duration }), ...(fileName !== undefined && { fileName }) };
}

export async function startBot({ client, transcriber, maxVoiceSeconds }: BotOptions): Promise<void> {
  const me = await client.getMe();
  let state = initialState<Peer>();
  let queue: Promise<void> = Promise.resolve();

  const reply = async (text: string): Promise<void> => {
    await client.sendMessage("me", { message: text });
  };

  const deliver = async (draft: Draft<Peer>): Promise<void> => {
    try {
      await client.sendMessage(draft.recipient.peer, { message: draft.text });
      await dispatch({ type: "sent", draft });
    } catch (error) {
      await dispatch({ type: "sendFailed", draft, reason: errorText(error) });
    }
  };

  async function dispatch(event: Event<Peer>): Promise<void> {
    const transition = reduce(state, event);
    state = transition.state;
    for (const effect of transition.effects) {
      if (effect.type === "reply") await reply(effect.text);
      else await deliver(effect.draft);
    }
  }

  const resolveRecipient = async (query: TargetQuery): Promise<Recipient<Peer> | string> => {
    if (query.kind === "title") {
      const dialogs = await client.getDialogs({ limit: DIALOG_SCAN_LIMIT });
      const candidates = dialogs.flatMap((d) =>
        d.title ? [{ title: d.title, peer: d.inputEntity }] : [],
      );
      const match = matchDialog(candidates, query.value);
      switch (match.type) {
        case "found":
          return { peer: match.item.peer, name: match.item.title };
        case "ambiguous":
          return `Под «${query.value}» подходит несколько чатов:\n${match.titles.map((t) => `• ${t}`).join("\n")}\nУточните название или используйте @username.`;
        case "notFound":
          return `Чат «${query.value}» не найден среди последних ${DIALOG_SCAN_LIMIT} диалогов.`;
      }
    }

    try {
      const entity = await client.getEntity(query.value);
      const peer = await client.getInputEntity(entity);
      return { peer, name: entityName(entity) };
    } catch {
      return query.kind === "phone"
        ? `Номер ${query.value} не найден. По номеру Telegram находит только ваши контакты.`
        : `Пользователь или чат @${query.value} не найден.`;
    }
  };

  const handleVoice = async (message: Api.Message, doc: Api.Document): Promise<void> => {
    const { duration, fileName } = audioAttributes(doc);
    if (duration !== undefined && duration > maxVoiceSeconds) {
      await reply(withMark(`Слишком длинная запись (${duration} с). Максимум — ${maxVoiceSeconds} с.`));
      return;
    }
    await reply(withMark("🎧 Распознаю…"));
    const data = await client.downloadMedia(message);
    if (!Buffer.isBuffer(data)) throw new Error("не удалось скачать аудио");
    const text = await transcriber.transcribe(data, message.voice ? "voice.ogg" : (fileName ?? "audio.mp3"));
    await dispatch({ type: "transcribed", text });
  };

  const handle = async (message: Api.Message): Promise<void> => {
    const doc = message.voice ?? message.audio;
    if (doc) {
      await handleVoice(message, doc);
      return;
    }

    const command = parseCommand(message.message);
    switch (command.type) {
      case "ignore":
        return;
      case "error":
        await reply(withMark(command.message));
        return;
      case "setTarget": {
        const result = await resolveRecipient(command.query);
        if (typeof result === "string") await reply(withMark(result));
        else await dispatch({ type: "recipientResolved", recipient: result });
        return;
      }
      default:
        await dispatch(command);
    }
  };

  const isSavedMessages = (message: Api.Message): boolean =>
    message.out === true &&
    message.peerId instanceof Api.PeerUser &&
    message.peerId.userId.equals(me.id);

  client.addEventHandler((event: NewMessageEvent) => {
    const { message } = event;
    if (!isSavedMessages(message)) return;
    // Process strictly one message at a time to keep state consistent.
    queue = queue
      .then(() => handle(message))
      .catch(async (error: unknown) => {
        console.error(error);
        await reply(withMark(`Ошибка: ${errorText(error)}`)).catch((replyError: unknown) => {
          console.error(replyError);
        });
      });
  }, new NewMessage({}));
}
