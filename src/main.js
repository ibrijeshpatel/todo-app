import { initAuthUI, wireAuthStateHandlers } from "./auth.js";
import { initAppUI, renderList } from "./ui.js";
import { supabase, dbHealthCheck } from "./supabaseClient.js";

const $ = (id)=>document.getElementById(id);
const statusAuth = $("status-auth");
const statusMsg  = $("status-msg");

function setBadge(el, s){
  el?.classList?.remove("good","warn","err");
  if (s===true){ el.textContent="OK"; el?.classList?.add("good"); }
  else if (s==="warn"){ el.textContent="Check"; el?.classList?.add("warn"); }
  else { el.textContent="Error"; el?.classList?.add("err"); }
}

function showAuth(){ $("authPanel").classList.remove("hidden"); $("appPanel").classList.add("hidden"); }
function showApp(){ $("authPanel").classList.add("hidden"); $("appPanel").classList.remove("hidden"); }

initAuthUI();
wireAuthStateHandlers({
  onSignedIn: async ()=>{
    showApp(); setBadge(statusAuth,true); statusMsg.textContent="Signed in.";
    initAppUI();
    await renderList();
  },
  onSignedOut: ()=>{
    showAuth(); setBadge(statusAuth,"warn"); statusMsg.textContent="Please sign in.";
    $("list").innerHTML="";
  }
});

// initial session
(async ()=>{
  const { data:{ session } } = await supabase.auth.getSession();
  if (session?.user){ showApp(); setBadge(statusAuth,true); initAppUI(); await renderList(); }
  else { showAuth(); setBadge(statusAuth,"warn"); }
})();

// Self-test
$("btnSelfTest").onclick = async ()=>{
  statusMsg.textContent = "Running self-test…";
  try {
    const ping = await fetch(new URL("/auth/v1/health", location.origin.replace(/\/$/, "")).href);
    if (!ping.ok) throw new Error("Auth unreachable");
    await dbHealthCheck();
    statusMsg.textContent = "Self-test OK. If not logged in, sign in to see your data.";
    alert("Self-test OK: Auth reachable + DB reachable.");
  } catch (e) {
    statusMsg.textContent = "Self-test failed: " + e.message;
    alert("Self-test failed: " + e.message + "\nCheck: Redirect URLs, table name, RLS policies.");
  }
};
