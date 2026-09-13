/* Foxint AI — Auth (Supabase) — v2 */

const SUPABASE_URL = 'https://umvpifjfjiwnqhvwnzbt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtdnBpZmpmaml3bnFodnduemJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNTAyMzMsImV4cCI6MjEwNDcyNjIzM30.TS77IJy8zDCADVsmdqfiWlGIKdSyFd0_ssSMT85vRdk';

let supabase = null;
let currentUser = null;
const authCallbacks = { onLogin: [], onLogout: [] };

function onAuth(event, cb){ authCallbacks[event].push(cb); }
function fireAuth(event, data){ authCallbacks[event].forEach(cb => cb(data)); }

async function initSupabase(){
  if (supabase) return supabase;
  if (!window.supabase || !window.supabase.createClient){
    throw new Error('Supabase SDK не загружен');
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: window.localStorage,
      storageKey: 'foxint-auth'
    }
  });
  return supabase;
}

async function getSession(){
  await initSupabase();
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

async function signUp(email, password){
  await initSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(translateError(error.message));
  return data;
}

async function signIn(email, password){
  await initSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateError(error.message));
  return data;
}

async function signOut(){
  await initSupabase();
  await supabase.auth.signOut();
  currentUser = null;
  fireAuth('onLogout');
}

function getCurrentUser(){ return currentUser; }

function translateError(msg){
  const map = {
    'Invalid login credentials': 'Неверный email или пароль',
    'User already registered': 'Пользователь с таким email уже зарегистрирован',
    'Password should be at least 6 characters': 'Пароль должен быть не короче 6 символов',
    'Unable to validate email address: invalid format': 'Неверный формат email',
    'Email not confirmed': 'Email не подтверждён',
    'signup disabled': 'Регистрация временно отключена',
    'Failed to fetch': 'Нет соединения с сервером. Проверь интернет.'
  };
  return map[msg] || msg;
}

/* ============ ЧАТЫ В ОБЛАКЕ ============ */
async function cloudLoadChats(){
  await initSupabase();
  const { data, error } = await supabase
    .from('chats')
    .select('id, title, messages, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(c => ({
    id: c.id,
    title: c.title,
    messages: c.messages || [],
    createdAt: new Date(c.created_at).getTime(),
    updatedAt: new Date(c.updated_at).getTime()
  }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cloudSaveChat(chat){
  await initSupabase();
  const user = getCurrentUser();
  if (!user) return null;
  const payload = {
    user_id: user.id,
    title: chat.title || 'Новый диалог',
    messages: chat.messages || [],
    updated_at: new Date().toISOString()
  };
  if (UUID_RE.test(chat.id)){
    const { error } = await supabase.from('chats').update(payload).eq('id', chat.id);
    if (error) throw new Error(error.message);
    return chat.id;
  } else {
    const { data, error } = await supabase.from('chats').insert(payload).select('id').single();
    if (error) throw new Error(error.message);
    return data.id;
  }
}

async function cloudDeleteChat(id){
  await initSupabase();
  if (!UUID_RE.test(id)) return;
  await supabase.from('chats').delete().eq('id', id);
}

/* ============ UI ЭКРАНА ЛОГИНА ============ */
function showAuthScreen(){
  let screen = document.getElementById('authScreen');
  if (screen){ screen.classList.add('show'); return; }
  screen = document.createElement('div');
  screen.className = 'auth-screen';
  screen.id = 'authScreen';
  screen.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo"><img src="/app/logo.png" alt="Foxint"></div>
      <div class="auth-title">Foxint AI</div>
      <div class="auth-sub">Войди, чтобы синхронизировать чаты между устройствами</div>

      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Вход</button>
        <button class="auth-tab" data-tab="register">Регистрация</button>
      </div>

      <form class="auth-form" id="authForm">
        <input type="email" class="auth-input" id="authEmail" placeholder="Email" autocomplete="email" required>
        <input type="password" class="auth-input" id="authPassword" placeholder="Пароль (мин. 6 символов)" autocomplete="current-password" minlength="6" required>
        <div class="auth-error" id="authError"></div>
        <button type="submit" class="auth-submit" id="authSubmit">Войти</button>
      </form>

      <div class="auth-skip" id="authSkip">
        <button class="auth-skip-btn">Продолжить без входа (локально)</button>
      </div>
    </div>
  `;
  document.body.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add('show'));

  let mode = 'login';
  const tabs = screen.querySelectorAll('.auth-tab');
  const submit = document.getElementById('authSubmit');
  const errBox = document.getElementById('authError');
  const form = document.getElementById('authForm');

  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    mode = t.dataset.tab;
    submit.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
    errBox.textContent = '';
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    errBox.textContent = '';
    submit.disabled = true;
    submit.textContent = 'Загрузка...';
    try {
      if (mode === 'login'){
        await signIn(email, password);
      } else {
        await signUp(email, password);
        await signIn(email, password);
      }
      hideAuthScreen();
    } catch(err){
      errBox.textContent = err.message;
      submit.disabled = false;
      submit.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
    }
  });

  document.getElementById('authSkip').addEventListener('click', () => {
    hideAuthScreen();
    window.__foxint_offline = true;
  });
}

function hideAuthScreen(){
  const s = document.getElementById('authScreen');
  if (s){ s.classList.remove('show'); setTimeout(() => s.remove(), 400); }
}

/* ============ ЗАПУСК ============ */
async function bootAuth(){
  try {
    await initSupabase();
    supabase.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      if (currentUser) fireAuth('onLogin', currentUser);
      else fireAuth('onLogout');
    });
    const session = await getSession();
    if (session?.user){
      currentUser = session.user;
      fireAuth('onLogin', currentUser);
    } else {
      showAuthScreen();
    }
  } catch(err){
    console.error('Auth boot error:', err);
    showAuthScreen();
  }
}

window.FoxAuth = {
  bootAuth,
  signOut,
  getCurrentUser,
  cloudLoadChats,
  cloudSaveChat,
  cloudDeleteChat,
  onAuth,
  showAuthScreen,
  hideAuthScreen
};
