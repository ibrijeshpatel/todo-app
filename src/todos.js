import { supabase } from "./supabaseClient.js";

export async function currentUserId(){
  const { data:{ user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listTodosByDate(dateYmd){
  const uid = await currentUserId(); if(!uid) return [];
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", uid)
    .eq("date_ymd", dateYmd)
    .is("deleted_at", null)
    .order("start_time", { ascending: true })
    .order("priority",   { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addTodo(row){
  const uid = await currentUserId(); if(!uid) throw new Error("Not signed in");
  const payload = { ...row, user_id: uid, is_all_day: false };
  const { error } = await supabase.from("todos").insert(payload);
  if (error) throw error;
}

export async function updateTodo(id, row){
  const uid = await currentUserId(); if(!uid) throw new Error("Not signed in");
  const payload = { ...row, user_id: uid, is_all_day: false };
  const { error } = await supabase.from("todos").update(payload).eq("id", id).eq("user_id", uid);
  if (error) throw error;
}

export async function softDeleteTodo(id){
  const uid = await currentUserId(); if(!uid) throw new Error("Not signed in");
  const { error } = await supabase.from("todos").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("user_id", uid);
  if (error) throw error;
}
