import type { Env } from "../../types";
import { badRequest, fetchParticipantNames, json, notFound, nowIso } from "../../utils";

interface SettleBody {
  slotAValue?: unknown;
  slotBValue?: unknown;
}

interface BetRow {
  id: string;
  participant_id: string;
  stake: number;
  guess_a: string;
  guess_b: string;
}

interface WinnerInfo {
  id: string;
  name: string;
}

interface SlotResult {
  winners: BetRow[];
  diffSeconds: number | null;
}

// "HH:MM:SS.fff" / "MM:SS" / "SS.fff" のようなコロン区切りの時刻文字列を秒(小数可)に変換する。
// パースできない場合はnullを返す。
function parseTimeToSeconds(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length === 0 || parts.some((p) => p === "")) return null;

  let total = 0;
  for (const part of parts) {
    const n = Number(part);
    if (Number.isNaN(n)) return null;
    total = total * 60 + n;
  }
  return total;
}

// guessKeyで指定した参加者の予想と実測値(actualValue)を比較し、差が最小のbetを勝者とする。
// 差が完全に同値のbetが複数あれば全員を勝者とする。
function pickWinners(bets: BetRow[], guessKey: "guess_a" | "guess_b", actualValue: string): SlotResult {
  const actual = parseTimeToSeconds(actualValue);
  if (actual === null) return { winners: [], diffSeconds: null };

  let minDiff = Infinity;
  let winners: BetRow[] = [];

  for (const bet of bets) {
    const guess = parseTimeToSeconds(bet[guessKey]);
    if (guess === null) continue;

    const diff = Math.abs(guess - actual);
    if (diff < minDiff) {
      minDiff = diff;
      winners = [bet];
    } else if (diff === minDiff) {
      winners.push(bet);
    }
  }

  return { winners, diffSeconds: winners.length > 0 ? minDiff : null };
}

function toWinnerInfo(bet: BetRow, namesById: Map<string, string>): WinnerInfo {
  return { id: bet.participant_id, name: namesById.get(bet.participant_id) ?? "" };
}

async function fetchParticipantsRanked(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT name, points FROM participants ORDER BY points DESC"
  ).all<{ name: string; points: number }>();
  return results ?? [];
}

export async function handleSettleRound(
  request: Request,
  env: Env,
  roundId: string
): Promise<Response> {
  let body: SettleBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("リクエストボディが不正です");
  }

  const slotAValue = typeof body.slotAValue === "string" ? body.slotAValue : "";
  const slotBValue = typeof body.slotBValue === "string" ? body.slotBValue : "";
  if (!slotAValue || !slotBValue) {
    return badRequest("slotAValue, slotBValueは必須です");
  }

  const round = await env.DB.prepare("SELECT id, status FROM rounds WHERE id = ?")
    .bind(roundId)
    .first<{ id: string; status: string }>();

  if (!round) {
    return notFound("ラウンドが見つかりません");
  }
  if (round.status !== "open") {
    return badRequest("openのラウンドのみ決済できます");
  }

  const { results: bets } = await env.DB.prepare(
    "SELECT id, participant_id, stake, guess_a, guess_b FROM bets WHERE round_id = ?"
  )
    .bind(roundId)
    .all<BetRow>();

  const settledAt = nowIso();
  const statements = [
    env.DB.prepare(
      `UPDATE rounds SET slot_a_value = ?, slot_b_value = ?, status = 'settled', settled_at = ? WHERE id = ?`
    ).bind(slotAValue, slotBValue, settledAt, roundId),
  ];

  const pot = (bets ?? []).reduce((sum, b) => sum + b.stake, 0);

  if (!bets || bets.length === 0 || pot === 0) {
    // 誰も賭けていない場合は配分をスキップし、「該当者なし」を両枠分記録するのみ。
    statements.push(
      env.DB.prepare(
        `INSERT INTO settlements (id, round_id, slot, winner_participant_ids, points_awarded, diff_seconds, created_at)
         VALUES (?, ?, 'a', '', 0, NULL, ?)`
      ).bind(crypto.randomUUID(), roundId, settledAt),
      env.DB.prepare(
        `INSERT INTO settlements (id, round_id, slot, winner_participant_ids, points_awarded, diff_seconds, created_at)
         VALUES (?, ?, 'b', '', 0, NULL, ?)`
      ).bind(crypto.randomUUID(), roundId, settledAt)
    );

    await env.DB.batch(statements);

    return json({
      round: { id: roundId, slotAValue, slotBValue, settledAt },
      slotA: { winners: [], pointsEach: 0, diffSeconds: null },
      slotB: { winners: [], pointsEach: 0, diffSeconds: null },
      participants: await fetchParticipantsRanked(env),
      note: "賭けが存在しなかったため配分は行われませんでした",
    });
  }

  const halfPot = Math.floor(pot / 2);
  const slotA = pickWinners(bets, "guess_a", slotAValue);
  const slotB = pickWinners(bets, "guess_b", slotBValue);

  const pointsEachA = slotA.winners.length > 0 ? Math.floor(halfPot / slotA.winners.length) : 0;
  const pointsEachB = slotB.winners.length > 0 ? Math.floor(halfPot / slotB.winners.length) : 0;

  // 参加者ごとの最終増減 = -stake（全bettor） + 枠Aの配分 + 枠Bの配分
  const netDelta = new Map<string, number>();
  for (const bet of bets) {
    netDelta.set(bet.participant_id, (netDelta.get(bet.participant_id) ?? 0) - bet.stake);
  }
  for (const winner of slotA.winners) {
    netDelta.set(winner.participant_id, (netDelta.get(winner.participant_id) ?? 0) + pointsEachA);
  }
  for (const winner of slotB.winners) {
    netDelta.set(winner.participant_id, (netDelta.get(winner.participant_id) ?? 0) + pointsEachB);
  }

  for (const [participantId, delta] of netDelta.entries()) {
    statements.push(
      env.DB.prepare("UPDATE participants SET points = points + ? WHERE id = ?").bind(
        delta,
        participantId
      ),
      env.DB.prepare(
        `INSERT INTO point_history (id, participant_id, delta, reason, round_id, created_at)
         VALUES (?, ?, ?, 'bet_settlement', ?, ?)`
      ).bind(crypto.randomUUID(), participantId, delta, roundId, settledAt)
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO settlements (id, round_id, slot, winner_participant_ids, points_awarded, diff_seconds, created_at)
       VALUES (?, ?, 'a', ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      roundId,
      slotA.winners.map((w) => w.participant_id).join(","),
      pointsEachA,
      slotA.diffSeconds,
      settledAt
    ),
    env.DB.prepare(
      `INSERT INTO settlements (id, round_id, slot, winner_participant_ids, points_awarded, diff_seconds, created_at)
       VALUES (?, ?, 'b', ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      roundId,
      slotB.winners.map((w) => w.participant_id).join(","),
      pointsEachB,
      slotB.diffSeconds,
      settledAt
    )
  );

  // 一連の更新（ラウンド確定・points増減・履歴・settlements記録）を1つのbatchで原子的に実行する。
  await env.DB.batch(statements);

  const namesById = await fetchParticipantNames(env, [
    ...slotA.winners.map((w) => w.participant_id),
    ...slotB.winners.map((w) => w.participant_id),
  ]);

  return json({
    round: { id: roundId, slotAValue, slotBValue, settledAt },
    slotA: {
      winners: slotA.winners.map((w) => toWinnerInfo(w, namesById)),
      pointsEach: pointsEachA,
      diffSeconds: slotA.diffSeconds,
    },
    slotB: {
      winners: slotB.winners.map((w) => toWinnerInfo(w, namesById)),
      pointsEach: pointsEachB,
      diffSeconds: slotB.diffSeconds,
    },
    participants: await fetchParticipantsRanked(env),
  });
}
