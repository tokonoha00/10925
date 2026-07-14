// アプリを追加・編集するときは、この配列だけを変更してください。
const apps = [
  {
    name: "UI Animation Gallery",
    description: "スマホUIのアニメーションを検索・比較し、CSSとHTMLを調整してコピーできるUI辞書です。",
    status: "released",
    category: "DESIGN TOOL",
    icon: "✦",
    accent: "#8cffc1",
    technologies: ["HTML", "CSS", "JavaScript"],
    url: "apps/ui-animation-gallery.html"
  },
  {
    name: "Mobile Prompt Bridge",
    description: "スマホのフリック入力や音声入力を使い、同じWi-Fi上のPCエディタへプロンプトを貼り付け・送信できる補助ツールです。",
    status: "released",
    category: "UTILITY",
    icon: "↗",
    accent: "#8bc6d9",
    technologies: ["Python", "HTML", "Windows"],
    url: "https://github.com/tokonoha00/Mobile-Prompt-Bridge"
  },
  {
    name: "Multi Image Canvas",
    description: "複数の参考画像を自由に配置し、作業中の画面へオーバーレイ表示できるWindows向け画像ビューアーです。",
    status: "released",
    category: "DESKTOP APP",
    icon: "▧",
    accent: "#c5b8e8",
    technologies: ["C#", ".NET 8", "WinForms"],
    url: "https://github.com/tokonoha00/Multi-image-canvas"
  },
  {
    name: "Line Boil Maker",
    description: "線画を読み込むだけで、手描きで描き直したように線が揺れる『ラインボイル』アニメを透過GIF・MP4・連番PNGで書き出せるツールです。",
    status: "released",
    category: "MATERIAL TOOL",
    icon: "✎",
    accent: "#7fb5ff",
    technologies: ["HTML", "Canvas", "JavaScript"],
    url: "apps/line-boil-maker/"
  },
  {
    name: "Idle Motion Maker",
    description: "立ち絵やマスコットのPNGに、浮遊・呼吸・ぷるぷる・跳ねなどの待機モーションを付けて完全ループ素材として書き出せるツールです。",
    status: "released",
    category: "MATERIAL TOOL",
    icon: "◍",
    accent: "#ff9f7f",
    technologies: ["HTML", "Canvas", "JavaScript"],
    url: "apps/idle-motion-maker/"
  },
  {
    name: "Manga FX Maker",
    description: "手描き風に揺れる集中線・流線・怒りマーク・汗などの漫符アニメを生成し、配信や動画編集用の透過素材として書き出せるツールです。",
    status: "released",
    category: "MATERIAL TOOL",
    icon: "※",
    accent: "#f28bd0",
    technologies: ["HTML", "Canvas", "JavaScript"],
    url: "apps/manga-fx-maker/"
  },
  {
    name: "Logo Shine Maker",
    description: "ロゴ・タイトル画像にキラッと光が走る／虹色に輝くループアニメを付けて、サムネや配信オーバーレイ用素材を書き出せるツールです。",
    status: "released",
    category: "MATERIAL TOOL",
    icon: "✧",
    accent: "#ffd75e",
    technologies: ["HTML", "Canvas", "JavaScript"],
    url: "apps/logo-shine-maker/"
  },
  {
    name: "Alarm App",
    description: "起床体験を分かりやすく整える、スマートフォン向けアラームアプリを開発しています。",
    status: "developing",
    category: "MOBILE APP",
    icon: "◷",
    accent: "#facc6b",
    technologies: ["Prototype", "Mobile UI"],
    url: ""
  },
  {
    name: "Next Project",
    description: "日常の小さな手間を減らす、新しいツールのアイデアを検討しています。",
    status: "planned",
    category: "IDEA",
    icon: "＋",
    accent: "#b6a3ff",
    technologies: ["Research", "Concept"],
    url: ""
  }
];

const statusLabels = {
  released: "公開中",
  developing: "開発中",
  planned: "構想中"
};

const appGrid = document.querySelector("#appGrid");
const searchInput = document.querySelector("#searchInput");
const resultCount = document.querySelector("#resultCount");
const emptyState = document.querySelector("#emptyState");
let activeFilter = "all";

function renderApps() {
  const query = searchInput.value.trim().toLowerCase().normalize("NFKC");
  const filtered = apps.filter(app => {
    const matchesStatus = activeFilter === "all" || app.status === activeFilter;
    const searchable = [app.name, app.description, app.category, ...app.technologies].join(" ").toLowerCase().normalize("NFKC");
    return matchesStatus && searchable.includes(query);
  });

  appGrid.innerHTML = filtered.map((app, index) => `
    <article class="app-card ${app.url ? "" : "no-link"}" data-index="${String(index + 1).padStart(2, "0")}" style="--card-accent:${app.accent}">
      <div class="card-top">
        <span class="status ${app.status}">${statusLabels[app.status]}</span>
        <span class="category">${app.category}</span>
      </div>
      <div class="app-icon" aria-hidden="true">${app.icon}</div>
      <h3>${app.name}</h3>
      <p class="app-description">${app.description}</p>
      <div class="tech-list">${app.technologies.map(technology => `<span>${technology}</span>`).join("")}</div>
      <div class="open-label">${app.url ? 'アプリを見る <span>↗</span>' : "準備中"}</div>
      ${app.url ? `<a class="card-link" href="${app.url}" ${app.url.startsWith("http") ? 'target="_blank" rel="noreferrer"' : ""} aria-label="${app.name}を開く"></a>` : ""}
    </article>
  `).join("");

  resultCount.textContent = `${filtered.length}件を表示`;
  emptyState.hidden = filtered.length !== 0;
}

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach(item => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    renderApps();
  });
});

searchInput.addEventListener("input", renderApps);
document.querySelector("#totalCount").textContent = apps.length;
document.querySelector("#releasedCount").textContent = apps.filter(app => app.status === "released").length;
document.querySelector("#developingCount").textContent = apps.filter(app => app.status === "developing").length;
document.querySelector("#year").textContent = new Date().getFullYear();
renderApps();
