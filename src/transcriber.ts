import OpenAI, { toFile } from "openai";

export interface Transcriber {
  /** Returns recognized text (may be empty if nothing was recognized). */
  transcribe(audio: Buffer, fileName: string): Promise<string>;
}

export interface TranscribeRequest {
  file: Awaited<ReturnType<typeof toFile>>;
  model: string;
  language: string;
}

/** The single SDK call we depend on — makes the transcriber easy to fake in tests. */
export type TranscribeFn = (request: TranscribeRequest) => Promise<{ text: string }>;

export interface TranscriberOptions {
  model: string;
  language: string;
}

/** OpenAI limit for audio uploads. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export function createTranscriber(call: TranscribeFn, options: TranscriberOptions): Transcriber {
  return {
    async transcribe(audio, fileName) {
      if (audio.byteLength === 0) throw new Error("пустой аудиофайл");
      if (audio.byteLength > MAX_AUDIO_BYTES) throw new Error("файл больше 25 МБ");

      const file = await toFile(audio, fileName);
      const result = await call({ file, model: options.model, language: options.language });
      return result.text.trim();
    },
  };
}

export function createOpenAiTranscriber(apiKey: string, options: TranscriberOptions): Transcriber {
  const client = new OpenAI({ apiKey });
  return createTranscriber(
    (request) => client.audio.transcriptions.create(request),
    options,
  );
}
