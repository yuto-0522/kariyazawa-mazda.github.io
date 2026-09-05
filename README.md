# 社内賭け場サイト（雛形）

社内レクリエーション用の「賭け場サイト」プロジェクトです。
実際の金銭を扱わない、ポイント制のレクリエーション用途を想定しています。

## 構成

```
.
├── site/     # GitHub Pagesで配信する静的フロントエンド（素のHTML/CSS/JS）
└── worker/   # Cloudflare Workers + TypeScript のバックエンドAPI（D1データベース利用）
```

- `site/`: ビルドツールなし。GitHub PagesのPagesソースをこのディレクトリに向ければそのまま配信できる。
- `worker/`: `wrangler` でデプロイするCloudflare Workers。D1データベース（バインディング名 `DB`、DB名 `bet_site_db`）を利用する前提。

## ローカル開発手順（叩き台）

### 1. 依存パッケージのインストール

```bash
cd worker
npm install
```

### 2. D1データベースの作成（初回のみ）

まだD1データベースを発行していない場合は以下を実行し、出力された `database_id` を `worker/wrangler.toml` の `database_id` に反映する。

```bash
npx wrangler d1 create bet_site_db
```

### 3. マイグレーションの適用

ローカル（`wrangler dev` が使うローカルSQLite）に適用する場合:

```bash
npm run db:migrate:local
```

本番のD1に適用する場合:

```bash
npm run db:migrate:remote
```

上記のnpmスクリプトは内部で以下の`wrangler`コマンドを実行している（`worker/migrations/0001_init.sql`が適用対象）。

```bash
cd worker

# ローカル（wrangler devが使うローカルSQLite）に適用
npx wrangler d1 migrations apply bet_site_db --local

# 本番のD1に適用
npx wrangler d1 migrations apply bet_site_db --remote
```

適用済みのマイグレーション一覧は次のコマンドで確認できる。

```bash
npx wrangler d1 migrations list bet_site_db --local
npx wrangler d1 migrations list bet_site_db --remote
```

### 4. Workerの起動（ローカル開発サーバー）

```bash
npm run dev
```

デフォルトでは `http://127.0.0.1:8787` で起動する。動作確認:

```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/events
```

### 5. フロントエンドの確認

`site/index.html` をブラウザで直接開くか、簡易HTTPサーバーで配信する。

```bash
cd site
npx serve .
```

`site/js/main.js` の `API_BASE` が、起動中のWorkerのURL（ローカルは `http://127.0.0.1:8787`、本番はデプロイ後の `*.workers.dev` など）を指しているか確認する。

### 6. Workerのデプロイ

```bash
cd worker
npm run deploy
```

## デプロイ構成

- フロントエンド（`site/`）: GitHub Pagesで配信。
- バックエンド（`worker/`）: Cloudflare Workersにデプロイし、`site/js/main.js` の `API_BASE` をデプロイ後のURLに更新する。

## TODO

- 認証・アカウント管理の設計
- ベット（賭け）・イベント作成・精算のAPIエンドポイント実装
- 不正防止・レート制限の検討
- CI/CDパイプラインの整備
