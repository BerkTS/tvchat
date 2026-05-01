import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import type { TVChannel, Video } from "@tvchat/shared";

const demoChannel: TVChannel = {
  id: "ch-demo",
  slug: "demo-news",
  name: "Demo News HD",
  verified: true,
  followerCount: 128_400,
};

const demoVideo: Video = {
  id: "vid-demo",
  channelId: demoChannel.id,
  author: {
    id: "u1",
    displayName: "Alex Rivera",
    handle: "arivera",
  },
  caption: "Tonight’s headline in 30 seconds — from the channel feed.",
  thumbnailUrl: "",
  playbackUrl: "",
  durationSeconds: 28,
  createdAt: new Date().toISOString(),
  likeCount: 4200,
  commentCount: 312,
  shareCount: 89,
};

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>Channel-first short video</Text>
        <Text style={styles.title}>TVChat</Text>
        <Text style={styles.body}>
          Same domain types as the Next.js site via @tvchat/shared. Add camera,
          feed, and API calls next.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Active channel</Text>
          <Text style={styles.cardTitle}>{demoChannel.name}</Text>
          <Text style={styles.meta}>
            @{demoChannel.slug}
            {demoChannel.verified ? " · Verified" : ""}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sample post</Text>
          <Text style={styles.cardTitle}>{demoVideo.author.displayName}</Text>
          <Text style={styles.meta}>@{demoVideo.author.handle}</Text>
          <Text style={styles.caption}>{demoVideo.caption}</Text>
          <Text style={styles.stats}>
            {demoVideo.likeCount.toLocaleString()} likes · {demoVideo.commentCount}{" "}
            comments · {demoVideo.shareCount} shares
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0b",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    gap: 20,
  },
  kicker: {
    color: "#a1a1aa",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#fafafa",
    fontSize: 34,
    fontWeight: "600",
  },
  body: {
    color: "#a1a1aa",
    fontSize: 16,
    lineHeight: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 20,
    gap: 6,
  },
  cardLabel: {
    color: "#a1a1aa",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#fafafa",
    fontSize: 22,
    fontWeight: "600",
  },
  meta: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  caption: {
    color: "#e4e4e7",
    fontSize: 15,
    marginTop: 8,
    lineHeight: 20,
  },
  stats: {
    color: "#a1a1aa",
    fontSize: 13,
    marginTop: 8,
  },
});
