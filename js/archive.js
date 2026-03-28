/* ═══════════════════════════════════════════════════════════════
   archive.js — ميزان
   Archive table rendering, stats bar, delete confirmation modal,
   and document-picker modal.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Badge helper ────────────────────────────────────────── */
function makeBadgeHtml(type) {
  const meta = TRANSACTION_TYPE_META[type] || { label: '–', badgeClass: 'badge-orange' };
  return meta.badgeStyle
    ? `<span class="badge" style="${meta.badgeStyle}">${meta.label}</span>`
    : `<span class="badge ${meta.badgeClass}">${meta.label}</span>`;
}

/* ── Archive table ───────────────────────────────────────── */
function renderArchive() {
  const tbody = document.getElementById('archive-tbody');
  const empty = document.getElementById('archive-empty');
  tbody.innerHTML = '';

  // Inner cash items live inside their salfa row — not shown as top-level rows
  const innerIds = new Set(
    state.transactions
      .filter(tx => tx.type === 'salfa')
      .flatMap(tx => tx.items || [])
  );

  const visible = state.transactions.slice().reverse().filter(tx => !innerIds.has(tx.id));

  if (visible.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  visible.forEach(tx => {
    if (tx.type === 'salfa') {
      renderSalfaRow(tbody, tx);
    } else {
      renderStandardRow(tbody, tx);
    }
  });
}

/* ── Standard (non-salfa) row ────────────────────────────── */
function renderStandardRow(tbody, tx) {
  const docs = ARCHIVE_DOC_LABELS[tx.type] || [];
  const recipientDisplay = tx.type === 'journal'
    ? `<span class="text-xs text-purple-700">من: ${tx.accountFrom||'–'} ← إلى: ${tx.accountTo||'–'}</span>`
    : (tx.recipient || '–');

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="px-4 py-3 font-mono text-xs text-gray-500 border-b border-gray-50">${tx.serial}</td>
    <td class="px-4 py-3 text-sm text-gray-600 border-b border-gray-50">${tx.date}</td>
    <td class="px-4 py-3 border-b border-gray-50">${makeBadgeHtml(tx.type)}</td>
    <td class="px-4 py-3 text-sm font-medium text-gray-800 border-b border-gray-50">${recipientDisplay}</td>
    <td class="px-4 py-3 font-bold text-orange-600 text-sm border-b border-gray-50">${tx.total.toFixed(3)} د.أ</td>
    <td class="px-4 py-3 border-b border-gray-50 text-xs text-gray-400">${docs.join(' · ')}</td>
    <td class="px-4 py-3 border-b border-gray-50">
      <div class="flex items-center gap-1.5 justify-center">
        <button onclick="openDocsModal(${tx.id})"
          class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
          style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa;">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          إصدار
        </button>
        <button onclick="editTransaction(${tx.id})"
          class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
          style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          تعديل
        </button>
        <button onclick="openDeleteModal(${tx.id})"
          class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
          style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca;">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          حذف
        </button>
      </div>
    </td>`;
  tbody.appendChild(tr);
}

/* ── Salfa container row ─────────────────────────────────── */
function renderSalfaRow(tbody, salfa) {
  const isClosed = salfa.status === 'closed';
  const rowCount = (salfa.items || []).length;
  const salfaMax = salfa.maxAmount || state.settings.salfaMax || 75;
  const pct      = Math.min(100, (salfa.total / salfaMax) * 100);

  const statusBadge = isClosed
    ? `<span class="badge" style="background:#dcfce7;color:#15803d;">مغلقة ✓</span>`
    : `<span class="badge" style="background:#fff7ed;color:#c2410c;">مفتوحة</span>`;

  const checkInfo = isClosed
    ? `<div class="text-xs text-gray-500 mt-0.5">شيك: ${salfa.transferNo} · ${salfa.transferDate || ''}</div>`
    : '';

  const tr = document.createElement('tr');
  tr.id = `salfa-row-${salfa.id}`;
  tr.style.cssText = 'background: linear-gradient(135deg, #fff7ed, #ffedd5);';
  tr.innerHTML = `
    <td class="px-4 py-3 border-b border-orange-200 font-mono text-xs text-orange-700 font-black">${salfa.serial}</td>
    <td class="px-4 py-3 border-b border-orange-200 text-sm text-gray-600">${salfa.date}</td>
    <td class="px-4 py-3 border-b border-orange-200">
      <span class="badge badge-orange">سلفة صندوق</span><br/>
      <span class="mt-1 inline-block">${statusBadge}</span>
    </td>
    <td class="px-4 py-3 border-b border-orange-200">
      <div class="text-xs text-gray-500">${rowCount} معاملة</div>
      ${checkInfo}
    </td>
    <td class="px-4 py-3 border-b border-orange-200">
      <div class="flex items-center gap-2">
        <div class="flex-1 bg-orange-100 rounded-full h-2" style="max-width:120px;">
          <div class="h-2 rounded-full" style="width:${pct}%; background:${pct>=90?'#dc2626':'#f97316'};"></div>
        </div>
        <span class="text-xs font-bold ${pct>=90?'text-red-600':'text-orange-700'} whitespace-nowrap">${salfa.total.toFixed(3)} / ${salfaMax} د.أ</span>
      </div>
    </td>
    <td class="px-4 py-3 border-b border-orange-200">
      <button onclick="toggleSalfaExpand(${salfa.id})" id="salfa-toggle-${salfa.id}"
        class="w-7 h-7 rounded-lg flex items-center justify-center text-orange-600 font-black text-sm transition-all duration-200"
        style="background:#fed7aa;">▼</button>
    </td>
    <td class="px-4 py-3 border-b border-orange-200">
      <div class="flex items-center gap-1.5 justify-center">
        <button onclick="openDocsModal(${salfa.id})"
          class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
          style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa;">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          إصدار
        </button>
        ${!isClosed ? `<button onclick="openCloseSalfaModal(${salfa.id})"
          class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
          style="background:#dcfce7; color:#15803d; border:1px solid #86efac;">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          إغلاق
        </button>` : ''}
        <button onclick="openDeleteModal(${salfa.id})"
          class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
          style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca;">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          حذف
        </button>
      </div>
    </td>`;
  tbody.appendChild(tr);

  // Inner rows (hidden by default)
  (salfa.items || []).forEach(itemId => {
      const tx = state.transactions.find(t => t.id === itemId);
      if (!tx) return;
      const docs = ARCHIVE_DOC_LABELS[tx.type] || [];
      const innerRow = document.createElement('tr');
      innerRow.id = `salfa-child-${tx.id}`;
      innerRow.classList.add('hidden', `salfa-child-of-${salfa.id}`);
      innerRow.style.cssText = 'background:#fffbf5;';
      innerRow.innerHTML = `
        <td class="px-4 py-3 font-mono text-xs text-gray-500 border-b border-orange-100" style="border-right:4px solid #fb923c;">${tx.serial}</td>
        <td class="px-4 py-3 text-sm text-gray-600 border-b border-orange-100">${tx.date}</td>
        <td class="px-4 py-3 border-b border-orange-100">${makeBadgeHtml(tx.type)}</td>
        <td class="px-4 py-3 text-sm font-medium text-gray-800 border-b border-orange-100">${tx.recipient || '–'}</td>
        <td class="px-4 py-3 font-bold text-orange-600 text-sm border-b border-orange-100">${tx.total.toFixed(3)} د.أ</td>
        <td class="px-4 py-3 border-b border-gray-50 text-xs text-gray-400">${docs.join(' · ')}</td>
        <td class="px-4 py-3 border-b border-orange-100">
          <div class="flex items-center gap-1.5 justify-center">
            <button onclick="openDocsModal(${tx.id})" class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa;">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              إصدار
            </button>
            <button onclick="editTransaction(${tx.id})" class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              تعديل
            </button>
            <button onclick="openDeleteModal(${tx.id})" class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca;">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              حذف
            </button>
          </div>
        </td>`;
      tbody.appendChild(innerRow);
  });
}

function toggleSalfaExpand(salfaId) {
  const toggle = document.getElementById(`salfa-toggle-${salfaId}`);
  const children = document.querySelectorAll(`.salfa-child-of-${salfaId}`);
  if (!children.length) return;
  const isHidden = children[0].classList.contains('hidden');
  children.forEach(row => row.classList.toggle('hidden', !isHidden));
  if (toggle) toggle.style.transform = isHidden ? 'rotate(180deg)' : '';
}

/* ── Stats bar ───────────────────────────────────────────── */
function updateStats() {
  const txs = state.transactions;
  const innerIds = new Set(
    txs.filter(tx => tx.type === 'salfa').flatMap(tx => tx.items || [])
  );
  const countable = txs.filter(tx => !innerIds.has(tx.id));
  const total = countable.reduce((s, t) => s + t.total, 0);

  document.getElementById('stat-total').textContent    = total.toFixed(3) + ' د.أ';
  document.getElementById('stat-count').textContent    = countable.length;
  document.getElementById('stat-invoices').textContent =
    txs.filter(t => t.type === 'invoice' || t.type === 'invoice_cash').length;
  document.getElementById('stat-advances').textContent =
    txs.filter(t => t.type === 'salfa').length;
}

/* ── Delete modal ────────────────────────────────────────── */
let pendingDeleteId = null;

function openDeleteModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  pendingDeleteId = id;

  let displayName;
  if (tx.type === 'salfa') {
    displayName = `سلفة صندوق ${tx.serial}`;
  } else if (tx.type === 'journal') {
    displayName = `${tx.accountFrom || '–'} ← ${tx.accountTo || '–'}`;
  } else {
    displayName = tx.recipient || '–';
  }

  document.getElementById('modal-delete-label').textContent =
    `${tx.serial} – ${displayName} (${tx.total.toFixed(3)} د.أ)`;

  const warnEl = document.getElementById('modal-delete-salfa-warn');
  if (warnEl) {
    if (tx.type === 'salfa' && (tx.items||[]).length > 0) {
      warnEl.classList.remove('hidden');
      warnEl.textContent = `⚠️ سيتم إلغاء ارتباط ${tx.items.length} معاملة داخلية بهذه السلفة.`;
    } else {
      warnEl.classList.add('hidden');
    }
  }

  showModal('modal-delete');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  hideModal('modal-delete');
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  const tx = state.transactions.find(t => t.id === pendingDeleteId);

  if (tx?.type === 'salfa') {
    (tx.items || []).forEach(itemId => {
      const inner = state.transactions.find(t => t.id === itemId);
      if (inner) inner.salfaId = null;
    });
  } else if (tx?.salfaId) {
    const parentSalfa = state.transactions.find(s => s.id === tx.salfaId);
    if (parentSalfa) {
      parentSalfa.items = parentSalfa.items.filter(i => i !== tx.id);
      parentSalfa.total = recalcSalfaTotal(parentSalfa);
    }
  }

  state.transactions = state.transactions.filter(t => t.id !== pendingDeleteId);
  pendingDeleteId = null;
  hideModal('modal-delete');
  renderArchive();
  updateStats();
  showToast(`🗑️ تم حذف المعاملة ${tx?.serial || ''} بنجاح`, 'error');
  persistState();
}

/* ── Document-picker modal ────────────────────────────────── */
let pickerTxId = null;

function openDocsModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  pickerTxId = id;

  document.getElementById('modal-docs-subtitle').textContent  = 'اختر المستندات التي تريد إصدارها لهذه المعاملة';
  document.getElementById('modal-docs-serial').textContent    = tx.serial;
  document.getElementById('modal-docs-recipient').textContent = tx.type === 'journal'
    ? `${tx.accountFrom||'–'} ← ${tx.accountTo||'–'}`
    : (tx.recipient || '–');
  document.getElementById('modal-docs-total').textContent = tx.total.toFixed(3) + ' د.أ';

  const docs = ALL_DOCS[tx.type] || ALL_DOCS['invoice'] || [];
  document.getElementById('modal-docs-checkboxes').innerHTML = docs.map(doc => `
    <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:opacity-80 transition-opacity mb-2 ${doc.color}" style="border-width:1.5px;">
      <input type="checkbox" name="doc-pick" value="${doc.id}" checked
        class="w-4 h-4 accent-orange-500 flex-shrink-0" />
      <span class="text-xl">${doc.icon}</span>
      <span class="font-semibold text-sm">${doc.label}</span>
    </label>`).join('');

  document.getElementById('modal-docs-salfa-rows')?.classList.add('hidden');
  showModal('modal-docs');
}

function closeDocsModal() {
  pickerTxId = null;
  hideModal('modal-docs');
}

function selectAllDocs(val) {
  document.querySelectorAll('input[name="doc-pick"]').forEach(cb => cb.checked = val);
}

function issueSelectedDocs() {
  const checked = [...document.querySelectorAll('input[name="doc-pick"]:checked')].map(cb => cb.value);
  const tx = state.transactions.find(t => t.id === pickerTxId);
  if (!tx) return;
  if (checked.length === 0) { showToast('يرجى اختيار مستند واحد على الأقل', 'error'); return; }

  const pages = [];
  checked.filter(id => docBuilders[id]).forEach(id => pages.push(docBuilders[id](tx)));
  if (pages.length === 0) { showToast('يرجى اختيار مستند واحد على الأقل', 'error'); return; }

  closeDocsModal();
  openDocPreview(pages.join(''), 'مستندات المعاملة ' + tx.serial);
}

/* ── Modal keyboard / backdrop wiring ────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  ['modal-delete', 'modal-docs', 'modal-close-salfa', 'modal-overflow-warning'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', function(e) {
      if (e.target !== this) return;
      if (id === 'modal-delete')           closeDeleteModal();
      if (id === 'modal-docs')             closeDocsModal();
      if (id === 'modal-close-salfa')      closeCloseSalfaModal();
      if (id === 'modal-overflow-warning') overflowCancel();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.altKey && e.key === '1') switchTab('archive');
    if (e.altKey && e.key === '2') switchTab('wizard');
    if (e.altKey && e.key === '3') switchTab('reports');
    if (e.altKey && e.key === '4') switchTab('ledger');
    if (e.altKey && e.key === '5') switchTab('settings');
    if (e.key === 'Escape') {
      closeDeleteModal();
      closeDocsModal();
      closeCloseSalfaModal();
      overflowCancel();
    }
  });
});