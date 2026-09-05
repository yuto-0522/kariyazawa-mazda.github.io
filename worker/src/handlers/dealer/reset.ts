import type { Env } from "../../types";
import { json, nowIso } from "../../utils";

const DEFAULT_INITIAL_POINTS = 1000;

// 過去のround/bets/settlementsは削除しない。rounds.archived_atにタイムスタンプを立てる
// ソフトアーカイブ方式とし、一覧・集計クエリ側で `archived_at IS NULL` を条件に加えることで
// 「今シーズン以降のラウンド」だけを表示できるようにする（GET /api/round/current は既にこの条件を使用）。
export async function handleReset(env: Env): Promise<Response> {
  const setting = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'initial_points'"
  ).first<{ value: string }>();
  const initialPoints = setting ? parseInt(setting.value, 10) : DEFAULT_INITIAL_POINTS;

  const { results: participants } = await env.DB.prepare("SELECT id, points FROM participants").all<{
    id: string;
    points: number;
  }>();

  const now = nowIso();
  const statements = [];

  for (const participant of participants ?? []) {
    const delta = initialPoints - participant.points;
    statements.push(
      env.DB.prepare("UPDATE participants SET points = ? WHERE id = ?").bind(
        initialPoints,
        participant.id
      ),
      env.DB.prepare(
        `INSERT INTO point_history (id, participant_id, delta, reason, round_id, created_at)
         VALUES (?, ?, ?, 'reset', NULL, ?)`
      ).bind(crypto.randomUUID(), participant.id, delta, now)
    );
  }

  // reset時点でopenのままのラウンドは（古いpoints前提のbetのため）無効化する。
  statements.push(
    env.DB.prepare("UPDATE rounds SET status = 'cancelled' WHERE status = 'open'"),
    env.DB.prepare("UPDATE rounds SET archived_at = ? WHERE archived_at IS NULL").bind(now)
  );

  await env.DB.batch(statements);

  return json({
    initialPoints,
    resetParticipants: participants?.length ?? 0,
    archivedAt: now,
  });
}
