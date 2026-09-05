// ============================================================
// このハブページに新しいサービスを追加する方法
//
//   下の `services` 配列にオブジェクトを1つ追加するだけでよい。
//   HTML/CSSの変更は不要（カードは自動的に描画される）。
//
//   例:
//     services.push({
//       name: '新サービス名',
//       description: 'サービスの説明文',
//       url: './apps/new-service/',
//     });
// ============================================================

const USER_NAME_STORAGE_KEY = "betHall.userName";

const services = [
  {
    name: "賭け場",
    description:
      "ディーラーが出す2つのお題のタイム予想でポイントを賭け合うゲーム",
    url: "./apps/betting/",
  },
];

function initUserName() {
  const input = document.getElementById("user-name-input");
  const saveButton = document.getElementById("user-name-save");
  const status = document.getElementById("user-name-status");

  function render() {
    const savedName = localStorage.getItem(USER_NAME_STORAGE_KEY);
    if (savedName) {
      input.value = savedName;
      status.textContent = `現在の名前: ${savedName}（変更する場合は入力して保存し直してください）`;
    } else {
      status.textContent = "名前が未登録です";
    }
  }

  saveButton.addEventListener("click", () => {
    const name = input.value.trim();
    if (!name) {
      status.textContent = "名前を入力してください";
      return;
    }
    localStorage.setItem(USER_NAME_STORAGE_KEY, name);
    render();
  });

  render();
}

function renderServices() {
  const list = document.getElementById("service-list");
  list.innerHTML = services
    .map(
      (service) => `
        <a class="service-card" href="${service.url}">
          <h3>${service.name}</h3>
          <p>${service.description}</p>
        </a>
      `
    )
    .join("");
}

initUserName();
renderServices();
