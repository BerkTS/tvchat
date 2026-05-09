import { StatusBar } from "expo-status-bar";
import { Video as ExpoVideo, ResizeMode } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Comment, TVChannel, Video } from "@tvchat/shared";
import { activeCue, parseWebVtt, type VttCue } from "@tvchat/shared";
import { apiFetch, apiPaths, apiUpload, getApiBase, mediaUrl } from "./src/api";

function FeedVideoBlock({ video: v }: { video: Video }) {
  const tracks = v.captionTracks ?? [];
  const hasTracks = tracks.length > 0;
  const [lang, setLang] = useState(tracks[0]?.lang ?? "");
  const [cc, setCc] = useState(false);
  const [cues, setCues] = useState<VttCue[]>([]);
  const [posMs, setPosMs] = useState(0);

  useEffect(() => {
    if (tracks.length && !tracks.some((t) => t.lang === lang)) {
      setLang(tracks[0]!.lang);
    }
  }, [tracks, lang]);

  const trackSig = tracks.map((t) => `${t.lang}:${t.url}`).join("|");
  useEffect(() => {
    const t = tracks.find((x) => x.lang === lang) ?? tracks[0];
    if (!t) {
      setCues([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(mediaUrl(t.url));
        const text = await res.text();
        if (!cancelled) setCues(parseWebVtt(text));
      } catch {
        if (!cancelled) setCues([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, trackSig, v.id]);

  const line = cc ? activeCue(cues, posMs / 1000) : null;
  const gen = v.captionGeneration;

  return (
    <>
      {gen?.status === "pending" && (
        <Text style={styles.capBanner}>{gen.message ?? "Captions…"}</Text>
      )}
      {gen?.status === "failed" && (
        <Text style={styles.capErr}>{gen.message ?? "Captions failed"}</Text>
      )}
      <View style={styles.videoShell}>
        <ExpoVideo
          style={styles.video}
          source={{ uri: mediaUrl(v.playbackUrl) }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={(s) => {
            if (s.isLoaded) setPosMs(s.positionMillis ?? 0);
          }}
        />
        {line ? (
          <View style={styles.subWrap} pointerEvents="none">
            <Text style={styles.subText}>{line}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.capRow}>
        <Pressable
          style={[
            styles.capBtn,
            cc && hasTracks && styles.capBtnOn,
            !hasTracks && styles.capBtnDisabled,
          ]}
          disabled={!hasTracks}
          onPress={() => hasTracks && setCc((x) => !x)}
        >
          <Text
            style={[styles.capBtnText, !hasTracks && styles.capBtnTextMuted]}
          >
            CC
          </Text>
        </Pressable>
        {tracks.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.langScroll}
          >
            {tracks.map((t) => (
              <Pressable
                key={t.lang}
                style={[
                  styles.langChip,
                  lang === t.lang && styles.langChipOn,
                  !hasTracks && styles.langChipDisabled,
                ]}
                disabled={!hasTracks}
                onPress={() => hasTracks && setLang(t.lang)}
              >
                <Text
                  style={
                    lang === t.lang ? styles.langChipTextOn : styles.langChipText
                  }
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
      {!hasTracks ? (
        <Text style={styles.playHint}>
          Subtitles appear when transcription finishes (or attach a WebVTT).
        </Text>
      ) : null}
    </>
  );
}

export default function App() {
  const [channels, setChannels] = useState<TVChannel[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentsByVideo, setCommentsByVideo] = useState<Record<string, Comment[]>>(
    {},
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [postChannelId, setPostChannelId] = useState("");
  const [postCaption, setPostCaption] = useState("");
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [pickedMime, setPickedMime] = useState("video/mp4");
  const [subUri, setSubUri] = useState<string | null>(null);
  const [subName, setSubName] = useState<string | null>(null);
  const [subLang, setSubLang] = useState("en");
  const [postBusy, setPostBusy] = useState(false);
  const [postMsg, setPostMsg] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    const q = channelId ? `?channelId=${encodeURIComponent(channelId)}` : "";
    try {
      const list = await apiFetch<Video[]>(`${apiPaths.feed}${q}`);
      setVideos(list);
    } catch {
      setError(`Cannot reach API at ${getApiBase()}. Run npm run dev:api.`);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void (async () => {
      try {
        const ch = await apiFetch<TVChannel[]>(apiPaths.channels);
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

  const pendingCaptions = useMemo(
    () => videos.some((x) => x.captionGeneration?.status === "pending"),
    [videos],
  );

  useEffect(() => {
    if (!pendingCaptions) return;
    const t = setInterval(() => void loadFeed(), 4000);
    return () => clearInterval(t);
  }, [pendingCaptions, loadFeed]);

  const loadComments = async (videoId: string) => {
    if (commentsByVideo[videoId]) return;
    try {
      const list = await apiFetch<Comment[]>(apiPaths.comments(videoId));
      setCommentsByVideo((p) => ({ ...p, [videoId]: list }));
    } catch {
      setCommentsByVideo((p) => ({ ...p, [videoId]: [] }));
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
      const data = await apiFetch<{ video: Video }>(apiPaths.like(videoId), {
        method: "POST",
        body: "{}",
      });
      setVideos((prev) => prev.map((v) => (v.id === videoId ? data.video : v)));
    } catch {
      /* ignore */
    }
  };

  const share = async (video: Video) => {
    try {
      const data = await apiFetch<{ video: Video }>(apiPaths.share(video.id), {
        method: "POST",
        body: "{}",
      });
      setVideos((prev) => prev.map((v) => (v.id === video.id ? data.video : v)));
    } catch {
      /* ignore */
    }
    const url = video.playbackUrl;
    if (url) void Linking.openURL(mediaUrl(url));
  };

  const postComment = async (videoId: string) => {
    const body = (draft[videoId] ?? "").trim();
    if (!body) return;
    try {
      const data = await apiFetch<{ video: Video }>(apiPaths.comments(videoId), {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setDraft((d) => ({ ...d, [videoId]: "" }));
      const list = await apiFetch<Comment[]>(apiPaths.comments(videoId));
      setCommentsByVideo((p) => ({ ...p, [videoId]: list }));
      setVideos((prev) => prev.map((v) => (v.id === videoId ? data.video : v)));
    } catch {
      /* ignore */
    }
  };

  const pickSubtitles = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: "text/*",
      copyToCacheDirectory: true,
    });
    if (r.canceled) return;
    const a = r.assets[0];
    const name = a.name ?? "captions.vtt";
    if (!name.toLowerCase().endsWith(".vtt")) {
      setPostMsg("Subtitles must be a .vtt file.");
      return;
    }
    setSubUri(a.uri);
    setSubName(name);
    setPostMsg(null);
  };

  const pickVideo = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: "video/*",
      copyToCacheDirectory: true,
    });
    if (r.canceled) return;
    const a = r.assets[0];
    setPickedUri(a.uri);
    setPickedName(a.name ?? "upload.mp4");
    setPickedMime(a.mimeType ?? "video/mp4");
    setPostMsg(null);
  };

  const recordFromCamera = async () => {
    setPostMsg(null);
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      setPostMsg("Camera permission is required to record.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 120,
      allowsEditing: false,
      quality: 1,
    });
    if (r.canceled) return;
    const a = r.assets[0];
    setPickedUri(a.uri);
    const mime = a.mimeType ?? "video/mp4";
    setPickedMime(mime);
    const ext = mime.includes("webm")
      ? "webm"
      : mime.includes("quicktime")
        ? "mov"
        : "mp4";
    setPickedName(`camera-${Date.now()}.${ext}`);
  };

  const submitPost = async () => {
    if (!postChannelId || !pickedUri) {
      setPostMsg("Pick a channel, then choose or record a video.");
      return;
    }
    setPostBusy(true);
    setPostMsg(null);
    try {
      const form = new FormData();
      form.append("channelId", postChannelId);
      form.append("caption", postCaption);
      form.append("video", {
        uri: pickedUri,
        name: pickedName ?? "upload.mp4",
        type: pickedMime,
      } as unknown as Blob);
      if (subUri) {
        form.append("subtitles", {
          uri: subUri,
          name: subName ?? "captions.vtt",
          type: "text/vtt",
        } as unknown as Blob);
        form.append("subtitleLang", subLang.trim() || "en");
      }
      await apiUpload<{ video: Video }>(apiPaths.createVideo, form);
      setPostCaption("");
      setPickedUri(null);
      setPickedName(null);
      setSubUri(null);
      setSubName(null);
      setPostMsg("Posted.");
      await loadFeed();
    } catch (e) {
      setPostMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPostBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.scrollInner}>
        <Text style={styles.kicker}>TVChat</Text>
        <Text style={styles.title}>Feed</Text>
        <Text style={styles.hint}>
          API: {getApiBase()}
          {"\n"}
          Android emulator uses 10.0.2.2 automatically.
        </Text>

        <View style={styles.postCard}>
          <Text style={styles.postTitle}>Post a video</Text>
          <Text style={styles.postMeta}>Channel</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chips}
          >
            {channels.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.chip, postChannelId === c.id && styles.chipOn]}
                onPress={() => setPostChannelId(c.id)}
              >
                <Text
                  style={postChannelId === c.id ? styles.chipTextOn : styles.chipText}
                >
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.postMeta}>Caption</Text>
          <TextInput
            style={styles.input}
            placeholder="Caption…"
            placeholderTextColor="#71717a"
            value={postCaption}
            onChangeText={setPostCaption}
          />
          <View style={styles.pickRow}>
            <Pressable style={styles.pickBtn} onPress={() => void pickVideo()}>
              <Text style={styles.pickBtnText}>
                {pickedName ? `File: ${pickedName}` : "Choose video file"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.pickBtn}
              onPress={() => void recordFromCamera()}
            >
              <Text style={styles.pickBtnText}>Record with camera</Text>
            </Pressable>
          </View>
          <Pressable style={styles.pickBtn} onPress={() => void pickSubtitles()}>
            <Text style={styles.pickBtnText}>
              {subName ? `Subtitles: ${subName}` : "Optional WebVTT subtitles"}
            </Text>
          </Pressable>
          <Text style={styles.postMeta}>Subtitle language</Text>
          <TextInput
            style={styles.input}
            placeholder="en"
            placeholderTextColor="#71717a"
            value={subLang}
            onChangeText={setSubLang}
          />
          <Text style={styles.hintSmall}>
            Audio is transcribed automatically after upload (needs OPENAI_API_KEY on
            the API). Tap CC on each video to show or hide subtitles.
          </Text>
          <Pressable
            style={[styles.postBtn, postBusy && styles.postBtnDisabled]}
            disabled={postBusy}
            onPress={() => void submitPost()}
          >
            <Text style={styles.postBtnText}>{postBusy ? "Uploading…" : "Upload"}</Text>
          </Pressable>
          {postMsg && <Text style={styles.postMsg}>{postMsg}</Text>}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <Pressable
            style={[styles.chip, channelId === null && styles.chipOn]}
            onPress={() => setChannelId(null)}
          >
            <Text style={channelId === null ? styles.chipTextOn : styles.chipText}>
              All
            </Text>
          </Pressable>
          {channels.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, channelId === c.id && styles.chipOn]}
              onPress={() => setChannelId(c.id)}
            >
              <Text
                style={channelId === c.id ? styles.chipTextOn : styles.chipText}
              >
                {c.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading && <ActivityIndicator color="#fe2c55" />}
        {error && <Text style={styles.error}>{error}</Text>}

        {videos.map((v) => (
          <View key={v.id} style={styles.card}>
            <FeedVideoBlock video={v} />
            <Pressable
              onPress={() =>
                v.playbackUrl && Linking.openURL(mediaUrl(v.playbackUrl))
              }
            >
              <Text style={styles.openExternal}>Open in browser / share link</Text>
            </Pressable>
            <Text style={styles.author}>{v.author.displayName}</Text>
            <Text style={styles.meta}>@{v.author.handle}</Text>
            <Text style={styles.caption}>{v.caption}</Text>
            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, v.likedByViewer && styles.btnAccent]}
                onPress={() => void toggleLike(v.id)}
              >
                <Text style={styles.btnText}>♥ {v.likeCount}</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => void toggleComments(v.id)}>
                <Text style={styles.btnText}>💬 {v.commentCount}</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => void share(v)}>
                <Text style={styles.btnText}>↗ {v.shareCount}</Text>
              </Pressable>
            </View>
            {expandedId === v.id && (
              <View style={styles.comments}>
                {(commentsByVideo[v.id] ?? []).map((c) => (
                  <Text key={c.id} style={styles.commentLine}>
                    <Text style={styles.bold}>{c.author.displayName}</Text>: {c.body}
                  </Text>
                ))}
                <TextInput
                  style={styles.input}
                  placeholder="Add a comment…"
                  placeholderTextColor="#71717a"
                  value={draft[v.id] ?? ""}
                  onChangeText={(t) => setDraft((d) => ({ ...d, [v.id]: t }))}
                />
                <Pressable style={styles.postBtn} onPress={() => void postComment(v.id)}>
                  <Text style={styles.postBtnText}>Post</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0b" },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  scrollInner: { padding: 16, paddingTop: 48, gap: 12 },
  kicker: {
    color: "#a1a1aa",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: { color: "#fafafa", fontSize: 28, fontWeight: "600" },
  hint: { color: "#71717a", fontSize: 12, lineHeight: 18 },
  chips: { flexGrow: 0, marginVertical: 4 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipOn: { backgroundColor: "#fe2c55", borderColor: "#fe2c55" },
  chipText: { color: "#e4e4e7", fontSize: 13 },
  chipTextOn: { color: "#fff", fontSize: 13, fontWeight: "600" },
  error: { color: "#fca5a5", fontSize: 13 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    gap: 6,
  },
  videoShell: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 360,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: { width: "100%", height: "100%" },
  subWrap: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 48,
    alignItems: "center",
  },
  subText: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
  },
  capBanner: {
    color: "#e4e4e7",
    fontSize: 12,
    marginBottom: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  capErr: {
    color: "#fecaca",
    fontSize: 12,
    marginBottom: 6,
  },
  capRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  capBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  capBtnOn: { backgroundColor: "#fe2c55", borderColor: "#fe2c55" },
  capBtnDisabled: { opacity: 0.45 },
  capBtnText: { color: "#fafafa", fontSize: 12, fontWeight: "600" },
  capBtnTextMuted: { color: "#71717a" },
  langScroll: { flexGrow: 0, maxWidth: "100%" },
  langChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
  },
  langChipOn: { backgroundColor: "rgba(254,44,85,0.35)", borderColor: "#fe2c55" },
  langChipDisabled: { opacity: 0.45 },
  langChipText: { color: "#d4d4d8", fontSize: 12 },
  langChipTextOn: { color: "#fff", fontSize: 12, fontWeight: "600" },
  playHint: { color: "#71717a", fontSize: 11, marginTop: 8 },
  openExternal: {
    color: "#a78bfa",
    fontSize: 12,
    marginTop: 8,
    textDecorationLine: "underline",
  },
  hintSmall: { color: "#71717a", fontSize: 11, lineHeight: 16 },
  author: { color: "#fafafa", fontWeight: "600", marginTop: 8 },
  meta: { color: "#a1a1aa", fontSize: 13 },
  caption: { color: "#e4e4e7", fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  btn: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnAccent: { backgroundColor: "#fe2c55" },
  btnText: { color: "#fafafa", fontSize: 13 },
  comments: {
    marginTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
  },
  commentLine: { color: "#d4d4d8", fontSize: 13 },
  bold: { fontWeight: "700", color: "#fff" },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    color: "#fafafa",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  postBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#fe2c55",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  postBtnText: { color: "#fff", fontWeight: "600" },
  postCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
    gap: 8,
  },
  postTitle: {
    color: "#fafafa",
    fontWeight: "700",
    fontSize: 16,
  },
  postMeta: { color: "#a1a1aa", fontSize: 12, textTransform: "uppercase" },
  pickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickBtn: {
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickBtnText: { color: "#e4e4e7", fontSize: 14 },
  postBtnDisabled: { opacity: 0.6 },
  postMsg: { color: "#a1a1aa", fontSize: 13 },
});
