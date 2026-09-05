const DEALER_KEY_STORAGE = "betHall.dealerKey";
const API_BASE = window.BET_API_BASE_URL;

const els = {
  keySection: document.getElementById("dealer-key-section"),
  keyForm: document.getElementById("dealer-key-form"),
  keyInput: document.getElementById("dealer-key-input"),
  keyMessage: document.getElementById("dealer-key-message"),
  main: document.getElementById("dealer-main"),

  roundStatus: document.getElementById("round-status"),
  roundInfo: document.getElementById("round-info"),
  roundSlotA: document.getElementById("round-slot-a"),
  roundSlotB: document.getElementById("round-slot-b"),
  roundBetCount: document.getElementById("round-bet-count"),
  roundTotalStake: document.getElementById("round-total-stake"),

  createRoundSection: document.getElementById("create-round-section"),
  createRoundForm: document.getElementById("create-round-form"),
  createSlotAInput: document.getElementById("create-slot-a-input"),
  createSlotBInput: document.getElementById("create-slot-b-input"),
  createRoundMessage: document.getElementById("create-round-message"),

  editRoundSection: document.getElementById("edit-round-section"),
  editRoundForm: document.getElementById("edit-round-form"),
  editSlotAInput: document.getElementById("edit-slot-a-input"),
  editSlotBInput: document.getElementById("edit-slot-b-input"),
  editRoundMessage: document.getElementById("edit-round-message"),
  deleteRoundButton: document.getElementById("delete-round-button"),

  settleSection: document.getElementById("settle-section"),
  settleForm: document.getElementById("settle-form"),
  settleSlotAInput: document.getElementById("settle-slot-a-input"),
  settleSlotBInput: document.getElementById("settle-slot-b-input"),
  settleMessage: document.getElementById("settle-message"),
  settleResult: document.getElementById("settle-result"),

  participantsList: document.getElementById("participants-list"),
  resetButton: document.getElementById("reset-button"),
  historyList: document.getElementById("history-list"),
};

let dealerKey = localStorage.getItem(DEALER_KEY_STORAGE) || "";
let currentRound = null;

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

function showKeyPrompt(message) {
  els.keySection.hidden = false;
  els.main.hidden = true;
  els.keyMessage.textContent = message || "";
}

function showMain() {
  els.keySection.hidden = true;
  els.main.hidden = false;
}

// ディーラー鍵が401で拒否された場合は保存済みの鍵を破棄し、再入力を求める。
function handleUnauthorized() {
  localStorage.removeItem(DEALER_KEY_STORAGE);
  dealerKey = "";
  showKeyPrompt("ディーラー鍵が正しくありません。再度入力してください。");
}

// ディーラー向けAPI呼び出しの共通ラッパー。X-Dealer-Keyを自動付与し、401なら再入力を促す。
async function dealerFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Dealer-Key": dealerKey,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("UNAUTHORIZED");
  }

  return res;
}

function renderCurrentRound(round) {
  currentRound = round;

  if (!round) {
    els.roundStatus.textContent = "現在openのラウンドはありません";
    els.roundInfo.hidden = true;
    els.createRoundSection.hidden = false;
    els.editRoundSection.hidden = true;
    els.settleSection.hidden = true;
    return;
  }

  els.roundStatus.textContent = "";
  els.roundInfo.hidden = false;
  els.roundSlotA.textContent = round.slot_a_label || "-";
  els.roundSlotB.textContent = round.slot_b_label || "-";
  els.roundBetCount.textContent = round.bet_count ?? 0;
  els.roundTotalStake.textContent = round.total_stake ?? 0;

  els.createRoundSection.hidden = true;
  els.editRoundSection.hidden = false;
  els.settleSection.hidden = false;

  els.editSlotAInput.value = round.slot_a_label || "";
  els.editSlotBInput.value = round.slot_b_label || "";
  els.editRoundMessage.textContent = "";
  els.settleMessage.textContent = "";
}

async function loadCurrentRound() {
  try {
    const res = await dealerFetch("/api/dealer/round/current");
    if (!res.ok) {
      els.roundStatus.textContent = "ラウンド情報の取得に失敗しました";
      return;
    }
    renderCurrentRound(await res.json());
  } catch (err) {
    if (err.message !== "UNAUTHORIZED") {
      els.roundStatus.textContent = "ラウンド情報の取得に失敗しました";
    }
  }
}

async function loadParticipants() {
  try {
    const res = await fetch(`${API_BASE}/api/participants`);
    const list = await res.json();

    if (!Array.isArray(list) || list.length === 0) {
      els.participantsList.innerHTML = "<li>参加者がいません</li>";
      return;
    }

    els.participantsList.innerHTML = list
      .map((p) => `<li>${escapeHtml(p.name)} — ${p.points}pt</li>`)
      .join("");
  } catch (err) {
    els.participantsList.innerHTML = "<li>取得に失敗しました</li>";
  }
}

function renderSlotHistory(fallbackLabel, slot) {
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
      ${renderSlotHistory("枠A", round.slotA)}
      ${renderSlotHistory("枠B", round.slotB)}
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

async function refreshAll() {
  await Promise.all([loadCurrentRound(), loadParticipants(), loadHistory()]);
}

els.keyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = els.keyInput.value.trim();
  if (!value) return;

  dealerKey = value;
  localStorage.setItem(DEALER_KEY_STORAGE, value);
  showMain();
  refreshAll();
});

els.createRoundForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.createRoundMessage.textContent = "";

  try {
    const res = await dealerFetch("/api/dealer/round", {
      method: "POST",
      body: JSON.stringify({
        slotALabel: els.createSlotAInput.value.trim(),
        slotBLabel: els.createSlotBInput.value.trim(),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      els.createRoundMessage.textContent = data.error || `HTTP ${res.status}`;
      return;
    }

    els.createRoundForm.reset();
    await loadCurrentRound();
  } catch (err) {
    if (err.message !== "UNAUTHORIZED") {
      els.createRoundMessage.textContent = "作成に失敗しました";
    }
  }
});

els.editRoundForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentRound) return;
  els.editRoundMessage.textContent = "";

  try {
    const res = await dealerFetch(`/api/dealer/round/${currentRound.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        slotALabel: els.editSlotAInput.value.trim(),
        slotBLabel: els.editSlotBInput.value.trim(),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      els.editRoundMessage.textContent = data.error || `HTTP ${res.status}`;
      return;
    }

    els.editRoundMessage.textContent = "更新しました";
    await loadCurrentRound();
  } catch (err) {
    if (err.message !== "UNAUTHORIZED") {
      els.editRoundMessage.textContent = "更新に失敗しました";
    }
  }
});

els.deleteRoundButton.addEventListener("click", async () => {
  if (!currentRound) return;
  if (!confirm("このラウンドを削除しますか？（賭けられた予想は残りますが、このラウンドは決済対象外になります）")) {
    return;
  }

  try {
    const res = await dealerFetch(`/api/dealer/round/${currentRound.id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || `HTTP ${res.status}`);
      return;
    }

    await loadCurrentRound();
  } catch (err) {
    if (err.message !== "UNAUTHORIZED") alert("削除に失敗しました");
  }
});

function renderSettleResult(data) {
  const renderSlot = (fallbackLabel, slot) => {
    const label = escapeHtml(fallbackLabel);
    const winners =
      slot.winners && slot.winners.length > 0
        ? slot.winners.map((w) => escapeHtml(w.name)).join(", ")
        : "該当者なし";
    return `<p>${label}: 勝者 ${winners}（${slot.pointsEach}pt）</p>`;
  };

  els.settleResult.innerHTML = renderSlot("枠A", data.slotA) + renderSlot("枠B", data.slotB);
}

els.settleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentRound) return;

  els.settleMessage.textContent = "";
  els.settleResult.innerHTML = "";

  try {
    const res = await dealerFetch(`/api/dealer/round/${currentRound.id}/settle`, {
      method: "POST",
      body: JSON.stringify({
        slotAValue: els.settleSlotAInput.value.trim(),
        slotBValue: els.settleSlotBInput.value.trim(),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      els.settleMessage.textContent = data.error || `HTTP ${res.status}`;
      return;
    }

    renderSettleResult(data);
    els.settleForm.reset();
    await refreshAll();
  } catch (err) {
    if (err.message !== "UNAUTHORIZED") {
      els.settleMessage.textContent = "決済に失敗しました";
    }
  }
});

els.resetButton.addEventListener("click", async () => {
  if (!confirm("本当に全参加者のポイントをリセットしますか？")) return;
  if (!confirm("この操作は取り消せません。本当に実行しますか？")) return;

  try {
    const res = await dealerFetch("/api/dealer/reset", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || `HTTP ${res.status}`);
      return;
    }

    await refreshAll();
  } catch (err) {
    if (err.message !== "UNAUTHORIZED") alert("リセットに失敗しました");
  }
});

function init() {
  if (!dealerKey) {
    showKeyPrompt();
    return;
  }
  showMain();
  refreshAll();
}

init();
