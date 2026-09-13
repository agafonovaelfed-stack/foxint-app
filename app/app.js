/* Foxint AI — v8 (ChatGPT-style) */

const CONFIG = {
  PROXY: 'https://foxint-ai-proxy.onrender.com',
  MODEL: 'GigaChat'
};
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 720;

const SYSTEM_PROMPT = `Ты — Foxint. OSINT-ассистент для расследований, проверки людей и компаний.

ТВОИ ВОЗМОЖНОСТИ:
- Проверка username: .u ник
- Геолокация IP: .i 8.8.8.8
- Проверка email: .e email
- DNS-разбор домена: .d domain.com
- Проверка утечек: .b email
- Работа с текстовыми файлами
- Ответы на вопросы, тексты, код
- Graph Analysis для визуализации связей

ЧЕГО НЕ УМЕЕШЬ (не упоминай это):
- Работа с фото, видео, аудио
- PDF, Word, Excel
- Метаданные, EXIF, GPS
- Доступ к интернету в реальном времени

ПРАВИЛА:
1. Ты — Foxint. Не раскрывай свой бэкенд.
2. Не выдумывай факты. Если не знаешь — скажи.
3. На вопрос "что умеешь" — только список выше.
4. Живо, без воды. Markdown уместен.`;

const THEMES = {
  deepspace: { name: 'Deep Space', particleType: 'deepspace', previewBg: 'radial-gradient(circle at 30% 30%, #1a2a5a 0%, #05070f 100%)', previewDot: '#5b8dff', themeColor: '#05070f' },
  ember:     { name: 'Ember',      particleType: 'ember',     previewBg: 'linear-gradient(135deg,#0d0a08 0%,#3a1f10 50%,#ff6b1a 100%)', previewDot: '#ff6b1a', themeColor: '#0d0a08' },
  blood:     { name: 'Blood',      particleType: 'blood',     previewBg: 'linear-gradient(135deg,#0a0203 0%,#3a0a10 50%,#7a0010 100%)', previewDot: '#ff2a3a', themeColor: '#0a0203' },
  ocean:     { name: 'Ocean',      particleType: 'ocean',     previewBg: 'linear-gradient(135deg,#04121f 0%,#0369a1 50%,#22d3ee 100%)', previewDot: '#22d3ee', themeColor: '#04121f' },
  aurora:    { name: 'Aurora',     particleType: 'aurora',    previewBg: 'linear-gradient(135deg,#070a18 0%,#22ffb0 50%,#a855f7 100%)', previewDot: '#22ffb0', themeColor: '#070a18' },
  sakura:    { name: 'Sakura',     particleType: 'sakura',    previewBg: 'linear-gradient(135deg,#1a0d17 0%,#f472b6 50%,#c026d3 100%)', previewDot: '#ff8ab5', themeColor: '#1a0d17' },
  midnight:  { name: 'Midnight',   particleType: 'midnight',  previewBg: 'linear-gradient(135deg,#050507 0%,#2a2216 50%,#f0c674 100%)', previewDot: '#f0c674', themeColor: '#050507' }
};

let chats = [], activeChatId = null, gcToken = null, gcTokenExp = 0;
let currentMode = 'auto';
let attachments = [];
let foxthinkState = null;
let recognition = null, isRecording = false;

const prefs = {
  theme: localStorage.getItem('foxint.theme') || 'deepspace',
  particles: localStorage.getItem('foxint.particles') !== '0',
  reduceMotion: false
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtSize = b => b < 1024 ? b+' B' : b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(1)+' MB';

/* ============ DOM ============ */
const $ = id => document.getElementById(id);
const chatEl = $('chat'), input = $('input'), send = $('send');
const chatSearchEl = $('chatsSearch'), chatsListEl = $('chatsList');
const sidebarEl = $('sidebar'), sidebarToggle = $('sidebarToggle'), sidebarClose = $('sidebarClose'), sidebarOverlay = $('sidebarOverlay');
const newChatBtn = $('newChatBtn'), newChatBtnTop = $('newChatBtnTop');
const settingsBtn = $('settingsBtn'), settings = $('settings'), backdrop = $('backdrop'), closeSettings = $('closeSettings');
const themeGrid = $('themeGrid'), switchParticles = $('switchParticles'), switchReduce = $('switchReduce');
const canvas = $('particles');
const attachBtn = $('attachBtn'), fileInput = $('fileInput'), attachPreview = $('attachPreview');
const micBtn = $('micBtn'), scrollDownBtn = $('scrollDown');
const graphSidebarBtn = $('graphSidebarBtn');
const exportBtn = $('exportBtn'), wipeBtn = $('wipeBtn');
const lightbox = $('lightbox'), lightboxImg = $('lightboxImg');
const topbarTitle = $('topbarTitle');
const userAvatar = $('userAvatar'), userEmail = $('userEmail'), userStatus = $('userStatus'), logoutBtn = $('logoutBtn');

const scrollBottom = () => requestAnimationFrame(() => { if (chatEl) chatEl.scrollTop = chatEl.scrollHeight; });

/* ============ УТИЛИТЫ ============ */
function dateGroup(ts){
  const d = new Date(ts), n = new Date();
  if (d.toDateString() === n.toDateString()) return 'Сегодня';
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Вчера';
  const df = (n - d) / 86400000;
  if (df < 7) return 'На этой неделе';
  if (df < 30) return 'В этом месяце';
  return 'Ранее';
}
function timeAgo(ts){
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'только что';
  if (d < 3600) return Math.floor(d/60) + ' мин';
  if (d < 86400) return Math.floor(d/3600) + ' ч';
  return Math.floor(d/86400) + ' дн';
}
function fmtMessage(t){
  let h = esc(t);
  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="language-${lang || 'plain'}">${esc(code.trim())}</code></pre>`);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  h = h.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)/g, m => `<ul>${m}</ul>`);
  return h;
}

/* ============ САЙДБАР ============ */
function openSidebar(){
  sidebarEl.classList.add('open');
  sidebarOverlay.classList.add('show');
}
function closeSidebar(){
  sidebarEl.classList.remove('open');
  sidebarOverlay.classList.remove('show');
}
if (sidebarToggle) sidebarToggle.addEventListener('click', openSidebar);
if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

/* ============ ЧАТЫ ============ */
async function loadChats(){
  if (window.FoxAuth?.getCurrentUser()){
    try {
      const cloudChats = await window.FoxAuth.cloudLoadChats();
      if (cloudChats.length){ chats = cloudChats; activeChatId = chats[0].id; return; }
      let localChats = [];
      try { const r = localStorage.getItem('foxint.chats'); if (r) localChats = JSON.parse(r); } catch(_) {}
      if (localChats.length){
        for (const c of localChats){
          const newId = await window.FoxAuth.cloudSaveChat(c);
          if (newId) c.id = newId;
        }
        chats = localChats; activeChatId = chats[0].id;
        return;
      }
    } catch(e){ console.warn('[Foxint] Cloud error:', e.message); }
  }
  try { const r = localStorage.getItem('foxint.chats'); if (r) chats = JSON.parse(r); } catch(_) { chats = []; }
  if (!Array.isArray(chats)) chats = [];
  if (!chats.length){
    const c = { id: uid(), title: 'Новый диалог', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    chats.push(c); activeChatId = c.id; saveChats();
  }
  if (!activeChatId || !chats.find(c => c.id === activeChatId)) activeChatId = chats[0].id;
}
function saveChats(){
  try { localStorage.setItem('foxint.chats', JSON.stringify(chats)); } catch(_) {}
  if (window.FoxAuth?.getCurrentUser()){
    const active = getActiveChat();
    if (active){
      window.FoxAuth.cloudSaveChat(active).then(newId => {
        if (newId && newId !== active.id && !/^[0-9a-f]{8}-/.test(active.id)){
          active.id = newId;
          try { localStorage.setItem('foxint.chats', JSON.stringify(chats)); } catch(_) {}
        }
      }).catch(e => console.warn('[Foxint] Save error:', e.message));
    }
  }
}
function getActiveChat(){ return chats.find(c => c.id === activeChatId); }
function newChat(){
  const c = { id: uid(), title: 'Новый диалог', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
  chats.unshift(c); activeChatId = c.id;
  saveChats(); renderChat(); renderChatsList(); closeSidebar();
  if (input) input.focus();
}
function switchChat(id){
  if (!chats.find(c => c.id === id)) return;
  activeChatId = id; saveChats(); renderChat(); renderChatsList(); closeSidebar();
}
function deleteChat(id, e){
  if (e) e.stopPropagation();
  const i = chats.findIndex(c => c.id === id); if (i < 0) return;
  chats.splice(i, 1);
  if (!chats.length){
    const c = { id: uid(), title: 'Новый диалог', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    chats.push(c); activeChatId = c.id;
  } else if (activeChatId === id) activeChatId = chats[Math.min(i, chats.length-1)].id;
  saveChats(); renderChat(); renderChatsList();
  if (window.FoxAuth?.getCurrentUser()) window.FoxAuth.cloudDeleteChat(id).catch(()=>{});
}
if (newChatBtn) newChatBtn.addEventListener('click', newChat);
if (newChatBtnTop) newChatBtnTop.addEventListener('click', newChat);

/* ============ РЕНДЕР ЧАТА ============ */
function renderChat(){
  chatEl.innerHTML = '';
  const c = getActiveChat(); if (!c) return;
  if (topbarTitle) topbarTitle.textContent = c.title || 'Foxint AI';
  if (!c.messages.length){ chatEl.appendChild(buildWelcome()); return; }
  let ld = null;
  c.messages.forEach((m) => {
    const g = dateGroup(m.ts);
    if (g !== ld){ ld = g; const s = document.createElement('div'); s.className = 'chats-date-sep'; s.textContent = g; chatEl.appendChild(s); }
    appendMsg(m.role, m.content, { raw: !!m.raw });
  });
  scrollBottom();
}

function buildWelcome(){
  const w = document.createElement('div');
  w.className = 'welcome';
  w.innerHTML = `
    <div class="big-logo"><img src="/app/logo.png" alt="Foxint"></div>
    <h1>Привет, я <em>Foxint</em></h1>
    <p>OSINT-ассистент. Проверяй username, IP, email, домены и утечки прямо в чате.</p>
    <div class="suggestions">
      <button class="chip" data-q=".u "><span class="chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><span class="chip-text"><b>Username</b><span>.u ник</span></span></button>
      <button class="chip" data-q=".i 8.8.8.8"><span class="chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg></span><span class="chip-text"><b>IP-разбор</b><span>.i 8.8.8.8</span></span></button>
      <button class="chip" data-q=".e test@mail.com"><span class="chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg></span><span class="chip-text"><b>Email</b><span>.e email</span></span></button>
      <button class="chip" data-q=".d github.com"><span class="chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg></span><span class="chip-text"><b>Домен</b><span>.d domain.com</span></span></button>
      <button class="chip" data-q=".b test@mail.com"><span class="chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span><span class="chip-text"><b>Утечки</b><span>.b email</span></span></button>
      <button class="chip" data-q="Составь OSINT-профиль компании"><span class="chip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></span><span class="chip-text"><b>OSINT-профиль</b><span>про компанию</span></span></button>
    </div>`;
  setTimeout(() => {
    w.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
      input.value = c.dataset.q;
      input.dispatchEvent(new Event('input'));
      if (c.dataset.q.startsWith('.') && c.dataset.q.split(' ')[1] && c.dataset.q.split(' ')[1].length > 1) sendMsg();
      else input.focus();
    }));
  }, 0);
  return w;
}

function renderChatsList(){
  if (!chatsListEl) return;
  const q = (chatSearchEl?.value || '').trim().toLowerCase();
  const filtered = q ? chats.filter(c => c.title.toLowerCase().includes(q)) : chats.slice();
  chatsListEl.innerHTML = '';
  if (!filtered.length){
    chatsListEl.innerHTML = '<div class="chats-empty"><div>Ничего не найдено</div></div>';
    return;
  }
  filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  let lg = null;
  filtered.forEach(c => {
    const g = dateGroup(c.updatedAt);
    if (g !== lg){ lg = g; const lbl = document.createElement('div'); lbl.className = 'chats-group-label'; lbl.textContent = g; chatsListEl.appendChild(lbl); }
    const item = document.createElement('div');
    item.className = 'chat-item' + (c.id === activeChatId ? ' active' : '');
    const lm = c.messages.length ? (c.messages[c.messages.length-1].content || '').slice(0, 60) : 'Пустой диалог';
    item.innerHTML = `
      <div class="chat-item-body">
        <div class="chat-item-title">${esc(c.title)}</div>
        <div class="chat-item-preview">${esc(lm)}</div>
      </div>
      <button class="chat-item-del" data-del="${c.id}" title="Удалить">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
      </button>`;
    item.addEventListener('click', e => { if (e.target.closest('[data-del]')) return; switchChat(c.id); });
    item.querySelector('[data-del]').addEventListener('click', e => deleteChat(c.id, e));
    chatsListEl.appendChild(item);
  });
}
if (chatSearchEl) chatSearchEl.addEventListener('input', renderChatsList);

/* ============ ТЕМА ============ */
function applyTheme(id){
  const t = THEMES[id]; if (!t) return;
  document.body.dataset.theme = id;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t.themeColor);
  document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === id));
  prefs.theme = id;
  try { localStorage.setItem('foxint.theme', id); } catch(_) {}
  setupParticles(t.particleType);
}
function buildThemeGrid(){
  if (!themeGrid) return;
  themeGrid.innerHTML = '';
  Object.entries(THEMES).forEach(([id, t]) => {
    const c = document.createElement('div');
    c.className = 'theme-card' + (prefs.theme === id ? ' active' : '');
    c.dataset.theme = id;
    c.innerHTML = `<div class="theme-preview" style="--preview-bg:${t.previewBg};--preview-dot:${t.previewDot}"><span class="p-dot p1"></span><span class="p-dot p2"></span><span class="p-dot p3"></span><span class="p-dot p4"></span></div><div class="theme-name"><span>${t.name}</span><span class="theme-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg></span></div>`;
    c.addEventListener('click', () => applyTheme(id));
    themeGrid.appendChild(c);
  });
}

/* ============ НАСТРОЙКИ ============ */
function openSettings(){ settings.classList.add('show'); backdrop.classList.add('show'); }
function closeSettingsPanel(){ settings.classList.remove('show'); backdrop.classList.remove('show'); }
if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
if (closeSettings) closeSettings.addEventListener('click', closeSettingsPanel);
if (backdrop) backdrop.addEventListener('click', closeSettingsPanel);
if (switchParticles) switchParticles.addEventListener('click', () => {
  prefs.particles = !prefs.particles;
  switchParticles.classList.toggle('on', prefs.particles);
  try { localStorage.setItem('foxint.particles', prefs.particles ? '1' : '0'); } catch(_) {}
  updateParticlesVisibility();
});
if (switchReduce) switchReduce.addEventListener('click', () => {
  prefs.reduceMotion = !prefs.reduceMotion;
  switchReduce.classList.toggle('on', prefs.reduceMotion);
  updateParticlesVisibility();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#exportBtn, #wipeBtn, #graphSidebarBtn');
  if (!btn) return;
  e.preventDefault();
  if (btn.id === 'graphSidebarBtn') openGraphScreen();
  else if (btn.id === 'exportBtn') openExportMenu();
  else if (btn.id === 'wipeBtn') openWipeConfirm();
});

/* ============ ЧАСТИЦЫ (7 тем) ============ */
const particles = {
  ctx: canvas.getContext('2d'),
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  items: [], type: 'none', raf: null, w: 0, h: 0,
  resize(){
    this.w = innerWidth; this.h = innerHeight;
    canvas.width = this.w * this.dpr;
    canvas.height = this.h * this.dpr;
    canvas.style.width = this.w + 'px';
    canvas.style.height = this.h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },
  spawn(t){
    this.type = t; this.resize(); this.items = [];
    if (t === 'none') return;
    const a = this.w * this.h;
    const dens = IS_MOBILE ? 16000 : 8000;
    let n = 0;
    if (t === 'blood') n = Math.min(IS_MOBILE ? 60 : 130, a/dens|0);
    if (t === 'ocean') n = Math.min(IS_MOBILE ? 50 : 110, a/(dens*1.2)|0);
    if (t === 'aurora') n = Math.min(IS_MOBILE ? 70 : 160, a/(dens*0.9)|0);
    if (t === 'sakura') n = Math.min(IS_MOBILE ? 35 : 70, a/(dens*1.8)|0);
    if (t === 'midnight') n = Math.min(IS_MOBILE ? 45 : 100, a/(dens*1.4)|0);
    if (t === 'deepspace') n = Math.min(IS_MOBILE ? 60 : 130, a/dens|0);
    if (t === 'ember') n = Math.min(IS_MOBILE ? 50 : 110, a/(dens*1.1)|0);
    for (let i = 0; i < n; i++) this.items.push(this.one(t));
  },
  one(t){
    const r = (a,b) => a + Math.random() * (b-a);
    if (t === 'blood') return { x:r(0,this.w), y:r(0,this.h), r:r(2,6), vy:r(0.5,1.8), vx:r(-0.3,0.3), a:r(0.6,1), hue:r(350,365), ph:r(0,6.28) };
    if (t === 'ocean'){ const b = Math.random()<0.35; return { x:r(0,this.w), y:r(0,this.h), r:b?r(2.5,7):r(1.2,3.5), vy:-r(0.3,1.2), vx:r(-0.15,0.15), a:b?r(0.3,0.6):r(0.6,1), hue:r(185,210), bubble:b, ph:r(0,6.28) }; }
    if (t === 'aurora'){ const s = Math.random()<0.15; return { x:r(0,this.w), y:r(0,this.h), r:s?3:r(1.2,3.5), vy:s?-r(0.5,1.3):r(-0.15,0.15), vx:r(-0.35,0.35), a:r(0.5,1), hue:r(150,270), ph:r(0,6.28), streamer:s }; }
    if (t === 'sakura') return { x:r(0,this.w), y:r(0,this.h), r:r(4,9), vy:r(0.5,1.4), vx:r(-0.35,0.35), a:r(0.6,1), hue:r(330,350), rot:r(0,6.28), vrot:r(-0.05,0.05), sway:r(0,6.28), ss:r(0.012,0.03) };
    if (t === 'midnight') return { x:r(0,this.w), y:r(0,this.h), r:r(1.2,3.5), vy:-r(0.25,0.9), vx:r(-0.15,0.15), a:r(0.6,1), hue:r(40,55), ph:r(0,6.28) };
    if (t === 'deepspace') return { x:r(0,this.w), y:r(0,this.h), r:r(0.6,2.2), vy:r(0.08,0.3), vx:r(-0.08,0.08), a:r(0.5,1), hue:r(200,260), ph:r(0,6.28) };
    if (t === 'ember') return { x:r(0,this.w), y:r(0,this.h), r:r(1.5,4), vy:-r(0.3,1.2), vx:r(-0.3,0.3), a:r(0.5,1), hue:r(15,40), ph:r(0,6.28) };
  },
  draw(){
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const t = Date.now()/1000;
    for (const p of this.items){
      p.x += p.vx; p.y += p.vy;
      if (p.sway !== undefined){ p.sway += p.ss; p.x += Math.sin(p.sway)*0.5; }
      if (p.rot !== undefined) p.rot += p.vrot;
      if (p.y > h + 15){ p.y = -15; p.x = Math.random()*w; }
      if (p.y < -15){ p.y = h + 15; p.x = Math.random()*w; }
      if (p.x > w + 15) p.x = -15;
      if (p.x < -15) p.x = w + 15;
      const tw = 0.75 + 0.25*Math.sin(t*1.5 + (p.ph||0));
      const al = p.a * tw;
      if (this.type === 'sakura'){
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        const g = ctx.createRadialGradient(0,0,0,0,0,p.r);
        g.addColorStop(0, `hsla(${p.hue},85%,78%,${al})`);
        g.addColorStop(1, `hsla(${p.hue},75%,55%,${al*0.4})`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0,0,p.r,p.r*0.6,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
      } else if (this.type === 'ocean' && p.bubble){
        ctx.strokeStyle = `hsla(${p.hue},80%,65%,${al})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.stroke();
      } else if (this.type === 'aurora' && p.streamer){
        const len = 50 + Math.sin(t*2+(p.ph||0))*25;
        const g = ctx.createLinearGradient(p.x,p.y,p.x,p.y+len);
        g.addColorStop(0, `hsla(${p.hue},90%,70%,0)`);
        g.addColorStop(0.5, `hsla(${p.hue},90%,70%,${al})`);
        g.addColorStop(1, `hsla(${p.hue},90%,70%,0)`);
        ctx.strokeStyle = g; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x,p.y+len); ctx.stroke();
      } else {
        const glow = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*5);
        glow.addColorStop(0, `hsla(${p.hue},90%,65%,${al})`);
        glow.addColorStop(1, `hsla(${p.hue},90%,65%,0)`);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = `hsla(${p.hue},95%,78%,${Math.min(1,al+0.2)})`;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      }
    }
  },
  loop(){ this.draw(); this.raf = requestAnimationFrame(() => this.loop()); },
  start(){ if (this.raf) return; if (!this.items.length){ this.draw(); return; } this.loop(); },
  stop(){ if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; this.ctx.clearRect(0,0,this.w,this.h); }
};
function updateParticlesVisibility(){
  const active = prefs.particles && particles.type !== 'none';
  canvas.classList.toggle('show', active);
  if (active) particles.start(); else particles.stop();
}
function setupParticles(type){ particles.spawn(type); updateParticlesVisibility(); }
let rt;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (particles.type && particles.type !== 'none') particles.spawn(particles.type); }, 200); });

/* ============ ВЛОЖЕНИЯ ============ */
if (attachBtn) attachBtn.addEventListener('click', () => fileInput.click());
if (fileInput) fileInput.addEventListener('change', async e => {
  const fs = Array.from(e.target.files || []);
  for (const f of fs) await addAttachment(f);
  fileInput.value = ''; renderAttachPreview(); updateSend();
});
async function addAttachment(file){
  const a = { id: uid(), name: file.name, type: file.type || 'unknown', size: file.size };
  if (file.size < 512*1024 && isTextLike(file)){ a.kind = 'text'; a.textContent = await readAsText(file); }
  else { a.kind = 'binary'; }
  attachments.push(a);
}
function isTextLike(f){
  const n = (f.name||'').toLowerCase();
  const ext = ['.txt','.md','.json','.csv','.js','.ts','.py','.html','.css','.log','.xml','.yaml','.yml'];
  return f.type.startsWith('text/') || ext.some(e => n.endsWith(e));
}
function readAsText(f){ return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(f); }); }
function renderAttachPreview(){
  if (!attachPreview) return;
  if (!attachments.length){ attachPreview.classList.remove('show'); attachPreview.innerHTML=''; return; }
  attachPreview.classList.add('show'); attachPreview.innerHTML = '';
  attachments.forEach(a => {
    const el = document.createElement('div'); el.className = 'preview-item';
    el.innerHTML = `<span class="name">${esc(a.name)}</span><button>×</button>`;
    el.querySelector('button').addEventListener('click', () => {
      const i = attachments.findIndex(x => x.id === a.id);
      if (i > -1) attachments.splice(i, 1);
      renderAttachPreview(); updateSend();
    });
    attachPreview.appendChild(el);
  });
}

/* ============ INPUT ============ */
if (input) input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  updateSend();
});
if (input) input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !IS_MOBILE){ e.preventDefault(); sendMsg(); }
});
if (send) send.addEventListener('click', sendMsg);
function updateSend(){ if (send) send.disabled = !input.value.trim() && attachments.length === 0; }

/* ============ СООБЩЕНИЯ ============ */
function appendMsg(role, text, opts = {}){
  const d = document.createElement('div');
  d.className = 'msg ' + (role === 'user' ? 'user' : 'ai');

  const av = document.createElement('div');
  av.className = 'msg-avatar';
  if (role === 'user') av.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  else av.innerHTML = `<img src="/app/logo.png" alt="">`;

  const b = document.createElement('div');
  b.className = 'msg-bubble';
  b.innerHTML = opts.raw ? text : (role === 'user' ? esc(text) : fmtMessage(text));

  d.appendChild(av); d.appendChild(b);
  chatEl.appendChild(d);
  if (window.Prism) setTimeout(() => Prism.highlightAllUnder(b), 0);
  scrollBottom();
}

/* ============ FOXTHINK ============ */
function detectScenario(text, mode){
  const t = (text||'').toLowerCase();
  if (/^\.u\s/.test(text) || /^\.i\s/.test(text) || /^\.e\s/.test(text) || /^\.d\s/.test(text) || /^\.b\s/.test(text)) return 'osint';
  if (mode === 'code' || t.includes('код') || t.includes('python')) return 'code';
  if (mode === 'text' || t.includes('напиши') || t.includes('текст')) return 'text';
  if (text.length < 30 && (t.includes('привет') || t.includes('как дела'))) return 'chat';
  return 'default';
}
function buildStages(scenario, text){
  const len = (text||'').length;
  if (scenario === 'osint') return ['Разбираю запрос','Определяю источники','Собираю данные','Проверяю','Оформляю'];
  if (scenario === 'code') return ['Понимаю задачу','Продумываю структуру','Пишу код','Проверяю'];
  if (scenario === 'text') return ['Читаю задачу','Определяю тон','Пишу черновик','Редактирую'];
  if (scenario === 'chat') return ['Обрабатываю','Отвечаю'];
  if (len < 40) return ['Разбираю вопрос','Формирую ответ'];
  return ['Разбираю вопрос','Собираю факты','Формулирую ответ'];
}
function showTyping(userText){
  const stages = buildStages(detectScenario(userText||'', currentMode), userText||'');
  const d = document.createElement('div');
  d.className = 'msg ai foxthink-msg'; d.id = 'typing';
  d.innerHTML = `<div class="msg-avatar"><img src="/app/logo.png" alt=""></div><div class="msg-bubble foxthink-bubble"><div class="foxthink-header"><div class="foxthink-title"><span class="foxthink-dot"></span>FoxThink</div><div class="foxthink-timer" id="foxthinkTimer">0.0s</div></div><div class="foxthink-stages" id="foxthinkStages"></div></div>`;
  chatEl.appendChild(d); scrollBottom();
  const stagesEl = document.getElementById('foxthinkStages');
  const timerEl = document.getElementById('foxthinkTimer');
  let currentStage = 0, finished = false, stageTick = null;
  function renderStages(){
    stagesEl.innerHTML = '';
    stages.forEach((txt, i) => {
      const row = document.createElement('div');
      row.className = 'foxthink-stage';
      if (i < currentStage) row.classList.add('done');
      if (i === currentStage && !finished) row.classList.add('active');
      row.innerHTML = `<span class="foxthink-marker"></span><span class="foxthink-text">${esc(txt)}</span>`;
      stagesEl.appendChild(row);
    });
  }
  renderStages();
  function next(){
    if (finished || currentStage >= stages.length - 1) return;
    currentStage++; renderStages();
    if (currentStage < stages.length - 1) stageTick = setTimeout(next, 400 + Math.random()*500);
  }
  stageTick = setTimeout(next, 500);
  const start = Date.now();
  const timer = setInterval(() => {
    if (finished){ clearInterval(timer); return; }
    if (timerEl) timerEl.textContent = ((Date.now()-start)/1000).toFixed(1) + 's';
  }, 100);
  foxthinkState = {
    finish: () => {
      finished = true;
      clearTimeout(stageTick); clearInterval(timer);
      stagesEl.querySelectorAll('.foxthink-stage').forEach(r => { r.classList.add('done'); r.classList.remove('active'); });
      if (timerEl) timerEl.textContent = ((Date.now()-start)/1000).toFixed(1) + 's';
    }
  };
}
function hideTyping(){
  if (foxthinkState?.finish) foxthinkState.finish();
  const t = document.getElementById('typing');
  if (t){ t.classList.add('foxthink-done'); setTimeout(() => t.remove(), 200); }
  foxthinkState = null;
}

/* ============ OSINT ============ */
async function osintUsername(u){ const r = await fetch(`${CONFIG.PROXY}/osint/username?u=${encodeURIComponent(u)}`); if (!r.ok) throw new Error('http '+r.status); return r.json(); }
async function osintEmail(e){ const r = await fetch(`${CONFIG.PROXY}/osint/email?email=${encodeURIComponent(e)}`); if (!r.ok) throw new Error('http '+r.status); return r.json(); }
async function osintDomain(d){ const r = await fetch(`${CONFIG.PROXY}/osint/domain?d=${encodeURIComponent(d)}`); if (!r.ok) throw new Error('http '+r.status); return r.json(); }
async function osintIp(ip){ const r = await fetch(`${CONFIG.PROXY}/osint/ip?ip=${encodeURIComponent(ip)}`); if (!r.ok) throw new Error('http '+r.status); return r.json(); }
async function osintBreaches(e){ const r = await fetch(`${CONFIG.PROXY}/osint/breaches?email=${encodeURIComponent(e)}`); if (!r.ok) throw new Error('http '+r.status); return r.json(); }

function renderUsernameResult(d){
  const found = d.results.filter(x => x.found);
  let h = `<div class="osint-result"><div class="osint-head"><div class="osint-title">Username: <b>${esc(d.query)}</b></div><div class="osint-badge ${found.length ? 'ok' : 'empty'}">${found.length} из ${d.results.length}</div></div>`;
  if (found.length){ h += '<ol class="osint-list">'; found.forEach(f => { h += `<li><a href="${f.url}" target="_blank" rel="noopener">${esc(f.platform)}</a> <span class="osint-url">${esc(f.url)}</span></li>`; }); h += '</ol>'; }
  else h += `<div class="osint-empty">Ничего не найдено.</div>`;
  return h + '</div>';
}
function renderEmailResult(d){
  let h = `<div class="osint-result"><div class="osint-head"><div class="osint-title">Email: <b>${esc(d.email)}</b></div></div><ol class="osint-list">`;
  h += `<li><b>Синтаксис:</b> ${d.valid_syntax ? '✅ OK' : '❌ ошибка'}</li>`;
  h += `<li><b>Домен:</b> <code>${esc(d.domain||'—')}</code></li>`;
  h += `<li><b>Одноразовый:</b> ${d.disposable ? '⚠️ да' : '✅ нет'}</li>`;
  h += `<li><b>MX:</b> ${d.mx && d.mx.length ? d.mx.length + ' записей' : '❌ не найдены'}</li>`;
  return h + '</ol></div>';
}
function renderDomainResult(d){
  let h = `<div class="osint-result"><div class="osint-head"><div class="osint-title">Домен: <b>${esc(d.domain)}</b></div></div>`;
  ['A','AAAA','MX','NS','TXT','CNAME'].forEach(k => {
    if (d[k] && d[k].length){
      h += `<div class="osint-group"><div class="osint-group-title">${k}</div><ol class="osint-list">`;
      d[k].slice(0,8).forEach(v => { h += `<li><code>${esc(v)}</code></li>`; });
      h += '</ol></div>';
    }
  });
  return h + '</div>';
}
function renderIpResult(d){
  if (d.status !== 'success') return `<div class="osint-result"><div class="osint-empty">${esc(d.message||'Ошибка')}</div></div>`;
  return `<div class="osint-result"><div class="osint-head"><div class="osint-title">IP: <b>${esc(d.query)}</b></div></div><ol class="osint-list"><li><b>Страна:</b> ${esc(d.country)} (${esc(d.countryCode)})</li><li><b>Регион:</b> ${esc(d.regionName||'—')}</li><li><b>Город:</b> ${esc(d.city||'—')}</li><li><b>Координаты:</b> <code>${d.lat}, ${d.lon}</code></li><li><b>ISP:</b> ${esc(d.isp||'—')}</li><li><b>Организация:</b> ${esc(d.org||'—')}</li></ol></div>`;
}
function renderBreachResult(d){
  const list = (d.breaches && Array.isArray(d.breaches[0])) ? d.breaches[0] : (d.breaches || []);
  let h = `<div class="osint-result"><div class="osint-head"><div class="osint-title">Утечки: <b>${esc(d.email||'—')}</b></div><div class="osint-badge ${list.length ? 'warn' : 'ok'}">${list.length} шт</div></div>`;
  if (!list.length) return h + '<div class="osint-empty">✅ Не найден в утечках</div></div>';
  h += '<ol class="osint-list">';
  list.slice(0,20).forEach(b => { h += `<li>${esc(b)}</li>`; });
  return h + '</ol></div>';
}

/* ============ GIGACHAT ============ */
async function gcGetToken(){
  if (gcToken && Date.now() < gcTokenExp - 60000) return gcToken;
  const r = await fetch(`${CONFIG.PROXY}/oauth`, { method: 'POST' });
  if (!r.ok) throw new Error('auth ' + r.status);
  const d = await r.json();
  gcToken = d.access_token;
  gcTokenExp = d.expires_at || (Date.now() + 30*60*1000);
  return gcToken;
}
async function askGigaChat(text){
  const tkn = await gcGetToken();
  const c = getActiveChat();
  const past = c.messages.slice(0, -1).slice(-12);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT.trim() },
    ...past.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '[сообщение]' })),
    { role: 'user', content: text }
  ];
  const r = await fetch(`${CONFIG.PROXY}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tkn}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CONFIG.MODEL, messages, temperature: 0.6, max_tokens: 1500 })
  });
  if (!r.ok) throw new Error('chat ' + r.status);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || 'Пустой ответ';
}

/* ============ ЭКСПОРТ / WIPE ============ */
function openExportMenu(){
  closeSettingsPanel();
  let menu = document.getElementById('exportMenu');
  if (!menu){
    menu = document.createElement('div');
    menu.className = 'export-menu';
    menu.id = 'exportMenu';
    menu.innerHTML = `<div class="export-panel"><div class="export-title">Экспорт диалога</div><div class="export-sub">Выбери формат</div><button class="export-option" data-fmt="md"><div class="export-option-icon">MD</div><div class="export-option-info"><b>Markdown</b><span>Заголовки, списки</span></div></button><button class="export-option" data-fmt="txt"><div class="export-option-icon">TXT</div><div class="export-option-info"><b>Обычный текст</b><span>Простой формат</span></div></button><button class="export-option" data-fmt="json"><div class="export-option-icon">{}</div><div class="export-option-info"><b>JSON</b><span>Данные</span></div></button><button class="export-cancel" id="exportCancel">Отмена</button></div>`;
    document.body.appendChild(menu);
    menu.addEventListener('click', e => { if (e.target === menu) closeExportMenu(); });
    menu.querySelectorAll('[data-fmt]').forEach(btn => btn.addEventListener('click', () => exportChat(btn.dataset.fmt)));
    document.getElementById('exportCancel').addEventListener('click', closeExportMenu);
  }
  menu.classList.add('show');
}
function closeExportMenu(){ const m = document.getElementById('exportMenu'); if (m) m.classList.remove('show'); }
async function exportChat(fmt){
  const c = getActiveChat(); if (!c) return;
  let content = '', ext = 'md', mime = 'text/markdown';
  if (fmt === 'md'){ content = `# ${c.title}\n\n`; c.messages.forEach(m => { content += `## ${m.role === 'user' ? 'Вы' : 'Foxint'}\n\n${m.content}\n\n---\n\n`; }); }
  else if (fmt === 'txt'){ content = `${c.title}\n\n`; c.messages.forEach(m => { content += `[${m.role === 'user' ? 'ВЫ' : 'FOXINT'}]\n${m.content}\n\n`; }); ext = 'txt'; mime = 'text/plain'; }
  else { content = JSON.stringify({ title: c.title, messages: c.messages }, null, 2); ext = 'json'; mime = 'application/json'; }
  const filename = `foxint-${c.title.slice(0,30).replace(/[^\wа-яА-ЯёЁ-]/g,'_')}.${ext}`;
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  closeExportMenu();
}
function openWipeConfirm(){
  closeSettingsPanel();
  let modal = document.getElementById('wipeConfirm');
  if (!modal){
    modal = document.createElement('div');
    modal.className = 'wipe-confirm';
    modal.id = 'wipeConfirm';
    modal.innerHTML = `<div class="wipe-panel"><div class="wipe-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg></div><div class="wipe-title">Удалить все данные?</div><div class="wipe-text">Все диалоги и настройки будут стёрты.</div><div class="wipe-actions"><button class="wipe-btn" id="wipeCancel">Отмена</button><button class="wipe-btn danger" id="wipeConfirmBtn">Удалить</button></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
    document.getElementById('wipeCancel').addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('wipeConfirmBtn').addEventListener('click', () => { localStorage.clear(); location.reload(); });
  }
  modal.classList.add('show');
}

/* ============ ГРАФ ============ */
const graphState = {
  nodes: [], edges: [], selectedNode: null, dragging: null,
  nextId: 1, canvas: null, ctx: null, width: 0, height: 0,
  panX: 0, panY: 0, zoom: 1, panning: false, panStart: null,
  colors: ['#4a4a5e','#6a6a80','#8a8aa0','#a78bfa','#60a5fa','#34d399','#fbbf24','#f472b6']
};
const NODE_W = 90, NODE_H = 40, NODE_PAD_X = 22;
function nodeBounds(n){
  const w = Math.max(NODE_W, n.label.length * 7.5 + NODE_PAD_X * 2);
  return { x: n.x - w/2, y: n.y - NODE_H/2, w, h: NODE_H };
}
function openGraphScreen(){
  closeSettingsPanel();
  let screen = document.getElementById('graphScreen');
  if (!screen){
    screen = document.createElement('div');
    screen.className = 'graph-screen';
    screen.id = 'graphScreen';
    screen.innerHTML = `
      <div class="graph-toolbar">
        <div class="graph-toolbar-left"><div class="graph-title">Graph Analysis</div><div class="graph-stats" id="graphStats">0 нод · 0 рёбер</div></div>
        <div class="graph-toolbar-right">
          <button class="graph-btn" id="graphAddNode">+ Нода</button>
          <button class="graph-btn" id="graphAutoLayout">Раскладка</button>
          <button class="graph-btn" id="graphReset">Сброс</button>
          <button class="graph-btn" id="graphExportPng">PNG</button>
          <button class="graph-btn graph-btn-close" id="graphClose">×</button>
        </div>
      </div>
      <button class="graph-sidebar-toggle" id="graphSidebarToggleBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
      <div class="graph-hint">Двойной клик — нода · Shift+клик — связь · Правый клик — меню</div>
      <div class="graph-body"><canvas id="graphCanvas"></canvas></div>`;
    document.body.appendChild(screen);
    initGraphEvents();
  }
  screen.classList.add('show');
  requestAnimationFrame(() => { resizeGraphCanvas(); drawGraph(); });
}
function closeGraphScreen(){ const s = document.getElementById('graphScreen'); if (s) s.classList.remove('show'); }
function resizeGraphCanvas(){
  const canvas = document.getElementById('graphCanvas'); if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  graphState.canvas = canvas; graphState.ctx = ctx;
  graphState.width = rect.width; graphState.height = rect.height;
  drawGraph();
}
function addNodeAt(x, y, label, color){
  const n = { id: graphState.nextId++, x, y, vx: 0, vy: 0, label: label || ('Нода ' + (graphState.nodes.length + 1)), color: color || '#4a4a5e' };
  graphState.nodes.push(n); updateGraphStats(); return n;
}
function addEdge(a, b){
  if (a === b) return null;
  if (graphState.edges.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return null;
  const e = { id: graphState.nextId++, a, b, color: 'rgba(160,160,185,0.55)', width: 1.6 };
  graphState.edges.push(e); updateGraphStats(); return e;
}
function updateGraphStats(){
  const el = document.getElementById('graphStats');
  if (el) el.textContent = graphState.nodes.length + ' нод · ' + graphState.edges.length + ' рёбер';
}
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function drawGraph(){
  const ctx = graphState.ctx; if (!ctx) return;
  ctx.save();
  ctx.clearRect(0, 0, graphState.width, graphState.height);
  if (!graphState.nodes.length){
    ctx.fillStyle = 'rgba(160,160,185,0.35)';
    ctx.font = '500 14px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Двойной клик — создать ноду', graphState.width/2, graphState.height/2);
    ctx.restore();
    return;
  }
  ctx.translate(graphState.panX, graphState.panY);
  ctx.scale(graphState.zoom, graphState.zoom);
  for (const e of graphState.edges){
    const a = graphState.nodes.find(n => n.id === e.a);
    const b = graphState.nodes.find(n => n.id === e.b);
    if (!a || !b) continue;
    ctx.strokeStyle = e.color; ctx.lineWidth = e.width;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const n of graphState.nodes){
    const isSel = graphState.selectedNode?.id === n.id;
    const b = nodeBounds(n);
    ctx.fillStyle = n.color;
    roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.strokeStyle = isSel ? '#fff' : 'rgba(255,255,255,.25)';
    ctx.lineWidth = isSel ? 2.5 : 1.3;
    roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '600 12.5px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n.label.slice(0, 20), n.x, n.y);
  }
  ctx.restore();
}
function hitNode(x, y){
  const gx = (x - graphState.panX) / graphState.zoom;
  const gy = (y - graphState.panY) / graphState.zoom;
  for (let i = graphState.nodes.length - 1; i >= 0; i--){
    const n = graphState.nodes[i];
    const b = nodeBounds(n);
    if (gx >= b.x && gx <= b.x + b.w && gy >= b.y && gy <= b.y + b.h) return n;
  }
  return null;
}
function initGraphEvents(){
  const canvas = document.getElementById('graphCanvas'); if (!canvas) return;
  let moved = false, panStartX = 0, panStartY = 0, startPanX = 0, startPanY = 0;
  canvas.addEventListener('mousedown', e => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const n = hitNode(x, y);
    moved = false;
    if (n){ graphState.selectedNode = n; graphState.dragging = n; }
    else { graphState.selectedNode = null; graphState.panning = true; panStartX = e.clientX; panStartY = e.clientY; startPanX = graphState.panX; startPanY = graphState.panY; }
    drawGraph();
  });
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    if (graphState.panning){ graphState.panX = startPanX + (e.clientX - panStartX); graphState.panY = startPanY + (e.clientY - panStartY); drawGraph(); }
    else if (graphState.dragging){ graphState.dragging.x = (e.clientX - r.left - graphState.panX) / graphState.zoom; graphState.dragging.y = (e.clientY - r.top - graphState.panY) / graphState.zoom; moved = true; drawGraph(); }
  });
  canvas.addEventListener('mouseup', () => { graphState.dragging = null; graphState.panning = false; drawGraph(); });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const oldZoom = graphState.zoom;
    const delta = e.deltaY < 0 ? 1.04 : 0.96;
    graphState.zoom = Math.max(0.25, Math.min(3, graphState.zoom * delta));
    graphState.panX = mx - (mx - graphState.panX) * (graphState.zoom / oldZoom);
    graphState.panY = my - (my - graphState.panY) * (graphState.zoom / oldZoom);
    drawGraph();
  }, { passive: false });
  canvas.addEventListener('dblclick', e => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const n = hitNode(x, y);
    if (!n){
      const gx = (x - graphState.panX) / graphState.zoom;
      const gy = (y - graphState.panY) / graphState.zoom;
      const label = prompt('Название ноды:', '');
      if (label !== null && label.trim()){ addNodeAt(gx, gy, label.trim()); drawGraph(); }
    } else {
      const nl = prompt('Переименовать:', n.label);
      if (nl !== null && nl.trim()){ n.label = nl.trim(); drawGraph(); }
    }
  });
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const n = hitNode(e.clientX - r.left, e.clientY - r.top);
    if (n && confirm('Удалить ноду «' + n.label + '»?')){
      graphState.nodes = graphState.nodes.filter(nn => nn.id !== n.id);
      graphState.edges = graphState.edges.filter(ee => ee.a !== n.id && ee.b !== n.id);
      graphState.selectedNode = null; updateGraphStats(); drawGraph();
    }
  });
  document.getElementById('graphAddNode').addEventListener('click', () => {
    addNodeAt(graphState.width/2 + (Math.random()-0.5)*200, graphState.height/2 + (Math.random()-0.5)*200);
    drawGraph();
  });
  document.getElementById('graphAutoLayout').addEventListener('click', () => {
    const nodes = graphState.nodes; if (nodes.length < 2) return;
    const cx = graphState.width/2, cy = graphState.height/2;
    const radius = Math.min(graphState.width, graphState.height) * 0.3;
    nodes.forEach((n, i) => { const ang = (i / nodes.length) * Math.PI * 2; n.x = cx + Math.cos(ang) * radius; n.y = cy + Math.sin(ang) * radius; });
    drawGraph();
  });
  document.getElementById('graphReset').addEventListener('click', () => { graphState.panX = 0; graphState.panY = 0; graphState.zoom = 1; drawGraph(); });
  document.getElementById('graphExportPng').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = graphState.canvas.toDataURL('image/png');
    a.download = 'foxint-graph-' + Date.now() + '.png';
    a.click();
  });
  document.getElementById('graphClose').addEventListener('click', closeGraphScreen);
  const toggleBtn = document.getElementById('graphSidebarToggleBtn');
  if (toggleBtn) toggleBtn.addEventListener('click', () => {
    const sb = document.getElementById('graphSidebar');
    if (sb) sb.classList.toggle('open');
  });
  window.addEventListener('resize', resizeGraphCanvas);
}

/* ============ SCROLL DOWN ============ */
if (chatEl) chatEl.addEventListener('scroll', () => {
  const nearBottom = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 200;
  if (scrollDownBtn) scrollDownBtn.classList.toggle('show', !nearBottom);
});
if (scrollDownBtn) scrollDownBtn.addEventListener('click', () => scrollBottom());

/* ============ ГОЛОС ============ */
function initVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = 'ru-RU'; rec.interimResults = true; rec.continuous = false;
  return rec;
}
function toggleVoice(){
  if (!recognition) recognition = initVoice();
  if (!recognition){ alert('Голосовой ввод не поддерживается'); return; }
  if (isRecording){ recognition.stop(); return; }
  isRecording = true;
  if (micBtn) micBtn.classList.add('active');
  recognition.start();
  recognition.onresult = (e) => {
    let txt = '';
    for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
    input.value = txt; input.dispatchEvent(new Event('input'));
  };
  recognition.onerror = () => stopVoice();
  recognition.onend = () => stopVoice();
}
function stopVoice(){ isRecording = false; if (micBtn) micBtn.classList.remove('active'); }
if (micBtn) micBtn.addEventListener('click', toggleVoice);

/* ============ ОТПРАВКА ============ */
async function sendMsg(){
  const text = input.value.trim();
  if (!text && !attachments.length) return;
  const c = getActiveChat(); if (!c) return;
  input.value = ''; input.style.height = 'auto'; send.disabled = true;

  /* OSINT-команды */
  const cmds = [
    { p: '.u ', fn: osintUsername, r: renderUsernameResult, l: 'Username' },
    { p: '.i ', fn: osintIp,       r: renderIpResult,       l: 'IP' },
    { p: '.e ', fn: osintEmail,    r: renderEmailResult,    l: 'Email' },
    { p: '.d ', fn: osintDomain,   r: renderDomainResult,   l: 'Domain' },
    { p: '.b ', fn: osintBreaches, r: renderBreachResult,   l: 'Утечки' }
  ];
  for (const cmd of cmds){
    if (text.startsWith(cmd.p)){
      const val = text.slice(cmd.p.length).trim();
      if (!val) return;
      if (c.messages.length === 0) c.title = cmd.l + ': ' + val;
      c.messages.push({ role: 'user', content: text, ts: Date.now() });
      renderChat(); renderChatsList();
      showTyping(text);
      try {
        const d = await cmd.fn(val);
        hideTyping();
        const html = cmd.r(d);
        appendMsg('ai', html, { raw: true });
        c.messages.push({ role: 'assistant', content: html, ts: Date.now(), raw: true });
        c.updatedAt = Date.now(); saveChats(); renderChatsList();
      } catch(e){
        hideTyping();
        const errHtml = `<div class="osint-result"><div class="osint-empty">Ошибка: ${esc(e.message)}</div></div>`;
        appendMsg('ai', errHtml, { raw: true });
        c.messages.push({ role: 'assistant', content: errHtml, ts: Date.now(), raw: true });
        saveChats();
      }
      updateSend(); return;
    }
  }

  /* Обычное сообщение */
  if (c.messages.length === 0) c.title = text ? text.slice(0, 32) : 'Файл';
  c.messages.push({ role: 'user', content: text || '[файл]', ts: Date.now() });
  c.updatedAt = Date.now();
  renderChat(); renderChatsList(); updateSend(); saveChats();
  showTyping(text);
  try {
    const reply = await askGigaChat(text);
    hideTyping();
    appendMsg('ai', reply);
    c.messages.push({ role: 'assistant', content: reply, ts: Date.now() });
    c.updatedAt = Date.now();
    saveChats();
    renderChatsList();
  } catch(e){
    hideTyping();
    const errMsg = 'Ошибка: ' + e.message;
    appendMsg('ai', errMsg, { raw: true });
    c.messages.push({ role: 'assistant', content: errMsg, ts: Date.now(), raw: true });
    c.updatedAt = Date.now();
    saveChats();
  } finally {
    attachments = []; renderAttachPreview(); updateSend();
  }
}

/* ============ INIT ============ */
buildThemeGrid();
if (switchParticles) switchParticles.classList.toggle('on', prefs.particles);
applyTheme(prefs.theme);

let appBooted = false;

async function bootApp(user){
  if (appBooted && user) return;
  appBooted = true;
  await loadChats();
  renderChat(); renderChatsList();
  updateProfileUI(user);
}

if (window.FoxAuth){
  window.FoxAuth.onAuth('onLogin', (user) => { updateProfileUI(user); bootApp(user); });
  window.FoxAuth.onAuth('onLogout', () => { updateProfileUI(null); });
  window.FoxAuth.bootAuth();

  setTimeout(() => {
    if (!appBooted) bootApp(null);
  }, 1500);
} else {
  bootApp(null);
}

function updateProfileUI(user){
  if (!user){
    if (userEmail) userEmail.textContent = 'Гость';
    if (userAvatar) userAvatar.textContent = '?';
    if (userStatus) userStatus.textContent = 'локальный режим';
    return;
  }
  if (userEmail) userEmail.textContent = user.email || 'пользователь';
  if (userAvatar) userAvatar.textContent = (user.email || '?')[0].toUpperCase();
  if (userStatus) userStatus.textContent = 'синхронизировано';
}
if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  if (window.FoxAuth){
    await window.FoxAuth.signOut();
    chats = []; activeChatId = null; saveChats();
    window.FoxAuth.showAuthScreen();
  }
});

addEventListener('load', () => { if (input && !IS_MOBILE) input.focus(); });
