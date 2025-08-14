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

let editingId = null;

export function initAppUI(){
  const t=todayStr();
  $("date").value = t;
  $("viewDate").value = t;

  $("saveBtn").onclick = onSave;
  $("resetBtn").onclick = resetForm;
  $("deleteBtn").onclick = onDelete;

  $("prevDay").onclick = ()=>shiftViewDate(-1);
  $("nextDay").onclick = ()=>shiftViewDate(1);
  $("viewDate").onchange = renderList;
}

function shiftViewDate(delta){
  const viewDateEl = $("viewDate");
  const d = new Date(viewDateEl.value);
  d.setDate(d.getDate()+delta);
  const z = new Date(d.getTime()-d.getTimezoneOffset()*60000);
  viewDateEl.value = z.toISOString().slice(0,10);
  renderList();
}

export async function renderList(){
  const listEl = $("list");
  listEl.innerHTML = `<div class="muted">Loading…</div>`;
  try {
    const items = await listTodosByDate($("viewDate").value);
    setBadge(statusDb, true);
    if (!items.length){
      listEl.innerHTML = `<div class="muted">No to-dos for <b>${$("viewDate").value}</b>.</div>`;
      return;
    }
    listEl.innerHTML = "";
    for (const t of items){
      const timeText = t.start_time ? t.start_time.slice(0,5) + (t.end_time ? "–" + t.end_time.slice(0,5) : "") : "";
      const div = document.createElement("div"); div.className = "todo";
      div.innerHTML = `
        <div>
          <div class="title">${escapeHtml(t.title)}</div>
          <div class="meta">${timeText} · ${t.date_ymd}${t.notes ? " · " + escapeHtml(t.notes) : ""}</div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
            <span class="chip">${NUM_TO_PRIORITY_LABEL(t.priority)}</span>
          </div>
        </div>
        <div class="actions" style="margin-left:auto">
          <button class="ghost">Edit</button>
          <button class="danger">Delete</button>
        </div>`;
      const [btnEdit, btnDel] = div.querySelectorAll("button");
      btnEdit.onclick = ()=>beginEdit(t);
      btnDel.onclick  = ()=>{ editingId = t.id; onDelete(); };
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

  const payload = { title, notes: $("notes").value || null, date_ymd: date, start_time: start, end_time: end, priority };
  setBadge(statusDb,"warn"); statusMsg.textContent = "Saving…";
  try {
    if (editingId) await updateTodo(editingId, payload);
    else await addTodo(payload);
    setBadge(statusDb,true); statusMsg.textContent = "Saved.";
    await renderList();
    resetForm();
  } catch (e) {
    setBadge(statusDb,false); statusMsg.textContent = "Save failed: " + e.message; alert("Save failed: " + e.message);
  }
}

function resetForm(){
  editingId = null;
  $("title").value = "";
  $("notes").value = "";
  $("date").value = $("viewDate").value;
  $("startTime").value = "";
  $("endTime").value = "";
  $("priority").value = "normal";
  $("deleteBtn").classList.add("hidden");
  $("hint").textContent = "Creating new to-do…";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function beginEdit(t){
  editingId = t.id;
  $("title").value = t.title;
  $("notes").value = t.notes || "";
  $("date").value  = t.date_ymd;
  $("startTime").value = t.start_time ? t.start_time.slice(0,5) : "";
  $("endTime").value   = t.end_time ? t.end_time.slice(0,5) : "";
  $("priority").value  = (t.priority<=1) ? "most_important" : (t.priority===2 ? "important" : "normal");
  $("deleteBtn").classList.remove("hidden");
  $("hint").textContent = "Editing existing to-do…";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function onDelete(){
  if (!editingId) return;
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
