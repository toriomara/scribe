import { startBot } from "./bot.js";
import { loadAppConfig } from "./config.js";
import { createClient, StringSession } from "./telegram.js";
import { createOpenAiTranscriber } from "./transcriber.js";

const config = loadAppConfig(process.env);
const client = createClient({ ...config, session: new StringSession(config.session) });

await client.connect();
if (!(await client.checkAuthorization())) {
  console.error("Сессия недействительна или отозвана. Выполните `npm run login` заново.");
  await client.disconnect();
  process.exit(1);
}

const transcriber = createOpenAiTranscriber(config.openAiApiKey, {
  model: config.transcribeModel,
  language: config.language,
});
await startBot({ client, transcriber, maxVoiceSeconds: config.maxVoiceSeconds });

const me = await client.getMe();
console.log(`Scribe запущен как ${me.firstName ?? ""} (@${me.username ?? "—"}). Ctrl+C — выход.`);
console.log("Откройте «Избранное» в Telegram и напишите .help");

const shutdown = async (): Promise<void> => {
  await client.disconnect();
  process.exit(0);
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
