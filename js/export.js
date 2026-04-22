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
  const orderByMonth = true;//document.querySelector('input[name="export-order"]:checked')?.value === 'month';

  if (txDocs.length === 0 && ledgerDocs.length === 0) {
    showToast('يرجى اختيار نوع مستند واحد على الأقل', 'error');
    return;
  }

  const excludedNames = new Set(
    getAccountList().filter(a => a.excludeFromLedger).map(a => a.name)
  );

  const pages = [];
  const progressEl     = document.getElementById('export-progress');
  const progressBar    = document.getElementById('export-progress-bar');
  const progressLabel  = document.getElementById('export-progress-label');
  const progressDetail = document.getElementById('export-progress-detail');
  const statusEl       = document.getElementById('export-status');

  progressEl.classList.remove('hidden');
  const total = months.length * ledgerDocs.length + (txDocs.length > 0 ? months.length : 0);
  let done = 0;

  function updateProgress(label, detail) {
    done++;
    progressBar.style.width = Math.round((done / total) * 100) + '%';
    progressLabel.textContent  = label;
    progressDetail.textContent = detail;
  }

  function getTxsForMonth(month, year) {
    return state.transactions
      .filter(tx => {
        if (excludedNames.has(tx.accountFrom) || excludedNames.has(tx.accountTo)) return false;
        if (tx.type === 'salfa' || tx.type === 'salfa_yad') {
          if (tx.status !== 'closed') return false;
          const d = new Date(tx.transferDate);
          return d.getFullYear() === year && (d.getMonth() + 1) === month;
        }
        const innerIds = new Set(
          state.transactions.filter(s => s.type === 'salfa').flatMap(s => s.items || [])
        );
        if (innerIds.has(tx.id)) return false;
        return txInMonth(tx, month, year);
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function buildTxPages(txsThisMonth) {
    const result = [];
    for (const tx of txsThisMonth) {
      const availableDocs = ALL_DOCS[tx.type] || [];
      const docsToIssue   = availableDocs.filter(d => txDocs.includes(d.id));
      docsToIssue.forEach(doc => {
        if (docBuilders[doc.id]) result.push(_wrapDocumentPageExport(docBuilders[doc.id](tx)));
      });
    }
    return result;
  }

  if (orderByMonth) {
    // ── Per-month: summary → ledger → devledger → transactions ──
    for (const { month, year } of months) {
      const monthName = ARABIC_MONTHS[month] || month;

      if (ledgerDocs.includes('summary')) {
        pages.push(_wrapReportPageExport(printReportPageMaker(month, year)));
        updateProgress(`خلاصة صندوق يومية – ${monthName} ${year}`, '');
        await new Promise(r => setTimeout(r, 0));
      }
      if (ledgerDocs.includes('ledger')) {
        pages.push(_wrapLedgerPrintExport(printLedgerPageMaker(month, year)));
        updateProgress(`صندوق يومية – ${monthName} ${year}`, '');
        await new Promise(r => setTimeout(r, 0));
      }
      if (ledgerDocs.includes('devledger')) {
        pages.push(_wrapDevLedgerPrintExport(printDevLedgerPageMaker(month, year)));
        updateProgress(`صندوق التطوير – ${monthName} ${year}`, '');
        await new Promise(r => setTimeout(r, 0));
      }
      if (txDocs.length > 0) {
        const txs = getTxsForMonth(month, year);
        pages.push(...buildTxPages(txs));
        updateProgress(`معاملات ${monthName} ${year}`, `${txs.length} معاملة`);
        await new Promise(r => setTimeout(r, 0));
      }
    }
  } else {
    // ── By type: all summaries → all ledgers → all devledgers → all transactions ──
    if (ledgerDocs.includes('summary')) {
      for (const { month, year } of months) {
        pages.push(_wrapReportPageExport(printReportPageMaker(month, year)));
        updateProgress(`خلاصة صندوق يومية – ${ARABIC_MONTHS[month]} ${year}`, '');
        await new Promise(r => setTimeout(r, 0));
      }
    }
    if (ledgerDocs.includes('ledger')) {
      for (const { month, year } of months) {
        pages.push(_wrapLedgerPrintExport(printLedgerPageMaker(month, year)));
        updateProgress(`صندوق يومية – ${ARABIC_MONTHS[month]} ${year}`, '');
        await new Promise(r => setTimeout(r, 0));
      }
    }
    if (ledgerDocs.includes('devledger')) {
      for (const { month, year } of months) {
        pages.push(_wrapDevLedgerPrintExport(printDevLedgerPageMaker(month, year)));
        updateProgress(`صندوق التطوير – ${ARABIC_MONTHS[month]} ${year}`, '');
        await new Promise(r => setTimeout(r, 0));
      }
    }
    if (txDocs.length > 0) {
      for (const { month, year } of months) {
        const txs = getTxsForMonth(month, year);
        pages.push(...buildTxPages(txs));
        updateProgress(`معاملات ${ARABIC_MONTHS[month]} ${year}`, `${txs.length} معاملة`);
        await new Promise(r => setTimeout(r, 0));
      }
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

function _wrapDocumentPageExport(html){
  const page = `
  <style>
    @scope (.document) {
      * { font-family:'Tajawal',Arial,sans-serif; box-sizing:border-box; margin:0; padding:0; }
      body { background:#e5e7eb; direction:rtl; }

      #toolbar {
        position:fixed; top:0; left:0; right:0; z-index:999;
        background:#1e1b18; color:#fff; padding:10px 20px;
        display:flex; align-items:center; justify-content:space-between;
        box-shadow:0 2px 12px rgba(0,0,0,.4);
      }
      #toolbar .doc-title { color:#f97316; font-weight:800; font-size:16px; }
      #toolbar .actions   { display:flex; gap:10px; }
      #toolbar button {
        padding:7px 18px; border-radius:7px; border:none; cursor:pointer;
        font-family:'Tajawal',sans-serif; font-size:13px; font-weight:700;
      }
      #btn-print-doc { background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; box-shadow:0 2px 8px rgba(249,115,22,.4); }
      #btn-close-doc { background:#374151; color:#d1d5db; }
      #pages-area { padding:68px 16px 30px; }

      .page {
        background:#fff; width:210mm; min-height:297mm;
        margin:0 auto 20px; box-shadow:0 4px 24px rgba(0,0,0,.18);
        padding:10mm 12mm; display:flex; flex-direction:column;
      }

      table            { border-collapse:collapse; width:100%; }
      td, th           { border:1pt solid #374151; padding:4px 8px; font-size:10pt; vertical-align:middle; }
      .hdr-center      { text-align:center; font-weight:800; font-size:11pt; padding:5px; }
      .hdr-title       { text-align:center; font-weight:900; font-size:12pt; padding:6px; background:#f8fafc; }
      .hdr-side        { text-align:right; font-weight:700; padding:4px 8px; }
      .body-row        { text-align:right; font-size:10.5pt; padding:6px 8px; line-height:1.8; }
      .amount-row      { text-align:right; font-size:10.5pt; padding:6px 8px; }
      .amount-box      { display:inline-block; border-bottom:1pt solid #374151; min-width:60px; text-align:center; font-weight:700; }
      .sig-table th    { background:#f1f5f9; font-weight:900; text-align:center; font-size:9.5pt; padding:4px; }
      .sig-table td    { font-size:9.5pt; padding:4px 6px; }
      .sig-label       { font-weight:700; background:#fafafa; white-space:nowrap; width:1%; }
      .dir-table       { width:auto; }
      .dir-table th    { background:#f1f5f9; font-weight:900; text-align:center; font-size:9.5pt; padding:4px 16px; }
      .dir-table td    { font-size:9.5pt; padding:4px 10px; }
      .dir-table .dl   { font-weight:700; background:#fafafa; white-space:nowrap; width:1%; }
      .items-table th  { background:#f1f5f9; font-weight:800; text-align:center; font-size:9pt; }
      .items-table td  { font-size:9pt; }
      .num-cell        { text-align:center; font-weight:700; }
      .span-cell       { text-align:right; }
      .majmoo          { font-weight:900; font-size:9.5pt; text-align:center; background:#fff7ed; }
      .cert-row        { text-align:center; font-size:9pt; font-weight:700; padding:6px; }
      .payment-table td{ text-align:center; font-weight:700; font-size:9.5pt; padding:5px; }
      .recip-label     { font-weight:700; background:#fafafa; white-space:nowrap; width:1%; }
      .matloob-line    { border-bottom:1pt solid #374151; display:inline-block; width:100%; }

      #print-instructions {
        display:none; position:fixed; inset:0; z-index:9999;
        background:rgba(0,0,0,.55); align-items:center; justify-content:center;
      }
      .modal-box         { background:#fff; border-radius:14px; padding:28px 32px; max-width:460px; width:90%; direction:rtl; box-shadow:0 8px 40px rgba(0,0,0,.25); }
      .modal-box h2      { font-size:17px; font-weight:900; margin-bottom:12px; }
      .modal-box ol      { font-size:13px; padding-right:18px; line-height:2; margin-bottom:14px; color:#1e293b; }
      .modal-box .warn   { background:#fef3c7; border:1px solid #fcd34d; border-radius:8px; padding:10px 14px; font-size:12px; color:#92400e; margin-bottom:18px; }
      .modal-box .btns   { display:flex; gap:10px; justify-content:flex-end; }
      .modal-box button  { padding:8px 18px; border-radius:8px; border:none; font-family:'Tajawal',sans-serif; font-size:13px; font-weight:700; cursor:pointer; }
      .btn-cancel        { background:#f1f5f9; color:#334155; }
      .btn-confirm       { background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; }

      @media print {
        body { background:#fff; }
        #toolbar, #print-instructions { display:none !important; }
        #pages-area { padding:0; }
        .page { box-shadow:none; margin:0; padding:8mm 10mm; width:100%; min-height:unset; page-break-after:always; }
        .page:last-child { page-break-after:avoid; }
      }
      @page { size:A4 portrait; margin:5mm; }
    }
  </style>
  <div class="document" style="width:100%;height:100%">
      ${html}
  </div>
  `;

  return page
}

function _wrapReportPageExport(html) {
    const page = `
    <style>
        @scope (.report) {
            * { font-family:'Tajawal',sans-serif; box-sizing:border-box; margin:0; padding:0; }
            body { background:#e5e7eb; direction:rtl; }
            #toolbar { position:fixed; top:0; left:0; right:0; z-index:999; background:#1e1b18; color:#fff; padding:10px 20px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 2px 12px rgba(0,0,0,.4); }
            #toolbar .doc-title { color:#f97316; font-weight:800; font-size:16px; }
            #toolbar button { padding:7px 18px; border-radius:7px; border:none; cursor:pointer; font-family:'Tajawal',sans-serif; font-size:13px; font-weight:700; margin-left:10px; }
            #btn-print-doc { background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; box-shadow:0 2px 8px rgba(249,115,22,.4); }
            #btn-close-doc { background:#374151; color:#d1d5db; }
            #pages-area { padding:68px 16px 30px; }

            .page { 
              background:#fff; width:297mm; min-height:210mm; 
              margin:0 auto 20px; box-shadow:0 4px 24px rgba(0,0,0,.18); 
              padding:5mm; display:flex; flex-direction:column; 
            }
            .page {
              min-width: unset;
              width: 297mm;
              min-height:unset;
              height: 210mm;
            }
            table { border-collapse:collapse; width:100%; font-size:8pt; }
            th, td { border:0.5pt solid #374151; padding:2px 3px; text-align:center; white-space:nowrap; vertical-align:middle; line-height:1.25; }
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
            @page { size:A4 landscape; margin:5mm; }
        }
    </style>
    <div class="report" style="width:100%;height:100%">
        ${html}
    </div>
    `
    return page;
}

function _wrapLedgerPrintExport(html) {
    const page = `
    <style>
        @scope (.ledger) {
            ${_ledgerCSS}
            @media print { body { background:#fff; } #toolbar { display:none !important; } #pages-area { padding:0; } .page { box-shadow:none; margin:0; page-break-after:always; width:100%; padding:4mm 3mm 5mm; } .page:last-child { page-break-after:avoid; } }
            @page { size:500mm 180mm; margin:5mm; }
            .page {
              min-height:unset;
              height:180mm;
            }
        }
    </style>
    <div class="ledger" style="width:100%;height:100%">
        ${html}
    </div>
    `
    return page;
}

function _wrapDevLedgerPrintExport(html) {
    const page = `
    <style>
        @scope (.devledger) {
            ${_ledgerCSS}
            @media print { body { background:#fff; } #toolbar { display:none !important; } #pages-area { padding:0; } .page { box-shadow:none; margin:0; page-break-after:always; width:100%; padding:4mm 3mm 5mm; } .page:last-child { page-break-after:avoid; } }
            @page { size:A4 landscape; margin:5mm; }
            .page {
              min-width: unset;
              width: 297mm;
              min-height:unset;
              height: 210mm;
            }
        }
    </style>
    <div class="devledger" style="width:100%;height:100%">
        ${html}
    </div>
    `
    return page;
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