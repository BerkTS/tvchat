/** Path segments for the TVChat HTTP API (no host). */

export const apiPaths = {
  health: "/health",
  channels: "/channels",
  feed: "/feed",
  video: (id: string) => `/videos/${id}`,
  comments: (id: string) => `/videos/${id}/comments`,
  like: (id: string) => `/videos/${id}/like`,
  share: (id: string) => `/videos/${id}/share`,
} as const;
