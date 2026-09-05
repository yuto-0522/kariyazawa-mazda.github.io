import type { Env } from "../types";
import { badRequest, json, notFound, nowIso } from "../utils";

interface BetRequestBody {
  participantId?: unknown;
  stake?: unknown;
  guessA?: unknown;
  guessB?: unknown;
}

export async function handlePlaceBet(
  request: Request,
  env: Env,
  roundId: string
): Promise<Response> {
  let body: BetRequestBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("リクエストボディが不正です");
  }

  const participantId = typeof body.participantId === "string" ? body.participantId : "";
  const guessA = typeof body.guessA === "string" ? body.guessA : "";
  const guessB = typeof body.guessB === "string" ? body.guessB : "";
  const stake = body.stake;

  if (!participantId || !guessA || !guessB) {
    return badRequest("participantId, guessA, guessBは必須です");
  }
  if (typeof stake !== "number" || !Number.isInteger(stake) || stake < 1) {
    return badRequest("stakeは1以上の整数で指定してください");
  }

  const round = await env.DB.prepare("SELECT id, status FROM rounds WHERE id = ?")
    .bind(roundId)
    .first<{ id: string; status: string }>();

  if (!round) {
    return notFound("ラウンドが見つかりません");
  }
  if (round.status !== "open") {
    return badRequest("このラウンドは受付を終了しています");
  }

  const participant = await env.DB.prepare("SELECT id, points FROM participants WHERE id = ?")
    .bind(participantId)
    .first<{ id: string; points: number }>();

  if (!participant) {
    return notFound("参加者が見つかりません");
  }
  if (stake > participant.points) {
    return badRequest("保有ポイントを超えるstakeは指定できません");
  }

  const existingBet = await env.DB.prepare(
    "SELECT id FROM bets WHERE round_id = ? AND participant_id = ?"
  )
    .bind(roundId, participantId)
    .first<{ id: string }>();

  if (existingBet) {
    return badRequest("既に予想済みです");
  }

  const id = crypto.randomUUID();
  const createdAt = nowIso();

  // NOTE: ここではpointsを減算しない。stakeの消費（減算）はラウンド決済(settlement)時に
  // 全betsをまとめて精算する処理の中で行う設計とする。betの登録時点では確保するだけ。
  try {
    await env.DB.prepare(
      `INSERT INTO bets (id, round_id, participant_id, stake, guess_a, guess_b, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, roundId, participantId, stake, guessA, guessB, createdAt)
      .run();
  } catch (err) {
    // (round_id, participant_id) のUNIQUE制約違反（同時リクエストによる競合）をハンドリング
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return badRequest("既に予想済みです");
    }
    throw err;
  }

  return json(
    {
      id,
      roundId,
      participantId,
      stake,
      guessA,
      guessB,
      createdAt,
    },
    { status: 201 }
  );
}
