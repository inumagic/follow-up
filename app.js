"use strict";

const form = document.getElementById("followupForm");
const intervalSelect = document.getElementById("interval");
const customDaysField = document.getElementById("customDaysField");
const customDaysInput = document.getElementById("customDays");
const recordsBody = document.getElementById("recordsBody");
const editRecordDialog = document.getElementById("editRecordDialog");
const editRecordForm = document.getElementById("editRecordForm");
const editTodayTreatmentsContainer = document.getElementById("editTodayTreatments");
const editNextTreatmentsContainer = document.getElementById("editNextTreatments");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const todayTreatmentFilter = document.getElementById("todayTreatmentFilter");
const nextTreatmentFilter = document.getElementById("nextTreatmentFilter");
const toast = document.getElementById("toast");
const todayTreatmentsContainer = document.getElementById("todayTreatments");
const nextTreatmentsContainer = document.getElementById("nextTreatments");
const todayTreatmentSummary = document.getElementById("todayTreatmentSummary");
const nextTreatmentSummary = document.getElementById("nextTreatmentSummary");
let records = [];
let toastTimer;
let supabaseClient = null;
let editingRecordId = null;
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
    status: row.status,
    createdAt: row.created_at || ""
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
    status: record.status
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
    showToast("讀取名單失敗，請確認登入狀態與資料庫權限設定。");
  }
}

function initializeCloud() {
  const config = window.FOLLOWUP_SUPABASE_CONFIG;
  const configured = config &&
    /^https:\/\//.test(config.url) &&
    config.anonKey &&
    !config.url.includes("PASTE_") &&
    !config.anonKey.includes("PASTE_");

  if (!configured || !window.supabase?.createClient) {
    showToast("請先設定 supabase-config.js 與資料表，再使用共用名單功能。");
    return;
  }

  supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  if (recordsBody) refreshRecords();
  updateLocalImportButton();
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

function populateTreatmentFilterOptions(select, label) {
  if (!select) return;
  select.innerHTML = [
    `<option value="">${label}</option>`,
    ...treatmentOptions.map((treatment) => `<option value="${treatment}">${treatment}</option>`)
  ].join("");
}

populateTreatmentOptions(todayTreatmentsContainer, "todayTreatment");
populateTreatmentOptions(nextTreatmentsContainer, "nextTreatment");
populateTreatmentOptions(editTodayTreatmentsContainer, "editTodayTreatment");
populateTreatmentOptions(editNextTreatmentsContainer, "editNextTreatment");
populateTreatmentFilterOptions(todayTreatmentFilter, "當天療程分類（全部）");
populateTreatmentFilterOptions(nextTreatmentFilter, "下次療程分類（全部）");

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

function formatSubmissionTime(timestamp) {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    calendar: "gregory",
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
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
  const selectedTodayTreatment = todayTreatmentFilter?.value || "";
  const selectedNextTreatment = nextTreatmentFilter?.value || "";
  const filtered = records.filter((record) => {
    const matchesText = !query ||
      record.patientName.toLocaleLowerCase().includes(query) ||
      record.phone.toLocaleLowerCase().includes(query);
    const matchesStatus = !selectedStatus || record.status === selectedStatus;
    const matchesTodayTreatment = !selectedTodayTreatment || (record.todayTreatments || []).includes(selectedTodayTreatment);
    const matchesNextTreatment = !selectedNextTreatment || (record.treatments || []).includes(selectedNextTreatment);
    return matchesText && matchesStatus && matchesTodayTreatment && matchesNextTreatment;
  });

  recordsBody.innerHTML = filtered.map((record, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><div class="patient-name">${escapeHtml(record.patientName)}</div><div class="subtext">出生 ${escapeHtml(formatDate(record.birthDate))}</div></td>
      <td>${escapeHtml(formatSubmissionTime(record.createdAt))}</td>
      <td>${escapeHtml(record.phone)}</td>
      <td>${escapeHtml(formatDate(record.visitDate))}</td>
      <td><div>${escapeHtml(formatDate(record.dueDate))}</div><div class="subtext">${escapeHtml(record.dueTime || "時間未定")}</div></td>
      <td>${(record.todayTreatments || []).map(escapeHtml).join("、") || "—"}</td>
      <td>${(record.treatments || []).map(escapeHtml).join("、") || "—"}</td>
      <td><div class="note-cell-content" title="${escapeHtml(record.visitContent || "")}">${escapeHtml(record.visitContent || "—")}</div></td>
      <td>${escapeHtml(record.assistant)}</td>
      <td>
        <select class="status-select" data-record-id="${escapeHtml(record.id)}" aria-label="${escapeHtml(record.patientName)}的追蹤狀態">
          ${["待聯絡", "已聯絡", "已預約"].map((status) =>
            `<option value="${status}" ${record.status === status ? "selected" : ""}>${status}</option>`
          ).join("")}
        </select>
      </td>
      <td><a class="calendar-link" href="${escapeHtml(googleCalendarUrl(record))}" target="_blank" rel="noopener noreferrer">加入 Google 行事曆</a></td>
      <td><button class="edit-record-button" type="button" data-record-id="${escapeHtml(record.id)}" aria-label="編輯 ${escapeHtml(record.patientName)} 的紀錄">編輯</button>
        <button class="delete-record-button" type="button" data-record-id="${escapeHtml(record.id)}" aria-label="刪除 ${escapeHtml(record.patientName)} 的紀錄">刪除</button></td>
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

function setTreatmentChecks(container, selectedTreatments) {
  if (!container) return;
  container.querySelectorAll("input[type=checkbox]").forEach((input) => {
    input.checked = selectedTreatments.includes(input.value);
  });
}

function openRecordEditor(record) {
  if (!editRecordDialog || !editRecordForm) return;
  editingRecordId = record.id;
  document.getElementById("editPatientName").value = record.patientName || "";
  document.getElementById("editBirthDate").value = record.birthDate || "";
  document.getElementById("editPhone").value = record.phone || "";
  document.getElementById("editVisitDate").value = record.visitDate || "";
  document.getElementById("editVisitContent").value = record.visitContent || "";
  document.getElementById("editIntervalDays").value = record.intervalDays || 30;
  document.getElementById("editDueDate").value = record.dueDate || "";
  document.getElementById("editDueTime").value = record.dueTime || "";
  document.getElementById("editAssistant").value = record.assistant || "";
  document.getElementById("editStatus").value = record.status || "待聯絡";
  setTreatmentChecks(editTodayTreatmentsContainer, record.todayTreatments || []);
  setTreatmentChecks(editNextTreatmentsContainer, record.treatments || []);
  editRecordDialog.showModal();
}

function selectedTreatments(container) {
  return Array.from(container?.querySelectorAll("input[type=checkbox]:checked") || [])
    .map((input) => input.value);
}

if (editRecordDialog) {
  document.getElementById("closeEditDialog")?.addEventListener("click", () => editRecordDialog.close());
  document.getElementById("cancelEditDialog")?.addEventListener("click", () => editRecordDialog.close());
}

if (editRecordForm) {
  editRecordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editRecordForm.reportValidity()) return;
    const record = records.find((item) => item.id === editingRecordId);
    if (!record) {
      showToast("找不到這筆資料，請重新整理頁面後再試。");
      editRecordDialog.close();
      return;
    }

    const intervalDays = Number(document.getElementById("editIntervalDays").value);
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 1095) {
      showToast("回診間隔需為 1 至 1095 的整數。");
      document.getElementById("editIntervalDays").focus();
      return;
    }

    const birthDate = document.getElementById("editBirthDate").value;
    const visitDate = document.getElementById("editVisitDate").value;
    if (birthDate > visitDate) {
      showToast("出生日期不能晚於看診日期。");
      document.getElementById("editBirthDate").focus();
      return;
    }

    const updatedRecord = {
      ...record,
      patientName: document.getElementById("editPatientName").value.trim(),
      birthDate,
      phone: document.getElementById("editPhone").value.trim(),
      visitDate,
      visitContent: document.getElementById("editVisitContent").value.trim(),
      todayTreatments: selectedTreatments(editTodayTreatmentsContainer),
      treatments: selectedTreatments(editNextTreatmentsContainer),
      intervalDays,
      dueDate: document.getElementById("editDueDate").value,
      dueTime: document.getElementById("editDueTime").value,
      assistant: document.getElementById("editAssistant").value.trim(),
      status: document.getElementById("editStatus").value
    };

    const saveButton = document.getElementById("saveEditRecord");
    saveButton.disabled = true;
    try {
      const { error } = await supabaseClient
        .from("followup_records")
        .update(toDatabaseRecord(updatedRecord))
        .eq("id", record.id);
      if (error) throw error;
      editRecordDialog.close();
      await refreshRecords();
      showToast("回診資料已更新。");
    } catch (error) {
      console.error("Unable to update follow-up record.", error);
      showToast(`修改失敗：${error.message || "請確認資料庫權限後重試。"}`);
    } finally {
      saveButton.disabled = false;
    }
  });
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
    if (!supabaseClient) {
      showToast("共用名單尚未連線，請確認 Supabase 設定後重試。");
      return;
    }

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
    try {
      const { error } = await supabaseClient
        .from("followup_records")
        .insert(toDatabaseRecord(record));
      if (error) throw error;
    } catch (error) {
      console.error("Unable to save follow-up record.", error);
      showToast(`資料未能儲存：${error.message || "請檢查資料表設定與網路後重試。"}`);
      return;
    } finally {
      submitButton.disabled = false;
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
  recordsBody.addEventListener("click", async (event) => {
    const editButton = event.target.closest(".edit-record-button");
    if (editButton) {
      const record = records.find((item) => item.id === editButton.dataset.recordId);
      if (record) openRecordEditor(record);
      return;
    }

    const button = event.target.closest(".delete-record-button");
    if (!button) return;

    const record = records.find((item) => item.id === button.dataset.recordId);
    if (!record) {
      showToast("找不到這筆資料，請重新整理頁面。");
      return;
    }
    if (!window.confirm(`確定刪除患者「${record.patientName}」的回診紀錄嗎？此動作無法復原。`)) return;

    button.disabled = true;
    try {
      const { error } = await supabaseClient
        .from("followup_records")
        .delete()
        .eq("id", record.id);
      if (error) throw error;
      records = records.filter((item) => item.id !== record.id);
      renderDashboard();
      showToast("回診紀錄已刪除。");
    } catch (error) {
      console.error("Unable to delete follow-up record.", error);
      button.disabled = false;
      showToast("刪除失敗，請確認登入狀態與資料庫權限後重試。");
    }
  });

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
if (todayTreatmentFilter) todayTreatmentFilter.addEventListener("change", renderDashboard);
if (nextTreatmentFilter) nextTreatmentFilter.addEventListener("change", renderDashboard);

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const CSV_HEADERS = ["姓名", "出生日期", "填表時間", "聯絡電話", "看診日期", "當天療程", "備註", "下次療程", "回診間隔(天)", "預計回診日期", "回診時間", "填表助理", "狀態"];
const CSV_HEADER_ALIASES = {
  patientName: ["姓名", "患者", "患者姓名", "name", "patient_name"],
  birthDate: ["出生日期", "生日", "birth_date", "birthday"],
  phone: ["聯絡電話", "電話", "手機", "電話號碼", "phone", "mobile"],
  visitDate: ["看診日期", "就診日期", "visit_date"],
  createdAt: ["填表時間", "建立時間", "created_at"],
  todayTreatments: ["當天療程", "本次療程", "today_treatments"],
  visitContent: ["備註", "看診內容", "visit_content"],
  treatments: ["下次療程", "下次療程項目", "treatments", "next_treatments"],
  intervalDays: ["回診間隔(天)", "回診間隔", "間隔天數", "interval_days"],
  dueDate: ["預計回診日期", "預計回診", "回診日期", "due_date"],
  dueTime: ["回診時間", "預計回診時間", "due_time"],
  assistant: ["填表助理", "助理", "assistant"],
  status: ["狀態", "追蹤狀態", "status"]
};

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV 有未配對的雙引號。");
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function parseCsvDate(value) {
  const normalized = String(value || "").trim()
    .replace(/[T ]\d{1,2}:\d{2}(?::\d{2})?.*$/, "")
    .replace(/年/g, "-").replace(/月/g, "-").replace(/日$/, "");
  let match = normalized.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  let year;
  let month;
  let day;
  if (match) {
    [, year, month, day] = match;
  } else {
    match = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (!match) return "";
    [, month, day, year] = match;
  }

  const numericYear = Number(year);
  const fullYear = numericYear > 0 && numericYear < 1911 ? numericYear + 1911 : numericYear;
  const date = new Date(Date.UTC(fullYear, Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return "";
  return `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCsvTimestamp(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const taipeiMatch = text.match(/^(\d{4}[/.年-]\d{1,2}[/.月-]\d{1,2}日?)\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (taipeiMatch) {
    const date = parseCsvDate(taipeiMatch[1]);
    if (!date) return "";
    const [, , hours, minutes, seconds = "00"] = taipeiMatch;
    if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return "";
    return new Date(`${date}T${String(hours).padStart(2, "0")}:${minutes}:${seconds}+08:00`).toISOString();
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function csvTreatments(value) {
  return String(value || "").split(/[、，,;；|]/).map((item) => item.trim()).filter(Boolean);
}

function csvFingerprint(value) {
  let first = 2166136261;
  let second = 0x5bd1e995;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822519);
  }
  return `csv-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function mapCsvRecords(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error("CSV 只有標題列，沒有可匯入的資料。");

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim().toLocaleLowerCase());
  const columnIndexes = Object.fromEntries(Object.entries(CSV_HEADER_ALIASES).map(([field, aliases]) => [
    field,
    headers.findIndex((header) => aliases.some((alias) => alias.toLocaleLowerCase() === header))
  ]));
  const missingHeaders = ["patientName", "birthDate", "phone", "visitDate"].filter((field) => columnIndexes[field] < 0);
  if (missingHeaders.length) throw new Error("CSV 必須有姓名、出生日期、聯絡電話、看診日期欄位。可先下載 CSV 範本。");

  const getCell = (row, field) => columnIndexes[field] < 0 ? "" : String(row[columnIndexes[field]] || "").trim();
  const imported = [];
  const errors = [];

  rows.slice(1).forEach((row, offset) => {
    const line = offset + 2;
    const patientName = getCell(row, "patientName");
    const birthDate = parseCsvDate(getCell(row, "birthDate"));
    const phone = getCell(row, "phone");
    const visitDate = parseCsvDate(getCell(row, "visitDate"));
    if (!patientName || !birthDate || !phone || !visitDate) {
      errors.push(`第 ${line} 列：姓名、電話及有效的出生日期與看診日期為必填。`);
      return;
    }
    if (birthDate > visitDate) {
      errors.push(`第 ${line} 列：出生日期不能晚於看診日期。`);
      return;
    }

    const rawInterval = getCell(row, "intervalDays").replace(/\s*天$/, "").trim();
    let intervalDays = rawInterval ? Number(rawInterval) : 30;
    const rawDueDate = getCell(row, "dueDate");
    let dueDate = parseCsvDate(rawDueDate);
    if (rawDueDate && !dueDate) {
      errors.push(`第 ${line} 列：預計回診日期格式無效。`);
      return;
    }
    if (!rawInterval && dueDate) {
      intervalDays = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${visitDate}T00:00:00Z`)) / 86400000);
    }
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 1095) {
      errors.push(`第 ${line} 列：回診間隔需為 1 至 1095 的整數。`);
      return;
    }
    if (!dueDate) dueDate = addDays(visitDate, intervalDays);
    if (dueDate < visitDate) {
      errors.push(`第 ${line} 列：預計回診日期不能早於看診日期。`);
      return;
    }

    const dueTime = getCell(row, "dueTime");
    if (dueTime && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(dueTime)) {
      errors.push(`第 ${line} 列：回診時間格式需為 HH:MM。`);
      return;
    }

    const statusValue = getCell(row, "status");
    const status = ["待聯絡", "已聯絡", "已預約"].includes(statusValue) ? statusValue : "待聯絡";
    imported.push({
      record: {
        patientName,
        birthDate,
        phone,
        visitDate,
        visitContent: getCell(row, "visitContent"),
        todayTreatments: csvTreatments(getCell(row, "todayTreatments")),
        treatments: csvTreatments(getCell(row, "treatments")),
        intervalDays,
        dueDate,
        dueTime,
        assistant: getCell(row, "assistant") || "CSV 匯入",
        status,
        createdAt: parseCsvTimestamp(getCell(row, "createdAt"))
      }
    });
  });

  if (errors.length) throw new Error(`CSV 內容有錯誤，尚未匯入：\n${errors.slice(0, 12).join("\n")}${errors.length > 12 ? `\n另有 ${errors.length - 12} 列錯誤。` : ""}`);
  if (!imported.length) throw new Error("CSV 沒有可匯入的資料列。");
  if (imported.length > 5000) throw new Error("單次最多匯入 5,000 筆，請分批匯入。");
  return imported;
}

function downloadCsvFile(content, fileName) {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const exportButton = document.getElementById("exportButton");
if (exportButton) {
  exportButton.addEventListener("click", () => {
    if (records.length === 0) {
      showToast("目前沒有資料可匯出。");
      return;
    }

    const rows = records.map((record) => [
      record.patientName,
      record.birthDate,
      formatSubmissionTime(record.createdAt),
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
    const csv = [CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    downloadCsvFile(csv, `回診追蹤_${new Date().toISOString().slice(0, 10)}.csv`);
  });
}

const csvImportButton = document.getElementById("csvImportButton");
const csvFileInput = document.getElementById("csvFileInput");
const csvTemplateButton = document.getElementById("csvTemplateButton");

if (csvTemplateButton) {
  csvTemplateButton.addEventListener("click", () => {
    downloadCsvFile(CSV_HEADERS.map(csvCell).join(","), "回診名單匯入範本.csv");
  });
}

if (csvImportButton && csvFileInput) {
  csvImportButton.addEventListener("click", () => csvFileInput.click());
  csvFileInput.addEventListener("change", async () => {
    const file = csvFileInput.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      window.alert("CSV 檔案不可超過 5 MB。");
      csvFileInput.value = "";
      return;
    }

    csvImportButton.disabled = true;
    try {
      let csvText;
      const buffer = await file.arrayBuffer();
      try {
        csvText = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        csvText = new TextDecoder("big5").decode(buffer);
      }
      const imported = mapCsvRecords(csvText);
      if (!window.confirm(`準備匯入 ${imported.length} 筆資料。完全相同的資料會自動略過，確定繼續嗎？`)) return;

      const rows = imported.map(({ record }) => {
        const databaseRecord = toDatabaseRecord(record);
        if (record.createdAt) databaseRecord.created_at = record.createdAt;
        const fingerprint = [
          record.patientName, record.birthDate, record.phone, record.visitDate,
          record.visitContent, record.todayTreatments.join("、"), record.treatments.join("、"),
          record.intervalDays, record.dueDate, record.dueTime, record.assistant
        ].join("\u001f");
        return { ...databaseRecord, legacy_id: csvFingerprint(fingerprint) };
      });

      for (let index = 0; index < rows.length; index += 100) {
        const batch = rows.slice(index, index + 100);
        const { error } = await supabaseClient
          .from("followup_records")
          .upsert(batch, { onConflict: "legacy_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      await refreshRecords();
      showToast(`CSV 已處理 ${rows.length} 筆；重複資料已略過。`);
    } catch (error) {
      console.error("Unable to import CSV follow-up records.", error);
      window.alert(error.message || "CSV 匯入失敗，請確認欄位與資料庫設定後重試。");
    } finally {
      csvImportButton.disabled = false;
      csvFileInput.value = "";
    }
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
  if (!importLocalButton || !supabaseClient) return;
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

initializeCloud();

