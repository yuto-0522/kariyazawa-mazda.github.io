import type { Env } from "../types";
import { json } from "../utils";

export async function handleListParticipants(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT name, points FROM participants ORDER BY points DESC"
  ).all<{ name: string; points: number }>();

  return json(results ?? []);
}
