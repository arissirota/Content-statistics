create table accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null, -- 'youtube' | 'instagram' | 'tiktok' | 'snapchat'
  handle text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  meta jsonb default '{}'::jsonb, -- channel_id, ig_user_id, page_id, open_id, etc.
  unique(platform)
);

create table daily_snapshots (
  platform text not null,
  snapshot_date date not null,
  followers int,
  views int,
  likes int,
  comments int,
  extra jsonb default '{}'::jsonb, -- shares, watch_time, or manual snapchat fields
  synced_at timestamptz default now(),
  primary key (platform, snapshot_date) -- idempotent upserts
);
