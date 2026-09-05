import type { Env } from "../../types";
import { badRequest, json, notFound, nowIso } from "../../utils";

interface CreateRoundBody {
  slotALabel?: unknown;
  slotBLabel?: unknown;
}

export async function handleCreateRound(request: Request, env: Env): Promise<Response> {
  let body: CreateRoundBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("リクエストボディが不正です");
  }

  const slotALabel = typeof body.slotALabel === "string" ? body.slotALabel : null;
  const slotBLabel = typeof body.slotBLabel === "string" ? body.slotBLabel : null;

  const openRound = await env.DB.prepare("SELECT id FROM rounds WHERE status = 'open' LIMIT 1").first<{
    id: string;
  }>();

  if (openRound) {
    return json({ error: "既にopen状態のラウンドが存在します" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const createdAt = nowIso();

  await env.DB.prepare(
    `INSERT INTO rounds (id, slot_a_label, slot_a_value, slot_b_label, slot_b_value, status, created_at, settled_at, archived_at)
     VALUES (?, ?, NULL, ?, NULL, 'open', ?, NULL, NULL)`
  )
    .bind(id, slotALabel, slotBLabel, createdAt)
    .run();

  return json({ id, slotALabel, slotBLabel, status: "open", createdAt }, { status: 201 });
}

interface UpdateRoundBody {
  slotALabel?: unknown;
  slotBLabel?: unknown;
  slotAValue?: unknown;
  slotBValue?: unknown;
}

const UPDATABLE_COLUMNS: Record<keyof UpdateRoundBody, string> = {
  slotALabel: "slot_a_label",
  slotBLabel: "slot_b_label",
  slotAValue: "slot_a_value",
  slotBValue: "slot_b_value",
};

export async function handleUpdateRound(
  request: Request,
  env: Env,
  roundId: string
): Promise<Response> {
  let body: UpdateRoundBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("リクエストボディが不正です");
  }

  const round = await env.DB.prepare("SELECT id, status FROM rounds WHERE id = ?")
    .bind(roundId)
    .first<{ id: string; status: string }>();

  if (!round) {
    return notFound("ラウンドが見つかりません");
  }
  if (round.status !== "open") {
    return badRequest("締切済みのラウンドは更新できません");
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS) as [
    keyof UpdateRoundBody,
    string
  ][]) {
    const value = body[key];
    if (typeof value === "string" || value === null) {
      sets.push(`${column} = ?`);
      values.push(value);
    }
  }

  if (sets.length === 0) {
    return badRequest("更新対象のフィールドがありません");
  }

  values.push(roundId);
  await env.DB.prepare(`UPDATE rounds SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return json({ id: roundId, updated: sets.length });
}

export async function handleCancelRound(env: Env, roundId: string): Promise<Response> {
  const round = await env.DB.prepare("SELECT id, status FROM rounds WHERE id = ?")
    .bind(roundId)
    .first<{ id: string; status: string }>();

  if (!round) {
    return notFound("ラウンドが見つかりません");
  }
  if (round.status !== "open") {
    return badRequest("openのラウンドのみキャンセルできます");
  }

  // betsは残したまま、statusのみcancelledにする（履歴・決済対象からは除外される）。
  await env.DB.prepare("UPDATE rounds SET status = 'cancelled' WHERE id = ?").bind(roundId).run();

  return json({ id: roundId, status: "cancelled" });
}
