/* ═══════════════════════════════════════════════════════════════
   config.js — ميزان
   Single source of truth for all constants, lookup tables, and
   static data. Every other module imports from here.
   If you need to add a transaction type, a document, a month
   name, or a colour — this is the ONLY place to touch.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Currency ─────────────────────────────────────────────── */
const FILS_PER_DINAR = 1000;

/* ── Arabic month names (1-indexed, index 0 is unused) ─────── */
const ARABIC_MONTHS = [
  '',
  'كانون الثاني', 'شباط',       'آذار',
  'نيسان',        'أيار',        'حزيران',
  'تموز',         'آب',          'أيلول',
  'تشرين الأول',  'تشرين الثاني','كانون الأول',
];

/* ── Dev-grant fields ─────────────────────────────────────── */
const DEV_GRANT_KEYS = ['learning', 'maintenance', 'partnership', 'supplies', 'excellence'];
const DEV_GRANT_LABELS = {
  learning:    'مجتمعات التعلم المهنية',
  maintenance: 'الصيانة الحقيقية',
  partnership: 'توطيد الشراكة مع المجتمع المحلي',
  supplies:    'لوازم التعلم',
  excellence:  'تشجيع التميز والابداع',
};

/* ── Transaction type display metadata ───────────────────── */
// Used in archive badges, reports, review step, etc.
const TRANSACTION_TYPE_META = {
  advance:       { label: 'سلفة',              badgeClass: 'badge-orange'                                         },
  invoice:       { label: 'فاتورة (شيك)',      badgeClass: 'badge-blue'                                           },
  claim:         { label: 'مطالبة (شيك)',      badgeClass: 'badge-green'                                          },
  invoice_cash:  { label: 'فاتورة (نقد)',      badgeClass: '', badgeStyle: 'background:#dbeafe;color:#1e40af;'    },
  claim_cash:    { label: 'مطالبة (نقد)',      badgeClass: '', badgeStyle: 'background:#dcfce7;color:#166534;'    },
  journal:       { label: 'سند قيد',           badgeClass: '', badgeStyle: 'background:#f3e8ff;color:#7c3aed;'    },
  salfa:         { label: 'سلفة صندوق',        badgeClass: 'badge-orange'                                         },
  salfa_yad:     { label: 'سلفة مدير (يد)', badgeClass: 'badge-orange' },
};

/* ── Documents available per transaction type ────────────── */
// id    → key used by docBuilders map in documents.js
// label → shown in modal checkbox list
// icon  → emoji prefix
// color → Tailwind classes for the checkbox card
const ALL_DOCS = {
  advance: [
    { id: 'decision',     label: 'مستند قرار صرف',             icon: '📋', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { id: 'disbursement', label: 'مستند صرف تبرعات مدرسية',     icon: '💰', color: 'bg-amber-50 border-amber-200 text-amber-700'   },
  ],
  invoice: [
    { id: 'local',        label: 'نموذج مشترى محلي',            icon: '🛒', color: 'bg-blue-50 border-blue-200 text-blue-700'       },
    { id: 'decision',     label: 'مستند قرار صرف',             icon: '📋', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { id: 'disbursement', label: 'مستند صرف تبرعات مدرسية',     icon: '💰', color: 'bg-amber-50 border-amber-200 text-amber-700'   },
  ],
  invoice_cash: [
    { id: 'local',        label: 'نموذج مشترى محلي',            icon: '🛒', color: 'bg-blue-50 border-blue-200 text-blue-700'       },
    { id: 'decision',     label: 'مستند قرار صرف',             icon: '📋', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { id: 'disbursement', label: 'مستند صرف تبرعات مدرسية',     icon: '💰', color: 'bg-amber-50 border-amber-200 text-amber-700'   },
  ],
  claim: [
    { id: 'claim',        label: 'نموذج مطالبة مالية',          icon: '👤', color: 'bg-green-50 border-green-200 text-green-700'    },
    { id: 'local',        label: 'نموذج مشترى محلي',            icon: '🛒', color: 'bg-blue-50 border-blue-200 text-blue-700'       },
    { id: 'decision',     label: 'مستند قرار صرف',             icon: '📋', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { id: 'disbursement', label: 'مستند صرف تبرعات مدرسية',     icon: '💰', color: 'bg-amber-50 border-amber-200 text-amber-700'   },
  ],
  claim_cash: [
    { id: 'claim',        label: 'نموذج مطالبة مالية',          icon: '👤', color: 'bg-green-50 border-green-200 text-green-700'    },
    { id: 'local',        label: 'نموذج مشترى محلي',            icon: '🛒', color: 'bg-blue-50 border-blue-200 text-blue-700'       },
    { id: 'decision',     label: 'مستند قرار صرف',             icon: '📋', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { id: 'disbursement', label: 'مستند صرف تبرعات مدرسية',     icon: '💰', color: 'bg-amber-50 border-amber-200 text-amber-700'   },
  ],
  journal: [
    { id: 'journal',      label: 'سند قيد التبرعات المدرسية',   icon: '📒', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  ],
  salfa: [
    { id: 'decision',     label: 'مستند قرار صرف',          icon: '📋', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { id: 'disbursement', label: 'مستند صرف تبرعات مدرسية',  icon: '💰', color: 'bg-amber-50 border-amber-200 text-amber-700'   },
    { id: 'salfabook',    label: 'دفتر صندوق سلفات',         icon: '📔', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  ],
  salfa_yad: [
    { id: 'decision',     label: 'مستند قرار صرف',         icon: '📋', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { id: 'disbursement', label: 'مستند صرف تبرعات مدرسية', icon: '💰', color: 'bg-amber-50 border-amber-200 text-amber-700'   },
  ],
};

// Add alongside ALL_DOCS — documents available per salfaRow
const SALFA_ROW_DOCS = [
  { id: 'local', label: 'نموذج مشترى محلي', icon: '🛒', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: 'claim', label: 'نموذج مطالبة مالية', icon: '👤', color: 'bg-green-50 border-green-200 text-green-700' },
];

// Shorter document labels used in archive row (doc pills column)
const ARCHIVE_DOC_LABELS = {
  advance:      ['قرار صرف', 'مستند صرف'],
  invoice:      ['مشترى محلي', 'قرار صرف', 'مستند صرف'],
  invoice_cash: ['مشترى محلي', 'قرار صرف', 'مستند صرف'],
  claim:        ['مطالبة', 'مشترى محلي', 'قرار صرف', 'مستند صرف'],
  claim_cash:   ['مطالبة', 'مشترى محلي', 'قرار صرف', 'مستند صرف'],
  journal:      ['سند قيد'],
  salfa:        ['قرار صرف', 'مستند صرف', 'دفتر صندوق سلفات'],
  salfa_yad:    ['قرار صرف', 'مستند صرف'],
};

// Document colour classes used in review step and wherever doc pills appear
const DOC_COLOR_CLASSES = {
  'مستند قرار صرف':            'bg-orange-100 text-orange-700 border-orange-200',
  'مستند صرف تبرعات مدرسية':   'bg-amber-100 text-amber-700 border-amber-200',
  'نموذج مشترى محلي':           'bg-blue-100 text-blue-700 border-blue-200',
  'نموذج مطالبة مالية':         'bg-green-100 text-green-700 border-green-200',
  'سند قيد التبرعات المدرسية':  'bg-purple-100 text-purple-700 border-purple-200',
};

// Labels shown in the review step doc-list
const REVIEW_DOC_LABELS = {
  advance:      ['مستند قرار صرف', 'مستند صرف تبرعات مدرسية'],
  invoice:      ['نموذج مشترى محلي', 'مستند قرار صرف', 'مستند صرف تبرعات مدرسية'],
  invoice_cash: ['نموذج مشترى محلي', 'مستند قرار صرف', 'مستند صرف تبرعات مدرسية'],
  claim:        ['نموذج مطالبة مالية', 'نموذج مشترى محلي', 'مستند قرار صرف', 'مستند صرف تبرعات مدرسية'],
  claim_cash:   ['نموذج مطالبة مالية', 'نموذج مشترى محلي', 'مستند قرار صرف', 'مستند صرف تبرعات مدرسية'],
  journal:      ['سند قيد التبرعات المدرسية'],
  salfa:        ['مستند قرار صرف', 'مستند صرف تبرعات مدرسية', 'دفتر صندوق سلفات'],
};

/* ── Tab navigation metadata ─────────────────────────────── */
const TAB_TITLES = {
  archive:   ['الأرشيف',           'سجل جميع المعاملات المالية'],
  wizard:    ['معاملة جديدة',      'خطوات إنشاء وإصدار مستند مالي'],
  reports:   ['خلاصة صندوق يومية', 'ملخص شهري لأرصدة الحسابات'],
  ledger:    ['صندوق يومية',       'دفتر اليومية المحاسبي التفصيلي'],
  settings:  ['الإعدادات',         'بيانات المدرسة واللجنة المالية'],
  devledger: ['صندوق التطوير',     'دفتر يومية حساب التطوير'],
};

// The nav tabs that exist in the sidebar — used to loop over them cleanly
const ALL_TABS = ['archive', 'wizard', 'reports', 'ledger', 'settings', 'devledger'];


/* ═══════════════════════════════════════════════════════════════
   TRANSACTION SCHEMAS
   Single source of truth for each transaction type.
   Every wizard function reads from here — no scattered show/hide.

   Schema fields:
     label          – human name shown in UI / archive badge
     recipientLabel – label text for f-recipient field (null = hidden)
     defaultAccounts – { from, to } pre-filled in account autocomplete
     skipStep2      – if true, wizard jumps from step 1 straight to step 3
     fields         – map of wrapper-element-id → { visible, required }
═══════════════════════════════════════════════════════════════ */
const TRANSACTION_SCHEMAS = {

  advance: {
    label:           'سلفة',
    recipientLabel:  'اسم المستفيد من السلفة',
    defaultAccounts: { from: 'التبرعات', to: 'السلفة' },
    skipStep2:       true,
    fields: {
      'recipient-wrapper':       { visible: true,  required: true  },
      'nid-wrapper':             { visible: false, required: false },
      'invoice-no-wrapper':      { visible: false, required: false },
      'invoice-date-wrapper':    { visible: false, required: false },
      'entry-doc-wrapper':       { visible: false, required: false },
      'entry-doc-date-wrapper':  { visible: false, required: false },
      'payment-method-wrapper':  { visible: true,  required: false },
      'check-fields-wrapper':    { visible: false, required: false },
      'advance-amount-wrapper':  { visible: true,  required: true  },
      'journal-amount-wrapper':  { visible: false, required: false },
      'dev-grant-field-wrapper': { visible: true,  required: false },
      'salfa-fields-wrapper':    { visible: false, required: false },
    },
  },

  invoice: {
    label:           'فاتورة',
    recipientLabel:  'اسم المورد / الجهة البائعة',
    defaultAccounts: { from: 'التبرعات', to: 'البنك' },
    skipStep2:       false,
    fields: {
      'recipient-wrapper':       { visible: true,  required: true  },
      'nid-wrapper':             { visible: true, required: false },
      'invoice-no-wrapper':      { visible: true,  required: false },
      'invoice-date-wrapper':    { visible: true,  required: false },
      'entry-doc-wrapper':       { visible: true,  required: false },
      'entry-doc-date-wrapper':  { visible: true,  required: false },
      'payment-method-wrapper':  { visible: true,  required: false },
      'check-fields-wrapper':    { visible: false, required: false },
      'advance-amount-wrapper':  { visible: false, required: false },
      'journal-amount-wrapper':  { visible: false, required: false },
      'dev-grant-field-wrapper': { visible: true,  required: false },
      'salfa-fields-wrapper':    { visible: false, required: false },
    },
  },

  claim: {
    label:           'مطالبة مالية',
    recipientLabel:  'اسم مقدم المطالبة',
    defaultAccounts: { from: 'التبرعات', to: 'البنك' },
    skipStep2:       false,
    fields: {
      'recipient-wrapper':       { visible: true,  required: true  },
      'nid-wrapper':             { visible: true,  required: false },
      'invoice-no-wrapper':      { visible: true,  required: false },
      'invoice-date-wrapper':    { visible: true,  required: false },
      'entry-doc-wrapper':       { visible: true,  required: false },
      'entry-doc-date-wrapper':  { visible: true,  required: false },
      'payment-method-wrapper':  { visible: true,  required: false },
      'check-fields-wrapper':    { visible: false, required: false },
      'advance-amount-wrapper':  { visible: false, required: false },
      'journal-amount-wrapper':  { visible: false, required: false },
      'dev-grant-field-wrapper': { visible: true,  required: false },
      'salfa-fields-wrapper':    { visible: false, required: false },
    },
  },

  journal: {
    label:           'سند قيد',
    recipientLabel:  null,
    defaultAccounts: { from: '', to: '' },
    skipStep2:       true,
    fields: {
      'recipient-wrapper':       { visible: false, required: false },
      'nid-wrapper':             { visible: false, required: false },
      'invoice-no-wrapper':      { visible: false, required: false },
      'invoice-date-wrapper':    { visible: false, required: false },
      'entry-doc-wrapper':       { visible: false, required: false },
      'entry-doc-date-wrapper':  { visible: false, required: false },
      'payment-method-wrapper':  { visible: false, required: false },
      'check-fields-wrapper':    { visible: false, required: false },
      'advance-amount-wrapper':  { visible: false, required: false },
      'journal-amount-wrapper':  { visible: true,  required: true  },
      'dev-grant-field-wrapper': { visible: true,  required: false },
      'salfa-fields-wrapper':    { visible: false, required: false },
    },
  },

  salfa_yad: {
    label:           'سلفة مدير (يد)',
    recipientLabel:  null,
    defaultAccounts: { from: 'البنك', to: 'السلفة' },
    skipStep2:       true,
    fields: {
      'recipient-wrapper':       { visible: false, required: false },
      'nid-wrapper':             { visible: false, required: false },
      'invoice-no-wrapper':      { visible: false, required: false },
      'invoice-date-wrapper':    { visible: false, required: false },
      'entry-doc-wrapper':       { visible: false, required: false },
      'entry-doc-date-wrapper':  { visible: false, required: false },
      'payment-method-wrapper':  { visible: false, required: false },
      'check-fields-wrapper':    { visible: true,  required: false },
      'advance-amount-wrapper':  { visible: false, required: false },
      'journal-amount-wrapper':  { visible: false, required: false },
      'dev-grant-field-wrapper': { visible: false, required: false },
      'salfa-fields-wrapper':    { visible: false, required: false },
    },
  },

};

/* ── Salfa max presets ─────────────────────────────────── */
const SALFA_MAX_PRESETS = [
  { label: 'مدرسة صغيرة (75 د.أ)',  value: 75  },
  { label: 'مدرسة كبيرة (150 د.أ)', value: 150 },
];

/* ── Default opening-balance accounts ───────────────────────
   Stored here so state.js and settings.js can both reference
   the same seed data without re-declaring it.
────────────────────────────────────────────────────────────── */
const DEFAULT_ACCOUNTS = [
  { key: 'fund', name: 'الصندوق',      color: '#d97706', balanceFrom: 0, balanceTo: 0 },
  { key: 'bank', name: 'البنك',        color: '#2563eb', balanceFrom: 0, balanceTo: 0 },
  { key: 'don',  name: 'التبرعات',     color: '#16a34a', balanceFrom: 0, balanceTo: 0 },
  { key: 'red',  name: 'الهلال الأحمر', color: '#dc2626', balanceFrom: 0, balanceTo: 0 },
  { key: 'adv',  name: 'السلفة',       color: '#f97316', balanceFrom: 0, balanceTo: 0 },
  { key: 'dev',  name: 'التطوير',        color: '#7c3aed', balanceFrom: 0, balanceTo: 0, excludeFromLedger: true },
];