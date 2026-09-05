import type { Env } from "../types";
import { fetchParticipantNames, json } from "../utils";

interface HistoryRoundRow {
  id: string;
  slot_a_label: string | null;
  slot_a_value: string | null;
  slot_b_label: string | null;
  slot_b_value: string | null;
  settled_at: string | null;
}

interface SettlementRow {
  round_id: string;
  slot: "a" | "b";
  winner_participant_ids: string;
  points_awarded: number;
  diff_seconds: number | null;
}

interface WinnerInfo {
  id: string;
  name: string;
}

function toWinnerList(
  settlement: SettlementRow | undefined,
  namesById: Map<string, string>
): WinnerInfo[] {
  if (!settlement || !settlement.winner_participant_ids) return [];
  return settlement.winner_participant_ids
    .split(",")
    .filter(Boolean)
    .map((id) => ({ id, name: namesById.get(id) ?? "" }));
}

export async function handleHistory(env: Env): Promise<Response> {
  const { results: rounds } = await env.DB.prepare(
    `SELECT id, slot_a_label, slot_a_value, slot_b_label, slot_b_value, settled_at
     FROM rounds
     WHERE status = 'settled'
     ORDER BY settled_at DESC`
  ).all<HistoryRoundRow>();

  if (!rounds || rounds.length === 0) {
    return json([]);
  }

  const roundIds = rounds.map((r) => r.id);
  const placeholders = roundIds.map(() => "?").join(",");
  const { results: settlements } = await env.DB.prepare(
    `SELECT round_id, slot, winner_participant_ids, points_awarded, diff_seconds
     FROM settlements
     WHERE round_id IN (${placeholders})`
  )
    .bind(...roundIds)
    .all<SettlementRow>();

  const winnerIds = (settlements ?? []).flatMap((s) =>
    s.winner_participant_ids ? s.winner_participant_ids.split(",").filter(Boolean) : []
  );
  const namesById = await fetchParticipantNames(env, winnerIds);

  const settlementsByRound = new Map<string, Partial<Record<"a" | "b", SettlementRow>>>();
  for (const settlement of settlements ?? []) {
    const entry = settlementsByRound.get(settlement.round_id) ?? {};
    entry[settlement.slot] = settlement;
    settlementsByRound.set(settlement.round_id, entry);
  }

  const history = rounds.map((round) => {
    const entry = settlementsByRound.get(round.id) ?? {};
    return {
      id: round.id,
      settledAt: round.settled_at,
      slotA: {
        label: round.slot_a_label,
        value: round.slot_a_value,
        winners: toWinnerList(entry.a, namesById),
        pointsEach: entry.a?.points_awarded ?? 0,
        diffSeconds: entry.a?.diff_seconds ?? null,
      },
      slotB: {
        label: round.slot_b_label,
        value: round.slot_b_value,
        winners: toWinnerList(entry.b, namesById),
        pointsEach: entry.b?.points_awarded ?? 0,
        diffSeconds: entry.b?.diff_seconds ?? null,
      },
    };
  });

  return json(history);
}
