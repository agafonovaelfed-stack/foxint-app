/* Foxint AI — Features v2 (fix pack) */
window._fx = window._fx || {};

(function(){
'use strict';

/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */
const FEAT = {
  font: localStorage.getItem('foxint.font') || 'inter',
  accent: localStorage.getItem('foxint.accent') || '',
  sound: localStorage.getItem('foxint.sound') !== '0',
  persona: localStorage.getItem('foxint.persona') || 'default',
  lang: localStorage.getItem('foxint.lang') || 'ru',
  cot: localStorage.getItem('foxint.cot') === '1',
  typing: localStorage.getItem('foxint.typing') !== '0',
  refId: localStorage.getItem('foxint.refId') || ''
};

/* =========================================================
   ШРИФТЫ — встроенные (без внешних загрузок, чтобы работали всегда)
   ========================================================= */
const FONTS = {
  inter:   { name: 'Inter',     stack: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
  system:  { name: 'Системный', stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif" },
  georgia: { name: 'Серифный',  stack: "Georgia, 'Times New Roman', Times, serif" },
  mono:    { name: 'Моно',      stack: "ui-monospace, 'SF Mono', Monaco, Consolas, monospace" },
  rounded: { name: 'Скругл.',   stack: "'SF Pro Rounded', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif" }
};

function applyFont(id){
  const f = FONTS[id] || FONTS.inter;
  document.body.style.setProperty('font-family', f.stack, 'important');
  // Плюс инжектим глобально
  let styleEl = document.getElementById('fxFontStyle');
  if (!styleEl){
    styleEl = document.createElement('style');
    styleEl.id = 'fxFontStyle';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    html, body, button, input, textarea, select, .bubble, .msg-bubble, .sidebar, .settings {
      font-family: ${f.stack} !important;
    }
  `;
  FEAT.font = id;
  localStorage.setItem('foxint.font', id);
}

/* =========================================================
   АКЦЕНТ — применяем КО ВСЕЙ ПАЛИТРЕ, а не только --accent
   ========================================================= */
function hexToRgb(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { r: 91, g: 141, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function applyAccent(hex){
  const root = document.documentElement;
  if (!hex){
    ['--accent','--accent-soft','--accent-glow','--coral','--coral-soft','--coral-glow','--user-grad'].forEach(v => root.style.removeProperty(v));
  } else {
    const rgb = hexToRgb(hex);
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-soft', `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`);
    root.style.setProperty('--accent-glow', `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`);
    root.style.setProperty('--coral', hex);
    root.style.setProperty('--coral-soft', `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`);
    root.style.setProperty('--coral-glow', `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`);
    root.style.setProperty('--user-grad', `linear-gradient(135deg, ${hex} 0%, ${shadeHex(hex, -30)} 100%)`);
  }
  FEAT.accent = hex;
  localStorage.setItem('foxint.accent', hex);
}
function shadeHex(hex, percent){
  const num = parseInt(hex.replace('#',''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

/* =========================================================
   ЗВУКИ
   ========================================================= */
let audioCtx = null;
function ensureAudio(){
  if (!audioCtx){ try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playTone(freq, duration, type){
  if (!FEAT.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.value = 0.08;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration/1000);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + duration/1000);
}
const SOUNDS = {
  send:    () => { playTone(880, 60); setTimeout(() => playTone(1100, 60), 50); },
  receive: () => { playTone(660, 80); setTimeout(() => playTone(880, 100), 80); },
  error:   () => { playTone(300, 200, 'square'); },
  click:   () => { playTone(1200, 30); }
};

function showMiniToast(msg){
  let t = document.getElementById('fxToast');
  if (!t){
    t = document.createElement('div');
    t.id = 'fxToast'; t.className = 'fx-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* SVG иконки для настроек */
const ICONS = {
  persona: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  lang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>',
  font: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  color: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  typing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  cot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>',
  summary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h14"/></svg>',
  ref: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

/* =========================================================
   КАСТОМНЫЙ SELECT — вместо системного <select>
   ========================================================= */
function createCustomSelect(options, currentValue, onChange){
  const wrapper = document.createElement('div');
  wrapper.className = 'fx-select';
  const btn = document.createElement('button');
  btn.className = 'fx-select-btn';
  const label = document.createElement('span');
  label.className = 'fx-select-label';
  label.textContent = options[currentValue]?.name || '';
  const arrow = document.createElement('span');
  arrow.className = 'fx-select-arrow';
  arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>';
  btn.appendChild(label); btn.appendChild(arrow);
  wrapper.appendChild(btn);

  const menu = document.createElement('div');
  menu.className = 'fx-select-menu';
  Object.entries(options).forEach(([k, v]) => {
    const item = document.createElement('button');
    item.className = 'fx-select-item' + (k === currentValue ? ' active' : '');
    item.textContent = v.name;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      label.textContent = v.name;
      menu.querySelectorAll('.fx-select-item').forEach(it => it.classList.remove('active'));
      item.classList.add('active');
      wrapper.classList.remove('open');
      onChange(k);
    });
    menu.appendChild(item);
  });
  wrapper.appendChild(menu);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.fx-select.open').forEach(s => { if (s !== wrapper) s.classList.remove('open'); });
    wrapper.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) wrapper.classList.remove('open');
  });

  return wrapper;
}

/* =========================================================
   ЭКСПОРТ БАЗЫ
   ========================================================= */
window._fx.FEAT = FEAT;
window._fx.FONTS = FONTS;
window._fx.SOUNDS = SOUNDS;
window._fx.ICONS = ICONS;
window._fx.showMiniToast = showMiniToast;
window._fx.applyFont = applyFont;
window._fx.applyAccent = applyAccent;
window._fx.createCustomSelect = createCustomSelect;
window._fx.shadeHex = shadeHex;

console.log('[Foxint] База загружена');
})();

/* ============ Часть 2 ============ */
(function(){
'use strict';

const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const FEAT = window._fx.FEAT;
const showMiniToast = window._fx.showMiniToast;

function extractColorsFromText(text){
  const matches = String(text).match(/#[0-9a-fA-F]{6}\b/g) || [];
  return [...new Set(matches)].slice(0, 16);
}
function renderColorPalette(bubbleEl){
  if (!bubbleEl) return;
  const text = bubbleEl.textContent || '';
  const colors = extractColorsFromText(text);
  if (colors.length < 2) return;
  if (bubbleEl.querySelector('.color-palette')) return;
  const pal = document.createElement('div');
  pal.className = 'color-palette';
  colors.forEach(hex => {
    const sw = document.createElement('button');
    sw.className = 'color-swatch';
    sw.style.background = hex;
    sw.title = hex;
    sw.addEventListener('click', () => {
      navigator.clipboard.writeText(hex).then(() => {
        sw.classList.add('copied');
        showMiniToast('Скопировано ' + hex);
        setTimeout(() => sw.classList.remove('copied'), 600);
      });
    });
    pal.appendChild(sw);
  });
  bubbleEl.appendChild(pal);
}

function typeIn(el, html){
  if (!FEAT.typing){ el.innerHTML = html; return; }
  const temp = document.createElement('div');
  temp.innerHTML = html;
  el.innerHTML = '';
  const walk = (node, parent) => {
    if (node.nodeType === 3){
      const txt = node.textContent;
      for (let i = 0; i < txt.length; i++){
        const span = document.createElement('span');
        span.textContent = txt[i];
        span.style.opacity = '0';
        parent.appendChild(span);
      }
    } else {
      const clone = node.cloneNode(false);
      parent.appendChild(clone);
      node.childNodes.forEach(c => walk(c, clone));
    }
  };
  walk(temp, el);
  const spans = el.querySelectorAll('span');
  spans.forEach((s, i) => setTimeout(() => s.style.opacity = '1', i * 12));
}

function speakText(text){
  if (!('speechSynthesis' in window)){ showMiniToast('Озвучка не поддерживается'); return; }
  const clean = String(text).slice(0, 800);
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = FEAT.lang === 'ru' ? 'ru-RU' : FEAT.lang === 'en' ? 'en-US' : 'es-ES';
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

function addMessageActions(msgEl, role){
  if (!msgEl || role !== 'ai') return;
  const bubble = msgEl.querySelector('.msg-bubble');
  if (!bubble || bubble.dataset.actionsAdded) return;
  bubble.dataset.actionsAdded = '1';
  const actions = document.createElement('div');
  actions.className = 'msg-actions';
  actions.innerHTML = `
    <button class="msg-action" data-act="copy" title="Копировать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
    <button class="msg-action" data-act="regen" title="Заново"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
    <button class="msg-action" data-act="speak" title="Озвучить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
    <button class="msg-action" data-act="pin" title="Пришпилить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg></button>`;
  actions.querySelectorAll('.msg-action').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const act = btn.dataset.act;
      const plainText = bubble.innerText || '';
      if (act === 'copy'){ await navigator.clipboard.writeText(plainText); showMiniToast('Скопировано'); }
      else if (act === 'regen' && window.__foxint_regenerate) window.__foxint_regenerate();
      else if (act === 'speak') speakText(plainText);
      else if (act === 'pin'){ bubble.classList.toggle('pinned'); showMiniToast(bubble.classList.contains('pinned') ? 'Пришпилено' : 'Откреплено'); }
    });
  });
  bubble.appendChild(actions);
}

window._fx.renderColorPalette = renderColorPalette;
window._fx.typeIn = typeIn;
window._fx.addMessageActions = addMessageActions;
console.log('[Foxint] Часть 2 загружена');
})();

/* ============ Часть 3 ============ */
(function(){
'use strict';

const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const showMiniToast = window._fx.showMiniToast;

/* Редактирование user-сообщения */
function addEditToUserMessage(msgEl){
  if (!msgEl) return;
  const bubble = msgEl.querySelector('.msg-bubble');
  if (!bubble || bubble.dataset.editAdded) return;
  bubble.dataset.editAdded = '1';
  const btn = document.createElement('button');
  btn.className = 'msg-edit';
  btn.title = 'Редактировать';
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
  btn.addEventListener('click', () => editUserMessage(msgEl, bubble));
  bubble.appendChild(btn);
}
function editUserMessage(msgEl, bubble){
  const original = bubble.dataset.originalText || (bubble.innerText || '').trim();
  const modal = document.createElement('div');
  modal.className = 'fox-modal';
  modal.innerHTML = `<div class="fox-modal-panel"><div class="fox-modal-title">Редактировать сообщение</div><textarea class="fox-modal-textarea" id="editMsgInput">${esc(original)}</textarea><div class="fox-modal-actions"><button class="fox-modal-btn" data-act="cancel">Отмена</button><button class="fox-modal-btn primary" data-act="save">Сохранить и пересчитать</button></div></div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
  const close = () => { modal.classList.remove('show'); setTimeout(() => modal.remove(), 200); };
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  const ta = modal.querySelector('#editMsgInput');
  ta.focus();
  modal.querySelector('[data-act="cancel"]').addEventListener('click', close);
  modal.querySelector('[data-act="save"]').addEventListener('click', () => {
    const val = ta.value.trim();
    if (!val || val === original){ close(); return; }
    close();
    if (window.__foxint_editAndResend) window.__foxint_editAndResend(msgEl, val);
  });
}

/* Персоны */
const PERSONAS = {
  default:    { name: 'Обычный',    prompt: '' },
  detective:  { name: 'Детектив',   prompt: 'Отвечай как опытный детектив: сухо, по фактам, с гипотезами и вопросами для проверки.' },
  journalist: { name: 'Журналист',  prompt: 'Отвечай как журналист: цепляющие заголовки, суть в первом абзаце, дальше — детали и контекст.' },
  analyst:    { name: 'Аналитик',   prompt: 'Отвечай как аналитик: структура, списки, цифры, выводы, риски.' }
};

/* Языки */
const LANGS = {
  ru: { name: 'Русский', prompt: 'Отвечай на русском языке.' },
  en: { name: 'English', prompt: 'Always respond in English.' },
  es: { name: 'Español', prompt: 'Responde siempre en español.' }
};

/* Сводка диалога */
async function summarizeChat(){
  if (!window.__foxint_getChat || !window.__foxint_ask){ showMiniToast('Недоступно'); return; }
  const chat = window.__foxint_getChat();
  if (!chat || !chat.messages.length){ showMiniToast('Нечего суммировать'); return; }
  const text = chat.messages.slice(-20).map(m => `${m.role === 'user' ? 'Вы' : 'Foxint'}: ${String(m.content).slice(0, 300)}`).join('\n\n');
  const prompt = `Сожми этот диалог в 5 коротких пунктов. Только суть, без воды:\n\n${text}`;
  showMiniToast('Готовлю сводку...');
  try {
    const reply = await window.__foxint_ask(prompt);
    const modal = document.createElement('div');
    modal.className = 'fox-modal';
    modal.innerHTML = `<div class="fox-modal-panel"><div class="fox-modal-title">Сводка диалога</div><div class="fox-modal-text" style="white-space:pre-wrap">${esc(reply)}</div><div class="fox-modal-actions"><button class="fox-modal-btn" data-act="copy">Копировать</button><button class="fox-modal-btn primary" data-act="close">Закрыть</button></div></div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
    const close = () => { modal.classList.remove('show'); setTimeout(() => modal.remove(), 200); };
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('[data-act="close"]').addEventListener('click', close);
    modal.querySelector('[data-act="copy"]').addEventListener('click', () => { navigator.clipboard.writeText(reply); showMiniToast('Скопировано'); });
  } catch(e){ showMiniToast('Ошибка: ' + e.message); }
}

window._fx.addEditToUserMessage = addEditToUserMessage;
window._fx.PERSONAS = PERSONAS;
window._fx.LANGS = LANGS;
window._fx.summarizeChat = summarizeChat;
console.log('[Foxint] Часть 3 загружена');
})();

/* ============ Часть 4 ============ */
(function(){
'use strict';

const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const FEAT = window._fx.FEAT;
const FONTS = window._fx.FONTS;
const SOUNDS = window._fx.SOUNDS;
const ICONS = window._fx.ICONS;
const showMiniToast = window._fx.showMiniToast;
const applyFont = window._fx.applyFont;
const applyAccent = window._fx.applyAccent;
const createCustomSelect = window._fx.createCustomSelect;

/* PDF */
async function loadPdfJs(){
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function readPdf(file){
  const pdfjs = await loadPdfJs();
  const arrayBuf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 20); i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n\n';
  }
  return text.trim();
}
window._fx.readPdf = readPdf;

/* Реф-ссылки */
function copyRefLink(){
  const user = window.FoxAuth?.getCurrentUser?.();
  const id = user?.id ? user.id.slice(0, 8) : 'guest';
  const link = `${location.origin}/app/?ref=${id}`;
  navigator.clipboard.writeText(link).then(() => showMiniToast('Ссылка скопирована'));
}
(function initRef(){
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  if (ref && !FEAT.refId){
    FEAT.refId = ref;
    localStorage.setItem('foxint.refId', ref);
  }
})();

/* Онбординг */
function showOnboarding(){
  if (localStorage.getItem('foxint.onboarded') === '1') return;
  const slides = [
    { title: 'Привет, я Foxint', text: 'OSINT-ассистент. Помогу разобрать кейс, найти людей и компании по открытым источникам, написать текст или код.',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="48" height="48" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
    { title: 'Команды для OSINT', text: 'Пиши прямо в чат:\n.u ник — поиск username\n.i IP — геолокация\n.e email — проверка email\n.d домен — DNS\n.b email — утечки',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="48" height="48" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' },
    { title: 'Всё готово', text: 'Прикрепи файлы, используй граф связей, выбирай тему и персону. Foxint подстроится под твой стиль.',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="48" height="48" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' }
  ];
  let idx = 0;
  const screen = document.createElement('div');
  screen.className = 'onboard-screen';
  document.body.appendChild(screen);
  const render = () => {
    const s = slides[idx];
    screen.innerHTML = '<div class="onboard-card"><div class="onboard-icon">' + s.icon + '</div><div class="onboard-title">' + esc(s.title) + '</div><div class="onboard-text">' + esc(s.text).replace(/\n/g, '<br>') + '</div><div class="onboard-dots">' + slides.map((_, i) => '<span class="' + (i === idx ? 'active' : '') + '"></span>').join('') + '</div><div class="onboard-actions"><button class="onboard-skip" data-act="skip">Пропустить</button><button class="onboard-next" data-act="next">' + (idx === slides.length - 1 ? 'Начать' : 'Далее') + '</button></div></div>';
    screen.querySelector('[data-act="skip"]').addEventListener('click', finish);
    screen.querySelector('[data-act="next"]').addEventListener('click', () => {
      if (idx < slides.length - 1){ idx++; render(); } else finish();
    });
  };
  const finish = () => {
    localStorage.setItem('foxint.onboarded', '1');
    screen.classList.remove('show');
    setTimeout(() => screen.remove(), 400);
  };
  render();
  requestAnimationFrame(() => screen.classList.add('show'));
}
window._fx.showOnboarding = showOnboarding;

/* Панель настроек — SVG-иконки + кастомные селекты */
function injectSettingsSection(){
  const body = document.querySelector('.settings-body');
  if (!body || body.querySelector('#fxNewSection')) return;

  const section = document.createElement('div');
  section.className = 'section';
  section.id = 'fxNewSection';

  const title = document.createElement('div');
  title.className = 'section-title';
  title.textContent = 'Foxint Plus';
  section.appendChild(title);

  /* Персона */
  section.appendChild(makeRow(ICONS.persona, 'Персона', createCustomSelect(
    window._fx.PERSONAS, FEAT.persona, (v) => {
      FEAT.persona = v;
      localStorage.setItem('foxint.persona', v);
    }
  )));

  /* Язык */
  section.appendChild(makeRow(ICONS.lang, 'Язык ответов AI', createCustomSelect(
    window._fx.LANGS, FEAT.lang, (v) => {
      FEAT.lang = v;
      localStorage.setItem('foxint.lang', v);
    }
  )));

  /* Шрифт */
  section.appendChild(makeRow(ICONS.font, 'Шрифт интерфейса', createCustomSelect(
    FONTS, FEAT.font, (v) => { applyFont(v); }
  )));

  /* Цвет акцента */
  const colorRow = document.createElement('div');
  colorRow.className = 'setting-row';
  colorRow.innerHTML = '<div class="setting-row-icon">' + ICONS.color + '</div><div class="setting-row-info"><b>Цвет акцента</b><span>Своя палитра</span></div>';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = FEAT.accent || '#5b8dff';
  colorInput.className = 'fx-color';
  colorInput.addEventListener('input', e => applyAccent(e.target.value));
  const resetBtn = document.createElement('button');
  resetBtn.className = 'fx-mini-btn';
  resetBtn.textContent = 'Сброс';
  resetBtn.addEventListener('click', () => {
    applyAccent('');
    colorInput.value = '#5b8dff';
  });
  colorRow.appendChild(colorInput);
  colorRow.appendChild(resetBtn);
  section.appendChild(colorRow);

  /* Звуки */
  const soundRow = makeRow(ICONS.sound, 'Звуки', 'Клик при отправке/ответе');
  const soundSw = document.createElement('button');
  soundSw.className = 'switch' + (FEAT.sound ? ' on' : '');
  soundSw.addEventListener('click', () => {
    FEAT.sound = !FEAT.sound;
    soundSw.classList.toggle('on', FEAT.sound);
    localStorage.setItem('foxint.sound', FEAT.sound ? '1' : '0');
    if (FEAT.sound) SOUNDS.click();
  });
  soundRow.appendChild(soundSw);
  section.appendChild(soundRow);

  /* Анимация печатается */
  const typingRow = makeRow(ICONS.typing, 'Анимация печатается', 'Ответ по буквам');
  const typingSw = document.createElement('button');
  typingSw.className = 'switch' + (FEAT.typing ? ' on' : '');
  typingSw.addEventListener('click', () => {
    FEAT.typing = !FEAT.typing;
    typingSw.classList.toggle('on', FEAT.typing);
    localStorage.setItem('foxint.typing', FEAT.typing ? '1' : '0');
  });
  typingRow.appendChild(typingSw);
  section.appendChild(typingRow);

  /* CoT */
  const cotRow = makeRow(ICONS.cot, 'Chain-of-thought', 'Показывать размышления');
  const cotSw = document.createElement('button');
  cotSw.className = 'switch' + (FEAT.cot ? ' on' : '');
  cotSw.addEventListener('click', () => {
    FEAT.cot = !FEAT.cot;
    cotSw.classList.toggle('on', FEAT.cot);
    localStorage.setItem('foxint.cot', FEAT.cot ? '1' : '0');
  });
  cotRow.appendChild(cotSw);
  section.appendChild(cotRow);

  /* Сводка */
  const summaryBtn = makeToolBtn(ICONS.summary, 'Сводка диалога', 'Сжать в 5 пунктов');
  summaryBtn.addEventListener('click', () => window._fx.summarizeChat());
  section.appendChild(summaryBtn);

  /* Реф-ссылка */
  const refBtn = makeToolBtn(ICONS.ref, 'Пригласить друга', 'Скопировать реф-ссылку');
  refBtn.addEventListener('click', copyRefLink);
  section.appendChild(refBtn);

  body.insertBefore(section, body.firstChild);

  function makeRow(icon, title, rightEl){
    const row = document.createElement('div');
    row.className = 'setting-row';
    const ic = document.createElement('div');
    ic.className = 'setting-row-icon';
    ic.innerHTML = icon;
    const info = document.createElement('div');
    info.className = 'setting-row-info';
    const b = document.createElement('b');
    b.textContent = title;
    info.appendChild(b);
    row.appendChild(ic);
    row.appendChild(info);
    if (typeof rightEl === 'string'){
      const span = document.createElement('span');
      span.textContent = rightEl;
      info.appendChild(span);
    } else if (rightEl){
      row.appendChild(rightEl);
    }
    return row;
  }

  function makeToolBtn(icon, title, sub){
    const btn = document.createElement('div');
    btn.className = 'tool-btn';
    btn.innerHTML = '<div class="setting-row-icon">' + icon + '</div><div class="setting-row-info"><b>' + title + '</b><span>' + sub + '</span></div><svg class="tool-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';
    return btn;
  }
}

window.FoxFeatures = {
  FEAT: FEAT,
  getPersonaPrompt: () => window._fx.PERSONAS[FEAT.persona]?.prompt || '',
  getLangPrompt: () => window._fx.LANGS[FEAT.lang]?.prompt || '',
  isCoTEnabled: () => FEAT.cot,
  isTypingEnabled: () => FEAT.typing,
  typeIn: window._fx.typeIn,
  renderColorPalette: window._fx.renderColorPalette,
  addMessageActions: window._fx.addMessageActions,
  addEditToUserMessage: window._fx.addEditToUserMessage,
  readPdf: window._fx.readPdf,
  showOnboarding: window._fx.showOnboarding,
  injectSettingsSection: injectSettingsSection,
  showMiniToast: showMiniToast,
  SOUNDS: SOUNDS
};

applyFont(FEAT.font);
if (FEAT.accent) applyAccent(FEAT.accent);

setTimeout(showOnboarding, 1500);
setTimeout(injectSettingsSection, 800);
console.log('[Foxint] Часть 4 загружена');
})();
