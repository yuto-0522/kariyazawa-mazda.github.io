export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok" });
    }

    if (url.pathname === "/api/events" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, title, status FROM events ORDER BY id DESC"
      ).all();
      return Response.json(results);
    }

    return new Response("Not Found", { status: 404 });
  },
};
