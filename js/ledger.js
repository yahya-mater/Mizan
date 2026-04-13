/* ═══════════════════════════════════════════════════════════════
   ledger.js — ميزان
   صندوق يومية (main) and صندوق التطوير (dev) ledger generation,
   shared row/cell builders, print/preview.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Year helpers ────────────────────────────────────────── */
function getLedgerYear() {
  const m = parseInt(document.getElementById('ledger-year-manual').value);
  return m > 1900 ? m : new Date().getFullYear();
}

function getDevLedgerYear() {
  const m = parseInt(document.getElementById('devledger-year-manual').value);
  return m > 1900 ? m : new Date().getFullYear();
}

/* ── Arabic month name (delegates to config constant) ─────── */
function arabicMonthName(m) {
  return ARABIC_MONTHS[m] || String(m);
}

/* ═══════════════════════════════════════════════════════════
   SHARED INLINE CELL/ROW BUILDERS
   Used by both the screen view and the print preview.
═══════════════════════════════════════════════════════════ */

// Format dinar / fils cells for the inline ledger table
const _fmtD = v => v !== null && v !== undefined
  ? `<td class="num">${Math.floor(Math.abs(v))}</td>`
  : `<td class="empty-num">–</td>`;

const _fmtF = v => v !== null && v !== undefined
  ? `<td class="num">${Math.round((Math.abs(v) % 1) * 1000) || '—————'}</td>`
  : `<td class="empty-num">-</td>`;

const _emptyPair = () => `<td class="empty-num">–</td><td class="empty-num"></td>`;

/* ── Transaction row ── */
function buildTxRows(tx, accounts, keyMap) {
  const fromKey     = keyMap[tx.accountFrom] ?? null;
  const toKey       = keyMap[tx.accountTo]   ?? null;
  const amt         = tx.total;
  const purposeText = (tx.purpose || tx.recipient || '').replace(/</g, '&lt;');

  let html = `
    <td>${tx.date}</td>
    <td>${tx.type !== 'journal' ? (tx.serial || '') : ''}</td>
    <td>${tx.transferNo || ''}</td>
    <td>${tx.type === 'journal' ? (tx.serial || '') : ''}</td>
    <td>${tx.receiptNo || ''}</td>
    <td>${tx.receiptDocNo || ''}</td>
    <td class="text-right-cell">${tx.accountFrom || ''}</td>
    <td class="text-right-cell">${tx.accountTo   || ''}</td>
    <td class="text-right-cell">${purposeText}</td>`;

  accounts.forEach(a => {
    html += _fmtF(fromKey === a.key ? amt : null);
    html += _fmtD(fromKey === a.key ? amt : null);
    html += _fmtF(toKey   === a.key ? amt : null);
    html += _fmtD(toKey   === a.key ? amt : null);
  });

  const tr = document.createElement('tr');
  tr.innerHTML = html;
  return [tr];
}

/* ── رصيد مدور row ── */
function buildCarryRow(label, carryFrom, carryTo, accounts, className) {
  const tr = document.createElement('tr');
  tr.className = className;
  let html = `
    <td colspan="6" style="text-align:right;font-weight:700;padding-right:10px;">${label}</td>
    <td colspan="3" style="font-weight:700;text-align:center;">رصيد مدور</td>`;
  accounts.forEach(a => {
    const f = carryFrom[a.key] || 0;
    const t = carryTo[a.key]   || 0;
    html += f ? `${_fmtF(f)}${_fmtD(f)}` : _emptyPair();
    html += t ? `${_fmtF(t)}${_fmtD(t)}` : _emptyPair();
  });
  tr.innerHTML = html;
  return tr;
}

function buildCarryRow(label, carryFrom, carryTo, accounts, className) {
  const tr = document.createElement('tr');
  tr.className = className;
  let html = `
    <td colspan="6" style="text-align:right;font-weight:700;padding-right:10px;">${label}</td>
    <td colspan="3" style="font-weight:700;text-align:center;">رصيد مدور</td>`;
  accounts.forEach(a => {
    const rawFrom = carryFrom[a.key] || 0;
    const rawTo   = carryTo[a.key]   || 0;
    const net     = rawFrom - rawTo;
    const f = net >= 0 ? net : 0;
    const t = net <  0 ? Math.abs(net) : 0;
    html += f ? `${_fmtF(f)}${_fmtD(f)}` : _emptyPair();
    html += t ? `${_fmtF(t)}${_fmtD(t)}` : _emptyPair();
  });
  tr.innerHTML = html;
  return tr;
}

/* ── مجموع row ── */
function buildSumRow(label, monthFrom, monthTo, accounts, className) {
  const tr = document.createElement('tr');
  tr.className = className;
  let html = `
    <td colspan="6" style="text-align:right;font-weight:700;padding-right:10px;">${label}</td>
    <td colspan="3" style="font-weight:700;text-align:center;">مجموع</td>`;
  accounts.forEach(a => {
    const f = monthFrom[a.key] || 0;
    const t = monthTo[a.key]   || 0;
    html += f ? `${_fmtF(f)}${_fmtD(f)}` : _emptyPair();
    html += t ? `${_fmtF(t)}${_fmtD(t)}` : _emptyPair();
  });
  tr.innerHTML = html;
  return tr;
}

/* ── رصيد row ── */
function buildResidRow(label, monthFrom, monthTo, accounts, className) {
  const tr = document.createElement('tr');
  tr.className = className;
  let html = `
    <td colspan="6" style="text-align:right;font-weight:700;padding-right:10px;">${label}</td>
    <td colspan="3" style="font-weight:700;text-align:center;">رصيد</td>`;
  accounts.forEach(a => {
    const net = (monthFrom[a.key] || 0) - (monthTo[a.key] || 0);
    if (net >= 0) {
      html += net > 0 ? `${_fmtF(net)}${_fmtD(net)}` : _emptyPair();
      html += _emptyPair();
    } else {
      html += _emptyPair();
      html += `${_fmtF(Math.abs(net))}${_fmtD(Math.abs(net))}`;
    }
  });
  tr.innerHTML = html;
  return tr;
}

/* ── Thead rebuild ── */
function rebuildLedgerThead(accounts) {
  const thead = document.querySelector('#ledger-table-main thead');
  thead.innerHTML = `
    <tr>
      <th rowspan="3" style="min-width:88px;">التاريخ</th>
      <th rowspan="3" style="min-width:64px;">رقم مستند الصرف</th>
      <th rowspan="3" style="min-width:64px;">رقم التحويل</th>
      <th rowspan="3" style="min-width:64px;">رقم مستند القيد</th>
      <th rowspan="3" style="min-width:56px;">رقم الوصل</th>
      <th rowspan="3" style="min-width:64px;">رقم مستند القبض</th>
      <th colspan="3">الحساب</th>
      ${accounts.map(a => `<th colspan="4" style="background:${a.color};color:#fff;">${a.name}</th>`).join('')}
    </tr>
    <tr>
      <th rowspan="2" style="min-width:70px;">منه</th>
      <th rowspan="2" style="min-width:70px;">له</th>
      <th rowspan="2" style="min-width:130px;text-align:right;padding-right:6px;">البيان</th>
      ${accounts.map(() => `<th colspan="2">من</th><th colspan="2">إلى</th>`).join('')}
    </tr>
    <tr>
      ${accounts.map(() => `<th>فلس</th><th>دينار</th><th>فلس</th><th>دينار</th>`).join('')}
    </tr>`;
}

/* ── Balance bar ── */
function renderBalanceBar(balances, accounts) {
  const bar = document.getElementById('ledger-balance-bar');
  if (!bar) return;
  bar.innerHTML = (accounts || getAccountList()).map(a => {
    const amt = balances[a.key] || 0;
    return `
      <div class="card p-3 text-center border-t-4" style="border-color:${a.color}">
        <div class="text-xs font-bold mb-1" style="color:${a.color}">${a.name}</div>
        <div class="font-black text-gray-800 text-sm">${amt.toFixed(3)}</div>
        <div class="text-xs text-gray-400">د.أ</div>
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════
   LEDGER DATA HELPER
   Returns { carryFrom, carryTo, txsThisMonth, monthFrom, monthTo, totalFrom, totalTo }
   for any set of accounts and a target month/year.
═══════════════════════════════════════════════════════════ */
function computeLedgerData(targetMonth, targetYear, accounts, keyMap, seedCarry = null) {
  const excludedNames = new Set(
    getAccountList()
      .filter(a => a.excludeFromLedger)
      .map(a => a.name)
  );

  const sorted = [...state.transactions]
  .filter(tx => {
    if (excludedNames.has(tx.accountFrom) || excludedNames.has(tx.accountTo)) return false;
    if (tx.type === 'salfa' || tx.type === 'salfa_yad') return tx.status === 'closed';
    return true;
  })
  .map(tx => (tx.type === 'salfa' || tx.type === 'salfa_yad') ? { ...tx, date: tx.transferDate } : tx)
  .sort((a, b) => a.date.localeCompare(b.date));

  //const sorted      = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date)).filter(a => !a.excludeFromLedger);
  const targetStart = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;

  const carryFrom = {}, carryTo = {};
  if (seedCarry) {
    accounts.forEach(a => {
      carryFrom[a.key] = seedCarry.from[a.key] || 0;
      carryTo[a.key]   = seedCarry.to[a.key]   || 0;
    });
  } else {
    accounts.forEach(a => {
      carryFrom[a.key] = a.balanceFrom || 0;
      carryTo[a.key]   = a.balanceTo   || 0;
    });
  }

  sorted.filter(tx => tx.date < targetStart).forEach(tx => {
    const fk = keyMap[tx.accountFrom];
    const tk = keyMap[tx.accountTo];
    if (fk !== undefined) carryFrom[fk] = (carryFrom[fk] || 0) + tx.total;
    if (tk !== undefined) carryTo[tk]   = (carryTo[tk]   || 0) + tx.total;
  });

  const txsThisMonth = sorted.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth;
  });

  const monthFrom = {}, monthTo = {};
  accounts.forEach(a => { monthFrom[a.key] = 0; monthTo[a.key] = 0; });
  txsThisMonth.forEach(tx => {
    const fk = keyMap[tx.accountFrom];
    const tk = keyMap[tx.accountTo];
    if (fk !== undefined) monthFrom[fk] = (monthFrom[fk] || 0) + tx.total;
    if (tk !== undefined) monthTo[tk]   = (monthTo[tk]   || 0) + tx.total;
  });

  const totalFrom = {}, totalTo = {};
  accounts.forEach(a => {
    totalFrom[a.key] = (carryFrom[a.key] || 0) + (monthFrom[a.key] || 0);
    totalTo[a.key]   = (carryTo[a.key]   || 0) + (monthTo[a.key]   || 0);
  });

  // Net the carry down to رصيد of previous month
  accounts.forEach(a => {
    const net = (carryFrom[a.key] || 0) - (carryTo[a.key] || 0);
    if (net >= 0) { carryFrom[a.key] = net; carryTo[a.key]  = 0; }
    else          { carryFrom[a.key] = 0;   carryTo[a.key]  = Math.abs(net); }
  });

  return { sorted, targetStart, carryFrom, carryTo, txsThisMonth, monthFrom, monthTo, totalFrom, totalTo };
}

function computeDevLedgerData(targetMonth, targetYear, accounts, keyMap, bankAcc, devAcc, dgTotal) {
  const sorted      = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date));
  const targetStart = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;

  const isBankDev = tx => {
    const fk = keyMap[tx.accountFrom], tk = keyMap[tx.accountTo];
    return (fk === bankAcc?.key && tk === devAcc?.key) ||
           (fk === devAcc?.key  && tk === bankAcc?.key);
  };

  // Seed: dgTotal modeled as opening بنك→تطوير
  const carryFrom = {}, carryTo = {};
  accounts.forEach(a => { carryFrom[a.key] = 0; carryTo[a.key] = 0; });
  if (bankAcc) carryFrom[bankAcc.key] = dgTotal;
  if (devAcc)  carryTo[devAcc.key]   = dgTotal;

  sorted.filter(tx => tx.date < targetStart && isBankDev(tx)).forEach(tx => {
    const fk = keyMap[tx.accountFrom], tk = keyMap[tx.accountTo];
    if (fk !== undefined) carryFrom[fk] = (carryFrom[fk] || 0) + tx.total;
    if (tk !== undefined) carryTo[tk]   = (carryTo[tk]   || 0) + tx.total;
  });

  const txsThisMonth = sorted.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth && isBankDev(tx);
  });

  const monthFrom = {}, monthTo = {};
  accounts.forEach(a => { monthFrom[a.key] = 0; monthTo[a.key] = 0; });
  txsThisMonth.forEach(tx => {
    const fk = keyMap[tx.accountFrom], tk = keyMap[tx.accountTo];
    if (fk !== undefined) monthFrom[fk] = (monthFrom[fk] || 0) + tx.total;
    if (tk !== undefined) monthTo[tk]   = (monthTo[tk]   || 0) + tx.total;
  });

  const totalFrom = {}, totalTo = {};
  accounts.forEach(a => {
    totalFrom[a.key] = (carryFrom[a.key] || 0) + (monthFrom[a.key] || 0);
    totalTo[a.key]   = (carryTo[a.key]   || 0) + (monthTo[a.key]   || 0);
  });

  // Net the carry down to رصيد of previous month
  accounts.forEach(a => {
    const net = (carryFrom[a.key] || 0) - (carryTo[a.key] || 0);
    if (net >= 0) { carryFrom[a.key] = net; carryTo[a.key]  = 0; }
    else          { carryFrom[a.key] = 0;   carryTo[a.key]  = Math.abs(net); }
  });

  return { sorted, targetStart, carryFrom, carryTo, txsThisMonth, monthFrom, monthTo, totalFrom, totalTo };
}

/* ═══════════════════════════════════════════════════════════
   MAIN LEDGER — generateLedger
═══════════════════════════════════════════════════════════ */
function generateLedger() {
  const targetMonth = parseInt(document.getElementById('ledger-month').value);
  const targetYear  = getLedgerYear();
  const accounts = getAccountList().filter(a => !a.excludeFromLedger);
  //const accounts    = getAccountList();
  const keyMap      = getAccountKeyMap();

  rebuildLedgerThead(accounts);

  const { carryFrom, carryTo, txsThisMonth, monthFrom, monthTo, totalFrom, totalTo } =
    computeLedgerData(targetMonth, targetYear, accounts, keyMap);

  const sumFrom = {}, sumTo = {};
  accounts.forEach(a => {
    // carryFrom/carryTo are already the netted رصيد مدور split into من/إلى
    // add this month's raw transactions on top
    sumFrom[a.key] = (carryFrom[a.key] || 0) + (monthFrom[a.key] || 0);
    sumTo[a.key]   = (carryTo[a.key]   || 0) + (monthTo[a.key]   || 0);
  });

  const tbody = document.getElementById('ledger-tbody');
  tbody.innerHTML = '';

  tbody.appendChild(buildCarryRow('رصيد مدور', carryFrom, carryTo, accounts, 'balance-row'));
  txsThisMonth.forEach(tx => buildTxRows(tx, accounts, keyMap).forEach(r => tbody.appendChild(r)));
  tbody.appendChild(buildSumRow(`مجموع ${arabicMonthName(targetMonth)} ${targetYear}`, sumFrom, sumTo, accounts, 'month-total'));
  tbody.appendChild(buildResidRow(`رصيد ${arabicMonthName(targetMonth)} ${targetYear}`, totalFrom, totalTo, accounts, 'resid-row'));

  document.getElementById('ledger-title-line').textContent  = `صندوق يومية – ${arabicMonthName(targetMonth)} ${targetYear}`;
  document.getElementById('ledger-school-line').textContent = `${state.settings.schoolName} – ${state.settings.dirName}`;

  const barBalances = {};
  accounts.forEach(a => {
    barBalances[a.key] = ((carryFrom[a.key] || 0) - (carryTo[a.key] || 0)) +
                         ((monthFrom[a.key] || 0) - (monthTo[a.key] || 0));
  });
  renderBalanceBar(barBalances, accounts);

  document.getElementById('ledger-output').classList.remove('hidden');
  const btnPrint = document.getElementById('btn-print-ledger');
  if (btnPrint) {
    btnPrint.disabled = false;
    btnPrint.style.background = 'linear-gradient(135deg,#f97316,#ea580c)';
    btnPrint.style.boxShadow  = '0 2px 8px rgba(249,115,22,.35)';
  }
  showToast(`✅ تم توليد صندوق ${arabicMonthName(targetMonth)} ${targetYear}`, 'success');
}

/* ═══════════════════════════════════════════════════════════
   DEV LEDGER — generateDevLedger
   Filters to البنك ↔التطوير transactions only.
═══════════════════════════════════════════════════════════ */
function generateDevLedger() {
  const targetMonth = parseInt(document.getElementById('devledger-month').value);
  const targetYear  = getDevLedgerYear();
  const allAccounts = getAccountList();
  const keyMap      = getAccountKeyMap();

  const accounts = allAccounts.filter(a => a.name === 'البنك' || a.name === 'التطوير');
  if (accounts.length === 0) {
    showToast('لم يتم العثور على حسابي البنك أوالتطوير', 'error');
    return;
  }

  const devAcc  = accounts.find(a => a.name === 'التطوير');
  const bankAcc = accounts.find(a => a.name === 'البنك');
  const dgTotal = state.settings.devGrant?.total || 0;

  const { sorted, targetStart, carryFrom, carryTo, txsThisMonth, monthFrom, monthTo, totalFrom, totalTo } =
    computeDevLedgerData(targetMonth, targetYear, accounts, keyMap, bankAcc, devAcc, dgTotal);

  const sumFrom = {}, sumTo = {};
  accounts.forEach(a => {
    // carryFrom/carryTo are already the netted رصيد مدور split into من/إلى
    // add this month's raw transactions on top
    sumFrom[a.key] = (carryFrom[a.key] || 0) + (monthFrom[a.key] || 0);
    sumTo[a.key]   = (carryTo[a.key]   || 0) + (monthTo[a.key]   || 0);
  });

  // Rebuild thead
  const thead = document.querySelector('#devledger-table-main thead');
  thead.innerHTML = `
    <tr>
      <th rowspan="3" style="min-width:88px;">التاريخ</th>
      <th rowspan="3" style="min-width:64px;">رقم مستند الصرف</th>
      <th rowspan="3" style="min-width:64px;">رقم التحويل</th>
      <th rowspan="3" class="wrap-hdr" style="min-width:44px;">رقم مستند القيد</th>
      <th rowspan="3" style="min-width:56px;">رقم الوصل</th>
      <th colspan="3">الحساب</th>
      ${accounts.map(a => `<th colspan="4" style="background:${a.color};color:#fff;">${a.name}</th>`).join('')}
    </tr>
    <tr>
      <th rowspan="2" style="min-width:70px;">منه</th>
      <th rowspan="2" style="min-width:70px;">له</th>
      <th rowspan="2" style="min-width:130px;text-align:right;padding-right:6px;">البيان</th>
      ${accounts.map(() => `<th colspan="2">من</th><th colspan="2">إلى</th>`).join('')}
    </tr>
    <tr>
      ${accounts.map(() => `<th>فلس</th><th>دينار</th><th>فلس</th><th>دينار</th>`).join('')}
    </tr>`;

  // Build tbody using shared row builders
  // Note: dev ledger has 5 fixed columns before accounts (no receiptDocNo column)
  function buildDevTxRows(tx, accounts, keyMap) {
    const fromKey     = keyMap[tx.accountFrom] ?? null;
    const toKey       = keyMap[tx.accountTo]   ?? null;
    const amt         = tx.total;
    const purposeText = (tx.purpose || tx.recipient || '').replace(/</g, '&lt;');
  
    let html = `
      <td>${tx.date}</td>
      <td>${tx.type !== 'journal' ? (tx.serial || '') : ''}</td>
      <td>${tx.transferNo || ''}</td>
      <td>${tx.type === 'journal' ? (tx.serial || '') : ''}</td>
      <td>${tx.receiptNo || ''}</td>
      <td class="text-right-cell">${tx.accountFrom || ''}</td>
      <td class="text-right-cell">${tx.accountTo   || ''}</td>
      <td class="text-right-cell">${purposeText}</td>`;
  
    accounts.forEach(a => {
      html += _fmtF(fromKey === a.key ? amt : null);
      html += _fmtD(fromKey === a.key ? amt : null);
      html += _fmtF(toKey   === a.key ? amt : null);
      html += _fmtD(toKey   === a.key ? amt : null);
    });
  
    const tr = document.createElement('tr');
    tr.innerHTML = html;
    return [tr];
  }

  function buildDevCarryRow(label, cFrom, cTo) {
    const tr = document.createElement('tr');
    tr.className = 'balance-row';
    let html = `
      <td colspan="5" style="text-align:right;font-weight:700;padding-right:10px;">${label}</td>
      <td colspan="3" style="font-weight:700;text-align:center;">رصيد مدور</td>`;
    accounts.forEach(a => {
      const f = cFrom[a.key] || 0, t = cTo[a.key] || 0;
      html += f ? `${_fmtF(f)}${_fmtD(f)}` : _emptyPair();
      html += t ? `${_fmtF(t)}${_fmtD(t)}` : _emptyPair();
    });
    tr.innerHTML = html;
    return tr;
  }

  function buildDevSumRow(label, mFrom, mTo, cls) {
    const tr = document.createElement('tr');
    tr.className = cls;
    let html = `
      <td colspan="5" style="text-align:right;font-weight:700;padding-right:10px;">${label}</td>
      <td colspan="3" style="font-weight:700;text-align:center;">مجموع</td>`;
    accounts.forEach(a => {
      const f = mFrom[a.key] || 0, t = mTo[a.key] || 0;
      html += f ? `${_fmtF(f)}${_fmtD(f)}` : _emptyPair();
      html += t ? `${_fmtF(t)}${_fmtD(t)}` : _emptyPair();
    });
    tr.innerHTML = html;
    return tr;
  }

  function buildDevResidRow(label, mFrom, mTo) {
    const tr = document.createElement('tr');
    tr.className = 'resid-row';
    let html = `
      <td colspan="5" style="text-align:right;font-weight:700;padding-right:10px;">${label}</td>
      <td colspan="3" style="font-weight:700;text-align:center;">رصيد</td>`;
    accounts.forEach(a => {
      const net = (mFrom[a.key] || 0) - (mTo[a.key] || 0);
      if (net >= 0) {
        html += net > 0 ? `${_fmtF(net)}${_fmtD(net)}` : _emptyPair();
        html += _emptyPair();
      } else {
        html += _emptyPair();
        html += `${_fmtF(Math.abs(net))}${_fmtD(Math.abs(net))}`;
      }
    });
    tr.innerHTML = html;
    return tr;
  }

  const tbody = document.getElementById('devledger-tbody');
  tbody.innerHTML = '';
  tbody.appendChild(buildDevCarryRow('رصيد مدور', carryFrom, carryTo));
  txsThisMonth.forEach(tx => buildDevTxRows(tx, accounts, keyMap).forEach(r => tbody.appendChild(r)));
  tbody.appendChild(buildDevSumRow(`مجموع ${arabicMonthName(targetMonth)} ${targetYear}`, sumFrom, sumTo, 'month-total'));
  tbody.appendChild(buildDevResidRow(`رصيد ${arabicMonthName(targetMonth)} ${targetYear}`, totalFrom, totalTo));

  document.getElementById('devledger-title-line').textContent  = `صندوق يومية التطوير – ${arabicMonthName(targetMonth)} ${targetYear}`;
  document.getElementById('devledger-school-line').textContent = `${state.settings.schoolName} – ${state.settings.dirName}`;

  const barBalances = {};
  accounts.forEach(a => { barBalances[a.key] = (totalFrom[a.key] || 0) - (totalTo[a.key] || 0); });

  const bar = document.getElementById('devledger-balance-bar');
  if (bar) {
    bar.innerHTML = accounts.map(a => `
      <div class="card p-3 text-center border-t-4" style="border-color:${a.color}">
        <div class="text-xs font-bold mb-1" style="color:${a.color}">${a.name}</div>
        <div class="font-black text-gray-800 text-sm">${(barBalances[a.key] || 0).toFixed(3)}</div>
        <div class="text-xs text-gray-400">د.أ</div>
      </div>`).join('');
  }

  // ── خلاصة منحة التطوير ──
  _renderDevGrantSummary(targetMonth, targetYear, txsThisMonth, accounts, keyMap, bankAcc, devAcc, targetStart, sorted);

  document.getElementById('devledger-output').classList.remove('hidden');
  const btnPrint = document.getElementById('btn-print-devledger');
  if (btnPrint) {
    btnPrint.disabled = false;
    btnPrint.style.background = 'linear-gradient(135deg,#f97316,#ea580c)';
    btnPrint.style.boxShadow  = '0 2px 8px rgba(249,115,22,.35)';
  }
  showToast(`✅ تم توليد صندوق التطوير – ${arabicMonthName(targetMonth)} ${targetYear}`, 'success');
}

/* ── Dev-grant monthly summary (inline) ── */
function _renderDevGrantSummary(targetMonth, targetYear, txsThisMonth, accounts, keyMap, bankAcc, devAcc, targetStart, sorted) {
  const dgSettings = state.settings.devGrant || {};
  const dgTotal    = dgSettings.total || 0;
  const dgPct      = dgSettings.percentages || {};
  const dgFmt      = v => (v || 0).toFixed(3);
  const dgSum      = obj => DEV_GRANT_KEYS.reduce((s, k) => s + (obj[k] || 0), 0);

  // Opening balance per column
  const dgCarry = {};
  DEV_GRANT_KEYS.forEach(k => { dgCarry[k] = dgTotal * (dgPct[k] || 0) / 100; });
  sorted.filter(tx => tx.date < targetStart).forEach(tx => {
    const fk      = keyMap[tx.accountFrom];
    const tk      = keyMap[tx.accountTo];
    const isBTD   = fk === bankAcc?.key && tk === devAcc?.key;
    const isDTB   = fk === devAcc?.key  && tk === bankAcc?.key;
    if (isBTD) {
      DEV_GRANT_KEYS.forEach(k => {
        dgCarry[k] = (dgCarry[k] || 0) + tx.total * (dgPct[k] || 0) / 100;
      });
    }
    if (isDTB) {
      const col = tx.devGrantField || '';
      if (!col) return;
      dgCarry[col] = (dgCarry[col] || 0) - tx.total;
    }
  });

  const dgRcv = {}, dgSpn = {};
  DEV_GRANT_KEYS.forEach(k => { dgRcv[k] = 0; dgSpn[k] = 0; });
  txsThisMonth.forEach(tx => {
    const fk          = keyMap[tx.accountFrom];
    const tk          = keyMap[tx.accountTo];
    const isBankToDev = fk === bankAcc?.key && tk === devAcc?.key;
    const isDevToBank = fk === devAcc?.key  && tk === bankAcc?.key;
    if (isBankToDev) {
      // Distribute incoming money across all keys by percentage
      DEV_GRANT_KEYS.forEach(k => {
        dgRcv[k] = (dgRcv[k] || 0) + tx.total * (dgPct[k] || 0) / 100;
      });
    }
    if (isDevToBank) {
      const col = tx.devGrantField || '';
      if (!col) return;
      dgSpn[col] = (dgSpn[col] || 0) + tx.total;
    }
  });

  const dgEnd = {};
  DEV_GRANT_KEYS.forEach(k => { dgEnd[k] = (dgCarry[k] || 0) + (dgRcv[k] || 0) - (dgSpn[k] || 0); });

  const dgRows = [
    { label: 'رصيد بداية الشهر',   obj: dgCarry },
    { label: 'المقبوض خلال الشهر', obj: dgRcv   },
    { label: 'المصروف خلال الشهر', obj: dgSpn   },
    { label: 'رصيد نهاية الشهر',   obj: dgEnd   },
  ];

  const summaryHTML = `
    <div class="card p-4 mt-4 overflow-x-auto">
      <div class="font-black text-gray-800 text-sm text-center mb-1">خلاصة الحساب الشهري لمنحة التطوير</div>
      <div class="text-xs text-gray-400 text-center mb-3">${arabicMonthName(targetMonth)} – ${targetYear}</div>
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th class="border border-gray-300 bg-gray-800 text-white px-2 py-1 text-right">المجال</th>
            ${DEV_GRANT_KEYS.map(k => `<th class="border border-gray-300 bg-gray-800 text-white px-2 py-1 text-center">${DEV_GRANT_LABELS[k]}</th>`).join('')}
            <th class="border border-gray-300 bg-orange-500 text-white px-2 py-1 text-center">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${dgRows.map(({ label, obj }, i) => `
            <tr class="${i === 3 ? 'bg-blue-50 font-black' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
              <td class="border border-gray-300 px-2 py-1 font-bold text-right whitespace-nowrap">${label}</td>
              ${DEV_GRANT_KEYS.map(k => `<td class="border border-gray-300 px-2 py-1 text-center">${dgFmt(obj[k])}</td>`).join('')}
              <td class="border border-gray-300 px-2 py-1 text-center font-black text-orange-600">${dgFmt(dgSum(obj))}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  let container = document.getElementById('devledger-summary-table');
  if (!container) {
    container = document.createElement('div');
    container.id = 'devledger-summary-table';
    document.getElementById('devledger-output').appendChild(container);
  }
  container.innerHTML = summaryHTML;
}

/* ═══════════════════════════════════════════════════════════
   SHARED PRINT CELL HELPERS
═══════════════════════════════════════════════════════════ */
function _pFmtD(v) { return (v != null && v !== 0) ? Math.floor(Math.abs(v)) : '—————'; }
function _pFmtF(v) {
  if (v == null || v === 0) return '';
  const f = Math.round((Math.abs(v) % 1) * FILS_PER_DINAR);
  return f || '—————';
}
function _pCells(fromVal, toVal) {
  return `<td class="num">${fromVal != null ? _pFmtF(fromVal) : '—————'}</td><td class="num">${fromVal != null ? _pFmtD(fromVal) : '—————'}</td><td class="num">${toVal != null ? _pFmtF(toVal) : '—————'}</td><td class="num">${toVal != null ? _pFmtD(toVal) : '—————'}</td>`;
}
function _pBlank() { return `<td></td><td></td><td></td><td></td>`; }

/* ═══════════════════════════════════════════════════════════
   PRINT LEDGER — صندوق يومية
   Reference structure: doc index 3 (the one with 45 cols)
   • 6 fixed cols before accounts (has رقم مستند القبض)
   • summary rows use colspan="6" for label
   • carry-row / sum-row / resid-row CSS classes
   • رصيد مدور at TOP, مجموع + رصيد at BOTTOM only (no carry at bottom)
   • 9 padded accounts, A4 landscape @page
═══════════════════════════════════════════════════════════ */
function printLedger() {
  const targetMonth    = parseInt(document.getElementById('ledger-month').value);
  const targetYear     = getLedgerYear();
  const accounts = getAccountList().filter(a => !a.excludeFromLedger);
  //const accounts       = getAccountList();
  const keyMap         = getAccountKeyMap();
  const TOTAL_ACCOUNTS = 9;
  const ROWS_PER_PAGE  = 22;

  const paddedAccounts = [...accounts];
  while (paddedAccounts.length < TOTAL_ACCOUNTS) {
    paddedAccounts.push({ key: '__blank_' + paddedAccounts.length, name: '', color: '#94a3b8' });
  }

  const monthName  = arabicMonthName(targetMonth);
  const monthNumAr = String(targetMonth).padStart(2, '0');

  const { sorted, carryFrom, carryTo, txsThisMonth, monthFrom, monthTo, totalFrom, totalTo } =
    computeLedgerData(targetMonth, targetYear, accounts, keyMap);

  const sumFrom = {}, sumTo = {};
  accounts.forEach(a => {
    // carryFrom/carryTo are already the netted رصيد مدور split into من/إلى
    // add this month's raw transactions on top
    sumFrom[a.key] = (carryFrom[a.key] || 0) + (monthFrom[a.key] || 0);
    sumTo[a.key]   = (carryTo[a.key]   || 0) + (monthTo[a.key]   || 0);
  });

  const TOTAL_COLS = 6 + 3 + TOTAL_ACCOUNTS * 4;


  // ── Row builders (6-col fixed prefix) ──
  function txRowHTML(tx) {
    const fromKey = keyMap[tx.accountFrom] ?? null;
    const toKey   = keyMap[tx.accountTo]   ?? null;
    const amt = tx.total;
    const purposeTxt = (tx.purpose || tx.recipient || '').replace(/</g, '&lt;');
    const docSerial  = tx.type !== 'journal' ? (tx.serial || '') : '';
    const qydSerial  = tx.type === 'journal' ? (tx.serial || '') : '';
    let cells = '';
    paddedAccounts.forEach(a => {
      if (a.key.startsWith('__blank_')) { cells += _pBlank(); return; }
      cells += _pCells(fromKey === a.key ? amt : null, toKey === a.key ? amt : null);
    });
    return `<tr><td>${tx.date||''}</td><td>${docSerial}</td><td>${tx.transferNo||''}</td><td>${qydSerial}</td><td>${tx.receiptNo||''}</td><td>${tx.receiptDocNo||''}</td><td class="bayan-r">${tx.accountFrom||''}</td><td class="bayan-r">${tx.accountTo||''}</td><td class="bayan-r">${purposeTxt}</td>${cells}</tr>`;
  }

  function summaryRowHTML(label, centerLabel, fMap, tMap, cls) {
    let cells = '';
    paddedAccounts.forEach(a => {
      if (a.key.startsWith('__blank_')) { cells += _pBlank(); return; }
      const f = fMap[a.key] || 0, t = tMap[a.key] || 0;
      if (cls === 'resid-row' || cls === 'carry-row') {
        const net = f - t;
        cells += net >= 0 ? _pCells(net > 0 ? net : null, null) : _pCells(null, Math.abs(net));
      } else {
        cells += _pCells(f || null, t || null);
      }
    });
    return `<tr class="${cls}"><td colspan="6" class="label-cell">${label}</td><td colspan="3" class="center-cell">${centerLabel}</td>${cells}</tr>`;
  }

  function emptyRowHTML() {
    return `<tr class="empty-row">${'<td></td>'.repeat(TOTAL_COLS)}</tr>`;
  }

  // ── Thead ──
  const row1 = paddedAccounts.map(a => a.name
    ? `<th colspan="4" style="background:${a.color};color:#fff;">${a.name}</th>`
    : `<th colspan="4" style="background:#f1f5f9;"></th>`).join('');
  const row2 = paddedAccounts.map(() => `<th colspan="2">من</th><th colspan="2">إلى</th>`).join('');
  const row3 = paddedAccounts.map(() => `<th>فلس</th><th>دينار</th><th>فلس</th><th>دينار</th>`).join('');

  const titleRows = `
    <tr class="title-row-1"><td colspan="${TOTAL_COLS}">قسم الشؤون المالية / ${state.settings.dirName}</td></tr>
    <tr class="title-row-2"><td colspan="${TOTAL_COLS}">${state.settings.schoolName}</td></tr>
    <tr class="title-row-3"><td colspan="${TOTAL_COLS}">شهر ( ${monthName} / ${monthNumAr} )&nbsp;&nbsp;&nbsp;&nbsp;سنة ( ${targetYear} )</td></tr>`;

  const theadHTML = `
    <tr>
      <th rowspan="3">التاريخ</th>
      <th rowspan="3" class="wrap-hdr">رقم مستند الصرف</th>
      <th rowspan="3">رقم التحويل</th>
      <th rowspan="3" class="wrap-hdr">رقم مستند القيد</th>
      <th rowspan="3">رقم الوصل</th>
      <th rowspan="3" class="wrap-hdr">رقم مستند القبض</th>
      <th colspan="3">الحساب</th>
      ${row1}
    </tr>
    <tr>
      <th rowspan="2">منه</th>
      <th rowspan="2">له</th>
      <th rowspan="2" style="min-width:110px;" class="bayan-h">البيان</th>
      ${row2}
    </tr>
    <tr>${row3}</tr>`;

  // ── Paginate ──
  const pages = [];
  for (let i = 0; i < Math.max(1, txsThisMonth.length); i += ROWS_PER_PAGE) {
    pages.push(txsThisMonth.slice(i, i + ROWS_PER_PAGE));
  }
  const totalPages = pages.length;

  const pagesHTML = pages.map((pageTxs, pageIdx) => {
    const isFirst = pageIdx === 0;
    const isLast  = pageIdx === totalPages - 1;
    const pageNum = pageIdx + 1;

    // carry row: first page shows actual carry, subsequent pages show continuation label
    const carryRowHTML = isFirst
      ? summaryRowHTML('رصيد مدور', 'رصيد مدور', carryFrom, carryTo, 'carry-row')
      : summaryRowHTML(`تابع – الصفحة ${pageNum}`, 'رصيد مدور', {}, {}, 'carry-row');

    let txRows = pageTxs.map(tx => txRowHTML(tx)).join('');

    // pad empty rows
    const summaryCount = isLast ? 2 : 1; // مجموع + رصيد on last page
    const emptyNeeded = ROWS_PER_PAGE - pageTxs.length;
    for (let i = 0; i < emptyNeeded; i++) txRows += emptyRowHTML();

    //const footerRows = isLast
    //  ? summaryRowHTML(`مجموع ${monthName} ${targetYear}`, 'مجموع', totalFrom, totalTo, 'sum-row')
    //    + summaryRowHTML(`رصيد ${monthName} ${targetYear}`, 'رصيد', totalFrom, totalTo, 'resid-row')
    //  : summaryRowHTML(`يتبع – الصفحة ${pageNum + 1}`, 'يتبع', {}, {}, 'sum-row');
    
    const footerRows = isLast
      ? summaryRowHTML(`مجموع ${monthName} ${targetYear}`, 'مجموع', sumFrom, sumTo, 'sum-row')
        + summaryRowHTML(`رصيد ${monthName} ${targetYear}`, 'رصيد', totalFrom, totalTo, 'resid-row')
      : summaryRowHTML(`يتبع – الصفحة ${pageNum + 1}`, 'يتبع', {}, {}, 'sum-row');

    const pageLabel = totalPages > 1 ? ` – صفحة ${pageNum} من ${totalPages}` : '';
    return `
      <div class="page">
        <table class="ledger-doc-table">
          <thead>${titleRows}${theadHTML}</thead>
          <tbody>${carryRowHTML}${txRows}${footerRows}</tbody>
        </table>
        <div class="page-footer">صندوق يومية${pageLabel}&nbsp;·&nbsp;${state.settings.schoolName}&nbsp;·&nbsp;${monthName} ${targetYear}</div>
      </div>`;
  }).join('');

  openLedgerPreview(_wrapLedgerPrint(pagesHTML, `صندوق يومية – ${monthName} ${targetYear}`, 'A4 landscape'));
}

/* ═══════════════════════════════════════════════════════════
   PRINT DEV LEDGER — صندوق التطوير
   Reference structure: doc index 2 (the one with 16 cols)
   • 5 fixed cols before accounts (NO رقم مستند القبض)
   • summary rows use colspan="5" for label
   • balance-row / month-total / resid-row CSS classes
   • رصيد مدور at TOP, مجموع + رصيد at BOTTOM
   • 2 accounts only (البنك +التطوير), custom paper + خلاصة table
═══════════════════════════════════════════════════════════ */
function printDevLedger() {
  const targetMonth = parseInt(document.getElementById('devledger-month').value);
  const targetYear  = getDevLedgerYear();
  const allAccounts = getAccountList();
  const keyMap      = getAccountKeyMap();
  const ROWS_PER_PAGE = 15;

  const accounts = allAccounts.filter(a => a.name === 'البنك' || a.name === 'التطوير');
  if (accounts.length === 0) { showToast('لم يتم العثور على حسابي البنك أوالتطوير', 'error'); return; }

  const devAcc  = accounts.find(a => a.name === 'التطوير');
  const bankAcc = accounts.find(a => a.name === 'البنك');
  const dgTotal = state.settings.devGrant?.total || 0;
  const monthName  = arabicMonthName(targetMonth);
  const monthNumAr = String(targetMonth).padStart(2, '0');

  const { sorted, targetStart, carryFrom, carryTo, txsThisMonth, monthFrom, monthTo, totalFrom, totalTo } =
    computeDevLedgerData(targetMonth, targetYear, accounts, keyMap, bankAcc, devAcc, dgTotal);

  const TOTAL_COLS = 5 + 3 + accounts.length * 4;

  function txRowHTML(tx) {
    const fromKey = keyMap[tx.accountFrom] ?? null;
    const toKey   = keyMap[tx.accountTo]   ?? null;
    const purposeTxt = (tx.purpose || tx.recipient || '').replace(/</g, '&lt;');
    const docSerial  = tx.type !== 'journal' ? (tx.serial || '') : '';
    const qydSerial  = tx.type === 'journal' ? (tx.serial || '') : '';
    let cells = '';
    accounts.forEach(a => {
      cells += _pCells(fromKey === a.key ? tx.total : null, toKey === a.key ? tx.total : null);
    });
    return `<tr><td>${tx.date||''}</td><td>${docSerial}</td><td>${tx.transferNo||''}</td><td>${qydSerial}</td><td>${tx.receiptNo||''}</td><td class="bayan-r">${tx.accountFrom||''}</td><td class="bayan-r">${tx.accountTo||''}</td><td class="bayan-r">${purposeTxt}</td>${cells}</tr>`;
  }

  function summaryRowHTML(label, centerLabel, fMap, tMap, cls) {
    let cells = '';
    accounts.forEach(a => {
      const f = fMap[a.key] || 0, t = tMap[a.key] || 0;
      if (cls === 'resid-row' || cls === 'balance-row') {
        const net = f - t;
        cells += net >= 0 ? _pCells(net > 0 ? net : null, null) : _pCells(null, Math.abs(net));
      } else {
        cells += _pCells(f || null, t || null);
      }
    });
    return `<tr class="${cls}"><td colspan="5" class="label-cell">${label}</td><td colspan="3" class="center-cell">${centerLabel}</td>${cells}</tr>`;
  }

  function emptyRowHTML() {
    return `<tr class="empty-row">${'<td></td>'.repeat(TOTAL_COLS)}</tr>`;
  }

  // rest of thead, dgSummaryTable, pagination unchanged...
  

  // ── Thead ──
  const row1 = accounts.map(a => `<th colspan="4" style="background:${a.color};color:#fff;">${a.name}</th>`).join('');
  const row2 = accounts.map(() => `<th colspan="2">من</th><th colspan="2">إلى</th>`).join('');
  const row3 = accounts.map(() => `<th>فلس</th><th>دينار</th><th>فلس</th><th>دينار</th>`).join('');

  const titleRows = `
    <tr class="title-row-1"><td colspan="${TOTAL_COLS}">قسم الشؤون المالية / ${state.settings.dirName}</td></tr>
    <tr class="title-row-2"><td colspan="${TOTAL_COLS}">${state.settings.schoolName}</td></tr>
    <tr class="title-row-3"><td colspan="${TOTAL_COLS}">شهر ( ${monthName} / ${monthNumAr} )&nbsp;&nbsp;&nbsp;&nbsp;سنة ( ${targetYear} ) — صندوق يومية التطوير</td></tr>`;

  const theadHTML = `
    <tr>
      <th rowspan="3">التاريخ</th>
      <th rowspan="3" class="wrap-hdr">رقم مستند الصرف</th>
      <th rowspan="3">رقم التحويل</th>
      <th rowspan="3" class="wrap-hdr">رقم مستند القيد</th>
      <th rowspan="3">رقم الوصل</th>
      <!-- no رقم مستند القبض in dev ledger -->
      <th colspan="3">الحساب</th>
      ${row1}
    </tr>
    <tr>
      <th rowspan="2">منه</th>
      <th rowspan="2">له</th>
      <th rowspan="2" style="min-width:110px;" class="bayan-h">البيان</th>
      ${row2}
    </tr>
    <tr>${row3}</tr>`;

  // ── خلاصة منحة التطوير table ──
  const dgSettings = state.settings.devGrant || {};
  const dgPct      = dgSettings.percentages || {};
  const dgFmt      = v => (v || 0).toFixed(3);
  const dgSum      = obj => DEV_GRANT_KEYS.reduce((s, k) => s + (obj[k] || 0), 0);

  const dgCarry = {};
  DEV_GRANT_KEYS.forEach(k => { dgCarry[k] = dgTotal * (dgPct[k] || 0) / 100; });
  sorted.filter(tx => tx.date < targetStart).forEach(tx => {
    const fk      = keyMap[tx.accountFrom];
    const tk      = keyMap[tx.accountTo];
    const isBTD   = fk === bankAcc?.key && tk === devAcc?.key;
    const isDTB   = fk === devAcc?.key  && tk === bankAcc?.key;
    if (isBTD) {
      DEV_GRANT_KEYS.forEach(k => {
        dgCarry[k] = (dgCarry[k] || 0) + tx.total * (dgPct[k] || 0) / 100;
      });
    }
    if (isDTB) {
      const col = tx.devGrantField || '';
      if (!col) return;
      dgCarry[col] = (dgCarry[col] || 0) - tx.total;
    }
  });

  const dgRcv = {}, dgSpn = {};
  DEV_GRANT_KEYS.forEach(k => { dgRcv[k] = 0; dgSpn[k] = 0; });
  txsThisMonth.forEach(tx => {
    const fk          = keyMap[tx.accountFrom];
    const tk          = keyMap[tx.accountTo];
    const isBankToDev = fk === bankAcc?.key && tk === devAcc?.key;
    const isDevToBank = fk === devAcc?.key  && tk === bankAcc?.key;
    if (isBankToDev) {
      // Distribute incoming money across all keys by percentage
      DEV_GRANT_KEYS.forEach(k => {
        dgRcv[k] = (dgRcv[k] || 0) + tx.total * (dgPct[k] || 0) / 100;
      });
    }
    if (isDevToBank) {
      const col = tx.devGrantField || '';
      if (!col) return;
      dgSpn[col] = (dgSpn[col] || 0) + tx.total;
    }
  });

  const dgEnd = {};
  DEV_GRANT_KEYS.forEach(k => { dgEnd[k] = (dgCarry[k] || 0) + (dgRcv[k] || 0) - (dgSpn[k] || 0); });

  const dgColHeaders = DEV_GRANT_KEYS.map(k =>
    `<th style="background:#1e1b18;color:#fff;font-size:7pt;padding:3px 4px;border:0.5pt solid #374151;">${DEV_GRANT_LABELS[k]}</th>`
  ).join('');

  const dgRow = (label, obj) => `
    <tr>
      <td style="font-weight:700;text-align:right;padding:3px 6px;border:0.5pt solid #374151;background:#f8fafc;white-space:nowrap;font-size:7.5pt;">${label}</td>
      ${DEV_GRANT_KEYS.map(k => `<td style="text-align:center;padding:3px 4px;border:0.5pt solid #374151;font-size:7.5pt;">${dgFmt(obj[k])}</td>`).join('')}
      <td style="text-align:center;padding:3px 4px;border:0.5pt solid #374151;font-weight:800;color:#c2410c;font-size:7.5pt;">${dgFmt(dgSum(obj))}</td>
    </tr>`;

  const dgSummaryTable = `
    <div style="margin-top:14px;">
      <div style="font-weight:900;font-size:9.5pt;text-align:center;margin-bottom:4px;color:#1e1b18;">
        خلاصة الحساب الشهري لمنحة التطوير لشهر (${monthName}/${monthNumAr}) سنة (${targetYear})
      </div>
      <table style="border-collapse:collapse;width:100%;font-family:'Tajawal',Arial,sans-serif;">
        <thead>
          <tr>
            <th style="background:#1e1b18;color:#fff;font-size:7pt;padding:3px 6px;border:0.5pt solid #374151;text-align:right;">المجال</th>
            ${dgColHeaders}
            <th style="background:#f97316;color:#fff;font-size:7pt;padding:3px 4px;border:0.5pt solid #374151;">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${dgRow('رصيد بداية الشهر',   dgCarry)}
          ${dgRow('المقبوض خلال الشهر', dgRcv)}
          ${dgRow('المصروف خلال الشهر', dgSpn)}
          ${dgRow('رصيد نهاية الشهر',   dgEnd)}
        </tbody>
      </table>
    </div>`;

  // ── Paginate ──
  const pages = [];
  for (let i = 0; i < Math.max(1, txsThisMonth.length); i += ROWS_PER_PAGE) {
    pages.push(txsThisMonth.slice(i, i + ROWS_PER_PAGE));
  }
  const totalPages = pages.length;

  const pagesHTML = pages.map((pageTxs, pageIdx) => {
    const isFirst = pageIdx === 0;
    const isLast  = pageIdx === totalPages - 1;
    const pageNum = pageIdx + 1;

    const carryRowHTML = isFirst
      ? summaryRowHTML('رصيد مدور', 'رصيد مدور', carryFrom, carryTo, 'balance-row')
      : summaryRowHTML(`تابع – الصفحة ${pageNum}`, 'رصيد مدور', {}, {}, 'balance-row');

    let txRows = pageTxs.map(tx => txRowHTML(tx)).join('');
    const emptyNeeded = ROWS_PER_PAGE - pageTxs.length;
    for (let i = 0; i < emptyNeeded; i++) txRows += emptyRowHTML();

    //const footerRows = isLast
    //  ? summaryRowHTML(`مجموع ${monthName} ${targetYear}`, 'مجموع', totalFrom, totalTo, 'month-total')
    //    + summaryRowHTML(`رصيد ${monthName} ${targetYear}`, 'رصيد', totalFrom, totalTo, 'resid-row')
    //  : summaryRowHTML(`يتبع – الصفحة ${pageNum + 1}`, 'يتبع', {}, {}, 'month-total');
  
    const footerRows = isLast
      ? summaryRowHTML(`مجموع ${monthName} ${targetYear}`, 'مجموع', totalFrom, totalTo, 'month-total')
        + summaryRowHTML(`رصيد ${monthName} ${targetYear}`, 'رصيد', totalFrom, totalTo, 'resid-row')
      : summaryRowHTML(`يتبع – الصفحة ${pageNum + 1}`, 'يتبع', {}, {}, 'month-total');

    const pageLabel = totalPages > 1 ? ` – صفحة ${pageNum} من ${totalPages}` : '';
    return `
      <div class="page${pageIdx > 0 ? ' page-break' : ''}">
        <table class="ledger-doc-table">
          <thead>${titleRows}${theadHTML}</thead>
          <tbody>${carryRowHTML}${txRows}${footerRows}</tbody>
        </table>
        ${isLast ? dgSummaryTable : ''}
        <div class="page-footer">صندوق يومية التطوير${pageLabel}&nbsp;·&nbsp;${state.settings.schoolName}&nbsp;·&nbsp;${monthName} ${targetYear}</div>
      </div>`;
  }).join('');

  openLedgerPreview(_wrapDevLedgerPrint(pagesHTML, `صندوق يومية التطوير – ${monthName} ${targetYear}`));
}

/* ═══════════════════════════════════════════════════════════
   PRINT HTML SHELLS
═══════════════════════════════════════════════════════════ */
function _printInstructions() {
  return `<div id="print-instructions" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:14px;padding:28px 32px;max-width:460px;width:90%;direction:rtl;box-shadow:0 8px 40px rgba(0,0,0,.25);font-family:'Tajawal',sans-serif;">
    <h2 style="font-size:17px;font-weight:900;margin-bottom:12px;">إعدادات الطباعة</h2>
    <ol style="font-size:13px;color:#1e293b;padding-right:18px;margin-bottom:18px;line-height:2;">
      <li>في خانة <strong>الطابعة</strong> اختر <strong style="color:#16a34a;">Microsoft Edge PDF</strong> أو <strong style="color:#16a34a;">Save as PDF</strong></li>
      <li>اضبط <strong>حجم الورق</strong> على المطلوب</li>
      <li>تأكد أن <strong>الهوامش</strong> مضبوطة على <strong>لا شيء / None</strong></li>
    </ol>
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button onclick="document.getElementById('print-instructions').style.display='none'"
        style="padding:8px 18px;border-radius:8px;border:none;background:#f1f5f9;color:#334155;font-family:'Tajawal',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">إلغاء</button>
      <button onclick="document.getElementById('print-instructions').style.display='none';window.print();"
        style="padding:8px 22px;border-radius:8px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-family:'Tajawal',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">فهمت، تابع للطباعة</button>
    </div>
  </div>
</div>`;
}

const _ledgerCSS = `
  * { font-family:'Tajawal',sans-serif; box-sizing:border-box; margin:0; padding:0; }
  body { background:#e5e7eb; direction:rtl; }
  #toolbar { position:fixed; top:0; left:0; right:0; z-index:999; background:#1e1b18; color:#fff; padding:10px 20px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 2px 12px rgba(0,0,0,.4); }
  #toolbar .doc-title { color:#f97316; font-weight:800; font-size:16px; }
  #toolbar .actions { display:flex; gap:10px; align-items:center; }
  #toolbar button { padding:7px 18px; border-radius:7px; border:none; cursor:pointer; font-family:'Tajawal',sans-serif; font-size:13px; font-weight:700; transition:all .18s; }
  #btn-print-doc { background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; box-shadow:0 2px 8px rgba(249,115,22,.4); }
  #btn-close-doc { background:#374151; color:#d1d5db; }
  #pages-area { padding:68px 16px 30px; }
  .page { background:#fff; min-width:277mm; width:fit-content; margin:0 auto 20px; box-shadow:0 4px 24px rgba(0,0,0,.18); padding:5mm 4mm 6mm; display:flex; flex-direction:column; }
  .ledger-doc-table { border-collapse:collapse; width:100%; font-size:8pt; flex:1; }
  .ledger-doc-table th, .ledger-doc-table td { border:0.5pt solid #374151; padding:2px 2px; text-align:center; white-space:nowrap; vertical-align:middle; line-height:1.25; }
  .title-row-1 td { font-size:11pt; font-weight:900; background:#1e1b18; color:#fff; padding:5px; }
  .title-row-2 td { font-size:10pt; font-weight:800; background:#374151; color:#fff; padding:4px; }
  .title-row-3 td { font-size:9.5pt; font-weight:700; background:#fff7ed; color:#c2410c; padding:4px; }
  .ledger-doc-table thead tr:nth-child(4) th { background:#1e1b18; color:#fff; font-weight:800; font-size:7.5pt; }
  .ledger-doc-table thead tr:nth-child(5) th { background:#f97316; color:#fff; font-weight:700; font-size:7pt; }
  .ledger-doc-table thead tr:nth-child(6) th { background:#fff7ed; color:#c2410c; font-weight:700; font-size:6.5pt; }
  .ledger-doc-table thead th.wrap-hdr { white-space:normal; max-width:44px; line-height:1.3; }
  .ledger-doc-table td.num { font-size:7pt; font-weight:600; }
  .ledger-doc-table td.bayan-r, .ledger-doc-table th.bayan-h { text-align:right; padding-right:3px; }
  .ledger-doc-table td.bayan-r { font-size:7.5pt; max-width:70px; overflow:hidden; text-overflow:ellipsis; }
  .ledger-doc-table tr.empty-row td { height:13pt; }
  /* صندوق يومية classes */
  .ledger-doc-table tr.carry-row td  { background:#f0fdf4; font-weight:700; color:#15803d; font-size:7.5pt; }
  .ledger-doc-table tr.sum-row td    { background:#fff7ed; font-weight:700; color:#c2410c;  font-size:7.5pt; border-top:1.5pt solid #f97316; }
  /* صندوق التطوير classes */
  .ledger-doc-table tr.balance-row td { background:#f0fdf4; font-weight:700; color:#15803d; font-size:7.5pt; }
  .ledger-doc-table tr.month-total td { background:#fff7ed; font-weight:700; color:#c2410c;  font-size:7.5pt; border-top:1.5pt solid #f97316; }
  /* shared */
  .ledger-doc-table tr.resid-row td  { background:#eff6ff; font-weight:700; color:#1d4ed8;  font-size:7.5pt; border-top:1.5pt solid #2563eb; }
  .label-cell  { text-align:right !important; padding-right:6px !important; }
  .center-cell { font-weight:700; }
  .page-footer { text-align:center; font-size:7pt; color:#6b7280; margin-top:3px; padding-top:3px; border-top:0.4pt solid #e5e7eb; }
  `;

// صندوق يومية: A4 landscape
function _wrapLedgerPrint(pagesHTML, title) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    ${_ledgerCSS}
    @media print { body { background:#fff; } #toolbar { display:none !important; } #pages-area { padding:0; } .page { box-shadow:none; margin:0; page-break-after:always; width:100%; padding:4mm 3mm 5mm; } .page:last-child { page-break-after:avoid; } }
    @page { size:500mm 180mm; margin:5mm; }
  </style>
</head>
<body>
<div id="toolbar">
  <span class="doc-title">📋 ${title}</span>
  <div class="actions">
    <button id="btn-print-doc" onclick="document.getElementById('print-instructions').style.display='flex'">🖨️ طباعة / تنزيل PDF</button>
    <button id="btn-close-doc" onclick="window.parent.closeLedgerPreview()">✕ إغلاق</button>
  </div>
</div>
${_printInstructions()}
<div id="pages-area">${pagesHTML}</div>
</body></html>`;
}

// صندوق التطوير: custom paper size (A4 landscape is also fine here)
function _wrapDevLedgerPrint(pagesHTML, title) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    ${_ledgerCSS}
    @media print { body { background:#fff; } #toolbar { display:none !important; } #pages-area { padding:0; } .page { box-shadow:none; margin:0; page-break-after:always; width:100%; padding:4mm 3mm 5mm; } .page:last-child { page-break-after:avoid; } }
    @page { size:A4 landscape; margin:5mm; }
  </style>
</head>
<body>
<div id="toolbar">
  <span class="doc-title">📋 ${title}</span>
  <div class="actions">
    <button id="btn-print-doc" onclick="document.getElementById('print-instructions').style.display='flex'">🖨️ طباعة / تنزيل PDF</button>
    <button id="btn-close-doc" onclick="window.parent.closeLedgerPreview()">✕ إغلاق</button>
  </div>
</div>
${_printInstructions()}
<div id="pages-area">${pagesHTML}</div>
</body></html>`;
}