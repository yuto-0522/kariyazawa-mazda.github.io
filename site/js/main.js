// TODO: デプロイ後は実際のWorkerのURL（例: https://xxxx.workers.dev）に差し替える
const API_BASE = "http://127.0.0.1:8787";

document.getElementById("api-base").textContent = API_BASE;

async function loadEvents() {
  const listEl = document.getElementById("event-list");
  try {
    const res = await fetch(`${API_BASE}/api/events`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const events = await res.json();

    if (events.length === 0) {
      listEl.innerHTML = "<li>現在開催中のイベントはありません</li>";
      return;
    }

    listEl.innerHTML = events
      .map((e) => `<li>#${e.id} ${e.title}（${e.status}）</li>`)
      .join("");
  } catch (err) {
    listEl.innerHTML = `<li>読み込みに失敗しました: ${err.message}</li>`;
  }
}

loadEvents();
