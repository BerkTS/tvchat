/** Path segments for the TVChat HTTP API (no host). */

export const apiPaths = {
  health: "/health",
  channels: "/channels",
  feed: "/feed",
  /** Multipart: fields `channelId`, `caption` (optional), file field `video`. */
  createVideo: "/videos",
  video: (id: string) => `/videos/${id}`,
  comments: (id: string) => `/videos/${id}/comments`,
  like: (id: string) => `/videos/${id}/like`,
  share: (id: string) => `/videos/${id}/share`,
} as const;
