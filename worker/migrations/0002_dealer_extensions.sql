-- 決済結果の実測値との差（秒）を記録する列
ALTER TABLE settlements ADD COLUMN diff_seconds REAL;

-- ラウンドを削除せずに過去ラウンド一覧・集計から除外するためのソフトアーカイブ用列
-- （reset実行時にすべてのラウンドへ現在時刻を設定する）
ALTER TABLE rounds ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_rounds_archived_at ON rounds(archived_at);
