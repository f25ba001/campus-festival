(function () {
  "use strict";
  const D = FestivalDomain,
    KEY = "campus-festival-v1",
    COLUMN_PREFERENCES_KEY = "campus-festival-column-preferences-v1";
  const $ = (s) => document.querySelector(s),
    esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  let state,
    storageWarning = "",
    filterText = "",
    filterStatus = "",
    filterEquipment = "",
    filterSupplierCategory = "",
    filterOverdue = false,
    columnPreferences = {},
    columnPreferenceWarning = "",
    sortKey = "id",
    editing = null,
    actionInProgress = false,
    toastTimer;
  try {
    const saved = localStorage.getItem(KEY);
    state = saved ? JSON.parse(saved) : structuredClone(FestivalSeed);
    state = normalizeState(state);
    if (!Array.isArray(state.groups) || !Array.isArray(state.applications))
      throw Error("形式");
    if (!Array.isArray(state.tickets)) state.tickets = [];
    if (!Array.isArray(state.troubles) || state.troubles.length === 0) state.troubles = structuredClone(FestivalSeed.troubles);
    if (!Array.isArray(state.contacts) || state.contacts.length === 0) state.contacts = structuredClone(FestivalSeed.contacts);
    if (!Array.isArray(state.attendeeChanges)) state.attendeeChanges = [];
    if (!Array.isArray(state.sponsors) || state.sponsors.length === 0) state.sponsors = structuredClone(FestivalSeed.sponsors);
    if (!Array.isArray(state.entrances) || state.entrances.length === 0) state.entrances = structuredClone(FestivalSeed.entrances);
    state.applications
      .filter((application) => application.status === "cancelled")
      .forEach((application) => D.invalidateTickets(state, application.id));
  } catch (e) {
    state = normalizeState(structuredClone(FestivalSeed));
    storageWarning =
      "保存済みデータを読み込めなかったため、初期データを表示しています。必要ならバックアップから復元してください。";
  }
  const labels = {
    draft: "下書き",
    submitted: "承認待ち",
    reviewed: "担当確認済み",
    approved: "責任者確認済み",
    rejected: "差し戻し",
    cancelled: "取消",
    active: "対応中",
    pending: "未対応",
    waiting: "完了待ち",
    completed: "完了",
    reserved: "予約",
    returned: "返却済み",
    active: "有効",
    invalid: "無効",
    todo: "未着手",
    done: "完了",
    stored: "保管中",
    claimed: "返却済み",
    disposed: "処分済み",
    ordered: "未受領",
    received: "受領済",
    notArrived: "未着",
    damaged: "破損・初期不良",
  };
  const pages = {
    dashboard: ["◈", "ダッシュボード", "OVERVIEW"],
    groups: ["◎", "団体・メンバー", "ORGANIZATIONS"],
    applications: ["▤", "出店申請", "APPLICATIONS"],
    reservations: ["▦", "会場予約", "VENUES"],
    reception: ["✓", "整理券受付", "RECEPTION"],
    loans: ["▣", "備品・貸出", "EQUIPMENT"],
    orders: ["▤", "発注品", "ORDERS"],
    suppliers: ["☎", "業者連絡先", "SUPPLIERS"],
    expenses: ["¥", "予算・経費", "FINANCE"],
    shifts: ["◷", "スタッフ配置", "STAFF"],
    tasks: ["☑", "タスク", "TASKS"],
    troubles: ["!", "トラブル対応", "INCIDENTS"],
    contacts: ["☎", "緊急連絡先", "EMERGENCY CONTACTS"],
    sponsors: ["◆", "協賛団体", "SPONSORS"],
    entranceDashboard: ["▥", "入口別来場者", "ENTRY TRAFFIC"],
    notices: ["◉", "お知らせ", "NOTICES"],
    lostItems: ["⌕", "落とし物", "LOST & FOUND"],
    settings: ["⚙", "データ管理", "SETTINGS"],
  };
  const fields = {
    groups: [
      ["name", "団体名", "text"],
      ["representative", "代表者", "text"],
      ["members", "所属人数", "number"],
      ["budget", "予算（円）", "number"],
      ["active", "状態", "groupStatus"],
    ],
    applications: [
      ["title", "企画名", "text"],
      ["groupId", "申請団体", "group"],
      ["venueId", "希望会場", "venue"],
      ["date", "開催日", "date"],
      ["start", "開始時刻", "time"],
      ["end", "終了時刻", "time"],
      ["attendees", "参加予定人数", "number"],
      ["status", "状態", "applicationStatus"],
      ["note", "補足", "textarea"],
    ],
    reservations: [
      ["applicationId", "関連する出店申請", "application"],
      ["groupId", "利用団体", "group"],
      ["venueId", "会場", "venue"],
      ["date", "利用日", "date"],
      ["start", "開始時刻", "time"],
      ["end", "終了時刻", "time"],
      ["attendees", "参加予定人数", "number"],
      ["status", "状態", "reservationStatus"],
    ],
    loans: [
      ["equipmentId", "備品", "equipment"],
      ["groupId", "利用団体", "group"],
      ["applicationId", "関連する出店申請", "application"],
      ["quantity", "数量", "number"],
      ["due", "返却期限", "date"],
      ["status", "状態", "loanStatus"],
    ],
    orders: [
      ["title", "発注品", "text"],
      ["orderDate", "発注日", "date"],
      ["status", "受領ステータス", "orderStatus"],
      ["receivedAt", "受領日時", "datetime-local"],
      ["receivedBy", "受領担当者名", "text"],
    ],
    suppliers: [
      ["name", "業者名", "text"],
      ["category", "業者区分", "supplierCategory"],
      ["contactName", "担当者名", "text"],
      ["phone", "電話番号", "tel"],
      ["email", "メールアドレス", "email"],
      ["website", "Webサイト", "url"],
      ["address", "所在地", "text"],
      ["note", "備考", "textarea"],
    ],
    expenses: [
      ["title", "経費名", "text"],
      ["groupId", "団体", "group"],
      ["category", "分類", "category"],
      ["amount", "金額（円）", "number"],
      ["date", "発生日", "date"],
      ["status", "状態", "expenseStatus"],
    ],
    shifts: [
      ["name", "スタッフ名", "text"],
      ["groupId", "所属団体", "group"],
      ["date", "担当日", "date"],
      ["start", "開始時刻", "time"],
      ["end", "終了時刻", "time"],
      ["location", "担当場所", "text"],
    ],
    tasks: [
      ["title", "タスク名", "text"],
      ["groupId", "団体", "group"],
      ["owner", "担当者", "text"],
      ["due", "期限", "date"],
      ["status", "状態", "taskStatus"],
      ["note", "補足", "textarea"],
    ],
    troubles: [
      ["title", "トラブル内容", "text"],
      ["location", "場所・エリア", "text"],
      ["owner", "担当者", "text"],
      ["reportedAt", "報告日時", "text"],
      ["status", "進捗ステータス", "troubleStatus"],
      ["completionCondition", "完了条件", "textarea"],
      ["note", "対応メモ", "textarea"]
    ],
    sponsors: [
      ["name", "協賛団体名", "text"],
      ["contact", "窓口担当者", "text"],
      ["phone", "電話番号", "text"],
      ["email", "メールアドレス", "text"],
      ["goods", "協賛品", "text"],
      ["cash", "協賛金（円）", "number"],
      ["note", "備考", "textarea"]
    ],
    contacts: [
      ["area", "場所・担当エリア", "text"],
      ["manager", "当日責任者", "text"],
      ["managerContact", "責任者連絡先", "text"],
      ["alternate", "代理責任者", "text"],
      ["alternateContact", "代理連絡先", "text"],
      ["note", "備考", "textarea"]
    ],
    notices: [
      ["title", "件名", "text"],
      ["groupId", "対象団体", "audience"],
      ["date", "掲載日", "date"],
      ["body", "本文", "textarea"],
    ],
    lostItems: [
      ["title", "落とし物", "text"],
      ["foundDate", "発見日", "date"],
      ["location", "発見場所", "text"],
      ["storageDeadline", "保管期限", "date"],
      ["status", "状態", "lostItemStatus"],
      ["note", "特徴・補足", "textarea"],
    ],
  };
  const prefixes = {
    groups: "G",
    applications: "A",
    reservations: "R",
    loans: "L",
    orders: "O",
    suppliers: "P",
    expenses: "X",
    shifts: "S",
    tasks: "T",
    troubles: "TR",
    contacts: "C",
    sponsors: "SP",
    notices: "N",
    lostItems: "F",
  };
  function page() {
    return location.hash.slice(1).split("?")[0] || "dashboard";
  }
  function today() {
    return new Date().toLocaleDateString("sv-SE");
  }
  function money(n) {
    return "¥" + Number(n).toLocaleString("ja-JP");
  }
  function name(collection, id) {
    const row = state[collection].find((r) => r.id === id);
    return row?.name || row?.title || "未設定";
  }
  function badge(v) {
    return `<span class="badge ${esc(v)}">${esc(labels[v] || v)}</span>`;
  }
  function toast(msg) {
    $("#toast").textContent = msg;
    $("#toast").style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 4000);
  }
  try {
    const savedPreferences = localStorage.getItem(COLUMN_PREFERENCES_KEY);
    if (savedPreferences) {
      const parsedPreferences = JSON.parse(savedPreferences);
      if (
        !parsedPreferences ||
        typeof parsedPreferences !== "object" ||
        Array.isArray(parsedPreferences)
      )
        throw Error("表示列設定の形式が不正です");
      columnPreferences = parsedPreferences;
    }
  } catch (error) {
    console.error("表示列設定を読み込めませんでした。", error);
    columnPreferenceWarning =
      "表示列設定を読み込めなかったため、すべての列を表示しています。";
  }
  function visibleColumns(p, allColumns) {
    const selected = columnPreferences[state.role]?.[p];
    if (!Array.isArray(selected)) return allColumns;
    const selectedKeys = new Set(
      selected.filter((key) => allColumns.some((col) => col[0] === key)),
    );
    return selectedKeys.size
      ? allColumns.filter((col) => selectedKeys.has(col[0]))
      : allColumns;
  }
  function columnPicker(allColumns, visible) {
    const selectedKeys = new Set(visible.map((col) => col[0]));
    return `<details id="column-picker" class="panel column-picker"><summary>表示列を選択</summary><div class="column-options">${allColumns
      .map(
        ([key, label]) =>
          `<label><input type="checkbox" data-column-visibility="${esc(key)}" ${selectedKeys.has(key) ? "checked" : ""}>${esc(label)}</label>`,
      )
      .join("")}</div><p class="subtitle">設定は操作する役割ごとに、このブラウザーへ保存されます。</p></details>`;
  }
  function setVisibleColumns(p, selectedKeys) {
    const nextPreferences = structuredClone(columnPreferences);
    nextPreferences[state.role] ||= {};
    nextPreferences[state.role][p] = selectedKeys;
    try {
      localStorage.setItem(
        COLUMN_PREFERENCES_KEY,
        JSON.stringify(nextPreferences),
      );
    } catch (error) {
      console.error("表示列設定を保存できませんでした。", error);
      toast("表示列設定を保存できませんでした。ブラウザーの保存容量を確認してください。");
      return false;
    }
    columnPreferences = nextPreferences;
    return true;
  }
  function lockButtons() {
    document.querySelectorAll("button:not(:disabled)").forEach((button) => {
      button.disabled = true;
      button.dataset.actionLock = "true";
    });
  }
  function runAction(button, action, guardDuration = 400) {
    if (actionInProgress || button?.disabled) return;
    actionInProgress = true;
    const started = Date.now();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      setTimeout(() => {
        document
          .querySelectorAll('button[data-action-lock="true"]')
          .forEach((locked) => {
            locked.disabled = false;
            delete locked.dataset.actionLock;
          });
        actionInProgress = false;
      }, Math.max(0, guardDuration - (Date.now() - started)));
    };
    lockButtons();
    try {
      const result = action();
      if (result && typeof result.then === "function")
        return result.finally(release);
      release();
      return result;
    } catch (error) {
      release();
      throw error;
    }
  }
  function save(message, data = state) {
    const nextState = structuredClone(data);
    nextState.activity.unshift({
      at: new Date().toISOString(),
      message,
    });
    nextState.activity = nextState.activity.slice(0, 100);
    try {
      localStorage.setItem(KEY, JSON.stringify(nextState));
    } catch (e) {
      toast("保存できませんでした。データ管理からバックアップしてください。");
      return false;
    }
    state = nextState;
    if (message) toast(message);
    return true;
  }
  function download(filename, text, type = "application/json") {
    const blob = new Blob(["\ufeff", text], { type: type + ";charset=utf-8" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function head(title, sub, action = "") {
    return `<div class="page-head"><div><div class="eyebrow">CAMPUS FESTIVAL / ${pages[page()]?.[2] || "WORKSPACE"}</div><h1>${title}</h1><p class="subtitle">${sub}</p></div>${action}</div>`;
  }
  function stat(label, value, hint) {
    return `<div class="stat"><small>${label}</small><strong class="mono">${value}</strong><div class="hint">${hint}</div></div>`;
  }
  function panel(title, body, link = "") {
    return `<div class="panel"><div class="panel-title"><h2>${title}</h2>${link}</div><div class="panel-body">${body}</div></div>`;
  }
  function renderDashboard() {
    const rate = D.completion(state),
      budget = state.groups.reduce((n, g) => n + Number(g.budget), 0);
    return (
      head(
        "運営の今を、ひと目で。",
        "申請から当日の配置まで、チームの動きをここに。",
      ) +
      `<div class="hero"><div><div class="eyebrow">NOVEMBER 14 — 15, 2026</div><h2>つながるアイデア、広がるキャンパス。</h2><p>学園祭の準備状況を確認して、今日の一歩を進めましょう。</p></div><div class="hero-mark">26 / F</div></div>` +
      `<div class="stats">${stat("出店申請", state.applications.length + "<small> 件</small>", "承認待ち " + D.pending(state) + " 件")}${stat("参加団体", state.groups.length + "<small> 団体</small>", "所属メンバー " + D.groupMembers(state) + " 名")}${stat("登録経費", money(D.expenses(state)), "総予算 " + money(budget))}${stat("タスク完了率", rate + "<small> %</small>", "期限超過 " + D.overdueTasks(state, today()).length + " 件")}</div>` +
      `<div class="grid2">${panel(
        "承認待ちの出店申請",
        state.applications
          .filter((a) => a.status === "submitted")
          .map(
            (a) =>
              `<div class="notice-row"><small>${esc(name("groups", a.groupId))} / ${esc(a.date)}</small><b>${esc(a.title)}</b>${badge(a.status)}</div>`,
          )
          .join("") || "<p>承認待ちの申請はありません。</p>",
        '<a href="#applications">申請一覧 →</a>',
      )}${panel(
        "運営からのお知らせ",
        D.notices(state, state.groupId)
          .slice(0, 3)
          .map(
            (n) =>
              `<div class="notice-row"><small>${esc(n.date)} / ${n.groupId === "all" ? "全体" : esc(name("groups", n.groupId))}</small><b>${esc(n.title)}</b><span>${esc(n.body)}</span></div>`,
          )
          .join(""),
        '<a href="#notices">すべて見る →</a>',
      )}</div>` +
      `<div class="grid2">${panel("団体別の予算残額", state.groups.map((g) => `<div class="metric-line"><span>${esc(g.name)}</span><b>${money(D.remaining(state, g.id))}</b></div><div class="progress"><span style="width:${Math.max(0, Math.min(100, ((g.budget - D.expenses(state, g.id)) / Math.max(1, g.budget)) * 100))}%"></span></div>`).join(""))}${panel(
        "最近の操作",
        state.activity
          .slice(0, 6)
          .map(
            (a) =>
              `<div class="notice-row"><small>${esc(new Date(a.at).toLocaleString("ja-JP"))}</small><b>${esc(a.message)}</b></div>`,
          )
          .join("") || '<p class="subtitle">まだ操作履歴はありません。</p>',
      )}</div>`
    );
  }
  function columns(p) {
    switch (p) {
      case "groups":
        return [
          ["id", "ID"],
          ["name", "団体名"],
          ["representative", "代表者"],
          ["members", "人数"],
          ["budget", "予算"],
          ["_remaining", "残額"],
        ];
      case "applications":
        return [
          ["id", "ID"],
          ["title", "企画名"],
          ["groupId", "団体"],
          ["venueId", "会場"],
          ["date", "開催日"],
          ["_time", "時間"],
          ["attendees", "人数"],
          ["status", "状態"],
        ];
      case "reservations":
        return [
          ["id", "ID"],
          ["venueId", "会場"],
          ["groupId", "団体"],
          ["date", "利用日"],
          ["_time", "時間"],
          ["attendees", "人数"],
          ["status", "状態"],
        ];
      case "loans":
        return [
          ["id", "ID"],
          ["equipmentId", "備品"],
          ["_borrower", "利用団体・代表者"],
          ["_purpose", "利用目的"],
          ["quantity", "数量"],
          ["due", "返却期限"],
          ["status", "状態"],
          ["_late", "期限確認"],
        ];
      case "orders":
        return [
          ["id", "ID"],
          ["title", "発注品"],
          ["orderDate", "発注日"],
          ["status", "受領ステータス"],
          ["receivedAt", "受領日時"],
          ["receivedBy", "受領担当者名"],
        ];
      case "suppliers":
        return [
          ["id", "ID"],
          ["name", "業者名"],
          ["category", "業者区分"],
          ["contactName", "担当者名"],
          ["phone", "電話番号"],
          ["email", "メールアドレス"],
          ["website", "Webサイト"],
          ["address", "所在地"],
          ["note", "備考"],
        ];
      case "expenses":
        return [
          ["id", "ID"],
          ["title", "経費名"],
          ["groupId", "団体"],
          ["category", "分類"],
          ["amount", "金額"],
          ["date", "発生日"],
          ["status", "状態"],
        ];
      case "shifts":
        return [
          ["id", "ID"],
          ["name", "氏名"],
          ["groupId", "団体"],
          ["date", "担当日"],
          ["_time", "時間"],
          ["location", "担当場所"],
          ["_hours", "時間数"],
        ];
      case "tasks":
        return [
          ["id", "ID"],
          ["title", "タスク"],
          ["groupId", "団体"],
          ["owner", "担当者"],
          ["due", "期限"],
          ["status", "状態"],
        ];
      case "troubles":
        return [
          ["id", "ID"],
          ["title", "トラブル"],
          ["location", "場所・エリア"],
          ["owner", "担当者"],
          ["status", "進捗"],
          ["completionCondition", "完了条件"]
        ];
      case "sponsors":
        return [
          ["id", "ID"],
          ["name", "協賛団体名"],
          ["contact", "窓口担当者"],
          ["phone", "電話番号"],
          ["goods", "協賛品"],
          ["cash", "協賛金（円）"]
        ];
      case "contacts":
        return [
          ["id", "ID"],
          ["area", "場所・担当エリア"],
          ["manager", "責任者"],
          ["managerContact", "責任者連絡先"],
          ["alternate", "代理"],
          ["alternateContact", "代理連絡先"]
        ];
      case "notices":
        return [
          ["id", "ID"],
          ["title", "件名"],
          ["groupId", "対象"],
          ["date", "掲載日"],
          ["body", "本文"],
        ];
      case "lostItems":
        return [
          ["id", "ID"],
          ["title", "落とし物"],
          ["foundDate", "発見日"],
          ["location", "発見場所"],
          ["storageDeadline", "保管期限"],
          ["status", "状態"],
          ["_overdue", "期限確認"],
        ];
    }
  }
  function cell(r, k) {
    if (k === "groupId")
      return r[k] === "all" ? "全体" : esc(name("groups", r[k]));
    if (k === "venueId") return esc(name("venues", r[k]));
    if (k === "equipmentId") return esc(name("equipment", r[k]));
    if (k === "_borrower") {
      const group = state.groups.find((g) => g.id === r.groupId);
      return group
        ? `${esc(group.name)} / ${esc(group.representative || "代表者未登録")}`
        : "未設定";
    }
    if (k === "_purpose") {
      const application = state.applications.find(
        (a) => a.id === r.applicationId,
      );
      return application ? esc(application.title) : "用途未登録";
    }
    if (k === "status") return badge(r[k]);
    if (k === "category" && typeof r[k] === "string")
      return esc(labels[r[k]] || r[k]);
    if (k === "amount" || k === "budget") return money(r[k]);
    if (k === "_remaining") return money(D.remaining(state, r.id));
    if (k === "_time") return esc(r.start) + " – " + esc(r.end);
    if (k === "_hours") return D.shiftHours(r) + " h";
    if (k === "_late")
      return D.loanOverdue(r, today())
        ? '<span class="badge rejected">期限超過</span>'
        : "—";
    if (k === "_overdue")
      return D.lostItemOverdue(r, today())
        ? '<span class="badge rejected">保管期限超過</span>'
        : "—";
    return esc(r[k]);
  }
  function renderList(p) {
    let rows = p === "notices" ? D.notices(state, state.groupId) : state[p];
    if (p === "loans") {
      const query = filterText.toLowerCase();
      rows = rows.filter((loan) => {
        const group = state.groups.find((g) => g.id === loan.groupId);
        const application = state.applications.find(
          (a) => a.id === loan.applicationId,
        );
        return [
          JSON.stringify(loan),
          name("equipment", loan.equipmentId),
          group?.name,
          group?.representative,
          application?.title,
          labels[loan.status],
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
    } else {
      rows = D.search(rows, filterText);
    }
    if (p === "lostItems" && filterOverdue)
      rows = rows.filter((item) => D.lostItemOverdue(item, today()));
    if (p === "loans" && filterEquipment)
      rows = rows.filter((r) => r.equipmentId === filterEquipment);
    if (p === "suppliers" && filterSupplierCategory)
      rows = rows.filter((r) => r.category === filterSupplierCategory);
    if (filterStatus) rows = rows.filter((r) => r.status === filterStatus);
    rows =
      p === "tasks" && sortKey === "id"
        ? D.taskOrder(rows)
        : D.sort(rows, sortKey);
    const allColumns = columns(p),
      cols = visibleColumns(p, allColumns),
      statuses = [...new Set(state[p].map((r) => r.status).filter(Boolean))];
    let summary = "";
    if (p === "loans")
      summary = `<div class="stats">${state.equipment.map((e) => stat(esc(e.name), D.available(state, e.id) + "<small> / " + e.stock + "</small>", "貸出可能 / 台帳数")).join("")}</div>`;
    if (p === "reservations")
      summary = `<div class="stats">${state.venues.map((v) => stat(esc(v.name), v.capacity + "<small> 名</small>", "予約 " + D.venueUsage(state, v.id) + " 件")).join("")}</div>`;
    if (p === "lostItems") {
      const overdueItems = state.lostItems.filter((item) =>
        D.lostItemOverdue(item, today()),
      );
      const overdueSummary = overdueItems.length
        ? `<p><span class="badge rejected">期限超過 ${overdueItems.length} 件</span> 保管期限を過ぎた落とし物があります。</p><div class="notice-row">${overdueItems
            .map(
              (item) =>
                `<div><b>${esc(item.title)}</b><small>期限：${esc(item.storageDeadline)} / ${esc(item.location)}</small></div>`,
            )
            .join("")}</div>`
        : '<p class="subtitle">保管期限を過ぎた落とし物はありません。</p>';
      const overdueFilterButton =
        overdueItems.length || filterOverdue
          ? `<button class="secondary small" id="filter-overdue">${filterOverdue ? "すべての落とし物を表示" : "期限超過のみ表示"}</button>`
          : "";
      summary = panel(
        "保管期限の確認",
        overdueSummary + overdueFilterButton,
      );
    }
    const cleaning =
      p === "reservations"
        ? panel(
            "閉館後清掃",
            `<div class="table-scroll"><table><thead><tr><th>会場</th><th>清掃担当者</th><th>清掃完了</th><th>操作</th></tr></thead><tbody>${state.venues
              .map(
                (v) =>
                  `<tr><td>${esc(v.name)}</td><td><input type="text" data-cleaning-assignee="${esc(v.id)}" aria-label="${esc(v.name)}の清掃担当者" value="${esc(v.cleaningAssignee || "")}"></td><td><label><input type="checkbox" data-cleaning-completed="${esc(v.id)}" aria-label="${esc(v.name)}の清掃完了" ${v.cleaningCompleted ? "checked" : ""}> 完了</label></td><td><button class="small" data-save-cleaning="${esc(v.id)}">保存</button></td></tr>`,
              )
              .join("")}</tbody></table></div>`,
          )
        : "";
    if (p === "expenses")
      summary = `<div class="stats">${stat("登録経費合計", money(D.expenses(state)), "全団体の経費")}${stat("総予算", money(state.groups.reduce((n, g) => n + Number(g.budget), 0)), "団体ごとの予算を合算")}</div>`;
    if (p === "contacts")
      summary = `<div class="help">緊急時は責任者へ連絡し、応答がない場合は代理連絡先へ連絡してください。</div>`;
    if (p === "sponsors") {
      const totalCash = state.sponsors.reduce((sum, sponsor) => sum + Number(sponsor.cash || 0), 0);
      summary = `<div class="stats">${stat("協賛団体数", state.sponsors.length + "<small> 件</small>", "登録協賛先")}${stat("協賛金合計", money(totalCash), "協賛金の合計")}</div>`;
    }
    if (p === "applications" || p === "reservations") {
      const changes = state.attendeeChanges.filter((change) => change.entity === p.slice(0, -1).replace("application", "applications").replace("reservation", "reservations") || change.entity === p);
      if (changes.length) {
        summary += `<div class="panel"><div class="panel-title"><h2>来場人数変更履歴</h2></div><div class="table-scroll"><table><thead><tr><th>対象</th><th>修正前</th><th>修正後</th><th>理由</th><th>修正者</th><th>日時</th></tr></thead><tbody>${changes.map((change) => `<tr><td>${esc(change.entityId)}</td><td>${esc(change.before)}</td><td>${esc(change.after)}</td><td>${esc(change.reason)}</td><td>${esc(change.editor)}</td><td>${esc(change.at)}</td></tr>`).join("")}</tbody></table></div></div>`;
      }
    }
    const exportButton =
      '<button class="secondary" id="export-csv">CSV出力</button>';
    return (
      head(
        pages[p][1],
        p === "loans"
          ? "備品を選んで、返却済みを含む利用団体・代表者と利用目的を確認できます。"
          : p === "orders"
            ? "発注品の受領状況、受領日時、受領担当者を記録できます。"
            : `${state[p].length}件の登録データ。検索・編集して準備を進めましょう。`,
        `<button id="add-row">＋ 新規登録</button>`,
      ) +
      summary +
      cleaning +
      columnPicker(allColumns, cols) +
      `<div class="toolbar"><div class="filters"><input id="search" type="search" aria-label="一覧を検索" placeholder="キーワードで検索" value="${esc(filterText)}">${p === "loans" ? `<select id="equipment-filter" aria-label="備品で絞り込み"><option value="">すべての備品</option>${state.equipment.map((e) => `<option value="${esc(e.id)}" ${filterEquipment === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select>` : ""}${p === "suppliers" ? `<select id="supplier-category-filter" aria-label="業者区分で絞り込み"><option value="">すべての業者区分</option>${options("supplierCategory").map(([v, t]) => `<option value="${esc(v)}" ${filterSupplierCategory === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>` : ""}${statuses.length ? `<select id="status-filter" aria-label="状態で絞り込み"><option value="">すべての状態</option>${statuses.map((s) => `<option value="${s}" ${filterStatus === s ? "selected" : ""}>${labels[s] || s}</option>`).join("")}</select>` : ""}<select id="sort" aria-label="並び順">${allColumns
        .filter((c) => !c[0].startsWith("_"))
        .map(
          (c) =>
            `<option value="${c[0]}" ${sortKey === c[0] ? "selected" : ""}>${c[1]}順</option>`,
        )
        .join(
          "",
        )}</select><span class="subtitle">${rows.length} 件表示</span></div>${exportButton}</div>` +
      `<div class="panel"><div class="table-scroll"><table><thead><tr>${cols.map((c) => `<th>${c[1]}</th>`).join("")}<th>操作</th></tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${cols.map((c) => `<td class="${["title", "body", "name"].includes(c[0]) ? "description" : ""}">${cell(r, c[0])}</td>`).join("")}<td><div class="actions"><button class="secondary small" data-edit="${esc(r.id)}">編集</button>${p === "applications" ? `<button class="small" data-approve="${esc(r.id)}">承認</button><button class="danger small" data-cancel="${esc(r.id)}">取消</button>` : ""}${p === "loans" && r.status !== "returned" ? `<button class="small" data-return="${esc(r.id)}">返却</button>` : ""}${p === "tasks" ? `<button class="small" data-done="${esc(r.id)}">完了</button>` : ""}<button class="danger small" data-delete="${esc(r.id)}">削除</button></div></td></tr>`).join("") : `<tr><td colspan="${cols.length + 1}" class="empty">該当するデータはありません。</td></tr>`}</tbody></table></div></div>`
    );
  }
  function renderReception() {
    return (
      head("整理券受付", "コード照合と二重使用チェックを行います。") +
      `<div class="panel"><div class="panel-title"><h2>整理券照合</h2></div><div class="panel-body"><form id="ticket-form"><div class="field"><label for="ticket-code">整理券コード</label><input id="ticket-code" name="code" autocomplete="off" placeholder="例: A01-0001" required></div><button type="submit">照合する</button></form><div id="ticket-result" class="ticket-result" role="alert" aria-live="assertive"></div></div></div>` +
      `<div class="panel"><div class="panel-title"><h2>受付済み整理券</h2></div><div class="table-scroll"><table><thead><tr><th>コード</th><th>企画</th><th>状態</th><th>使用日時</th></tr></thead><tbody>${state.tickets.map((ticket) => `<tr><td class="mono">${esc(ticket.code)}</td><td>${esc(name("applications", ticket.applicationId))}</td><td>${badge(ticket.status)}</td><td>${ticket.usedAt ? esc(new Date(ticket.usedAt).toLocaleString("ja-JP")) : "—"}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">整理券はありません。</td></tr>'}</tbody></table></div></div>`
    );
  }
  function renderEntranceDashboard() {
    const total = state.entrances.reduce((sum, entrance) => sum + Number(entrance.count), 0);
    const peak = [...state.entrances].sort((a, b) => Number(b.count) - Number(a.count))[0];
    const bars = state.entrances.map((entrance) => {
      const ratio = entrance.capacity > 0 ? Math.min(100, Math.round((Number(entrance.count) / Number(entrance.capacity)) * 100)) : 0;
      return `<div class="entry-row"><div class="entry-label"><b>${esc(entrance.name)}</b><span>${Number(entrance.count).toLocaleString("ja-JP")}人 / 定員${Number(entrance.capacity).toLocaleString("ja-JP")}人</span></div><div class="entry-bar"><span style="width:${ratio}%" class="${ratio >= 90 ? "high" : ratio >= 70 ? "medium" : "low"}"></span></div><strong>${ratio}%</strong></div>`;
    }).join("");
    return head("入口別来場者", "入口ごとの人数と混雑状況をリアルタイムに比較します。") +
      `<div class="stats">${stat("総来場者数", total.toLocaleString("ja-JP") + "<small> 人</small>", "全入口の合計")}${stat("最多入口", esc(peak?.name || "未設定"), "現在 " + Number(peak?.count || 0).toLocaleString("ja-JP") + " 人")}${stat("集計入口数", state.entrances.length + "<small> か所</small>", "比較対象")}</div>` +
      `<div class="panel"><div class="panel-title"><h2>入口別比較</h2><button class="secondary small" id="refresh-entrances">人数を更新</button></div><div class="panel-body entry-chart">${bars}</div></div>`;
  }
  function renderSettings() {
    const audits = state.audit?.slice(0, 8) ?? [];
    return (
      head("データを、手元に。", "保存・復元と、操作する団体を管理します。") +
      `<div class="help">これはブラウザ内で動く演習用システムです。ログイン認証や共同データ保存はありません。役割・団体の切り替えは業務操作の体験用です。同じデータで確認するときはJSONファイルを共有してください。端末やブラウザが変わると保存先も変わります。</div><div class="settings-grid">${panel("バックアップ", '<p>現在の業務データをJSONファイルとして保存します。</p><button id="backup">JSONを書き出す</button>')}${panel("データを復元", '<p>JSONファイルを読み込み、現在のデータを置き換えます。</p><input id="restore-file" aria-label="復元するJSON" type="file" accept=".json"><div id="restore-preview" class="help" hidden></div><button id="restore" class="secondary">読み込む</button>')}${panel("操作する団体", `<p>団体代表として表示する団体を選択します。</p><select id="current-group" aria-label="操作する団体">${state.groups.map((g) => `<option value="${g.id}" ${g.id === state.groupId ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select>`)}${panel("監査ログ", audits.length ? audits.map((a) => `<div class="notice-row"><small>${esc(new Date(a.at).toLocaleString("ja-JP"))} / ${esc(a.role || "system")}</small><b>${esc(a.action)}</b><span>${esc(a.detail || a.entityType || "")}</span></div>`).join("") : '<p>記録された操作はまだありません。</p>')}${panel("サンプルデータへ戻す", '<p>編集内容を破棄して、最初の状態に戻します。実行前にバックアップを保存してください。</p><button id="reset" class="danger">初期データへ戻す</button>')}</div>`
    );
  }
  function normalizeState(target) {
    if (!target || typeof target !== "object") return target;
    target.groups = Array.isArray(target.groups) ? target.groups.map((g) => ({ ...g, active: g.active !== false })) : [];
    target.activity = Array.isArray(target.activity) ? target.activity : [];
    target.audit = Array.isArray(target.audit) ? target.audit : [];
    target.equipment = Array.isArray(target.equipment)
      ? target.equipment.map((e) => ({ ...e, status: e.status || "active", serialId: e.serialId || e.id }))
      : [];
    target.groupId = target.groupId || target.groups[0]?.id || "G01";
    target.role = target.role || "admin";
    return target;
  }
  function logAudit(action, detail = "", entityType = "system", entityId = "") {
    state.audit = Array.isArray(state.audit) ? state.audit : [];
    state.audit.unshift({
      at: new Date().toISOString(),
      role: state.role || "system",
      action,
      detail,
      entityType,
      entityId,
    });
    state.audit = state.audit.slice(0, 200);
  }
  function render() {
    let p = page();
    if (!pages[p]) {
      location.hash = "dashboard";
      return;
    }
    $("#role").value = state.role;
    $("#nav").innerHTML = Object.entries(pages)
      .map(
        ([k, v]) =>
          `<a href="#${k}" class="${p === k ? "active" : ""}"><span class="nav-icon">${v[0]}</span>${v[1]}</a>`,
      )
      .join("");
    $("#breadcrumb").textContent = "WORKSPACE / " + pages[p][2];
    $("#content").innerHTML =
      (storageWarning ? `<div class="help">${esc(storageWarning)}</div>` : "") +
      (columnPreferenceWarning
        ? `<div class="help">${esc(columnPreferenceWarning)}</div>`
        : "") +
      (p === "dashboard"
        ? renderDashboard()
        : p === "reception"
          ? renderReception()
          : p === "entranceDashboard"
            ? renderEntranceDashboard()
            : p === "settings"
              ? renderSettings()
              : renderList(p));
    bind(p);
    if (actionInProgress) lockButtons();
  }
  function options(type) {
    if (type === "group" || type === "audience") {
      const groups = state.groups.filter((g) => g.active !== false);
      return [
        ...(type === "audience" ? [["all", "全体"]] : []),
        ...groups.map((g) => [g.id, g.name]),
      ];
    }
    if (type === "venue") return state.venues.map((v) => [v.id, v.name]);
    if (type === "equipment") return state.equipment.map((e) => [e.id, e.name]);
    if (type === "application")
      return [
        ["", "関連なし"],
        ...state.applications.map((a) => [a.id, a.title]),
      ];
    const map = {
      applicationStatus: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "cancelled",
      ],
      reservationStatus: ["approved", "cancelled"],
      loanStatus: ["reserved", "active", "returned"],
      orderStatus: ["ordered", "received", "notArrived", "damaged"],
      supplierCategory: ["発注先", "印刷会社", "レンタル業者", "その他"],
      expenseStatus: ["submitted", "approved", "rejected"],
      taskStatus: ["todo", "active", "done"],
      lostItemStatus: ["stored", "claimed", "disposed"],
      category: ["備品", "消耗品", "外注", "広報", "その他"],
      troubleStatus: ["pending", "active", "waiting", "completed"],
    };
    return (map[type] || []).map((s) => [s, labels[s] || s]);
  }
  function openEditor(p, id, preset = null) {
    const original = id ? state[p].find((r) => r.id === id) : null;
    let row = preset ? { ...preset } : original ? D.editCopy(original) : {};
    if (p === "expenses" && original && !preset) row = D.expenseForEdit(original);
    if (row && row.id === undefined && !preset) delete row.id;
    editing = { p, id: id || null, row, original };
    $("#dialog-title").textContent =
      pages[p][1] + " / " + (id ? "編集" : "新規登録");
    $("#form-fields").innerHTML = fields[p]
      .map(([k, label, type]) => {
        const value =
          row[k] ?? (type === "date" ? today() : type === "number" ? "0" : "");
        let input;
        if (type === "textarea")
          input = `<textarea name="${k}">${esc(value)}</textarea>`;
        else if (
          [
            "text",
            "number",
            "date",
            "time",
            "datetime-local",
            "tel",
            "email",
            "url",
          ].includes(type)
        )
          input = `<input name="${k}" type="${type}" ${type === "number" ? 'step="any"' : ""} value="${esc(value)}" ${["title", "name"].includes(k) ? "required" : ""}>`;
        else
          input = `<select name="${k}">${options(type)
            .map(
              ([v, t]) =>
                `<option value="${esc(v)}" ${String(value) === v ? "selected" : ""}>${esc(t)}</option>`,
            )
            .join("")}</select>`;
        return `<div class="field"><label for="field-${k}">${label}</label>${input.replace('name="' + k + '"', 'id="field-' + k + '" name="' + k + '"')}</div>`;
      })
      .join("");
    if ((p === "applications" || p === "reservations") && original) {
      $("#form-fields").insertAdjacentHTML("beforeend", '<div class="field"><label for="field-attendeeChangeReason">来場人数変更理由</label><textarea id="field-attendeeChangeReason" name="attendeeChangeReason"></textarea></div><div class="field"><label for="field-attendeeChangeEditor">修正者</label><input id="field-attendeeChangeEditor" name="attendeeChangeEditor" value="実行委員"></div>');
    }
    $("#editor").showModal();
  }
  function validate(p, r) {
    if (
      !D.validateRequired(
        r,
        fields[p]
          .filter((f) =>
            [
              "title",
              "name",
              "groupId",
              "venueId",
              "equipmentId",
              "date",
              "orderDate",
              "due",
              "start",
              "end",
              "foundDate",
              "location",
              "storageDeadline",
            ].includes(f[0]),
          )
          .map((f) => f[0]),
      )
    )
      return "必須項目を入力してください";
    if (p === "expenses") return D.validateExpense(r);
    if (
      p === "orders" &&
      r.status === "received" &&
      (!r.receivedAt || !String(r.receivedBy || "").trim())
    )
      return "受領済の場合は受領日時と受領担当者名を入力してください";
    if (p === "groups" && D.duplicateGroup(state, r.name, r.id))
      return "同じ名前の団体が存在します";
    if (["applications", "reservations", "shifts"].includes(p)) {
      const err = D.validateTime(r);
      if (err) return err;
      if (p !== "shifts") {
        const v = state.venues.find((v) => v.id === r.venueId);
        if (v && D.capacityExceeded(r.attendees, v.capacity))
          return "会場の定員を超えています";
        if (p === "reservations" && D.venueConflict(state, r))
          return "会場の予約時間が重複しています";
      }
      if (p === "shifts" && D.shiftConflict(state, r))
        return "スタッフの担当時間が重複しています";
    }
    if (p === "loans") {
      const err = D.validateQuantity(r.quantity);
      if (err) return err;
      const previous = state.loans.find((l) => l.id === r.id);
      const allowance =
        D.available(state, r.equipmentId) +
        (previous &&
        previous.equipmentId === r.equipmentId &&
        previous.status !== "reserved"
          ? Number(previous.quantity)
          : 0);
      if (r.status !== "returned" && r.quantity > allowance)
        return "貸出可能数を超えています";
    }
    return "";
  }
  function bind(p) {
    if (p === "entranceDashboard") {
      $("#refresh-entrances").onclick = () => {
        state.entrances.forEach((entrance) => {
          const count = window.prompt(entrance.name + "の現在の来場人数", String(entrance.count));
          if (count !== null && String(count).trim() !== "") entrance.count = Math.max(0, Number(count) || 0);
        });
        save("入口別来場者数を更新しました");
        render();
      };
    }
    if (p === "reception") {
      $("#ticket-form").onsubmit = (event) => {
        event.preventDefault();
        const code = new FormData(event.target).get("code");
        const result = D.useTicket(state, code);
        const box = $("#ticket-result");
        if (!result.ok) {
          box.className = "ticket-result error";
          box.textContent = "エラー：" + result.error;
          return;
        }
        box.className = "ticket-result success";
        box.textContent = "照合成功：入場を記録しました（" + result.ticket.code + "）";
        save("整理券を受付で使用しました：" + result.ticket.code);
      };
    }
    if (fields[p]) {
      $("#add-row").onclick = (e) =>
        runAction(e.currentTarget, () => openEditor(p), 0);
      $("#search").oninput = (e) => {
        const pos = e.target.selectionStart;
        filterText = e.target.value;
        render();
        $("#search").focus();
        $("#search").setSelectionRange(pos, pos);
      };
      if ($("#status-filter"))
        $("#status-filter").onchange = (e) => {
          filterStatus = e.target.value;
          render();
        };
      if ($("#equipment-filter"))
        $("#equipment-filter").onchange = (e) => {
          filterEquipment = e.target.value;
          render();
        };
      if ($("#supplier-category-filter"))
        $("#supplier-category-filter").onchange = (e) => {
          filterSupplierCategory = e.target.value;
          render();
        };
      document.querySelectorAll("[data-column-visibility]").forEach((input) => {
        input.onchange = (e) => {
          const picker = $("#column-picker");
          const wasOpen = picker.open;
          const selectedKeys = [
            ...document.querySelectorAll(
              "[data-column-visibility]:checked",
            ),
          ].map((checkbox) => checkbox.dataset.columnVisibility);
          if (!selectedKeys.length) {
            e.currentTarget.checked = true;
            toast("少なくとも1つの表示列を選択してください");
            return;
          }
          if (!setVisibleColumns(p, selectedKeys)) {
            e.currentTarget.checked = !e.currentTarget.checked;
            return;
          }
          render();
          $("#column-picker").open = wasOpen;
        };
      });
      if ($("#filter-overdue"))
        $("#filter-overdue").onclick = (e) =>
          runAction(e.currentTarget, () => {
            filterOverdue = !filterOverdue;
            render();
          }, 0);
      $("#sort").onchange = (e) => {
        sortKey = e.target.value;
        render();
      };
      $("#export-csv").onclick = (e) =>
        runAction(e.currentTarget, () =>
          download(
            p + ".csv",
            D.csv(
              state[p],
              fields[p].map((f) => f[0]),
            ),
            "text/csv",
          ),
        );
      document
        .querySelectorAll("[data-edit]")
        .forEach(
          (b) =>
            (b.onclick = (e) =>
              runAction(
                e.currentTarget,
                () => openEditor(p, b.dataset.edit),
                0,
              )),
        );
      document.querySelectorAll("[data-delete]").forEach(
        (b) =>
          (b.onclick = (e) =>
            runAction(e.currentTarget, () => {
              if (p === "groups") {
                const references = D.groupReferences(state, b.dataset.delete);
                if (references.length) {
                  toast(
                    `関連記録があるため削除できません（${references.join("、")}）。記録を確認してください。`,
                  );
                  return;
                }
              }
              if (!confirm("このデータを削除しますか？")) return;
              if (p === "groups") {
                if (!D.deleteGroup(state, b.dataset.delete)) {
                  toast("関連記録があるため削除できません。");
                  return;
                }
              } else
                state[p] = state[p].filter((r) => r.id !== b.dataset.delete);
              save(pages[p][1] + "を削除しました");
              render();
            })),
      );
      document.querySelectorAll("[data-copy]").forEach(
        (b) => {
          b.onclick = () => {
            const app = state.applications.find((x) => x.id === b.dataset.copy);
            if (!app) return;
            const copy = {
              ...app,
              id: undefined,
              status: "draft",
              title: app.title + "（複製）",
            };
            openEditor("applications", null, copy);
          };
        },
      );
      document.querySelectorAll("[data-approve]").forEach(
        (b) =>
          (b.onclick = (e) =>
            runAction(e.currentTarget, () => {
              if (!D.canApprove(state.role)) {
                toast("実行委員の操作です");
                return;
              }
              const a = state.applications.find(
                (x) => x.id === b.dataset.approve,
              );
              const err = D.validateTime(a);
              if (err) {
                toast(err);
                return;
              }
              if (D.venueConflict(state, a)) {
                toast("会場予約が重複しています");
                return;
              }
              D.approve(state, b.dataset.approve);
              save("出店を承認し、会場を予約しました");
              render();
            })),
      );
      document.querySelectorAll("[data-cancel]").forEach(
        (b) =>
          (b.onclick = (e) =>
            runAction(e.currentTarget, () => {
              if (!confirm("出店を取り消しますか？")) return;
              D.cancelApplication(state, b.dataset.cancel);
              save("出店を取り消しました");
              render();
            })),
      );
      document.querySelectorAll("[data-return]").forEach(
        (b) =>
          (b.onclick = (e) =>
            runAction(e.currentTarget, () => {
              D.returnLoan(state, b.dataset.return);
              save("返却を記録しました");
              render();
            })),
      );
      document.querySelectorAll("[data-done]").forEach(
        (b) =>
          (b.onclick = (e) =>
            runAction(e.currentTarget, () => {
              state.tasks.find((t) => t.id === b.dataset.done).status = "done";
              save("タスクを完了しました");
              render();
            })),
      );
      document.querySelectorAll("[data-save-cleaning]").forEach(
        (b) =>
          (b.onclick = (e) =>
            runAction(e.currentTarget, () => {
              const venue = state.venues.find(
                (v) => v.id === b.dataset.saveCleaning,
              );
              if (!venue) {
                toast("会場が見つかりません。画面を再読み込みしてください。");
                return;
              }
              const nextState = structuredClone(state);
              const nextVenue = nextState.venues.find(
                (v) => v.id === b.dataset.saveCleaning,
              );
              nextVenue.cleaningAssignee = $(
                `[data-cleaning-assignee="${venue.id}"]`,
              ).value.trim();
              nextVenue.cleaningCompleted = $(
                `[data-cleaning-completed="${venue.id}"]`,
              ).checked;
              if (!save("会場清掃の担当と完了状況を保存しました", nextState))
                return;
              render();
            })),
      );
    }
    if (p === "settings") {
      const previewRestore = async () => {
        const file = $("#restore-file").files[0];
        const preview = $("#restore-preview");
        if (!file) {
          preview.hidden = true;
          preview.textContent = "";
          return;
        }
        try {
          const text = await file.text();
          const data = JSON.parse(text.replace(/^\uFEFF/, ""));
          if (!D.validateImport(data)) throw Error("形式が不正です");
          const groups = Array.isArray(data.groups) ? data.groups.length : 0;
          const applications = Array.isArray(data.applications)
            ? data.applications.length
            : 0;
          preview.hidden = false;
          preview.innerHTML = `選択中のバックアップ: <strong>${esc(file.name)}</strong><br>団体数 ${groups} 団体 / 申請件数 ${applications} 件`;
        } catch (e) {
          preview.hidden = false;
          preview.textContent = "選択したファイルを読み込めませんでした: " + e.message;
        }
      };
      $("#backup").onclick = () =>
        download(
          "festival-backup-" + today() + ".json",
          JSON.stringify(state, null, 2),
        );
      $("#restore-file").onchange = previewRestore;
      $("#restore").onclick = async () => {
        const file = $("#restore-file").files[0];
        if (!file) {
          toast("ファイルを選んでください");
          return;
        }
        try {
          const data = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
          if (!D.validateImport(data) || !D.validateUniqueIds(data))
            throw Error("形式が不正です");
          const groups = Array.isArray(data.groups) ? data.groups.length : 0;
          const applications = Array.isArray(data.applications)
            ? data.applications.length
            : 0;
          if (
            !confirm(
              `現在のデータを置き換えますか？\n\n${file.name}\n団体数: ${groups} 団体\n申請件数: ${applications} 件`,
            )
          )
            return;
          state = data;
          save("バックアップを復元しました");
          render();
        } catch (e) {
          toast("読み込めませんでした：" + e.message);
        }
      };
      $("#reset").onclick = () => {
        const previewLabels = { groups: "団体", venues: "会場", applications: "企画・申請", reservations: "予約", equipment: "備品", loans: "貸出", expenses: "経費", shifts: "スタッフ配置", tasks: "タスク", troubles: "トラブル", contacts: "緊急連絡先", tickets: "整理券", attendeeChanges: "来場人数変更履歴", notices: "お知らせ" };
        const preview = Object.entries(state)
          .filter(([key, value]) => key !== "activity" && Array.isArray(value))
          .map(([key, value]) => `<li>${esc(previewLabels[key] || key)}: <b>${value.length}件</b></li>`)
          .join("");
        $("#reset-preview-list").innerHTML = preview;
        $("#reset-dialog").showModal();
      };
      $("#reset-cancel").onclick = () => $("#reset-dialog").close();
      $("#reset-confirm").onclick = () => {
        $("#reset-dialog").close();
        state = structuredClone(FestivalSeed);
        storageWarning = "";
        save("初期データへ戻しました");
        render();
      };
      $("#current-group").onchange = (e) => {
        state.groupId = e.target.value;
        save("操作する団体を変更しました");
      };
    }
  }
  $("#edit-form").addEventListener("input", (e) => {
    if (editing?.original && e.target.name && editing.p !== "expenses")
      editing.row[e.target.name] =
        e.target.type === "number" ? Number(e.target.value) : e.target.value;
  });
  $("#edit-form").onsubmit = (e) => {
    e.preventDefault();
    return runAction(
      e.submitter || $('#edit-form button[type="submit"]'),
      () => {
        const { p, id } = editing;
        const r = {
          ...(editing.row || {}),
          ...Object.fromEntries(new FormData(e.target)),
        };
        fields[p]
          .filter((f) => f[2] === "number")
          .forEach((f) => (r[f[0]] = Number(r[f[0]])));
        r.id = id || D.nextId(state[p], prefixes[p]);
        const error = validate(p, r);
        if (error) {
          toast(error);
          return;
        }
        if (p === "expenses") r.amount = D.roundedAmount(r.amount);
        const nextState = structuredClone(state);
        if (id)
          nextState[p][nextState[p].findIndex((x) => x.id === id)] = r;
        else nextState[p].push(r);
        if (!save(pages[p][1] + "を保存しました", nextState)) return;
        $("#editor").close();
        render();
      },
    );
  };
  function closeEditor() {
    $("#editor").close();
    editing = null;
    render();
  }
  $("#close-dialog").onclick = (e) =>
    runAction(e.currentTarget, closeEditor, 0);
  $("#cancel-dialog").onclick = (e) =>
    runAction(e.currentTarget, closeEditor, 0);
  $("#editor").addEventListener("cancel", () => {
    editing = null;
    setTimeout(render, 0);
  });
  $("#role").onchange = (e) => {
    state.role = e.target.value;
    save("操作する役割を変更しました");
    render();
  };
  window.addEventListener("hashchange", () => {
    filterText = "";
    filterStatus = "";
    filterEquipment = "";
    filterSupplierCategory = "";
    filterOverdue = false;
    sortKey = "id";
    render();
  });
  render();
})();
