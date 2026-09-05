import type { Env } from "../types";
import { json } from "../utils";

interface CurrentRound {
  id: string;
  slot_a_label: string | null;
  slot_b_label: string | null;
  created_at: string | null;
}

export async function handleCurrentRound(env: Env): Promise<Response> {
  // slot_a_value / slot_b_value（実測値）はopen中は参加者に見せないため選択しない。
  // archived_atが立っているラウンド（reset済み）は対象外とする。
  const round = await env.DB.prepare(
    `SELECT id, slot_a_label, slot_b_label, created_at
     FROM rounds
     WHERE status = 'open' AND archived_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`
  ).first<CurrentRound>();

  return json(round ?? null);
}
