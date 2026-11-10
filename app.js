"use strict";

const STORAGE_KEY = "followup-care-records";
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
const treatmentOptions = Array.from({ length: 20 }, (_, index) => `療程${index + 1}`);

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function loadRecords() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Stored records must be an array.");
    return parsed;
  } catch (error) {
    showToast("讀取本機資料失敗，請確認瀏覽器儲存空間可用。");
    console.error("Unable to load follow-up records.", error);
    return [];
  }
}

function saveRecords(nextRecords) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    records = nextRecords;
    return true;
  } catch (error) {
    showToast("資料未能儲存，請確認瀏覽器儲存空間可用後重試。");
    console.error("Unable to save follow-up records.", error);
    return false;
  }
}

records = loadRecords();

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
  form.addEventListener("submit", (event) => {
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

    const nextRecords = [{
      id: window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
    }, ...records];

    if (!saveRecords(nextRecords)) return;
    form.reset();
    customDaysField.hidden = true;
    customDaysInput.required = false;
    updateNextTreatmentSummary();
    showToast("資料已儲存在此瀏覽器，請由上方「內部管理」查看。");
  });
}

if (recordsBody) {
  recordsBody.addEventListener("change", (event) => {
    const select = event.target.closest(".status-select");
    if (!select) return;
    const record = records.find((item) => item.id === select.dataset.recordId);
    if (!record) {
      showToast("找不到這筆資料，請重新整理頁面。");
      return;
    }
    const nextRecords = records.map((item) =>
      item.id === record.id ? { ...item, status: select.value } : item
    );
    if (!saveRecords(nextRecords)) return;
    renderDashboard();
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

if (recordsBody) renderDashboard();
