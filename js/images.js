/* ═══════════════════════════════════════════════════════════════
   images.js — ميزان
   Image modal UI, upload handling, lightbox viewer,
   and archive camera-badge refresh.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── State ───────────────────────────────────────────────── */
let _imgTxId       = null;   // currently open transaction id
let _imgTxSerial   = '';     // for display
let _lightboxItems = [];     // [{id, fullData, label, date}] for lightbox
let _lightboxIdx   = 0;

/* ═══════════════════════════════════════════════════════════
   OPEN / CLOSE MODAL
═══════════════════════════════════════════════════════════ */
async function openImagesModal(txId) {
  const isTemp = txId < 0; // negative = wizard temp ID

  if (!isTemp) {
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) return;
    _imgTxSerial = tx.serial || String(txId);
  } else {
    _imgTxSerial = 'مسودة جديدة';
  }

  _imgTxId = txId;

  document.getElementById('img-modal-serial').textContent = _imgTxSerial;
  document.getElementById('img-upload-progress').classList.add('hidden');
  document.getElementById('img-upload-bar').style.width = '0%';

  showModal('modal-images');
  await _refreshGrid();
}

function closeImagesModal() {
  const wasWizard = _imgTxId < 0; // negative = temp wizard ID
  _imgTxId     = null;
  _imgTxSerial = '';
  hideModal('modal-images');
  if (wasWizard) {
    ImageStore.count(_wizardTempImageId || 0)
      .then(c => _updateWizardImageBadge(c))
      .catch(() => {});
  } else {
    refreshImageBadges();
  }
}

/* ═══════════════════════════════════════════════════════════
   GRID RENDERING
═══════════════════════════════════════════════════════════ */
async function _refreshGrid() {
  const grid    = document.getElementById('img-grid');
  const empty   = document.getElementById('img-empty');
  const countEl = document.getElementById('img-modal-count');
  const delAll  = document.getElementById('img-btn-delete-all');

  grid.innerHTML = '';

  let images = [];
  try {
    images = await ImageStore.getAll(_imgTxId);
  } catch (err) {
    showToast('خطأ في تحميل الصور', 'error');
    return;
  }

  countEl.textContent = images.length;

  if (images.length === 0) {
    empty.classList.remove('hidden');
    delAll.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  delAll.classList.remove('hidden');

  images.forEach((img, idx) => {
    const card = document.createElement('div');
    card.className = 'relative group rounded-xl overflow-hidden border border-gray-100 cursor-pointer';
    card.style.cssText = 'aspect-ratio:1;';
    card.innerHTML = `
      <img src="${img.thumbData}" alt="${img.label || ''}"
        class="w-full h-full object-cover transition-transform group-hover:scale-105"
        onclick="openLightbox(${idx})" />
      <div class="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none"></div>
      <!-- Delete button -->
      <button onclick="imgDeleteOne(${img.id}, event)"
        class="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black
               flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
        title="حذف">×</button>
      <!-- Label badge -->
      ${img.label ? `<div class="absolute bottom-0 right-0 left-0 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 truncate">${img.label}</div>` : ''}`;
    grid.appendChild(card);
  });

  // Cache items for lightbox (thumbnails are enough to build the list; full data loaded on demand)
  _lightboxItems = images;
}

/* ═══════════════════════════════════════════════════════════
   UPLOAD HANDLING
═══════════════════════════════════════════════════════════ */
async function imgFilePicked(event) {
  const files = [...event.target.files];
  event.target.value = ''; // reset so same file can be re-picked
  if (files.length === 0) return;
  await _uploadFiles(files);
}

async function _uploadFiles(files) {
  if (!_imgTxId) return;

  const progress = document.getElementById('img-upload-progress');
  const bar      = document.getElementById('img-upload-bar');
  const label    = document.getElementById('img-upload-label');

  progress.classList.remove('hidden');

  const validFiles = files.filter(f => f.type.startsWith('image/'));
  if (validFiles.length === 0) {
    showToast('يرجى اختيار ملفات صور صالحة', 'error');
    progress.classList.add('hidden');
    return;
  }

  let done = 0;
  for (const file of validFiles) {
    try {
      label.textContent = `جاري رفع ${file.name}…`;
      await ImageStore.save(_imgTxId, file);
      done++;
      bar.style.width = Math.round((done / validFiles.length) * 100) + '%';
    } catch (err) {
      showToast(`فشل رفع ${file.name}`, 'error');
    }
  }

  await new Promise(r => setTimeout(r, 300)); // brief pause to show 100%
  progress.classList.add('hidden');
  bar.style.width = '0%';

  await _refreshGrid();
  showToast(`✅ تم رفع ${done} صورة`, 'success');

  // Update imageCount on the transaction object
  _syncImageCount(_imgTxId);
}

/* ── Drag and drop ───────────────────────────────────────── */
function imgDragOver(e) {
  e.preventDefault();
  document.getElementById('img-drop-zone').classList.add('border-orange-400', 'bg-orange-50');
}

function imgDragLeave(e) {
  document.getElementById('img-drop-zone').classList.remove('border-orange-400', 'bg-orange-50');
}

function imgDrop(e) {
  e.preventDefault();
  document.getElementById('img-drop-zone').classList.remove('border-orange-400', 'bg-orange-50');
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  if (files.length) _uploadFiles(files);
}

/* ═══════════════════════════════════════════════════════════
   DELETE
═══════════════════════════════════════════════════════════ */
async function imgDeleteOne(imageId, event) {
  event?.stopPropagation();
  try {
    await ImageStore.deleteOne(imageId);
    await _refreshGrid();
    _syncImageCount(_imgTxId);
    showToast('تم حذف الصورة', 'error');
  } catch (err) {
    showToast('خطأ في حذف الصورة', 'error');
  }
}

async function imgDeleteAll() {
  if (!_imgTxId) return;
  if (!confirm('هل أنت متأكد من حذف جميع الصور لهذه المعاملة؟')) return;
  try {
    await ImageStore.deleteAllForTx(_imgTxId);
    await _refreshGrid();
    _syncImageCount(_imgTxId);
    showToast('تم حذف جميع الصور', 'error');
  } catch (err) {
    showToast('خطأ في حذف الصور', 'error');
  }
}

/* ═══════════════════════════════════════════════════════════
   LIGHTBOX
═══════════════════════════════════════════════════════════ */
async function openLightbox(idx) {
  _lightboxIdx = idx;
  showModal('modal-lightbox');
  await _showLightboxFrame(idx);
}

async function _showLightboxFrame(idx) {
  const item = _lightboxItems[idx];
  if (!item) return;

  const imgEl   = document.getElementById('lightbox-img');
  const labelEl = document.getElementById('lightbox-label');
  const metaEl  = document.getElementById('lightbox-meta');

  // Load full image
  imgEl.src = '';
  try {
    const full = await ImageStore.getOne(item.id);
    imgEl.src  = full?.fullData || item.thumbData;
  } catch {
    imgEl.src = item.thumbData;
  }

  labelEl.textContent = item.label || `صورة ${idx + 1}`;
  metaEl.textContent  = [
    `${idx + 1} / ${_lightboxItems.length}`,
    item.date ? new Date(item.date).toLocaleDateString('ar-JO') : '',
    item.size  ? `${(item.size / 1024).toFixed(0)} KB` : '',
  ].filter(Boolean).join(' · ');
}

function closeLightbox() {
  hideModal('modal-lightbox');
  document.getElementById('lightbox-img').src = '';
}

async function lightboxNext() {
  if (_lightboxItems.length === 0) return;
  _lightboxIdx = (_lightboxIdx + 1) % _lightboxItems.length;
  await _showLightboxFrame(_lightboxIdx);
}

async function lightboxPrev() {
  if (_lightboxItems.length === 0) return;
  _lightboxIdx = (_lightboxIdx - 1 + _lightboxItems.length) % _lightboxItems.length;
  await _showLightboxFrame(_lightboxIdx);
}

/* ═══════════════════════════════════════════════════════════
   IMAGE COUNT SYNC — keeps tx.imageCount updated
═══════════════════════════════════════════════════════════ */
async function _syncImageCount(txId) {
  try {
    const c  = await ImageStore.count(txId);
    const tx = state.transactions.find(t => t.id === txId);
    if (tx) {
      tx.imageCount = c;
      persistState();
    }
    _updateBadge(txId, c);
  } catch { /* silent */ }
}

/* ═══════════════════════════════════════════════════════════
   ARCHIVE BADGE MANAGEMENT
═══════════════════════════════════════════════════════════ */

/**
 * Called once after renderArchive() to stamp camera badges
 * on all visible rows using one batch IndexedDB query.
 */
async function refreshImageBadges() {
  const visibleIds = state.transactions
    .filter(tx => tx.imageCount !== undefined || true) // all ids
    .map(tx => tx.id);

  if (visibleIds.length === 0) return;

  try {
    const countMap = await ImageStore.countMany(visibleIds);
    countMap.forEach((count, txId) => {
      _updateBadge(txId, count);
      // keep state in sync
      const tx = state.transactions.find(t => t.id === txId);
      if (tx && tx.imageCount !== count) {
        tx.imageCount = count;
      }
    });
  } catch { /* silent — badges just won't show */ }
}

function _updateBadge(txId, count) {
  const btn = document.getElementById(`img-btn-${txId}`);
  if (!btn) return;
  const badge = btn.querySelector('.img-badge');
  if (count > 0) {
    btn.style.background = '#fff7ed';
    btn.style.color      = '#c2410c';
    btn.style.border     = '1px solid #fed7aa';
    if (badge) badge.textContent = count;
    else {
      const b = document.createElement('span');
      b.className = 'img-badge ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5 font-black';
      b.textContent = count;
      btn.appendChild(b);
    }
  } else {
    btn.style.background = '#f8fafc';
    btn.style.color      = '#94a3b8';
    btn.style.border     = '1px solid #e2e8f0';
    if (badge) badge.remove();
  }
}

/**
 * Builds the camera button HTML for an archive row.
 * Insert this into the actions cell of every standard row.
 */
function imgCameraButtonHtml(txId) {
  const count = state.transactions.find(t => t.id === txId)?.imageCount || 0;
  return `
    <button id="img-btn-${txId}"
      onclick="openImagesModal(${txId})"
      title="مرفقات الصور"
      class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors"
      style="background:#f8fafc; color:#94a3b8; border:1px solid #e2e8f0;">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      ${count > 0 ? `<span class="img-badge bg-orange-500 text-white text-xs rounded-full px-1.5 font-black">${count}</span>` : ''}
    </button>`;
}

/* ═══════════════════════════════════════════════════════════
   KEYBOARD / BACKDROP
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-images')?.addEventListener('click', function(e) {
    if (e.target === this) closeImagesModal();
  });
  document.getElementById('modal-lightbox')?.addEventListener('click', function(e) {
    if (e.target === this) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (document.getElementById('modal-lightbox')?.classList.contains('flex')) {
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown')  lightboxNext();
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp')    lightboxPrev();
      if (e.key === 'Escape') closeLightbox();
    } else if (document.getElementById('modal-images')?.classList.contains('flex')) {
      if (e.key === 'Escape') closeImagesModal();
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   IMAGE EXPORT / IMPORT (for settings.js)
═══════════════════════════════════════════════════════════ */
async function exportImages() {
  try {
    const all  = await ImageStore.exportAll();
    const blob = new Blob([JSON.stringify(all)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `mizan-images-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✅ تم تصدير ${all.length} صورة`, 'success');
  } catch {
    showToast('خطأ في تصدير الصور', 'error');
  }
}

async function importImages(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const records = JSON.parse(e.target.result);
      if (!Array.isArray(records)) throw new Error('invalid');
      await ImageStore.importAll(records);
      showToast(`✅ تم استيراد ${records.length} صورة`, 'success');
      refreshImageBadges();
    } catch {
      showToast('❌ ملف الصور غير صالح', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}