CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_hosts (
  device_id TEXT NOT NULL,
  registrable_domain TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (device_id, registrable_domain)
);

CREATE TABLE IF NOT EXISTS user_hosts_month (
  user_id TEXT NOT NULL,
  month_key TEXT NOT NULL,
  registrable_domain TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (user_id, month_key, registrable_domain)
);

CREATE TABLE IF NOT EXISTS magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  device_id TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS soft_bind (
  bind_hash TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_idempotency (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
