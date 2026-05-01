import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Comment, Video } from "@tvchat/shared";
import { seedChannels, seedComments, seedVideos } from "./seed";

const PORT = Number(process.env.PORT) || 3001;

const videos: Video[] = structuredClone(seedVideos);
const comments: Comment[] = structuredClone(seedComments);
const likedPairs = new Map<string, Set<string>>();

function userIdFrom(c: { req: { header: (k: string) => string | undefined } }) {
  return c.req.header("x-user-id")?.trim() || "demo-user";
}

function likedBy(videoId: string, userId: string): boolean {
  return likedPairs.get(videoId)?.has(userId) ?? false;
}

function withViewerFlags(v: Video, userId: string): Video {
  return { ...v, likedByViewer: likedBy(v.id, userId) };
}

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:8081",
      "http://127.0.0.1:8081",
    ],
    allowHeaders: ["Content-Type", "X-User-Id"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/channels", (c) => c.json(seedChannels));

app.get("/feed", (c) => {
  const channelId = c.req.query("channelId");
  const userId = userIdFrom(c);
  let list = videos;
  if (channelId) {
    list = videos.filter((v) => v.channelId === channelId);
  }
  return c.json(list.map((v) => withViewerFlags(v, userId)));
});

app.get("/videos/:id", (c) => {
  const id = c.req.param("id");
  const userId = userIdFrom(c);
  const v = videos.find((x) => x.id === id);
  if (!v) return c.json({ error: "not_found" }, 404);
  return c.json(withViewerFlags(v, userId));
});

app.get("/videos/:id/comments", (c) => {
  const id = c.req.param("id");
  const list = comments.filter((x) => x.videoId === id);
  return c.json(list);
});

app.post("/videos/:id/like", (c) => {
  const id = c.req.param("id");
  const userId = userIdFrom(c);
  const v = videos.find((x) => x.id === id);
  if (!v) return c.json({ error: "not_found" }, 404);

  if (!likedPairs.has(id)) likedPairs.set(id, new Set());
  const set = likedPairs.get(id)!;

  if (set.has(userId)) {
    set.delete(userId);
    v.likeCount = Math.max(0, v.likeCount - 1);
  } else {
    set.add(userId);
    v.likeCount += 1;
  }

  return c.json({
    video: withViewerFlags(v, userId),
  });
});

app.post("/videos/:id/share", (c) => {
  const id = c.req.param("id");
  const v = videos.find((x) => x.id === id);
  if (!v) return c.json({ error: "not_found" }, 404);
  v.shareCount += 1;
  const userId = userIdFrom(c);
  return c.json({ video: withViewerFlags(v, userId) });
});

app.post("/videos/:id/comments", async (c) => {
  const id = c.req.param("id");
  const v = videos.find((x) => x.id === id);
  if (!v) return c.json({ error: "not_found" }, 404);

  let bodyText = "";
  try {
    const json = await c.req.json<{ body?: string }>();
    bodyText = (json.body ?? "").trim();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  if (!bodyText) return c.json({ error: "empty_body" }, 400);

  const userId = userIdFrom(c);
  const comment: Comment = {
    id: `c-${Date.now()}`,
    videoId: id,
    author: {
      id: userId,
      displayName: "You",
      handle: userId,
    },
    body: bodyText,
    createdAt: new Date().toISOString(),
  };
  comments.push(comment);
  v.commentCount += 1;

  return c.json(
    { comment, video: withViewerFlags(v, userId) },
    201,
  );
});

serve({ fetch: app.fetch, port: PORT });
console.log(`TVChat API listening on http://localhost:${PORT}`);
