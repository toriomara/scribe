import { TelegramClient } from "telegram";
import { Logger, LogLevel } from "telegram/extensions/Logger.js";
import { StringSession } from "telegram/sessions/index.js";

export interface ClientOptions {
  apiId: number;
  apiHash: string;
  session: StringSession;
}

export function createClient({ apiId, apiHash, session }: ClientOptions): TelegramClient {
  return new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    baseLogger: new Logger(LogLevel.WARN),
  });
}

export { StringSession };
