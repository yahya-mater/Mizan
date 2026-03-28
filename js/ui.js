/* ═══════════════════════════════════════════════════════════════
   ui.js — ميزان
   Pure UI primitives: toasts, modal helpers, sidebar toggle,
   tab switching. No business logic or data access.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Toast notifications ─────────────────────────────────── */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/* ── Generic modal helpers ───────────────────────────────── */
function showModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('flex');
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('hidden');
  el.classList.remove('flex');
}

/* ── Sidebar (mobile) ────────────────────────────────────── */
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const isOpen   = sidebar.classList.toggle('sidebar-open');
  overlay.classList.toggle('open', isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('sidebar-open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// Close sidebar when clicking overlay
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
});

/* ── Tab switching ───────────────────────────────────────── */
function switchTab(tab) {
  // Hide all panels, show target
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');

  // Update nav button states
  ALL_TABS.forEach(t => {
    const btn = document.getElementById('nav-' + t);
    if (!btn) return;
    btn.classList.remove('active');
    btn.querySelector('.nav-label').className = 'nav-label text-gray-400';
    //btn.querySelector('.nav-icon').className  = 'nav-icon w-5 h-5 text-gray-400';
  });

  const activeBtn = document.getElementById('nav-' + tab);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.querySelector('.nav-label').className = 'nav-label text-white';
    //activeBtn.querySelector('.nav-icon').className  = 'nav-icon w-5 h-5 text-white';
  }

  // Page title / subtitle from config
  const [title, sub] = TAB_TITLES[tab] || ['', ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').textContent   = sub;

  state.currentTab = tab;
  closeSidebar();
}

/* ── Ledger preview overlay ──────────────────────────────── */
function closeLedgerPreview() {
  const overlay = document.getElementById('ledger-preview-overlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
  document.getElementById('ledger-preview-frame').srcdoc = '';
}

function openLedgerPreview(htmlDoc) {
  const overlay = document.getElementById('ledger-preview-overlay');
  const frame   = document.getElementById('ledger-preview-frame');
  frame.srcdoc  = htmlDoc;
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}