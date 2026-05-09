import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { CaptionTrack, Video } from "@tvchat/shared";
import { captionLanguageLabel } from "@tvchat/shared";
import { UPLOAD_DIR } from "./uploads.js";

const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

type WhisperSegment = { start: number; end: number; text: string };

function segmentsToWebVtt(segments: WhisperSegment[]): string {
  const lines = ["WEBVTT", ""];
  let i = 1;
  for (const s of segments) {
    const t0 = formatVttTime(s.start);
    const t1 = formatVttTime(s.end);
    lines.push(String(i++));
    lines.push(`${t0} --> ${t1}`);
    lines.push(s.text.trim());
    lines.push("");
  }
  return lines.join("\n");
}

function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const whole = Math.floor(s);
  const ms = Math.round((s - whole) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(whole)}.${pad(ms, 3)}`;
}

export async function whisperToSegments(
  videoAbsPath: string,
  language?: string,
): Promise<{ segments: WhisperSegment[]; language?: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("missing_openai_key");

  const buf = await readFile(videoAbsPath);
  if (buf.length > WHISPER_MAX_BYTES) {
    throw new Error("video_too_large_for_whisper");
  }

  const form = new FormData();
  form.append("file", new Blob([buf]), basename(videoAbsPath));
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  if (language) form.append("language", language);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`whisper_http_${res.status}: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    language?: string;
    segments?: { start: number; end: number; text: string }[];
  };

  const segments = (data.segments ?? []).map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text ?? "",
  }));

  return { segments, language: data.language };
}

async function translateSegmentBatch(
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("missing_openai_key");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You translate subtitle lines. Reply with JSON only: {\"lines\": string[]} same length and order as input.",
        },
        {
          role: "user",
          content: JSON.stringify({
            targetLanguage: targetLang,
            lines: texts,
          }),
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`translate_http_${res.status}: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("translate_empty");
  const parsed = JSON.parse(raw) as { lines?: string[] };
  const out = parsed.lines;
  if (!Array.isArray(out) || out.length !== texts.length) {
    throw new Error("translate_bad_shape");
  }
  return out;
}

export async function translateSegments(
  segments: WhisperSegment[],
  targetLang: string,
): Promise<WhisperSegment[]> {
  const batchSize = 24;
  const out: WhisperSegment[] = [];
  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    const texts = batch.map((s) => s.text.trim() || " ");
    const translated = await translateSegmentBatch(texts, targetLang);
    batch.forEach((s, j) => {
      out.push({
        start: s.start,
        end: s.end,
        text: translated[j] ?? s.text,
      });
    });
  }
  return out;
}

export async function writeCaptionTrackFile(
  videoId: string,
  lang: string,
  vttBody: string,
): Promise<CaptionTrack> {
  const safeLang = normalizeLangCode(lang);
  const name = `${videoId}.${safeLang}.vtt`;
  const abs = join(UPLOAD_DIR, name);
  await writeFile(abs, vttBody, "utf8");
  return {
    lang: safeLang,
    label: captionLanguageLabel(safeLang),
    url: `/uploads/${name}`,
  };
}

function normalizeLangCode(lang: string): string {
  const t = lang.trim().toLowerCase().replace(/[^a-z-]/g, "");
  const map: Record<string, string> = {
    english: "en",
    turkish: "tr",
    spanish: "es",
    french: "fr",
    german: "de",
    italian: "it",
    portuguese: "pt",
    dutch: "nl",
    polish: "pl",
    japanese: "ja",
    korean: "ko",
    chinese: "zh",
  };
  if (t.length === 2) return t;
  return map[t] ?? (t.slice(0, 2) || "und");
}

function whisperLanguageToCode(whisper?: string, fallback = "en"): string {
  if (!whisper) return fallback;
  return normalizeLangCode(whisper);
}

/** Fire-and-forget Whisper + optional translated VTT files; mutates `video` in place. */
export function scheduleAutoCaptions(
  video: Video,
  videoAbsPath: string,
  opts: { whisperLanguage?: string; translateLangs: string[] },
): void {
  void (async () => {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      video.captionGeneration = {
        status: "failed",
        message: "Set OPENAI_API_KEY to enable auto captions.",
      };
      return;
    }

    video.captionGeneration = {
      status: "pending",
      message: "Transcribing with Whisper…",
    };

    try {
      const { segments, language } = await whisperToSegments(
        videoAbsPath,
        opts.whisperLanguage,
      );
      const baseLang = whisperLanguageToCode(
        opts.whisperLanguage ?? language,
        "en",
      );
      const baseVtt = segmentsToWebVtt(segments);
      const baseTrack = await writeCaptionTrackFile(
        video.id,
        baseLang,
        baseVtt,
      );
      video.captionTracks = mergeTracks(video.captionTracks, [baseTrack]);

      const targets = [
        ...new Set(
          opts.translateLangs.map((x) => normalizeLangCode(x)).filter((l) => l !== baseLang),
        ),
      ];

      for (const lang of targets) {
        video.captionGeneration = {
          status: "pending",
          message: `Translating to ${captionLanguageLabel(lang)}…`,
        };
        const translated = await translateSegments(segments, lang);
        const vtt = segmentsToWebVtt(translated);
        const tr = await writeCaptionTrackFile(video.id, lang, vtt);
        video.captionTracks = mergeTracks(video.captionTracks, [tr]);
      }

      video.captionGeneration = { status: "ready" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "caption_failed";
      video.captionGeneration = { status: "failed", message: msg };
      console.error("[captions]", msg);
    }
  })();
}

function mergeTracks(
  existing: CaptionTrack[] | undefined,
  add: CaptionTrack[],
): CaptionTrack[] {
  const byLang = new Map<string, CaptionTrack>();
  for (const t of existing ?? []) byLang.set(t.lang, t);
  for (const t of add) byLang.set(t.lang, t);
  return [...byLang.values()];
}
