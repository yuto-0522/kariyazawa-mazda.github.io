const USER_NAME_KEY = "betHall.userName";
const API_BASE = window.BET_API_BASE_URL;

const els = {
  notRegistered: document.getElementById("not-registered"),
  mainContent: document.getElementById("main-content"),
  userName: document.getElementById("user-name"),
  userPoints: document.getElementById("user-points"),
  roundStatus: document.getElementById("round-status"),
  roundForm: document.getElementById("round-form"),
  slotALabel: document.getElementById("slot-a-label"),
  slotBLabel: document.getElementById("slot-b-label"),
  stakeInput: document.getElementById("stake-input"),
  guessAInput: document.getElementById("guess-a-input"),
  guessBInput: document.getElementById("guess-b-input"),
  betSubmit: document.getElementById("bet-submit"),
  betMessage: document.getElementById("bet-message"),
  rankingList: document.getElementById("ranking-list"),
  historyList: document.getElementById("history-list"),
};

let participant = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatDate(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString("ja-JP");
}

async function createSession(name) {
  const res = await fetch(`${API_BASE}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadCurrentRound() {
  try {
    const res = await fetch(`${API_BASE}/api/round/current`);
    const round = await res.json();

    if (!round) {
      els.roundStatus.textContent = "現在募集中のラウンドはありません";
      els.roundForm.hidden = true;
      return;
    }

    els.roundStatus.textContent = "";
    els.roundForm.hidden = false;
    els.roundForm.dataset.roundId = round.id;
    els.slotALabel.textContent = round.slot_a_label || "枠A";
    els.slotBLabel.textContent = round.slot_b_label || "枠B";
  } catch (err) {
    els.roundStatus.textContent = "ラウンド情報の取得に失敗しました";
    els.roundForm.hidden = true;
  }
}

function setFormDisabled(disabled) {
  els.stakeInput.disabled = disabled;
  els.guessAInput.disabled = disabled;
  els.guessBInput.disabled = disabled;
  els.betSubmit.disabled = disabled;
}

async function handleBetSubmit(event) {
  event.preventDefault();
  const roundId = els.roundForm.dataset.roundId;
  if (!roundId || !participant) return;

  const stake = Number(els.stakeInput.value);
  const guessA = els.guessAInput.value.trim();
  const guessB = els.guessBInput.value.trim();

  els.betMessage.textContent = "";
  els.betMessage.classList.remove("error");
  els.betSubmit.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/round/${roundId}/bet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: participant.id, stake, guessA, guessB }),
    });
    const data = await res.json();

    if (!res.ok) {
      els.betMessage.textContent = data.error || `HTTP ${res.status}`;
      els.betMessage.classList.add("error");
      els.betSubmit.disabled = false;
      return;
    }

    els.betMessage.textContent = "予想を送信しました。ディーラーの集計をお待ちください";
    setFormDisabled(true);
  } catch (err) {
    els.betMessage.textContent = "送信に失敗しました。通信環境を確認してください";
    els.betMessage.classList.add("error");
    els.betSubmit.disabled = false;
  }
}

async function loadRanking() {
  try {
    const res = await fetch(`${API_BASE}/api/participants`);
    const ranking = await res.json();

    if (!Array.isArray(ranking) || ranking.length === 0) {
      els.rankingList.innerHTML = "<li>参加者がいません</li>";
      return;
    }

    els.rankingList.innerHTML = ranking
      .map((p, index) => `<li>${index + 1}位: ${escapeHtml(p.name)} — ${p.points}pt</li>`)
      .join("");
  } catch (err) {
    els.rankingList.innerHTML = "<li>ランキングの取得に失敗しました</li>";
  }
}

function renderSlotResult(fallbackLabel, slot) {
  const label = slot.label || fallbackLabel;
  const winners =
    slot.winners && slot.winners.length > 0
      ? slot.winners.map((w) => escapeHtml(w.name)).join(", ")
      : "該当者なし";

  return `
    <div class="history-slot">
      <span class="history-slot-label">${escapeHtml(label)}</span>
      <span>実測値: ${escapeHtml(slot.value ?? "-")}</span>
      <span>勝者: ${winners}（${slot.pointsEach ?? 0}pt）</span>
    </div>
  `;
}

function renderHistoryItem(round) {
  return `
    <li class="history-item">
      <div class="history-date">${formatDate(round.settledAt)}</div>
      ${renderSlotResult("枠A", round.slotA)}
      ${renderSlotResult("枠B", round.slotB)}
    </li>
  `;
}

async function loadHistory() {
  try {
    const res = await fetch(`${API_BASE}/api/history`);
    const history = await res.json();

    if (!Array.isArray(history) || history.length === 0) {
      els.historyList.innerHTML = "<li>まだ決済されたラウンドはありません</li>";
      return;
    }

    els.historyList.innerHTML = history.map(renderHistoryItem).join("");
  } catch (err) {
    els.historyList.innerHTML = "<li>履歴の取得に失敗しました</li>";
  }
}

async function init() {
  const name = localStorage.getItem(USER_NAME_KEY);

  if (!name) {
    els.notRegistered.hidden = false;
    els.mainContent.hidden = true;
    return;
  }

  els.notRegistered.hidden = true;
  els.mainContent.hidden = false;

  try {
    participant = await createSession(name);
    els.userName.textContent = participant.name;
    els.userPoints.textContent = participant.points;
  } catch (err) {
    els.userName.textContent = "取得失敗";
    els.userPoints.textContent = "-";
  }

  els.roundForm.addEventListener("submit", handleBetSubmit);

  await Promise.all([loadCurrentRound(), loadRanking(), loadHistory()]);
}

init();
