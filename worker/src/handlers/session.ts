import type { Env, Participant } from "../types";
import { badRequest, json, nowIso } from "../utils";

const DEFAULT_INITIAL_POINTS = 1000;

export async function handleCreateSession(request: Request, env: Env): Promise<Response> {
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("リクエストボディが不正です");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return badRequest("nameは必須です");
  }

  const existing = await env.DB.prepare(
    "SELECT id, name, points FROM participants WHERE name = ?"
  )
    .bind(name)
    .first<Pick<Participant, "id" | "name" | "points">>();

  if (existing) {
    return json(existing);
  }

  const setting = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'initial_points'"
  ).first<{ value: string }>();

  const initialPoints = setting ? parseInt(setting.value, 10) : DEFAULT_INITIAL_POINTS;

  const id = crypto.randomUUID();

  await env.DB.prepare(
    "INSERT INTO participants (id, name, points, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(id, name, initialPoints, nowIso())
    .run();

  return json({ id, name, points: initialPoints }, { status: 201 });
}
