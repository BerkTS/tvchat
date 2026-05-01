"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Comment, TVChannel, Video } from "@tvchat/shared";
import { apiPaths } from "@tvchat/shared";
import { getApiBase } from "@/lib/api-base";

const USER_HEADER = "X-User-Id";
const DEMO_USER = "demo-user";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      [USER_HEADER]: DEMO_USER,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function FeedClient() {
  const [channels, setChannels] = useState<TVChannel[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentsByVideo, setCommentsByVideo] = useState<Record<string, Comment[]>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  const feedPath = useMemo(() => {
    const q = channelId ? `?channelId=${encodeURIComponent(channelId)}` : "";
    return `${apiPaths.feed}${q}`;
  }, [channelId]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchJson<Video[]>(feedPath);
      setVideos(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [feedPath]);

  useEffect(() => {
    void (async () => {
      try {
        const ch = await fetchJson<TVChannel[]>(apiPaths.channels);
        setChannels(ch);
      } catch {
        setChannels([]);
      }
    })();
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const loadComments = async (videoId: string) => {
    if (commentsByVideo[videoId]) return;
    try {
      const list = await fetchJson<Comment[]>(apiPaths.comments(videoId));
      setCommentsByVideo((prev) => ({ ...prev, [videoId]: list }));
    } catch {
      setCommentsByVideo((prev) => ({ ...prev, [videoId]: [] }));
    }
  };

  const toggleComments = async (videoId: string) => {
    if (expandedId === videoId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(videoId);
    await loadComments(videoId);
  };

  const toggleLike = async (videoId: string) => {
    try {
      const data = await fetchJson<{ video: Video }>(apiPaths.like(videoId), {
        method: "POST",
        body: "{}",
      });
      setVideos((prev) => prev.map((v) => (v.id === videoId ? data.video : v)));
    } catch {
      /* ignore */
    }
  };

  const share = async (videoId: string) => {
    try {
      const data = await fetchJson<{ video: Video }>(apiPaths.share(videoId), {
        method: "POST",
        body: "{}",
      });
      setVideos((prev) => prev.map((v) => (v.id === videoId ? data.video : v)));
    } catch {
      /* ignore */
    }
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "TVChat", text: "Clip on TVChat", url });
      } catch {
        /* dismissed */
      }
    }
  };

  const postComment = async (videoId: string) => {
    const body = (commentDraft[videoId] ?? "").trim();
    if (!body) return;
    try {
      const data = await fetchJson<{ comment: Comment; video: Video }>(
        apiPaths.comments(videoId),
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );
      setCommentDraft((d) => ({ ...d, [videoId]: "" }));
      const list = await fetchJson<Comment[]>(apiPaths.comments(videoId));
      setCommentsByVideo((prev) => ({ ...prev, [videoId]: list }));
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? data.video : v)),
      );
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Feed</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Filter by TV channel. Like, share, and comment call the local API.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Channel</span>
          <select
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            value={channelId ?? ""}
            onChange={(e) => setChannelId(e.target.value || null)}
          >
            <option value="">All channels</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && (
        <p className="text-sm text-[var(--muted)]">Loading feed…</p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}. Start the API:{" "}
          <code className="rounded bg-black/30 px-1">npm run dev:api</code> from
          the repo root.
        </p>
      )}

      <ul className="flex flex-col gap-10">
        {videos.map((v) => (
          <li
            key={v.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
          >
            <div className="relative aspect-[9/16] max-h-[70vh] w-full bg-black sm:mx-auto sm:max-w-md">
              <video
                className="h-full w-full object-cover"
                src={v.playbackUrl}
                poster={v.thumbnailUrl}
                controls
                playsInline
                preload="metadata"
              />
            </div>
            <div className="flex gap-4 p-4">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/10">
                <Image
                  src={v.thumbnailUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{v.author.displayName}</p>
                <p className="text-sm text-[var(--muted)]">@{v.author.handle}</p>
                <p className="mt-2 text-sm leading-relaxed">{v.caption}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleLike(v.id)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      v.likedByViewer
                        ? "bg-[var(--accent)] text-white"
                        : "bg-white/10 text-[var(--foreground)] hover:bg-white/15"
                    }`}
                  >
                    ♥ {v.likeCount.toLocaleString()}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleComments(v.id)}
                    className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/15"
                  >
                    💬 {v.commentCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => void share(v.id)}
                    className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/15"
                  >
                    ↗ Share · {v.shareCount}
                  </button>
                </div>

                {expandedId === v.id && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                      Comments
                    </p>
                    <ul className="mt-2 space-y-2">
                      {(commentsByVideo[v.id] ?? []).map((c) => (
                        <li key={c.id} className="text-sm">
                          <span className="font-medium">{c.author.displayName}</span>
                          <span className="text-[var(--muted)]">
                            {" "}
                            @{c.author.handle}
                          </span>
                          <span className="text-[var(--foreground)]/90">
                            {" "}
                            — {c.body}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                        placeholder="Add a comment…"
                        value={commentDraft[v.id] ?? ""}
                        onChange={(e) =>
                          setCommentDraft((d) => ({ ...d, [v.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => void postComment(v.id)}
                        className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-center text-sm text-[var(--muted)]">
        <Link href="/" className="underline decoration-white/30 hover:decoration-white">
          Back to home
        </Link>
      </p>
    </div>
  );
}
