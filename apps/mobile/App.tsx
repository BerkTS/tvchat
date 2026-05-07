import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Comment, TVChannel, Video } from "@tvchat/shared";
import { apiFetch, apiPaths, apiUpload, getApiBase, mediaUrl } from "./src/api";

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
    const mic = await ImagePicker.requestMicrophonePermissionsAsync();
    if (!mic.granted) {
      setPostMsg("Microphone permission is recommended for audio in your clip.");
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
      await apiUpload<{ video: Video }>(apiPaths.createVideo, form);
      setPostCaption("");
      setPickedUri(null);
      setPickedName(null);
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
      <ScrollView contentContainerStyle={styles.scroll}>
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
            <Pressable
              onPress={() =>
                v.playbackUrl && Linking.openURL(mediaUrl(v.playbackUrl))
              }
            >
              <Image source={{ uri: mediaUrl(v.thumbnailUrl) }} style={styles.thumb} />
              <Text style={styles.playHint}>Tap thumbnail to open sample video</Text>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0b" },
  scroll: { padding: 16, paddingTop: 48, gap: 12, paddingBottom: 40 },
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
  thumb: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 320,
    borderRadius: 12,
    backgroundColor: "#222",
  },
  playHint: { color: "#71717a", fontSize: 11, marginTop: 4 },
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
