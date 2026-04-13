/* ═══════════════════════════════════════════════════════════════
   wizard.js — ميزان
   New-transaction wizard: step navigation, form field management,
   items grid, salfa sub-form, and transaction save.
═══════════════════════════════════════════════════════════════ */

'use strict';

function getNextId() {
  const maxId = state.transactions.reduce((m, t) => Math.max(m, t.id || 0), 0);
  state.nextId = Math.max(state.nextId || 1, maxId + 1);
  return state.nextId++;
}

/* ── Row ID counter ──────────────────────────────────────── */
let itemRowId = 0;

/* ═══════════════════════════════════════════════════════════
   STEP NAVIGATION
═══════════════════════════════════════════════════════════ */
function selectType(type) {
  state.transactionType = type;
  Object.keys(TRANSACTION_SCHEMAS).forEach(t => {
    document.getElementById('type-' + t)?.classList.remove('selected');
  });
  document.getElementById('type-' + type)?.classList.add('selected');
  document.getElementById('btn-next-0').disabled = false;

  nextStep();// to make it so that when the card is clicked it moves to the next step
}

function nextStep() {
  const s      = state.wizardStep;
  const t      = state.transactionType;
  const schema = TRANSACTION_SCHEMAS[t];

  if (s === 0 && !t) {
    showToast('يرجى اختيار نوع المعاملة أولاً', 'error');
    return;
  }

  if (s === 1) {
    // Flush any unconfirmed purpose tag
    const pendingPurpose = document.getElementById('purpose-input')?.value.trim();
    if (pendingPurpose) addPurposeTag(pendingPurpose);

    const serial = document.getElementById('f-serial')?.value.trim();
    const date   = document.getElementById('f-date')?.value;
    if (!serial || !date) {
      showToast('يرجى تعبئة الرقم التسلسلي والتاريخ', 'error');
      return;
    }

    const missingRequired = schema
      ? Object.entries(schema.fields).some(([id, cfg]) => {
          if (!cfg.visible || !cfg.required) return false;
          const wrapper = document.getElementById(id);
          if (!wrapper) return false;
          const input = wrapper.querySelector('input, select, textarea');
          return !input || !input.value.trim();
        })
      : false;

    if (missingRequired) {
      showToast('يرجى تعبئة جميع الحقول الإلزامية', 'error');
      return;
    }

    if (t === 'salfa_yad') {
      const transferNo = document.getElementById('f-transfer-no')?.value.trim();
      if (!transferNo) {
        showToast('يرجى إدخال رقم الشيك', 'error');
        return;
      }
    }
  }
  

  if (s === 2 && schema && !schema.skipStep2) {
    const rows = document.querySelectorAll('#items-tbody tr');
    if (rows.length === 0) {
      showToast('يرجى إضافة بند واحد على الأقل', 'error');
      return;
    }
  }

  goToStep(s + 1);
}

function prevStep() {
  const schema = TRANSACTION_SCHEMAS[state.transactionType];
  if (state.wizardStep === 3 && schema?.skipStep2) { goToStep(1); return; }
  goToStep(state.wizardStep - 1);
}

function goToStep(n) {
  [0, 1, 2, 3].forEach(i => {
    document.getElementById('wiz-step-' + i)?.classList.toggle('hidden', i !== n);
  });

  for (let i = 0; i <= 3; i++) {
    const dot  = document.getElementById('step-dot-' + i);
    const line = document.getElementById('step-line-' + i);
    if (!dot) continue;
    if      (i < n)  { dot.className = 'step-dot done';   if (line) line.className = 'step-line done flex-1'; }
    else if (i === n) { dot.className = 'step-dot active'; }
    else              { dot.className = 'step-dot';        if (line) line.className = 'step-line flex-1'; }
  }

  state.wizardStep = n;
  if (n === 1) setupStep1();
  if (n === 2) setupStep2();
  if (n === 3) populateReview();
}

/* ═══════════════════════════════════════════════════════════
   STEP 1 — FORM SETUP
═══════════════════════════════════════════════════════════ */
function setupStep1() {
  const t      = state.transactionType;
  const schema = TRANSACTION_SCHEMAS[t];
  if (!schema) return;

  // Show/hide every registered field wrapper
  Object.entries(schema.fields).forEach(([id, cfg]) => {
    document.getElementById(id)?.classList.toggle('hidden', !cfg.visible);
  });

  // Check-fields reset — only reset if not salfa_yad (which always shows check fields)
  if (t !== 'salfa_yad') {
    document.getElementById('check-fields-wrapper').classList.add('hidden');
  }

  // Recipient label
  if (schema.recipientLabel) {
    document.getElementById('recipient-label').innerHTML =
      `${schema.recipientLabel} <span class="text-red-400">*</span>`;
  }

  // Hide purpose row for non-applicable types
  document.querySelector('.col-span-2:has(#purpose-tag-area)')?.classList.remove('hidden');

  // Auto-fill from/to if not yet filled (edit mode pre-fills them first)
  const fromEl = document.getElementById('f-account-from');
  const toEl   = document.getElementById('f-account-to');
  if (!fromEl.value && !toEl.value) {
    fromEl.value = schema.defaultAccounts.from;
    toEl.value   = schema.defaultAccounts.to;
  }

  // Auto serial if empty
  if (!document.getElementById('f-serial').value) {
    document.getElementById('f-serial').value = getNextSerial();
  }

  // Pre-fill recipient name from headmaster for salfa_yad
  if (t === 'salfa_yad') {
    const s = state.settings;
    const nameRE  = document.getElementById('f-recipient');
    const nameEl  = document.getElementById('f-recipient-name');
    const nidEl   = document.getElementById('f-recipient-nid');
    const idNoEl  = document.getElementById('f-recipient-id-no');
    const placeEl = document.getElementById('f-recipient-id-place');

    if (nameRE  && !nameRE.value)  nameRE.value  = s.headmaster        || '';
    if (nameEl  && !nameEl.value)  nameEl.value  = s.headmaster        || '';
    if (nidEl   && !nidEl.value)   nidEl.value   = s.headmasterNid     || '';
    if (idNoEl  && !idNoEl.value)  idNoEl.value  = s.headmasterIdNo    || '';
    if (placeEl && !placeEl.value) placeEl.value = s.headmasterIdPlace || '';
  }
}

function getNextSerial() {
  if (state.transactions.length === 0) return '';
  const last = state.transactions[state.transactions.length - 1].serial || '';
  const slashMatch = last.match(/^(\d+)\/(\d+)$/);
  if (slashMatch) {
    const year = slashMatch[1];
    const num  = parseInt(slashMatch[2]);
    const pad  = slashMatch[2].length;
    return `${year}/${String(num + 1).padStart(pad, '0')}`;
  }
  const numMatch = last.match(/^(\d+)$/);
  if (numMatch) return String(parseInt(numMatch[1]) + 1);
  return '';
}

function toggleCheckFields() {
  if (state.transactionType === 'salfa_yad') return;
  const isCheck = document.querySelector('input[name="f-payment-method"]:checked')?.value === 'شيك';
  document.getElementById('check-fields-wrapper').classList.toggle('hidden', !isCheck);
  if (!isCheck) document.getElementById('f-transfer-no').value = '';
}

/* ═══════════════════════════════════════════════════════════
   STEP 2 — ITEMS GRID
═══════════════════════════════════════════════════════════ */
function setupStep2() {
  document.getElementById('items-title').textContent =
    state.transactionType === 'claim' ? 'بنود المطالبة المالية' : 'بنود الفاتورة';

  const schema = TRANSACTION_SCHEMAS[state.transactionType];
  if (schema?.skipStep2) { goToStep(3); return; }

  if (document.querySelectorAll('#items-tbody tr').length === 0) addItemRow();
}

function addItemRow(data) {
  itemRowId++;
  const id    = itemRowId;
  const d     = data || { desc: '', qty: 1, price: 0, total: 0 };
  const tbody = document.getElementById('items-tbody');
  const tr    = document.createElement('tr');
  tr.id       = 'item-row-' + id;
  tr.className = 'border-b border-gray-50';
  tr.innerHTML = `
    <td class="px-3 py-2 text-gray-400 font-semibold text-xs">${id}</td>
    <td class="px-3 py-2">
      <input type="text" value="${d.desc}" class="form-input text-sm" placeholder="وصف البند" onchange="calcRow(${id})" />
    </td>
    <td class="px-3 py-2">
      <input type="number" id="qty-${id}" value="${d.qty}" min="1" class="form-input text-sm text-center" oninput="calcRow(${id})" />
    </td>
    <td class="px-3 py-2">
      <input type="number" id="price-${id}" value="${d.price.toFixed(3)}" min="0" step="0.001" class="form-input text-sm text-left" oninput="calcRow(${id})" />
    </td>
    <td class="px-3 py-2">
      <input type="number" id="total-${id}" value="${d.total.toFixed(3)}" readonly class="form-input text-sm text-left bg-gray-50 font-semibold" />
    </td>
    <td class="px-3 py-2">
      <button onclick="removeItemRow(${id})" class="btn-danger">حذف</button>
    </td>`;
  tbody.appendChild(tr);
  updateTotals();
}

function removeItemRow(id) {
  document.getElementById('item-row-' + id)?.remove();
  updateTotals();
}

function calcRow(id) {
  const qty   = parseFloat(document.getElementById('qty-'   + id)?.value) || 0;
  const price = parseFloat(document.getElementById('price-' + id)?.value) || 0;
  const el    = document.getElementById('total-' + id);
  if (el) el.value = (qty * price).toFixed(3);
  updateTotals();
}

function calcItemsTotal() {
  let sum = 0;
  document.querySelectorAll('#items-tbody tr').forEach(tr => {
    const id = tr.id.replace('item-row-', '');
    sum += parseFloat(document.getElementById('total-' + id)?.value || 0);
  });
  return sum;
}

function updateTotals() {
  const t = calcItemsTotal();
  document.getElementById('subtotal-display').textContent = t.toFixed(3) + ' د.أ';
  document.getElementById('total-display').textContent    = t.toFixed(3) + ' د.أ';
}

/* ═══════════════════════════════════════════════════════════
   STEP 3 — REVIEW
═══════════════════════════════════════════════════════════ */
function populateReview() {
  const t = state.transactionType;

  document.getElementById('rev-type').textContent   = TRANSACTION_TYPE_META[t]?.label || '–';
  document.getElementById('rev-serial').textContent = document.getElementById('f-serial').value || '–';
  document.getElementById('rev-date').textContent   = document.getElementById('f-date').value   || '–';

  let recip = '–';
  if (t === 'journal') {
    recip = `من: ${document.getElementById('f-account-from').value || '–'} ← إلى: ${document.getElementById('f-account-to').value || '–'}`;
  } else {
    recip = document.getElementById('f-recipient').value || '–';
  }
  document.getElementById('rev-recipient').textContent = recip;
  document.getElementById('rev-member1').textContent   = state.settings.member1;
  document.getElementById('rev-member2').textContent   = state.settings.member2;
  document.getElementById('rev-member3').textContent   = state.settings.member3;

  let total = 0;
  if (t === 'advance') {
    total = (parseFloat(document.getElementById('f-dinar').value) || 0)
          + (parseFloat(document.getElementById('f-fils').value)  || 0) / FILS_PER_DINAR;
  } else if (t === 'journal') {
    total = (parseFloat(document.getElementById('f-journal-dinar').value) || 0)
          + (parseFloat(document.getElementById('f-journal-fils').value)  || 0) / FILS_PER_DINAR;
  } else if (t === 'salfa_yad') {
    total = state.settings.salfaMax || 75;
  } else {
    total = calcItemsTotal();
  }

  document.getElementById('rev-total').textContent = total.toFixed(3) + ' د.أ';

  // Doc list
  const docs = REVIEW_DOC_LABELS[t] || [];
  document.getElementById('docs-list').innerHTML = docs.map(d =>
    `<span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-semibold ${DOC_COLOR_CLASSES[d] || 'bg-gray-100 text-gray-700'}">
      <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
        <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
      </svg>
      ${d}
    </span>`
  ).join('');

  // Show salfa assignment info if cash payment
  const isCheck = document.querySelector('input[name="f-payment-method"]:checked')?.value === 'شيك';
  const isCashable = (t === 'invoice' || t === 'claim');
  const salfaInfoEl = document.getElementById('rev-salfa-info');
  if (salfaInfoEl) {
    if (isCashable && !isCheck) {
      const openSalfa = getOpenSalfa();
      const salfaMax  = state.settings.salfaMax || 75;
      salfaInfoEl.classList.remove('hidden');
      if (openSalfa) {
        salfaInfoEl.innerHTML = `
          <div class="flex items-center gap-2 text-sm text-orange-700 font-semibold">
            <span>📦</span>
            <span>سيُضاف إلى سلفة صندوق <strong>${openSalfa.serial}</strong> (المجموع الحالي: ${openSalfa.total.toFixed(3)} / ${salfaMax} د.أ)</span>
          </div>`;
      } else {
        salfaInfoEl.innerHTML = `
          <div class="flex items-center gap-2 text-sm text-green-700 font-semibold">
            <span>🆕</span>
            <span>سيتم إنشاء سلفة صندوق جديدة تلقائياً (الحد: ${salfaMax} د.أ)</span>
          </div>`;
      }
    } else {
      salfaInfoEl.classList.add('hidden');
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   AUTO-SALFA MANAGEMENT
   Functions to create/find/close the automatic سلفة صندوق
═══════════════════════════════════════════════════════════ */

/** Returns the currently open salfa, or null if none */
function getOpenSalfa() {
  return state.transactions.find(tx => tx.type === 'salfa' && tx.status === 'open') || null;
}

/** Returns a new salfa serial (e.g. "ص-1", "ص-2") */
function getNextSalfaSerial() {
  const count = state.transactions.filter(tx => tx.type === 'salfa').length;
  return `${count + 1}`;
}

/**
 * Creates a new open salfa transaction and returns it.
 */
function createNewSalfa() {
  const salfaMax = state.settings.salfaMax || 75;
  const salfa = {
    id:          getNextId(),
    type:        'salfa',
    serial:      getNextSalfaSerial(),
    date:        new Date().toISOString().split('T')[0],
    status:      'open',
    maxAmount:   salfaMax,
    total:       0,
    items:       [],   // ids of inner cash transactions
    accountFrom: 'التبرعات',
    accountTo:   'البنك',
    recipient:   state.settings.headmaster || '',
    // Filled on close:
    transferNo:       '',
    transferDate:     '',
    recipientName:    state.settings.headmaster || '',
    recipientIdNo:    '',
    recipientIdPlace: '',
    recipientNid:     '',
  };
  state.transactions.push(salfa);
  return salfa;
}

/**
 * Assigns a cash transaction to the current open salfa.
 * Creates a new salfa if needed.
 * Returns the salfa the tx was assigned to.
 */
function assignToCashSalfa(tx) {
  const salfaMax = state.settings.salfaMax || 75;
  let salfa = getOpenSalfa();

  if (!salfa) {
    salfa = createNewSalfa();
  }

  salfa.items.push(tx.id);
  salfa.total = salfa.items.reduce((sum, id) => {
    const t = state.transactions.find(t => t.id === id);
    return sum + (t ? t.total : 0);
  }, 0);

  return salfa;
}

/* ── Close Salfa Modal ─────────────────────────────────── */
let closingSalfaId = null;

function openCloseSalfaModal(salfaId) {
  const salfa = state.transactions.find(t => t.id === salfaId);
  if (!salfa) return;
  closingSalfaId = salfaId;

  document.getElementById('close-salfa-serial').textContent  = salfa.serial;
  document.getElementById('close-salfa-total').textContent   = salfa.total.toFixed(3);
  document.getElementById('close-salfa-count').textContent   = salfa.items.length;
  document.getElementById('f-close-salfa-transfer-no').value    = '';
  document.getElementById('f-close-salfa-transfer-date').value  = '';
  document.getElementById('f-close-salfa-recipient-name').value = salfa.recipientName || state.settings.headmaster || '';
  document.getElementById('f-close-salfa-recipient-id-no').value    = salfa.recipientIdNo    || state.settings.headmasterIdNo || '';
  document.getElementById('f-close-salfa-recipient-id-place').value = salfa.recipientIdPlace || state.settings.headmasterIdPlace || '';
  document.getElementById('f-close-salfa-recipient-nid').value      = salfa.recipientNid     || state.settings.headmasterNid || '';

  showModal('modal-close-salfa');
}

function closeCloseSalfaModal() {
  closingSalfaId = null;
  hideModal('modal-close-salfa');
}

function confirmCloseSalfa() {
  if (!closingSalfaId) return;
  const transferNo = document.getElementById('f-close-salfa-transfer-no')?.value.trim();
  if (!transferNo) {
    showToast('يرجى إدخال رقم الشيك/التحويل', 'error');
    return;
  }

  const salfa = state.transactions.find(t => t.id === closingSalfaId);
  if (!salfa) return;

  salfa.status             = 'closed';
  salfa.transferNo         = transferNo;
  salfa.transferDate       = document.getElementById('f-close-salfa-transfer-date')?.value  || '';
  salfa.recipientName      = document.getElementById('f-close-salfa-recipient-name')?.value || '';
  salfa.recipientIdNo      = document.getElementById('f-close-salfa-recipient-id-no')?.value    || '';
  salfa.recipientIdPlace   = document.getElementById('f-close-salfa-recipient-id-place')?.value || '';
  salfa.recipientNid       = document.getElementById('f-close-salfa-recipient-nid')?.value      || '';

  closeCloseSalfaModal();
  persistState();
  renderArchive();
  updateStats();
  showToast(`✅ تم إغلاق السلفة ${salfa.serial} بنجاح`, 'success');
}

/* ═══════════════════════════════════════════════════════════
   PURPOSE TAG COMPONENT
═══════════════════════════════════════════════════════════ */
let purposeTags = [];

function renderPurposeTags() {
  const area  = document.getElementById('purpose-tag-area');
  const input = document.getElementById('purpose-input');
  area.querySelectorAll('.purpose-tag').forEach(el => el.remove());
  purposeTags.forEach((tag, i) => {
    const span = document.createElement('span');
    span.className = 'purpose-tag';
    span.innerHTML = `${tag}<button type="button" onclick="removePurposeTag(${i})" tabindex="-1">×</button>`;
    area.insertBefore(span, input);
  });
  syncPurposeHidden();
}

function syncPurposeHidden() {
  document.getElementById('f-purpose').value = purposeTags.join('، ');
}

function addPurposeTag(val) {
  const trimmed = val.trim().replace(/،$|,$/, '').trim();
  if (trimmed && !purposeTags.includes(trimmed)) {
    purposeTags.push(trimmed);
    renderPurposeTags();
  }
  document.getElementById('purpose-input').value = '';
}

function removePurposeTag(i) {
  purposeTags.splice(i, 1);
  renderPurposeTags();
}

function clearPurposeTags() {
  purposeTags = [];
  renderPurposeTags();
  document.getElementById('purpose-input').value = '';
}

function loadPurposeTags(csvString) {
  purposeTags = csvString
    ? csvString.split(/[،,]/).map(s => s.trim()).filter(Boolean)
    : [];
  renderPurposeTags();
}

function purposeKeydown(e) {
  const input = e.target;
  if (e.key === 'Enter' || e.key === ',' || e.key === '،') {
    e.preventDefault();
    addPurposeTag(input.value);
  } else if (e.key === 'Backspace' && input.value === '' && purposeTags.length > 0) {
    removePurposeTag(purposeTags.length - 1);
  }
}

function purposeInputChange(e) {
  const val = e.target.value;
  if (val.includes(',') || val.includes('،')) {
    val.split(/[,،]/).forEach(part => { if (part.trim()) addPurposeTag(part); });
    e.target.value = '';
  }
}

/* ═══════════════════════════════════════════════════════════
   ACCOUNT AUTOCOMPLETE
═══════════════════════════════════════════════════════════ */
function getKnownAccounts() {
  const defined  = getAccountList().map(a => a.name);
  const result   = getAccountList().map(a => ({ name: a.name, color: a.color }));
  const extras   = new Set();
  state.transactions.forEach(tx => {
    if (tx.accountFrom && !defined.includes(tx.accountFrom)) extras.add(tx.accountFrom);
    if (tx.accountTo   && !defined.includes(tx.accountTo))   extras.add(tx.accountTo);
  });
  extras.forEach(name => result.push({ name, color: '#64748b' }));
  return result;
}

function acInput(inputId, dropId) {
  const val     = document.getElementById(inputId).value.trim();
  const drop    = document.getElementById(dropId);
  const all     = getKnownAccounts();
  const matches = val ? all.filter(a => a.name.includes(val)) : all;
  if (matches.length === 0) { drop.classList.add('hidden'); return; }
  drop.innerHTML = matches.map(a =>
    `<div class="ac-item" onmousedown="acSelect('${inputId}','${dropId}','${a.name.replace(/'/g, "\\'")}')">
       <span class="ac-dot" style="background:${a.color}"></span>${a.name}
     </div>`
  ).join('');
  drop.classList.remove('hidden');
}

function acSelect(inputId, dropId, name) {
  document.getElementById(inputId).value = name;
  acHide(dropId);
}

function acHide(dropId) {
  document.getElementById(dropId)?.classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════════
   SAVE TRANSACTION
═══════════════════════════════════════════════════════════ */

// DATABASE SAVE POINT: POST/PUT tx to API
function saveCurrentTransaction() {
  const items = [];
  document.querySelectorAll('#items-tbody tr').forEach(tr => {
    const id    = tr.id.replace('item-row-', '');
    const cells = tr.querySelectorAll('input');
    items.push({
      desc:  cells[0]?.value || '',
      qty:   parseFloat(cells[1]?.value) || 0,
      price: parseFloat(cells[2]?.value) || 0,
      total: parseFloat(cells[3]?.value) || 0,
    });
  });

  const baseType    = state.transactionType;   // 'invoice' | 'claim' | 'advance' | 'journal'
  const isJournal   = baseType === 'journal';
  const isAdvance   = baseType === 'advance';
  const payMethod   = document.querySelector('input[name="f-payment-method"]:checked')?.value || 'نقداً';
  const isCash      = payMethod === 'نقداً';
  const isCashable  = (baseType === 'invoice' || baseType === 'claim');

  // Resolve final type
  let finalType = baseType;
  if (isCashable && isCash) {
    finalType = baseType === 'invoice' ? 'invoice_cash' : 'claim_cash';
  }

  let total = 0;
  if (isAdvance) {
    total = (parseFloat(document.getElementById('f-dinar').value) || 0)
          + (parseFloat(document.getElementById('f-fils').value)  || 0) / FILS_PER_DINAR;
  } else if (isJournal) {
    total = (parseFloat(document.getElementById('f-journal-dinar').value) || 0)
          + (parseFloat(document.getElementById('f-journal-fils').value)  || 0) / FILS_PER_DINAR;
  } else if (baseType === 'salfa_yad') {
    total = state.settings.salfaMax || 75;
  } else {
    total = calcItemsTotal();
}
  
  const pendingPurpose = document.getElementById('purpose-input')?.value.trim();
  if (pendingPurpose) addPurposeTag(pendingPurpose);
  syncPurposeHidden();

  const tx = {
    id:           state.editingId || getNextId(),
    type:         finalType,
    serial:       document.getElementById('f-serial').value,
    date:         document.getElementById('f-date').value,
    recipient:    isJournal ? '' : document.getElementById('f-recipient').value,
    accountFrom:  document.getElementById('f-account-from').value.trim(),
    accountTo:    document.getElementById('f-account-to').value.trim(),
    nid:              document.getElementById('f-nid').value,
    invoiceNo:        document.getElementById('f-invoice-no').value,
    invoiceDate:      document.getElementById('f-invoice-date')?.value    || '',
    entryDocNo:       document.getElementById('f-entry-doc-no')?.value    || '',
    entryDocDate:     document.getElementById('f-entry-doc-date')?.value  || '',
    paymentMethod:    payMethod,
    recipientName:    document.getElementById('f-recipient-name')?.value  || '',
    recipientNid:     document.getElementById('f-recipient-nid')?.value   || '',
    recipientIdNo:    document.getElementById('f-recipient-id-no')?.value || '',
    recipientIdPlace: document.getElementById('f-recipient-id-place')?.value || '',
    transferNo:       document.getElementById('f-transfer-no').value,
    transferDate:     document.getElementById('f-transfer-date')?.value   || '',
    purpose:          document.getElementById('f-purpose').value,
    devGrantField:    document.getElementById('f-dev-grant-field')?.value || '',
    items,
    dinar: isJournal
      ? parseFloat(document.getElementById('f-journal-dinar').value) || 0
      : parseFloat(document.getElementById('f-dinar').value)         || 0,
    fils: isJournal
      ? parseFloat(document.getElementById('f-journal-fils').value)  || 0
      : parseFloat(document.getElementById('f-fils').value)          || 0,
    total,
    salfaId: null,  // will be set below for cash transactions
  };

  if (state.editingId) {
    // Editing: update in place, adjust old salfa if type changed
    const idx = state.transactions.findIndex(tx2 => tx2.id === state.editingId);
    if (idx !== -1) {
      const old = state.transactions[idx];
      // If was cash, remove from old salfa
      if (old.salfaId) {
        const oldSalfa = state.transactions.find(s => s.id === old.salfaId);
        if (oldSalfa) {
          oldSalfa.items = oldSalfa.items.filter(i => i !== old.id);
          oldSalfa.total = recalcSalfaTotal(oldSalfa);
        }
      }
      tx.id = state.editingId;
      // If still cash, reassign to salfa
      if (isCashable && isCash) {
        const salfa = assignToCashSalfa(tx);
        tx.salfaId  = salfa.id;
      }
      state.transactions[idx] = tx;
    }
    state.editingId = null;
  } else {
    // New transaction
    if (isCashable && isCash) {
      // Check if adding would overflow current open salfa
      const salfaMax  = state.settings.salfaMax || 75;
      const openSalfa = getOpenSalfa();
      if (openSalfa && (openSalfa.total + total) > salfaMax) {
        // Warn and ask user — handled by showing confirm modal
        // We store the tx temporarily and ask user in finishWizard flow
        state._pendingCashTx = tx;
        showOverflowWarning(tx, openSalfa, salfaMax);
        return null;  // signal that save is pending user decision
      }
      state.transactions.push(tx);
      const salfa = assignToCashSalfa(tx);
      tx.salfaId  = salfa.id;
    } else {
      if (baseType === 'salfa_yad') {
        const salfaMax = state.settings.salfaMax || 75;
        tx.type         = 'salfa_yad';
        tx.status       = 'closed';
        tx.accountFrom  = 'البنك';
        tx.accountTo    = 'السلفة';
        tx.total        = salfaMax;
        tx.dinar        = Math.floor(salfaMax);
        tx.fils         = Math.round((salfaMax % 1) * FILS_PER_DINAR);
        tx.transferNo        = document.getElementById('f-transfer-no')?.value.trim() || '';
        tx.transferDate      = document.getElementById('f-transfer-date')?.value      || '';
        tx.recipient         = document.getElementById('f-recipient')?.value          || '',
        tx.recipientName     = document.getElementById('f-recipient-name')?.value     || '';
        tx.recipientIdNo     = document.getElementById('f-recipient-id-no')?.value    || '';
        tx.recipientIdPlace  = document.getElementById('f-recipient-id-place')?.value || '';
        tx.recipientNid      = document.getElementById('f-recipient-nid')?.value      || '';
        tx.items        = [];
        tx.salfaId      = null;
        tx.maxAmount    = salfaMax;
      }
      state.transactions.push(tx);
    } 
  }

  renderArchive();
  updateStats();
  persistState();
  return tx;
}

function recalcSalfaTotal(salfa) {
  return salfa.items.reduce((sum, id) => {
    const t = state.transactions.find(t => t.id === id);
    return sum + (t ? t.total : 0);
  }, 0);
}

/* ── Overflow warning modal ──────────────────────────────── */
function showOverflowWarning(tx, openSalfa, salfaMax) {
  const remaining = salfaMax - openSalfa.total;
  document.getElementById('overflow-salfa-serial').textContent  = openSalfa.serial;
  document.getElementById('overflow-salfa-total').textContent   = openSalfa.total.toFixed(3);
  document.getElementById('overflow-salfa-max').textContent     = salfaMax.toFixed(3);
  document.getElementById('overflow-salfa-remaining').textContent = remaining.toFixed(3);
  document.getElementById('overflow-tx-amount').textContent     = tx.total.toFixed(3);
  showModal('modal-overflow-warning');
}

function overflowProceed() {
  // User confirmed: close current salfa and open new one
  const openSalfa = getOpenSalfa();
  if (openSalfa) {
    // Mark old salfa as needing closure (still open but overflowed)
    // A new salfa will be auto-created for this tx
  }
  hideModal('modal-overflow-warning');
  const tx = state._pendingCashTx;
  state._pendingCashTx = null;
  if (!tx) return;
  state.transactions.push(tx);
  // Force new salfa by temporarily marking current one as overflowed
  if (openSalfa) openSalfa._overflowed = true;
  const salfa = assignToCashSalfaForced(tx);
  tx.salfaId  = salfa.id;
  renderArchive();
  updateStats();
  persistState();
  showToast(`✅ تم حفظ المعاملة ${tx.serial} في سلفة جديدة ${salfa.serial}`, 'success');
  resetWizard();
  switchTab('archive');
}

function overflowCancel() {
  state._pendingCashTx = null;
  hideModal('modal-overflow-warning');
}

/** Like assignToCashSalfa but always creates a new salfa (used after overflow) */
function assignToCashSalfaForced(tx) {
  const salfa = createNewSalfa();
  salfa.items.push(tx.id);
  salfa.total = tx.total;
  return salfa;
}

/* ═══════════════════════════════════════════════════════════
   FINISH / RESET
═══════════════════════════════════════════════════════════ */
function finishWizard(action) {
  const tx = saveCurrentTransaction();
  if (!tx) return;  // overflow modal is showing, waiting for user decision

  if (action === 'done') {
    showToast(`✅ تم حفظ المعاملة ${tx.serial} بنجاح`, 'success');
    setTimeout(() => { resetWizard(); switchTab('archive'); }, 100);
  } else if (action === 'docs') {
    showToast(`📋 تم حفظ المعاملة ${tx.serial}`, 'info');
    setTimeout(() => {
      resetWizard();
      switchTab('archive');
      setTimeout(() => openDocsModal(tx.id), 200);
    }, 500);
  }
}

// List of all field IDs to clear on reset
const WIZARD_FIELD_IDS = [
  'f-serial','f-date','f-recipient','f-nid','f-invoice-no','f-transfer-no',
  'f-purpose','f-dinar','f-fils','f-account-from','f-account-to',
  'f-journal-dinar','f-journal-fils','f-invoice-date','f-entry-doc-no',
  'f-entry-doc-date','f-recipient-nid','f-recipient-name','f-recipient-id-no',
  'f-recipient-id-place','f-transfer-date','f-dev-grant-field',
];

function resetWizard() {
  state.wizardStep      = 0;
  state.transactionType = null;
  state.editingId       = null;
  state._pendingCashTx  = null;

  document.getElementById('wizard-title').textContent = 'معاملة جديدة';
  goToStep(0);

  Object.keys(TRANSACTION_SCHEMAS).forEach(t => {
    document.getElementById('type-' + t)?.classList.remove('selected');
  });
  document.getElementById('btn-next-0').disabled = true;

  WIZARD_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const defaultRadio = document.querySelector('input[name="f-payment-method"][value="نقداً"]');
  if (defaultRadio) { defaultRadio.checked = true; toggleCheckFields(); }

  document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
  clearPurposeTags();
  document.getElementById('items-tbody').innerHTML = '';
  itemRowId = 0;
  updateTotals();
}

/* ═══════════════════════════════════════════════════════════
   EDIT TRANSACTION
   DATABASE LOAD POINT: Load tx from DB by ID
═══════════════════════════════════════════════════════════ */
function editTransaction(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  // Salfa containers cannot be edited via the wizard — only closed
  if (tx.type === 'salfa') {
    showToast('لتعديل السلفة، استخدم زر الإغلاق أو التعديل المباشر', 'info');
    return;
  }

  state.editingId       = id;
  // Map cash types back to their base type for the wizard
  const baseType = tx.type === 'invoice_cash' ? 'invoice'
                 : tx.type === 'claim_cash'   ? 'claim'
                 : tx.type;
  state.transactionType = baseType;

  //const isCheck = !!tx.transferNo;
  //const radio   = document.querySelector(`input[name="f-payment-method"][value="${isCheck ? 'شيك' : 'نقداً'}"]`);
  //if (radio) radio.checked = true;

  document.getElementById('f-serial').value             = tx.serial           || '1';
  document.getElementById('f-date').value               = tx.date             || '';
  document.getElementById('f-recipient').value          = tx.recipient        || '';
  document.getElementById('f-account-from').value       = tx.accountFrom      || '';
  document.getElementById('f-account-to').value         = tx.accountTo        || '';
  document.getElementById('f-invoice-no').value         = tx.invoiceNo        || '';
  document.getElementById('f-invoice-date').value       = tx.invoiceDate      || '';
  document.getElementById('f-entry-doc-no').value       = tx.entryDocNo       || '';
  document.getElementById('f-entry-doc-date').value     = tx.entryDocDate     || '';
  document.getElementById('f-nid').value                = tx.nid              || '';
  document.getElementById('f-recipient-nid').value      = tx.recipientNid     || '';
  document.getElementById('f-recipient-name').value     = tx.recipientName    || '';
  document.getElementById('f-recipient-id-no').value    = tx.recipientIdNo    || '';
  document.getElementById('f-recipient-id-place').value = tx.recipientIdPlace || '';
  document.getElementById('f-transfer-date').value      = tx.transferDate     || '';
  document.getElementById('f-journal-dinar').value      = baseType === 'journal' ? (tx.dinar || '') : '';
  document.getElementById('f-journal-fils').value       = baseType === 'journal' ? (tx.fils  || '') : '';
  document.getElementById('f-dinar').value              = baseType !== 'journal' ? (tx.dinar || '') : '';
  document.getElementById('f-fils').value               = baseType !== 'journal' ? (tx.fils  || '') : '';
  document.getElementById('f-dev-grant-field').value    = tx.devGrantField    || '';
  document.getElementById('f-transfer-no').value        = tx.transferNo       || '';

  if (tx.type === 'salfa_yad') {
    const s = state.settings;
    document.getElementById('f-transfer-no').value        = tx.transferNo                              || '';
    document.getElementById('f-transfer-date').value      = tx.transferDate                            || '';
    document.getElementById('f-recipient-name').value     = tx.recipientName     || s.headmaster        || '';
    document.getElementById('f-recipient-nid').value      = tx.recipientNid      || s.headmasterNid     || '';
    document.getElementById('f-recipient-id-no').value    = tx.recipientIdNo     || s.headmasterIdNo    || '';
    document.getElementById('f-recipient-id-place').value = tx.recipientIdPlace  || s.headmasterIdPlace || '';
  }

  loadPurposeTags(tx.purpose || '');
  document.getElementById('items-tbody').innerHTML = '';
  itemRowId = 0;
  if (baseType !== 'advance' && baseType !== 'journal' && Array.isArray(tx.items)) {
    tx.items.forEach(item => addItemRow(item));
  }

  switchTab('wizard');
  document.getElementById('wizard-title').textContent = `تعديل المعاملة #${tx.serial}`;
  goToStep(0);
  selectType(baseType);

  goToStep(1);
  const isCheck = !!tx.transferNo;
  const radio = document.querySelector(`input[name="f-payment-method"][value="${isCheck ? 'شيك' : 'نقداً'}"]`);
  if (radio) { radio.checked = true; toggleCheckFields(); }
  showToast(`تم تحميل المعاملة ${tx.serial} للتعديل`, 'info');
}