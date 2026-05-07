"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Comment, TVChannel, Video } from "@tvchat/shared";
import { apiPaths } from "@tvchat/shared";
import { getApiBase } from "@/lib/api-base";
import { mediaUrl } from "@/lib/media-url";

const USER_HEADER = "X-User-Id";
const DISPLAY_HEADER = "X-User-Display-Name";
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

async function postMultipart<T>(path: string, form: FormData): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      [USER_HEADER]: DEMO_USER,
      [DISPLAY_HEADER]: "You",
    },
    body: form,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

function pickBrowserRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
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
  const [postChannelId, setPostChannelId] = useState("");
  const [postCaption, setPostCaption] = useState("");
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postBusy, setPostBusy] = useState(false);
  const [postMessage, setPostMessage] = useState<string | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [camOpen, setCamOpen] = useState(false);
  const [recOn, setRecOn] = useState(false);
  const [camHint, setCamHint] = useState<string | null>(null);

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
        setPostChannelId((prev) => prev || ch[0]?.id || "");
      } catch {
        setChannels([]);
      }
    })();
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const closeWebCam = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const el = previewRef.current;
    if (el) el.srcObject = null;
    setCamOpen(false);
    setRecOn(false);
  }, []);

  const openWebCam = async () => {
    setCamHint(null);
    setPostMessage(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamHint("Camera is not available in this browser.");
      return;
    }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      setCamOpen(true);
      requestAnimationFrame(() => {
        const el = previewRef.current;
        if (el) {
          el.srcObject = stream;
          void el.play().catch(() => {});
        }
      });
    } catch (e) {
      setCamHint(e instanceof Error ? e.message : "Could not open camera.");
    }
  };

  const startWebRecord = () => {
    setCamHint(null);
    const stream = streamRef.current;
    if (!stream) {
      setCamHint("Open the camera first.");
      return;
    }
    const mime = pickBrowserRecorderMime();
    if (!mime) {
      setCamHint("Recording is not supported in this browser.");
      return;
    }
    chunksRef.current = [];
    const rec = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data.size) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      const baseType = mime.split(";")[0] || "video/webm";
      const blob = new Blob(chunksRef.current, { type: baseType });
      const ext = baseType.includes("webm") ? "webm" : "mp4";
      const file = new File([blob], `camera-clip.${ext}`, { type: blob.type });
      setPostFile(file);
      setPostMessage("Recording ready — tap Upload & post.");
      chunksRef.current = [];
      recorderRef.current = null;
      setRecOn(false);
    };
    rec.start(250);
    setRecOn(true);
  };

  const stopWebRecord = () => {
    recorderRef.current?.stop();
  };

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

  const submitPost = async () => {
    if (!postChannelId || !postFile) {
      setPostMessage("Choose a channel, then pick or record a video.");
      return;
    }
    setPostBusy(true);
    setPostMessage(null);
    try {
      const form = new FormData();
      form.set("channelId", postChannelId);
      form.set("caption", postCaption);
      form.set("video", postFile, postFile.name);
      await postMultipart<{ video: Video }>(apiPaths.createVideo, form);
      setPostCaption("");
      setPostFile(null);
      setPostMessage("Posted.");
      await loadFeed();
    } catch (e) {
      setPostMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPostBusy(false);
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
            Filter by TV channel. Post a clip, then like, share, or comment.
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

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-sm font-medium text-[var(--muted)] uppercase">
          Post a video
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Channel</span>
            <select
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              value={postChannelId}
              onChange={(e) => setPostChannelId(e.target.value)}
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">Caption</span>
            <input
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              placeholder="What’s this clip about?"
            />
          </label>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-[var(--muted)] text-sm">Record in browser</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void openWebCam()}
                className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
              >
                {camOpen ? "Camera on" : "Open camera"}
              </button>
              <button
                type="button"
                onClick={closeWebCam}
                disabled={!camOpen}
                className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
              >
                Close camera
              </button>
              <button
                type="button"
                onClick={startWebRecord}
                disabled={!camOpen || recOn}
                className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
              >
                Start recording
              </button>
              <button
                type="button"
                onClick={stopWebRecord}
                disabled={!recOn}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Stop & attach
              </button>
            </div>
            {camHint && (
              <p className="text-xs text-amber-200/90">{camHint}</p>
            )}
            <video
              ref={previewRef}
              className="mt-1 aspect-video w-full max-w-md rounded-lg border border-white/10 bg-black object-cover"
              muted
              playsInline
            />
            <p className="text-xs text-[var(--muted)]">
              Preview is muted to avoid feedback. Uses WebM in most Chrome / Firefox
              builds; Safari support varies.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">Video file</span>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.mov,.webm,.mkv"
              className="text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-[var(--foreground)]"
              onChange={(e) => setPostFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={postBusy}
            onClick={() => void submitPost()}
            className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {postBusy ? "Uploading…" : "Upload & post"}
          </button>
          {postMessage && (
            <span className="text-sm text-[var(--muted)]">{postMessage}</span>
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Max ~200&nbsp;MB. Formats: MP4, WebM, MOV, MKV. For phones, set{" "}
          <code className="rounded bg-black/30 px-1">API_PUBLIC_ORIGIN</code> on
          the API so playback URLs resolve on your LAN.
        </p>
      </section>

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
                src={mediaUrl(v.playbackUrl)}
                poster={mediaUrl(v.thumbnailUrl)}
                controls
                playsInline
                preload="metadata"
              />
            </div>
            <div className="flex gap-4 p-4">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/10">
                <Image
                  src={mediaUrl(v.thumbnailUrl)}
                  alt=""
                  unoptimized={v.thumbnailUrl.startsWith("/uploads/")}
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
