import { describe, expect, it, vi } from "vitest";
import { MAX_AUDIO_BYTES, type TranscribeFn, createTranscriber } from "./transcriber.js";

const options = { model: "gpt-4o-mini-transcribe", language: "ru" };

describe("createTranscriber", () => {
  it("passes model, language and file name, and trims the result", async () => {
    const call = vi.fn<TranscribeFn>().mockResolvedValue({ text: "  Привет  \n" });
    const transcriber = createTranscriber(call, options);

    await expect(transcriber.transcribe(Buffer.from("ogg"), "voice.ogg")).resolves.toBe("Привет");

    const request = call.mock.calls[0]?.[0];
    expect(request?.model).toBe("gpt-4o-mini-transcribe");
    expect(request?.language).toBe("ru");
    expect(request?.file.name).toBe("voice.ogg");
  });

  it("rejects empty audio without calling the API", async () => {
    const call = vi.fn<TranscribeFn>();
    await expect(createTranscriber(call, options).transcribe(Buffer.alloc(0), "v.ogg")).rejects.toThrow(
      "пустой",
    );
    expect(call).not.toHaveBeenCalled();
  });

  it("rejects audio over the size limit without calling the API", async () => {
    const call = vi.fn<TranscribeFn>();
    const big = Buffer.alloc(MAX_AUDIO_BYTES + 1);
    await expect(createTranscriber(call, options).transcribe(big, "v.ogg")).rejects.toThrow("25 МБ");
    expect(call).not.toHaveBeenCalled();
  });

  it("propagates API errors", async () => {
    const call = vi.fn<TranscribeFn>().mockRejectedValue(new Error("401 Unauthorized"));
    await expect(createTranscriber(call, options).transcribe(Buffer.from("x"), "v.ogg")).rejects.toThrow("401");
  });
});
