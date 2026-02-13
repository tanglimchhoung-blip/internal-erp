// ===============================
// Internal ERP - app.js (Stable Plain JS)
// Purpose: reliable Supabase Auth + basic UI toggling
// ===============================

// 1) PUT YOUR REAL SUPABASE SETTINGS HERE
const SUPABASE_URL = "https://zjadnfosmsihjxdwruff.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Iwp98RuRIFiaUVY3AcobA_rG36EfM…"; // <-- keep your full key here

// 2) Create Supabase client (supabase-js v2 is loaded in index.html via CDN)
const sb = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// -------------------------------
// Helpers (safe element finding)
// -------------------------------
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function findInputEmail() {
  return qs("#loginEmail") || qs("#email") || qs('input[type="email"]') || qs('input[name="email"]');
}
function findInputPassword() {
  return qs("#loginPassword") || qs("#password") || qs('input[type="password"]') || qs('input[name="password"]');
}

function findButtonByText(text) {
  const buttons = qsa("button");
  return buttons.find(b => (b.textContent || "").trim().toLowerCase() === text.toLowerCase()) || null;
}
function findSignInButton() {
  return qs("#btnSignIn") || qs("#signInBtn") || qs('[data-action="signin"]') || findButtonByText("Sign in");
}
function findSignUpButton() {
  return qs("#btnSignUp") || qs("#signUpBtn") || qs('[data-action="signup"]') || findButtonByText("Sign up (optional)") || findButtonByText("Sign up");
}

function findLoginCard() {
  // Try common ids first
  return qs("#loginSection") || qs("#loginCard") || qs("#authCard") || qs("#authSection") ||
    // fallback: locate the heading "Login" then take the closest container
    (qsa("h1,h2,h3").find(h => (h.textContent || "").trim().toLowerCase() === "login")?.closest("section,div,main") || null);
}

function findAppMain() {
  return qs("#appSection") || qs("#appMain") || qs("main");
}

function ensureMsgBox() {
  // Preferred existing element
  let el = qs("#loginMsg") || qs("#authMsg");
  if (el) return el;

  // Create one under the login card
  const card = findLoginCard() || qs("body");
  el = document.createElement("div");
  el.id = "loginMsg";
  el.style.marginTop = "12px";
  el.style.padding = "10px 12px";
  el.style.borderRadius = "10px";
  el.style.fontSize = "14px";
  el.style.display = "none";
  card.appendChild(el);
  return el;
}

function showMsg(type, text) {
  const el = ensureMsgBox();
  el.style.display = "block";
  el.textContent = text;

  if (type === "error") {
    el.style.background = "#fff5f5";
    el.style.border = "1px solid #fecaca";
    el.style.color = "#991b1b";
  } else {
    el.style.background = "#f0fdf4";
    el.style.border = "1px solid #bbf7d0";
    el.style.color = "#166534";
  }
}

function hideMsg() {
  const el = ensureMsgBox();
  el.style.display = "none";
  el.textContent = "";
}

function setAuthUI(isAuthed) {
  const loginCard = findLoginCard();
  const appMain = findAppMain();

  // Add a body class so CSS can react if you want later
  document.body.classList.toggle("authed", !!isAuthed);

  // Hide/show login card
  if (loginCard) loginCard.style.display = isAuthed ? "none" : "block";

  // If your app sections are already inside main, we keep main visible,
  // but you may have sections hidden by CSS. This ensures main is visible.
  if (appMain) appMain.style.display = "block";
}

// -------------------------------
// Auth actions
// -------------------------------
async function doSignIn() {
  hideMsg();

  if (!sb) {
    showMsg("error", "Supabase client not loaded. Check index.html includes the Supabase CDN script.");
    return;
  }
  if (!/^https:\/\/.+\.supabase\.co\/?$/.test(SUPABASE_URL)) {
    showMsg("error", "Supabase URL looks invalid. It must be like: https://xxxx.supabase.co");
    return;
  }
  if (!SUPABASE_ANON_KEY || !SUPABASE_ANON_KEY.startsWith("sb_")) {
    showMsg("error", "Supabase key looks invalid. Use the Publishable key (sb_publishable_...).");
    return;
  }

  const emailEl = findInputEmail();
  const passEl = findInputPassword();
  const btn = findSignInButton();

  const email = (emailEl?.value || "").trim();
  const password = (passEl?.value || "").trim();

  if (!email || !password) {
    showMsg("error", "Please enter both email and password.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Signing in...";
  }

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      // Supabase returns meaningful error messages
      showMsg("error", `Login failed: ${error.message}`);
      return;
    }

    // Confirm session exists
    const session = data?.session;
    if (!session) {
      showMsg("error", "Login did not return a session. Try again once. If it repeats, check Supabase Auth settings.");
      return;
    }

    showMsg("success", "Signed in successfully.");
    setAuthUI(true);

    // OPTIONAL: after login you might want to load dropdown lists etc.
    // For now we just move past login. Your existing code can continue from here if needed.
  } catch (e) {
    showMsg("error", `Login failed: ${e?.message || e}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || "Sign in";
    }
  }
}

async function doSignUp() {
  hideMsg();

  const emailEl = findInputEmail();
  const passEl = findInputPassword();
  const btn = findSignUpButton();

  const email = (emailEl?.value || "").trim();
  const password = (passEl?.value || "").trim();

  if (!email || !password) {
    showMsg("error", "Please enter both email and password to sign up.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Signing up...";
  }

  try {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) {
      showMsg("error", `Sign up failed: ${error.message}`);
      return;
    }

    // Depending on Supabase settings, user may need email confirmation
    if (!data?.session) {
      showMsg("success", "Sign up ok. If email confirmation is enabled, confirm your email then sign in.");
    } else {
      showMsg("success", "Signed up and logged in.");
      setAuthUI(true);
    }
  } catch (e) {
    showMsg("error", `Sign up failed: ${e?.message || e}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || "Sign up (optional)";
    }
  }
}

async function restoreSessionOnLoad() {
  if (!sb) return;

  const { data } = await sb.auth.getSession();
  const session = data?.session;

  if (session) {
    setAuthUI(true);
  } else {
    setAuthUI(false);
  }

  // Listen to auth changes (important)
  sb.auth.onAuthStateChange((_event, sessionNow) => {
    setAuthUI(!!sessionNow);
  });
}

// -------------------------------
// Init (wire buttons)
// -------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  // Prevent the "extension async listener" console error from confusing you:
  // It doesn't affect our code.

  if (!sb) {
    showMsg("error", "Supabase library not loaded. In index.html you must have: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    return;
  }

  // Wire buttons
  const btnSignIn = findSignInButton();
  const btnSignUp = findSignUpButton();

  if (btnSignIn) btnSignIn.addEventListener("click", (e) => { e.preventDefault(); doSignIn(); });
  if (btnSignUp) btnSignUp.addEventListener("click", (e) => { e.preventDefault(); doSignUp(); });

  // Also allow pressing Enter in password field
  const passEl = findInputPassword();
  if (passEl) {
    passEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doSignIn();
      }
    });
  }

  // Restore session
  await restoreSessionOnLoad();
});
