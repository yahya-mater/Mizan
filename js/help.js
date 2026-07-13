/* ═══════════════════════════════════════════════════════════════
   help.js — ميزان
   Onboarding / product tour (coachmarks) + contextual help icons
   (tooltips) + inline microcopy injection.

   Pure vanilla JS, no dependencies. Reuses the app's existing
   look & feel (Tajawal font, orange accent, RTL). Safe to include
   after ui.js — uses switchTab() if present, but degrades fine
   without it.

   HOW TO EXTEND
   ─────────────
   • Tour steps:  add an entry to TOUR_STEPS below.
   • Help icons:  add  <span class="help-icon" data-help="...">ⓘ</span>
                  anywhere in the HTML — it is wired automatically.
   • Microcopy:   add an entry to MICROCOPY below (id + text), or just
                  write the <p class="field-hint"> markup by hand.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   1) PRODUCT TOUR / GUIDED WALKTHROUGH
   ───────────────────────────────────────────────────────────── */

const TOUR_STORAGE_KEY = 'mizan_tour_done';

/* Each step: target (CSS selector), title, text, and optional tab
   to switch to first (matches the app's switchTab('...') tabs). */
const TOUR_STEPS = [
  {
    target: '#nav-archive',
    tab:    'archive',
    title:  'الأرشيف',
    text:   'هذه هي الصفحة الرئيسية. تجد هنا سجلاً بكل المعاملات المالية التي أدخلتها، مع إحصائيات سريعة أعلى الصفحة.'
  },
  {
    target: '#nav-wizard',
    title:  'معاملة جديدة',
    text:   'من هنا تبدأ إدخال أي معاملة جديدة: فاتورة، سلفة صندوق، أو قيد يومية — خطوة بخطوة.'
  },
  {
    target: '#nav-reports',
    title:  'خلاصة صندوق يومية',
    text:   'تقرير شهري جاهز للطباعة يلخص كل معاملات الشهر المختار.'
  },
  {
    target: '#nav-ledger',
    title:  'صندوق يومية',
    text:   'سجل صندوق اليومية الرسمي — يُبنى تلقائياً من معاملاتك ويمكن طباعته مباشرة.'
  },
  {
    target: '#nav-devledger',
    title:  'صندوق التطوير',
    text:   'سجل مستقل خاص بمنحة التطوير المدرسي وبنودها.'
  },
  {
    target: '#nav-export',
    title:  'التصدير الجماعي',
    text:   'صدّر وثائقك دفعة واحدة — يُبنى تلقائياً من معاملاتك ويمكن طباعته مباشرة.'
  },
  {
    target: '#nav-settings',
    tab:    'settings',
    title:  'الإعدادات',
    text:   'أدخل بيانات المدرسة، مدير المدرسة، أعضاء اللجنة، والحد الأقصى لسلفة الصندوق من هنا. يُفضّل تعبئتها أولاً.'
  },
  {
    target: '#s-salfa-max',
    tab:    'settings',
    title:  'سلفة الصندوق',
    text:   'حدّد الحد الأقصى لسلفة الصندوق حسب حجم مدرستك. عند اختيار «نقداً» في فاتورة، تُضاف تلقائياً إلى السلفة المفتوحة حتى تمتلئ.'
  },
  {
    target: '#btn-help-tour',//'#header-avatar',
    title:  'وصلت للنهاية 🎉',
    text:   'يمكنك إعادة هذه الجولة في أي وقت بالضغط على زر المساعدة (؟) أعلى الصفحة. ابحث أيضاً عن أيقونات ⓘ بجانب الحقول للمزيد من الشرح.'
  },
];

let _tourIndex   = 0;
let _tourEls     = null; // { overlayPieces, tooltip }
let _tourResizeHandlerBound = null;

function _tourBuildOverlay() {
  const wrap = document.createElement('div');
  wrap.id = 'tour-overlay';
  wrap.setAttribute('aria-hidden', 'true');
  // four dimming panels around the highlighted hole + the tooltip card
  wrap.innerHTML = `
    <div class="tour-mask tour-mask-top"></div>
    <div class="tour-mask tour-mask-bottom"></div>
    <div class="tour-mask tour-mask-right"></div>
    <div class="tour-mask tour-mask-left"></div>
    <div class="tour-hole-ring"></div>
    <div class="tour-tooltip" role="dialog" aria-live="polite">
      <div class="tour-tooltip-title"></div>
      <div class="tour-tooltip-text"></div>
      <div class="tour-tooltip-footer">
        <div class="tour-progress"></div>
        <div class="tour-actions">
          <button type="button" class="tour-btn-skip">تخطي</button>
          <button type="button" class="tour-btn-back">السابق</button>
          <button type="button" class="tour-btn-next">التالي</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  wrap.querySelector('.tour-btn-skip').addEventListener('click', endTour);
  wrap.querySelector('.tour-btn-back').addEventListener('click', () => _tourGo(_tourIndex - 1));
  wrap.querySelector('.tour-btn-next').addEventListener('click', () => _tourGo(_tourIndex + 1));

  return wrap;
}

function _tourPosition(target) {
  const overlay = document.getElementById('tour-overlay');
  if (!overlay || !target) return;
  const r = target.getBoundingClientRect();
  const pad = 8;

  const top    = overlay.querySelector('.tour-mask-top');
  const bottom = overlay.querySelector('.tour-mask-bottom');
  const right  = overlay.querySelector('.tour-mask-right');
  const left   = overlay.querySelector('.tour-mask-left');
  const ring   = overlay.querySelector('.tour-hole-ring');

  const holeTop    = Math.max(r.top - pad, 0);
  const holeLeft   = Math.max(r.left - pad, 0);
  const holeRight  = r.right + pad;
  const holeBottom = r.bottom + pad;

  top.style.cssText    = `top:0; left:0; right:0; height:${holeTop}px;`;
  bottom.style.cssText = `top:${holeBottom}px; left:0; right:0; bottom:0;`;
  left.style.cssText   = `top:${holeTop}px; left:0; width:${holeLeft}px; height:${holeBottom - holeTop}px;`;
  right.style.cssText  = `top:${holeTop}px; left:${holeRight}px; right:0; height:${holeBottom - holeTop}px;`;
  ring.style.cssText   = `top:${holeTop}px; left:${holeLeft}px; width:${holeRight - holeLeft}px; height:${holeBottom - holeTop}px;`;

  // Tooltip card: try below target, flip above if not enough room, clamp to viewport.
  const tip = overlay.querySelector('.tour-tooltip');
  tip.style.visibility = 'hidden';
  tip.style.left = '0px'; tip.style.top = '0px';
  const tw = tip.offsetWidth  || 320;
  const th = tip.offsetHeight || 140;

  let top_ = holeBottom + 14;
  if (top_ + th > window.innerHeight - 12) {
    top_ = holeTop - th - 14;
    if (top_ < 12) top_ = Math.min(Math.max(window.innerHeight - th - 12, 12), holeTop - th - 14 > 0 ? holeTop - th - 14 : 12);
  }
  let left_ = r.left; // RTL: align to the visual start of the target
  if (left_ + tw > window.innerWidth - 12) left_ = window.innerWidth - tw - 12;
  if (left_ < 12) left_ = 12;

  tip.style.top  = `${Math.max(top_, 12)}px`;
  tip.style.left = `${left_}px`;
  tip.style.visibility = 'visible';
}

function _tourGo(index) {
  if (index < 0) return;
  if (index >= TOUR_STEPS.length) { endTour(); return; }

  _tourIndex = index;
  const step = TOUR_STEPS[index];

  const proceed = () => {
    const target = document.querySelector(step.target);
    const overlay = document.getElementById('tour-overlay');
    if (!target || !overlay) { _tourGo(index + 1); return; } // skip missing targets gracefully

    overlay.querySelector('.tour-tooltip-title').textContent = step.title;
    overlay.querySelector('.tour-tooltip-text').textContent  = step.text;
    overlay.querySelector('.tour-progress').textContent = `${index + 1} / ${TOUR_STEPS.length}`;
    overlay.querySelector('.tour-btn-back').style.visibility = index === 0 ? 'hidden' : 'visible';
    overlay.querySelector('.tour-btn-next').textContent = (index === TOUR_STEPS.length - 1) ? 'إنهاء' : 'التالي';

    target.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'instant' : 'auto' });
    requestAnimationFrame(() => _tourPosition(target));
  };

  if (step.tab && typeof switchTab === 'function') {
    switchTab(step.tab);
    setTimeout(proceed, 60); // let the tab render before measuring
  } else {
    proceed();
  }
}

function startTour() {
  endTour(); // clean any previous instance
  document.body.classList.add('tour-active');
  _tourBuildOverlay();
  _tourIndex = 0;

  _tourResizeHandlerBound = () => {
    const step = TOUR_STEPS[_tourIndex];
    const target = step && document.querySelector(step.target);
    if (target) _tourPosition(target);
  };
  window.addEventListener('resize', _tourResizeHandlerBound);
  window.addEventListener('scroll', _tourResizeHandlerBound, true);

  document.addEventListener('keydown', _tourKeydown);

  _tourGo(0);
}

function _tourKeydown(e) {
  if (e.key === 'Escape') endTour();
  if (e.key === 'ArrowLeft')  _tourGo(_tourIndex + 1); // RTL: left = forward
  if (e.key === 'ArrowRight') _tourGo(_tourIndex - 1);
}

function endTour() {
  const overlay = document.getElementById('tour-overlay');
  if (overlay) overlay.remove();
  document.body.classList.remove('tour-active');
  document.removeEventListener('keydown', _tourKeydown);
  if (_tourResizeHandlerBound) {
    window.removeEventListener('resize', _tourResizeHandlerBound);
    window.removeEventListener('scroll', _tourResizeHandlerBound, true);
    _tourResizeHandlerBound = null;
  }
  localStorage.setItem(TOUR_STORAGE_KEY, '1');
}

/* Manually replay the tour (wire to a "?" button in the header). */
function restartTour() {
  startTour();
}

/* ─────────────────────────────────────────────────────────────
   2) CONTEXTUAL HELP ICONS / TOOLTIPS
   Any element written as:
     <span class="help-icon" data-help="شرح مختصر هنا">ⓘ</span>
   gets hover/focus/tap behaviour automatically — no extra JS needed
   per-icon. Only one bubble is open at a time.
   ───────────────────────────────────────────────────────────── */

let _activeHelpBubble = null;

function _closeHelpBubble() {
  if (_activeHelpBubble) {
    _activeHelpBubble.remove();
    _activeHelpBubble = null;
  }
}

function _openHelpBubble(icon) {
  _closeHelpBubble();
  const text = icon.getAttribute('data-help');
  if (!text) return;

  const bubble = document.createElement('div');
  bubble.className = 'help-bubble';
  bubble.setAttribute('role', 'tooltip');
  bubble.textContent = text;
  document.body.appendChild(bubble);

  const r  = icon.getBoundingClientRect();
  const bw = bubble.offsetWidth;
  const bh = bubble.offsetHeight;

  let left = r.left + r.width / 2 - bw / 2;
  left = Math.min(Math.max(left, 10), window.innerWidth - bw - 10);

  let top = r.top - bh - 10;
  let arrowBelow = true;
  if (top < 10) { top = r.bottom + 10; arrowBelow = false; }

  bubble.style.left = `${left}px`;
  bubble.style.top  = `${top}px`;
  bubble.classList.add(arrowBelow ? 'help-bubble-arrow-bottom' : 'help-bubble-arrow-top');
  bubble.style.setProperty('--arrow-left', `${(r.left + r.width / 2 - left)}px`);

  _activeHelpBubble = bubble;
}

function initHelpIcons() {
  document.body.addEventListener('mouseenter', e => {
    const icon = e.target.closest ? e.target.closest('.help-icon') : null;
    if (icon) _openHelpBubble(icon);
  }, true);

  document.body.addEventListener('mouseleave', e => {
    const icon = e.target.closest ? e.target.closest('.help-icon') : null;
    if (icon) _closeHelpBubble();
  }, true);

  document.body.addEventListener('focusin', e => {
    const icon = e.target.closest ? e.target.closest('.help-icon') : null;
    if (icon) _openHelpBubble(icon);
  });

  document.body.addEventListener('focusout', e => {
    const icon = e.target.closest ? e.target.closest('.help-icon') : null;
    if (icon) _closeHelpBubble();
  });

  // Tap support (touch devices don't reliably fire hover)
  document.body.addEventListener('click', e => {
    const icon = e.target.closest ? e.target.closest('.help-icon') : null;
    if (icon) {
      e.stopPropagation();
      if (_activeHelpBubble) _closeHelpBubble();
      else _openHelpBubble(icon);
      return;
    }
    _closeHelpBubble();
  });

  window.addEventListener('scroll', _closeHelpBubble, true);
  window.addEventListener('resize', _closeHelpBubble);

  // Make icons keyboard-accessible
  document.querySelectorAll('.help-icon').forEach(icon => {
    if (!icon.hasAttribute('tabindex')) icon.setAttribute('tabindex', '0');
    if (!icon.hasAttribute('role')) icon.setAttribute('role', 'button');
    if (!icon.hasAttribute('aria-label')) icon.setAttribute('aria-label', 'مساعدة');
  });
}

/* ─────────────────────────────────────────────────────────────
   3) INLINE MICROCOPY
   Short explanatory text injected right under a field/button.
   Add { id, text } pairs below — "id" is the target element's id,
   and the hint is appended immediately after it (skipped if a
   .field-hint already exists right after that element).
   ───────────────────────────────────────────────────────────── */

const MICROCOPY = [
  { id: 's-school-nid',       text: 'كما هو مسجل لدى وزارة التربية والتعليم — يظهر في جميع المستندات الرسمية.' },
  { id: 'f-nid',               text: 'الرقم الوطني المكوّن من 10 رقماً كما يظهر على الهوية الشخصية.' },
  { id: 'f-invoice-no',        text: 'الرقم الظاهر على فاتورة المورد نفسها، وليس رقم الفاتورة الداخلي.' },
];

function injectMicrocopy() {
  MICROCOPY.forEach(({ id, text }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const next = el.nextElementSibling;
    if (next && next.classList && next.classList.contains('field-hint')) return; // already there
    const p = document.createElement('p');
    p.className = 'field-hint';
    p.textContent = text;
    el.insertAdjacentElement('afterend', p);
  });
}

/* ─────────────────────────────────────────────────────────────
   4) HEADER HELP BUTTON
   Injects a small "؟" button into the top header (once) that lets
   the user replay the walkthrough at any time.
   ───────────────────────────────────────────────────────────── */

function injectHelpButton() {
  if (document.getElementById('btn-help-tour')) return;
  const header = document.getElementById('header-actions');
  if (!header) return;

  const btn = document.createElement('button');
  btn.id = 'btn-help-tour';
  btn.title = 'إعادة الجولة التعريفية';
  btn.setAttribute('aria-label', 'المساعدة والجولة التعريفية');
  btn.className = 'help-header-btn';
  btn.textContent = '؟';
  btn.addEventListener('click', restartTour);

  header.insertBefore(btn, header.firstChild);
}

/* ─────────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initHelpIcons();
  injectMicrocopy();
  injectHelpButton();

  // Auto-start the walkthrough once, for genuinely new users only —
  // mirrors the first-run check already used in state.js.
  const isFirstRun = !localStorage.getItem('mizan_state');
  const tourAlreadyDone = localStorage.getItem(TOUR_STORAGE_KEY);
  if (isFirstRun && !tourAlreadyDone) {
    setTimeout(startTour, 500); // let the rest of the app finish rendering first
  }
});