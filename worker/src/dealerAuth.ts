import type { Env } from "./types";
import { json } from "./utils";

// ディーラー向けAPI共通の認証チェック。X-Dealer-KeyがDEALER_KEYと完全一致しない場合は401を返す。
export function requireDealerKey(request: Request, env: Env): Response | null {
  const key = request.headers.get("X-Dealer-Key");
  if (!key || key !== env.DEALER_KEY) {
    return json({ error: "X-Dealer-Keyが不正です" }, { status: 401 });
  }
  return null;
}
