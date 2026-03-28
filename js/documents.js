/* ═══════════════════════════════════════════════════════════════
   documents.js — ميزان
   Printable document page builders (disbursement, decision,
   local purchase, claim, journal) and the iframe preview shell.

   All builders receive a `tx` transaction object and return an
   HTML string for one <div class="page">…</div>.

   The `docBuilders` map is the single registry that connects
   document IDs (from ALL_DOCS in config.js) to their builder
   functions — add a new doc type here and everywhere picks it up.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Arabic number-to-words ──────────────────────────────── */
function numberToArabicWords(amount) {
  const ones = [
    '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
    'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر',
    'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
  ];
  const tens     = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

  if (amount === 0) return 'صفر';

  const dinars = Math.floor(amount);
  const fils   = Math.round((amount - dinars) * FILS_PER_DINAR);

  function belowThousand(n) {
    if (n === 0)   return '';
    if (n < 20)    return ones[n];
    if (n < 100) {
      const t = Math.floor(n / 10), o = n % 10;
      return o === 0 ? tens[t] : ones[o] + ' و' + tens[t];
    }
    const h = Math.floor(n / 100), rem = n % 100;
    return rem === 0 ? hundreds[h] : hundreds[h] + ' و' + belowThousand(rem);
  }

  function convert(n) {
    if (n === 0)    return '';
    if (n < 1000)   return belowThousand(n);
    const th = Math.floor(n / 1000), rem = n % 1000;
    let r = th === 1 ? 'ألف' : th === 2 ? 'ألفان' : th < 11
      ? ones[th] + ' آلاف'
      : belowThousand(th) + ' ألف';
    if (rem) r += ' و' + belowThousand(rem);
    return r;
  }

  let result = convert(dinars) + ' دينار';
  if (fils > 0) result += ' و' + convert(fils) + ' فلس';
  return result;
}

/* ── Salfa normaliser ────────────────────────────────────── */
// Ensures salfa transactions expose the same fields as regular ones
// when passed to generic page builders (disbursement, decision).
function normalizeSalfaTx(tx) {
  if (tx.type !== 'salfa') return tx;
  return {
    ...tx,
    recipient:   tx.salfaOwner       || '',
    nid:         tx.salfaOwnerNid    || '',
    purpose:     tx.salfaBayan       || '',
    invoiceNo:   tx.salfaInvoiceNo   || '',
    invoiceDate: tx.salfaInvoiceDate || '',
    items:       tx.salfaItems       || [],
  };
}

/* ═══════════════════════════════════════════════════════════
   PAGE BUILDERS
   Each returns an HTML string: one <div class="page">…</div>
═══════════════════════════════════════════════════════════ */

function buildDisbursementPage(tx) {
  tx = normalizeSalfaTx(tx);
  const amountWords  = numberToArabicWords(tx.total);
  const dinar        = Math.floor(tx.total);
  const fils         = Math.round((tx.total - dinar) * FILS_PER_DINAR);
  const isCheck      = !!(tx.transferNo && tx.transferNo.trim());
  const payMethod    = isCheck ? 'شيك' : 'نقداً';
  const purposeList  = (tx.purpose || '').split(/[،,]/).map(s => s.trim()).filter(Boolean);

  return `<div class="page">

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td class="hdr-center" style="border:none;">
      <img src="moe-logo.jpg" style="height:90px; object-fit:contain;" />
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td class="hdr-center" style="border:none;">مديرية ${state.settings.dirName}</td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td class="hdr-title" style="border:none;">مستند صرف تبرعات مدرسية</td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td class="hdr-center" style="border:none;">مدرسة ${state.settings.schoolName}</td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;">
    <tr>
      <td class="hdr-side" style="border:none;">رقم الصرف: ( ${tx.serial} )</td>
    </tr>
    <tr>
      <td class="hdr-side" style="border:none;">التاريخ: ${tx.date}</td>
    </tr>
  </table>

  <table class="matloob-row" style="margin-bottom:0; border-collapse:collapse;">
    <tr>
      <td style="border:none; white-space:nowrap; width:1%; font-weight:700;">مطلوب إلى:</td>
      <td style="border:none;"><span class="matloob-line">${tx.recipient || ''}</span></td>
    </tr>
  </table>

  <table class="items-table" style="margin-bottom:0;">
    <colgroup>
      <col style="width:10%;"><col style="width:10%;">
      <col style="width:45%;"><col style="width:35%;">
    </colgroup>
    <thead>
      <tr>
        <th colspan="2">المبلغ</th>
        <th colspan="2" rowspan="2">تفاصيل الدفعة</th>
      </tr>
      <tr>
        <th>فلس</th><th>دينار</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="num-cell">${fils  || '—————'}</td>
        <td class="num-cell">${dinar || '—————'}</td>
        <td class="span-cell" style="white-space:pre; border-left:none;">قيمة الفاتورة رقم (${tx.invoiceNo || '                    '})</td>
        <td style="border-right:none;">تاريخ:${tx.invoiceDate || ''}</td>
      </tr>
      <tr>
        <td></td><td></td>
        <td class="span-cell" style="white-space:pre; border-left:none;">مستند ادخالات رقم: (${tx.entryDocNo || '                    '})</td>
        <td style="border-right:none;">تاريخ:${tx.entryDocDate || ''}</td>
      </tr>
      <tr><td></td><td></td><td class="span-cell" style="border-left:none;">قرار أو طلب مشترى:</td><td style="border-right:none;"></td></tr>
      <tr><td></td><td></td><td class="span-cell" style="border-left:none;">ضبط استلام</td><td style="border-right:none;"></td></tr>
      <tr>
        <td></td><td></td>
        <td class="span-cell" style="white-space:pre; border-left:none;">صورة عن وصول دفع رسوم الطوابع رقم (     )</td>
        <td style="border-right:none;">تاريخ:</td>
      </tr>
      <tr><td></td><td></td><td colspan="2" class="span-cell">نوع اللوازم:</td></tr>
      <tr><td></td><td></td><td colspan="2" class="span-cell">1- ${purposeList[0] || ''}</td></tr>
      <tr><td></td><td></td><td colspan="2" class="span-cell">2- ${purposeList[1] || ''}</td></tr>
      <tr><td></td><td></td><td colspan="2" class="span-cell">3- ${purposeList[2] || ''}</td></tr>
      <tr><td></td><td></td><td colspan="2" class="span-cell">4- ${purposeList[3] || ''}</td></tr>
      <tr><td></td><td></td><td colspan="2" class="span-cell">5- ${purposeList[4] || ''}</td></tr>
      <tr>
        <td class="majmoo">${fils  || '—————'}</td>
        <td class="majmoo">${dinar || '—————'}</td>
        <td class="majmoo" colspan="2">المجموع: فقط ( ${amountWords} ) لاغير</td>
      </tr>
    </tbody>
  </table>

  <table style="margin-top:8px;"><tr>
    <td class="cert-row">اصادق على صحة البيان المذكور أعلاه ونشهد أن الاتفاق قد تم وفقاً للنظام وتعليماته</td>
  </tr></table>

  <table class="sig-table" style="margin-top:8px;">
    <thead>
      <tr>
        <th colspan="2">عضو لجنة</th>
        <th colspan="2">عضو لجنة</th>
        <th colspan="2">عضو لجنة</th>
        <th colspan="2">مدير المدرسة</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sig-label">الاسم:</td><td>${state.settings.member1 || ''}</td>
        <td class="sig-label">الاسم:</td><td>${state.settings.member2 || ''}</td>
        <td class="sig-label">الاسم:</td><td>${state.settings.member3 || ''}</td>
        <td class="sig-label">الاسم:</td><td>${state.settings.headmaster || ''}</td>
      </tr>
      <tr>
        <td class="sig-label">التوقيع:</td><td></td>
        <td class="sig-label">التوقيع:</td><td></td>
        <td class="sig-label">التوقيع:</td><td></td>
        <td class="sig-label">التوقيع:</td><td></td>
      </tr>
      <tr>
        <td class="sig-label">التاريخ:</td><td>${tx.date || ''}</td>
        <td class="sig-label">التاريخ:</td><td>${tx.date || ''}</td>
        <td class="sig-label">التاريخ:</td><td>${tx.date || ''}</td>
        <td class="sig-label">التاريخ:</td><td>${tx.date || ''}</td>
      </tr>
    </tbody>
  </table>

  <table class="payment-table" style="margin-top:8px;">
    <tr>
      <td>رقم التحويل: ${tx.transferNo || '–'}</td>
      <td>التاريخ: ${tx.transferDate || ''}</td>
      <td>تم الدفع: ${payMethod}</td>
    </tr>
  </table>

  <table class="recip-table" style="margin-top:8px;">
    <tr>
      <td style="width:50%; padding:0; border:none;">
        <table style="width:100%; height:100%;">
          <tr><td class="recip-label">اسم المستلم:</td><td>${tx.recipient || ''}</td></tr>
          <tr><td class="recip-label">التوقيع:</td><td>&nbsp;</td></tr>
          <tr><td class="recip-label">&nbsp;</td><td>&nbsp;</td></tr>
        </table>
      </td>
      <td style="width:50%; padding:0; border:none;">
        <table style="width:100%; height:100%;">
          <tr><td class="recip-label" style="border-right:none;">رقم اثبات الشخصية:</td><td>${tx.recipientIdNo    || ''}</td></tr>
          <tr><td class="recip-label" style="border-right:none;">مكان صدورها:</td>        <td>${tx.recipientIdPlace || ''}</td></tr>
          <tr><td class="recip-label" style="border-right:none;">الرقم الوطني:</td>        <td>${tx.recipientNid     || ''}</td></tr>
        </table>
      </td>
    </tr>
  </table>

</div>`;
}

function buildDecisionPage(tx) {
  tx = normalizeSalfaTx(tx);
  const dinar = Math.floor(tx.total);
  const fils  = Math.round((tx.total - dinar) * FILS_PER_DINAR);

  return `<div class="page">

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td class="hdr-center" style="border:none;">
      <img src="moe-logo.jpg" style="height:90px;object-fit:contain;" />
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td class="hdr-center" style="border:none;">${state.settings.schoolName}</td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td class="hdr-title" style="border:none;">قرار صرف رقم ( ${tx.serial} ) &nbsp;&nbsp; تاريخ: ${tx.date}</td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td class="hdr-center" style="border:none;">
      استناداً من المادة 12 من نظام التبرعات المدرسية رقم 35 لسنة 1994. قررت صرف
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td class="hdr-center" style="border:none;">
      مبلغ : &nbsp;
      <span class="amount-box">${dinar}</span>
      &nbsp; دينار &nbsp; و &nbsp;
      <span class="amount-box">${fils}</span>
      &nbsp; فلساً وذلك لشراء اللوازم والخدمات المبينة
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td class="hdr-center" style="border:none;">
      بالكشف المرفق ، على أن يتم الشراء من قبل اللجنة المالية المكونة من:-
    </td>
  </tr></table>

  <table class="sig-table" style="margin-bottom:0;">
    <thead>
      <tr>
        <th colspan="2" style="width:33%;">عضو لجنة</th>
        <th colspan="2" style="width:33%;">عضو لجنة</th>
        <th colspan="2" style="width:33%;">عضو لجنة</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sig-label">الاسم:</td><td>${state.settings.member1 || ''}</td>
        <td class="sig-label">الاسم:</td><td>${state.settings.member2 || ''}</td>
        <td class="sig-label">الاسم:</td><td>${state.settings.member3 || ''}</td>
      </tr>
      <tr>
        <td class="sig-label">التوقيع:</td><td></td>
        <td class="sig-label">التوقيع:</td><td></td>
        <td class="sig-label">التوقيع:</td><td></td>
      </tr>
      <tr>
        <td class="sig-label">التاريخ:</td><td>${tx.date}</td>
        <td class="sig-label">التاريخ:</td><td>${tx.date}</td>
        <td class="sig-label">التاريخ:</td><td>${tx.date}</td>
      </tr>
    </tbody>
  </table>

  <div style="display:flex; justify-content:flex-end; margin-top:16px;">
    <table class="dir-table">
      <thead>
        <tr><th colspan="2">مدير المدرسة</th></tr>
      </thead>
      <tbody>
        <tr><td class="dl">الاسم:</td><td>${state.settings.headmaster || ''}</td></tr>
        <tr><td class="dl">التوقيع:</td><td style="min-width:120px;"></td></tr>
        <tr><td class="dl">التاريخ:</td><td>${tx.date}</td></tr>
      </tbody>
    </table>
  </div>

</div>`;
}

function buildLocalPurchasePage(tx) {
  const TOTAL_ROWS = 21;
  const items      = tx.items || [];

  let itemRowsHTML = '';
  for (let i = 0; i < TOTAL_ROWS; i++) {
    const item = items[i];
    if (item) {
      const iDinar = Math.floor(item.price || 0);
      const iFils  = Math.round(((item.price || 0) % 1) * FILS_PER_DINAR);
      const tDinar = Math.floor(item.total || 0);
      const tFils  = Math.round(((item.total || 0) % 1) * FILS_PER_DINAR);
      itemRowsHTML += `<tr>
        <td class="num-cell">${i + 1}</td>
        <td class="span-cell">${item.desc || '-----'}</td>
        <td class="num-cell">${item.qty  || '-----'}</td>
        <td class="num-cell">${iFils  || '-----'}</td>
        <td class="num-cell">${iDinar || '-----'}</td>
        <td class="num-cell">${tFils  || '-----'}</td>
        <td class="num-cell">${tDinar || '-----'}</td>
        <td></td><td></td>
      </tr>`;
    } else {
      itemRowsHTML += `<tr>
        <td class="num-cell">${i + 1}</td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>`;
    }
  }

  return `<div class="page">

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="text-align:center; border:none;">
      <img src="moe-logo.jpg" style="height:90px; object-fit:contain;" />
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="text-align:center; font-weight:900; font-size:13pt; padding:6px; border:none;">نموذج مشترى محلي</td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;">
    <tr>
      <td style="font-weight:700; border:none; width:60%;">مديرية ${state.settings.dirName}</td>
      <td style="font-weight:700; border:none; text-align:right;">الرقم (${tx.serial})</td>
    </tr>
    <tr>
      <td style="font-weight:700; border:none;">اسم الشركة / المتعهد: ${tx.recipient || ''}</td>
      <td style="font-weight:700; border:none;">التاريخ: ${tx.date}</td>
    </tr>
    <tr>
      <td style="font-weight:700; border:none;" colspan="2">ارجو تسليم المواد المدرجة أدناه إلى: مدرسة ${state.settings.schoolName}</td>
    </tr>
  </table>

  <table class="items-table" style="margin-bottom:0;">
    <thead>
      <tr>
        <th rowspan="2" style="width:5%;">الرقم</th>
        <th rowspan="2" style="width:28%;">المواد المطلوبة</th>
        <th rowspan="2" style="width:8%;">الكمية</th>
        <th colspan="2" style="width:16%;">السعر الافرادي</th>
        <th colspan="2" style="width:16%;">السعر الاجمالي</th>
        <th rowspan="2" style="width:14%;">الفصل والمادة</th>
        <th rowspan="2" style="width:13%;">ملاحظات</th>
      </tr>
      <tr>
        <th>فلس</th><th>دينار</th>
        <th>فلس</th><th>دينار</th>
      </tr>
    </thead>
    <tbody>${itemRowsHTML}</tbody>
  </table>

  <table class="sig-table" style="margin-top:8px;">
    <thead><tr><th colspan="2">تم الأستلام من قبل</th></tr></thead>
    <tbody>
      <tr><td class="sig-label">الوظيفة:</td><td></td></tr>
      <tr><td class="sig-label">الاسم:</td><td></td></tr>
      <tr><td class="sig-label">التوقيع:</td><td></td></tr>
      <tr><td class="sig-label">التاريخ:</td><td>${tx.date}</td></tr>
    </tbody>
  </table>

</div>`;
}

function buildClaimPage(tx) {
  const amountWords = numberToArabicWords(tx.total);
  const dinar       = Math.floor(tx.total);
  const fils        = Math.round((tx.total - dinar) * FILS_PER_DINAR);
  const purposeList = (tx.purpose || '').split(/[،,]/).map(s => s.trim()).filter(Boolean);

  return `<div class="page">

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="text-align:center; border:none;">
      <img src="moe-logo.jpg" style="height:90px; object-fit:contain;" />
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="text-align:center; font-weight:900; font-size:13pt; padding:6px; border:none;">مطالبة مالية</td>
  </tr></table>

  <table style="margin-bottom:0;">
    <thead>
      <tr>
        <th style="width:20%; border-width:3px;">فلس</th>
        <th style="width:20%; border-width:3px;">دينار</th>
        <th style="width:20%; border:none;"></th>
        <th style="width:40%; border:none; text-align:right;">الرقم (${tx.serial})</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="num-cell" style="border-width:3px;">${fils  || '-----'}</td>
        <td class="num-cell" style="border-width:3px;">${dinar || '-----'}</td>
      </tr>
    </tbody>
  </table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="padding:6px 8px; border:none; font-weight:700;">
      يطلب لي من مدرسة : ${state.settings.schoolName}
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="padding:6px 8px; border:none; font-weight:700;">
      مبلغ وقدره : ${amountWords} وذلك لقاء:-
    </td>
  </tr></table>

  <table style="margin-bottom:0;">
    <tbody>
      ${[0,1,2,3,4,5,6,7,8,9].map(i => `<tr>
        <td style="padding:5px 8px;">${i + 1} - ${purposeList[i] || ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <table class="sig-table" style="margin-top:8px;">
    <thead><tr><th colspan="2">اسم صاحب الاستحقاق</th></tr></thead>
    <tbody>
      <tr><td class="sig-label">الاسم:</td><td>${tx.recipient || ''}</td></tr>
      <tr><td class="sig-label">التوقيع:</td><td></td></tr>
      <tr><td class="sig-label">التاريخ:</td><td>${tx.date}</td></tr>
    </tbody>
  </table>

  <table class="sig-table" style="margin-top:8px;">
    <thead>
      <tr>
        <th colspan="2" style="width:33%;">عضو لجنة</th>
        <th colspan="2" style="width:33%;">عضو لجنة</th>
        <th colspan="2" style="width:33%;">عضو لجنة</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sig-label">الاسم:</td><td>${state.settings.member1 || ''}</td>
        <td class="sig-label">الاسم:</td><td>${state.settings.member2 || ''}</td>
        <td class="sig-label">الاسم:</td><td>${state.settings.member3 || ''}</td>
      </tr>
      <tr>
        <td class="sig-label">التوقيع:</td><td></td>
        <td class="sig-label">التوقيع:</td><td></td>
        <td class="sig-label">التوقيع:</td><td></td>
      </tr>
      <tr>
        <td class="sig-label">التاريخ:</td><td>${tx.date || ''}</td>
        <td class="sig-label">التاريخ:</td><td>${tx.date || ''}</td>
        <td class="sig-label">التاريخ:</td><td>${tx.date || ''}</td>
      </tr>
    </tbody>
  </table>

  <table class="sig-table" style="margin-top:8px;">
    <thead><tr><th colspan="2">رئيس اللجنة</th></tr></thead>
    <tbody>
      <tr><td class="sig-label">الاسم:</td><td>${state.settings.headmaster || ''}</td></tr>
      <tr><td class="sig-label">التوقيع:</td><td></td></tr>
      <tr><td class="sig-label">التاريخ:</td><td>${tx.date || ''}</td></tr>
    </tbody>
  </table>

</div>`;
}

function buildJournalPage(tx) {
  const dinar       = Math.floor(tx.total);
  const fils        = Math.round((tx.total - dinar) * FILS_PER_DINAR);
  const purposeList = (tx.purpose || '').split(/[،,]/).map(s => s.trim()).filter(Boolean);
  const TOTAL_ROWS  = 12;

  let dataRowsHTML = '';
  for (let i = 0; i < TOTAL_ROWS; i++) {
    if (i === 0) {
      dataRowsHTML += `<tr>
        <td class="num-cell">${fils  || '-----'}</td>
        <td class="num-cell">${dinar || '-----'}</td>
        <td class="num-cell">${fils  || '-----'}</td>
        <td class="num-cell">${dinar || '-----'}</td>
        <td style="font-weight:700;">من حسـاب /</td>
        <td>${tx.accountFrom || ''}</td>
      </tr>`;
    } else if (i === 1) {
      dataRowsHTML += `<tr>
        <td></td><td></td><td></td><td></td>
        <td style="font-weight:700;">الى حسـاب /</td>
        <td>${tx.accountTo || ''}</td>
      </tr>`;
    } else if (i === 2) {
      dataRowsHTML += `<tr>
        <td></td><td></td><td></td><td></td>
        <td colspan="2" style="font-weight:700;">وذلك</td>
      </tr>`;
    } else {
      dataRowsHTML += `<tr>
        <td></td><td></td><td></td><td></td>
        <td colspan="2">${i - 2}- ${purposeList[i - 3] || ''}</td>
      </tr>`;
    }
  }

  return `<div class="page">

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="text-align:center; border:none;">
      <img src="moe-logo.jpg" style="height:90px; object-fit:contain;" />
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="text-align:center; font-weight:900; font-size:13pt; padding:6px; border:none;">سند قيد التبرعات المدرسية</td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;">
    <tr>
      <td style="font-weight:700; border:none; width:60%;">المركز:</td>
      <td style="font-weight:700; border:none; text-align:right;">الرقم (${tx.serial})</td>
    </tr>
    <tr>
      <td style="font-weight:700; border:none;"></td>
      <td style="font-weight:700; border:none;">التاريخ: ${tx.date}</td>
    </tr>
    <tr>
      <td style="font-weight:700; border:none;" colspan="2">مدرسة ${state.settings.schoolName}</td>
    </tr>
  </table>

  <table class="items-table" style="margin-bottom:0;">
    <thead>
      <tr>
        <th colspan="2">منه</th>
        <th colspan="2">له</th>
        <th colspan="2" rowspan="2">البيان</th>
      </tr>
      <tr>
        <th>فلس</th><th>دينار</th>
        <th>فلس</th><th>دينار</th>
      </tr>
    </thead>
    <tbody>${dataRowsHTML}</tbody>
  </table>

  <table class="sig-table" style="margin-top:8px;">
    <thead><tr><th colspan="2">مدير المدرسة</th></tr></thead>
    <tbody>
      <tr><td class="sig-label">الاسم:</td><td>${state.settings.headmaster || ''}</td></tr>
      <tr><td class="sig-label">التوقيع:</td><td></td></tr>
      <tr><td class="sig-label">التاريخ:</td><td>${tx.date || ''}</td></tr>
    </tbody>
  </table>

</div>`;
}

function buildSalfaBookPage(tx) {
  const salfaRows = tx.salfaRows || [];
  const TOTAL_ROWS = 25;

  // Build data rows — each salfaRow becomes one table row
  let dataRowsHTML = '';
  let grandTotal = 0;

  for (let i = 0; i < TOTAL_ROWS; i++) {
    const row = salfaRows[i];
    if (row) {
      const dinar = Math.floor(row.total || 0);
      const fils  = Math.round(((row.total || 0) % 1) * FILS_PER_DINAR);
      //const itemNames = (row.gharad || []).map(g => g.name).filter(Boolean).join(' / ');
      grandTotal += row.total || 0;
      dataRowsHTML += `<tr>
        <td class="num-cell">${fils  || '—————'}</td>
        <td class="num-cell">${dinar || '—————'}</td>
        <td class="span-cell">${row.owner       || ''}</td>
        <td class="span-cell">${row.bayan       || ''}</td>
        <td class="num-cell">${row.invoiceNo    || ''}</td>
        <td class="span-cell">${row.invoiceDate || ''}</td>
        <td class="span-cell"></td>
      </tr>`;
    } else {
      dataRowsHTML += `<tr>
        <td style="white-space:pre;"> </td>
        <td style="white-space:pre;"> </td>
        <td style="white-space:pre;"> </td>
        <td style="white-space:pre;"> </td>
        <td style="white-space:pre;"> </td>
        <td style="white-space:pre;"> </td>
        <td style="white-space:pre;"> </td>
      </tr>`;
    }
  }

  const totalDinar = Math.floor(grandTotal);
  const totalFils  = Math.round((grandTotal % 1) * FILS_PER_DINAR);

  return `<div class="page">

  <!-- ROW 1: Header table -->
  <table style="margin-bottom:0; border-collapse:collapse; width:100%;">
    <tbody>
      <tr>
        <td rowspan="6" style="width:20%; text-align:center; border:none; vertical-align:middle;">
          <img src="moe-logo.jpg" style="height:110px; object-fit:contain;" />
        </td>
        <td style="text-align:center; border:none; font-weight:700; font-size:11pt; padding:2px 8px;">بسم الله الرحمن الرحيم</td>
        
        <td rowspan="6" style="width:20%; text-align:center; border:none; vertical-align:middle;">
        </td>
      </tr>
      <tr>
        <td style="text-align:center; border:none; font-weight:700; font-size:10.5pt; padding:2px 8px;">المملكة الأردنية الهاشمية</td>
      </tr>
      <tr>
        <td style="text-align:center; border:none; font-weight:700; font-size:10pt; padding:2px 8px;">مديرية التربية والتعليم لمنطقة ${state.settings.dirName}</td>
      </tr>
      <tr>
        <td style="text-align:center; border:none; font-weight:900; font-size:12pt; padding:2px 8px;">دفتر صندوق سلفات التبرعات</td>
      </tr>
      <tr>
        <td style="text-align:center; border:none; font-weight:700; font-size:10pt; padding:2px 8px;">مدرسة : ${state.settings.schoolName}</td>
      </tr>
      <tr>
        <td style="text-align:center; border:none; font-weight:700; font-size:10pt; padding:2px 8px;">اسم الموظف المعهود إليه صرف السلفة : ${state.settings.headmaster || ''}</td>
      </tr>
    </tbody>
  </table>

  <!-- ROW 2: Check number + serial -->
  <table style="margin-bottom:0; border-collapse:collapse; margin-top:6px;">
    <tbody>
      <tr>
        <td style="font-weight:700; border:none; width:60%;">رقم الشيك ( ${tx.transferNo || ''} )</td>
        <td style="font-weight:700; border:none; text-align:right;">الرقم ( ${tx.serial} )</td>
      </tr>
    </tbody>
  </table>

  <!-- ROW 3: Items table -->
  <table class="items-table" style="margin-bottom:0; margin-top:6px;">
    <thead>
      <tr>
        <th colspan="2">القيمة</th>
        <th rowspan="2">صاحب الاستحقاق</th>
        <th rowspan="2">نوع العمل أو نوع اللوازم</th>
        <th rowspan="2">رقم الفاتورة</th>
        <th rowspan="2">تاريخها</th>
        <th rowspan="2">ملاحظات</th>
      </tr>
      <tr>
        <th>فلس</th>
        <th>دينار</th>
      </tr>
    </thead>
    <tbody>
      ${dataRowsHTML}
      <tr style="background:#fff7ed;">
        <td class="majmoo">${totalFils  || '—————'}</td>
        <td class="majmoo">${totalDinar || '—————'}</td>
        <td class="majmoo" colspan="5">المجموع</td>
      </tr>
    </tbody>
  </table>

  <!-- ROW 4: Headmaster signature -->
  <table class="dir-table" style="margin-top:8px;">
    <thead>
      <tr><th colspan="2">مدير المدرسة</th></tr>
    </thead>
    <tbody>
      <tr><td class="dl">الاسم:</td><td>${state.settings.headmaster || ''}</td></tr>
      <tr><td class="dl">التوقيع:</td><td style="min-width:120px;"></td></tr>
      <tr><td class="dl">التاريخ:</td><td>${tx.date || ''}</td></tr>
    </tbody>
  </table>

</div>`;
}

function buildLocalPurchasePageFromSalfaRow(tx, row) {
  const TOTAL_ROWS = 21;
  const items      = row.gharad || [];

  let itemRowsHTML = '';
  for (let i = 0; i < TOTAL_ROWS; i++) {
    const item = items[i];
    if (item) {
      const iDinar = Math.floor(item.unitPrice || 0);
      const iFils  = Math.round(((item.unitPrice || 0) % 1) * FILS_PER_DINAR);
      const tDinar = Math.floor(item.total || 0);
      const tFils  = Math.round(((item.total || 0) % 1) * FILS_PER_DINAR);
      itemRowsHTML += `<tr>
        <td class="num-cell">${i + 1}</td>
        <td class="span-cell">${item.name || '-----'}</td>
        <td class="num-cell">${item.qty  || '-----'}</td>
        <td class="num-cell">${iFils  || '-----'}</td>
        <td class="num-cell">${iDinar || '-----'}</td>
        <td class="num-cell">${tFils  || '-----'}</td>
        <td class="num-cell">${tDinar || '-----'}</td>
        <td></td><td></td>
      </tr>`;
    } else {
      itemRowsHTML += `<tr>
        <td class="num-cell">${i + 1}</td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>`;
    }
  }

  return `<div class="page">

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="text-align:center; border:none;">
      <img src="moe-logo.jpg" style="height:90px; object-fit:contain;" />
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="text-align:center; font-weight:900; font-size:13pt; padding:6px; border:none;">نموذج مشترى محلي</td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;">
    <tr>
      <td style="font-weight:700; border:none; width:60%;">مديرية ${state.settings.dirName}</td>
      <td style="font-weight:700; border:none; text-align:right;">الرقم (${tx.serial})</td>
    </tr>
    <tr>
      <td style="font-weight:700; border:none;">اسم الشركة / المتعهد: ${row.owner || ''}</td>
      <td style="font-weight:700; border:none;">التاريخ: ${row.invoiceDate || tx.date}</td>
    </tr>
    <tr>
      <td style="font-weight:700; border:none;" colspan="2">ارجو تسليم المواد المدرجة أدناه إلى: مدرسة ${state.settings.schoolName}</td>
    </tr>
  </table>

  <table class="items-table" style="margin-bottom:0;">
    <thead>
      <tr>
        <th rowspan="2" style="width:5%;">الرقم</th>
        <th rowspan="2" style="width:28%;">المواد المطلوبة</th>
        <th rowspan="2" style="width:8%;">الكمية</th>
        <th colspan="2" style="width:16%;">السعر الافرادي</th>
        <th colspan="2" style="width:16%;">السعر الاجمالي</th>
        <th rowspan="2" style="width:14%;">الفصل والمادة</th>
        <th rowspan="2" style="width:13%;">ملاحظات</th>
      </tr>
      <tr>
        <th>فلس</th><th>دينار</th>
        <th>فلس</th><th>دينار</th>
      </tr>
    </thead>
    <tbody>${itemRowsHTML}</tbody>
  </table>

  <table class="sig-table" style="margin-top:8px;">
    <thead><tr><th colspan="2">تم الأستلام من قبل</th></tr></thead>
    <tbody>
      <tr><td class="sig-label">الوظيفة:</td><td></td></tr>
      <tr><td class="sig-label">الاسم:</td><td></td></tr>
      <tr><td class="sig-label">التوقيع:</td><td></td></tr>
      <tr><td class="sig-label">التاريخ:</td><td>${row.invoiceDate || tx.date}</td></tr>
    </tbody>
  </table>

</div>`;
}

function buildClaimPageFromSalfaRow(tx, row) {
  const amountWords = numberToArabicWords(row.total || 0);
  const dinar       = Math.floor(row.total || 0);
  const fils        = Math.round(((row.total || 0) % 1) * FILS_PER_DINAR);
  const purposeList = (row.bayan || '').split(/[،,]/).map(s => s.trim()).filter(Boolean);

  return `<div class="page">

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="text-align:center; border:none;">
      <img src="moe-logo.jpg" style="height:90px; object-fit:contain;" />
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="text-align:center; font-weight:900; font-size:13pt; padding:6px; border:none;">مطالبة مالية</td>
  </tr></table>

  <table style="margin-bottom:0;">
    <thead>
      <tr>
        <th style="width:20%; border-width:3px;">فلس</th>
        <th style="width:20%; border-width:3px;">دينار</th>
        <th style="width:20%; border:none;"></th>
        <th style="width:40%; border:none; text-align:right;">الرقم (${tx.serial})</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="num-cell" style="border-width:3px;">${fils  || '-----'}</td>
        <td class="num-cell" style="border-width:3px;">${dinar || '-----'}</td>
      </tr>
    </tbody>
  </table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="padding:6px 8px; border:none; font-weight:700;">
      يطلب لي من مدرسة : ${state.settings.schoolName}
    </td>
  </tr></table>

  <table style="margin-bottom:0; border-collapse:collapse;"><tr>
    <td style="padding:6px 8px; border:none; font-weight:700;">
      مبلغ وقدره : ${amountWords} وذلك لقاء:-
    </td>
  </tr></table>

  <table style="margin-bottom:0;">
    <tbody>
      ${[0,1,2,3,4,5,6,7,8,9].map(i => `<tr>
        <td style="padding:5px 8px;">${i + 1} - ${purposeList[i] || ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <table class="sig-table" style="margin-top:8px;">
    <thead><tr><th colspan="2">اسم صاحب الاستحقاق</th></tr></thead>
    <tbody>
      <tr><td class="sig-label">الاسم:</td><td>${row.owner || ''}</td></tr>
      <tr><td class="sig-label">الرقم الوطني:</td><td>${row.nid || ''}</td></tr>
      <tr><td class="sig-label">التوقيع:</td><td></td></tr>
      <tr><td class="sig-label">التاريخ:</td><td>${row.invoiceDate || tx.date}</td></tr>
    </tbody>
  </table>

  <table class="sig-table" style="margin-top:8px;">
    <thead>
      <tr>
        <th colspan="2" style="width:33%;">عضو لجنة</th>
        <th colspan="2" style="width:33%;">عضو لجنة</th>
        <th colspan="2" style="width:33%;">عضو لجنة</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sig-label">الاسم:</td><td>${state.settings.member1 || ''}</td>
        <td class="sig-label">الاسم:</td><td>${state.settings.member2 || ''}</td>
        <td class="sig-label">الاسم:</td><td>${state.settings.member3 || ''}</td>
      </tr>
      <tr>
        <td class="sig-label">التوقيع:</td><td></td>
        <td class="sig-label">التوقيع:</td><td></td>
        <td class="sig-label">التوقيع:</td><td></td>
      </tr>
      <tr>
        <td class="sig-label">التاريخ:</td><td>${row.invoiceDate || tx.date}</td>
        <td class="sig-label">التاريخ:</td><td>${row.invoiceDate || tx.date}</td>
        <td class="sig-label">التاريخ:</td><td>${row.invoiceDate || tx.date}</td>
      </tr>
    </tbody>
  </table>

  <table class="sig-table" style="margin-top:8px;">
    <thead><tr><th colspan="2">رئيس اللجنة</th></tr></thead>
    <tbody>
      <tr><td class="sig-label">الاسم:</td><td>${state.settings.headmaster || ''}</td></tr>
      <tr><td class="sig-label">التوقيع:</td><td></td></tr>
      <tr><td class="sig-label">التاريخ:</td><td>${row.invoiceDate || tx.date}</td></tr>
    </tbody>
  </table>

</div>`;
}

/* ═══════════════════════════════════════════════════════════
   DOCUMENT BUILDER REGISTRY
   To add a new document type:
   1. Create buildXxxPage(tx) above
   2. Add an entry here: { id: 'xxx', ... } in ALL_DOCS (config.js)
   3. Register it below
═══════════════════════════════════════════════════════════ */
const docBuilders = {
  disbursement: buildDisbursementPage,
  decision:     buildDecisionPage,
  local:        buildLocalPurchasePage,
  claim:        buildClaimPage,
  journal:      buildJournalPage,
  salfabook:    buildSalfaBookPage,
};

/* ═══════════════════════════════════════════════════════════
   DOCUMENT PREVIEW SHELL (A4 portrait iframe)
═══════════════════════════════════════════════════════════ */
function openDocPreview(pagesHTML, title) {
  const shell = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
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
  </style>
</head>
<body>

<div id="toolbar">
  <span class="doc-title">📄 ${title}</span>
  <div class="actions">
    <button id="btn-print-doc" onclick="document.getElementById('print-instructions').style.display='flex'">🖨️ طباعة / تنزيل PDF</button>
    <button id="btn-close-doc" onclick="window.parent.closeLedgerPreview()">✕ إغلاق</button>
  </div>
</div>

<div id="print-instructions">
  <div class="modal-box">
    <h2>🖨️ إعدادات الطباعة</h2>
    <ol>
      <li>في خانة <strong>الطابعة</strong> اختر <strong style="color:#16a34a;">Save as PDF</strong></li>
      <li>تأكد أن حجم الورق <strong style="color:#f97316;">A4</strong> عمودي</li>
      <li>اضبط الهوامش على <strong>لا شيء / None</strong></li>
    </ol>
    <div class="warn">⚠️ استخدام <strong>Microsoft Print to PDF</strong> قد لا يحافظ على التنسيق الصحيح.</div>
    <div class="btns">
      <button class="btn-cancel" onclick="document.getElementById('print-instructions').style.display='none'">إلغاء</button>
      <button class="btn-confirm" onclick="document.getElementById('print-instructions').style.display='none'; window.print();">فهمت، تابع للطباعة</button>
    </div>
  </div>
</div>

<div id="pages-area">
  ${pagesHTML}
</div>

</body>
</html>`;

  openLedgerPreview(shell);
}