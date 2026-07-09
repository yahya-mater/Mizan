/* ═══════════════════════════════════════════════════════════════
   imagestore.js — ميزان
   IndexedDB image storage with canvas compression.
   All operations are async and return Promises.
═══════════════════════════════════════════════════════════════ */

'use strict';

const ImageStore = (() => {

  const DB_NAME    = 'mizan_images';
  const DB_VERSION = 1;
  const STORE_NAME = 'images';

  const MAX_FULL    = 800;  // px — max dimension for stored image
  const MAX_THUMB   = 120;  // px — max dimension for thumbnail
  const QUALITY     = 0.72; // webp/jpeg compression quality
  const FORMAT      = 'image/webp'; // falls back to jpeg if unsupported

  /* ── DB init ─────────────────────────────────────────────── */
  let _db = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db    = e.target.result;
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('txId', 'txId', { unique: false });
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  /* ── Canvas compression ──────────────────────────────────── */

  /**
   * Loads a File/Blob into an HTMLImageElement.
   */
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('فشل تحميل الصورة')); };
      img.src = url;
    });
  }

  /**
   * Draws an image onto a canvas, scaled to fit within maxDim × maxDim.
   * Returns a Blob of the compressed image.
   */
  function compressToBlob(img, maxDim, quality, format) {
    const ratio  = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1);
    const w      = Math.round(img.naturalWidth  * ratio);
    const h      = Math.round(img.naturalHeight * ratio);

    const canvas    = document.createElement('canvas');
    canvas.width    = w;
    canvas.height   = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('فشل ضغط الصورة')),
        format,
        quality
      );
    });
  }

  /**
   * Converts a Blob to a base64 data URL string (for easy display).
   */
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader  = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /* ── Public API ──────────────────────────────────────────── */

  /**
   * Save an image attached to a transaction.
   * @param {number} txId       — transaction ID
   * @param {File}   file       — the uploaded File object
   * @param {string} [label]    — optional user label
   * @returns {Promise<number>} — the new imageId
   */
  async function save(txId, file, label = '') {
    const db  = await openDB();
    const img = await loadImage(file);

    // Determine output format (webp preferred, jpeg fallback)
    const fmt = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      return c.toDataURL('image/webp').startsWith('data:image/webp')
        ? 'image/webp' : 'image/jpeg';
    })();

    const [fullBlob, thumbBlob] = await Promise.all([
      compressToBlob(img, MAX_FULL,  QUALITY, fmt),
      compressToBlob(img, MAX_THUMB, QUALITY, fmt),
    ]);

    const [fullDataUrl, thumbDataUrl] = await Promise.all([
      blobToDataURL(fullBlob),
      blobToDataURL(thumbBlob),
    ]);

    const record = {
      txId,
      label,
      date:      new Date().toISOString(),
      mimeType:  fmt,
      size:      fullBlob.size,
      fullData:  fullDataUrl,
      thumbData: thumbDataUrl,
    };

    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).add(record);
      req.onsuccess = e => resolve(e.target.result); // returns new id
      req.onerror   = e => reject(e.target.error);
    });
  }

  /**
   * Get all image metadata + thumbnails for a transaction.
   * Full image data is NOT included (use getOne for that).
   * @param {number} txId
   * @returns {Promise<Array<{id, txId, label, date, size, thumbData}>>}
   */
  async function getAll(txId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE_NAME, 'readonly');
      const idx     = tx.objectStore(STORE_NAME).index('txId');
      const req     = idx.getAll(txId);
      req.onsuccess = e => resolve(
        e.target.result.map(r => ({
          id:        r.id,
          txId:      r.txId,
          label:     r.label,
          date:      r.date,
          size:      r.size,
          mimeType:  r.mimeType,
          thumbData: r.thumbData,
        }))
      );
      req.onerror = e => reject(e.target.error);
    });
  }

  /**
   * Get one image record including full image data.
   * @param {number} imageId
   * @returns {Promise<object>}
   */
  async function getOne(imageId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE_NAME, 'readonly');
      const req     = tx.objectStore(STORE_NAME).get(imageId);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  /**
   * Count images for a transaction (lightweight — no data fetched).
   * @param {number} txId
   * @returns {Promise<number>}
   */
  async function count(txId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE_NAME, 'readonly');
      const idx     = tx.objectStore(STORE_NAME).index('txId');
      const req     = idx.count(txId);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  /**
   * Count images for multiple txIds in one pass.
   * Returns a Map<txId, count>.
   * @param {number[]} txIds
   * @returns {Promise<Map<number,number>>}
   */
  async function countMany(txIds) {
    const db  = await openDB();
    const map = new Map(txIds.map(id => [id, 0]));
    const idSet = new Set(txIds);
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).index('txId').openCursor();
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (!cursor) { resolve(map); return; }
        if (idSet.has(cursor.value.txId)) {
          map.set(cursor.value.txId, (map.get(cursor.value.txId) || 0) + 1);
        }
        cursor.continue();
      };
      req.onerror = e => reject(e.target.error);
    });
  }

  /**
   * Update label of an image.
   * @param {number} imageId
   * @param {string} label
   */
  async function updateLabel(imageId, label) {
    const db  = await openDB();
    const rec = await getOne(imageId);
    if (!rec) return;
    rec.label = label;
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(rec);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  /**
   * Delete a single image.
   * @param {number} imageId
   */
  async function deleteOne(imageId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(imageId);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  /**
   * Delete all images for a transaction.
   * @param {number} txId
   */
  async function deleteAllForTx(txId) {
    const db      = await openDB();
    const records = await getAll(txId);
    if (records.length === 0) return;
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      records.forEach(r => store.delete(r.id));
      tx.oncomplete = () => resolve();
      tx.onerror    = e => reject(e.target.error);
    });
  }

  /**
   * Export all images as a JSON-serialisable array.
   * Includes full image data — use for backup/export.
   * @returns {Promise<Array>}
   */
  async function exportAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  /**
   * Import images from an exportAll() array.
   * Existing records are NOT cleared — use for merge import.
   * @param {Array} records
   */
  async function importAll(records) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      records.forEach(r => {
        // Strip the auto-increment id so IndexedDB assigns a new one
        const { id, ...rest } = r;
        store.add(rest);
      });
      tx.oncomplete = () => resolve();
      tx.onerror    = e => reject(e.target.error);
    });
  }

  /* ── Expose public API ───────────────────────────────────── */
  return {
    save,
    getAll,
    getOne,
    count,
    countMany,
    updateLabel,
    deleteOne,
    deleteAllForTx,
    exportAll,
    importAll,
  };

})();