// Shared app types. Seed/mock records are intentionally not included.
export type Organization = {
  id: string;
  name: string;
  theme: string;
  signup_limit: number;
};

export type FeedItem = {
  id: string;
  author_id: string;
  org_id: string;
  body: string;
  created_at: string;
};

export type Message = FeedItem;

export type DriveFile = {
  id: string;
  name: string;
  object_path: string;
  size_bytes: number;
  content_type: string;
  created_at: string;
};
