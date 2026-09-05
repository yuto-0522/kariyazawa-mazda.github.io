import type { Env } from "./types";
import { handlePreflight, withCors } from "./cors";
import { json, notFound } from "./utils";
import { requireDealerKey } from "./dealerAuth";
import { handleCreateSession } from "./handlers/session";
import { handleListParticipants } from "./handlers/participants";
import { handleCurrentRound } from "./handlers/round";
import { handlePlaceBet } from "./handlers/bet";
import { handleHistory } from "./handlers/history";
import {
  handleCancelRound,
  handleCreateRound,
  handleUpdateRound,
} from "./handlers/dealer/round";
import { handleSettleRound } from "./handlers/dealer/settle";
import { handleReset } from "./handlers/dealer/reset";
import { handleDealerCurrentRound } from "./handlers/dealer/currentRound";

const BET_PATH = /^\/api\/round\/([^/]+)\/bet$/;
const DEALER_ROUND_PATH = /^\/api\/dealer\/round\/([^/]+)$/;
const DEALER_SETTLE_PATH = /^\/api\/dealer\/round\/([^/]+)\/settle$/;

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === "/api/health") {
    return json({ status: "ok" });
  }

  if (pathname === "/api/session" && request.method === "POST") {
    return handleCreateSession(request, env);
  }

  if (pathname === "/api/participants" && request.method === "GET") {
    return handleListParticipants(env);
  }

  if (pathname === "/api/round/current" && request.method === "GET") {
    return handleCurrentRound(env);
  }

  if (pathname === "/api/history" && request.method === "GET") {
    return handleHistory(env);
  }

  const betMatch = pathname.match(BET_PATH);
  if (betMatch && request.method === "POST") {
    return handlePlaceBet(request, env, betMatch[1]);
  }

  // ディーラー向けAPI: すべてX-Dealer-Keyによる認証が必須
  if (pathname.startsWith("/api/dealer/")) {
    const unauthorized = requireDealerKey(request, env);
    if (unauthorized) return unauthorized;

    if (pathname === "/api/dealer/round" && request.method === "POST") {
      return handleCreateRound(request, env);
    }

    if (pathname === "/api/dealer/round/current" && request.method === "GET") {
      return handleDealerCurrentRound(env);
    }

    if (pathname === "/api/dealer/reset" && request.method === "POST") {
      return handleReset(env);
    }

    const settleMatch = pathname.match(DEALER_SETTLE_PATH);
    if (settleMatch && request.method === "POST") {
      return handleSettleRound(request, env, settleMatch[1]);
    }

    const roundMatch = pathname.match(DEALER_ROUND_PATH);
    if (roundMatch && request.method === "PATCH") {
      return handleUpdateRound(request, env, roundMatch[1]);
    }
    if (roundMatch && request.method === "DELETE") {
      return handleCancelRound(env, roundMatch[1]);
    }
  }

  return notFound();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const preflight = handlePreflight(request, env);
    if (preflight) return preflight;

    const response = await route(request, env);
    return withCors(response, request, env);
  },
};
