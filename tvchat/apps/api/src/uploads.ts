import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Video } from "@tvchat/shared";
import { seedChannels } from "./seed";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** Writable upload directory next to compiled `dist/` or alongside `src/` in dev. */
export const UPLOAD_DIR = join(__dirname, "..", "uploads");

const MAX_BYTES = 200 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".m4v": "video/x-m4v",
};

function safeFilename(name: string): string {
  const base = basename(name).replace(/[^a-zA-Z0-9._-]/g, "");
  return base || "video.bin";
}

export async function ensureUploadDir(): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveUploadedVideo(params: {
  file: File;
  channelId: string;
  caption: string;
  userId: string;
  displayName: string;
}): Promise<Video> {
  const { file, channelId, caption, userId, displayName } = params;

  const channel = seedChannels.find((c) => c.id === channelId);
  if (!channel) {
    throw new Error("unknown_channel");
  }

  if (file.size > MAX_BYTES) {
    throw new Error("file_too_large");
  }

  const orig = safeFilename(file.name);
  const ext = extname(orig).toLowerCase() || ".mp4";
  if (!MIME_BY_EXT[ext]) {
    throw new Error("unsupported_type");
  }

  await ensureUploadDir();

  const id = `vid-${randomUUID()}`;
  const storedName = `${id}${ext}`;
  const diskPath = join(UPLOAD_DIR, storedName);

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buf);

  const publicPath = `/uploads/${storedName}`;

  return {
    id,
    channelId,
    author: {
      id: userId,
      displayName,
      handle: userId,
    },
    caption: caption.trim() || " ",
    thumbnailUrl: publicPath,
    playbackUrl: publicPath,
    durationSeconds: 0,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  };
}

export function getUploadMime(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export async function openUploadStream(
  filename: string,
): Promise<{ stream: ReturnType<typeof createReadStream>; mime: string } | null> {
  const name = basename(filename);
  if (!/^[\w.-]+$/.test(name)) return null;
  const diskPath = join(UPLOAD_DIR, name);
  try {
    await stat(diskPath);
  } catch {
    return null;
  }
  return { stream: createReadStream(diskPath), mime: getUploadMime(name) };
}
