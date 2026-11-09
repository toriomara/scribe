/**
 * One-time interactive login. Prints a session string to put into .env
 * as TELEGRAM_SESSION. Run with: npm run login
 */
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { loadLoginConfig } from "./config.js";
import { createClient, StringSession } from "./telegram.js";

const config = loadLoginConfig(process.env);
const session = new StringSession("");
const client = createClient({ ...config, session });
const rl = createInterface({ input: stdin, output: stdout });

try {
  await client.start({
    phoneNumber: () => rl.question("Номер телефона (в формате +79991234567): "),
    phoneCode: () => rl.question("Код из Telegram: "),
    password: () => rl.question("Облачный пароль 2FA: "),
    onError: (error) => {
      console.error("Ошибка входа:", error.message);
    },
  });

  const me = await client.getMe();
  console.log(`\nВход выполнен: ${me.firstName ?? ""} (@${me.username ?? "—"})`);
  console.log("\nДобавьте в .env строку ниже. Это ПОЛНЫЙ доступ к аккаунту — никому не показывайте:\n");
  console.log(`TELEGRAM_SESSION=${session.save()}\n`);
} finally {
  rl.close();
  await client.disconnect();
}
