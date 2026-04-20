/* ═══════════════════════════════════════════════════════════════
   export.js — ميزان
   Bulk document export for a date range.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Date range helpers ──────────────────────────────────── */
function getExportMonths() {
  const fromMonth = parseInt(document.getElementById('export-from-month').value);
  const fromYear  = parseInt(document.getElementById('export-from-year').value);
  const toMonth   = parseInt(document.getElementById('export-to-month').value);
  const toYear    = parseInt(document.getElementById('export-to-year').value);

  if (!fromYear || !toYear) { showToast('يرجى إدخال السنة', 'error'); return null; }

  const fromIdx = fromYear * 12 + fromMonth;
  const toIdx   = toYear   * 12 + toMonth;
  if (fromIdx > toIdx) { showToast('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'error'); return null; }

  const months = [];
  for (let idx = fromIdx; idx <= toIdx; idx++) {
    months.push({ month: ((idx - 1) % 12) + 1, year: Math.floor((idx - 1) / 12) });
  }
  return months;
}

function txInMonth(tx, month, year) {
  const d = new Date(tx.date);
  return d.getFullYear() === year && (d.getMonth() + 1) === month;
}

/* ── Main export function ────────────────────────────────── */
async function runBulkExport() {
  const months = getExportMonths();
  if (!months) return;

  const txDocs     = [...document.querySelectorAll('input[name="export-tx-doc"]:checked')].map(c => c.value);
  const ledgerDocs = [...document.querySelectorAll('input[name="export-ledger-doc"]:checked')].map(c => c.value);

  if (txDocs.length === 0 && ledgerDocs.length === 0) {
    showToast('يرجى اختيار نوع مستند واحد على الأقل', 'error');
    return;
  }

  // Collect all transactions in range
  const excludedNames = new Set(
    getAccountList().filter(a => a.excludeFromLedger).map(a => a.name)
  );

  const pages = [];
  const progressEl    = document.getElementById('export-progress');
  const progressBar   = document.getElementById('export-progress-bar');
  const progressLabel = document.getElementById('export-progress-label');
  const progressDetail= document.getElementById('export-progress-detail');
  const statusEl      = document.getElementById('export-status');

  progressEl.classList.remove('hidden');
  const total = months.length * (txDocs.length > 0 ? 1 : 0) + months.length * ledgerDocs.length;
  let done = 0;

  function updateProgress(label, detail) {
    done++;
    progressBar.style.width = Math.round((done / total) * 100) + '%';
    progressLabel.textContent  = label;
    progressDetail.textContent = detail;
  }

  // ── Transaction documents ──
  if (txDocs.length > 0) {
    for (const { month, year } of months) {
      const monthName = ARABIC_MONTHS[month] || month;

      // Get transactions for this month (use transferDate for salfa/salfa_yad)
      const txsThisMonth = state.transactions.filter(tx => {
        if (excludedNames.has(tx.accountFrom) || excludedNames.has(tx.accountTo)) return false;
        if (tx.type === 'salfa' || tx.type === 'salfa_yad') {
          if (tx.status !== 'closed') return false;
          const d = new Date(tx.transferDate);
          return d.getFullYear() === year && (d.getMonth() + 1) === month;
        }
        // Skip inner cash items — they belong to their salfa
        const innerIds = new Set(
          state.transactions.filter(s => s.type === 'salfa').flatMap(s => s.items || [])
        );
        if (innerIds.has(tx.id)) return false;
        return txInMonth(tx, month, year);
      });

      for (const tx of txsThisMonth) {
        const availableDocs = ALL_DOCS[tx.type] || [];
        const docsToIssue   = availableDocs.filter(d => txDocs.includes(d.id));
        docsToIssue.forEach(doc => {
          if (docBuilders[doc.id]) pages.push(docBuilders[doc.id](tx));
        });
      }

      updateProgress(`معالجة مستندات ${monthName} ${year}`, `${txsThisMonth.length} معاملة`);
      await new Promise(r => setTimeout(r, 0)); // yield to UI
    }
  }

  // ── Ledger/report documents ──
  for (const { month, year } of months) {
    const monthName = ARABIC_MONTHS[month] || month;

    if (ledgerDocs.includes('summary')) {
      pages.push(_buildSummaryPage(month, year));
      updateProgress(`خلاصة صندوق يومية – ${monthName} ${year}`, '');
      await new Promise(r => setTimeout(r, 0));
    }

    if (ledgerDocs.includes('ledger')) {
      pages.push(_buildLedgerPage(month, year));
      updateProgress(`صندوق يومية – ${monthName} ${year}`, '');
      await new Promise(r => setTimeout(r, 0));
    }

    if (ledgerDocs.includes('devledger')) {
      pages.push(_buildDevLedgerPage(month, year));
      updateProgress(`صندوق التطوير – ${monthName} ${year}`, '');
      await new Promise(r => setTimeout(r, 0));
    }
  }

  progressEl.classList.add('hidden');

  if (pages.length === 0) {
    showToast('لا توجد مستندات في هذه الفترة', 'info');
    statusEl.textContent = '';
    return;
  }

  statusEl.textContent = `تم تجميع ${pages.length} صفحة`;
  const fromM = ARABIC_MONTHS[parseInt(document.getElementById('export-from-month').value)];
  const fromY = document.getElementById('export-from-year').value;
  const toM   = ARABIC_MONTHS[parseInt(document.getElementById('export-to-month').value)];
  const toY   = document.getElementById('export-to-year').value;

  openDocPreview(pages.join(''), `تصدير جماعي – ${fromM} ${fromY} إلى ${toM} ${toY}`);
}

/* ── Page builders that reuse existing print logic ───────── */
function _buildSummaryPage(month, year) {
  // Reuse computeSummaryData from reports.js
  const monthName  = ARABIC_MONTHS[month] || month;
  const monthNumAr = String(month).padStart(2, '0');
  const { accounts, startNet, received, paid, endNet } = computeSummaryData(month, year);

  const FIXED_ROWS = 9;
  const rows = [...accounts];
  while (rows.length < FIXED_ROWS) rows.push(null);

  function pFmtD(v) { return v > 0 ? Math.floor(v) : ''; }
  function pFmtF(v) { if (v <= 0) return ''; const f = Math.round((v % 1) * 1000); return f ? f : '—'; }
  function td(v) { return `<td class="num">${v}</td>`; }

  const rowsHTML = rows.map(a => {
    if (!a) return `<tr class="empty-row"><td></td>${'<td></td>'.repeat(12)}</tr>`;
    const sn = startNet[a.key] || 0, rc = received[a.key] || 0, pd = paid[a.key] || 0, en = endNet[a.key] || 0;
    const sMnh = sn >= 0 ? sn : 0, sLh = sn < 0 ? Math.abs(sn) : 0;
    const eMnh = en >= 0 ? en : 0, eLh = en < 0 ? Math.abs(en) : 0;
    return `<tr>
      <td class="acct-cell" style="color:${a.color};font-weight:700;">${a.name}</td>
      ${td(pFmtF(sMnh))}${td(pFmtD(sMnh))}${td(pFmtF(sLh))}${td(pFmtD(sLh))}
      ${td(pFmtF(rc))}${td(pFmtD(rc))}${td(pFmtF(pd))}${td(pFmtD(pd))}
      ${td(pFmtF(eMnh))}${td(pFmtD(eMnh))}${td(pFmtF(eLh))}${td(pFmtD(eLh))}
    </tr>`;
  }).join('');

  return `<div class="page" style="font-family:'Tajawal',sans-serif;direction:rtl;padding:5mm;background:#fff;">
    <table style="border-collapse:collapse;width:100%;font-size:7.5pt;table-layout:fixed;">
      <thead>
        <tr><td colspan="13" style="font-size:11pt;font-weight:900;background:#1e1b18;color:#fff;padding:5px;border:none;text-align:center;">خلاصة التبرعات المدرسية</td></tr>
        <tr><td colspan="13" style="font-size:10pt;font-weight:800;background:#374151;color:#fff;padding:4px;border:none;text-align:center;">شهر ( ${monthName} / ${monthNumAr} )&nbsp;&nbsp;سنة ( ${year} )</td></tr>
        <tr><td colspan="13" style="background:#f8fafc;padding:4px 8px;text-align:right;font-size:7.5pt;border-bottom:1px solid #e2e8f0;">
          مديرية: ${state.settings.dirName} &nbsp;|&nbsp; ${state.settings.schoolName} &nbsp;|&nbsp; الرقم الوطني: ${state.settings.schoolNid || '–'}
        </td></tr>
        <tr>
          <th rowspan="3" style="background:#1e1b18;color:#fff;font-size:7pt;border:0.5pt solid #374151;">الحساب</th>
          <th colspan="4" style="background:#1e1b18;color:#fff;font-size:7pt;border:0.5pt solid #374151;">الرصيد في بداية الشهر</th>
          <th colspan="2" rowspan="2" style="background:#1e1b18;color:#fff;font-size:7pt;border:0.5pt solid #374151;">المقبوض</th>
          <th colspan="2" rowspan="2" style="background:#1e1b18;color:#fff;font-size:7pt;border:0.5pt solid #374151;">المدفوع</th>
          <th colspan="4" style="background:#1e1b18;color:#fff;font-size:7pt;border:0.5pt solid #374151;">الرصيد في نهاية الشهر</th>
        </tr>
        <tr>
          <th colspan="2" style="background:#f97316;color:#fff;font-size:6.5pt;border:0.5pt solid #374151;">منه</th>
          <th colspan="2" style="background:#f97316;color:#fff;font-size:6.5pt;border:0.5pt solid #374151;">له</th>
          <th colspan="2" style="background:#f97316;color:#fff;font-size:6.5pt;border:0.5pt solid #374151;">منه</th>
          <th colspan="2" style="background:#f97316;color:#fff;font-size:6.5pt;border:0.5pt solid #374151;">له</th>
        </tr>
        <tr>
          ${Array(6).fill('<th style="background:#fff7ed;color:#c2410c;font-size:6pt;border:0.5pt solid #374151;">فلس</th><th style="background:#fff7ed;color:#c2410c;font-size:6pt;border:0.5pt solid #374151;">دينار</th>').join('')}
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>
  </div>`;
}

function _buildLedgerPage(month, year) {
  // Delegate to printLedger's internal logic by temporarily overriding month/year inputs
  // Instead, build directly using computeLedgerData
  const accounts = getAccountList().filter(a => !a.excludeFromLedger);
  const keyMap   = getAccountKeyMap();
  const monthName = ARABIC_MONTHS[month] || month;

  const excludedNames = new Set(getAccountList().filter(a => a.excludeFromLedger).map(a => a.name));
  const { carryFrom, carryTo, txsThisMonth, monthFrom, monthTo, totalFrom, totalTo } =
    computeLedgerData(month, year, accounts, keyMap);

  const sumFrom = {}, sumTo = {};
  accounts.forEach(a => {
    sumFrom[a.key] = (carryFrom[a.key] || 0) + (monthFrom[a.key] || 0);
    sumTo[a.key]   = (carryTo[a.key]   || 0) + (monthTo[a.key]   || 0);
  });

  // Reuse printLedger's row builders by calling it with fake DOM values
  // Instead build a simple summary page
  return `<div class="page" style="font-family:'Tajawal',sans-serif;direction:rtl;padding:5mm;background:#fff;">
    <div style="font-size:11pt;font-weight:900;background:#1e1b18;color:#fff;padding:6px;text-align:center;margin-bottom:2px;">صندوق يومية – ${monthName} ${year}</div>
    <div style="font-size:9pt;background:#374151;color:#fff;padding:4px;text-align:center;margin-bottom:2px;">${state.settings.schoolName} – ${state.settings.dirName}</div>
    <div style="font-size:8pt;color:#6b7280;text-align:center;margin-bottom:6px;">(${txsThisMonth.length} معاملة هذا الشهر)</div>
    <table style="border-collapse:collapse;width:100%;font-size:7.5pt;">
      <thead>
        <tr>
          <th style="background:#1e1b18;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">التاريخ</th>
          <th style="background:#1e1b18;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">التسلسلي</th>
          <th style="background:#1e1b18;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">منه</th>
          <th style="background:#1e1b18;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">له</th>
          <th style="background:#1e1b18;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">البيان</th>
          <th style="background:#1e1b18;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">المبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${txsThisMonth.map((tx, i) => `<tr style="background:${i%2===0?'#f8fafc':'#fff'};">
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:center;">${tx.date}</td>
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:center;font-family:monospace;">${tx.serial}</td>
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:right;">${tx.accountFrom}</td>
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:right;">${tx.accountTo}</td>
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:right;">${tx.purpose || tx.recipient || ''}</td>
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:center;font-weight:700;color:#c2410c;">${tx.total.toFixed(3)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function _buildDevLedgerPage(month, year) {
  const allAccounts = getAccountList();
  const keyMap      = getAccountKeyMap();
  const monthName   = ARABIC_MONTHS[month] || month;
  const accounts    = allAccounts.filter(a => a.name === 'البنك' || a.name === 'التطوير');
  if (accounts.length === 0) return '';

  const devAcc  = accounts.find(a => a.name === 'التطوير');
  const bankAcc = accounts.find(a => a.name === 'البنك');
  const dgTotal = state.settings.devGrant?.total || 0;

  const { txsThisMonth } = computeDevLedgerData(month, year, accounts, keyMap, bankAcc, devAcc, dgTotal);

  return `<div class="page" style="font-family:'Tajawal',sans-serif;direction:rtl;padding:5mm;background:#fff;">
    <div style="font-size:11pt;font-weight:900;background:#1e1b18;color:#fff;padding:6px;text-align:center;margin-bottom:2px;">صندوق يومية التطوير – ${monthName} ${year}</div>
    <div style="font-size:9pt;background:#374151;color:#fff;padding:4px;text-align:center;margin-bottom:6px;">${state.settings.schoolName} – ${state.settings.dirName}</div>
    <table style="border-collapse:collapse;width:100%;font-size:7.5pt;">
      <thead>
        <tr>
          <th style="background:#7c3aed;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">التاريخ</th>
          <th style="background:#7c3aed;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">التسلسلي</th>
          <th style="background:#7c3aed;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">منه</th>
          <th style="background:#7c3aed;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">له</th>
          <th style="background:#7c3aed;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">المجال</th>
          <th style="background:#7c3aed;color:#fff;border:0.5pt solid #374151;padding:2px 4px;">المبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${txsThisMonth.map((tx, i) => `<tr style="background:${i%2===0?'#faf5ff':'#fff'};">
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:center;">${tx.date}</td>
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:center;font-family:monospace;">${tx.serial}</td>
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:right;">${tx.accountFrom}</td>
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:right;">${tx.accountTo}</td>
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:right;">${DEV_GRANT_LABELS[tx.devGrantField] || '–'}</td>
          <td style="border:0.5pt solid #e2e8f0;padding:2px 4px;text-align:center;font-weight:700;color:#7c3aed;">${tx.total.toFixed(3)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}