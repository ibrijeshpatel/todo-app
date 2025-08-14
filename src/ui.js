import { listTodosByDate, addTodo, updateTodo, softDeleteTodo } from "./todos.js";
import { todayStr, escapeHtml, PRIORITY_TO_NUM, NUM_TO_PRIORITY_LABEL } from "./utils.js";

const $ = (id)=>document.getElementById(id);
const statusDb = $("status-db"), statusMsg = $("status-msg");

function setBadge(el, s){
  el?.classList?.remove("good","warn","err");
  if (s===true){ el.textContent="OK"; el?.classList?.add("good"); }
  else if (s==="warn"){ el.textContent="Check"; el?.classList?.add("warn"); }
  else { el.textContent="Error"; el?.classList?.add("err"); }
}

// Current local time "HH:MM"
function nowHHMM(){
  const d = new Date();
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${h}:${m}`;
}

// Lock rule: date < today OR (date==today AND start_time <= now)
function isLocked(dateYmd, startTime){
  const today = todayStr();
  if (dateYmd < today) return true;
  if (dateYmd > today) return false;
  const st = (startTime || "").slice(0,5); // "HH:MM"
  if (!st) return false; // start required by UI; guard anyway
  return st <= nowHHMM();
}

let editingId = null;
let editingDateYmd = null;
let editingStartHHMM = null;

export function initAppUI(){
  const t = todayStr();

  // Add/Edit form defaults; cannot choose past dates
  $("date").value = t;
  $("date").min   = t;

  // Search date: view anything (no min)
  $("viewDate").value = t;

  $("saveBtn").onclick   = onSave;
  $("resetBtn").onclick  = resetForm;
  $("deleteBtn").onclick = onDelete;

  $("viewDate").onchange = renderList;
}

export async function renderList(){
  const listEl = $("list");
  const theDate = $("viewDate").value;

  listEl.innerHTML = `<div class="muted">Loading…</div>`;
  try {
    const items = await listTodosByDate(theDate);
    setBadge(statusDb, true);

    // Optional banner for read-only days
    const readOnlyDay = theDate < todayStr();
    const banner = readOnlyDay
      ? `<div class="muted" style="margin-bottom:8px">Viewing a past day — items are read-only.</div>`
      : "";

    if (!items.length){
      listEl.innerHTML = `${banner}<div class="muted">No to-dos scheduled for <b>${theDate}</b>.</div>`;
      return;
    }

    listEl.innerHTML = banner;

    for (const t of items){
      const locked = isLocked(t.date_ymd, t.start_time);
      const timeText = t.start_time
        ? t.start_time.slice(0,5) + (t.end_time ? "–" + t.end_time.slice(0,5) : "")
        : "";

      const lockLabel =
        (t.date_ymd < todayStr()) ? "Read-only (past day)" :
        (t.start_time && t.date_ymd === todayStr() && t.start_time.slice(0,5) <= nowHHMM())
          ? "Read-only (already started)" : "";

      const div = document.createElement("div");
      div.className = "todo";
      div.innerHTML = `
        <div>
          <div class="title">${escapeHtml(t.title)}</div>
          <div class="meta">
            ${timeText ? timeText + " · " : ""}${t.date_ymd}
            ${t.notes ? " · " + escapeHtml(t.notes) : ""}
            ${locked ? ' · <span class="chip">'+lockLabel+'</span>' : ""}
          </div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
            <span class="chip">${NUM_TO_PRIORITY_LABEL(t.priority)}</span>
          </div>
        </div>
        ${locked ? "" : `
        <div class="actions" style="margin-left:auto">
          <button class="ghost">Edit</button>
          <button class="danger">Delete</button>
        </div>`}
      `;

      if (!locked){
        const [btnEdit, btnDel] = div.querySelectorAll("button");
        btnEdit.onclick = ()=>beginEdit(t);
        btnDel.onclick  = ()=>{
          editingId = t.id;
          editingDateYmd = t.date_ymd;
          editingStartHHMM = (t.start_time||"").slice(0,5);
          onDelete();
        };
      }

      listEl.appendChild(div);
    }
  } catch (e) {
    setBadge(statusDb,false);
    statusMsg.textContent = "DB error: " + e.message;
    listEl.innerHTML = `<div class="muted">Error: ${e.message}</div>`;
  }
}

async function onSave(){
  const title = ($("title").value||"").trim(); if (!title) return alert("Title required");
  const date  = $("date").value;              if (!date)  return alert("Pick a date");
  const start = $("startTime").value || null; if (!start) return alert("Start time required");
  const end   = $("endTime").value || null;
  const priority = PRIORITY_TO_NUM($("priority").value);

  // Block creating/updating in the past or after start time today
  if (isLocked(date, start)){
    alert("This time is in the past or already started. Pick today later than now, or a future date.");
    return;
  }

  // If editing, ensure the *original* item hasn't already started
  if (editingId && isLocked(editingDateYmd, editingStartHHMM)){
    alert("This task has already started (or is in the past) and cannot be modified.");
    resetForm();
    await renderList();
    return;
  }

  const payload = { title, notes: $("notes").value || null, date_ymd: date, start_time: start, end_time: end, priority };

  setBadge(statusDb,"warn"); statusMsg.textContent = "Saving…";
  try {
    if (editingId) await updateTodo(editingId, payload);
    else await addTodo(payload);

    setBadge(statusDb,true); statusMsg.textContent = "Saved.";

    // show saved day's list
    $("viewDate").value = date;
    await renderList();
    resetForm();
  } catch (e) {
    setBadge(statusDb,false);
    statusMsg.textContent = "Save failed: " + e.message;
    alert("Save failed: " + e.message);
  }
}

function resetForm(){
  editingId = null;
  editingDateYmd = null;
  editingStartHHMM = null;

  const curView = $("viewDate").value || todayStr();
  const t = todayStr();
  $("title").value = "";
  $("notes").value = "";
  // Keep form on current view unless it's a past day, then default to today
  $("date").value = (curView < t) ? t : curView;
  $("date").min   = t;
  $("startTime").value = "";
  $("endTime").value = "";
  $("priority").value = "normal";
  $("deleteBtn").classList.add("hidden");
  $("hint").textContent = "Creating new to-do…";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function beginEdit(t){
  if (isLocked(t.date_ymd, t.start_time)){
    alert("This task has already started (or is in the past) and cannot be edited.");
    return;
  }
  editingId = t.id;
  editingDateYmd = t.date_ymd;
  editingStartHHMM = (t.start_time||"").slice(0,5);

  $("title").value = t.title;
  $("notes").value = t.notes || "";
  $("date").value  = t.date_ymd;
  $("date").min    = todayStr(); // can't move earlier than today
  $("startTime").value = t.start_time ? t.start_time.slice(0,5) : "";
  $("endTime").value   = t.end_time ? t.end_time.slice(0,5) : "";
  $("priority").value  = (t.priority<=1) ? "most_important" : (t.priority===2 ? "important" : "normal");
  $("deleteBtn").classList.remove("hidden");
  $("hint").textContent = "Editing existing to-do…";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function onDelete(){
  if (!editingId) return;

  if (isLocked(editingDateYmd, editingStartHHMM)){
    alert("This task has already started (or is in the past) and cannot be deleted.");
    resetForm();
    return;
  }

  if (!confirm("Delete this to-do?")) return;

  setBadge(statusDb,"warn"); statusMsg.textContent="Deleting…";
  try {
    await softDeleteTodo(editingId);
    setBadge(statusDb,true); statusMsg.textContent="Deleted.";
    await renderList();
    resetForm();
  } catch (e) {
    setBadge(statusDb,false);
    statusMsg.textContent="Delete failed: " + e.message;
    alert("Delete failed: " + e.message);
  }
}
