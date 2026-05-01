/** Domain types shared by web and mobile clients. */

export type ID = string;

export interface TVChannel {
  id: ID;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  verified: boolean;
  followerCount?: number;
}

export interface UserPublic {
  id: ID;
  displayName: string;
  handle: string;
  avatarUrl?: string;
}

export interface Video {
  id: ID;
  channelId: ID;
  author: UserPublic;
  caption: string;
  thumbnailUrl: string;
  playbackUrl: string;
  durationSeconds: number;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByViewer?: boolean;
}

export interface Comment {
  id: ID;
  videoId: ID;
  author: UserPublic;
  body: string;
  createdAt: string;
  replyCount?: number;
}
