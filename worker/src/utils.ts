import type { Env } from "./types";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

export function notFound(message = "見つかりません"): Response {
  return json({ error: message }, { status: 404 });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function fetchParticipantNames(env: Env, ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, string>();
  if (uniqueIds.length === 0) return map;

  const placeholders = uniqueIds.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT id, name FROM participants WHERE id IN (${placeholders})`
  )
    .bind(...uniqueIds)
    .all<{ id: string; name: string }>();

  for (const row of results ?? []) {
    map.set(row.id, row.name);
  }
  return map;
}
