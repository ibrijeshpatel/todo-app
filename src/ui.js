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

// current local time "HH:MM"
function nowTimeStr(){
  const d = new Date();
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${h}:${m}`;
}

// return true if the item should be read-only (started or in the past)
function isReadOnlyByDateTime(dateYmd, startTime){
  const today = todayStr();
  if (dateYmd < today) return true;
  if (dateYmd > today) return false;
  const st = (startTime || '').slice(0,5); // "HH:MM"
  if (!st) return false; // we require start time, but guard anyway
  return st <= nowTimeStr(); // started or past -> lock
}

let editingId = null;
let editingDateYmd = null;
let editingStartHHMM = null;

export function initAppUI(){
  const t = todayStr();

  // Add/Edit form defaults; cannot pick past dates
  $("date").value = t;
  $("date").min   = t;

  // Search date-wise: allow viewing ANY date
  $("viewDate").value = t;

  $("saveBtn").onclick   = onSave;
  $("resetBtn").onclick  = resetForm;
  $("deleteBtn").onclick = onDelete;

  // Auto refresh list whenever the search date changes
  $("viewDate").onchange = renderList;
}

export async function renderList(){
  const listEl = $("list");
  listEl.innerHTML = `<div class="muted">Loading…</div>`;
  try {
    const theDate = $("viewDate").value;
    const items = await listTodosByDate(theDate);
    setBadge(statusDb, true);

    if (!items.length){
      listEl.innerHTML = `<div class="muted">No to-dos scheduled for <b>${theDate}</b>.</div>`;
      return;
    }

    listEl.innerHTML = "";
    const today = todayStr();
    const nowHHMM = nowTimeStr();

    for (const t of items){
      const locked = isReadOnlyByDateTime(t.date_ymd, t.start_time);
      const timeText = t.start_time
        ? t.start_time.slice(0,5) + (t.end_time ? "–" + t.end_time.slice(0,5) : "")
        : "";

      const lockLabel =
        (t.date_ymd < today) ? "Read-only (past day)" :
        (t.date_ymd === today && (t.start_time||'').slice(0,5) <= nowHHMM) ? "Read-only (already started)" :
        "";

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
        btnDel.onclick  = ()=>{ editingId = t.id; editingDateYmd = t.date_ymd; editingStartHHMM = (t.start_time||'').slice(0,5); onDelete(); };
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
  const title = ($("title").value||"").trim(); if(!title) return alert("Title required");
  const date  = $("date").value; if(!date) return alert("Pick a date");
  const start = $("startTime").value || null;
  const end   = $("endTime").value || null;
  if (!start) return alert("Start time required");
  const priority = PRIORITY_TO_NUM($("priority").value);

  const today = todayStr();
  const nowHHMM = nowTimeStr();

  // ⛔ Block creating/updating in the past, and for today if start <= now
  if (date < today){
    alert("You can’t schedule a task on a past date.");
    return;
  }
  if (date === today && start.slice(0,5) <= nowHHMM){
    alert("Start time must be later than the current time.");
    return;
  }

  // Extra guard: if editing an already-started (or past) task, do not allow update
  if (editingId){
    const wasLocked = isReadOnlyByDateTime(editingDateYmd, editingStartHHMM);
    if (wasLocked){
      alert("This task has already started (or is in the past) and cannot be modified.");
      resetForm();
      await renderList();
      return;
    }
  }

  const payload = { title, notes: $("notes").value || null, date_ymd: date, start_time: start, end_time: end, priority };
  setBadge(statusDb,"warn"); statusMsg.textContent = "Saving…";
  try {
    if (editingId) await updateTodo(editingId, payload);
    else await addTodo(payload);

    setBadge(statusDb,true); statusMsg.textContent = "Saved.";

    // Show the saved date in the right panel
    $("viewDate").value = date;
    await renderList();

    resetForm();
  } catch (e) {
    setBadge(statusDb,false); statusMsg.textContent = "Save failed: " + e.message; alert("Save failed: " + e.message);
  }
}

function resetForm(){
  editingId = null;
  editingDateYmd = null;
  editingStartHHMM = null;

  const t = $("viewDate").value || todayStr();
  const today = todayStr();
  $("title").value = "";
  $("notes").value = "";
  $("date").value = (t < today) ? today : t; // if viewing past day, reset form to today
  $("date").min   = today;
  $("startTime").value = "";
  $("endTime").value = "";
  $("priority").value = "normal";
  $("deleteBtn").classList.add("hidden");
  $("hint").textContent = "Creating new to-do…";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function beginEdit(t){
  // Block editing for past/started items
  if (isReadOnlyByDateTime(t.date_ymd, t.start_time)){
    alert("This task has already started (or is in the past) and cannot be edited.");
    return;
  }

  editingId = t.id;
  editingDateYmd = t.date_ymd;
  editingStartHHMM = (t.start_time||'').slice(0,5);

  const today = todayStr();

  $("title").value = t.title;
  $("notes").value = t.notes || "";
  $("date").value  = t.date_ymd;
  $("date").min    = today; // cannot move earlier than today
  $("startTime").value = t.start_time ? t.start_time.slice(0,5) : "";
  $("endTime").value   = t.end_time ? t.end_time.slice(0,5) : "";
  $("priority").value  = (t.priority<=1) ? "most_important" : (t.priority===2 ? "important" : "normal");
  $("deleteBtn").classList.remove("hidden");
  $("hint").textContent = "Editing existing to-do…";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function onDelete(){
  if (!editingId) return;

  // Block deleting for past/started items
  if (isReadOnlyByDateTime(editingDateYmd, editingStartHHMM)){
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
    setBadge(statusDb,false); statusMsg.textContent="Delete failed: " + e.message; alert("Delete failed: " + e.message);
  }
}
