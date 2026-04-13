/* ═══════════════════════════════════════════════════════════════
   reports.js — ميزان
   خلاصة صندوق يومية — monthly balance summary (screen + print).
═══════════════════════════════════════════════════════════════ */

'use strict';

function getReportYear() {
  const m = parseInt(document.getElementById('report-year-manual').value);
  return m > 1900 ? m : new Date().getFullYear();
}

/* ── Data computation ───────────────────────────────────────
   Returns per-account: carryFrom/To (start balance),
   received (مقبوض), paid (مدفوع), endFrom/To (end balance).
─────────────────────────────────────────────────────────── */
function computeSummaryData(month, year) {
  const accounts = getAccountList().filter(a => !a.excludeFromLedger);
  const keyMap   = getAccountKeyMap();

  const excludedNames = new Set(
    getAccountList().filter(a => a.excludeFromLedger).map(a => a.name)
  );

  const sorted = [...state.transactions]
  .filter(tx => {
    if (excludedNames.has(tx.accountFrom) || excludedNames.has(tx.accountTo)) return false;
    if (tx.type === 'salfa' || tx.type === 'salfa_yad') return tx.status === 'closed';
    return true;
  })
  .map(tx => (tx.type === 'salfa' || tx.type === 'salfa_yad') ? { ...tx, date: tx.transferDate } : tx)
  .sort((a, b) => a.date.localeCompare(b.date));

  const targetStart = `${year}-${String(month).padStart(2, '0')}-01`;

  // Opening balance (carry from initial + all prior transactions)
  const carryFrom = {}, carryTo = {};
  accounts.forEach(a => {
    carryFrom[a.key] = a.balanceFrom || 0;
    carryTo[a.key]   = a.balanceTo   || 0;
  });
  sorted.filter(tx => tx.date < targetStart).forEach(tx => {
    const fk = keyMap[tx.accountFrom];
    const tk = keyMap[tx.accountTo];
    if (fk !== undefined) carryFrom[fk] = (carryFrom[fk] || 0) + tx.total;
    if (tk !== undefined) carryTo[tk]   = (carryTo[tk]   || 0) + tx.total;
  });
  // Net carry into منه/له
  const startNet = {};
  accounts.forEach(a => {
    startNet[a.key] = (carryFrom[a.key] || 0) - (carryTo[a.key] || 0);
  });

  // This month's transactions
  const txsThisMonth = sorted.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });

  // مقبوض = money coming INTO the account (accountTo = this account)
  // مدفوع = money going OUT of the account (accountFrom = this account)
  const received = {}, paid = {};
  accounts.forEach(a => { received[a.key] = 0; paid[a.key] = 0; });
  txsThisMonth.forEach(tx => {
    const fk = keyMap[tx.accountFrom];
    const tk = keyMap[tx.accountTo];
    if (fk !== undefined) paid[fk]     = (paid[fk]     || 0) + tx.total;
    if (tk !== undefined) received[tk] = (received[tk] || 0) + tx.total;
  });

  // End balance = startNet + received - paid
  const endNet = {};
  accounts.forEach(a => {
    endNet[a.key] = (startNet[a.key] || 0) + (received[a.key] || 0) - (paid[a.key] || 0);
  });

  return { accounts, startNet, received, paid, endNet };
}

/* ── Format helpers ──────────────────────────────────────── */
const _rD = v => v > 0 ? Math.floor(v) : '';
const _rF = v => {
  if (v <= 0) return '';
  const f = Math.round((v % 1) * 1000);
  return f ? f : '—';
};

/* ── Screen view ─────────────────────────────────────────── */
function generateReport() {
  const month = parseInt(document.getElementById('report-month').value);
  const year  = getReportYear();
  const monthName = ARABIC_MONTHS[month] || month;

  const { accounts, startNet, received, paid, endNet } = computeSummaryData(month, year);

  document.getElementById('report-heading').textContent =
    `خلاصة صندوق يومية – ${monthName} ${year}`;
  document.getElementById('report-school-line').textContent =
    `${state.settings.schoolName} · ${state.settings.dirName}`;

  // Stats bar
  const totalRcv = accounts.reduce((s, a) => s + (received[a.key] || 0), 0);
  const totalPaid = accounts.reduce((s, a) => s + (paid[a.key]    || 0), 0);
  document.getElementById('report-stats').innerHTML = `
    <div class="card p-4 text-center" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);">
      <div class="text-xs text-green-500 font-semibold mb-1">إجمالي المقبوض</div>
      <div class="text-xl font-black text-green-600">${totalRcv.toFixed(3)} د.أ</div>
    </div>
    <div class="card p-4 text-center" style="background:linear-gradient(135deg,#fff7ed,#ffedd5);">
      <div class="text-xs text-orange-400 font-semibold mb-1">إجمالي المدفوع</div>
      <div class="text-xl font-black text-orange-600">${totalPaid.toFixed(3)} د.أ</div>
    </div>
    <div class="card p-4 text-center" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);">
      <div class="text-xs text-blue-500 font-semibold mb-1">صافي الشهر</div>
      <div class="text-xl font-black text-blue-600">${(totalRcv - totalPaid).toFixed(3)} د.أ</div>
    </div>`;

  // Build 9 rows (pad with blanks)
  const FIXED_ROWS = 9;
  const rows = [...accounts];
  while (rows.length < FIXED_ROWS) rows.push(null);

  // Totals
  let totStartMnhD=0, totStartMnhF=0, totStartLhD=0, totStartLhF=0;
  let totRcvD=0, totRcvF=0, totPaidD=0, totPaidF=0;
  let totEndMnhD=0, totEndMnhF=0, totEndLhD=0, totEndLhF=0;

  const rowsHTML = rows.map((a, i) => {
    if (!a) return `<tr style="background:${i%2===0?'#f8fafc':'#fff'}">
      <td class="px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-200">&nbsp;</td>
      ${Array(12).fill('<td class="border border-gray-200 text-center text-xs">&nbsp;</td>').join('')}
    </tr>`;

    const sn = startNet[a.key] || 0;
    const rc = received[a.key] || 0;
    const pd = paid[a.key]     || 0;
    const en = endNet[a.key]   || 0;

    // Start balance: منه if positive (debit), له if negative (credit)
    const sMnh = sn >= 0 ? sn : 0;
    const sLh  = sn <  0 ? Math.abs(sn) : 0;
    // End balance
    const eMnh = en >= 0 ? en : 0;
    const eLh  = en <  0 ? Math.abs(en) : 0;

    // Accumulate totals
    totStartMnhD += Math.floor(sMnh); totStartMnhF += (sMnh % 1);
    totStartLhD  += Math.floor(sLh);  totStartLhF  += (sLh  % 1);
    totRcvD  += Math.floor(rc); totRcvF  += (rc % 1);
    totPaidD += Math.floor(pd); totPaidF += (pd % 1);
    totEndMnhD += Math.floor(eMnh); totEndMnhF += (eMnh % 1);
    totEndLhD  += Math.floor(eLh);  totEndLhF  += (eLh  % 1);

    const bg = i % 2 === 0 ? '#f8fafc' : '#fff';
    const cell = (v) => `<td class="border border-gray-200 text-center text-xs font-mono py-1">${v || '&nbsp;'}</td>`;
    return `<tr style="background:${bg};">
      <td class="px-3 py-2 text-xs font-semibold border border-gray-200" style="color:${a.color}">${a.name || '&nbsp;'}</td>
      ${cell(_rF(sMnh))}${cell(_rD(sMnh))}
      ${cell(_rF(sLh))}${cell(_rD(sLh))}
      ${cell(_rF(rc))}${cell(_rD(rc))}
      ${cell(_rF(pd))}${cell(_rD(pd))}
      ${cell(_rF(eMnh))}${cell(_rD(eMnh))}
      ${cell(_rF(eLh))}${cell(_rD(eLh))}
    </tr>`;
  }).join('');

  const totCell = (v) => `<td class="border border-orange-300 text-center text-xs font-black font-mono py-1 text-orange-700">${v || ''}</td>`;
  const totalsHTML = `<tr style="background:#fff7ed; border-top:2px solid #f97316;">
    <td class="px-3 py-2 text-xs font-black border border-orange-300 text-orange-700">المجموع</td>
    ${totCell(Math.round(totStartMnhF*1000))||''}${totCell(totStartMnhD||'')}
    ${totCell(Math.round(totStartLhF*1000)||'')}${totCell(totStartLhD||'')}
    ${totCell(Math.round(totRcvF*1000)||'')}${totCell(totRcvD||'')}
    ${totCell(Math.round(totPaidF*1000)||'')}${totCell(totPaidD||'')}
    ${totCell(Math.round(totEndMnhF*1000)||'')}${totCell(totEndMnhD||'')}
    ${totCell(Math.round(totEndLhF*1000)||'')}${totCell(totEndLhD||'')}
  </tr>`;

  document.getElementById('report-summary-table').innerHTML = `
    <div class="overflow-x-auto rounded-xl border border-gray-200">
      <table class="w-full text-sm border-collapse" style="min-width:700px;">
        <thead>
          <tr>
            <th class="border border-gray-300 px-3 py-2 text-xs font-bold text-white text-right" rowspan="3" style="background:#1e1b18; min-width:90px;">الحساب</th>
            <th class="border border-gray-300 px-2 py-1 text-xs font-bold text-white text-center" colspan="4" style="background:#1e1b18;">الرصيد في بداية الشهر</th>
            <th class="border border-gray-300 px-2 py-1 text-xs font-bold text-white text-center" colspan="2" rowspan="2" style="background:#1e1b18;">المقبوض خلال الشهر</th>
            <th class="border border-gray-300 px-2 py-1 text-xs font-bold text-white text-center" colspan="2" rowspan="2" style="background:#1e1b18;">المدفوع خلال الشهر</th>
            <th class="border border-gray-300 px-2 py-1 text-xs font-bold text-white text-center" colspan="4" style="background:#1e1b18;">الرصيد في نهاية الشهر</th>
          </tr>
          <tr>
            <th class="border border-gray-300 px-2 py-1 text-xs font-bold text-white text-center" colspan="2" style="background:#f97316;">منه</th>
            <th class="border border-gray-300 px-2 py-1 text-xs font-bold text-white text-center" colspan="2" style="background:#f97316;">له</th>
            <th class="border border-gray-300 px-2 py-1 text-xs font-bold text-white text-center" colspan="2" style="background:#f97316;">منه</th>
            <th class="border border-gray-300 px-2 py-1 text-xs font-bold text-white text-center" colspan="2" style="background:#f97316;">له</th>
          </tr>
          <tr>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">فلس</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">دينار</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">فلس</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">دينار</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">فلس</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">دينار</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">فلس</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">دينار</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">فلس</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">دينار</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">فلس</th>
            <th class="border border-gray-300 px-1 py-1 text-xs font-bold text-orange-700 text-center" style="background:#fff7ed;">دينار</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
          ${totalsHTML}
        </tbody>
      </table>
    </div>`;

  document.getElementById('report-output').classList.remove('hidden');
  const btnPrint = document.getElementById('btn-print-report');
  if (btnPrint) { 
    btnPrint.disabled = false; 
    btnPrint.style.background = 'linear-gradient(135deg,#f97316,#ea580c)';
    btnPrint.style.boxShadow  = '0 2px 8px rgba(249,115,22,.35)';
  }
  
  showToast(`تم إنشاء خلاصة ${monthName} ${year}`, 'success');
}

/* ── Print view ──────────────────────────────────────────── */
function printReport() {
  const month = parseInt(document.getElementById('report-month').value);
  const year  = getReportYear();
  const monthName  = ARABIC_MONTHS[month] || month;
  const monthNumAr = String(month).padStart(2, '0');

  const { accounts, startNet, received, paid, endNet } = computeSummaryData(month, year);

  const FIXED_ROWS = 9;
  const rows = [...accounts];
  while (rows.length < FIXED_ROWS) rows.push(null);

  let totSMnhD=0,totSMnhF=0,totSLhD=0,totSLhF=0;
  let totRD=0,totRF=0,totPD=0,totPF=0;
  let totEMnhD=0,totEMnhF=0,totELhD=0,totELhF=0;

  function pFmtD(v) { return v > 0 ? Math.floor(v) : ''; }
  function pFmtF(v) {
    if (v <= 0) return '';
    const f = Math.round((v % 1) * 1000);
    return f ? f : '—';
  }
  function td(v, cls='') {
    return `<td class="num ${cls}">${v}</td>`;
  }

  const rowsHTML = rows.map((a, i) => {
    if (!a) return `<tr class="empty-row"><td>&nbsp;</td>${'<td>&nbsp;</td>'.repeat(12)}</tr>`;

    const sn = startNet[a.key] || 0;
    const rc = received[a.key] || 0;
    const pd = paid[a.key]     || 0;
    const en = endNet[a.key]   || 0;

    const sMnh = sn >= 0 ? sn : 0;
    const sLh  = sn <  0 ? Math.abs(sn) : 0;
    const eMnh = en >= 0 ? en : 0;
    const eLh  = en <  0 ? Math.abs(en) : 0;

    totSMnhD += Math.floor(sMnh); totSMnhF += (sMnh % 1);
    totSLhD  += Math.floor(sLh);  totSLhF  += (sLh  % 1);
    totRD  += Math.floor(rc);  totRF  += (rc  % 1);
    totPD  += Math.floor(pd);  totPF  += (pd  % 1);
    totEMnhD += Math.floor(eMnh); totEMnhF += (eMnh % 1);
    totELhD  += Math.floor(eLh);  totELhF  += (eLh  % 1);

    return `<tr>
      <td class="acct-cell" style="color:${a.color};font-weight:700;">${a.name || '&nbsp;'}</td>
      ${td(pFmtF(sMnh))}${td(pFmtD(sMnh))}
      ${td(pFmtF(sLh))} ${td(pFmtD(sLh))}
      ${td(pFmtF(rc))}  ${td(pFmtD(rc))}
      ${td(pFmtF(pd))}  ${td(pFmtD(pd))}
      ${td(pFmtF(eMnh))}${td(pFmtD(eMnh))}
      ${td(pFmtF(eLh))} ${td(pFmtD(eLh))}
    </tr>`;
  }).join('');

  const tF = v => Math.round(v * 1000) || '';
  const totalsHTML = `<tr class="total-row">
    <td class="acct-cell" style="font-weight:900;">المجموع</td>
    ${td(tF(totSMnhF))}${td(totSMnhD||'')}
    ${td(tF(totSLhF))} ${td(totSLhD||'')}
    ${td(tF(totRF))}   ${td(totRD||'')}
    ${td(tF(totPF))}   ${td(totPD||'')}
    ${td(tF(totEMnhF))}${td(totEMnhD||'')}
    ${td(tF(totELhF))} ${td(totELhD||'')}
  </tr>`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>خلاصة صندوق يومية – ${monthName} ${year}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    * { font-family:'Tajawal',sans-serif; box-sizing:border-box; margin:0; padding:0; }
    body { background:#e5e7eb; direction:rtl; }
    #toolbar { position:fixed; top:0; left:0; right:0; z-index:999; background:#1e1b18; color:#fff; padding:10px 20px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 2px 12px rgba(0,0,0,.4); }
    #toolbar .doc-title { color:#f97316; font-weight:800; font-size:16px; }
    #toolbar button { padding:7px 18px; border-radius:7px; border:none; cursor:pointer; font-family:'Tajawal',sans-serif; font-size:13px; font-weight:700; margin-left:10px; }
    #btn-print-doc { background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; box-shadow:0 2px 8px rgba(249,115,22,.4); }
    #btn-close-doc { background:#374151; color:#d1d5db; }
    #pages-area { padding:68px 16px 30px; }
    
    .page { 
      background:#fff; width:210mm; min-height:297mm; 
      margin:0 auto 20px; box-shadow:0 4px 24px rgba(0,0,0,.18); 
      padding:5mm; display:flex; flex-direction:column; 
    }
    table { border-collapse:collapse; width:100%; font-size:8pt; table-layout: fixed;}
    th, td { border:0.5pt solid #374151; padding:2px 2px; text-align:center; vertical-align:middle; line-height:1.25; }
    .title-row-1 td { font-size:11pt; font-weight:900; background:#1e1b18; color:#fff; padding:5px; border:none; }
    .title-row-2 td { font-size:10pt; font-weight:800; background:#374151; color:#fff; padding:4px; border:none; }
    .title-row-3 td { font-size:9.5pt; font-weight:700; background:#fff7ed; color:#c2410c; padding:4px; border:none; }
    .title-row-school td { background:#f8fafc; font-size:8pt; }
    thead tr:nth-child(4) th { background:#1e1b18; color:#fff; font-weight:800; font-size:7.5pt; }
    thead tr:nth-child(5) th { background:#f97316; color:#fff; font-weight:700; font-size:7pt; }
    thead tr:nth-child(6) th { background:#fff7ed; color:#c2410c; font-weight:700; font-size:6.5pt; }
    td.num { font-size:7pt; font-weight:600; }
    td.acct-cell { text-align:right; padding-right:5px; font-size:8pt; min-width:70px; }
    tbody tr:nth-child(odd)  td { background:#f8fafc; }
    tbody tr:nth-child(even) td { background:#fff; }
    tr.empty-row td { height:13pt; background:inherit; }
    tr.total-row td { background:#fff7ed !important; font-weight:900; color:#c2410c; border-top:1.5pt solid #f97316; font-size:7.5pt; }
    
    .page-footer { margin-top:auto; text-align:center; font-size:7pt; color:#6b7280; padding-top:6px; border-top:0.4pt solid #e5e7eb; }
    @media print { body{background:#fff;} #toolbar{display:none!important;} #pages-area{padding:0;} .page{box-shadow:none;margin:0;padding:4mm 3mm 5mm;} }
    @page { size:A4 portrait; margin:5mm; }
  </style>
</head>
<body>
<div id="toolbar">
  <span class="doc-title">📋 خلاصة صندوق يومية – ${monthName} ${year}</span>
  <div>
    <button id="btn-print-doc" onclick="window.print()">🖨️ طباعة / PDF</button>
    <button id="btn-close-doc" onclick="window.parent.closeLedgerPreview()">✕ إغلاق</button>
  </div>
</div>
<div id="pages-area">
  <div class="page">
    <table>
      <thead>
        <tr class="title-row-1"><td colspan="13">خلاصة التبرعات المدرسية</td></tr>
        <tr class="title-row-2"><td colspan="13">شهر ( ${monthName} / ${monthNumAr} )&nbsp;&nbsp;&nbsp;&nbsp;سنة ( ${year} )</td></tr>
        <tr class="title-row-school">
          <td colspan="13" style="padding:6px 10px; background:#f8fafc; border-bottom:1px solid #e2e8f0; text-align:right; font-size:8pt;">
            <table style="width:100%; border:none; border-collapse:collapse;">
              <tr>
                <td style="width:33%; border:none; padding:2px 8px; white-space:nowrap; font-weight:700;">مديرية التربية والتعليم: ${state.settings.dirName} / قسم الشؤون المالية</td>
                <td style="width:33%; border:none; padding:2px 8px; white-space:nowrap; font-weight:700;">اسم المدرسة: ${state.settings.schoolName}</td>
                <td style="width:33%; border:none; padding:2px 8px; white-space:nowrap; font-weight:700;">الرقم الوطني للمدرسة: ${state.settings.schoolNid || '–'}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <th rowspan="3" style="min-width:70px;">الحساب</th>
          <th colspan="4">الرصيد في بداية الشهر</th>
          <th colspan="2" rowspan="2">المقبوض خلال الشهر</th>
          <th colspan="2" rowspan="2">المدفوع خلال الشهر</th>
          <th colspan="4">الرصيد في نهاية الشهر</th>
        </tr>
        <tr>
          <th colspan="2">منه</th>
          <th colspan="2">له</th>
          <th colspan="2">منه</th>
          <th colspan="2">له</th>
        </tr>
        <tr>
          <th>فلس</th><th>دينار</th>
          <th>فلس</th><th>دينار</th>
          <th>فلس</th><th>دينار</th>
          <th>فلس</th><th>دينار</th>
          <th>فلس</th><th>دينار</th>
          <th>فلس</th><th>دينار</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHTML}
        ${totalsHTML}
      </tbody>
    </table>
    <div style="margin-top:20px; display:flex; justify-content:flex-end; padding-left:20mm;">
      <div style="text-align:center; min-width:120px;">
        <div style="font-size:8pt; font-weight:700; margin-bottom:40px;">خاتم المدرسة والتوقيع:</div>
        <div style="border-top:1px solid #374151; padding-top:4px; font-size:7pt; color:#6b7280;">التوقيع</div>
      </div>
    </div>
    <div class="page-footer">خلاصة صندوق يومية · ${state.settings.schoolName} · ${monthName} ${year}</div>
  </div>
</div>
</body></html>`;

  openLedgerPreview(html);
}