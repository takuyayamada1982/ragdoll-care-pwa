(() => {
  const STORAGE_KEY = "ragdoll-care-pwa-state-v1";
  const ACTIVE_FAMILY_KEY = "ragdoll-care-active-family-id";
  const PENDING_INVITE_KEY = "ragdoll-care-pending-invite-v1";
  const SUPABASE_URL = "https://ghdsgyqbnhnegbeyeqlt.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_9uYUtgj-5PCT8BlYKY3zOw_WvkQvutp";
  const app = document.getElementById("app");
  const hadStoredState = hasStoredState();
  const supabaseClient = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
    : null;

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
  let activeEditLogId = null;
  let authMode = "choice";
  let toastTimer = null;
  let toastMessage = "";
  let setupErrorMessage = "";
  let authSession = null;
  let remote = {
    loading: Boolean(supabaseClient),
    ready: false,
    family: null,
    member: null,
    error: supabaseClient ? "" : "Supabaseライブラリを読み込めませんでした"
  };

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  render();
  initSupabase();
  loadHostedSharedData();

  function hasStoredState() {
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return false;
    }
  }

  async function initSupabase() {
    if (!supabaseClient) {
      remote.loading = false;
      render();
      return;
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      remote.error = error.message;
      remote.loading = false;
      render();
      return;
    }

    authSession = data.session;
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      authSession = session;
      if (session) {
        await joinPendingInvite();
        await loadRemoteData();
      } else {
        remote = { loading: false, ready: false, family: null, member: null, error: "" };
        render();
      }
    });

    if (authSession) {
      await joinPendingInvite();
      await loadRemoteData();
    } else {
      remote.loading = false;
      render();
    }
  }

  async function loadRemoteData() {
    if (!authSession) return;
    remote.loading = true;
    render();

    const { data: memberships, error: membershipError } = await supabaseClient
      .from("family_members")
      .select("id,family_id,display_name,role,created_at")
      .order("created_at", { ascending: true });

    if (membershipError) {
      remote = { loading: false, ready: false, family: null, member: null, error: membershipError.message };
      showToast(`家族データを読めません: ${membershipError.message}`);
      render();
      return;
    }

    if (!memberships || memberships.length === 0) {
      if (!getPendingInvite()) {
        const createdFamilyId = await createDefaultFamilyForCurrentUser();
        if (createdFamilyId) {
          setSavedActiveFamilyId(createdFamilyId);
          await loadRemoteData();
          return;
        }
      }
      remote = { loading: false, ready: false, family: null, member: null, error: "" };
      render();
      return;
    }

    const savedFamilyId = getSavedActiveFamilyId();
    const currentMembership = memberships.find((item) => item.family_id === savedFamilyId) || memberships[0];
    setSavedActiveFamilyId(currentMembership.family_id);

    const { data: family, error: familyError } = await supabaseClient
      .from("families")
      .select("id,name,invite_code,created_at")
      .eq("id", currentMembership.family_id)
      .single();

    const { data: allMembers, error: allMembersError } = await supabaseClient
      .from("family_members")
      .select("id,family_id,user_id,display_name,role,created_at")
      .eq("family_id", currentMembership.family_id)
      .order("created_at", { ascending: true });

    const { data: cats, error: catsError } = await supabaseClient
      .from("cats")
      .select("id,family_id,name,breed,coat,birthday,avatar_key,created_at,updated_at")
      .eq("family_id", currentMembership.family_id)
      .order("created_at", { ascending: true });

    const { data: logs, error: logsError } = await supabaseClient
      .from("logs")
      .select("id,family_id,cat_id,member_id,type,date_time,status,amount,unit,detail,tags,note,created_at,updated_at")
      .eq("family_id", currentMembership.family_id)
      .order("date_time", { ascending: false });

    const errors = [familyError, allMembersError, catsError, logsError].filter(Boolean);
    if (errors.length) {
      remote.loading = false;
      remote.error = errors[0].message;
      showToast(`Supabase読み込みエラー: ${errors[0].message}`);
      render();
      return;
    }

    const nextCats = (cats || []).map(catFromDb);
    const localPhotos = Array.isArray(state.photos) ? state.photos : [];
    state = normalizeState({
      ...state,
      family: {
        ...state.family,
        id: family.name || "RAGDOLL-HOME",
        supabaseId: family.id,
        inviteCode: family.invite_code
      },
      members: (allMembers || []).map(memberFromDb),
      activeMemberId: currentMembership.id,
      cats: nextCats.length ? nextCats : state.cats,
      activeCatId: nextCats.some((cat) => cat.id === state.activeCatId)
        ? state.activeCatId
        : (nextCats[0] && nextCats[0].id) || state.activeCatId,
      logs: (logs || []).map(logFromDb),
      photos: localPhotos
    });

    remote = {
      loading: false,
      ready: true,
      family,
      member: currentMembership,
      error: ""
    };
    saveState();
    render();
  }

  function getSavedActiveFamilyId() {
    try {
      return localStorage.getItem(ACTIVE_FAMILY_KEY);
    } catch (error) {
      return "";
    }
  }

  function setSavedActiveFamilyId(familyId) {
    try {
      localStorage.setItem(ACTIVE_FAMILY_KEY, familyId);
    } catch (error) {
      // optional cache only
    }
  }

  function normalizeInviteCode(code) {
    return String(code || "").trim().toUpperCase();
  }

  function displayNameFromEmail(email) {
    const localPart = String(email || "").split("@")[0].trim();
    return localPart || "家族";
  }

  function savePendingInvite(inviteCode, displayName) {
    try {
      localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({
        inviteCode: normalizeInviteCode(inviteCode),
        displayName: String(displayName || "").trim()
      }));
    } catch (error) {
      // optional cache only
    }
  }

  function getPendingInvite() {
    try {
      const saved = JSON.parse(localStorage.getItem(PENDING_INVITE_KEY) || "null");
      if (saved && saved.inviteCode) return saved;
    } catch (error) {
      // optional cache only
    }
    return null;
  }

  function clearPendingInvite() {
    try {
      localStorage.removeItem(PENDING_INVITE_KEY);
    } catch (error) {
      // optional cache only
    }
  }

  function isCloudReady() {
    return Boolean(supabaseClient && authSession && remote.ready && remote.family && remote.member);
  }

  function catFromDb(row) {
    return {
      id: row.id,
      name: row.name || "名前未設定",
      breed: row.breed || "ラグドール",
      coat: row.coat || "",
      birthday: row.birthday || "",
      avatar: avatarFromKey(row.avatar_key)
    };
  }

  function memberFromDb(row) {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.display_name || (row.role === "owner" ? "オーナー" : "家族"),
      passLabel: row.role === "owner" ? "オーナー" : "個別PASS"
    };
  }

  function logFromDb(row) {
    return {
      id: row.id,
      familyId: row.family_id,
      catId: row.cat_id,
      memberId: row.member_id,
      type: row.type,
      dateTime: row.date_time,
      values: {
        status: row.status || "",
        amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
        unit: row.unit || "",
        detail: row.detail || ""
      },
      tags: Array.isArray(row.tags) ? row.tags : [],
      note: row.note || ""
    };
  }

  function avatarFromKey(key) {
    const map = {
      "cat-alert": "assets/cat-alert.svg",
      "cat-care": "assets/cat-care.svg",
      "cat-relax": "assets/cat-relax.svg",
      "cat-sleep": "assets/cat-sleep.svg"
    };
    return map[key] || "assets/cat-relax.svg";
  }

  function avatarKeyFromPath(path) {
    if (String(path).includes("cat-alert")) return "cat-alert";
    if (String(path).includes("cat-care")) return "cat-care";
    if (String(path).includes("cat-sleep")) return "cat-sleep";
    return "cat-relax";
  }

  function dbPayloadFromLog(log) {
    return {
      family_id: remote.family.id,
      cat_id: log.catId,
      member_id: log.memberId || remote.member.id,
      type: log.type,
      date_time: log.dateTime,
      status: log.values.status || "",
      amount: log.values.amount,
      unit: log.values.unit || "",
      detail: log.values.detail || "",
      tags: log.tags || [],
      note: log.note || ""
    };
  }

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
      logs: (Array.isArray(nextState.logs) ? nextState.logs : seeded.logs)
        .filter((log) => !isOldSampleLog(log))
        .map(migrateLogEntry),
      photos: photos.filter((photo) => !isOldSamplePhoto(photo)).map((photo) => ({
        ...photo,
        src: migrateSampleArt(photo.src),
        thumb: migrateSampleArt(photo.thumb)
      }))
    };
  }

  function isOldSampleLog(log) {
    if (!log || !log.values) return false;
    const oldNotes = ["朝はすぐ食べた", "状態はいつも通り", "首周りに毛玉少し", "夜は少し残した", "目立つ異変なし"];
    const oldDetails = ["ドライ", "給水器", "うんち", "窓辺で昼寝", "ブラッシング", "抱っこ測定", "ウェット", "おしっこ"];
    return (
      /^log-(meal|water|toilet|behavior|care|weight|health)-/.test(String(log.id || "")) &&
      (oldNotes.includes(log.note || "") || oldDetails.includes(log.values.detail || ""))
    );
  }

  function isOldSamplePhoto(photo) {
    return ["photo-window", "photo-portrait"].includes(photo && photo.id);
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
          name: "猫1",
          breed: "ラグドール",
          coat: "",
          birthday: "",
          avatar: "assets/cat-relax.svg"
        }
      ],
      activeCatId: catId,
      logs: [],
      photos: []
    };
  }

  function render() {
    const activeCat = getActiveCat();
    const showMainNav = Boolean(authSession && remote.ready);
    app.innerHTML = `
      <div class="phone-shell">
        ${renderTopbar(activeCat)}
        <main class="screen">${renderScreen(activeCat)}</main>
        ${showMainNav ? renderBottomNav() : ""}
        ${toastMessage ? `<div class="toast">${escapeHtml(toastMessage)}</div>` : ""}
        ${activeModalPhotoId ? renderPhotoModal(activeModalPhotoId) : ""}
        ${activeEditLogId ? renderEditLogModal(activeEditLogId) : ""}
      </div>
    `;
    bindEvents();
  }

  function renderTopbar(activeCat) {
    const showFamilyInfo = Boolean(authSession && remote.ready);
    const topbarLabel = showFamilyInfo
      ? `${state.family.id} / ${activeCat.name}`
      : authSession
        ? "家族設定 / ログイン済み"
        : "家族共有 / ログイン前";
    const memberLabel = showFamilyInfo
      ? getActiveMember().name
      : authSession
        ? "設定中"
        : "未ログイン";
    return `
      <header class="topbar">
        <div class="brand">
          <small>${escapeHtml(topbarLabel)}</small>
          <h1>Ragdoll Care</h1>
        </div>
        <div class="top-actions">
          <button class="member-pill" type="button" ${showFamilyInfo ? 'data-action="switch-member" aria-label="記録者を切り替え"' : "disabled"}>
            ${icon("user")}
            <span>${escapeHtml(memberLabel)}</span>
          </button>
          <button class="icon-button" type="button" data-nav="settings" aria-label="設定">
            ${icon("settings")}
          </button>
        </div>
      </header>
    `;
  }

  function renderScreen(activeCat) {
    if (!supabaseClient) return renderConnectionError();
    if (remote.loading) return renderLoadingScreen();
    if (!authSession) return renderAuthScreen();
    if (!remote.ready) return renderFamilySetup();
    if (currentView === "record") return renderRecord(activeCat);
    if (currentView === "diary") return renderDiary(activeCat);
    if (currentView === "insights") return renderInsights(activeCat);
    if (currentView === "album") return renderAlbum(activeCat);
    if (currentView === "settings") return renderSettings(activeCat);
    return renderHome(activeCat);
  }

  function renderConnectionError() {
    return `
      <div class="stack">
        <section class="form-panel">
          <div class="section-heading">
            <h2>接続できません</h2>
          </div>
          <p class="today-label">${escapeHtml(remote.error || "Supabaseの読み込みに失敗しました。")}</p>
        </section>
      </div>
    `;
  }

  function renderLoadingScreen() {
    return `
      <div class="stack">
        <section class="hero">
          <div class="hero-copy">
            <p class="today-label">Supabase</p>
            <h2>読み込み中</h2>
          </div>
          <div class="state-bubble">家族データを確認しています</div>
          <img class="state-illustration" src="assets/cat-relax.svg" alt="読み込み中">
        </section>
      </div>
    `;
  }

  function renderAuthScreen() {
    if (authMode === "signup") return renderSignupScreen();
    if (authMode === "login") return renderLoginScreen();
    return `
      <div class="stack">
        <section class="hero">
          <div class="hero-copy">
            <p class="today-label">Family Login</p>
            <h2>はじめる</h2>
          </div>
          <div class="state-bubble">家族で同じ記録を見られます</div>
          <img class="state-illustration" src="assets/cat-relax.svg" alt="ログイン">
          <p>新しく使う人は新規登録、登録済みの人はログインを選びます。</p>
        </section>
        <section class="form-panel">
          <button class="primary-action" type="button" data-auth-screen="signup">${icon("plus")}新規登録</button>
          <button class="secondary-action" type="button" data-auth-screen="login">${icon("check")}ログイン</button>
        </section>
      </div>
    `;
  }

  function renderSignupScreen() {
    return `
      <div class="stack">
        <section class="hero">
          <div class="hero-copy">
            <p class="today-label">Sign Up</p>
            <h2>新規登録</h2>
          </div>
          <div class="state-bubble">メールアドレスとパスワードを設定します</div>
          <img class="state-illustration" src="assets/cat-care.svg" alt="新規登録">
          <p>登録後はログイン画面に戻ります。確認メールが届いた場合は、メール内のリンクを押してからログインしてください。</p>
        </section>
        <form class="form-panel" id="authForm">
          <div class="field">
            <label for="authEmail">メールアドレス</label>
            <input id="authEmail" name="email" type="email" autocomplete="email" placeholder="name@example.com" required>
          </div>
          <div class="field">
            <label for="authPassword">パスワード</label>
            <input id="authPassword" name="password" type="password" autocomplete="new-password" minlength="6" required>
          </div>
          <button class="primary-action" type="button" data-auth-action="signup">${icon("plus")}登録する</button>
          <button class="text-button" type="button" data-auth-screen="choice">${icon("refresh")}戻る</button>
        </form>
      </div>
    `;
  }

  function renderLoginScreen() {
    return `
      <div class="stack">
        <section class="hero">
          <div class="hero-copy">
            <p class="today-label">Login</p>
            <h2>ログイン</h2>
          </div>
          <div class="state-bubble">登録済みのメールアドレスで入ります</div>
          <img class="state-illustration" src="assets/cat-relax.svg" alt="ログイン">
          <p>親メンバーからファミリーIDを受け取っている場合だけ、連携するIDに入力します。</p>
        </section>
        <form class="form-panel" id="authForm">
          <div class="field">
            <label for="authEmail">メールアドレス</label>
            <input id="authEmail" name="email" type="email" autocomplete="email" placeholder="name@example.com" required>
          </div>
          <div class="field">
            <label for="authPassword">パスワード</label>
            <input id="authPassword" name="password" type="password" autocomplete="current-password" minlength="6" required>
          </div>
          <div class="field">
            <label for="authInviteCode">連携するID（任意）</label>
            <input id="authInviteCode" name="inviteCode" type="text" inputmode="latin" autocomplete="off" placeholder="ファミリーID / 紹介コード">
          </div>
          <p class="form-note">入力したIDが発行済みの場合、このアカウントを同じ家族ページへ紐づけます。次回以降はメールアドレスとパスワードだけで入れます。</p>
          <button class="primary-action" type="button" data-auth-action="login">${icon("check")}ログインする</button>
          <button class="text-button" type="button" data-auth-screen="choice">${icon("refresh")}戻る</button>
        </form>
      </div>
    `;
  }

  function renderFamilySetup() {
    return `
      <div class="stack">
        <section class="hero">
          <div class="hero-copy">
            <p class="today-label">Family Setup</p>
            <h2>家族を設定</h2>
          </div>
          <div class="state-bubble">最初の家族グループを作ります</div>
          <img class="state-illustration" src="assets/cat-care.svg" alt="家族設定">
          <p>最初の人は家族を作成します。2人目以降は、ログイン時にファミリーIDを入力して参加します。</p>
        </section>
        <form class="form-panel" id="familySetupForm">
          <div class="field">
            <label for="setupDisplayName">あなたの表示名</label>
            <input id="setupDisplayName" name="displayName" type="text" placeholder="Aさん" value="${escapeAttr(authSession.user.user_metadata && authSession.user.user_metadata.display_name || "")}">
          </div>
          <div class="field">
            <label for="setupFamilyName">家族名</label>
            <input id="setupFamilyName" name="familyName" type="text" value="RAGDOLL-HOME">
          </div>
          <button class="primary-action" type="button" data-family-action="create">${icon("plus")}新しい家族を作る</button>
          ${setupErrorMessage ? `
            <div class="inline-error">
              <strong>ここで止まる原因</strong>
              <span>${escapeHtml(setupErrorMessage)}</span>
            </div>
          ` : ""}
          <div class="field">
            <label for="setupInviteCode">ファミリーID（紹介コード）</label>
            <input id="setupInviteCode" name="inviteCode" type="text" placeholder="例: A1B2C3D4">
          </div>
          <button class="secondary-action" type="button" data-family-action="join">${icon("check")}ファミリーIDで参加</button>
          <button class="text-button" type="button" data-action="logout">${icon("refresh")}ログアウト</button>
        </form>
      </div>
    `;
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
                <input id="recordAmount" name="amount" type="number" inputmode="decimal" step="0.1" placeholder="${escapeAttr(config.unit)}" onfocus="this.select()">
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
              <label for="familyId">家族名</label>
              <input id="familyId" type="text" value="${escapeAttr(state.family.id)}">
            </div>
            ${isCloudReady() ? `
              <p>ファミリーID（紹介コード）: <strong>${escapeHtml(state.family.inviteCode || "")}</strong></p>
              <p>2人目以降はログイン時に、このIDを「連携するID」へ入力します。</p>
              <button class="secondary-action" type="button" data-action="logout">${icon("refresh")}ログアウト</button>
            ` : ""}
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
          <section class="setting-item">
            <header>
              <h3>バックアップ</h3>
              <span class="mini-tag">${isCloudReady() ? "Supabase" : "写真なし"}</span>
            </header>
            <p>${isCloudReady() ? "通常の共有はSupabaseで行います。JSONは手元の控え用です。" : "猫、家族、記録だけを書き出します。写真データは含めません。"}</p>
            <button class="secondary-action" type="button" data-action="export-shared-data">${icon("download")}共有データをダウンロード</button>
            <label class="upload-box" for="sharedDataInput">
              ${icon("upload")}
              <strong>共有データを読み込み</strong>
              <span>別の端末やGitHubに保存したJSONを反映</span>
              <input id="sharedDataInput" type="file" accept="application/json,.json">
            </label>
          </section>
          <button class="secondary-action danger-action" type="button" data-action="reset-demo">${icon("refresh")}初期状態に戻す</button>
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
            <div class="log-actions">
              <time>${escapeHtml(formatTime(log.dateTime))}</time>
              <button class="text-button compact" type="button" data-edit-log="${escapeAttr(log.id)}">${icon("edit")}編集</button>
            </div>
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

  function renderEditLogModal(logId) {
    const log = state.logs.find((item) => item.id === logId);
    if (!log) return "";
    const meta = typeMeta[log.type] || typeMeta.health;
    const config = formConfig[log.type] || formConfig.health;
    const values = log.values || {};
    const selectedTags = log.tags || [];
    return `
      <div class="modal-backdrop" data-action="close-edit-log">
        <div class="edit-modal" role="dialog" aria-modal="true" aria-label="記録を編集">
          <form class="form-panel" id="editLogForm">
            <div class="section-heading">
              <h2>${escapeHtml(meta.label)}を編集</h2>
              <button class="icon-button" type="button" data-action="close-edit-log" aria-label="閉じる">${icon("check")}</button>
            </div>
            <div class="field">
              <label for="editDateTime">日時</label>
              <input id="editDateTime" name="dateTime" type="datetime-local" value="${escapeAttr(toLocalInputValue(new Date(log.dateTime)))}">
            </div>
            <div class="field">
              <label for="editStatus">状態</label>
              <select id="editStatus" name="status">
                ${config.statuses.map((status) => `<option value="${escapeAttr(status)}" ${status === values.status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
              </select>
            </div>
            <div class="two-col">
              <div class="field">
                <label for="editAmount">${escapeHtml(config.amountLabel)}</label>
                <input id="editAmount" name="amount" type="number" inputmode="decimal" step="0.1" value="${values.amount || values.amount === 0 ? escapeAttr(values.amount) : ""}" placeholder="${escapeAttr(config.unit)}" onfocus="this.select()">
              </div>
              <div class="field">
                <label for="editUnit">単位</label>
                <input id="editUnit" name="unit" type="text" value="${escapeAttr(values.unit || config.unit)}">
              </div>
            </div>
            <div class="field">
              <label for="editDetail">${escapeHtml(config.detailLabel)}</label>
              <input id="editDetail" name="detail" type="text" value="${escapeAttr(values.detail || "")}" placeholder="${escapeAttr(config.detailPlaceholder)}">
            </div>
            <div class="field">
              <label>タグ</label>
              <div class="tag-picker">
                ${config.tags.map((tag) => `<button class="tag-button ${selectedTags.includes(tag) ? "is-active" : ""}" type="button" data-edit-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join("")}
              </div>
            </div>
            <div class="field">
              <label for="editNote">メモ</label>
              <textarea id="editNote" name="note">${escapeHtml(log.note || "")}</textarea>
            </div>
            <button class="primary-action" type="submit">${icon("check")}変更を保存</button>
            <button class="secondary-action danger-action" type="button" data-action="delete-edit-log">${icon("trash")}この記録を削除</button>
          </form>
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

    app.querySelectorAll("[data-edit-tag]").forEach((button) => {
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

    app.querySelectorAll("[data-edit-log]").forEach((button) => {
      button.addEventListener("click", () => {
        activeEditLogId = button.dataset.editLog;
        render();
      });
    });

    const recordForm = app.querySelector("#recordForm");
    if (recordForm) {
      recordForm.addEventListener("submit", onSubmitRecord);
    }

    const editLogForm = app.querySelector("#editLogForm");
    if (editLogForm) {
      editLogForm.addEventListener("submit", onSubmitEditLog);
    }

    const recordPhotoInput = app.querySelector("#recordPhotoInput");
    if (recordPhotoInput) {
      recordPhotoInput.addEventListener("change", (event) => handlePhotoFiles(event.target.files, true));
    }

    const albumPhotoInput = app.querySelector("#albumPhotoInput");
    if (albumPhotoInput) {
      albumPhotoInput.addEventListener("change", (event) => handleAlbumPhotos(event.target.files));
    }

    const sharedDataInput = app.querySelector("#sharedDataInput");
    if (sharedDataInput) {
      sharedDataInput.addEventListener("change", (event) => handleSharedDataFile(event.target.files && event.target.files[0]));
    }

    app.querySelectorAll("[data-auth-action]").forEach((button) => {
      button.addEventListener("click", () => handleAuth(button.dataset.authAction));
    });

    app.querySelectorAll("[data-auth-screen]").forEach((button) => {
      button.addEventListener("click", () => {
        authMode = button.dataset.authScreen || "choice";
        render();
      });
    });

    app.querySelectorAll("[data-family-action]").forEach((button) => {
      button.addEventListener("click", () => handleFamilyAction(button.dataset.familyAction));
    });

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
        if (element.classList.contains("modal-backdrop") && event.target !== element) return;
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
        if (action === "close-edit-log") {
          event.stopPropagation();
          activeEditLogId = null;
          render();
        }
        if (action === "delete-edit-log") {
          event.stopPropagation();
          deleteActiveLog();
        }
        if (action === "add-demo-cat") addDemoCat();
        if (action === "reset-demo") resetDemo();
        if (action === "export-shared-data") exportSharedData();
        if (action === "logout") logout();
      });
    });

    bindSettingsInputs();
  }

  function bindSettingsInputs() {
    const familyId = app.querySelector("#familyId");
    if (familyId) {
      familyId.addEventListener("change", async () => {
        state.family.id = familyId.value.trim() || "RAGDOLL-HOME";
        if (isCloudReady()) {
          const { error } = await supabaseClient
            .from("families")
            .update({ name: state.family.id })
            .eq("id", remote.family.id);
          if (error) showToast(`家族名を保存できません: ${error.message}`);
        }
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
      input.addEventListener("change", async () => {
        updateCat(false);
        const cat = state.cats.find((item) => item.id === input.dataset.catId);
        if (cat) await updateRemoteCat(cat);
        render();
      });
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

  async function handleAuth(action) {
    const form = app.querySelector("#authForm");
    if (!form || !supabaseClient) return;
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const inviteCode = normalizeInviteCode(formData.get("inviteCode"));
    const fallbackName = displayNameFromEmail(email);

    if (!email || !password) {
      showToast("メールアドレスとパスワードを入力してください");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("メールアドレスの形式を確認してください");
      return;
    }
    if (password.length < 6) {
      showToast("パスワードは6文字以上にしてください");
      return;
    }

    remote.loading = true;
    render();

    if (action === "signup") {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          data: { display_name: fallbackName }
        }
      });
      remote.loading = false;
      if (error) {
        showToast(`アカウント作成エラー: ${error.message}`);
        render();
        return;
      }
      if (data.session) {
        await supabaseClient.auth.signOut();
        authSession = null;
      }
      authMode = "login";
      if (!data.session) {
        showToast("登録しました。確認メールが届いた場合はリンクを押してからログインしてください。");
        render();
        return;
      }
      showToast("登録しました。ログインしてください。");
      render();
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      remote.loading = false;
      showToast(`ログインエラー: ${error.message}`);
      render();
      return;
    }
    authSession = data.session;
    if (inviteCode) {
      const invite = await verifyInviteCode(inviteCode);
      if (!invite.ok) {
        remote.loading = false;
        showToast(invite.message);
        await supabaseClient.auth.signOut();
        authSession = null;
        authMode = "login";
        render();
        return;
      }
      savePendingInvite(inviteCode, fallbackName);
      const joined = await joinPendingInvite();
      if (!joined) {
        remote.loading = false;
        await supabaseClient.auth.signOut();
        authSession = null;
        authMode = "login";
        render();
        return;
      }
    }
    await loadRemoteData();
  }

  async function handleFamilyAction(action) {
    const form = app.querySelector("#familySetupForm");
    if (!form || !authSession) return;
    const formData = new FormData(form);
    const displayName = String(formData.get("displayName") || "").trim() || "家族";
    const familyName = String(formData.get("familyName") || "").trim() || "RAGDOLL-HOME";
    const inviteCode = String(formData.get("inviteCode") || "").trim();
    setupErrorMessage = "";

    remote.loading = true;
    render();

    if (action === "create") {
      const { data: rpcFamilyId, error: rpcError } = await supabaseClient
        .rpc("create_family_with_default_cat", {
          family_name: familyName,
          member_display_name: displayName
        });

      if (!rpcError && rpcFamilyId) {
        setSavedActiveFamilyId(rpcFamilyId);
        await loadRemoteData();
        showToast("家族を作成しました。設定からファミリーIDを確認できます");
        return;
      }

      console.warn("create_family_with_default_cat failed. Falling back to table insert.", rpcError);
      const { data: family, error: familyError } = await supabaseClient
        .from("families")
        .insert({ name: familyName, created_by: authSession.user.id })
        .select("id,name,invite_code")
        .single();

      if (familyError) {
        remote.loading = false;
        setupErrorMessage = getFamilySetupErrorMessage(rpcError, familyError);
        showToast("家族作成で止まりました。画面内の原因を確認してください");
        render();
        return;
      }

      await supabaseClient
        .from("family_members")
        .update({ display_name: displayName })
        .eq("family_id", family.id)
        .eq("user_id", authSession.user.id);

      const { error: catError } = await supabaseClient
        .from("cats")
        .insert({
          family_id: family.id,
          name: "猫1",
          breed: "ラグドール",
          coat: "",
          avatar_key: "cat-relax"
        });

      if (catError) {
        showToast(`猫プロフィール作成エラー: ${catError.message}`);
      }

      setSavedActiveFamilyId(family.id);
      await loadRemoteData();
      showToast(`家族を作成しました。ファミリーID: ${family.invite_code}`);
      return;
    }

    if (!inviteCode) {
      remote.loading = false;
      setupErrorMessage = "2人目以降として参加する場合は、1人目の設定画面に表示されるファミリーIDが必要です。";
      showToast("ファミリーIDを入力してください");
      render();
      return;
    }

    const { data: familyId, error } = await supabaseClient
      .rpc("join_family_by_invite_code", {
        target_invite_code: inviteCode,
        member_display_name: displayName
      });

    if (error) {
      remote.loading = false;
      setupErrorMessage = getJoinFamilyErrorMessage(error);
      showToast("参加で止まりました。画面内の原因を確認してください");
      render();
      return;
    }

    setSavedActiveFamilyId(familyId);
    await loadRemoteData();
    showToast("家族に参加しました");
  }

  async function createDefaultFamilyForCurrentUser() {
    const displayName = (authSession.user.user_metadata && authSession.user.user_metadata.display_name)
      || displayNameFromEmail(authSession.user.email)
      || "オーナー";
    const { data: familyId, error } = await supabaseClient
      .rpc("create_family_with_default_cat", {
        family_name: "RAGDOLL-HOME",
        member_display_name: displayName
      });

    if (error) {
      setupErrorMessage = getFamilySetupErrorMessage(error, error);
      remote.loading = false;
      remote.ready = false;
      showToast("初回の家族ページ作成で止まりました。Supabase SQLを確認してください");
      render();
      return "";
    }

    showToast("家族ページを作成しました。設定からファミリーIDを確認できます");
    return familyId;
  }

  async function verifyInviteCode(inviteCode) {
    const code = normalizeInviteCode(inviteCode);
    if (!code) return { ok: false, message: "ファミリーIDを入力してください" };
    const { data, error } = await supabaseClient
      .rpc("verify_family_invite_code", { target_invite_code: code });
    if (error) {
      return {
        ok: false,
        message: getInviteVerifyErrorMessage(error)
      };
    }
    if (!data) {
      return { ok: false, message: "ファミリーIDが見つかりません。親メンバーの設定画面に表示されているIDを確認してください。" };
    }
    return { ok: true };
  }

  async function joinPendingInvite() {
    if (!authSession) return false;
    const pending = getPendingInvite();
    if (!pending || !pending.inviteCode) return false;
    const displayName = pending.displayName
      || (authSession.user.user_metadata && authSession.user.user_metadata.display_name)
      || "家族";
    const { data: familyId, error } = await supabaseClient
      .rpc("join_family_by_invite_code", {
        target_invite_code: pending.inviteCode,
        member_display_name: displayName
      });
    if (error) {
      setupErrorMessage = getJoinFamilyErrorMessage(error);
      showToast("ファミリーIDの紐づけで止まりました。設定画面の原因を確認してください");
      return false;
    }
    clearPendingInvite();
    setSavedActiveFamilyId(familyId);
    showToast("ファミリーIDで家族に参加しました");
    return true;
  }

  function getInviteVerifyErrorMessage(error) {
    const message = String((error && error.message) || "");
    if (message.includes("verify_family_invite_code") || message.toLowerCase().includes("function")) {
      return "ファミリーID確認機能が未更新です。Supabase SQL Editorで docs/supabase-join-family.sql を再実行してください。";
    }
    return `ファミリーIDを確認できません: ${message || "詳細不明"}`;
  }

  function getFamilySetupErrorMessage(rpcError, familyError) {
    const rpcMessage = String((rpcError && rpcError.message) || "");
    const familyMessage = String((familyError && familyError.message) || "");
    const combined = `${rpcMessage} ${familyMessage}`.toLowerCase();
    if (combined.includes("create_family_with_default_cat") || combined.includes("function") || combined.includes("schema cache")) {
      return "Supabase SQL Editorで docs/supabase-join-family.sql をまだ実行していない可能性が高いです。SQLを1回実行してから、もう一度「新しい家族を作る」を押してください。";
    }
    if (combined.includes("row-level security") || combined.includes("violates")) {
      return "Supabaseの権限設定で保存が止まっています。docs/supabase-join-family.sql を実行すると、家族作成を安全に行う関数が追加されます。";
    }
    return `Supabaseへの保存で止まりました。エラー: ${familyMessage || rpcMessage || "詳細不明"}`;
  }

  function getJoinFamilyErrorMessage(error) {
    const message = String((error && error.message) || "");
    if (message.includes("invite_code_not_found")) {
      return "ファミリーIDが見つかりません。1人目の設定画面に表示されているIDを、そのまま入力してください。";
    }
    if (message.includes("join_family_by_invite_code") || message.toLowerCase().includes("function")) {
      return "Supabase SQL Editorで docs/supabase-join-family.sql をまだ実行していない可能性が高いです。SQLを1回実行してください。";
    }
    return `参加処理で止まりました。エラー: ${message || "詳細不明"}`;
  }

  async function logout() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    authSession = null;
    remote = { loading: false, ready: false, family: null, member: null, error: "" };
    render();
  }

  async function onSubmitRecord(event) {
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

    let savedLog = log;
    if (isCloudReady()) {
      const { data, error } = await supabaseClient
        .from("logs")
        .insert(dbPayloadFromLog(log))
        .select("id,family_id,cat_id,member_id,type,date_time,status,amount,unit,detail,tags,note,created_at,updated_at")
        .single();
      if (error) {
        showToast(`記録を保存できません: ${error.message}`);
        return;
      }
      savedLog = logFromDb(data);
    }

    state.logs.push(savedLog);
    pendingPhotos.forEach((photo) => {
      state.photos.push({
        ...photo,
        id: createId("photo"),
        catId: state.activeCatId,
        memberId: state.activeMemberId,
        dateTime: savedLog.dateTime,
        tags: tags.length ? tags : [typeMeta[recordType].label],
        note: savedLog.note || composeSummary(savedLog),
        linkedLogId: savedLog.id
      });
    });

    state.logs.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    state.photos.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    pendingPhotos = [];
    if (saveState()) showToast(`${typeMeta[recordType].label}を保存しました`);
    if (isCloudReady()) await loadRemoteData();
    render();
  }

  async function onSubmitEditLog(event) {
    event.preventDefault();
    const log = state.logs.find((item) => item.id === activeEditLogId);
    if (!log) return;
    const formData = new FormData(event.currentTarget);
    const amountRaw = String(formData.get("amount") || "").trim();
    log.dateTime = fromLocalInputValue(formData.get("dateTime")) || log.dateTime;
    log.values = {
      status: String(formData.get("status") || ""),
      amount: amountRaw === "" ? null : Number(amountRaw),
      unit: String(formData.get("unit") || (formConfig[log.type] || {}).unit || ""),
      detail: String(formData.get("detail") || "")
    };
    log.tags = Array.from(app.querySelectorAll("[data-edit-tag].is-active")).map((button) => button.dataset.editTag);
    log.note = String(formData.get("note") || "").trim();

    if (isCloudReady()) {
      const { error } = await supabaseClient
        .from("logs")
        .update(dbPayloadFromLog(log))
        .eq("id", log.id)
        .eq("family_id", remote.family.id);
      if (error) {
        showToast(`記録を更新できません: ${error.message}`);
        return;
      }
    }

    state.logs.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    activeEditLogId = null;
    if (saveState()) showToast("記録を更新しました");
    if (isCloudReady()) await loadRemoteData();
    render();
  }

  async function deleteActiveLog() {
    if (!activeEditLogId) return;
    if (!window.confirm("この記録を削除しますか？")) return;

    if (isCloudReady()) {
      const { error } = await supabaseClient
        .from("logs")
        .delete()
        .eq("id", activeEditLogId)
        .eq("family_id", remote.family.id);
      if (error) {
        showToast(`記録を削除できません: ${error.message}`);
        return;
      }
    }

    state.logs = state.logs.filter((log) => log.id !== activeEditLogId);
    state.photos = state.photos.map((photo) =>
      photo.linkedLogId === activeEditLogId ? { ...photo, linkedLogId: null } : photo
    );
    activeEditLogId = null;
    if (saveState()) showToast("記録を削除しました");
    if (isCloudReady()) await loadRemoteData();
    render();
  }

  function getShareableState() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      family: state.family,
      members: state.members,
      activeMemberId: state.activeMemberId,
      cats: state.cats,
      activeCatId: state.activeCatId,
      logs: state.logs
    };
  }

  function exportSharedData() {
    const data = JSON.stringify(getShareableState(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "shared-state.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("写真なし共有データを書き出しました");
  }

  function importSharedData(shared) {
    if (!shared || !Array.isArray(shared.cats) || !Array.isArray(shared.logs)) {
      showToast("共有データの形式が違います");
      return;
    }
    const normalized = normalizeState({
      ...state,
      family: shared.family || state.family,
      members: Array.isArray(shared.members) ? shared.members : state.members,
      activeMemberId: shared.activeMemberId || state.activeMemberId,
      cats: shared.cats,
      activeCatId: shared.activeCatId || shared.cats[0].id,
      logs: shared.logs,
      photos: state.photos
    });
    state = normalized;
    if (!state.cats.some((cat) => cat.id === state.activeCatId)) {
      state.activeCatId = state.cats[0].id;
    }
    if (!state.members.some((member) => member.id === state.activeMemberId)) {
      state.activeMemberId = state.members[0].id;
    }
    saveState();
    showToast("共有データを読み込みました");
    render();
  }

  function handleSharedDataFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => showToast("共有データを読み込めませんでした");
    reader.onload = () => {
      try {
        importSharedData(JSON.parse(reader.result));
      } catch (error) {
        showToast("JSONとして読み込めませんでした");
      }
    };
    reader.readAsText(file);
  }

  async function loadHostedSharedData() {
    if (supabaseClient) return;
    if (hadStoredState) return;
    try {
      const response = await fetch(`shared-state.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      importSharedData(await response.json());
    } catch (error) {
      // Hosted shared data is optional.
    }
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
    if (isCloudReady()) {
      showToast("Supabase連携中はログイン中のユーザーで記録します");
      return;
    }
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
    if (isCloudReady()) {
      addRemoteCat(cat);
      return;
    }
    state.cats.push(cat);
    state.activeCatId = cat.id;
    saveState();
    showToast("猫プロフィールを追加しました");
    render();
  }

  async function addRemoteCat(cat) {
    const { data, error } = await supabaseClient
      .rpc("add_family_cat", {
        target_family_id: remote.family.id,
        cat_name: cat.name,
        cat_breed: cat.breed,
        cat_coat: cat.coat,
        cat_birthday: cat.birthday || null,
        cat_avatar_key: avatarKeyFromPath(cat.avatar)
      });

    if (error) {
      showToast(getCatSaveErrorMessage(error, "猫を追加できません"));
      return;
    }
    state.activeCatId = data;
    await loadRemoteData();
    showToast("猫プロフィールを追加しました");
  }

  async function updateRemoteCat(cat) {
    if (!isCloudReady()) return;
    const { error } = await supabaseClient
      .rpc("update_family_cat", {
        target_cat_id: cat.id,
        cat_name: cat.name || "名前未設定",
        cat_breed: cat.breed || "ラグドール",
        cat_coat: cat.coat || "",
        cat_birthday: cat.birthday || null,
        cat_avatar_key: avatarKeyFromPath(cat.avatar)
      });
    if (error) {
      showToast(getCatSaveErrorMessage(error, "猫プロフィールを保存できません"));
      return;
    }
    showToast("猫プロフィールを保存しました");
  }

  function getCatSaveErrorMessage(error, prefix) {
    const message = String((error && error.message) || "");
    if (message.includes("add_family_cat") || message.includes("update_family_cat") || message.toLowerCase().includes("function")) {
      return `${prefix}: Supabase SQL Editorで docs/supabase-join-family.sql を再実行してください`;
    }
    if (message.includes("not_family_member")) {
      return `${prefix}: この家族グループのメンバーとして認識されていません。ログアウト後、ファミリーIDで参加し直してください`;
    }
    return `${prefix}: ${message || "詳細不明"}`;
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
    showToast("初期状態に戻しました");
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
      edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z"],
      trash: ["M3 6h18", "M8 6V4h8v2", "M7 10v10h10V10"],
      download: ["M12 3v12", "M7 10l5 5 5-5", "M5 21h14"],
      upload: ["M12 21V9", "M7 14l5-5 5 5", "M5 3h14"],
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
