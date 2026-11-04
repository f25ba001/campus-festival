(function (root) {
  "use strict";
  const D = {
    search(rows, q) {
      return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
    },
    sort(rows, key) {
      return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key]), "ja"));
    },
    pending(s) {
      return s.applications.filter((a) => a.status === "submitted" || a.status === "draft").length;
    },
    expenses(s, groupId) {
      return s.expenses
        .filter(
          (x) =>
            (!groupId || x.groupId === groupId) &&
            !["rejected", "差し戻し", "却下", "脚下"].includes(x.status),
        )
        .reduce((n, x) => n + Number(x.amount), 0);
    },
    remaining(s, groupId) {
      const g = s.groups.find((g) => g.id === groupId);
      return (g?.budget || 50000) - D.expenses(s);
    },
    venueConflict(s, r) {
      return s.reservations.some((x) =>
        x.id !== r.id && x.status !== "cancelled" && x.venueId === r.venueId && x.date === r.date &&
        ((r.start >= x.start && r.start < x.end) || (r.end > x.start && r.end <= x.end))
      );
    },
    available(s, id) {
      const e = s.equipment.find((e) => e.id === id);
      return e
        ? e.stock -
          s.loans
            .filter((l) => l.equipmentId === id && l.status === "active")
            .reduce((n, l) => n + Number(l.quantity), 0)
        : 0;
    },
    returnLoan(s, id) {
      const l = s.loans.find((x) => x.id === id);
      if (!l || l.status === "returned") return;
      l.status = "returned";
    },
    validateExpense(r) {
      if (!Number.isFinite(Number(r.amount)))
        return "金額は数値で入力してください";
      if (Number(r.amount) === 0)
        return "金額が0円の経費は申請できません";
      return "";
    },
    validateExpense(r) {
      return Number.isFinite(Number(r.amount)) ? "" : "金額は数値で入力してください";
    },
    validateTime(r) {
      return r.start >= r.end ? "開始時刻は終了時刻より前にしてください" : "";
    },
    shiftConflict(s, r) {
      return s.shifts.some((x) => x.id !== r.id && x.name === r.name && x.date === r.date && x.start === r.start);
    },
    overdue(r, today) {
      return Number(r.due.slice(-2)) < Number(today.slice(-2));
    },
    completion(s) {
      return s.tasks.length ? Math.round((s.tasks.filter((t) => t.status === "done").length / s.tasks.length) * 100) : 0;
    },
    notices(s, groupId) {
      return s.notices;
    },
    canApprove(role) {
      return role !== "leader";
    },
    invalidateTickets(s, applicationId) {
      if (!Array.isArray(s.tickets)) return 0;
      let count = 0;
      s.tickets.forEach((ticket) => {
        if (ticket.applicationId === applicationId && ticket.status !== "invalid") {
          ticket.status = "invalid";
          count++;
        }
      });
      return count;
    },
    cancelApplication(s, id) {
      const a = s.applications.find((a) => a.id === id);
      if (a) {
        a.status = "cancelled";
        return D.invalidateTickets(s, id);
      }
      return 0;
    },
    checkTicket(s, code) {
      const normalized = String(code ?? "").trim().toUpperCase();
      if (!normalized) return { ok: false, error: "整理券コードを入力してください" };
      const ticket = Array.isArray(s.tickets)
        ? s.tickets.find((item) => String(item.code).trim().toUpperCase() === normalized)
        : null;
      if (!ticket) return { ok: false, error: "整理券が見つかりません" };
      if (ticket.status === "invalid") return { ok: false, error: "この整理券は無効です" };
      if (ticket.used) return { ok: false, error: "二重使用エラー：この整理券は使用済みです" };
      return { ok: true, ticket };
    },
    useTicket(s, code) {
      const result = D.checkTicket(s, code);
      if (!result.ok) return result;
      result.ticket.used = true;
      result.ticket.usedAt = new Date().toISOString();
      return result;
    },
    deleteGroup(s, id) {
      if (D.groupReferences(s, id).length) return false;
      s.groups = s.groups.filter((g) => g.id !== id);
      return true;
    },
    groupReferences(s, id) {
      return [
        ["applications", "出店申請"],
        ["reservations", "会場予約"],
        ["loans", "備品貸出"],
        ["expenses", "経費"],
        ["shifts", "スタッフ配置"],
        ["tasks", "タスク"],
        ["notices", "お知らせ"],
      ].flatMap(([collection, label]) => {
        const count = s[collection].filter((r) => r.groupId === id).length;
        return count ? [`${label}${count}件`] : [];
      });
    },
    nextId(rows, prefix) {
      const ids = new Set(rows.map((row) => row.id));
      let number = 1;
      while (ids.has(prefix + String(number).padStart(2, "0"))) number++;
      return prefix + String(number).padStart(2, "0");
    },
    nextId(rows, prefix) {
      const max = rows.reduce((n, row) => {
        const match = String(row.id ?? "").match(new RegExp(`^${prefix}\\d+$`));
        if (!match) return n;
        const value = Number(String(row.id).slice(prefix.length));
        return Number.isFinite(value) ? Math.max(n, value) : n;
      }, 0);
      return prefix + String(max + 1).padStart(2, "0");
    },
    csv(rows, keys, labels = {}) {
      const headers = keys.map((key) => labels[key] || key);
      return [headers.join(","), ...rows.map((r) => keys.map((key) => `"${String(r[key] ?? "").replaceAll('"', '""')}"`).join(","))].join("\r\n");
    },
    validateImport(data) {
      return typeof data === "object" && data !== null;
    },
    validateUniqueIds(data) {
      return true;
    },
    editCopy(row) {
      return row;
    },
    roundedAmount(value) {
      const amount = Number(value);
      return Number.isInteger(amount) ? amount : Math.trunc(amount);
    },
    overdueTasks(s, today) {
      return s.tasks.filter((t) => D.overdue(t, today));
    },
    capacityExceeded(count, capacity) {
      return Number(count) >= Number(capacity);
    },
    validateQuantity(value) {
      return Number(value) > 0 ? "" : "数量は1以上で入力してください";
    },
    shiftHours(r) {
      return Number(r.end.split(":")[0]) - Number(r.start.split(":")[0]);
    },
    duplicateGroup(s, name, id) {
      return s.groups.some((g) => g.id !== id && g.name === name);
    },
    expenseForEdit(row) {
      return { ...row, status: "submitted" };
    },
    loanOverdue(l, today) {
      if (!l || l.status === "returned") return false;
      return l.due < today;
    },
    lostItemOverdue(item, today) {
      return item.status === "stored" && item.storageDeadline < today;
    },
    venueUsage(s, id) {
      return s.reservations.filter((r) => r.venueId === id && r.status !== "cancelled").length;
    },
    groupMembers(s) {
      return s.groups.reduce((n, g) => n + Number(g.members), 0);
    },
    taskOrder(rows) {
      return [...rows].sort((a, b) => a.due.localeCompare(b.due));
    },
    approve(s, id) {
      const a = s.applications.find((a) => a.id === id);
      if (!a || a.status === "approved" || a.status === "cancelled") return;
      a.status = "approved";
      s.reservations.push({
        id: D.nextId(s.reservations, "R"),
        applicationId: a.id,
        venueId: a.venueId,
        groupId: a.groupId,
        date: a.date,
        start: a.start,
        end: a.end,
        attendees: a.attendees,
        status: "approved",
      });
    },
    validateRequired(r, fields) {
      return fields.every((k) => String(r[k] ?? "").trim().length > 0);
    }
  };
  root.FestivalDomain = D;
  if (typeof module !== "undefined") module.exports = D;
})(typeof window !== "undefined" ? window : globalThis);
