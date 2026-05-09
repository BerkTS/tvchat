/** One subtitle track (e.g. WebVTT served at `url`). */
export interface CaptionTrack {
  lang: string;
  label: string;
  url: string;
}

/** BCP-47 → human label for UI (fallback: language code). */
export function captionLanguageLabel(lang: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}

/** Minimal WEBVTT cue list for native clients. */
export interface VttCue {
  start: number;
  end: number;
  text: string;
}

/** Parse a simple WEBVTT body into cues (no styles/regions). */
export function parseWebVtt(body: string): VttCue[] {
  const cues: VttCue[] = [];
  const blocks = body.replace(/\r\n/g, "\n").trim().split(/\n\n+/);
  const timeRe = /^(\d{2}:\d{2}:\d{2}[.,]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[.,]\d{3})/;

  for (const block of blocks) {
    if (block.startsWith("WEBVTT") || block.startsWith("NOTE")) continue;
    const lines = block.split("\n").filter(Boolean);
    if (lines.length < 2) continue;
    let timeLine = lines[0];
    let textStart = 1;
    if (!timeRe.test(timeLine) && lines.length >= 2) {
      timeLine = lines[1];
      textStart = 2;
    }
    const m = timeRe.exec(timeLine);
    if (!m) continue;
    const start = vttTimeToSeconds(m[1]);
    const end = vttTimeToSeconds(m[2]);
    const text = lines.slice(textStart).join("\n").trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

function vttTimeToSeconds(t: string): number {
  const normalized = t.replace(",", ".");
  const [hms, frac = "0"] = normalized.split(".");
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + s + parseInt(frac.padEnd(3, "0").slice(0, 3), 10) / 1000;
}

export function activeCue(cues: VttCue[], timeSeconds: number): string | null {
  const t = cues.find((c) => timeSeconds >= c.start && timeSeconds <= c.end);
  return t?.text ?? null;
}
