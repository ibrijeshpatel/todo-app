import { supabase } from "./supabaseClient.js";

const $ = (id) => document.getElementById(id);
const statusAuth = $("status-auth");
const statusMsg  = $("status-msg");

function setBadge(el, s){
  el?.classList?.remove("good","warn","err");
  if (s === true){ el.textContent = "OK";    el?.classList?.add("good"); }
  else if (s === "warn"){ el.textContent = "Check"; el?.classList?.add("warn"); }
  else { el.textContent = "Error"; el?.classList?.add("err"); }
}

export function initAuthUI(){
  // Tabs
  const tabs = document.querySelectorAll(".tabs button");
  const panels = { signInTab: $("signInTab"), signUpTab: $("signUpTab"), emailOtpTab: $("emailOtpTab") };
  tabs.forEach(btn => btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("active")); btn.classList.add("active");
    Object.values(panels).forEach(p => p.classList.add("hidden"));
    panels[btn.dataset.tab].classList.remove("hidden");
  }));
  $("linkToSignUp").onclick = () => tabs[1].click();
  $("linkToSignIn").onclick = () => tabs[0].click();

  // Sign in (email + password)
  $("btnSignIn").onclick = async () => {
    setBadge(statusAuth, "warn"); statusMsg.textContent = "Signing in…";
    const email = $("emailSignIn").value.trim();
    const password = $("passwordSignIn").value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error){
      setBadge(statusAuth, false);
      statusMsg.textContent = "Sign-in error: " + error.message;
      alert(error.message);
    }
  };

  // Sign up (auto-login when confirmations are OFF; else show confirm message)
  $("btnSignUp").onclick = async () => {
    setBadge(statusAuth, "warn"); statusMsg.textContent = "Creating account…";
    const email = $("emailSignUp").value.trim();
    const pw    = $("passwordSignUp").value;
    const pw2   = $("passwordConfirm").value;
    if (!email || !pw) return alert("Email and password are required.");
    if (pw !== pw2)    return alert("Passwords do not match.");

    const { data, error } = await supabase.auth.signUp({ email, password: pw });
    if (error){
      setBadge(statusAuth, false);
      statusMsg.textContent = "Sign-up error: " + error.message;
      alert(error.message);
      return;
    }

    let autoSignedIn = !!data?.session;
    let signInErr = null;
    if (!autoSignedIn) {
      const res = await supabase.auth.signInWithPassword({ email, password: pw });
      signInErr = res.error;
      autoSignedIn = !signInErr;
    }

    if (autoSignedIn){
      setBadge(statusAuth, true);
      statusMsg.textContent = "Account created — you're signed in.";
      alert("Account created — you're signed in.");
      // onAuthStateChange will flip to the app panel
    } else {
      setBadge(statusAuth, true);
      statusMsg.textContent = "Account created. Check your email to confirm, then sign in.";
      alert("Auto sign-in failed: " + (signInErr?.message || "Email confirmation required."));
      tabs[0].click(); // go to Sign In tab
    }
  };

  // Magic link (Email OTP)
  $("sendEmailOtp").onclick = async () => {
    setBadge(statusAuth, "warn"); statusMsg.textContent = "Sending magic link…";
    const email = $("emailOtp").value.trim();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.href, shouldCreateUser: true }
    });
    if (error){
      setBadge(statusAuth, false);
      statusMsg.textContent = "OTP error: " + error.message;
      alert(error.message);
    } else {
      setBadge(statusAuth, true);
      statusMsg.textContent = "Magic link sent. Check email.";
      alert("Magic link sent. Check your inbox/spam.");
    }
  };

  // Resend confirmation (if confirmations are ON)
  $("linkResend").onclick = async () => {
    const email = $("emailSignIn").value.trim() || prompt("Enter your email to resend confirmation");
    if (!email) return;
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) alert("Resend failed: " + error.message);
    else alert("Confirmation email sent. Please check your inbox/spam.");
  };

  // In-panel sign out no longer exists; guard just in case
  const signOutBtn = document.getElementById("signOut");
  if (signOutBtn) signOutBtn.onclick = async () => { await supabase.auth.signOut(); };
}

// Toggle auth/app panels + header buttons + reset session
export function wireAuthStateHandlers({ onSignedIn, onSignedOut }){
  const userArea     = $("userArea");
  const headerLogout = $("headerLogout");
  const resetSession = $("resetSession");

  supabase.auth.onAuthStateChange(async (_evt, session) => {
    if (session?.user){
      userArea.innerHTML = `Signed in as <b>${session.user.email ?? session.user.id}</b>`;
      headerLogout.classList.remove("hidden");
      resetSession.classList.remove("hidden");

      headerLogout.onclick = async () => { await supabase.auth.signOut(); };

      resetSession.onclick = async () => {
        // Clear local Supabase tokens/cookies and sign out
        Object.keys(localStorage).forEach(k => { if (k.startsWith("sb-")) localStorage.removeItem(k); });
        document.cookie.split(";").forEach(c => {
          const n = c.split("=")[0].trim();
          if (n.startsWith("sb-")) document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        });
        await supabase.auth.signOut();
        location.reload();
      };

      onSignedIn?.();
      setBadge(statusAuth, true);
      statusMsg.textContent = "Signed in.";
    } else {
      userArea.textContent = "";
      headerLogout.classList.add("hidden");
      resetSession.classList.add("hidden");
      onSignedOut?.();
      setBadge(statusAuth, "warn");
      statusMsg.textContent = "Please sign in.";
    }
  });
}
