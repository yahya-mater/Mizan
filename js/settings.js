/* ═══════════════════════════════════════════════════════════════
   settings.js — ميزان
   Settings form, opening balances, and dev-grant configuration.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Settings form ───────────────────────────────────────── */

// Field definitions: [ elementId, stateKey ]
const SETTINGS_FIELDS = [
  ['s-school-name',        'schoolName'       ],
  ['s-dir-name',           'dirName'          ],
  ['s-school-nid',         'schoolNid'        ],
  ['s-headmaster',         'headmaster'       ],
  ['s-headmaster-nid',     'headmasterNid'    ],
  ['s-headmaster-id-no',   'headmasterIdNo'   ],
  ['s-headmaster-id-place','headmasterIdPlace'],
  ['s-member1',            'member1'          ],
  ['s-member2',            'member2'          ],
  ['s-member3',            'member3'          ],
];

function loadSettingsForm() {
  const s = state.settings;

  SETTINGS_FIELDS.forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (el) el.value = s[key] || '';
  });

  // Sidebar labels
  document.getElementById('sidebar-school-name').textContent = s.schoolName || '';
  document.getElementById('sidebar-dir-name').textContent    = s.dirName    || '';

  // Salfa max
  const salfaMaxEl = document.getElementById('s-salfa-max');
  if (salfaMaxEl) salfaMaxEl.value = s.salfaMax || 75;

  // Dev-grant section
  const dg = s.devGrant;
  if (dg) {
    document.getElementById('dg-date').value  = dg.date  || '';
    document.getElementById('dg-total').value = dg.total || '';
    DEV_GRANT_KEYS.forEach(k => {
      const el = document.getElementById(`dg-pct-${k}`);
      if (el) el.value = dg.percentages?.[k] || '';
    });
    recalcDevGrant();
  }
}

// DATABASE SAVE POINT: PUT settings to API
function saveSettings() {
  SETTINGS_FIELDS.forEach(([elId, key]) => {
    state.settings[key] = document.getElementById(elId)?.value.trim() || '';
  });

  // Salfa max
  const salfaMaxVal = parseFloat(document.getElementById('s-salfa-max')?.value) || 75;
  state.settings.salfaMax = salfaMaxVal;

  document.getElementById('sidebar-school-name').textContent = state.settings.schoolName;
  document.getElementById('sidebar-dir-name').textContent    = state.settings.dirName;
  document.getElementById('header-avatar').textContent       = state.settings.headmaster.charAt(0) || 'م';

  showToast('✅ تم حفظ الإعدادات بنجاح', 'success');
  persistState();
}

function setSalfaMax(val) {
  const el = document.getElementById('s-salfa-max');
  if (el) el.value = val;
}

/* ── Dev-grant ───────────────────────────────────────────── */
function recalcDevGrant() {
  const total = parseFloat(document.getElementById('dg-total')?.value) || 0;
  let   pctSum = 0;

  DEV_GRANT_KEYS.forEach(k => {
    const pct = parseFloat(document.getElementById(`dg-pct-${k}`)?.value) || 0;
    pctSum += pct;
    const amt = total * pct / 100;
    const el  = document.getElementById(`dg-amt-${k}`);
    if (el) el.textContent = amt.toFixed(3);
  });

  const pctTotalEl = document.getElementById('dg-pct-total');
  const amtTotalEl = document.getElementById('dg-amt-total');
  const warning    = document.getElementById('dg-pct-warning');

  if (pctTotalEl) pctTotalEl.textContent = pctSum.toFixed(2) + '%';
  if (amtTotalEl) amtTotalEl.textContent = total.toFixed(3);
  if (warning)    warning.classList.toggle('hidden', Math.abs(pctSum - 100) < 0.01 || total === 0);
}

function saveDevGrant() {
  const dg    = state.settings.devGrant;
  dg.date     = document.getElementById('dg-date')?.value  || '';
  dg.total    = parseFloat(document.getElementById('dg-total')?.value) || 0;

  DEV_GRANT_KEYS.forEach(k => {
    dg.percentages[k] = parseFloat(document.getElementById(`dg-pct-${k}`)?.value) || 0;
  });

  showToast('✅ تم حفظ إعدادات منحة التطوير', 'success');
  persistState();
}

/* ── Opening balances ────────────────────────────────────── */

// Colour palette for account colour-picker buttons
const PALETTE = [
  '#d97706', '#2563eb', '#16a34a', '#dc2626', '#f97316',
  '#7c3aed', '#0891b2', '#be185d', '#65a30d', '#9f1239',
];

function renderOpeningBalancesUI() {
  const accounts  = getAccountList().filter(a => !a.excludeFromLedger);
  //const accounts  = getAccountList();
  const container = document.getElementById('ob-accounts-grid');
  if (!container) return;

  container.innerHTML = accounts.map(a => {
    const fd = Math.floor(a.balanceFrom || 0);
    const ff = Math.round(((a.balanceFrom || 0) % 1) * FILS_PER_DINAR);
    const td = Math.floor(a.balanceTo   || 0);
    const tf = Math.round(((a.balanceTo   || 0) % 1) * FILS_PER_DINAR);
    return `
      <div class="ob-account-card rounded-xl p-3 border"
           style="background:${a.color}18; border-color:${a.color}44;" data-key="${a.key}">
        <!-- Name + delete -->
        <div class="flex items-center justify-between mb-2 gap-1">
          <input type="text" class="ob-name font-bold text-xs bg-transparent border-none outline-none w-full"
            style="color:${a.color};" value="${a.name}"
            onchange="obRenameAccount('${a.key}', this.value)" />
          <button onclick="obDeleteAccount('${a.key}')" title="حذف الحساب"
            class="text-gray-300 hover:text-red-500 flex-shrink-0 text-base leading-none">&times;</button>
        </div>
        <!-- Colour picker -->
        <div class="flex gap-1 flex-wrap mb-3">
          ${PALETTE.map(c =>
            `<button onclick="obRecolor('${a.key}','${c}')"
              style="width:12px;height:12px;border-radius:50%;background:${c};border:2px solid ${c === a.color ? '#1e1b18' : 'transparent'};flex-shrink:0;cursor:pointer;"></button>`
          ).join('')}
        </div>
        <!-- من -->
        <div class="text-xs font-bold mb-1" style="color:${a.color}">من</div>
        <div class="flex gap-1 items-center mb-2">
          <input type="number" id="ob-ff-${a.key}" value="${ff || ''}"
            class="form-input text-xs text-center px-1 py-1" placeholder="فلس" min="0" max="999" style="font-size:12px;" />
          <span class="text-xs text-gray-400 flex-shrink-0">.</span>
          <input type="number" id="ob-fd-${a.key}" value="${fd || ''}"
            class="form-input text-xs text-center px-1 py-1" placeholder="دينار" min="0" style="font-size:12px;" />
        </div>
        <!-- إلى -->
        <div class="text-xs font-bold mb-1" style="color:${a.color}">إلى</div>
        <div class="flex gap-1 items-center">
          <input type="number" id="ob-tf-${a.key}" value="${tf || ''}"
            class="form-input text-xs text-center px-1 py-1" placeholder="فلس" min="0" max="999" style="font-size:12px;" />
          <span class="text-xs text-gray-400 flex-shrink-0">.</span>
          <input type="number" id="ob-td-${a.key}" value="${td || ''}"
            class="form-input text-xs text-center px-1 py-1" placeholder="دينار" min="0" style="font-size:12px;" />
        </div>
      </div>`;
  }).join('');
}

function obRenameAccount(key, newName) {
  const a = getAccountList().find(a => a.key === key);
  if (a) a.name = newName.trim() || a.name;
  persistState();
}

function obRecolor(key, color) {
  const a = getAccountList().find(a => a.key === key);
  if (a) { a.color = color; renderOpeningBalancesUI(); }
  persistState();
}

function obDeleteAccount(key) {
  state.openingBalances.accounts = state.openingBalances.accounts.filter(a => a.key !== key);
  renderOpeningBalancesUI();
  persistState();
}

function obAddAccount() {
  const nameEl = document.getElementById('ob-new-name');
  const name   = nameEl?.value.trim();
  if (!name) { showToast('أدخل اسم الحساب أولاً', 'error'); return; }
  if (getAccountList().find(a => a.name === name)) { showToast('هذا الحساب موجود مسبقاً', 'error'); return; }
  const key   = 'custom_' + Date.now();
  const color = PALETTE[getAccountList().length % PALETTE.length];
  state.openingBalances.accounts.push({ key, name, color, balanceFrom: 0, balanceTo: 0 });
  if (nameEl) nameEl.value = '';
  renderOpeningBalancesUI();
  persistState();
}

function saveOpeningBalances() {
  getAccountList().forEach(a => {
    const fd = parseFloat(document.getElementById('ob-fd-' + a.key)?.value) || 0;
    const ff = parseFloat(document.getElementById('ob-ff-' + a.key)?.value) || 0;
    const td = parseFloat(document.getElementById('ob-td-' + a.key)?.value) || 0;
    const tf = parseFloat(document.getElementById('ob-tf-' + a.key)?.value) || 0;
    a.balanceFrom = fd + ff / FILS_PER_DINAR;
    a.balanceTo   = td + tf / FILS_PER_DINAR;
  });
  state.openingBalances.date = document.getElementById('s-opening-date')?.value || '';
  showToast('✅ تم حفظ الأرصدة الافتتاحية', 'success');
  persistState();
}

function loadOpeningBalancesForm() {
  renderOpeningBalancesUI();
  const dateEl = document.getElementById('s-opening-date');
  if (dateEl) dateEl.value = state.openingBalances.date || '';
}

/* ── Account lookup helpers (used by ledger modules) ────── */
function getAccountList() {
  return state.openingBalances.accounts;
}

function getAccountKeyMap() {
  const map = {};
  state.openingBalances.accounts.forEach(a => { map[a.name] = a.key; });
  return map;
}