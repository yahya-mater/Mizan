/* ═══════════════════════════════════════════════════════════════
   auth.js — ميزان
   Password protection, lock screen, inactivity timer,
   and recovery (desktop email bridge + browser recovery code).
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Bridge detection ────────────────────────────────────── */
//const IS_DESKTOP = typeof window.CSharpBridge !== 'undefined';
const IS_DESKTOP = typeof window.__IS_DESKTOP__ !== 'undefined' && window.__IS_DESKTOP__ === true;

/* ── Storage keys ────────────────────────────────────────── */
const AUTH_KEY     = 'mizan_auth';
//const SESSION_KEY  = 'mizan_session_unlocked';
// Lives only in memory — destroyed on refresh/close
let _sessionUnlocked = false;

/* ── In-memory state ─────────────────────────────────────── */
let _inactivityTimer  = null;
let _pendingResetCode = null;   // { hash, expiry }
let _recoveryMode     = false;  // true = showing code input

/* ═══════════════════════════════════════════════════════════
   AUTH STORAGE HELPERS
═══════════════════════════════════════════════════════════ */
function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY)) || {};
  } catch { return {}; }
}

function saveAuth(obj) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(obj));
}

function isAuthEnabled() {
  return !!getAuth().enabled;
}

/* ── SHA-256 via WebCrypto ───────────────────────────────── */
async function sha256(text) {
  const buf    = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── Random code generator ───────────────────────────────── */
function randomCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length]).join('');
}

/* ═══════════════════════════════════════════════════════════
   LOCK SCREEN
═══════════════════════════════════════════════════════════ */
function showLockScreen(reason = '') {
  // Hide the entire app shell
  document.getElementById('app-shell')?.classList.add('hidden');
  document.body.classList.add('locked');

  const screen = document.getElementById('lock-screen');
  if (!screen) return;

  _recoveryMode = false;
  _setPanelMode('password');

  document.getElementById('lock-reason').textContent      = reason;
  document.getElementById('lock-password-input').value    = '';
  document.getElementById('lock-error').textContent       = '';
  document.getElementById('lock-recovery-input').value    = '';
  document.getElementById('lock-recovery-error').textContent = '';

  // Show email recovery btn only on desktop + email configured
  const auth = getAuth();
  const emailBtn = document.getElementById('lock-btn-email-recovery');
  if (emailBtn) {
    emailBtn.classList.toggle('hidden', !(IS_DESKTOP && auth.email));
  }
  // Show recovery code btn on browser
  const codeBtn = document.getElementById('lock-btn-code-recovery');
  if (codeBtn) {
    codeBtn.classList.toggle('hidden', IS_DESKTOP || !auth.recoveryHash);
  }

  screen.classList.remove('hidden');
  setTimeout(() => document.getElementById('lock-password-input')?.focus(), 100);

  // Clear session flag
  //sessionStorage.removeItem(SESSION_KEY);
}

function hideLockScreen() {
  document.getElementById('lock-screen')?.classList.add('hidden');
  document.getElementById('app-shell')?.classList.remove('hidden');
  document.body.classList.remove('locked');
  //sessionStorage.setItem(SESSION_KEY, '1');
  _sessionUnlocked = true;
  _startInactivityTimer();
}

function _setPanelMode(mode) {
  // mode: 'password' | 'recovery-code' | 'recovery-email' | 'new-password'
  ['lock-panel-password','lock-panel-recovery-code',
   'lock-panel-recovery-email','lock-panel-new-password'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  document.getElementById(`lock-panel-${mode}`)?.classList.remove('hidden');
}

/* ── Unlock attempt ──────────────────────────────────────── */
async function attemptUnlock() {
  const input = document.getElementById('lock-password-input')?.value || '';
  const auth  = getAuth();
  if (!input) return;

  const hash = await sha256(input);
  if (hash === auth.hash) {
    document.getElementById('lock-error').textContent = '';
    hideLockScreen();
  } else {
    document.getElementById('lock-error').textContent = '❌ كلمة المرور غير صحيحة';
    document.getElementById('lock-password-input').value = '';
    document.getElementById('lock-password-input').focus();
  }
}

/* ═══════════════════════════════════════════════════════════
   RECOVERY — EMAIL (desktop only)
═══════════════════════════════════════════════════════════ */
async function sendRecoveryEmail() {
  const auth = getAuth();
  if (!IS_DESKTOP || !auth.email) return;

  const code   = randomCode(6);
  const hash   = await sha256(code);
  const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  _pendingResetCode = { hash, expiry };

  try {
    const sent = await window.CSharpBridge.sendEmail(
      auth.email,
      'رمز استرداد كلمة المرور – ميزان',
      `رمز الاسترداد الخاص بك هو: ${code}\n\nصالح لمدة 10 دقائق.`
    );
    if (sent) {
      _setPanelMode('recovery-email');
      document.getElementById('lock-recovery-email-addr').textContent = auth.email;
      document.getElementById('lock-recovery-email-input').value = '';
      document.getElementById('lock-recovery-email-error').textContent = '';
    } else {
      showToast('فشل إرسال البريد الإلكتروني', 'error');
    }
  } catch (e) {
    showToast('خطأ في إرسال البريد الإلكتروني', 'error');
  }
}

async function verifyEmailCode() {
  if (!_pendingResetCode) return;
  if (Date.now() > _pendingResetCode.expiry) {
    document.getElementById('lock-recovery-email-error').textContent =
      '❌ انتهت صلاحية الرمز، أعد المحاولة';
    _pendingResetCode = null;
    return;
  }
  const input = document.getElementById('lock-recovery-email-input')?.value.trim().toUpperCase();
  const hash  = await sha256(input);
  if (hash === _pendingResetCode.hash) {
    _pendingResetCode = null;
    _setPanelMode('new-password');
    document.getElementById('lock-new-password-input').value    = '';
    document.getElementById('lock-new-password-confirm').value  = '';
    document.getElementById('lock-new-password-error').textContent = '';
  } else {
    document.getElementById('lock-recovery-email-error').textContent = '❌ الرمز غير صحيح';
  }
}

/* ═══════════════════════════════════════════════════════════
   RECOVERY — CODE (browser)
═══════════════════════════════════════════════════════════ */
function showRecoveryCodePanel() {
  _setPanelMode('recovery-code');
  document.getElementById('lock-recovery-input').value = '';
  document.getElementById('lock-recovery-error').textContent = '';
}

async function verifyRecoveryCode() {
  const auth  = getAuth();
  const input = document.getElementById('lock-recovery-input')?.value.trim().toUpperCase();
  if (!input) return;
  const hash = await sha256(input);
  if (hash === auth.recoveryHash) {
    _setPanelMode('new-password');
    document.getElementById('lock-new-password-input').value    = '';
    document.getElementById('lock-new-password-confirm').value  = '';
    document.getElementById('lock-new-password-error').textContent = '';
  } else {
    document.getElementById('lock-recovery-error').textContent = '❌ رمز الاسترداد غير صحيح';
  }
}

/* ── Set new password after recovery ─────────────────────── */
async function setNewPasswordAfterRecovery() {
  const pw1 = document.getElementById('lock-new-password-input')?.value   || '';
  const pw2 = document.getElementById('lock-new-password-confirm')?.value || '';
  const err = document.getElementById('lock-new-password-error');

  if (pw1.length < 4) { err.textContent = '❌ كلمة المرور يجب أن تكون 4 أحرف على الأقل'; return; }
  if (pw1 !== pw2)    { err.textContent = '❌ كلمتا المرور غير متطابقتين'; return; }

  const auth = getAuth();
  auth.hash  = await sha256(pw1);
  saveAuth(auth);

  err.textContent = '';
  showToast('✅ تم تغيير كلمة المرور بنجاح', 'success');
  hideLockScreen();
}

/* ═══════════════════════════════════════════════════════════
   INACTIVITY TIMER
═══════════════════════════════════════════════════════════ */
function _startInactivityTimer() {
  _clearInactivityTimer();
  const auth    = getAuth();
  const minutes = auth.timeoutMinutes || 0;
  if (!minutes || !auth.enabled) return;

  const ms = minutes * 60 * 1000;
  _inactivityTimer = setTimeout(() => {
    showLockScreen('انتهت مدة الجلسة، يرجى إدخال كلمة المرور');
  }, ms);
}

function _clearInactivityTimer() {
  if (_inactivityTimer) { clearTimeout(_inactivityTimer); _inactivityTimer = null; }
}

function _resetInactivityTimer() {
  if (!isAuthEnabled()) return;
  _clearInactivityTimer();
  _startInactivityTimer();
}

/* Register activity listeners */
['click','keydown','mousemove','touchstart','scroll'].forEach(evt => {
  document.addEventListener(evt, _resetInactivityTimer, { passive: true });
});

/* ═══════════════════════════════════════════════════════════
   KEYBOARD — lock screen
═══════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  const screen = document.getElementById('lock-screen');
  if (!screen || screen.classList.contains('hidden')) return;
  e.stopPropagation(); // block app shortcuts while locked
  if (e.key === 'Enter') {
    const mode = _getCurrentPanelMode();
    if (mode === 'password')        attemptUnlock();
    if (mode === 'recovery-code')   verifyRecoveryCode();
    if (mode === 'recovery-email')  verifyEmailCode();
    if (mode === 'new-password')    setNewPasswordAfterRecovery();
  }
}, true); // capture phase so it runs before other listeners

function _getCurrentPanelMode() {
  const panels = ['password','recovery-code','recovery-email','new-password'];
  return panels.find(m =>
    !document.getElementById(`lock-panel-${m}`)?.classList.contains('hidden')
  ) || 'password';
}

/* ═══════════════════════════════════════════════════════════
   INIT — called from state.js DOMContentLoaded
═══════════════════════════════════════════════════════════ */
function authInit() {
  if (!isAuthEnabled()) return; // no password set

  // If already unlocked this session (e.g. page refresh within same tab)
  //if (sessionStorage.getItem(SESSION_KEY)) {
  //  _startInactivityTimer();
  //  return;
  //}

  // _sessionUnlocked is always false on fresh load/refresh
  // so every page load shows the lock screen
  showLockScreen('');
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS — password management UI functions
═══════════════════════════════════════════════════════════ */

/** Enable password protection for the first time */
async function authSetPassword() {
  const pw1  = document.getElementById('auth-new-pw1')?.value  || '';
  const pw2  = document.getElementById('auth-new-pw2')?.value  || '';
  const err  = document.getElementById('auth-pw-error');

  if (pw1.length < 4) { err.textContent = 'كلمة المرور يجب أن تكون 4 أحرف على الأقل'; return; }
  if (pw1 !== pw2)    { err.textContent = 'كلمتا المرور غير متطابقتين'; return; }

  const auth      = getAuth();
  auth.enabled    = true;
  auth.hash       = await sha256(pw1);
  auth.timeoutMinutes = parseInt(document.getElementById('auth-timeout-setup')?.value) || 15;

  if (IS_DESKTOP) {
    auth.email = document.getElementById('auth-email-setup')?.value.trim() || '';
  } else {
    // Generate recovery code
    const code       = randomCode(8);
    auth.recoveryHash = await sha256(code);
    _showRecoveryCodeOnce(code);
  }

  saveAuth(auth);
  err.textContent = '';
  _renderAuthSettingsUI();
  showToast('✅ تم تفعيل كلمة المرور', 'success');
}

/** Change password — requires current password */
async function authChangePassword() {
  const current = document.getElementById('auth-current-pw')?.value  || '';
  const pw1     = document.getElementById('auth-change-pw1')?.value  || '';
  const pw2     = document.getElementById('auth-change-pw2')?.value  || '';
  const err     = document.getElementById('auth-change-error');

  const auth    = getAuth();
  const curHash = await sha256(current);
  if (curHash !== auth.hash) { err.textContent = '❌ كلمة المرور الحالية غير صحيحة'; return; }
  if (pw1.length < 4)        { err.textContent = 'كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل'; return; }
  if (pw1 !== pw2)           { err.textContent = 'كلمتا المرور غير متطابقتين'; return; }

  auth.hash = await sha256(pw1);
  saveAuth(auth);
  err.textContent = '';

  document.getElementById('auth-current-pw').value  = '';
  document.getElementById('auth-change-pw1').value  = '';
  document.getElementById('auth-change-pw2').value  = '';

  showToast('✅ تم تغيير كلمة المرور', 'success');
}

/** Disable password protection — requires current password */
async function authDisable() {
  const current = document.getElementById('auth-disable-pw')?.value || '';
  const err     = document.getElementById('auth-disable-error');
  const auth    = getAuth();
  const hash    = await sha256(current);

  if (hash !== auth.hash) { err.textContent = '❌ كلمة المرور غير صحيحة'; return; }

  saveAuth({ enabled: false });
  _clearInactivityTimer();
  err.textContent = '';
  _renderAuthSettingsUI();
  showToast('✅ تم تعطيل كلمة المرور', 'success');
}

/** Save timeout setting */
function authSaveTimeout() {
  const auth = getAuth();
  auth.timeoutMinutes = parseInt(document.getElementById('auth-timeout')?.value) || 0;
  saveAuth(auth);
  _startInactivityTimer();
  showToast('✅ تم حفظ إعداد المهلة', 'success');
}

/** Regenerate recovery code (browser only) */
async function authRegenRecoveryCode() {
  const auth = getAuth();
  if (!auth.enabled) return;
  const code        = randomCode(8);
  auth.recoveryHash = await sha256(code);
  saveAuth(auth);
  _showRecoveryCodeOnce(code);
}

/** Save email (desktop only) */
function authSaveEmail() {
  const auth  = getAuth();
  auth.email  = document.getElementById('auth-email')?.value.trim() || '';
  saveAuth(auth);
  showToast('✅ تم حفظ البريد الإلكتروني', 'success');
}

/** Show recovery code in a modal/alert — only shown once */
function _showRecoveryCodeOnce(code) {
  const el = document.getElementById('auth-recovery-code-display');
  if (el) {
    el.textContent = code;
    document.getElementById('auth-recovery-code-box')?.classList.remove('hidden');
  }
}

/** Called from settings tab when it opens */
function loadAuthSettings() {
  _renderAuthSettingsUI();
}

/* ── Manual lock button ──────────────────────────────────── */
function lockNow() {
  _clearInactivityTimer();
  showLockScreen('تم القفل يدوياً');
}


/* ═══════════════════════════════════════════════════════════════
   ADDITIONAL _renderAuthSettingsUI fixes
═══════════════════════════════════════════════════════════════ */

// Override _renderAuthSettingsUI with complete version
function _renderAuthSettingsUI() {
  const auth    = getAuth();
  const enabled = !!auth.enabled;

  document.getElementById('auth-setup-section')?.classList.toggle('hidden',  enabled);
  document.getElementById('auth-manage-section')?.classList.toggle('hidden', !enabled);

  // Email section: desktop only, in both setup + manage
  ['auth-email-section','auth-email-section-setup','auth-email-section-manage'].forEach(id => {
    document.getElementById(id)?.classList.toggle('hidden', !IS_DESKTOP);
  });

  // Recovery code regen: browser only
  const regenBtn = document.getElementById('auth-regen-code-btn');
  if (regenBtn) regenBtn.classList.toggle('hidden', IS_DESKTOP);

  if (enabled) {
    const to = document.getElementById('auth-timeout');
    if (to) to.value = String(auth.timeoutMinutes || 15);
    const em = document.getElementById('auth-email-manage');
    if (em) em.value = auth.email || '';
    document.getElementById('auth-recovery-code-box')?.classList.add('hidden');
  }
};