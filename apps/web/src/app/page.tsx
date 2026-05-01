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
  thumbnailUrl: "/placeholder-thumb.jpg",
  playbackUrl: "",
  durationSeconds: 28,
  createdAt: new Date().toISOString(),
  likeCount: 4200,
  commentCount: 312,
  shareCount: 89,
};

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm tracking-wide text-[var(--muted)] uppercase">
          Channel-first short video
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">TVChat</h1>
        <p className="max-w-2xl text-lg text-[var(--muted)]">
          Choose a TV channel, post vertical clips, and engage with likes,
          comments, and shares—on web, iOS, and Android from one codebase.
        </p>
      </header>

      <section className="grid gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur md:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-[var(--muted)] uppercase">
            Active channel
          </h2>
          <p className="mt-2 text-2xl font-semibold">{demoChannel.name}</p>
          <p className="text-sm text-[var(--muted)]">
            @{demoChannel.slug}
            {demoChannel.verified ? " · Verified" : ""}
            {demoChannel.followerCount != null
              ? ` · ${demoChannel.followerCount.toLocaleString()} followers`
              : ""}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-[var(--muted)] uppercase">
            Sample post
          </h2>
          <p className="mt-2 font-medium">{demoVideo.author.displayName}</p>
          <p className="text-sm text-[var(--muted)]">@{demoVideo.author.handle}</p>
          <p className="mt-3 text-[var(--foreground)]/90">{demoVideo.caption}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
            <span>{demoVideo.likeCount.toLocaleString()} likes</span>
            <span>{demoVideo.commentCount} comments</span>
            <span>{demoVideo.shareCount} shares</span>
          </div>
        </div>
      </section>

      <footer className="text-sm text-[var(--muted)]">
        Shared types from{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5">@tvchat/shared</code>
        . Run API and uploads next; mobile app lives in{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5">apps/mobile</code>.
      </footer>
    </main>
  );
}
