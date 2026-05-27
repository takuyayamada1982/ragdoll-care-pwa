(() => {
  const STORAGE_KEY = "ragdoll-care-pwa-state-v1";
  const app = document.getElementById("app");

  const typeMeta = {
    meal: { label: "ごはん", icon: "bowl", tone: "teal" },
    water: { label: "水", icon: "droplet", tone: "blue" },
    toilet: { label: "トイレ", icon: "box", tone: "gold" },
    health: { label: "体調", icon: "heart", tone: "coral" },
    behavior: { label: "行動", icon: "spark", tone: "teal" },
    care: { label: "ケア", icon: "brush", tone: "blue" },
    weight: { label: "体重", icon: "scale", tone: "gold" },
    photo: { label: "写真", icon: "image", tone: "coral" }
  };

  const formConfig = {
    meal: {
      statuses: ["完食", "少し残した", "食べない", "食欲強め"],
      amountLabel: "カロリー",
      unit: "kcal",
      detailLabel: "フード",
      detailPlaceholder: "ドライ / ウェット / 商品名",
      tags: ["食欲安定", "残し気味", "食べるのが早い", "ゆっくり"]
    },
    water: {
      statuses: ["ふつう", "少なめ", "多め", "確認のみ"],
      amountLabel: "量",
      unit: "ml",
      detailLabel: "場所",
      detailPlaceholder: "給水器 / ボウル",
      tags: ["水分安定", "少なめ", "多め", "交換済み"]
    },
    toilet: {
      statuses: ["ふつう", "やわらかい", "硬め", "下痢気味", "気になる"],
      amountLabel: "回数",
      unit: "回",
      detailLabel: "種類",
      detailPlaceholder: "おしっこ / うんち",
      tags: ["おしっこ", "うんち", "砂交換", "様子見"]
    },
    health: {
      statuses: ["元気", "眠そう", "食欲なし", "嘔吐", "くしゃみ", "いつもと違う"],
      amountLabel: "回数",
      unit: "回",
      detailLabel: "気になるところ",
      detailPlaceholder: "目やに / 毛玉 / 咳など",
      tags: ["元気", "眠そう", "嘔吐", "くしゃみ", "目やに", "毛玉"]
    },
    behavior: {
      statuses: ["まったり", "よく遊んだ", "甘えた", "隠れていた", "落ち着かない"],
      amountLabel: "時間",
      unit: "分",
      detailLabel: "行動",
      detailPlaceholder: "遊び / 睡眠 / 甘えなど",
      tags: ["よく寝た", "遊んだ", "甘えた", "隠れた", "鳴き方"]
    },
    care: {
      statuses: ["完了", "少しだけ", "嫌がった", "次回にする"],
      amountLabel: "時間",
      unit: "分",
      detailLabel: "ケア",
      detailPlaceholder: "ブラッシング / 爪切り / 薬",
      tags: ["ブラッシング", "爪切り", "歯みがき", "薬", "通院", "毛玉"]
    },
    weight: {
      statuses: ["測定", "前回より増", "前回より減", "様子見"],
      amountLabel: "体重",
      unit: "kg",
      detailLabel: "測定方法",
      detailPlaceholder: "抱っこ測定 / ペット体重計",
      tags: ["安定", "増加", "減少", "測定"]
    },
    photo: {
      statuses: ["日常", "昼寝", "ごはん後", "ケア後", "気になる状態"],
      amountLabel: "枚数",
      unit: "枚",
      detailLabel: "場面",
      detailPlaceholder: "窓辺 / ソファ / ブラッシング後",
      tags: ["日常", "昼寝", "ケア後", "かわいい", "気になる"]
    }
  };

  let state = loadState();
  let currentView = "home";
  let recordType = "meal";
  let diaryDate = isoDate(new Date());
  let diaryFilter = "all";
  let albumFilter = "all";
  let pendingPhotos = [];
  let activeModalPhotoId = null;
  let toastTimer = null;
  let toastMessage = "";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  render();

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeState(JSON.parse(saved));
    } catch (error) {
      console.warn(error);
    }
    return createSeedState();
  }

  function normalizeState(nextState) {
    const seeded = createSeedState();
    const cats = Array.isArray(nextState.cats) ? nextState.cats : seeded.cats;
    const photos = Array.isArray(nextState.photos) ? nextState.photos : seeded.photos;
    return {
      ...seeded,
      ...nextState,
      family: { ...seeded.family, ...(nextState.family || {}) },
      members: Array.isArray(nextState.members) ? nextState.members : seeded.members,
      cats: cats.map((cat) => ({
        ...cat,
        avatar: cat.avatar === "assets/ragdoll-portrait.svg" ? "assets/cat-relax.svg" : cat.avatar
      })),
      logs: (Array.isArray(nextState.logs) ? nextState.logs : seeded.logs).map(migrateLogEntry),
      photos: photos.map((photo) => ({
        ...photo,
        src: migrateSampleArt(photo.src),
        thumb: migrateSampleArt(photo.thumb)
      }))
    };
  }

  function migrateSampleArt(src) {
    if (src === "assets/ragdoll-window.svg") return "assets/cat-sleep.svg";
    if (src === "assets/ragdoll-portrait.svg") return "assets/cat-care.svg";
    return src;
  }

  function migrateLogEntry(log) {
    if (!log || log.type !== "meal" || !log.values) return log;
    if (log.values.unit !== "g") return log;
    const amount = Number(log.values.amount);
    return {
      ...log,
      values: {
        ...log.values,
        amount: Number.isFinite(amount) ? Math.round(amount * 3.8) : log.values.amount,
        unit: "kcal"
      }
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      showToast("保存容量に近づいています。写真を減らすか、画質設定を下げてください。");
      return false;
    }
  }

  function createSeedState() {
    const catId = "cat-luna";
    const members = [
      { id: "member-a", name: "Aさん", passLabel: "個別PASS" },
      { id: "member-b", name: "Bさん", passLabel: "個別PASS" }
    ];
    const logs = [
      logSeed(catId, "member-a", "meal", daysAgo(0, 7, 42), { status: "完食", amount: 160, unit: "kcal", detail: "ドライ" }, ["食欲安定"], "朝はすぐ食べた"),
      logSeed(catId, "member-b", "water", daysAgo(0, 9, 120), { status: "ふつう", amount: 120, unit: "ml", detail: "給水器" }, ["水分安定"], ""),
      logSeed(catId, "member-a", "toilet", daysAgo(0, 10, 1), { status: "ふつう", amount: 1, unit: "回", detail: "うんち" }, ["うんち"], "状態はいつも通り"),
      logSeed(catId, "member-b", "behavior", daysAgo(0, 14, 35), { status: "まったり", amount: 35, unit: "分", detail: "窓辺で昼寝" }, ["よく寝た"], ""),
      logSeed(catId, "member-a", "care", daysAgo(1, 20, 15), { status: "完了", amount: 12, unit: "分", detail: "ブラッシング" }, ["ブラッシング", "毛玉"], "首周りに毛玉少し"),
      logSeed(catId, "member-a", "weight", daysAgo(2, 21, 0), { status: "測定", amount: 4.6, unit: "kg", detail: "抱っこ測定" }, ["安定"], ""),
      logSeed(catId, "member-b", "meal", daysAgo(2, 19, 35), { status: "少し残した", amount: 130, unit: "kcal", detail: "ウェット" }, ["残し気味"], "夜は少し残した"),
      logSeed(catId, "member-a", "toilet", daysAgo(3, 8, 50), { status: "ふつう", amount: 1, unit: "回", detail: "おしっこ" }, ["おしっこ"], ""),
      logSeed(catId, "member-b", "health", daysAgo(4, 22, 10), { status: "眠そう", amount: 0, unit: "回", detail: "目立つ異変なし" }, ["眠そう"], "")
    ];

    return {
      family: {
        id: "RAGDOLL-HOME",
        morningNotice: "08:00",
        eveningNotice: "21:00",
        imageQuality: 78,
        maxImageWidth: 1600
      },
      members,
      activeMemberId: members[0].id,
      cats: [
        {
          id: catId,
          name: "ルナ",
          breed: "ラグドール",
          coat: "ブルーポイントバイカラー",
          birthday: "2023-04-18",
          avatar: "assets/cat-relax.svg"
        }
      ],
      activeCatId: catId,
      logs,
      photos: [
        {
          id: "photo-window",
          catId,
          memberId: "member-b",
          dateTime: daysAgo(0, 14, 40),
          src: "assets/cat-sleep.svg",
          thumb: "assets/cat-sleep.svg",
          tags: ["昼寝", "日常"],
          note: "窓辺でまったり",
          linkedLogId: null,
          sizeLabel: "sample"
        },
        {
          id: "photo-portrait",
          catId,
          memberId: "member-a",
          dateTime: daysAgo(1, 20, 20),
          src: "assets/cat-care.svg",
          thumb: "assets/cat-care.svg",
          tags: ["ケア後"],
          note: "ブラッシング後",
          linkedLogId: null,
          sizeLabel: "sample"
        }
      ]
    };
  }

  function logSeed(catId, memberId, type, dateTime, values, tags, note) {
    return {
      id: `log-${type}-${dateTime.replace(/[-:T]/g, "")}`,
      catId,
      memberId,
      type,
      dateTime,
      values,
      tags,
      note
    };
  }

  function render() {
    const activeCat = getActiveCat();
    app.innerHTML = `
      <div class="phone-shell">
        ${renderTopbar(activeCat)}
        <main class="screen">${renderScreen(activeCat)}</main>
        ${renderBottomNav()}
        ${toastMessage ? `<div class="toast">${escapeHtml(toastMessage)}</div>` : ""}
        ${activeModalPhotoId ? renderPhotoModal(activeModalPhotoId) : ""}
      </div>
    `;
    bindEvents();
  }

  function renderTopbar(activeCat) {
    return `
      <header class="topbar">
        <div class="brand">
          <small>${escapeHtml(state.family.id)} / ${escapeHtml(activeCat.name)}</small>
          <h1>Ragdoll Care</h1>
        </div>
        <div class="top-actions">
          <button class="member-pill" type="button" data-action="switch-member" aria-label="記録者を切り替え">
            ${icon("user")}
            <span>${escapeHtml(getActiveMember().name)}</span>
          </button>
          <button class="icon-button" type="button" data-nav="settings" aria-label="設定">
            ${icon("settings")}
          </button>
        </div>
      </header>
    `;
  }

  function renderScreen(activeCat) {
    if (currentView === "record") return renderRecord(activeCat);
    if (currentView === "diary") return renderDiary(activeCat);
    if (currentView === "insights") return renderInsights(activeCat);
    if (currentView === "album") return renderAlbum(activeCat);
    if (currentView === "settings") return renderSettings(activeCat);
    return renderHome(activeCat);
  }

  function renderHome(activeCat) {
    const todayLogs = logsForDay(activeCat.id, isoDate(new Date()));
    const latestLogs = logsForCat(activeCat.id).slice(0, 4);
    const latestPhotos = photosForCat(activeCat.id).slice(0, 3);
    const mood = getMoodSummary(todayLogs);
    const metrics = getTodayMetrics(todayLogs);
    const moodArt = getMoodArt(mood.kind);

    return `
      <div class="stack">
        ${renderCatStrip()}
        <section class="hero">
          <div class="hero-copy">
            <p class="today-label">${formatFullDate(new Date())}</p>
            <h2>${escapeHtml(mood.title)}</h2>
          </div>
          <div class="state-bubble">${escapeHtml(mood.message)}</div>
          <img class="state-illustration" src="${escapeAttr(moodArt)}" alt="${escapeAttr(activeCat.name)}の状態イラスト">
          <div class="hero-cat-row">
            <img src="${escapeAttr(activeCat.avatar)}" alt="">
            <div>
              <strong>${escapeHtml(activeCat.name)}</strong>
              <span>${escapeHtml(activeCat.breed)} / ${escapeHtml(activeCat.coat)}</span>
            </div>
          </div>
          <p>${escapeHtml(mood.copy)}</p>
          <div class="status-row">
            ${mood.badges.map((badge) => `<span class="status-badge">${escapeHtml(badge)}</span>`).join("")}
          </div>
        </section>
        <section class="metric-grid">
          ${renderMetric("ごはん", metrics.meal.value, metrics.meal.detail)}
          ${renderMetric("水", metrics.water.value, metrics.water.detail)}
          ${renderMetric("トイレ", metrics.toilet.value, metrics.toilet.detail)}
          ${renderMetric("ケア", metrics.care.value, metrics.care.detail)}
        </section>
        <section class="reminder-row">
          <div class="reminder">
            <strong>朝 ${escapeHtml(state.family.morningNotice)}</strong>
            <span>ごはん、水、体調を軽く確認</span>
          </div>
          <div class="reminder">
            <strong>夜 ${escapeHtml(state.family.eveningNotice)}</strong>
            <span>トイレ、ケア、写真を確認</span>
          </div>
        </section>
        <section class="stack">
          <div class="section-heading">
            <h2>クイック記録</h2>
            <small>${escapeHtml(getActiveMember().name)}で記録</small>
          </div>
          <div class="quick-grid">
            ${Object.entries(typeMeta).map(([type, meta]) => `
              <button class="quick-button" type="button" data-quick="${type}" aria-label="${escapeAttr(meta.label)}を記録">
                ${icon(meta.icon)}
                <span>${escapeHtml(meta.label)}</span>
              </button>
            `).join("")}
          </div>
        </section>
        <section class="stack">
          <div class="section-heading">
            <h2>今日の流れ</h2>
            <button class="text-button" type="button" data-nav="diary">${icon("calendar")}日誌</button>
          </div>
          ${latestLogs.length ? `<div class="timeline">${latestLogs.map(renderLogItem).join("")}</div>` : renderEmpty("まだ記録がありません")}
        </section>
        <section class="stack">
          <div class="section-heading">
            <h2>最近の写真</h2>
            <button class="text-button" type="button" data-nav="album">${icon("image")}アルバム</button>
          </div>
          ${latestPhotos.length ? `<div class="photo-strip">${latestPhotos.map(renderSmallPhoto).join("")}</div>` : renderEmpty("写真を残すと日付ごとの状態が見えます")}
        </section>
      </div>
    `;
  }

  function renderRecord(activeCat) {
    const config = formConfig[recordType];
    return `
      <div class="stack">
        ${renderCatStrip()}
        <div class="section-heading">
          <h2>記録</h2>
          <small>${escapeHtml(typeMeta[recordType].label)}</small>
        </div>
        <div class="record-tabs">
          ${Object.entries(typeMeta).map(([type, meta]) => `
            <button class="chip ${type === recordType ? "is-active" : ""}" type="button" data-record-type="${type}">
              ${icon(meta.icon)}${escapeHtml(meta.label)}
            </button>
          `).join("")}
        </div>
        <form class="form-panel" id="recordForm">
          <div class="field-grid">
            <div class="field">
              <label for="recordDateTime">日時</label>
              <input id="recordDateTime" name="dateTime" type="datetime-local" value="${toLocalInputValue(new Date())}">
            </div>
            <div class="field">
              <label for="recordStatus">状態</label>
              <select id="recordStatus" name="status">
                ${config.statuses.map((status) => `<option value="${escapeAttr(status)}">${escapeHtml(status)}</option>`).join("")}
              </select>
            </div>
            <div class="two-col">
              <div class="field">
                <label for="recordAmount">${escapeHtml(config.amountLabel)}</label>
                <input id="recordAmount" name="amount" type="number" inputmode="decimal" step="0.1" placeholder="${escapeAttr(config.unit)}">
              </div>
              <div class="field">
                <label for="recordUnit">単位</label>
                <input id="recordUnit" name="unit" type="text" value="${escapeAttr(config.unit)}">
              </div>
            </div>
            <div class="field">
              <label for="recordDetail">${escapeHtml(config.detailLabel)}</label>
              <input id="recordDetail" name="detail" type="text" placeholder="${escapeAttr(config.detailPlaceholder)}">
            </div>
            <div class="field">
              <label>タグ</label>
              <div class="tag-picker">
                ${config.tags.map((tag) => `<button class="tag-button" type="button" data-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join("")}
              </div>
            </div>
            <div class="field">
              <label for="recordNote">メモ</label>
              <textarea id="recordNote" name="note" placeholder="いつもと違うこと、家族への共有など"></textarea>
            </div>
            <label class="upload-box" for="recordPhotoInput">
              ${icon("image")}
              <strong>写真を添付</strong>
              <span>長辺${state.family.maxImageWidth}px、画質${state.family.imageQuality}%で保存</span>
              <input id="recordPhotoInput" type="file" accept="image/*" multiple>
            </label>
            ${pendingPhotos.length ? `<div class="pending-grid">${pendingPhotos.map((photo) => `<img src="${photo.thumb}" alt="添付予定の写真">`).join("")}</div>` : ""}
          </div>
          <button class="primary-action" type="submit">${icon("plus")}保存</button>
        </form>
      </div>
    `;
  }

  function renderDiary(activeCat) {
    const dayLogs = logsForDay(activeCat.id, diaryDate)
      .filter((log) => diaryFilter === "all" || log.type === diaryFilter);
    return `
      <div class="stack">
        ${renderCatStrip()}
        <div class="section-heading">
          <h2>猫日誌</h2>
          <small>${escapeHtml(activeCat.name)}</small>
        </div>
        <div class="date-row">
          <input id="diaryDate" type="date" value="${escapeAttr(diaryDate)}" aria-label="日付">
          <button class="icon-button" type="button" data-action="today" aria-label="今日">${icon("calendar")}</button>
        </div>
        <div class="filter-row">
          <button class="chip ${diaryFilter === "all" ? "is-active" : ""}" type="button" data-diary-filter="all">すべて</button>
          ${Object.entries(typeMeta).map(([type, meta]) => `
            <button class="chip ${diaryFilter === type ? "is-active" : ""}" type="button" data-diary-filter="${type}">
              ${icon(meta.icon)}${escapeHtml(meta.label)}
            </button>
          `).join("")}
        </div>
        ${dayLogs.length ? `<div class="timeline">${dayLogs.map(renderLogItem).join("")}</div>` : renderEmpty("この日の記録はまだありません")}
      </div>
    `;
  }

  function renderInsights(activeCat) {
    const meal = weeklySeries(activeCat.id, "meal", "amount");
    const water = weeklySeries(activeCat.id, "water", "amount");
    const toilet = weeklySeries(activeCat.id, "toilet", "amount");
    const care = weeklySeries(activeCat.id, "care", "amount");
    const note = insightNote(activeCat.id);
    return `
      <div class="stack">
        ${renderCatStrip()}
        <div class="section-heading">
          <h2>変化</h2>
          <small>直近7日</small>
        </div>
        ${renderInsightCard("摂取カロリー", meal, "kcal", compareText(meal.values, "安定"))}
        ${renderInsightCard("水分", water, "ml", compareText(water.values, "確認中"))}
        ${renderInsightCard("トイレ", toilet, "回", compareText(toilet.values, "記録あり"))}
        ${renderInsightCard("ケア時間", care, "分", compareText(care.values, "少なめ"))}
        <div class="note-band">${escapeHtml(note)}</div>
      </div>
    `;
  }

  function renderAlbum(activeCat) {
    const photos = photosForCat(activeCat.id)
      .filter((photo) => albumFilter === "all" || photo.tags.includes(albumFilter));
    const allTags = unique(photosForCat(activeCat.id).flatMap((photo) => photo.tags)).slice(0, 8);
    return `
      <div class="stack">
        ${renderCatStrip()}
        <div class="section-heading">
          <h2>アルバム</h2>
          <small>${photosForCat(activeCat.id).length}枚</small>
        </div>
        <label class="upload-box" for="albumPhotoInput">
          ${icon("image")}
          <strong>写真を追加</strong>
          <span>圧縮して日付つきで保存</span>
          <input id="albumPhotoInput" type="file" accept="image/*" multiple>
        </label>
        <div class="filter-row">
          <button class="chip ${albumFilter === "all" ? "is-active" : ""}" type="button" data-album-filter="all">すべて</button>
          ${allTags.map((tag) => `<button class="chip ${albumFilter === tag ? "is-active" : ""}" type="button" data-album-filter="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join("")}
        </div>
        ${photos.length ? `<div class="album-grid">${photos.map(renderPhotoTile).join("")}</div>` : renderEmpty("条件に合う写真はありません")}
      </div>
    `;
  }

  function renderSettings(activeCat) {
    const storage = storageUsage();
    return `
      <div class="stack">
        ${renderCatStrip()}
        <div class="section-heading">
          <h2>設定</h2>
          <small>家族共有</small>
        </div>
        <div class="settings-list">
          <section class="setting-item">
            <header>
              <h3>ファミリーID</h3>
              <span class="mini-tag">${escapeHtml(state.family.id)}</span>
            </header>
            <div class="field">
              <label for="familyId">共有ID</label>
              <input id="familyId" type="text" value="${escapeAttr(state.family.id)}">
            </div>
          </section>
          <section class="setting-item">
            <header>
              <h3>メンバー</h3>
              <span class="mini-tag">${state.members.length}人</span>
            </header>
            ${state.members.map((member) => `
              <div class="field">
                <label for="member-${escapeAttr(member.id)}">${escapeHtml(member.passLabel)}</label>
                <input id="member-${escapeAttr(member.id)}" data-member-name="${escapeAttr(member.id)}" type="text" value="${escapeAttr(member.name)}">
              </div>
            `).join("")}
          </section>
          <section class="setting-item">
            <header>
              <h3>通知</h3>
              <span class="mini-tag">1日2回</span>
            </header>
            <div class="two-col">
              <div class="field">
                <label for="morningNotice">朝</label>
                <input id="morningNotice" type="time" value="${escapeAttr(state.family.morningNotice)}">
              </div>
              <div class="field">
                <label for="eveningNotice">夜</label>
                <input id="eveningNotice" type="time" value="${escapeAttr(state.family.eveningNotice)}">
              </div>
            </div>
          </section>
          <section class="setting-item">
            <header>
              <h3>写真保存</h3>
              <span class="mini-tag">${storage.label}</span>
            </header>
            <div class="storage-meter">
              <div class="meter-track"><div class="meter-fill" style="width:${storage.percent}%"></div></div>
              <p>長辺${state.family.maxImageWidth}px、画質${state.family.imageQuality}%で保存中</p>
            </div>
            <div class="field">
              <label for="imageQuality">画質</label>
              <input id="imageQuality" type="range" min="55" max="88" step="1" value="${state.family.imageQuality}">
            </div>
          </section>
          <section class="setting-item">
            <header>
              <h3>猫プロフィール</h3>
              <span class="mini-tag">${state.cats.length}匹</span>
            </header>
            <div class="cat-editor-list">
              ${state.cats.map((cat) => `
                <div class="cat-editor ${cat.id === state.activeCatId ? "is-active" : ""}">
                  <div class="cat-editor-head">
                    <img src="${escapeAttr(cat.avatar)}" alt="">
                    <div>
                      <strong>${escapeHtml(cat.name)}</strong>
                      <span>${escapeHtml(cat.breed || "猫")} / ${escapeHtml(cat.coat || "未設定")}</span>
                    </div>
                    <button class="text-button" type="button" data-cat="${escapeAttr(cat.id)}">${cat.id === state.activeCatId ? "表示中" : "表示"}</button>
                  </div>
                  <div class="field">
                    <label for="cat-name-${escapeAttr(cat.id)}">猫の名前</label>
                    <input id="cat-name-${escapeAttr(cat.id)}" data-cat-field="name" data-cat-id="${escapeAttr(cat.id)}" type="text" value="${escapeAttr(cat.name)}" placeholder="例: ルナ">
                  </div>
                  <div class="two-col">
                    <div class="field">
                      <label for="cat-breed-${escapeAttr(cat.id)}">種類</label>
                      <input id="cat-breed-${escapeAttr(cat.id)}" data-cat-field="breed" data-cat-id="${escapeAttr(cat.id)}" type="text" value="${escapeAttr(cat.breed || "")}" placeholder="ラグドール">
                    </div>
                    <div class="field">
                      <label for="cat-birthday-${escapeAttr(cat.id)}">誕生日</label>
                      <input id="cat-birthday-${escapeAttr(cat.id)}" data-cat-field="birthday" data-cat-id="${escapeAttr(cat.id)}" type="date" value="${escapeAttr(cat.birthday || "")}">
                    </div>
                  </div>
                  <div class="field">
                    <label for="cat-coat-${escapeAttr(cat.id)}">毛色・特徴</label>
                    <input id="cat-coat-${escapeAttr(cat.id)}" data-cat-field="coat" data-cat-id="${escapeAttr(cat.id)}" type="text" value="${escapeAttr(cat.coat || "")}" placeholder="ブルーポイントバイカラー">
                  </div>
                </div>
              `).join("")}
            </div>
            <button class="secondary-action" type="button" data-action="add-demo-cat">${icon("plus")}猫を追加</button>
          </section>
          <button class="secondary-action" type="button" data-action="reset-demo">${icon("refresh")}サンプルへ戻す</button>
        </div>
      </div>
    `;
  }

  function renderBottomNav() {
    const items = [
      ["home", "ホーム", "home"],
      ["record", "記録", "plus"],
      ["diary", "日誌", "calendar"],
      ["insights", "変化", "chart"],
      ["album", "写真", "image"]
    ];
    return `
      <nav class="bottom-nav" aria-label="メイン">
        ${items.map(([view, label, iconName]) => `
          <button class="nav-button ${currentView === view ? "is-active" : ""}" type="button" data-nav="${view}" aria-label="${escapeAttr(label)}">
            ${icon(iconName)}
            <span>${escapeHtml(label)}</span>
          </button>
        `).join("")}
      </nav>
    `;
  }

  function renderCatStrip() {
    return `
      <div class="cat-strip" aria-label="猫を切り替え">
        ${state.cats.map((cat) => `
          <button class="cat-pill ${cat.id === state.activeCatId ? "is-active" : ""}" type="button" data-cat="${escapeAttr(cat.id)}">
            <img class="cat-avatar" src="${escapeAttr(cat.avatar)}" alt="">
            <span>${escapeHtml(cat.name)}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderMetric(label, value, detail) {
    return `
      <div class="metric">
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
    `;
  }

  function renderLogItem(log) {
    const meta = typeMeta[log.type] || typeMeta.health;
    return `
      <article class="log-item">
        <div class="log-icon">${icon(meta.icon)}</div>
        <div class="log-body">
          <div class="log-main">
            <strong>${escapeHtml(composeSummary(log))}</strong>
            <time>${escapeHtml(formatTime(log.dateTime))}</time>
          </div>
          <p>${escapeHtml(meta.label)} / ${escapeHtml(memberName(log.memberId))}${log.note ? ` / ${escapeHtml(log.note)}` : ""}</p>
          ${log.tags && log.tags.length ? `<div class="tag-row">${log.tags.map((tag) => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </div>
      </article>
    `;
  }

  function renderSmallPhoto(photo) {
    return `
      <button class="photo-card" type="button" data-photo="${escapeAttr(photo.id)}" aria-label="写真を開く">
        <img src="${escapeAttr(photo.thumb)}" alt="${escapeAttr(photo.note || "猫の写真")}">
        <span class="photo-caption">${escapeHtml(shortDate(photo.dateTime))}</span>
      </button>
    `;
  }

  function renderPhotoTile(photo) {
    return `
      <button class="photo-tile" type="button" data-photo="${escapeAttr(photo.id)}">
        <img src="${escapeAttr(photo.thumb)}" alt="${escapeAttr(photo.note || "猫の写真")}">
        <span class="photo-caption">${escapeHtml(shortDate(photo.dateTime))}<br>${escapeHtml(photo.note || photo.tags.join(" / "))}</span>
      </button>
    `;
  }

  function renderPhotoModal(photoId) {
    const photo = state.photos.find((item) => item.id === photoId);
    if (!photo) return "";
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="photo-modal" role="dialog" aria-modal="true" aria-label="写真詳細">
          <img src="${escapeAttr(photo.src)}" alt="${escapeAttr(photo.note || "猫の写真")}">
          <div class="modal-content">
            <h3>${escapeHtml(formatFullDate(new Date(photo.dateTime)))}</h3>
            <p>${escapeHtml(photo.note || "日常の写真")}</p>
            <div class="tag-row">${photo.tags.map((tag) => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join("")}</div>
            <button class="primary-action" type="button" data-action="close-modal">${icon("check")}閉じる</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderInsightCard(title, series, unit, deltaText) {
    const max = Math.max(1, ...series.values);
    return `
      <section class="insight-card">
        <div class="insight-head">
          <strong>${escapeHtml(title)}</strong>
          <span class="delta">${escapeHtml(deltaText)}</span>
        </div>
        <div class="bars">
          ${series.values.map((value, index) => `
            <div class="bar-wrap">
              <div class="bar" style="height:${Math.max(8, (value / max) * 92)}px" title="${value}${unit}"></div>
              <span class="bar-label">${escapeHtml(series.labels[index])}</span>
            </div>
          `).join("")}
        </div>
        <p class="today-label">合計 ${series.values.reduce((sum, value) => sum + value, 0).toFixed(unit === "kg" ? 1 : 0)}${escapeHtml(unit)}</p>
      </section>
    `;
  }

  function renderEmpty(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function bindEvents() {
    app.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        currentView = button.dataset.nav;
        render();
      });
    });

    app.querySelectorAll("[data-cat]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeCatId = button.dataset.cat;
        saveState();
        render();
      });
    });

    app.querySelectorAll("[data-quick]").forEach((button) => {
      button.addEventListener("click", () => {
        recordType = button.dataset.quick;
        currentView = "record";
        render();
      });
    });

    app.querySelectorAll("[data-record-type]").forEach((button) => {
      button.addEventListener("click", () => {
        recordType = button.dataset.recordType;
        pendingPhotos = [];
        render();
      });
    });

    app.querySelectorAll("[data-tag]").forEach((button) => {
      button.addEventListener("click", () => {
        button.classList.toggle("is-active");
      });
    });

    app.querySelectorAll("[data-photo]").forEach((button) => {
      button.addEventListener("click", () => {
        activeModalPhotoId = button.dataset.photo;
        render();
      });
    });

    const recordForm = app.querySelector("#recordForm");
    if (recordForm) {
      recordForm.addEventListener("submit", onSubmitRecord);
    }

    const recordPhotoInput = app.querySelector("#recordPhotoInput");
    if (recordPhotoInput) {
      recordPhotoInput.addEventListener("change", (event) => handlePhotoFiles(event.target.files, true));
    }

    const albumPhotoInput = app.querySelector("#albumPhotoInput");
    if (albumPhotoInput) {
      albumPhotoInput.addEventListener("change", (event) => handleAlbumPhotos(event.target.files));
    }

    const diaryDateInput = app.querySelector("#diaryDate");
    if (diaryDateInput) {
      diaryDateInput.addEventListener("change", () => {
        diaryDate = diaryDateInput.value || isoDate(new Date());
        render();
      });
    }

    app.querySelectorAll("[data-diary-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        diaryFilter = button.dataset.diaryFilter;
        render();
      });
    });

    app.querySelectorAll("[data-album-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        albumFilter = button.dataset.albumFilter;
        render();
      });
    });

    app.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", (event) => {
        const action = element.dataset.action;
        if (action === "switch-member") switchMember();
        if (action === "today") {
          diaryDate = isoDate(new Date());
          render();
        }
        if (action === "close-modal") {
          event.stopPropagation();
          activeModalPhotoId = null;
          render();
        }
        if (action === "add-demo-cat") addDemoCat();
        if (action === "reset-demo") resetDemo();
      });
    });

    bindSettingsInputs();
  }

  function bindSettingsInputs() {
    const familyId = app.querySelector("#familyId");
    if (familyId) {
      familyId.addEventListener("change", () => {
        state.family.id = familyId.value.trim() || "RAGDOLL-HOME";
        saveState();
        render();
      });
    }

    const morning = app.querySelector("#morningNotice");
    const evening = app.querySelector("#eveningNotice");
    if (morning) {
      morning.addEventListener("change", () => {
        state.family.morningNotice = morning.value || "08:00";
        saveState();
        render();
      });
    }
    if (evening) {
      evening.addEventListener("change", () => {
        state.family.eveningNotice = evening.value || "21:00";
        saveState();
        render();
      });
    }

    app.querySelectorAll("[data-member-name]").forEach((input) => {
      input.addEventListener("change", () => {
        const member = state.members.find((item) => item.id === input.dataset.memberName);
        if (member) member.name = input.value.trim() || member.name;
        saveState();
        render();
      });
    });

    app.querySelectorAll("[data-cat-field]").forEach((input) => {
      const updateCat = (shouldRender) => {
        const cat = state.cats.find((item) => item.id === input.dataset.catId);
        if (!cat) return;
        const field = input.dataset.catField;
        const value = input.value.trim();
        if (field === "name") {
          cat.name = value || cat.name || "名前未設定";
        } else if (["breed", "coat", "birthday"].includes(field)) {
          cat[field] = value;
        }
        saveState();
        if (shouldRender) render();
      };
      input.addEventListener("input", () => updateCat(false));
      input.addEventListener("change", () => updateCat(true));
    });

    const quality = app.querySelector("#imageQuality");
    if (quality) {
      quality.addEventListener("change", () => {
        state.family.imageQuality = Number(quality.value);
        saveState();
        render();
      });
    }
  }

  function onSubmitRecord(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const dateTime = fromLocalInputValue(formData.get("dateTime")) || new Date().toISOString();
    const amountRaw = String(formData.get("amount") || "").trim();
    const tags = Array.from(app.querySelectorAll(".tag-button.is-active")).map((button) => button.dataset.tag);
    const log = {
      id: createId("log"),
      catId: state.activeCatId,
      memberId: state.activeMemberId,
      type: recordType,
      dateTime,
      values: {
        status: String(formData.get("status") || ""),
        amount: amountRaw === "" ? null : Number(amountRaw),
        unit: String(formData.get("unit") || formConfig[recordType].unit),
        detail: String(formData.get("detail") || "")
      },
      tags,
      note: String(formData.get("note") || "").trim()
    };

    state.logs.push(log);
    pendingPhotos.forEach((photo) => {
      state.photos.push({
        ...photo,
        id: createId("photo"),
        catId: state.activeCatId,
        memberId: state.activeMemberId,
        dateTime,
        tags: tags.length ? tags : [typeMeta[recordType].label],
        note: log.note || composeSummary(log),
        linkedLogId: log.id
      });
    });

    state.logs.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    state.photos.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    pendingPhotos = [];
    if (saveState()) showToast(`${typeMeta[recordType].label}を保存しました`);
    render();
  }

  async function handlePhotoFiles(files, rerenderAfter) {
    if (!files || !files.length) return;
    const fileList = Array.from(files).slice(0, 6);
    showToast("写真を圧縮しています");
    const compressed = [];
    for (const file of fileList) {
      try {
        compressed.push(await compressImage(file));
      } catch (error) {
        console.warn(error);
      }
    }
    pendingPhotos = pendingPhotos.concat(compressed);
    showToast(`${compressed.length}枚を添付しました`);
    if (rerenderAfter) render();
  }

  async function handleAlbumPhotos(files) {
    if (!files || !files.length) return;
    showToast("写真を圧縮しています");
    const fileList = Array.from(files).slice(0, 12);
    const dateTime = new Date().toISOString();
    const photos = [];
    for (const file of fileList) {
      try {
        const compressed = await compressImage(file);
        photos.push({
          ...compressed,
          id: createId("photo"),
          catId: state.activeCatId,
          memberId: state.activeMemberId,
          dateTime,
          tags: ["日常"],
          note: "日常の写真",
          linkedLogId: null
        });
      } catch (error) {
        console.warn(error);
      }
    }
    state.photos.push(...photos);
    state.photos.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    if (saveState()) showToast(`${photos.length}枚をアルバムに追加しました`);
    render();
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const main = drawImage(img, state.family.maxImageWidth, state.family.imageQuality / 100);
          const thumb = drawImage(img, 520, 0.72);
          resolve({
            src: main.dataUrl,
            thumb: thumb.dataUrl,
            sizeLabel: `${Math.round(main.bytes / 1024)}KB`
          });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function drawImage(img, maxWidth, quality) {
    const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, bytes: Math.round((dataUrl.length * 3) / 4) };
  }

  function switchMember() {
    const index = state.members.findIndex((member) => member.id === state.activeMemberId);
    const next = state.members[(index + 1) % state.members.length];
    state.activeMemberId = next.id;
    saveState();
    showToast(`${next.name}で記録します`);
    render();
  }

  function addDemoCat() {
    const count = state.cats.length + 1;
    const cat = {
      id: createId("cat"),
      name: `猫${count}`,
      breed: "ラグドール",
      coat: "未設定",
      birthday: "",
      avatar: "assets/cat-relax.svg"
    };
    state.cats.push(cat);
    state.activeCatId = cat.id;
    saveState();
    showToast("猫プロフィールを追加しました");
    render();
  }

  function resetDemo() {
    state = createSeedState();
    currentView = "home";
    recordType = "meal";
    diaryDate = isoDate(new Date());
    albumFilter = "all";
    diaryFilter = "all";
    pendingPhotos = [];
    saveState();
    showToast("サンプル状態に戻しました");
    render();
  }

  function showToast(message) {
    toastMessage = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastMessage = "";
      render();
    }, 2400);
  }

  function getActiveCat() {
    return state.cats.find((cat) => cat.id === state.activeCatId) || state.cats[0];
  }

  function getActiveMember() {
    return state.members.find((member) => member.id === state.activeMemberId) || state.members[0];
  }

  function memberName(memberId) {
    return (state.members.find((member) => member.id === memberId) || {}).name || "家族";
  }

  function logsForCat(catId) {
    return state.logs
      .filter((log) => log.catId === catId)
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
  }

  function photosForCat(catId) {
    return state.photos
      .filter((photo) => photo.catId === catId)
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
  }

  function logsForDay(catId, date) {
    return logsForCat(catId).filter((log) => isoDate(new Date(log.dateTime)) === date);
  }

  function getTodayMetrics(logs) {
    const sum = (type) => logs
      .filter((log) => log.type === type)
      .reduce((total, log) => total + (Number(log.values.amount) || 0), 0);
    const count = (type) => logs.filter((log) => log.type === type).length;
    return {
      meal: { value: sum("meal") ? `${Math.round(sum("meal"))}kcal` : `${count("meal")}件`, detail: count("meal") ? "記録あり" : "未記録" },
      water: { value: sum("water") ? `${sum("water")}ml` : `${count("water")}件`, detail: count("water") ? "確認済み" : "未記録" },
      toilet: { value: `${count("toilet")}件`, detail: count("toilet") ? "状態を確認" : "未記録" },
      care: { value: `${count("care")}件`, detail: count("care") ? "ケア済み" : "次回確認" }
    };
  }

  function getMoodSummary(logs) {
    const tags = logs.flatMap((log) => log.tags || []);
    if (tags.includes("嘔吐") || tags.includes("くしゃみ") || tags.includes("目やに")) {
      return {
        kind: "alert",
        title: "ちょっと気になる",
        message: "いつもと違うかも",
        copy: "体調タグが入っています。写真とメモを残して、夜にもう一度見ましょう。",
        badges: ["体調確認", `${logs.length}件`]
      };
    }
    if (tags.includes("ブラッシング") || tags.includes("毛玉")) {
      return {
        kind: "care",
        title: "ケアできた日",
        message: "ふわふわに整いました",
        copy: "長毛種らしいケアログが残っています。毛玉や抜け毛の変化も追いやすくなります。",
        badges: ["ケア", "長毛"]
      };
    }
    if (logs.length >= 4) {
      return {
        kind: "sleep",
        title: "まったり安定",
        message: "くつろいでいます",
        copy: "ごはん、水、トイレの記録がそろっています。今日の流れが見やすい状態です。",
        badges: ["安定", "記録充実"]
      };
    }
    return {
      kind: "relax",
      title: "今日の様子",
      message: "のんびり観察中",
      copy: "短いメモや写真だけでも、あとから変化を見つける手がかりになります。",
      badges: ["日常", `${logs.length}件`]
    };
  }

  function getMoodArt(kind) {
    const art = {
      alert: "assets/cat-alert.svg",
      care: "assets/cat-care.svg",
      sleep: "assets/cat-sleep.svg",
      relax: "assets/cat-relax.svg"
    };
    return art[kind] || art.relax;
  }

  function weeklySeries(catId, type, field) {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    return {
      labels: days.map((day) => `${day.getMonth() + 1}/${day.getDate()}`),
      values: days.map((day) => {
        const date = isoDate(day);
        return logsForDay(catId, date)
          .filter((log) => log.type === type)
          .reduce((sum, log) => sum + (Number(log.values[field]) || (type === "toilet" ? 1 : 0)), 0);
      })
    };
  }

  function compareText(values, fallback) {
    const recent = values.slice(-3).reduce((sum, value) => sum + value, 0);
    const before = values.slice(0, 4).reduce((sum, value) => sum + value, 0);
    if (recent === 0 && before === 0) return fallback;
    if (recent > before * 0.9) return "多め";
    if (recent < before * 0.45) return "少なめ";
    return "安定";
  }

  function insightNote(catId) {
    const logs = logsForCat(catId);
    const lastCare = logs.find((log) => log.type === "care");
    const healthTags = logs.slice(0, 10).flatMap((log) => log.tags || []).filter((tag) => ["嘔吐", "くしゃみ", "目やに", "毛玉"].includes(tag));
    if (healthTags.length) {
      return `最近の気になるタグは「${healthTags[0]}」。写真とメモを一緒に残すと、受診時にも説明しやすくなります。`;
    }
    if (!lastCare || daysBetween(new Date(lastCare.dateTime), new Date()) >= 3) {
      return "ブラッシングの間隔が少し空いています。ラグドールは毛玉ログを残すと変化が見えやすくなります。";
    }
    return "ごはん、トイレ、ケアがバランスよく記録されています。この調子で短いログを積み上げましょう。";
  }

  function composeSummary(log) {
    const meta = typeMeta[log.type] || typeMeta.health;
    const values = log.values || {};
    const amount = values.amount || values.amount === 0 ? `${values.amount}${values.unit || ""}` : "";
    const detail = values.detail ? ` / ${values.detail}` : "";
    const status = values.status ? values.status : meta.label;
    return `${meta.label}: ${status}${amount ? ` ${amount}` : ""}${detail}`;
  }

  function storageUsage() {
    const raw = JSON.stringify(state);
    const kb = Math.round(raw.length / 1024);
    const percent = Math.min(100, Math.round((kb / 4500) * 100));
    return { kb, percent, label: `${kb}KB` };
  }

  function icon(name) {
    const paths = {
      bowl: ["M4 12h16", "M6 12c0 5 3 8 6 8s6-3 6-8", "M8 8c1-2 7-2 8 0"],
      droplet: ["M12 2s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12z"],
      box: ["M4 10h16l-2 10H6L4 10z", "M8 10V6h8v4", "M9 14h6"],
      heart: ["M20.8 8.6c0 5.4-8.8 10.4-8.8 10.4S3.2 14 3.2 8.6A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.6z"],
      spark: ["M12 2v7", "M12 15v7", "M2 12h7", "M15 12h7", "M5 5l5 5", "M14 14l5 5", "M19 5l-5 5", "M10 14l-5 5"],
      brush: ["M4 20h7", "M8 20v-5", "M7 15h4l9-9a2 2 0 0 0-3-3l-9 9v3z"],
      scale: ["M6 6h12", "M8 6l-3 7h6L8 6z", "M16 6l-3 7h6l-3-7z", "M12 6v14", "M8 20h8"],
      image: ["M4 5h16v14H4z", "M8 13l3-3 7 7", "M14 14l2-2 4 4", "M8 9h.01"],
      user: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"],
      settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9.3l-.2.1a1.7 1.7 0 0 0-.5 1.8V23h-4v-.5a1.7 1.7 0 0 0-.5-1.8l-.2-.1a1.7 1.7 0 0 0-1.9-.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15v-.2a1.7 1.7 0 0 0-1.4-1.2H3V10h.2a1.7 1.7 0 0 0 1.4-1.2v-.2a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9-.3l.2-.1A1.7 1.7 0 0 0 10.8 1h2.4a1.7 1.7 0 0 0 .5 1.8l.2.1a1.7 1.7 0 0 0 1.9.3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9v.2A1.7 1.7 0 0 0 20.8 10h.2v3.6h-.2a1.7 1.7 0 0 0-1.4 1.2v.2z"],
      home: ["M3 11 12 3l9 8", "M5 10v10h14V10", "M9 20v-6h6v6"],
      plus: ["M12 5v14", "M5 12h14"],
      calendar: ["M8 2v4", "M16 2v4", "M3 9h18", "M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z"],
      chart: ["M4 19V5", "M4 19h16", "M8 15l3-4 3 2 4-7"],
      check: ["M20 6 9 17l-5-5"],
      refresh: ["M20 12a8 8 0 1 1-2.3-5.7", "M20 4v6h-6"]
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${(paths[name] || paths.spark).map((path) => `<path d="${path}"></path>`).join("")}</svg>`;
  }

  function unique(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function daysAgo(days, hour, minute) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  }

  function daysBetween(a, b) {
    return Math.floor((startOfDay(b) - startOfDay(a)) / 86400000);
  }

  function startOfDay(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function isoDate(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function toLocalInputValue(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  function fromLocalInputValue(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }

  function shortDate(value) {
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(value));
  }

  function formatFullDate(value) {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short"
    }).format(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
