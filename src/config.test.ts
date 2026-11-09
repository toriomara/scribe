import { describe, expect, it } from "vitest";
import { ConfigError, loadAppConfig, loadLoginConfig } from "./config.js";

const validHash = "0123456789abcdef0123456789ABCDEF";

describe("loadLoginConfig", () => {
  it("parses valid credentials", () => {
    expect(
      loadLoginConfig({ TELEGRAM_API_ID: "12345", TELEGRAM_API_HASH: validHash }),
    ).toEqual({ apiId: 12345, apiHash: validHash });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["not a number", "abc"],
    ["negative", "-5"],
    ["fractional", "1.5"],
  ])("rejects api id that is %s", (_label, value) => {
    expect(() =>
      loadLoginConfig({ TELEGRAM_API_ID: value, TELEGRAM_API_HASH: validHash }),
    ).toThrow(ConfigError);
  });

  it("rejects malformed api hash and names the variable", () => {
    expect(() =>
      loadLoginConfig({ TELEGRAM_API_ID: "1", TELEGRAM_API_HASH: "short" }),
    ).toThrow(/TELEGRAM_API_HASH/);
  });
});

describe("loadAppConfig", () => {
  const base = {
    TELEGRAM_API_ID: "1",
    TELEGRAM_API_HASH: validHash,
    OPENAI_API_KEY: "sk-test",
  };

  it("applies defaults for optional settings, including blank values", () => {
    const config = loadAppConfig({ ...base, TELEGRAM_SESSION: "s", TRANSCRIBE_LANGUAGE: "  " });
    expect(config).toMatchObject({
      openAiApiKey: "sk-test",
      transcribeModel: "gpt-4o-mini-transcribe",
      language: "ru",
      maxVoiceSeconds: 300,
    });
  });

  it("accepts overrides for optional settings", () => {
    const config = loadAppConfig({
      ...base,
      TELEGRAM_SESSION: "s",
      OPENAI_TRANSCRIBE_MODEL: "whisper-1",
      TRANSCRIBE_LANGUAGE: "en",
      MAX_VOICE_SECONDS: "60",
    });
    expect(config).toMatchObject({ transcribeModel: "whisper-1", language: "en", maxVoiceSeconds: 60 });
  });

  it.each([
    ["TRANSCRIBE_LANGUAGE", "russian"],
    ["MAX_VOICE_SECONDS", "0"],
    ["MAX_VOICE_SECONDS", "abc"],
  ])("rejects invalid %s=%j", (key, value) => {
    expect(() => loadAppConfig({ ...base, TELEGRAM_SESSION: "s", [key]: value })).toThrow(
      new RegExp(key),
    );
  });

  it("requires the OpenAI key", () => {
    expect(() =>
      loadAppConfig({ ...base, TELEGRAM_SESSION: "s", OPENAI_API_KEY: undefined }),
    ).toThrow(/OPENAI_API_KEY/);
  });

  it("returns trimmed session", () => {
    expect(loadAppConfig({ ...base, TELEGRAM_SESSION: "  abc  " }).session).toBe(
      "abc",
    );
  });

  it.each([undefined, "", "   "])("requires session (%j)", (session) => {
    expect(() => loadAppConfig({ ...base, TELEGRAM_SESSION: session })).toThrow(
      /npm run login/,
    );
  });

  it("reports all problems at once", () => {
    try {
      loadAppConfig({});
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = (error as ConfigError).message;
      expect(message).toContain("TELEGRAM_API_ID");
      expect(message).toContain("TELEGRAM_API_HASH");
      expect(message).toContain("TELEGRAM_SESSION");
      expect(message).toContain("OPENAI_API_KEY");
    }
  });
});
