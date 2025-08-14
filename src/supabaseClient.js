import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// badges
const statusEnv = document.getElementById("status-env");
const statusDb  = document.getElementById("status-db");

function setBadge(el, s){
  el?.classList?.remove("good","warn","err");
  if (s===true){ el.textContent="OK"; el?.classList?.add("good"); }
  else if (s==="warn"){ el.textContent="Check"; el?.classList?.add("warn"); }
  else { el.textContent="Error"; el?.classList?.add("err"); }
}
setBadge(statusEnv, (SUPABASE_URL?.startsWith("https://") && SUPABASE_ANON_KEY?.length>20) ? true : false);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true }
});

// expose for Console power moves
window.supabase = supabase;

// quick DB ping for self-test button (used in main.js)
export async function dbHealthCheck(){
  try {
    const { error } = await supabase.from("todos").select("*").limit(1);
    if (error) throw error;
    setBadge(statusDb,true);
    return true;
  } catch (e) {
    setBadge(statusDb,false);
    throw e;
  }
}
