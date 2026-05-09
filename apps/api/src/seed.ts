import type { Comment, TVChannel, Video } from "@tvchat/shared";
import { captionLanguageLabel } from "@tvchat/shared";

const sampleMp4 =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

export const seedChannels: TVChannel[] = [
  {
    id: "ch-demo",
    slug: "demo-news",
    name: "Demo News HD",
    description: "Sample channel for development.",
    verified: true,
    followerCount: 128_400,
  },
  {
    id: "ch-sports",
    slug: "metro-sports",
    name: "Metro Sports",
    verified: false,
    followerCount: 42_100,
  },
];

export const seedVideos: Video[] = [
  {
    id: "vid-1",
    channelId: "ch-demo",
    author: {
      id: "u1",
      displayName: "Alex Rivera",
      handle: "arivera",
    },
    caption: "Tonight’s headline in 30 seconds — from the channel feed.",
    thumbnailUrl: "https://picsum.photos/seed/tvchat1/720/1280",
    playbackUrl: sampleMp4,
    durationSeconds: 15,
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    likeCount: 4200,
    commentCount: 2,
    shareCount: 89,
    captionTracks: [
      {
        lang: "en",
        label: captionLanguageLabel("en"),
        url: "/uploads/vid-1.en.vtt",
      },
    ],
    captionGeneration: { status: "idle" },
  },
  {
    id: "vid-2",
    channelId: "ch-demo",
    author: {
      id: "u2",
      displayName: "Jordan Lee",
      handle: "jlee",
    },
    caption: "Behind the scenes at the evening broadcast.",
    thumbnailUrl: "https://picsum.photos/seed/tvchat2/720/1280",
    playbackUrl: sampleMp4,
    durationSeconds: 22,
    createdAt: new Date(Date.now() - 7200_000).toISOString(),
    likeCount: 890,
    commentCount: 0,
    shareCount: 41,
  },
  {
    id: "vid-3",
    channelId: "ch-sports",
    author: {
      id: "u3",
      displayName: "Sam Okonkwo",
      handle: "sokonkwo",
    },
    caption: "Post-game clip: locker room energy.",
    thumbnailUrl: "https://picsum.photos/seed/tvchat3/720/1280",
    playbackUrl: sampleMp4,
    durationSeconds: 18,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    likeCount: 12_300,
    commentCount: 1,
    shareCount: 220,
  },
];

export const seedComments: Comment[] = [
  {
    id: "c1",
    videoId: "vid-1",
    author: {
      id: "u10",
      displayName: "Morgan",
      handle: "morgan",
    },
    body: "This format works really well for quick updates.",
    createdAt: new Date(Date.now() - 1800_000).toISOString(),
  },
  {
    id: "c2",
    videoId: "vid-1",
    author: {
      id: "u11",
      displayName: "Riley",
      handle: "riley",
    },
    body: "Following this channel now.",
    createdAt: new Date(Date.now() - 900_000).toISOString(),
  },
  {
    id: "c3",
    videoId: "vid-3",
    author: {
      id: "u12",
      displayName: "Casey",
      handle: "casey",
    },
    body: "What a game!",
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
  },
];
