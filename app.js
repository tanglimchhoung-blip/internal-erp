// ===============================
// Internal ERP - app.js (Stable Plain JS)
// - Solid Supabase Auth
// - Never blank screen
// - Clean tab navigation
// ===============================

// 1) PASTE YOUR SUPABASE SETTINGS (FULL values, no "...")
const SUPABASE_URL = "https://zjadnfosmsihjxdwruff.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IWp98Ru-RIFiaUVY3AcobA_rG36EfMv";

// 2) Create client
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------- Small helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function setMsg(el, type, text) {
  el.classList.remove("hidden", "error", "ok");
  el.classList.add(type === "error" ? "error" : "ok");
  el.textContent = text;
}
function clearMsg(el) {
  el.classList.add("hidden");
  el.textContent = "";
  el.classList.remove("error", "ok");
}

// ----------------- UI references
const loginSection = () => $("#loginSection");
const appSection = () => $("#appSection");
const loginMsg = () => $("#loginMsg");
const btnSignOut = () => $("#btnSignOut");

function setAuthedUI(isAuthed) {
  // This guarantees the UI is never blank
  if (isAuthed) {
    hide(loginSection());
    show(appSection());
    show(btnSignOut());
  } else {
    show(loginSection());
    hide(appSection());
    hide(btnSignOut());
  }
}

// ----------------- Tabs
function activateTab(key) {
  $$(".tab").forEach(b => b.classList.remove("active"));
  $$(".tabpane").forEach(p => p.classList.add("hidden"));

  const tabBtn = $(`.tab[data-tab="${key}"]`);
  const pane =
    key === "inv" ? $("#tab-inv") :
    key === "sales" ? $("#tab-sales") :
    key === "exp" ? $("#tab-exp") :
    $("#tab-dash");

  if (tabBtn) tabBtn.classList.add("active");
  if (pane) pane.classList.remove("hidden");
}

function wireTabs() {
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      activateTab(btn.dataset.tab);
    });
  });
}

// ----------------- Auth
async function signIn() {
  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value.trim();
  const msg = loginMsg();
  clearMsg(msg);

  if (!email || !password) {
    setMsg(msg, "error", "Please enter both email and password.");
    return;
  }

  // Prevent spam-click
  const btn = $("#btnSignIn");
  btn.disabled = true;
  btn.textContent = "Signing in...";

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      setMsg(msg, "error", `Login failed: ${error.message}`);
      return;
    }

    if (!data?.session) {
      setMsg(msg, "error", "Login did not return a session. Check Supabase Auth settings.");
      return;
    }

    setMsg(msg, "ok", "Signed in successfully.");
    setAuthedUI(true);
    activateTab("inv");
  } catch (e) {
    setMsg(msg, "error", `Login failed: ${e?.message || e}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
}

async function signUp() {
  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value.trim();
  const msg = loginMsg();
  clearMsg(msg);

  if (!email || !password) {
    setMsg(msg, "error", "Please enter both email and password to sign up.");
    return;
  }

  const btn = $("#btnSignUp");
  btn.disabled = true;
  btn.textContent = "Signing up...";

  try {
    const { data, error } = await sb.auth.signUp({ email, password });

    if (error) {
      setMsg(msg, "error", `Sign up failed: ${error.message}`);
      return;
    }

    if (!data?.session) {
      setMsg(msg, "ok", "Sign up OK. If email confirmation is ON, confirm email then sign in.");
      return;
    }

    setMsg(msg, "ok", "Signed up and logged in.");
    setAuthedUI(true);
    activateTab("inv");
  } catch (e) {
    setMsg(msg, "error", `Sign up failed: ${e?.message || e}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign up (optional)";
  }
}

async function signOut() {
  await sb.auth.signOut();
  setAuthedUI(false);
  clearMsg(loginMsg());
}

// Restore session on load + listen
async function restoreSession() {
  const { data } = await sb.auth.getSession();
  setAuthedUI(!!data?.session);

  sb.auth.onAuthStateChange((_event, session) => {
    setAuthedUI(!!session);
    if (session) activateTab("inv");
  });

  // default tab
  activateTab("inv");
}

// ----------------- Init
document.addEventListener("DOMContentLoaded", async () => {
  // If URL/key wrong, show it clearly (prevents silent blank)
  if (!SUPABASE_URL.startsWith("https://") || !SUPABASE_URL.includes(".supabase.co")) {
    setMsg(loginMsg(), "error", "Supabase URL is invalid. It must be like https://xxxx.supabase.co");
    return;
  }
  if (!SUPABASE_ANON_KEY.startsWith("sb_")) {
    setMsg(loginMsg(), "error", "Supabase key is missing/invalid. Paste the FULL sb_publishable_ key in app.js.");
    return;
  }

  wireTabs();

  $("#btnSignIn").addEventListener("click", (e) => { e.preventDefault(); signIn(); });
  $("#btnSignUp").addEventListener("click", (e) => { e.preventDefault(); signUp(); });
  $("#btnSignOut").addEventListener("click", (e) => { e.preventDefault(); signOut(); });

  // Press Enter to sign in
  $("#loginPassword").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      signIn();
    }
  });

  await restoreSession();
});
