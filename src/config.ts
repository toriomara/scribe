import { z } from "zod";

const credentialsShape = {
  TELEGRAM_API_ID: z.coerce
    .number({ error: "должен быть числом" })
    .int("должен быть целым числом")
    .positive("должен быть положительным числом"),
  TELEGRAM_API_HASH: z
    .string({ error: "не задан" })
    .regex(/^[0-9a-f]{32}$/i, "должен состоять из 32 hex-символов"),
};

/** Empty or whitespace-only values count as "not set", so `.default()` applies. */
function blankAsUnset<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema,
  );
}

const loginSchema =z.object(credentialsShape).transform((env) => ({
  apiId: env.TELEGRAM_API_ID,
  apiHash: env.TELEGRAM_API_HASH,
}));

const appSchema = z
  .object({
    ...credentialsShape,
    TELEGRAM_SESSION: z
      .string({ error: "не задан — выполните `npm run login`" })
      .trim()
      .min(1, "пуст — выполните `npm run login`"),
    OPENAI_API_KEY: z
      .string({ error: "не задан — ключ с platform.openai.com → API keys" })
      .trim()
      .min(1, "пуст — ключ с platform.openai.com → API keys"),
    OPENAI_TRANSCRIBE_MODEL: blankAsUnset(z.string().trim().default("gpt-4o-mini-transcribe")),
    TRANSCRIBE_LANGUAGE: blankAsUnset(
      z
        .string()
        .trim()
        .regex(/^[a-z]{2}$/, "код языка ISO-639-1, например ru или en")
        .default("ru"),
    ),
    MAX_VOICE_SECONDS: blankAsUnset(
      z.coerce
        .number({ error: "должен быть числом" })
        .int("должен быть целым числом")
        .positive("должен быть больше нуля")
        .default(300),
    ),
  })
  .transform((env) => ({
    apiId: env.TELEGRAM_API_ID,
    apiHash: env.TELEGRAM_API_HASH,
    session: env.TELEGRAM_SESSION,
    openAiApiKey: env.OPENAI_API_KEY,
    transcribeModel: env.OPENAI_TRANSCRIBE_MODEL,
    language: env.TRANSCRIBE_LANGUAGE,
    maxVoiceSeconds: env.MAX_VOICE_SECONDS,
  }));

export type LoginConfig = z.infer<typeof loginSchema>;
export type AppConfig = z.infer<typeof appSchema>;

type Env = Record<string, string | undefined>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

function parse<T>(schema: z.ZodType<T>, env: Env): T {
  const result = schema.safeParse(env);
  if (result.success) return result.data;

  const lines = result.error.issues.map(
    (issue) => `  - ${issue.path.join(".") || "(env)"}: ${issue.message}`,
  );
  throw new ConfigError(
    `Некорректная конфигурация в .env:\n${lines.join("\n")}`,
  );
}

export function loadLoginConfig(env: Env): LoginConfig {
  return parse(loginSchema, env);
}

export function loadAppConfig(env: Env): AppConfig {
  return parse(appSchema, env);
}
