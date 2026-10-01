import {
  FREE_UNIQUE_SITES,
  LOGGED_IN_MONTHLY_UNIQUE,
  monthKey,
} from "@ai-detector/quota";

export interface QuotaView {
  remainingFree: number;
  freeLimit: number;
  usedHosts: string[];
  requiresLogin: boolean;
  monthlyRemaining: number | null;
  monthlyLimit: number | null;
  isLoggedIn: boolean;
  deviceId: string;
  userId: string | null;
}

function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", data).then((buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""),
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class QuotaRepository {
  constructor(private readonly db: D1Database) {}

  async bootstrapDevice(existingToken?: string | null): Promise<{
    deviceId: string;
    token: string;
    isNew: boolean;
  }> {
    if (existingToken) {
      const hash = await sha256Hex(existingToken);
      const row = await this.db
        .prepare(
          `SELECT id FROM devices WHERE token_hash = ? LIMIT 1`,
        )
        .bind(hash)
        .first<{ id: string }>();
      if (row) {
        await this.db
          .prepare(`UPDATE devices SET last_seen_at = ? WHERE id = ?`)
          .bind(nowIso(), row.id)
          .run();
        return { deviceId: row.id, token: existingToken, isNew: false };
      }
    }

    const token = randomToken();
    const hash = await sha256Hex(token);
    const id = crypto.randomUUID();
    const ts = nowIso();
    await this.db
      .prepare(
        `INSERT INTO devices (id, token_hash, user_id, created_at, last_seen_at) VALUES (?, ?, NULL, ?, ?)`,
      )
      .bind(id, hash, ts, ts)
      .run();
    return { deviceId: id, token, isNew: true };
  }

  async softBind(deviceId: string, bindHash: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO soft_bind (bind_hash, device_id, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(bind_hash) DO UPDATE SET device_id = excluded.device_id, updated_at = excluded.updated_at`,
      )
      .bind(bindHash, deviceId, nowIso())
      .run();
  }

  async recoverBySoftBind(bindHash: string): Promise<string | null> {
    const row = await this.db
      .prepare(`SELECT device_id FROM soft_bind WHERE bind_hash = ? LIMIT 1`)
      .bind(bindHash)
      .first<{ device_id: string }>();
    return row?.device_id ?? null;
  }

  async getQuota(deviceId: string): Promise<QuotaView> {
    const device = await this.db
      .prepare(`SELECT id, user_id FROM devices WHERE id = ?`)
      .bind(deviceId)
      .first<{ id: string; user_id: string | null }>();

    if (!device) {
      return {
        remainingFree: FREE_UNIQUE_SITES,
        freeLimit: FREE_UNIQUE_SITES,
        usedHosts: [],
        requiresLogin: false,
        monthlyRemaining: null,
        monthlyLimit: null,
        isLoggedIn: false,
        deviceId,
        userId: null,
      };
    }

    const hosts = await this.db
      .prepare(
        `SELECT registrable_domain FROM device_hosts WHERE device_id = ? ORDER BY first_seen_at`,
      )
      .bind(deviceId)
      .all<{ registrable_domain: string }>();

    const usedHosts = (hosts.results ?? []).map((r) => r.registrable_domain);
    const remainingFree = Math.max(0, FREE_UNIQUE_SITES - usedHosts.length);
    const isLoggedIn = Boolean(device.user_id);

    if (!isLoggedIn) {
      return {
        remainingFree,
        freeLimit: FREE_UNIQUE_SITES,
        usedHosts,
        requiresLogin: remainingFree <= 0,
        monthlyRemaining: null,
        monthlyLimit: null,
        isLoggedIn: false,
        deviceId,
        userId: null,
      };
    }

    const mk = monthKey();
    const monthRows = await this.db
      .prepare(
        `SELECT registrable_domain FROM user_hosts_month WHERE user_id = ? AND month_key = ?`,
      )
      .bind(device.user_id, mk)
      .all<{ registrable_domain: string }>();
    const monthHosts = (monthRows.results ?? []).map((r) => r.registrable_domain);
    const monthlyRemaining = Math.max(
      0,
      LOGGED_IN_MONTHLY_UNIQUE - monthHosts.length,
    );

    return {
      remainingFree: 0,
      freeLimit: FREE_UNIQUE_SITES,
      usedHosts,
      requiresLogin: false,
      monthlyRemaining,
      monthlyLimit: LOGGED_IN_MONTHLY_UNIQUE,
      isLoggedIn: true,
      deviceId,
      userId: device.user_id,
    };
  }

  async creditHost(
    deviceId: string,
    registrableDomain: string,
  ): Promise<{ allowed: boolean; quota: QuotaView; alreadyCounted: boolean }> {
    const idem = `${deviceId}|${registrableDomain}|${new Date().toISOString().slice(0, 10)}`;
    const existingIdem = await this.db
      .prepare(`SELECT id FROM scan_idempotency WHERE id = ?`)
      .bind(idem)
      .first();

    const before = await this.getQuota(deviceId);
    const alreadyOnDevice = before.usedHosts.includes(registrableDomain);

    if (before.isLoggedIn && before.userId) {
      const mk = monthKey();
      const monthHit = await this.db
        .prepare(
          `SELECT 1 AS ok FROM user_hosts_month WHERE user_id = ? AND month_key = ? AND registrable_domain = ?`,
        )
        .bind(before.userId, mk, registrableDomain)
        .first();

      if (!monthHit) {
        if ((before.monthlyRemaining ?? 0) <= 0) {
          return { allowed: false, quota: before, alreadyCounted: false };
        }
        await this.db
          .prepare(
            `INSERT INTO user_hosts_month (user_id, month_key, registrable_domain, first_seen_at) VALUES (?, ?, ?, ?)`,
          )
          .bind(before.userId, mk, registrableDomain, nowIso())
          .run();
      }

      if (!alreadyOnDevice) {
        await this.db
          .prepare(
            `INSERT INTO device_hosts (device_id, registrable_domain, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(device_id, registrable_domain) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
          )
          .bind(deviceId, registrableDomain, nowIso(), nowIso())
          .run();
      } else {
        await this.db
          .prepare(
            `UPDATE device_hosts SET last_seen_at = ? WHERE device_id = ? AND registrable_domain = ?`,
          )
          .bind(nowIso(), deviceId, registrableDomain)
          .run();
      }

      if (!existingIdem) {
        await this.db
          .prepare(`INSERT INTO scan_idempotency (id, created_at) VALUES (?, ?)`)
          .bind(idem, nowIso())
          .run();
      }

      return { allowed: true, quota: await this.getQuota(deviceId), alreadyCounted: Boolean(monthHit) };
    }

    if (!alreadyOnDevice) {
      if (before.remainingFree <= 0) {
        return { allowed: false, quota: { ...before, requiresLogin: true }, alreadyCounted: false };
      }
      await this.db
        .prepare(
          `INSERT INTO device_hosts (device_id, registrable_domain, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)`,
        )
        .bind(deviceId, registrableDomain, nowIso(), nowIso())
        .run();
    } else {
      await this.db
        .prepare(
          `UPDATE device_hosts SET last_seen_at = ? WHERE device_id = ? AND registrable_domain = ?`,
        )
        .bind(nowIso(), deviceId, registrableDomain)
        .run();
    }

    if (!existingIdem) {
      await this.db
        .prepare(`INSERT INTO scan_idempotency (id, created_at) VALUES (?, ?)`)
        .bind(idem, nowIso())
        .run();
    }

    return {
      allowed: true,
      quota: await this.getQuota(deviceId),
      alreadyCounted: alreadyOnDevice,
    };
  }

  async createMagicLink(email: string, deviceId: string | null): Promise<string> {
    const token = randomToken();
    const hash = await sha256Hex(token);
    const expires = new Date(Date.now() + 1000 * 60 * 30).toISOString();
    await this.db
      .prepare(
        `INSERT INTO magic_links (token_hash, email, device_id, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)`,
      )
      .bind(hash, email.toLowerCase(), deviceId, expires)
      .run();
    return token;
  }

  async consumeMagicLink(token: string): Promise<{ email: string; deviceId: string | null } | null> {
    const hash = await sha256Hex(token);
    const row = await this.db
      .prepare(
        `SELECT email, device_id, expires_at, used_at FROM magic_links WHERE token_hash = ?`,
      )
      .bind(hash)
      .first<{
        email: string;
        device_id: string | null;
        expires_at: string;
        used_at: string | null;
      }>();

    if (!row || row.used_at) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;

    await this.db
      .prepare(`UPDATE magic_links SET used_at = ? WHERE token_hash = ?`)
      .bind(nowIso(), hash)
      .run();

    let user = await this.db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .bind(row.email)
      .first<{ id: string }>();

    if (!user) {
      const id = crypto.randomUUID();
      await this.db
        .prepare(`INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)`)
        .bind(id, row.email, nowIso())
        .run();
      user = { id };
    }

    if (row.device_id) {
      await this.db
        .prepare(`UPDATE devices SET user_id = ?, last_seen_at = ? WHERE id = ?`)
        .bind(user.id, nowIso(), row.device_id)
        .run();
    }

    return { email: row.email, deviceId: row.device_id };
  }
}

export async function hashSoftBind(ip: string, ua: string): Promise<string> {
  const ipParts = ip.split(".");
  const ip24 =
    ipParts.length === 4 ? `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0` : ip;
  const uaCoarse = ua.slice(0, 64);
  const data = new TextEncoder().encode(`${ip24}|${uaCoarse}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
