"use strict";

const form = document.getElementById("followupForm");
const intervalSelect = document.getElementById("interval");
const customDaysField = document.getElementById("customDaysField");
const customDaysInput = document.getElementById("customDays");
const recordsBody = document.getElementById("recordsBody");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const toast = document.getElementById("toast");
const todayTreatmentsContainer = document.getElementById("todayTreatments");
const nextTreatmentsContainer = document.getElementById("nextTreatments");
const todayTreatmentSummary = document.getElementById("todayTreatmentSummary");
const nextTreatmentSummary = document.getElementById("nextTreatmentSummary");
let records = [];
let toastTimer;
let currentUser = null;
let authorizedUserId = null;
let supabaseClient = null;
const treatmentOptions = Array.from({ length: 20 }, (_, index) => `療程${index + 1}`);

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function fromDatabaseRecord(row) {
  return {
    id: row.id,
    patientName: row.patient_name,
    birthDate: row.birth_date,
    phone: row.phone,
    visitDate: row.visit_date,
    visitContent: row.visit_content || "",
    todayTreatments: row.today_treatments || [],
    treatments: row.treatments || [],
    intervalDays: row.interval_days,
    dueDate: row.due_date,
    dueTime: row.due_time || "",
    assistant: row.assistant,
    status: row.status
  };
}

function toDatabaseRecord(record) {
  return {
    patient_name: record.patientName,
    birth_date: record.birthDate,
    phone: record.phone,
    visit_date: record.visitDate,
    visit_content: record.visitContent || "",
    today_treatments: record.todayTreatments || [],
    treatments: record.treatments || [],
    interval_days: record.intervalDays,
    due_date: record.dueDate,
    due_time: record.dueTime || null,
    assistant: record.assistant,
    status: record.status,
    created_by: currentUser.id
  };
}

async function loadRecords() {
  const { data, error } = await supabaseClient
    .from("followup_records")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  records = data.map(fromDatabaseRecord);
}

async function refreshRecords() {
  try {
    await loadRecords();
    if (recordsBody) renderDashboard();
  } catch (error) {
    console.error("Unable to load shared follow-up records.", error);
    showToast("讀取共用名單失敗，請確認資料表與登入權限設定。");
  }
}

const authGate = document.getElementById("authGate");
const loginForm = document.getElementById("loginForm");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
const passwordRecoveryForm = document.getElementById("passwordRecoveryForm");
const logoutButton = document.getElementById("logoutButton");
const securedView = document.getElementById("formView") || document.getElementById("dashboardView");
let recoveringPassword = false;

async function updateAuthView() {
  if (recoveringPassword) {
    if (authGate) authGate.hidden = false;
    if (loginForm) loginForm.hidden = true;
    if (passwordRecoveryForm) passwordRecoveryForm.hidden = false;
    if (securedView) securedView.hidden = true;
    if (logoutButton) logoutButton.hidden = true;
    return;
  }

  if (loginForm) loginForm.hidden = false;
  if (passwordRecoveryForm) passwordRecoveryForm.hidden = true;
  if (currentUser && authorizedUserId !== currentUser.id) {
    const { data, error } = await supabaseClient
      .from("followup_staff")
      .select("user_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (error) {
      if (authGate) authGate.hidden = false;
      if (securedView) securedView.hidden = true;
      showToast("無法驗證人員權限，請確認已執行最新的資料庫設定。");
      return;
    }
    if (!data) {
      currentUser = null;
      if (authGate) authGate.hidden = false;
      if (securedView) securedView.hidden = true;
      showToast("此帳號尚未加入診所人員白名單。");
      await supabaseClient.auth.signOut();
      return;
    }
    authorizedUserId = currentUser.id;
  }

  if (!currentUser) authorizedUserId = null;
  const signedIn = Boolean(currentUser && authorizedUserId === currentUser.id);
  if (authGate) authGate.hidden = signedIn;
  if (securedView) securedView.hidden = !signedIn;
  if (logoutButton) logoutButton.hidden = !signedIn;
  updateLocalImportButton();
  if (signedIn && recordsBody) refreshRecords();
}

function initializeCloudAuth() {
  const config = window.FOLLOWUP_SUPABASE_CONFIG;
  const configured = config &&
    /^https:\/\//.test(config.url) &&
    config.anonKey &&
    !config.url.includes("PASTE_") &&
    !config.anonKey.includes("PASTE_");

  if (!configured || !window.supabase?.createClient) {
    if (authGate) authGate.hidden = false;
    if (securedView) securedView.hidden = true;
    const message = authGate?.querySelector("p");
    if (message) message.textContent = "請先設定 supabase-config.js，並依設定指南建立資料表與登入帳號。";
    if (loginForm) loginForm.hidden = true;
    return;
  }

  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  supabaseClient.auth.onAuthStateChange((event, session) => {
    window.setTimeout(() => {
      currentUser = session?.user || null;
      if (event === "PASSWORD_RECOVERY") {
        recoveringPassword = true;
        updateAuthView();
        return;
      }
      if (event === "SIGNED_OUT") recoveringPassword = false;
      if (!currentUser) authorizedUserId = null;
      updateAuthView();
    }, 0);
  });

  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      showToast("無法確認登入狀態，請重新整理頁面。");
      return;
    }
    currentUser = data.session?.user || null;
    updateAuthView();
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: document.getElementById("loginEmail").value.trim(),
      password: document.getElementById("loginPassword").value
    });
    button.disabled = false;
    if (error) showToast("登入失敗，請確認帳號與密碼。");
  });
}

if (forgotPasswordButton) {
  forgotPasswordButton.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    if (!email) {
      showToast("請先輸入登入電子郵件。");
      document.getElementById("loginEmail").focus();
      return;
    }
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
    if (error) {
      console.error("Unable to request a password reset.", error);
      showToast(`重設信寄送失敗：${error.message}`);
      return;
    }
    showToast("若此帳號存在，密碼重設信將寄到該電子郵件。");
  });
}

if (passwordRecoveryForm) {
  passwordRecoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!passwordRecoveryForm.reportValidity()) return;
    const password = document.getElementById("newPassword").value;
    const confirmation = document.getElementById("confirmNewPassword").value;
    if (password !== confirmation) {
      showToast("兩次輸入的密碼不一致。");
      return;
    }
    const button = passwordRecoveryForm.querySelector("button[type=submit]");
    button.disabled = true;
    const { error } = await supabaseClient.auth.updateUser({ password });
    button.disabled = false;
    if (error) {
      console.error("Unable to update the password.", error);
      showToast("密碼更新失敗，請重新寄送重設信。");
      return;
    }
    recoveringPassword = false;
    await supabaseClient.auth.signOut();
    showToast("密碼已更新，請使用新密碼登入。");
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) showToast("登出失敗，請稍後再試。");
  });
}

function populateTreatmentOptions(container, name) {
  if (!container) return;
  container.innerHTML = treatmentOptions.map((treatment, index) => {
    const id = `${name}-${index + 1}`;
    return `<label class="check-option" for="${id}">
      <input id="${id}" type="checkbox" name="${name}" value="${treatment}">
      ${treatment}
    </label>`;
  }).join("");
}

populateTreatmentOptions(todayTreatmentsContainer, "todayTreatment");
populateTreatmentOptions(nextTreatmentsContainer, "nextTreatment");

function updateNextTreatmentSummary() {
  if (!nextTreatmentsContainer || !nextTreatmentSummary) return;
  const selectedCount = nextTreatmentsContainer.querySelectorAll("input:checked").length;
  nextTreatmentSummary.textContent = selectedCount
    ? `下次療程（已選 ${selectedCount} 項）`
    : "點此選擇下次療程";
}

function updateTodayTreatmentSummary() {
  if (!todayTreatmentsContainer || !todayTreatmentSummary) return;
  const selectedCount = todayTreatmentsContainer.querySelectorAll("input:checked").length;
  todayTreatmentSummary.textContent = selectedCount
    ? `當天療程（已選 ${selectedCount} 項）`
    : "點此選擇當天療程";
}

if (todayTreatmentsContainer) {
  todayTreatmentsContainer.addEventListener("change", updateTodayTreatmentSummary);
}

if (nextTreatmentsContainer) {
  nextTreatmentsContainer.addEventListener("change", updateNextTreatmentSummary);
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const result = new Date(year, month - 1, day);
  result.setDate(result.getDate() + days);
  const y = result.getFullYear();
  const m = String(result.getMonth() + 1).padStart(2, "0");
  const d = String(result.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const [year, month, day] = dateString.split("-");
  return `${year}/${month}/${day}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function googleCalendarUrl(record) {
  const recordReference = record.id.slice(0, 8);
  const eventTitle = `回診追蹤提醒｜編號 ${recordReference}`;
  const nextTreatments = Array.isArray(record.treatments) && record.treatments.length
    ? record.treatments.join("、")
    : "未指定";
  let eventDates;

  if (record.dueTime) {
    const [year, month, day] = record.dueDate.split("-").map(Number);
    const [hours, minutes] = record.dueTime.split(":").map(Number);
    const start = new Date(year, month - 1, day, hours, minutes);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const formatDateTime = (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
      "T",
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
      "00"
    ].join("");
    eventDates = `${formatDateTime(start)}/${formatDateTime(end)}`;
  } else {
    const nextDay = addDays(record.dueDate, 1).replaceAll("-", "");
    eventDates = `${record.dueDate.replaceAll("-", "")}/${nextDay}`;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle,
    dates: eventDates,
    details: [
      `患者姓名：${record.patientName || "未提供"}`,
      `出生日期：${record.birthDate || "未提供"}`,
      `電話號碼：${record.phone || "未提供"}`,
      `下次療程項目：${nextTreatments}`,
      `回診追蹤紀錄編號：${recordReference}`
    ].join("\n"),
    ctz: "Asia/Taipei"
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function renderDashboard() {
  if (!recordsBody || !emptyState || !searchInput || !statusFilter) return;

  const query = searchInput.value.trim().toLocaleLowerCase();
  const selectedStatus = statusFilter.value;
  const filtered = records.filter((record) => {
    const matchesText = !query ||
      record.patientName.toLocaleLowerCase().includes(query) ||
      record.phone.toLocaleLowerCase().includes(query);
    const matchesStatus = !selectedStatus || record.status === selectedStatus;
    return matchesText && matchesStatus;
  });

  recordsBody.innerHTML = filtered.map((record, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><div class="patient-name">${escapeHtml(record.patientName)}</div><div class="subtext">出生 ${escapeHtml(formatDate(record.birthDate))}</div></td>
      <td>${escapeHtml(record.phone)}</td>
      <td>${escapeHtml(formatDate(record.visitDate))}</td>
      <td><div>${escapeHtml(formatDate(record.dueDate))}</div><div class="subtext">${escapeHtml(record.dueTime || "時間未定")}</div></td>
      <td>${(record.todayTreatments || []).map(escapeHtml).join("、") || "—"}</td>
      <td>${(record.treatments || []).map(escapeHtml).join("、") || "—"}</td>
      <td>${escapeHtml(record.assistant)}</td>
      <td>
        <select class="status-select" data-record-id="${escapeHtml(record.id)}" aria-label="${escapeHtml(record.patientName)}的追蹤狀態">
          ${["待聯絡", "已聯絡", "已預約"].map((status) =>
            `<option value="${status}" ${record.status === status ? "selected" : ""}>${status}</option>`
          ).join("")}
        </select>
      </td>
      <td><a class="calendar-link" href="${escapeHtml(googleCalendarUrl(record))}" target="_blank" rel="noopener noreferrer">加入 Google 行事曆</a></td>
    </tr>
  `).join("");

  emptyState.style.display = filtered.length ? "none" : "block";
  document.getElementById("totalCount").textContent = String(records.length);
  document.getElementById("pendingCount").textContent =
    String(records.filter((record) => record.status === "待聯絡").length);
  document.getElementById("bookedCount").textContent =
    String(records.filter((record) => record.status === "已預約").length);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const dueThisMonth = records.filter((record) => {
    const [year, month, day] = record.dueDate.split("-").map(Number);
    const due = new Date(year, month - 1, day);
    return due >= monthStart && due < nextMonthStart;
  }).length;
  document.getElementById("monthCount").textContent = String(dueThisMonth);
}

if (intervalSelect && customDaysField && customDaysInput) {
  intervalSelect.addEventListener("change", () => {
    const isCustom = intervalSelect.value === "custom";
    customDaysField.hidden = !isCustom;
    customDaysInput.required = isCustom;
    if (!isCustom) customDaysInput.value = "";
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const todayTreatments = data.getAll("todayTreatment");
    const nextTreatments = data.getAll("nextTreatment");
    if (nextTreatments.length === 0) {
      showToast("請至少選擇一項下次療程項目。");
      return;
    }

    const intervalDays = intervalSelect.value === "custom"
      ? Number(customDaysInput.value)
      : Number(intervalSelect.value);
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 1095) {
      showToast("自訂回診天數請填寫 1 至 1095 的整數。");
      customDaysInput.focus();
      return;
    }

    const visitDate = data.get("visitDate");
    const birthDate = data.get("birthDate");
    if (birthDate > visitDate) {
      showToast("出生日期不能晚於看診日期。");
      document.getElementById("birthDate").focus();
      return;
    }

    const record = {
      patientName: String(data.get("patientName")).trim(),
      birthDate,
      phone: String(data.get("phone")).trim(),
      visitDate,
      visitContent: String(data.get("visitContent")).trim(),
      todayTreatments,
      treatments: nextTreatments,
      intervalDays,
      dueDate: addDays(visitDate, intervalDays),
      dueTime: String(data.get("dueTime") || ""),
      assistant: String(data.get("assistant")).trim(),
      status: "待聯絡"
    };

    const submitButton = form.querySelector("button[type=submit]");
    submitButton.disabled = true;
    const { error } = await supabaseClient
      .from("followup_records")
      .insert(toDatabaseRecord(record));
    submitButton.disabled = false;
    if (error) {
      console.error("Unable to save follow-up record.", error);
      showToast("資料未能儲存至共用名單，請檢查網路後重試。");
      return;
    }
    form.reset();
    customDaysField.hidden = true;
    customDaysInput.required = false;
    updateNextTreatmentSummary();
    updateTodayTreatmentSummary();
    showToast("資料已儲存至共用名單。");
  });
}

if (recordsBody) {
  recordsBody.addEventListener("change", async (event) => {
    const select = event.target.closest(".status-select");
    if (!select) return;
    const record = records.find((item) => item.id === select.dataset.recordId);
    if (!record) {
      showToast("找不到這筆資料，請重新整理頁面。");
      return;
    }
    select.disabled = true;
    const { error } = await supabaseClient
      .from("followup_records")
      .update({ status: select.value })
      .eq("id", record.id);
    select.disabled = false;
    if (error) {
      console.error("Unable to update follow-up status.", error);
      showToast("追蹤狀態更新失敗，請重試。");
      select.value = record.status;
      return;
    }
    await refreshRecords();
    showToast("追蹤狀態已更新。");
  });
}

if (searchInput) searchInput.addEventListener("input", renderDashboard);
if (statusFilter) statusFilter.addEventListener("change", renderDashboard);

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const exportButton = document.getElementById("exportButton");
if (exportButton) {
  exportButton.addEventListener("click", () => {
    if (records.length === 0) {
      showToast("目前沒有資料可匯出。");
      return;
    }

    const headers = ["姓名", "出生日期", "聯絡電話", "看診日期", "當天療程", "備註", "下次療程", "回診間隔(天)", "預計回診日期", "回診時間", "填表助理", "狀態"];
    const rows = records.map((record) => [
      record.patientName,
      record.birthDate,
      record.phone,
      record.visitDate,
      (record.todayTreatments || []).join("、"),
      record.visitContent,
      (record.treatments || []).join("、"),
      record.intervalDays,
      record.dueDate,
      record.dueTime,
      record.assistant,
      record.status
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `回診追蹤_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}

const importLocalButton = document.getElementById("importLocalButton");
const LEGACY_STORAGE_KEY = "followup-care-records";
const LEGACY_MIGRATION_KEY = "followup-care-records-migrated-v1";

function readLegacyRecords() {
  try {
    const saved = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read local follow-up records.", error);
    return [];
  }
}

function updateLocalImportButton() {
  if (!importLocalButton || !currentUser) return;
  let alreadyMigrated = false;
  try {
    alreadyMigrated = window.localStorage.getItem(LEGACY_MIGRATION_KEY) === "true";
  } catch (error) {
    console.error("Unable to check local migration status.", error);
  }
  importLocalButton.hidden = alreadyMigrated || readLegacyRecords().length === 0;
}

if (importLocalButton) {
  importLocalButton.addEventListener("click", async () => {
    const oldRecords = readLegacyRecords();
    if (!oldRecords.length) {
      updateLocalImportButton();
      return;
    }
    const confirmed = window.confirm(`將此裝置上的 ${oldRecords.length} 筆舊紀錄匯入共用名單。舊資料會保留在此裝置。要繼續嗎？`);
    if (!confirmed) return;

    importLocalButton.disabled = true;
    const rows = oldRecords.map((record) => ({
      ...toDatabaseRecord(record),
      legacy_id: String(record.id || window.crypto.randomUUID())
    }));
    const { error } = await supabaseClient
      .from("followup_records")
      .upsert(rows, { onConflict: "legacy_id", ignoreDuplicates: true });
    importLocalButton.disabled = false;
    if (error) {
      console.error("Unable to import local follow-up records.", error);
      showToast("舊資料匯入失敗，請確認資料表設定後重試。");
      return;
    }

    try {
      window.localStorage.setItem(LEGACY_MIGRATION_KEY, "true");
    } catch (storageError) {
      console.error("Unable to mark local migration status.", storageError);
    }
    updateLocalImportButton();
    await refreshRecords();
    showToast("此裝置的舊紀錄已匯入共用名單。");
  });
}

initializeCloudAuth();

