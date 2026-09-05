import type { Env } from "../../types";
import { json } from "../../utils";

interface DealerCurrentRound {
  id: string;
  slot_a_label: string | null;
  slot_b_label: string | null;
  created_at: string | null;
  bet_count: number;
  total_stake: number;
}

// ディーラー向け: openラウンドの状況を、参加者向けAPIにはない集計値(参加者数・合計stake)付きで返す。
export async function handleDealerCurrentRound(env: Env): Promise<Response> {
  const round = await env.DB.prepare(
    `SELECT r.id, r.slot_a_label, r.slot_b_label, r.created_at,
            COUNT(b.id) AS bet_count, COALESCE(SUM(b.stake), 0) AS total_stake
     FROM rounds r
     LEFT JOIN bets b ON b.round_id = r.id
     WHERE r.status = 'open' AND r.archived_at IS NULL
     GROUP BY r.id
     ORDER BY r.created_at DESC
     LIMIT 1`
  ).first<DealerCurrentRound>();

  return json(round ?? null);
}
