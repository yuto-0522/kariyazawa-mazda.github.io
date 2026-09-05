# 社内賭け場サイト（雛形）

社内レクリエーション用の「賭け場サイト」プロジェクトです。
実際の金銭を扱わない、ポイント制のレクリエーション用途を想定しています。

## 構成

```
.
├── site/                  # GitHub Pagesで配信する静的フロントエンド（素のHTML/CSS/JS）
│   ├── index.html         # 社内レクリエーションのハブ（入口）ページ
│   ├── css/hub.css
│   ├── js/hub.js          # サービス一覧(services配列)の定義・描画、名前登録UI
│   └── apps/
│       └── betting/       # 「賭け場」サービス本体
└── worker/                # Cloudflare Workers + TypeScript のバックエンドAPI（D1データベース利用）
```

- `site/`: ビルドツールなし。GitHub PagesのPagesソースをこのディレクトリに向ければそのまま配信できる。トップの`index.html`は各サービスへのハブページで、実際のサービスは`site/apps/<サービス名>/`配下に置く。新サービスを追加する際は`site/js/hub.js`冒頭のコメントの通り`services`配列に1件追加するだけでよい。
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

上記のnpmスクリプトは内部で以下の`wrangler`コマンドを実行している（`worker/migrations/`配下の未適用マイグレーションがすべて適用対象。現在は`0001_init.sql`, `0002_dealer_extensions.sql`）。

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

### 4. 環境変数の設定

ディーラー向けAPI（`/api/dealer/*`）は、リクエストヘッダー`X-Dealer-Key`が環境変数`DEALER_KEY`と完全一致することを要求する。秘匿情報なので`wrangler.toml`には書かず、以下のように設定する。

ローカル開発:

```bash
cd worker
cp .dev.vars.example .dev.vars
# .dev.vars を開いて DEALER_KEY の値を設定する
```

本番（Cloudflareのsecretとして登録）:

```bash
cd worker
npx wrangler secret put DEALER_KEY
```

### 5. Workerの起動（ローカル開発サーバー）

```bash
npm run dev
```

デフォルトでは `http://127.0.0.1:8787` で起動する。動作確認:

```bash
curl http://127.0.0.1:8787/api/health
```

#### APIエンドポイント（認証なし・名前のみで識別する簡易仕様）

| Method | Path | 説明 |
| --- | --- | --- |
| POST | `/api/session` | `{ name }` を受け取り、参加者を作成（未登録時は`settings.initial_points`を初期ポイントに設定）または既存参加者を返す |
| GET | `/api/participants` | 全参加者を`points`降順で返す（ランキング表示用） |
| GET | `/api/round/current` | `status='open'`のラウンドを1件返す（なければ`null`）。実測値(`slot_a_value`/`slot_b_value`)は含まない |
| POST | `/api/round/:id/bet` | `{ participantId, stake, guessA, guessB }` を受け取り予想を登録する。ラウンドが`open`であること、同一参加者が同一ラウンドに未予想であること、`stake`が1以上`points`以下の整数であることを検証する。この時点では`points`は減算せず、決済(settlement)時にまとめて減算する設計 |
| GET | `/api/history` | `status='settled'`のラウンドを`settled_at`の新しい順に返す。各ラウンドの`slot_a_label`/`slot_a_value`/`slot_b_label`/`slot_b_value`と、`settlements`から集計した枠ごとの勝者名一覧・配分ポイント・実測値との差を含む |

#### ディーラー向けAPI（要`X-Dealer-Key`ヘッダー、不一致・未指定は401）

| Method | Path | 説明 |
| --- | --- | --- |
| GET | `/api/dealer/round/current` | openラウンドを、参加者向けの`/api/round/current`にはない`bet_count`（参加者数）・`total_stake`（合計stake）付きで返す（なければ`null`） |
| POST | `/api/dealer/round` | `{ slotALabel, slotBLabel }` で新規ラウンドを`open`状態で作成。既にopenのラウンドがあれば409 |
| PATCH | `/api/dealer/round/:id` | `{ slotALabel?, slotBLabel?, slotAValue?, slotBValue? }` を部分更新。ラウンドが`open`のときのみ許可（それ以外は400） |
| DELETE | `/api/dealer/round/:id` | `open`のラウンドを`cancelled`にする（betsは残す。cancelledは履歴・決済対象から除外） |
| POST | `/api/dealer/round/:id/settle` | `{ slotAValue, slotBValue }`（実測値）で決済。stakeの徴収・枠A/枠Bそれぞれの最小誤差の予想者への配分・`points`反映・`point_history`(`reason='bet_settlement'`)記録・`settlements`記録をD1の`batch`で原子的に実行する |
| POST | `/api/dealer/reset` | 全参加者の`points`を`settings.initial_points`に戻し`point_history`(`reason='reset'`)に記録。rounds/bets/settlementsは削除せず、`rounds.archived_at`にタイムスタンプを立てて過去ラウンド一覧から除外する（ソフトアーカイブ） |

CORSは`worker/wrangler.toml`の`[vars] ALLOWED_ORIGIN`に設定したオリジンのみ許可される。GitHub Pagesのオリジンに合わせて値を更新すること。

### 6. フロントエンドの確認

`site/index.html`（ハブページ）をブラウザで直接開くか、簡易HTTPサーバーで配信する。

```bash
cd site
npx serve .
```

「賭け場」を開く場合は `site/apps/betting/config.js` の `window.BET_API_BASE_URL` が、起動中のWorkerのURL（ローカルは `http://127.0.0.1:8787`、本番はデプロイ後の `*.workers.dev` など）を指しているか確認する。

### 7. Workerのデプロイ

```bash
cd worker
npm run deploy
```

## デプロイ構成

### バックエンド（Cloudflare Workers）

```bash
cd worker
npx wrangler d1 create bet_site_db                                              # database_idをwrangler.tomlに反映
npx wrangler d1 execute bet_site_db --remote --file=./migrations/0001_init.sql
npx wrangler d1 execute bet_site_db --remote --file=./migrations/0002_dealer_extensions.sql
npx wrangler secret put DEALER_KEY                                              # 十分に長いランダム文字列を設定
npx wrangler deploy                                                             # 発行された *.workers.dev のURLを控える
```

デプロイ後、発行されたURLを `site/apps/betting/config.js` の `window.BET_API_BASE_URL` に設定する。

### フロントエンド（GitHub Pages）

GitHub Pagesの「Deploy from a branch」はフォルダ指定が`/`か`/docs`のみで、`/site`のような任意のサブフォルダは選べない。そのため本リポジトリでは[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)でGitHub Actionsから`site/`配下をデプロイする方式にしている。

1. リポジトリの Settings → Pages → Build and deployment → Source を **「GitHub Actions」** に設定する（ブランチ・フォルダ指定は不要）
2. `master`ブランチの`site/`配下に変更をpushすると、上記ワークフローが自動でPagesにデプロイする（`workflow_dispatch`で手動実行も可能）
3. 発行されたGitHub PagesのURLを、Workerの環境変数 `ALLOWED_ORIGIN`（[worker/wrangler.toml](worker/wrangler.toml)の`[vars]`）に設定し直し、`npx wrangler deploy`を再実行する（CORSエラー防止のため）

## TODO

- ディーラー用UI（`site/apps/betting/dealer.html`）とディーラー向けAPIの実運用確認（実機でのD1・wrangler dev検証）
- 不正防止・レート制限の検討
