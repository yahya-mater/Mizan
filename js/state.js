/* ═══════════════════════════════════════════════════════════════
   state.js — ميزان
   Application state, localStorage persistence, and DOMContentLoaded
   initialisation. No UI rendering happens here — only data.
═══════════════════════════════════════════════════════════════ */

'use strict';

function generateUniqueId() {
  const maxId = state.transactions.reduce((m, t) => Math.max(m, t.id || 0), 0);
  state.nextId = Math.max(state.nextId, maxId + 1);
  return state.nextId++;
}

/* ── App State ───────────────────────────────────────────────
   DATABASE LOAD POINT: Replace localStorage with API calls.
────────────────────────────────────────────────────────────── */
let state = {
  currentTab:      'archive',
  wizardStep:      0,
  transactionType: null,
  editingId:       null,
  transactions:    [],   // DATABASE LOAD POINT: Load from DB on startup
  nextId:          1,

  settings: {
    schoolName:        '',
    dirName:           '',
    schoolNid:         '',
    headmaster:        '',
    headmasterNid:     '',
    headmasterIdNo:    '',
    headmasterIdPlace: '',
    member1:           '',
    member2:           '',
    member3:           '',
    salfaMax:          75,
    devGrant: {
      date:  '',
      total: 0,
      percentages: {
        learning:    0,
        maintenance: 0,
        partnership: 0,
        supplies:    0,
        excellence:  0,
      },
    },
  },

  openingBalances: {
    date:     '',
    // Seeded from config DEFAULT_ACCOUNTS so the shape is always consistent
    accounts: DEFAULT_ACCOUNTS.map(a => ({ ...a })),
  },
};

/* ── Pending import handle ───────────────────────────────── */
let _pendingImport = null;

/* ── Persistence ─────────────────────────────────────────── */
function persistState() {
  localStorage.setItem('mizan_state', JSON.stringify(state));
}

/* ── Initialisation ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Header date
  const now = new Date();
  document.getElementById('header-date').textContent =
    now.toLocaleDateString('ar-JO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Default form dates / years
  document.getElementById('f-date').value                    = now.toISOString().split('T')[0];
  document.getElementById('report-year-manual').value        = now.getFullYear();
  document.getElementById('ledger-year-manual').value        = now.getFullYear();
  document.getElementById('devledger-year-manual').value     = now.getFullYear();

  // Rehydrate from localStorage
  const saved = localStorage.getItem('mizan_state');
  if (saved) {
    Object.assign(state, JSON.parse(saved));
  
    // ── ID integrity fix ──
    // Step 1: find the true max ID across all transactions
    const maxExistingId = state.transactions.reduce((m, t) => Math.max(m, t.id || 0), 0);
    state.nextId = Math.max(state.nextId || 1, maxExistingId + 1);
  
    // Step 2: fix any duplicate IDs — assign new unique IDs to duplicates
    const seenIds = new Set();
    state.transactions.forEach(tx => {
      if (seenIds.has(tx.id)) {
        const oldId = tx.id;
        tx.id = state.nextId++;
        // Update any salfa items arrays that reference the old ID
        state.transactions.forEach(s => {
          if (s.items && s.items.includes(oldId) && s.salfaId !== tx.salfaId) return;
          if (s.items) {
            s.items = s.items.map(i => i === oldId ? tx.id : i);
          }
        });
        // Update salfaId references on child transactions
        state.transactions.forEach(t => {
          if (t.salfaId === oldId) t.salfaId = tx.id;
        });
      }
      seenIds.add(tx.id);
    });
  
    // Step 3: rebuild salfa items from salfaId to ensure consistency
    state.transactions.filter(s => s.type === 'salfa').forEach(salfa => {
      salfa.items = state.transactions
        .filter(t => t.salfaId === salfa.id)
        .map(t => t.id);
    });
  
    // Step 4: fix salfa serial prefix legacy data
    state.transactions.forEach(tx => {
      if (tx.type === 'salfa' && typeof tx.serial === 'string' && tx.serial.startsWith('ص-')) {
        tx.serial = tx.serial.replace('ص-', '');
      }
    });
  
    // Reset volatile UI state
    state.wizardStep      = 0;
    state.transactionType = null;
    state.editingId       = null;
    persistState();
    loadSettingsForm();
  } else {
    switchTab('settings');
    document.getElementById('first-run-banner').classList.remove('hidden');
  }

  renderArchive();
  updateStats();
  loadOpeningBalancesForm();
});

/* ── First-run banner ────────────────────────────────────── */
function dismissFirstRun() {
  document.getElementById('first-run-banner').classList.add('hidden');
  localStorage.setItem('mizan_setup_done', '1');
}

/* ── Import / Export ─────────────────────────────────────── */
function exportData(scope) {
  let data;
  if (scope === 'all') {
    data = { transactions: state.transactions, settings: state.settings, openingBalances: state.openingBalances };
  } else if (scope === 'transactions') {
    data = { transactions: state.transactions };
  } else if (scope === 'settings') {
    data = { settings: state.settings, openingBalances: state.openingBalances };
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `mizan-export-${new Date().toISOString().split('T')[0]}-${scope}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ تم تصدير البيانات بنجاح', 'success');
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      _pendingImport = data;
      const preview = document.getElementById('import-preview');
      preview.classList.remove('hidden');
      const txCount  = data.transactions?.length ?? '–';
      const hasSet   = !!data.settings;
      preview.innerHTML = `
        <div class="font-semibold text-gray-700 mb-2">معاينة الملف: <span class="text-green-600">${file.name}</span></div>
        <div>المعاملات: <strong>${txCount}</strong></div>
        <div>الإعدادات: <strong>${hasSet ? 'موجودة' : 'غير موجودة'}</strong></div>
        <div class="mt-3 flex gap-2 flex-wrap">
          <button onclick="confirmImport('merge')"  class="text-xs px-3 py-1.5 rounded-lg font-bold bg-orange-500 text-white">دمج مع الحالي</button>
          <button onclick="confirmImport('replace')" class="text-xs px-3 py-1.5 rounded-lg font-bold bg-red-500 text-white">استبدال الكل</button>
          <button onclick="cancelImport()"           class="text-xs px-3 py-1.5 rounded-lg font-bold bg-gray-200 text-gray-600">إلغاء</button>
        </div>`;
    } catch {
      showToast('❌ ملف JSON غير صالح', 'error');
    }
  };
  reader.readAsText(file);
}

function confirmImport(mode) {
  if (!_pendingImport) return;
  const data = _pendingImport;
  if (mode === 'replace') {
    if (data.transactions)    state.transactions    = data.transactions;
    if (data.settings)        state.settings        = data.settings;
    if (data.openingBalances) state.openingBalances = data.openingBalances;
  } else {
    // Merge: append transactions with new IDs to avoid collisions
    if (data.transactions) {
      const maxId = state.transactions.reduce((m, t) => Math.max(m, t.id || 0), 0);
      data.transactions.forEach((tx, i) => {
        state.transactions.push({ ...tx, id: maxId + i + 1 });
      });
    }
    if (data.settings)        Object.assign(state.settings, data.settings);
    if (data.openingBalances) Object.assign(state.openingBalances, data.openingBalances);
  }
  _pendingImport = null;
  cancelImport();
  persistState();
  renderArchive();
  updateStats();
  loadSettingsForm();
  loadOpeningBalancesForm();
  showToast('✅ تم الاستيراد بنجاح', 'success');
}

function cancelImport() {
  _pendingImport = null;
  const preview = document.getElementById('import-preview');
  preview.classList.add('hidden');
  preview.innerHTML = '';
  const fileInput = document.getElementById('import-file-input');
  if (fileInput) fileInput.value = '';
}