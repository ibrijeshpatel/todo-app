export function todayStr(){
  const d=new Date();
  const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return z.toISOString().slice(0,10);
}
export function escapeHtml(s){
  return (s||"").replace(/[&<>\"']/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[c]));
}

// priority mapping
export const PRIORITY_TO_NUM = (v)=> (v==="most_important"?1 : v==="important"?2 : 3);
export const NUM_TO_PRIORITY_LABEL = (n)=> (n<=1?"Most important" : (n===2?"Important":"Normal"));
