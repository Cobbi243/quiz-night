// ============================================================
// Quiz Night — Своя Гра
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getDatabase, ref, set, get, onValue, off, update, remove, child, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// ============== CONFIG CHECK ==============
const CONFIG = window.QUIZ_CONFIG || {};
const FIREBASE_CONFIGURED = CONFIG.firebase &&
  CONFIG.firebase.apiKey &&
  !CONFIG.firebase.apiKey.includes('replace_me') &&
  CONFIG.firebase.databaseURL;

let app, db, auth;
if (FIREBASE_CONFIGURED) {
  app = initializeApp(CONFIG.firebase);
  db = getDatabase(app);
  auth = getAuth(app);
}

// ============== CONSTANTS ==============
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const AVATARS = ['🦊','🐼','🐯','🦁','🐸','🐙','🦉','🐲','🦄','🐧','🦝','🦔','🐺','🦅','🐢','🐱'];
const VALUES = [200, 400, 600, 800, 1000];
const CATS_PER_BOARD = 6;
const QS_PER_CAT = 5;
const MAX_IMG_SIZE = 1200;     // max width/height px (larger for better quality)
const MAX_IMG_BYTES = 220_000; // ~220KB target after compression (higher to keep larger images sharp)
const BUZZ_SECONDS = 30;       // total time to buzz in (default)
const ANSWER_SECONDS = 15;     // time to answer once buzzed (default)
const FINAL_SECONDS = 90;      // time for players to submit final round bet+answer
const FINAL_MIN_BID_CAP = 1000; // players with <=0 score can still bid up to this

// ============== VERSION & CHANGELOG ==============
const APP_VERSION = '1.29';
const CHANGELOG = [
  { v: '1.29', date: '27.07.2026', changes: [
    'Екран питання більше не скролиться: текст сам зменшується, базер завжди знизу на видноті',
    'Особливо помітно на телефоні — довгі питання тепер вміщаються',
  ]},
  { v: '1.28', date: '27.07.2026', changes: [
    'Базер: тепер одразу показує того хто справді натиснув першим (без миготіння чужого імені)',
    'Курсор більше не злітає з поля коли хтось інший оновлює бали',
  ]},
  { v: '1.27', date: '27.07.2026', changes: [
    'Виправлено: у фіналі гравець з нулем/мінусом балів тепер теж може поставити ставку (до 1000)',
    'Виправлено рідкісний баг: питання інколи одразу показувало відповідь і не зникало з дошки',
  ]},
  { v: '1.26', date: '20.07.2026', changes: [
    'В автовідліку базера додано варіант 1 секунда',
  ]},
  { v: '1.25', date: '30.06.2026', changes: [
    'Виправлено блимання екрану коли ведучий роздає бали',
  ]},
  { v: '1.24', date: '22.06.2026', changes: [
    'Можна додати пояснення до відповіді через // — показується окремо під відповіддю',
  ]},
  { v: '1.23', date: '22.06.2026', changes: [
    'Можна робити переліки в стовпчик у питаннях і відповідях',
    'У .docx — просто пиши з нового рядка; у тексті — пиши \\n де треба перенос',
  ]},
  { v: '1.22', date: '18.06.2026', changes: [
    'Виправлено: у фіналі бали тепер списуються навіть якщо є ставка, але нема відповіді',
    'Розкрита відповідь тепер показується замість питання (не треба скролити)',
  ]},
  { v: '1.21', date: '16.06.2026', changes: [
    'Виправлено базер що не працював у гравців зі збитим годинником на пристрої',
    'Усі таймери тепер синхронізовані з сервером, а не з годинником пристрою',
  ]},
  { v: '1.20', date: '16.06.2026', changes: [
    'Виправлено залипання базера: якщо ведучий проґавив таймаут, гра тепер сама йде далі',
    'Натискання на самій межі таймера тепер зараховується',
  ]},
  { v: '1.19', date: '16.06.2026', changes: [
    'Картинки більші і чіткіші (до 1200px), показуються майже на весь екран',
    'Щоб старі паки стали якіснішими — перезаваж їх',
  ]},
  { v: '1.18', date: '16.06.2026', changes: [
    'Кнопка «Базер завис? Оновити» — якщо у гравця завис базер, можна перепідключитись',
    'Додано діагностику базера (видно причину в консолі браузера)',
  ]},
  { v: '1.17', date: '16.06.2026', changes: [
    'Новий хардкор-режим базера: 1 сек кулдаун між натисканнями (антиспам)',
    'Натиснеш зарано (до відкриття базера) — отримаєш штраф, хто дочекався виграє',
    'Кнопка трясеться якщо тиснути занадто часто в хардкорі',
  ]},
  { v: '1.16', date: '16.06.2026', changes: [
    'Виправлено: завантажені паки більше не зникають при поверненні в лоббі',
    'Кнопка в лоббі показує прогрес: «Продовжити налаштування (2/3 паків)»',
    'Дрібні правки тексту в налаштуваннях',
  ]},
  { v: '1.15', date: '16.06.2026', changes: [
    'Усі паки (раунди + фінал) завантажуються наперед на одному екрані',
    'Старт гри окремою кнопкою — більше не стартує одразу після вибору пака',
    'Між раундами гра йде без зупинок: наступний пак уже готовий',
    'Можна вибирати паки і налаштування в будь-якому порядку',
  ]},
  { v: '1.14', date: '15.06.2026', changes: [
    'Фінальні відповіді тепер розкриваються по черзі — ведучий судить кожного перед усіма',
    'Драматичніше: відповіді відкриваються від меншої ставки до більшої',
  ]},
  { v: '1.13', date: '15.06.2026', changes: [
    'Виправлено: кнопка «пропустити питання» доступна одразу, ще до того як хтось натиснув базер',
    'Виправлено: таймер більше не зникає під час гри',
  ]},
  { v: '1.12', date: '15.06.2026', changes: [
    'Міні-іконка 🖼 на клітинках де є картинка (видно всім)',
  ]},
  { v: '1.11', date: '14.06.2026', changes: [
    'Ведучий може видаляти гравців з гри (у лоббі або через картку гравця)',
    'Новий режим базера: автовідлік 3-10 сек перед відкриттям, видно всім',
    'Виправлено: таймер після неправильної відповіді продовжується, а не скидається',
    'Виправлено: базер тепер надійніше спрацьовує (фікс рідкісного зависання)',
  ]},
  { v: '1.10', date: '09.06.2026', changes: [
    'Доданий чат для всіх гравців — кнопка-бульбашка внизу справа',
    'Видно непрочитані повідомлення, працює протягом усієї гри',
    'Можна писати в чат і ведучому, і гравцям (зручно без мікрофона)',
  ]},
  { v: '1.9', date: '08.06.2026', changes: [
    'Фінальну перевірку тепер бачать усі гравці, а не лише ведучий',
    'Бали у фіналі змінюються наживо — видно як ведучий додає/віднімає',
    'Ведучий може коригувати бали на екрані «раунд завершено»',
    'Підказка підняти бали тим, хто в мінусі, перед фіналом',
  ]},
  { v: '1.8', date: '07.06.2026', changes: [
    'Тільки ведучий вибирає клітинки на дошці (гравці кажуть вголос)',
    'Можна натиснути базер клавішею Пробіл, не тільки мишкою',
    'Нова опція: базер відкривається одразу або ведучий відкриває вручну',
    'Багато гравців тепер у сітці (без горизонтального скролу)',
    'Довгі імена більше не ламають верстку',
    'Текст більше не виділяється при кліках по ігровому полю',
    'Виправлено: ставка у фіналі тепер приймається коректно',
  ]},
  { v: '1.7', date: '06.06.2026', changes: [
    'Двофазний фінал: спершу всі ставлять бали, потім ведучий показує питання',
    'У фазі відповіді — таймер 90 секунд',
    'Кнопка «Як зробити свій пак?» винесена на головну сторінку',
  ]},
  { v: '1.6', date: '05.06.2026', changes: [
    'Готові шаблони паків для завантаження (.docx і .txt)',
    'Модалка-довідка з повними правилами формату',
  ]},
  { v: '1.5', date: '04.06.2026', changes: [
    'Налаштування таймерів перед грою (час на базер і на відповідь)',
    'Картинки можуть бути не лише у питанні, а й у відповіді',
    'Покращено розпізнавання багаторядкових питань у .docx',
  ]},
  { v: '1.4', date: '02.06.2026', changes: [
    'Автоматичний баззер: при виборі питання одразу 30 сек на натискання',
    'Хто натиснув — 15 сек на відповідь, інакше −бали і перехоплення',
    'Таймери з прогрес-барами без блимання екрану',
  ]},
  { v: '1.3', date: '01.06.2026', changes: [
    'Ведучий може вручну коригувати бали гравцям (клік по чіпу)',
    'Виправлено збереження паків з картинками у БД',
    'Захист від кешу: версія додається до файлів',
  ]},
  { v: '1.2', date: '29.05.2026', changes: [
    'Режими 1 / 2 / 3 раунди з множником балів (×1, ×2, ×3)',
    'Фінальний раунд зі ставками балами',
    'Між раундами бали переносяться, нова дошка',
  ]},
  { v: '1.1', date: '29.05.2026', changes: [
    'Завантаження паків з .docx та .txt файлів',
    'Підтримка картинок у питаннях',
    'AI-генерація питань (потребує API ключ)',
    'Збереження своїх паків у базі',
    'Ведучого приховано зі списку гравців',
  ]},
  { v: '1.0', date: '29.05.2026', changes: [
    'Перший реліз: онлайн-мультиплеєр на Firebase',
    'Дошка Jeopardy 6×5, баззер-механіка',
    'Анонімна авторизація, реконект при перезавантаженні',
  ]},
];

// Read room's configured timers, falling back to defaults
function buzzSec(r){ return (r && r.buzzSecondsConfig) || BUZZ_SECONDS; }
// Current time corrected to the Firebase server clock (handles skewed device clocks)
function serverNow(){ return Date.now() + (state.serverTimeOffset || 0); }
function answerSec(r){ return (r && r.answerSecondsConfig) || ANSWER_SECONDS; }

// Sample pack (used when "Готовий пак" selected)
const SAMPLE_PACK = {
  name: 'Загальний пак',
  categories: [
    { name: 'Кіно', questions: [
      {value:200, q:'У якій країні зняли «Паразити»?', a:'Південна Корея'},
      {value:400, q:'Хто зіграв Нео в трилогії «Матриця»?', a:'Кіану Рівз'},
      {value:600, q:'Скільки фільмів у трилогії «Володар перснів»?', a:'3'},
      {value:800, q:'Режисер фільму «Бійцівський клуб»?', a:'Девід Фінчер'},
      {value:1000, q:'Який фільм отримав «Оскар» за найкращий 2020 року?', a:'Паразити'},
    ]},
    { name: 'Історія', questions: [
      {value:200, q:'У якому році Україна проголосила незалежність?', a:'1991'},
      {value:400, q:'Перший президент незалежної України?', a:'Леонід Кравчук'},
      {value:600, q:'Назва козацької столиці на острові у XVI ст.?', a:'Запорізька Січ (Хортиця)'},
      {value:800, q:'У якому році відбулася битва під Крутами?', a:'1918'},
      {value:1000, q:'Гетьман України 1918 року?', a:'Павло Скоропадський'},
    ]},
    { name: 'Наука', questions: [
      {value:200, q:'Хімічний символ золота?', a:'Au'},
      {value:400, q:'Скільки планет у Сонячній системі?', a:'8'},
      {value:600, q:'Хто сформулював закони руху планет?', a:'Йоганн Кеплер'},
      {value:800, q:'Що означає абревіатура ДНК?', a:'Дезоксирибонуклеїнова кислота'},
      {value:1000, q:'Швидкість світла у вакуумі, км/с?', a:'≈300 000 (299 792)'},
    ]},
    { name: 'Спорт', questions: [
      {value:200, q:'Скільки гравців у футбольній команді на полі?', a:'11'},
      {value:400, q:'У якому виді спорту вручають «Кубок Стенлі»?', a:'Хокей'},
      {value:600, q:'Країна, де зародились Олімпійські ігри?', a:'Греція'},
      {value:800, q:'У якому році Україна виграла Євробаскет (так чи ні)?', a:'Не вигравала (питання-пастка)'},
      {value:1000, q:'Українець, чемпіон світу у важкій вазі WBA/WBO/IBO?', a:'Олександр Усик'},
    ]},
    { name: 'Музика', questions: [
      {value:200, q:'Українка-переможниця Євробачення 2004?', a:'Руслана'},
      {value:400, q:'Інструмент з 88 клавішами?', a:'Фортепіано'},
      {value:600, q:'Автор «Заповіту»?', a:'Тарас Шевченко'},
      {value:800, q:'Український гурт-переможець Євробачення 2022?', a:'Kalush Orchestra'},
      {value:1000, q:'Скільки симфоній написав Бетховен?', a:'9'},
    ]},
    { name: 'Географія', questions: [
      {value:200, q:'Столиця Польщі?', a:'Варшава'},
      {value:400, q:'Найбільша річка Європи?', a:'Волга'},
      {value:600, q:'На якій річці стоїть Київ?', a:'Дніпро'},
      {value:800, q:'Найвища гора України?', a:'Говерла'},
      {value:1000, q:'Назвіть хоча б 5 країн через які протікає Дунай', a:'Німеччина, Австрія, Словаччина, Угорщина, Хорватія, Сербія, Румунія, Болгарія, Молдова, Україна'},
    ]},
  ]
};

// ============== STATE ==============
let state = {
  screen: 'home',
  code: '',
  room: null,
  myId: null,
  isHost: false,
  serverTimeOffset: 0,  // ms difference between server clock and this device
  authReady: false,
  err: '',
  loading: false,
  copied: false,
  joinAvatar: AVATARS[Math.floor(Math.random()*AVATARS.length)],
  hostAvatar: AVATARS[Math.floor(Math.random()*AVATARS.length)],
  joinCodeInput: '',
  joinNameInput: '',
  hostNameInput: '',
  subScreen: null,
  setupSource: null,
  setupAiTopics: ['','','','','',''],
  setupAiPreview: null,
  setupManualPack: null,
  setupFilePack: null,
  setupFileImages: {}, // for docx images mapped to qIds
  setupErr: '',
  setupLoading: false,
  setupSavePackName: '',
  savedPacks: [], // [{id, name, createdAt, pack}]
  loadedPacksOnce: false,
  // Rounds & final
  setupRoundsTotal: null,
  setupCurrentRound: 1,
  setupRoundPacks: {},   // {1: pack, 2: pack, 3: pack} — collected before game starts
  editingRound: null,    // which round's pack the host is currently picking
  setupBuzzSeconds: 30,    // host-configured: time to buzz in
  setupAnswerSeconds: 15,  // host-configured: time to answer
  setupBuzzMode: 'instant',  // 'instant' | 'manual' | 'countdown'
  setupCountdownSeconds: 5,  // for countdown mode
  setupAntiSpam: false,      // hardcore: 1s cooldown between buzz attempts
  setupFinalQ: { category:'', q:'', a:'' },
  finalBidLocal: 0,
  finalAnswerLocal: '',
  lastBuzzAttempt: 0,      // anti-spam: timestamp of last buzz press
  buzzCooldownUntil: 0,
  // Host can manually edit any player's score
  editingScorePlayerId: null,
  scoreEditInputValue: '',
  // Format help modal
  showFormatHelp: false,
  showChangelog: false,
  // Chat
  chatOpen: false,
  chatInputLocal: '',
  chatLastSeenTs: 0,
  lastRenderHash: '',
  _pendingRenderTimer: null,
  unsubscribeRoom: null,
};

// ============== LS HELPERS ==============
const LS_CODE = 'quiz:code';
const LS_AVATAR = 'quiz:avatar';
const LS_NAME = 'quiz:name';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k,v) => { try { localStorage.setItem(k,v); } catch {} };
const lsDel = k => { try { localStorage.removeItem(k); } catch {} };

// ============== HELPERS ==============
function esc(s){
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Like esc() but normalises literal "\n" into real line breaks. Pair with a
// container that has `white-space: pre-wrap` so the breaks render.
function escMultiline(s){
  if (s == null) return '';
  return esc(String(s).replace(/\\n/g, '\n'));
}
function genCode(){
  let s=''; for(let i=0;i<4;i++) s += CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]; return s;
}
function genId(){ return Math.random().toString(36).slice(2,12); }

// ============== STORAGE LAYER (Firebase) ==============
async function getRoom(code){
  if (!db) return null;
  try {
    const snap = await get(ref(db, `rooms/${code}`));
    return snap.exists() ? snap.val() : null;
  } catch (e) { console.error('getRoom', e); return null; }
}
async function setRoomFull(code, room){
  if (!db) return false;
  try { await set(ref(db, `rooms/${code}`), room); return true; }
  catch (e) { console.error('setRoom', e); return false; }
}
async function updateRoom(code, patch){
  if (!db) return false;
  try { await update(ref(db, `rooms/${code}`), patch); return true; }
  catch (e) { console.error('updateRoom', e); return false; }
}
async function deleteRoom(code){
  if (!db) return;
  try { await remove(ref(db, `rooms/${code}`)); } catch (e) { console.error(e); }
}
function listenRoom(code, callback){
  if (!db) return () => {};
  const r = ref(db, `rooms/${code}`);
  const unsub = onValue(r, snap => callback(snap.val()));
  return () => off(r);
}

// Packs storage (per-user)
async function listPacks(){
  if (!db || !state.myId) return [];
  try {
    const snap = await get(ref(db, `users/${state.myId}/packs`));
    if (!snap.exists()) return [];
    const obj = snap.val();
    return Object.entries(obj).map(([id, val]) => ({id, ...val}))
      .sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  } catch (e) { console.error('listPacks', e); return []; }
}
async function savePack(name, pack){
  if (!db) throw new Error('Firebase не ініціалізований');
  if (!state.myId) throw new Error('Користувач не авторизований');
  const id = genId();
  // Sanitize: Firebase forbids undefined. Convert all undefined → null.
  const cleanPack = {
    name: pack.name || name,
    categories: (pack.categories || []).map(c => ({
      name: c.name || '',
      questions: (c.questions || []).map(q => ({
        value: q.value,
        q: q.q || '',
        a: q.a || '',
        explanation: q.explanation || null,
        image: q.image || null,
        answerImage: q.answerImage || null,
      }))
    }))
  };
  const data = { name, pack: cleanPack, createdAt: Date.now() };
  // Estimate size
  const jsonSize = JSON.stringify(data).length;
  console.log('[savePack] size:', (jsonSize / 1024 / 1024).toFixed(2), 'MB');
  if (jsonSize > 9_000_000) {
    throw new Error(`Пак занадто великий (${(jsonSize/1024/1024).toFixed(1)}МБ). Firebase обмежує до ~10МБ на запис. Зменши кількість/розмір картинок.`);
  }
  await set(ref(db, `users/${state.myId}/packs/${id}`), data);
  return {id, ...data};
}
async function deletePack(id){
  if (!db || !state.myId) return;
  try { await remove(ref(db, `users/${state.myId}/packs/${id}`)); }
  catch (e) { console.error(e); }
}

// ============== IMAGE COMPRESSION ==============
async function fileToCompressedDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_IMG_SIZE || height > MAX_IMG_SIZE) {
          const scale = Math.min(MAX_IMG_SIZE/width, MAX_IMG_SIZE/height);
          width = Math.round(width*scale);
          height = Math.round(height*scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,width,height);
        ctx.drawImage(img, 0, 0, width, height);
        // Try JPEG with decreasing quality until under target
        let q = 0.85;
        let url = canvas.toDataURL('image/jpeg', q);
        while (url.length > MAX_IMG_BYTES * 1.37 /* base64 overhead */ && q > 0.3) {
          q -= 0.1;
          url = canvas.toDataURL('image/jpeg', q);
        }
        resolve(url);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============== FILE PARSING ==============
async function parseTextToPack(text){
  // Format:
  // # Категорія
  // 200 | Питання | Відповідь
  // 400 | Питання | Відповідь
  // ...
  //
  // OR:
  // КАТЕГОРІЯ: Назва
  // 200 | Питання | Відповідь
  const rawLines = text.split(/\r?\n/);
  // Pre-process: merge continuation lines into the previous Q-line.
  // A "continuation" is a line that:
  //   - has content
  //   - is NOT a category marker (#, КАТЕГОРІЯ:, ==...==)
  //   - does NOT start with "<number> |" (i.e. is not a new question)
  // Such lines get appended to the previous question line with a space.
  const lines = [];
  const isCatMarker = l => /^#\s*.+/.test(l) || /^категорія\s*[:\-]/i.test(l) || /^==+\s*.+?\s*==+$/.test(l);
  const isQStart = l => /^\s*\d+\s*\|/.test(l);
  for (let raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;
    if (isCatMarker(line) || isQStart(line) || lines.length === 0) {
      lines.push(line);
    } else {
      // Continuation — append to the last accumulated line if it is a Q line
      const lastIdx = lines.length - 1;
      if (isQStart(lines[lastIdx])) {
        lines[lastIdx] = lines[lastIdx] + ' ' + line;
      } else {
        // Stray text before any Q — ignore
      }
    }
  }
  const cats = [];
  let cur = null;
  for (let line of lines) {
    // Category markers
    let catName = null;
    const m1 = line.match(/^#\s*(.+)$/);
    const m2 = line.match(/^категорія\s*[:\-]\s*(.+)$/i);
    const m3 = line.match(/^==+\s*(.+?)\s*==+$/);
    if (m1) catName = m1[1].trim();
    else if (m2) catName = m2[1].trim();
    else if (m3) catName = m3[1].trim();
    if (catName) {
      cur = { name: catName, questions: [] };
      cats.push(cur);
      continue;
    }
    // Question line: value | q | a
    const parts = line.split(/\s*\|\s*/);
    if (parts.length >= 3 && cur) {
      const value = parseInt(parts[0], 10);
      if (!isNaN(value)) {
        // Allow `\n` (literal backslash-n) in the source to mean a line break,
        // so authors can list items in a column inside a question or answer.
        const unescapeBreaks = (s) => s.replace(/\\n/g, '\n');
        const rawAnswer = parts.slice(2).join(' | ').trim();
        // Split answer and optional explanation on the first `//`
        let answerText = rawAnswer, explanation = '';
        const slashIdx = rawAnswer.indexOf('//');
        if (slashIdx !== -1) {
          answerText = rawAnswer.slice(0, slashIdx).trim();
          explanation = rawAnswer.slice(slashIdx + 2).trim();
        }
        const qObj = {
          value,
          q: unescapeBreaks(parts[1].trim()),
          a: unescapeBreaks(answerText)
        };
        if (explanation) qObj.explanation = unescapeBreaks(explanation);
        cur.questions.push(qObj);
      }
    }
  }
  // Ensure 5 questions per category with standard values
  const result = { categories: cats.map(c => normalizeCategory(c)) };
  return result;
}

function normalizeCategory(cat){
  // Sort questions by value, fill missing with standard VALUES
  const sorted = (cat.questions||[]).sort((a,b)=>a.value-b.value);
  const questions = [];
  for (let i=0; i<QS_PER_CAT; i++){
    const v = VALUES[i];
    const found = sorted.find(q => q.value === v) || sorted[i];
    if (found) {
      questions.push({ value: v, q: found.q, a: found.a, explanation: found.explanation || null, image: found.image, answerImage: found.answerImage });
    } else {
      questions.push({ value: v, q: '', a: '', explanation: null, image: null, answerImage: null });
    }
  }
  return { name: cat.name, questions };
}

async function parseDocxFile(file){
  const arrayBuffer = await file.arrayBuffer();
  // Mammoth extracts text + images. We'll get HTML to preserve image positions.
  const opts = {
    convertImage: window.mammoth.images.imgElement(image => {
      return image.read("base64").then(imageBuffer => {
        return { src: `data:${image.contentType};base64,${imageBuffer}` };
      });
    })
  };
  const result = await window.mammoth.convertToHtml({arrayBuffer}, opts);
  const html = result.value;
  console.log('[parseDocx] mammoth HTML length:', html.length);
  // Parse HTML
  const div = document.createElement('div');
  div.innerHTML = html;
  // Walk top-level children: collect {text, images} per block.
  // Keep empty blocks too — they may contain only an image, which we need to
  // attach to the nearest question line above or below.
  const rawBlocks = [];
  div.childNodes.forEach(node => {
    if (node.nodeType === 1) {
      const text = node.textContent.trim();
      const imgs = Array.from(node.querySelectorAll('img')).map(img => img.src);
      if (text || imgs.length) rawBlocks.push({text, images: imgs});
    }
  });

  // Merge continuation blocks: if a block has text but is not a category marker
  // and not a Q-start (no "<num> |" prefix), append its text to the previous
  // Q block — and merge images into the previous block too.
  const isCatMarker = l => /^#\s*.+/.test(l) || /^категорія\s*[:\-]/i.test(l) || /^==+\s*.+?\s*==+$/.test(l);
  const isQStart = l => /^\s*\d+\s*\|/.test(l);
  const lines = [];
  for (const b of rawBlocks) {
    const text = b.text;
    if (!text && b.images.length) {
      // Pure image block — keep as-is for later positional attachment
      lines.push(b);
    } else if (isCatMarker(text) || isQStart(text) || lines.length === 0) {
      lines.push({ text, images: [...b.images] });
    } else {
      // Continuation: append text + images to the last Q block we have.
      // Join with a newline so multi-paragraph questions/answers keep their
      // column layout (authors often list items on separate lines in Word).
      const lastIdx = lines.length - 1;
      if (isQStart(lines[lastIdx].text)) {
        lines[lastIdx].text = lines[lastIdx].text + '\n' + text;
        lines[lastIdx].images.push(...b.images);
      } else {
        // No Q to merge into — keep block separate, will be ignored later
        lines.push({ text, images: [...b.images] });
      }
    }
  }

  const totalImagesFound = lines.reduce((a,l)=>a+l.images.length, 0);
  console.log('[parseDocx] raw blocks:', rawBlocks.length, 'after merge:', lines.length, 'images:', totalImagesFound);

  // Build text and parse first (without images). Inner line breaks inside a Q
  // block are escaped to literal \n so parseTextToPack keeps them on one line;
  // parseTextToPack turns \n back into real breaks for display.
  const fullText = lines.map(l => l.text.replace(/\n/g, '\\n')).join('\n');
  const pack = await parseTextToPack(fullText);

  // Now walk the block list and attach images.
  // Rules:
  //   - In a Q-line block: img[0] -> question, img[1] -> answer
  //   - A pure-image block IMMEDIATELY AFTER a Q-line: attach to that Q's answer
  //     (if question doesn't have an answer image yet)
  //   - A pure-image block before any Q-line in a category: attach to NEXT Q's question
  let curCat = -1;
  let lastQRef = null; // {q, blockIdx} — for attaching following image-only blocks to answer
  let pendingForQuestion = []; // image-only blocks that come BEFORE next Q-line

  for (let i = 0; i < lines.length; i++) {
    const item = lines[i];
    const line = item.text.trim();
    const isCat = /^#|^категорія|^==/i.test(line);

    if (isCat) {
      curCat++;
      pendingForQuestion = [];
      lastQRef = null;
      continue;
    }

    const parts = line ? line.split(/\s*\|\s*/) : [];
    const looksLikeQ = parts.length >= 3 && !isNaN(parseInt(parts[0], 10));

    if (looksLikeQ && curCat >= 0 && curCat < pack.categories.length) {
      const value = parseInt(parts[0], 10);
      const cat = pack.categories[curCat];
      const q = cat.questions.find(qq => qq.value === value);
      if (q) {
        // Rule (predictable):
        //   - Image(s) INLINE with the "200 | ... | ..." line → all go to QUESTION
        //     (first one wins if multiple, others discarded)
        //   - Image(s) in a SEPARATE paragraph BEFORE this line → also go to QUESTION
        //     (e.g. picture above the line)
        //   - Image(s) in a SEPARATE paragraph AFTER this line (before next Q) → ANSWER
        //   Handled below via `lastQRef` and `pendingForQuestion`.
        const imgs = item.images;
        if (imgs.length >= 1) {
          // Image inline with Q-line goes to QUESTION
          try { q.image = await compressDataUrl(imgs[0]); }
          catch (e) { q.image = imgs[0]; }
        } else if (pendingForQuestion.length) {
          // No inline image — pull from pending images-above-this-Q
          const pImg = pendingForQuestion.shift().image;
          try { q.image = await compressDataUrl(pImg); }
          catch (e) { q.image = pImg; }
        }
        lastQRef = { q, blockIdx: i };
        pendingForQuestion = [];
      }
    } else if (item.images.length && !line) {
      // Pure image block.
      // If we just saw a Q-line, this image is for that Q's ANSWER.
      // If no recent Q-line (we're at start of category, between categories,
      // or right after answers were attached), save it for the NEXT question.
      if (lastQRef && !lastQRef.q.answerImage) {
        try { lastQRef.q.answerImage = await compressDataUrl(item.images[0]); }
        catch (e) { lastQRef.q.answerImage = item.images[0]; }
        lastQRef = null; // one answer image per question
      } else {
        pendingForQuestion.push({ blockIdx: i, image: item.images[0] });
      }
    }
  }

  // Log summary
  const totalAttachedQ = pack.categories.reduce((a,c)=>a + c.questions.filter(q=>q.image).length, 0);
  const totalAttachedA = pack.categories.reduce((a,c)=>a + c.questions.filter(q=>q.answerImage).length, 0);
  console.log('[parseDocx] attached to Q:', totalAttachedQ, 'to A:', totalAttachedA, 'total found:', totalImagesFound);

  return pack;
}

async function compressDataUrl(dataUrl){
  // Re-encode and compress
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_IMG_SIZE || height > MAX_IMG_SIZE) {
        const scale = Math.min(MAX_IMG_SIZE/width, MAX_IMG_SIZE/height);
        width = Math.round(width*scale); height = Math.round(height*scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height);
      ctx.drawImage(img, 0, 0, width, height);
      let q = 0.85;
      let url = canvas.toDataURL('image/jpeg', q);
      while (url.length > MAX_IMG_BYTES * 1.37 && q > 0.3) { q -= 0.1; url = canvas.toDataURL('image/jpeg', q); }
      resolve(url);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ============== AI GENERATION (better prompt) ==============
async function generateAIPack(topics){
  if (!CONFIG.anthropicApiKey) throw new Error('AI вимкнено: не вказано anthropicApiKey у config.js');
  const cleanTopics = topics.filter(t => t && t.trim()).map(t => t.trim());
  if (cleanTopics.length < CATS_PER_BOARD) throw new Error('Потрібно ' + CATS_PER_BOARD + ' тем');

  const prompt = `Ти створюєш квіз у форматі "Своя гра" / Jeopardy українською мовою.

Категорії: ${cleanTopics.join(', ')}

Для КОЖНОЇ категорії згенеруй РІВНО 5 питань зі зростаючою складністю:
- 200 балів — найпростіше (загальновідомий факт)
- 400 балів — легке
- 600 балів — середнє
- 800 балів — складне (треба знати тему)
- 1000 балів — найскладніше (для фанатів/експертів)

КРИТИЧНО ВАЖЛИВІ ПРАВИЛА:
1. Відповідь НЕ МАЄ зустрічатися у тексті питання. Жодних слів з відповіді в питанні!
   ❌ ПОГАНО: q="Як звати Ерена Єгера?" a="Ерен Єгер"
   ❌ ПОГАНО: q="У якому році заснували Київ?" a="Київ заснували в 482 році"
   ✅ ДОБРЕ: q="Як звати головного героя «Атаки титанів»?" a="Ерен Єгер"
   ✅ ДОБРЕ: q="У якому році заснували столицю України?" a="482"

2. Питання мають бути КОНКРЕТНІ, з чіткою однозначною відповіддю.
   ❌ ПОГАНО: "Розкажи про Україну" (надто широко)
   ✅ ДОБРЕ: "Хто був першим президентом незалежної України?"

3. Відповідь — КОРОТКА (1-5 слів зазвичай), без зайвих слів.
   ❌ ПОГАНО: a="Це Тарас Григорович Шевченко, відомий український поет"
   ✅ ДОБРЕ: a="Тарас Шевченко"

4. Питання РІЗНІ — без повторів, без перефразувань тієї ж ідеї.

5. Якщо тема — конкретний предмет (фільм/гра/книга), питання мають бути ПРО ЦЕЙ ПРЕДМЕТ
   (його сюжет, персонажів, факти про створення), а не загальні питання поряд з ним.

Поверни ЛИШЕ JSON, без коментарів і без markdown-обгорток. Формат:
{
  "categories":[
    {"name":"...","questions":[
      {"value":200,"q":"...","a":"..."},
      {"value":400,"q":"...","a":"..."},
      {"value":600,"q":"...","a":"..."},
      {"value":800,"q":"...","a":"..."},
      {"value":1000,"q":"...","a":"..."}
    ]}
  ]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-api-key": CONFIG.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{role:"user", content: prompt}]
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('API error ' + res.status + ': ' + errText.slice(0, 200));
  }
  const data = await res.json();
  const text = (data.content||[]).map(b=>b.text||'').join('').trim();
  const clean = text.replace(/```json|```/g,'').trim();
  const pack = JSON.parse(clean);
  if (!pack.categories || !Array.isArray(pack.categories)) throw new Error('AI повернув неправильний формат');

  // Post-validation: flag bad questions
  const issues = [];
  pack.categories.forEach((cat, ci) => {
    if (!cat.questions || cat.questions.length < QS_PER_CAT) {
      issues.push(`Категорія "${cat.name}": неповно питань`);
      return;
    }
    cat.questions.forEach((q, qi) => {
      if (!q.q || !q.a) { issues.push(`${cat.name} ${q.value}: пусте поле`); return; }
      // Check if answer words appear in question
      const ans = q.a.toLowerCase();
      const qLow = q.q.toLowerCase();
      const ansWords = ans.split(/\s+/).filter(w => w.length > 3);
      const found = ansWords.find(w => qLow.includes(w));
      if (found) {
        issues.push(`${cat.name} ${q.value}: слово "${found}" зустрічається у питанні`);
      }
    });
  });

  return { pack, issues };
}

function emptyManualPack(){
  return {
    categories: Array.from({length: CATS_PER_BOARD}, () => ({
      name: '', questions: VALUES.map(v => ({value: v, q: '', a: '', image: null, answerImage: null}))
    }))
  };
}

// ============== ICONS ==============
function icon(name, size=18){
  const paths = {
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    crown: '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>',
    sparkles: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    loader: '<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    trophy: '<line x1="6" y1="9" x2="6" y2="2"/><line x1="18" y1="9" x2="18" y2="2"/><path d="M6 9a6 6 0 0 0 12 0"/><line x1="9" y1="22" x2="15" y2="22"/><line x1="12" y1="15" x2="12" y2="22"/>',
    package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    wand: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h.01M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
}

// ============== RENDER LAYER ==============
function computeHash(){
  const r = state.room;
  return JSON.stringify({
    screen: state.screen, sub: state.subScreen, src: state.setupSource,
    preview: !!state.setupAiPreview, filePack: !!state.setupFilePack,
    err: state.err, setupErr: state.setupErr,
    loading: state.loading, setupLoading: state.setupLoading,
    copied: state.copied, authReady: state.authReady,
    joinAvatar: state.joinAvatar, hostAvatar: state.hostAvatar,
    savedPacks: state.savedPacks.length,
    setupRoundsTotal: state.setupRoundsTotal,
    setupCurrentRound: state.setupCurrentRound,
    editingRound: state.editingRound,
    roundPacksReady: Object.keys(state.setupRoundPacks || {}).join(','),
    setupBuzzSeconds: state.setupBuzzSeconds,
    setupAnswerSeconds: state.setupAnswerSeconds,
    setupBuzzMode: state.setupBuzzMode,
    setupAntiSpam: state.setupAntiSpam,
    setupCountdownSeconds: state.setupCountdownSeconds,
    setupFinalQ: state.setupFinalQ,
    editingScorePlayerId: state.editingScorePlayerId,
    showFormatHelp: state.showFormatHelp,
    showChangelog: state.showChangelog,
    chatOpen: state.chatOpen,
    chatCount: r && r.chat ? Object.keys(r.chat).length : 0,
    room: r ? {
      status: r.status, hostId: r.hostId,
      players: r.players, currentCell: r.currentCell,
      buzzedPlayer: r.buzzedPlayer, attemptedBy: r.attemptedBy,
      questionState: r.questionState, currentPicker: r.currentPicker,
      usedCells: r.usedCells, revealAnswer: r.revealAnswer,
      packLoaded: !!(r.pack && r.pack.categories),
      currentRound: r.currentRound, roundsTotal: r.roundsTotal,
      finalQ: r.finalQ, finalBids: r.finalBids, finalJudgement: r.finalJudgement,
      finalRevealIndex: r.finalRevealIndex, finalBaseScores: r.finalBaseScores,
    } : null,
  });
}

function render(force){
  const newHash = computeHash();
  if (!force && newHash === state.lastRenderHash) return;

  // If the user is actively typing in a text field and this isn't a forced
  // render, defer the re-render slightly so their cursor doesn't jump. A pending
  // render is scheduled; the newest state will be drawn once typing settles.
  if (!force) {
    const a = document.activeElement;
    const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a.id !== 'score-edit-input';
    if (typing) {
      if (state._pendingRenderTimer) clearTimeout(state._pendingRenderTimer);
      state._pendingRenderTimer = setTimeout(() => {
        state._pendingRenderTimer = null;
        render(true);
      }, 1200);
      // Still update the hash so we don't lose the change
      state.lastRenderHash = newHash;
      return;
    }
  }
  if (state._pendingRenderTimer) { clearTimeout(state._pendingRenderTimer); state._pendingRenderTimer = null; }
  state.lastRenderHash = newHash;

  const active = document.activeElement;
  const focusId = active && active.id ? active.id : null;
  const focusData = active && active.dataset ? {name: active.dataset.name, key: active.dataset.key} : null;
  const selStart = active && active.selectionStart != null ? active.selectionStart : null;
  const selEnd = active && active.selectionEnd != null ? active.selectionEnd : null;

  const appEl = document.getElementById('app');
  let html = '';

  if (!FIREBASE_CONFIGURED) {
    html = viewSetupNeeded();
  } else if (!state.authReady) {
    html = `<div class="center-screen"><span class="spin" style="color:var(--gold);">${icon('loader',32)}</span><div style="margin-top:16px; color:var(--ink-dim);">Підключення...</div></div>`;
  } else if (state.subScreen === 'modeSelect' && state.isHost) {
    html = viewModeSelect();
  } else if (state.subScreen === 'questionSetup' && state.isHost) {
    html = viewQuestionSetup();
  } else if (state.subScreen === 'finalSetup' && state.isHost) {
    html = viewFinalSetup();
  } else if (state.room && state.room.status === 'round_done') {
    html = viewRoundDone();
  } else if (state.room && state.room.status === 'final_bid') {
    html = viewFinalBid();
  } else if (state.room && state.room.status === 'final_answer') {
    html = viewFinalAnswer();
  } else if (state.room && state.room.status === 'final_reveal') {
    html = viewFinalReveal();
  } else {
    switch(state.screen) {
      case 'home': html = viewHome(); break;
      case 'join': html = viewJoin(); break;
      case 'hostSetup': html = viewHostSetup(); break;
      case 'lobby': html = viewLobby(); break;
      case 'board': html = viewBoard(); break;
      case 'question': html = viewQuestion(); break;
      case 'results': html = viewResults(); break;
      default: html = viewHome();
    }
  }

  // Overlay: score edit modal (host only)
  if (state.editingScorePlayerId && state.isHost && state.room && state.room.players) {
    html += viewScoreEditModal();
  }
  // Overlay: format help modal
  if (state.showFormatHelp) {
    html += viewFormatHelpModal();
  }
  // Overlay: changelog modal
  if (state.showChangelog) {
    html += viewChangelogModal();
  }
  // Always-present version badge (top-right)
  html += `<button class="version-badge" data-action="show-changelog" title="Що нового">v${APP_VERSION}</button>`;
  // Chat widget — visible whenever inside a room
  if (state.room && state.code) {
    html += viewChatWidget();
  }

  appEl.innerHTML = html;
  attachListeners();

  // While chat is open, mark all current messages as seen
  if (state.chatOpen && state.room && state.room.chat) {
    const msgs = Object.values(state.room.chat);
    const maxTs = msgs.reduce((m, x) => Math.max(m, x.ts || 0), 0);
    if (maxTs > state.chatLastSeenTs) state.chatLastSeenTs = maxTs;
  }

  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus(); try { if (selStart != null) el.setSelectionRange(selStart, selEnd); } catch(_){} }
  } else if (focusData && focusData.name) {
    const el = document.querySelector(`[data-name="${focusData.name}"][data-key="${focusData.key}"]`);
    if (el) { el.focus(); try { if (selStart != null) el.setSelectionRange(selStart, selEnd); } catch(_){} }
  }
}

function viewSetupNeeded(){
  return `
    <div class="container slide-up" style="margin-top:48px;">
      <div class="eyebrow">QUIZ NIGHT</div>
      <h1 style="font-family:'Fraunces',serif; font-size:48px; font-weight:900; margin-bottom:24px;">
        Налаштування потрібне
      </h1>
      <div class="setup-warning">
        <b>Firebase не налаштовано.</b> Відкрий файл <code>config.js</code> і встав свій Firebase config.
        Інструкція в <code>README.md</code>.
        <br><br>
        Без Firebase мультиплеєр не запрацює — це нормально, треба підключити безкоштовну БД.
      </div>
    </div>
  `;
}

function viewHome(){
  return `
    <div class="center-screen slide-up">
      <div style="text-align:center; margin-bottom: 48px;">
        <div class="eyebrow">QUIZ NIGHT • ОНЛАЙН</div>
        <h1 class="hero-title">Своя<br><em>Гра</em></h1>
        <p class="hero-sub">Квіз для компанії у форматі Jeopardy. Дошка 6×5, до 3 раундів + фінал зі ставками. Хто перший натиснув — той відповідає.</p>
      </div>
      <div class="options-row">
        <button class="btn btn-accent btn-lg" style="flex:1" data-action="go-host">${icon('plus',20)} Створити кімнату</button>
        <button class="btn btn-ghost btn-lg" style="flex:1" data-action="go-join">${icon('users',20)} Долучитися</button>
      </div>
      <button class="btn btn-ghost btn-sm" data-action="show-format-help" style="margin-top:16px; background:transparent; border:none; color:var(--ink-dim);">
        ${icon('eye',14)} Як зробити свій пак з питаннями?
      </button>
    </div>
  `;
}

function viewJoin(){
  const savedName = state.joinNameInput || lsGet(LS_NAME) || '';
  return `
    <button class="back-btn" data-action="go-home">${icon('arrowLeft',16)} Назад</button>
    <div class="container-sm slide-up">
      <h2 style="font-family:'Fraunces',serif; font-size:48px; font-weight:700; margin-bottom:8px;">Долучитися</h2>
      <p style="color:var(--ink-dim); margin-bottom:40px;">Введи код кімнати від ведучого</p>
      <input class="input input-code" id="join-code" maxlength="4" placeholder="ABCD" autocomplete="off" value="${esc(state.joinCodeInput)}">
      <input class="input" id="join-name" maxlength="20" placeholder="Твій нікнейм" style="text-align:center; margin-top:32px;" autocomplete="off" value="${esc(savedName)}">
      <div style="margin-top:24px;">
        <div style="font-size:11px; color:var(--ink-dim); margin-bottom:8px; text-align:center;">Аватар</div>
        <div class="avatar-grid">
          ${AVATARS.map(a => `<button class="avatar-btn ${state.joinAvatar===a?'active':''}" data-action="join-avatar" data-avatar="${a}">${a}</button>`).join('')}
        </div>
      </div>
      ${state.err ? `<div class="err-text">${esc(state.err)}</div>` : ''}
      <button class="btn btn-accent btn-lg btn-full" data-action="do-join" ${state.loading?'disabled':''} style="margin-top:32px;">
        ${state.loading ? `<span class="spin">${icon('loader',18)}</span>` : icon('chevronRight',18)} Зайти в кімнату
      </button>
    </div>
  `;
}

function viewHostSetup(){
  const savedName = state.hostNameInput || lsGet(LS_NAME) || '';
  return `
    <button class="back-btn" data-action="go-home">${icon('arrowLeft',16)} Назад</button>
    <div class="container-sm slide-up">
      <div class="host-badge">${icon('crown',14)} ВЕДУЧИЙ</div>
      <h2 style="font-family:'Fraunces',serif; font-size:48px; font-weight:700; margin-bottom:8px;">Нова кімната</h2>
      <p style="color:var(--ink-dim); margin-bottom:40px;">Ти керуєш грою: відкриваєш питання і вирішуєш чи правильна відповідь</p>
      <input class="input" id="host-name" maxlength="20" placeholder="Твій нікнейм" style="text-align:center;" autocomplete="off" value="${esc(savedName)}">
      <div style="margin-top:24px;">
        <div style="font-size:11px; color:var(--ink-dim); margin-bottom:8px; text-align:center;">Аватар</div>
        <div class="avatar-grid">
          ${AVATARS.map(a => `<button class="avatar-btn ${state.hostAvatar===a?'active':''}" data-action="host-avatar" data-avatar="${a}">${a}</button>`).join('')}
        </div>
      </div>
      ${state.err ? `<div class="err-text">${esc(state.err)}</div>` : ''}
      <button class="btn btn-accent btn-lg btn-full" data-action="do-host-create" style="margin-top:32px;">${icon('sparkles',18)} Створити</button>
    </div>
  `;
}

function viewLobby(){
  const r = state.room;
  if (!r) return `<div class="center-screen"><span class="spin">${icon('loader',32)}</span></div>`;
  const players = r.players || {};
  const playerList = Object.values(players);

  return `
    <div class="container slide-up">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px;">
        <button class="back-btn" style="margin:0;" data-action="leave">${icon('x',16)} Вийти</button>
        <div class="code-display">
          <div class="code-label">КОД КІМНАТИ</div>
          <button class="code-value" data-action="copy-code">
            ${esc(state.code)} ${state.copied ? `<span style="color:var(--green)">${icon('check',20)}</span>` : `<span style="opacity:0.5">${icon('copy',18)}</span>`}
          </button>
        </div>
      </div>
      <div class="card" style="margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-family:'Fraunces',serif; font-size:24px; font-weight:700;">Гравці</h3>
          <div style="font-size:14px; color:var(--ink-dim);">${playerList.length}</div>
        </div>
        <div class="players-grid">
          ${playerList.map(p => `
            <div class="player-card ${p.id===state.myId?'me':''}">
              <span class="player-avatar">${p.avatar}</span>
              <div class="player-name">
                <span class="name-text">${esc(p.name)}</span>
                ${p.id === r.hostId ? `<span style="color:var(--gold); flex-shrink:0;">${icon('crown',12)}</span>` : ''}
              </div>
              ${state.isHost && p.id !== r.hostId && p.id !== state.myId ? `
                <button class="kick-btn" data-action="kick-player" data-player="${p.id}" title="Видалити гравця">${icon('x',14)}</button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      ${state.isHost ? `
        ${(() => {
          const rt = state.setupRoundsTotal;
          const collected = Object.keys(state.setupRoundPacks || {}).length;
          const inProgress = rt && collected > 0;
          return `<button class="btn btn-gold btn-lg btn-full" data-action="go-mode-select">${icon('play',18)} ${inProgress ? `Продовжити налаштування (${collected}/${rt} паків)` : 'Налаштувати гру та почати'}</button>`;
        })()}
      ` : `
        <div class="card" style="text-align:center; padding:40px;">
          <span class="spin" style="color:var(--gold);">${icon('loader',32)}</span>
          <div style="font-family:'Fraunces',serif; font-size:22px; font-weight:700; margin-top:12px;">Очікуємо ведучого...</div>
          <div style="color:var(--ink-dim); font-size:13px; margin-top:8px;">Ведучий обирає категорії та питання</div>
        </div>
      `}
    </div>
  `;
}

function viewModeSelect(){
  const r = state.room;
  const buzzOpts = [10, 20, 30, 45, 60];
  const answerOpts = [5, 10, 15, 20, 30];
  const renderChips = (opts, cur, action) => opts.map(v =>
    `<button class="timer-chip ${cur === v ? 'active' : ''}" data-action="${action}" data-sec="${v}">${v}с</button>`
  ).join('');
  const rt = state.setupRoundsTotal;
  const packs = state.setupRoundPacks || {};
  const fq = state.setupFinalQ || {};
  const finalReady = !!(fq.category?.trim() && fq.q?.trim() && fq.a?.trim());
  // All round packs collected?
  let allRoundsReady = false;
  if (rt) {
    allRoundsReady = true;
    for (let i = 1; i <= rt; i++) if (!packs[i]) allRoundsReady = false;
  }

  return `
    <button class="back-btn" data-action="leave-mode-select">${icon('arrowLeft',16)} Назад в лоббі</button>
    <div class="container slide-up">
      <h2 style="font-family:'Fraunces',serif; font-size:36px; font-weight:700; margin-bottom:8px;">Налаштування гри</h2>
      <p style="color:var(--ink-dim); margin-bottom:24px;">Обери кількість раундів, завантаж паки і налаштуй таймери. Старт — коли все готово.</p>

      <div style="font-size:13px; color:var(--ink-dim); margin-bottom:10px;">КІЛЬКІСТЬ РАУНДІВ</div>
      <div class="timer-chip-row" style="margin-bottom:20px;">
        ${[1,2,3].map(n => `<button class="timer-chip ${rt===n?'active':''}" data-action="pick-rounds" data-rounds="${n}" style="flex:1; padding:12px;">${n} ${n===1?'раунд':'раунди'}</button>`).join('')}
      </div>

      ${rt ? `
        <div style="font-size:13px; color:var(--ink-dim); margin-bottom:10px;">📦 ПАКИ ПИТАНЬ (по 6 категорій × 5)</div>
        <div style="display:grid; gap:10px; margin-bottom:20px;">
          ${Array.from({length: rt}, (_, i) => i+1).map(n => {
            const pk = packs[n];
            return `<button class="source-card" data-action="pick-round-pack" data-round="${n}">
              <div class="source-icon ${pk?'gold':'red'}">${pk ? icon('check',22) : icon('package',22)}</div>
              <div style="flex:1; min-width:0;">
                <div class="source-title">Раунд ${n} ${rt>1?`(бали ×${n})`:''}</div>
                <div class="source-sub">${pk ? `✓ ${esc(pk.name || 'пак готовий')} — ${pk.categories.length} категорій` : 'Натисни щоб завантажити пак'}</div>
              </div>
              ${pk ? `<span style="color:var(--ink-faint);">${icon('chevronRight',16)}</span>` : ''}
            </button>`;
          }).join('')}

          <button class="source-card" data-action="pick-final-setup">
            <div class="source-icon ${finalReady?'gold':'blue'}">${finalReady ? icon('check',22) : icon('crown',22)}</div>
            <div style="flex:1; min-width:0;">
              <div class="source-title">Фінальне питання</div>
              <div class="source-sub">${finalReady ? `✓ ${esc(fq.category)}` : 'Одне питання зі ставками (необовʼязково)'}</div>
            </div>
            <span style="color:var(--ink-faint);">${icon('chevronRight',16)}</span>
          </button>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:8px;">⏱ ЧАС НА НАТИСКАННЯ БАЗЕРА</div>
          <div class="timer-chip-row">${renderChips(buzzOpts, state.setupBuzzSeconds, 'set-buzz-sec')}</div>
          <div style="font-size:13px; color:var(--ink-dim); margin-top:16px; margin-bottom:8px;">⏱ ЧАС НА ВІДПОВІДЬ (після натискання)</div>
          <div class="timer-chip-row">${renderChips(answerOpts, state.setupAnswerSeconds, 'set-answer-sec')}</div>
          <div style="font-size:13px; color:var(--ink-dim); margin-top:16px; margin-bottom:8px;">🔔 КОЛИ ВІДКРИВАЄТЬСЯ БАЗЕР</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="timer-chip ${state.setupBuzzMode === 'instant' ? 'active' : ''}" data-action="set-buzz-mode" data-mode="instant" style="text-align:left;">⚡ Одразу при виборі питання</button>
            <button class="timer-chip ${state.setupBuzzMode === 'manual' ? 'active' : ''}" data-action="set-buzz-mode" data-mode="manual" style="text-align:left;">✋ Ведучий відкриває вручну</button>
            <button class="timer-chip ${state.setupBuzzMode === 'countdown' ? 'active' : ''}" data-action="set-buzz-mode" data-mode="countdown" style="text-align:left;">⏳ Автовідлік ${state.setupCountdownSeconds} сек, потім базер</button>
          </div>
          ${state.setupBuzzMode === 'countdown' ? `
            <div style="font-size:13px; color:var(--ink-dim); margin-top:12px; margin-bottom:8px;">Скільки секунд відліку перед базером:</div>
            <div class="timer-chip-row">${[1,3,5,7,10].map(v => `<button class="timer-chip ${state.setupCountdownSeconds===v?'active':''}" data-action="set-countdown-sec" data-sec="${v}">${v}с</button>`).join('')}</div>
          ` : ''}
          <div style="font-size:13px; color:var(--ink-dim); margin-top:16px; margin-bottom:8px;">🎯 РЕЖИМ НАТИСКАННЯ БАЗЕРА</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="timer-chip ${!state.setupAntiSpam ? 'active' : ''}" data-action="set-anti-spam" data-anti="0" style="text-align:left;">😎 Звичайний — хто перший натиснув, той відповідає</button>
            <button class="timer-chip ${state.setupAntiSpam ? 'active' : ''}" data-action="set-anti-spam" data-anti="1" style="text-align:left;">🔥 Хардкор — 1 сек кулдаун між натисканнями (антиспам)</button>
          </div>
        </div>

        ${state.setupErr ? `<div class="err-text" style="margin-bottom:12px;">${esc(state.setupErr)}</div>` : ''}

        <button class="btn ${allRoundsReady?'btn-accent':'btn-ghost'} btn-lg btn-full" data-action="start-all-rounds" ${!allRoundsReady?'disabled':''}>
          ${allRoundsReady ? `${icon('play',18)} Почати гру` : `Заваж паки для всіх ${rt} раундів`}
        </button>
        ${!finalReady && allRoundsReady ? `<div class="info-text" style="margin-top:12px;">💡 Фінальне питання не задане — гра завершиться без фіналу (можна додати пізніше).</div>` : ''}
      ` : `
        <div class="info-text">Обери кількість раундів, щоб продовжити.</div>
      `}
    </div>
  `;
}

function viewQuestionSetup(){
  const src = state.setupSource;
  const rt = state.setupRoundsTotal || 1;
  const cr = state.setupCurrentRound || 1;
  const mult = cr;
  const roundLabel = rt > 1 ? `РАУНД ${cr} З ${rt}${mult > 1 ? ` · ×${mult} БАЛИ` : ''}` : 'РАУНД';
  return `
    <button class="back-btn" data-action="leave-question-setup">${icon('arrowLeft',16)} ${cr === 1 ? 'Назад' : 'Скасувати'}</button>
    <div class="container slide-up">
      <div class="eyebrow" style="margin-bottom:8px;">${roundLabel}</div>
      ${!src ? `
        <h2 style="font-family:'Fraunces',serif; font-size:36px; font-weight:700; margin-bottom:8px;">Звідки питання?</h2>
        <p style="color:var(--ink-dim); margin-bottom:32px;">6 категорій × 5 питань${mult > 1 ? ` (бали ×${mult}: ${VALUES.map(v=>v*mult).join('/')})`: ' (200/400/600/800/1000)'}</p>
        <div style="display:grid; gap:12px;">
          <button class="source-card" data-action="set-source" data-source="saved">
            <div class="source-icon blue">${icon('folder',22)}</div>
            <div><div class="source-title">Мої збережені паки</div><div class="source-sub">${state.savedPacks.length} паків у твоїй БД</div></div>
          </button>
          <button class="source-card" data-action="set-source" data-source="preset">
            <div class="source-icon green">${icon('package',22)}</div>
            <div><div class="source-title">Готовий пак</div><div class="source-sub">Кіно, історія, наука, спорт, музика, географія</div></div>
          </button>
          <button class="source-card" data-action="set-source" data-source="file">
            <div class="source-icon purple">${icon('upload',22)}</div>
            <div><div class="source-title">Завантажити з файлу</div><div class="source-sub">.docx або .txt — з картинками</div></div>
          </button>
          ${CONFIG.anthropicApiKey ? `
          <button class="source-card" data-action="set-source" data-source="ai">
            <div class="source-icon red">${icon('wand',22)}</div>
            <div><div class="source-title">AI-генерація</div><div class="source-sub">Введи 6 тем — Claude складе пак</div></div>
          </button>` : ''}
          <button class="source-card" data-action="set-source" data-source="manual">
            <div class="source-icon gold">${icon('file',22)}</div>
            <div><div class="source-title">Свій пак вручну</div><div class="source-sub">Введи питання, додай картинки</div></div>
          </button>
        </div>
      ` : ''}
      ${src === 'saved' ? viewSetupSaved() : ''}
      ${src === 'preset' ? viewSetupPreset() : ''}
      ${src === 'file' ? viewSetupFile() : ''}
      ${src === 'ai' ? viewSetupAi() : ''}
      ${src === 'manual' ? viewSetupManual() : ''}
    </div>
  `;
}

function viewSetupSaved(){
  return `
    <button class="back-btn" data-action="set-source" data-source="">${icon('arrowLeft',14)} Інше джерело</button>
    <h2 style="font-family:'Fraunces',serif; font-size:32px; font-weight:700; margin-bottom:24px;">Мої збережені паки</h2>
    ${state.savedPacks.length === 0 ? `
      <div class="info-text">Поки немає збережених паків. Створи через AI, файл або вручну — і збережи з кнопкою «Зберегти в БД».</div>
    ` : `
      <div>
        ${state.savedPacks.map(p => `
          <div class="saved-pack">
            <div class="saved-pack-info" data-action="use-saved-pack" data-id="${p.id}" style="cursor:pointer;">
              <div class="saved-pack-name">${esc(p.name || 'Без назви')}</div>
              <div class="saved-pack-meta">${(p.pack?.categories||[]).length} категорій · ${new Date(p.createdAt||0).toLocaleDateString('uk')}</div>
            </div>
            <div class="saved-pack-actions">
              <button class="icon-btn" data-action="use-saved-pack" data-id="${p.id}" title="Використати">${icon('play',16)}</button>
              <button class="icon-btn danger" data-action="delete-pack" data-id="${p.id}" title="Видалити">${icon('trash',16)}</button>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

function viewSetupPreset(){
  const p = SAMPLE_PACK;
  return `
    <button class="back-btn" data-action="set-source" data-source="">${icon('arrowLeft',14)} Інше джерело</button>
    <h2 style="font-family:'Fraunces',serif; font-size:32px; font-weight:700; margin-bottom:24px;">Готовий пак</h2>
    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700; font-size:18px; margin-bottom:12px;">${esc(p.name)}</div>
      <div style="color:var(--ink-dim); font-size:14px; margin-bottom:16px;">${p.categories.length} категорій, ${p.categories.length*QS_PER_CAT} питань</div>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${p.categories.map(c => `<span style="background:var(--soft); padding:6px 12px; border-radius:999px; font-size:13px;">${esc(c.name)}</span>`).join('')}
      </div>
    </div>
    <button class="btn btn-gold btn-lg btn-full" data-action="start-preset" ${state.setupLoading?'disabled':''}>
      ${state.setupLoading ? `<span class="spin">${icon('loader',18)}</span>` : 'Підтвердити пак'}
    </button>
  `;
}

function viewSetupFile(){
  const p = state.setupFilePack;
  return `
    <button class="back-btn" data-action="set-source" data-source="">${icon('arrowLeft',14)} Інше джерело</button>
    <h2 style="font-family:'Fraunces',serif; font-size:32px; font-weight:700; margin-bottom:8px;">Завантажити з файлу</h2>
    <p style="color:var(--ink-dim); margin-bottom:24px;">Підтримуються <b>.docx</b> (з картинками) і <b>.txt</b></p>

    ${!p ? `
      <div class="dropzone" id="dropzone" data-action="open-file-picker">
        <div style="font-size:32px;">📄</div>
        <div class="dropzone-title">Натисни щоб обрати файл</div>
        <div class="dropzone-sub">або перетягни сюди .docx / .txt</div>
      </div>
      <input type="file" id="file-input" accept=".docx,.txt" style="display:none;">

      <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap; justify-content:center;">
        <button class="btn btn-ghost btn-sm" data-action="show-format-help">
          ${icon('eye',14)} Як зробити свій пак? (з шаблонами)
        </button>
      </div>

      ${state.setupErr ? `<div class="err-text">${esc(state.setupErr)}</div>` : ''}
      ${state.setupLoading ? `<div class="info-text"><span class="spin">${icon('loader',16)}</span> Парсимо файл...</div>` : ''}
    ` : `
      <div class="card parsed-preview" style="margin-bottom:16px;">
        <div style="font-size:14px; color:var(--ink-dim); margin-bottom:12px;">Знайдено: ${p.categories.length} категорій</div>
        ${p.categories.map(c => `
          <div class="parsed-cat">
            <div class="parsed-cat-name">${esc(c.name||'Без назви')}</div>
            ${c.questions.map(q => {
              const hasText = q.q && q.q.trim();
              const hasImage = !!q.image;
              let qDisplay;
              if (hasText) qDisplay = esc(q.q);
              else if (hasImage) qDisplay = '<i style="color:var(--gold);">📷 питання-картинка</i>';
              else qDisplay = '<span style="color:var(--accent);">(порожнє)</span>';
              const imgIcon = hasImage && hasText ? ` <span style="color:var(--gold);">📷</span>` : '';
              const hasAnsText = q.a && q.a.trim();
              const hasAnsImage = !!q.answerImage;
              let aDisplay;
              if (hasAnsText) aDisplay = esc(q.a);
              else if (hasAnsImage) aDisplay = '<i style="color:var(--gold);">📷 відповідь-картинка</i>';
              else aDisplay = '<span style="color:var(--accent);">(порожнє)</span>';
              const ansImgIcon = hasAnsImage && hasAnsText ? ` <span style="color:var(--gold);">📷</span>` : '';
              return `
                <div class="parsed-q">
                  <div><span class="v">${q.value}</span> · ${qDisplay}${imgIcon}</div>
                  <div class="a">✓ ${aDisplay}${ansImgIcon}</div>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>

      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <input class="input" id="save-pack-name" placeholder="Назва пака..." style="font-size:14px; padding:8px 0;" value="${esc(state.setupSavePackName)}">
        <button class="btn btn-ghost btn-sm" data-action="save-file-pack" style="white-space:nowrap;">${icon('save',14)} Зберегти в БД</button>
      </div>

      ${state.setupErr ? `<div class="err-text" style="white-space:pre-wrap; margin-bottom:12px;">${esc(state.setupErr)}</div>` : ''}

      <div style="display:flex; gap:12px;">
        <button class="btn btn-ghost btn-lg" style="flex:1;" data-action="reset-file">Інший файл</button>
        <button class="btn btn-gold btn-lg" style="flex:1;" data-action="start-file" ${state.setupLoading?'disabled':''}>
          ${state.setupLoading ? `<span class="spin">${icon('loader',18)}</span>` : 'Підтвердити'}
        </button>
      </div>
    `}
  `;
}

function viewSetupAi(){
  return `
    <button class="back-btn" data-action="set-source" data-source="">${icon('arrowLeft',14)} Інше джерело</button>
    <h2 style="font-family:'Fraunces',serif; font-size:32px; font-weight:700; margin-bottom:8px;">AI-генерація</h2>
    <p style="color:var(--ink-dim); margin-bottom:24px;">Введи 6 тем — Claude складе пак з 30 питань</p>
    ${!state.setupAiPreview ? `
      <div class="card" style="margin-bottom:16px;">
        ${state.setupAiTopics.map((t,i) => `
          <div class="cat-input-row">
            <div class="num">${i+1}</div>
            <input class="input" data-name="ai-topic" data-key="${i}" placeholder="напр. Dota 2, історія України, аніме..." value="${esc(t)}" autocomplete="off" style="font-size:15px; padding:8px 0;">
          </div>
        `).join('')}
      </div>
      ${state.setupErr ? `<div class="err-text">${esc(state.setupErr)}</div>` : ''}
      <button class="btn btn-accent btn-lg btn-full" data-action="ai-generate" ${state.setupLoading?'disabled':''}>
        ${state.setupLoading ? `<span class="spin">${icon('loader',18)}</span> Генерую 30 питань... (20-40 сек)` : `${icon('sparkles',18)} Згенерувати пак`}
      </button>
    ` : `
      <div class="card parsed-preview" style="margin-bottom:16px;">
        ${state.setupAiPreview.categories.map(c => `
          <div class="parsed-cat">
            <div class="parsed-cat-name">${esc(c.name)}</div>
            ${c.questions.map(q => `
              <div class="parsed-q">
                <div><span class="v">${q.value}</span> · ${esc(q.q)}</div>
                <div class="a">✓ ${esc(q.a)}</div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <input class="input" id="save-pack-name" placeholder="Назва пака для збереження..." style="font-size:14px; padding:8px 0;" value="${esc(state.setupSavePackName)}">
        <button class="btn btn-ghost btn-sm" data-action="save-ai-pack" style="white-space:nowrap;">${icon('save',14)} Зберегти в БД</button>
      </div>
      <div style="display:flex; gap:12px;">
        <button class="btn btn-ghost btn-lg" style="flex:1;" data-action="ai-clear">Згенерувати інше</button>
        <button class="btn btn-gold btn-lg" style="flex:1;" data-action="start-ai">Підтвердити</button>
      </div>
    `}
  `;
}

function viewSetupManual(){
  if (!state.setupManualPack) state.setupManualPack = emptyManualPack();
  const p = state.setupManualPack;
  return `
    <button class="back-btn" data-action="set-source" data-source="">${icon('arrowLeft',14)} Інше джерело</button>
    <h2 style="font-family:'Fraunces',serif; font-size:32px; font-weight:700; margin-bottom:8px;">Свій пак</h2>
    <p style="color:var(--ink-dim); margin-bottom:24px;">6 категорій × 5 питань. Натисни 📷 щоб додати картинку до питання або до відповіді.</p>
    ${p.categories.map((cat, ci) => `
      <div class="q-builder-card">
        <input class="input" data-name="cat-name" data-key="${ci}" placeholder="Назва категорії №${ci+1}..." value="${esc(cat.name)}" autocomplete="off" style="font-family:'Fraunces',serif; font-weight:700; font-size:18px; color:var(--gold); margin-bottom:12px; padding:6px 0;">
        ${cat.questions.map((q, qi) => `
          <div style="padding:8px 0; border-bottom: 1px solid var(--line);">
            <div class="q-builder-question">
              <div class="value-pill">${q.value}</div>
              <input class="q-text-input" data-name="manual-q" data-key="${ci}-${qi}" placeholder="Питання..." value="${esc(q.q)}" autocomplete="off">
            </div>
            <div class="q-image-row" style="margin-top:0;">
              ${q.image ? `
                <img src="${q.image}" class="q-image-thumb">
                <button class="q-image-clear" data-action="clear-image" data-key="${ci}-${qi}">${icon('x',14)}</button>
                <span style="color:var(--ink-dim);">картинка до питання</span>
              ` : `
                <button class="q-image-btn" data-action="add-image" data-key="${ci}-${qi}">${icon('image',12)} Картинка до питання</button>
              `}
            </div>
            <div class="q-builder-question" style="margin-left:46px; margin-bottom:0; margin-top:6px;">
              <input class="a-text-input" data-name="manual-a" data-key="${ci}-${qi}" placeholder="Відповідь..." value="${esc(q.a)}" autocomplete="off">
            </div>
            <div class="q-image-row">
              ${q.answerImage ? `
                <img src="${q.answerImage}" class="q-image-thumb">
                <button class="q-image-clear" data-action="clear-answer-image" data-key="${ci}-${qi}">${icon('x',14)}</button>
                <span style="color:var(--ink-dim);">картинка до відповіді</span>
              ` : `
                <button class="q-image-btn" data-action="add-answer-image" data-key="${ci}-${qi}">${icon('image',12)} Картинка до відповіді</button>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')}
    ${state.setupErr ? `<div class="err-text">${esc(state.setupErr)}</div>` : ''}
    <div style="display:flex; gap:8px; margin-bottom:12px; margin-top:16px;">
      <input class="input" id="save-pack-name" placeholder="Назва пака для збереження..." style="font-size:14px; padding:8px 0;" value="${esc(state.setupSavePackName)}">
      <button class="btn btn-ghost btn-sm" data-action="save-manual-pack" style="white-space:nowrap;">${icon('save',14)} Зберегти в БД</button>
    </div>
    <button class="btn btn-gold btn-lg btn-full" data-action="start-manual" ${state.setupLoading?'disabled':''}>
      ${state.setupLoading ? `<span class="spin">${icon('loader',18)}</span>` : 'Підтвердити пак'}
    </button>
    <input type="file" id="img-input" accept="image/*" style="display:none;">
  `;
}

function getPlayerList(r){
  if (!r || !r.players) return [];
  return Object.values(r.players);
}

function viewBoard(){
  const r = state.room;
  if (!r || !r.pack) return `<div class="center-screen"><span class="spin">${icon('loader',32)}</span></div>`;
  const players = getPlayerList(r);
  const nonHostPlayers = players.filter(p => p.id !== r.hostId);
  const picker = players.find(p => p.id === r.currentPicker);
  const isMyPick = r.currentPicker === state.myId;
  const canPick = state.isHost; // only host picks cells now
  const cats = r.pack.categories;

  return `
    <div class="container-lg slide-up">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
        <button class="back-btn" style="margin:0;" data-action="leave">${icon('x',16)} Вийти</button>
        <div style="display:flex; gap:8px; align-items:center;">
          ${r.roundsTotal > 1 ? `<div style="background:var(--gold); color:var(--bg); padding:4px 12px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:0.1em;">РАУНД ${r.currentRound}/${r.roundsTotal} · ×${r.currentRound}</div>` : ''}
          <div style="color:var(--ink-dim); font-size:13px;">Код: <b style="color:var(--gold);">${esc(state.code)}</b></div>
          ${state.isHost ? `<button class="btn btn-ghost btn-sm" data-action="end-game">${icon('trophy',14)} Завершити</button>` : ''}
        </div>
      </div>
      ${picker ? `
        <div class="picker-banner">
          ${isMyPick ? `<b>Обирають твоє питання!</b> Скажи ведучому яку клітинку` : `Обирає: <b>${esc(picker.avatar)} ${esc(picker.name)}</b>${state.isHost ? ' — натисни клітинку яку він назве' : ''}`}
        </div>
      ` : ''}
      <div class="board-wrap">
        <div class="board">
          ${cats.map(c => `<div class="board-header"><div class="cat-name">${esc(c.name)}</div></div>`).join('')}
          ${VALUES.map((_v, vi) =>
            cats.map((c, ci) => {
              const used = r.usedCells && r.usedCells[`${ci}-${vi}`];
              const q = c.questions[vi];
              const cellValue = q?.value || VALUES[vi];
              // Show a small photo icon on cells whose question or answer has an image
              const hasImg = q && (q.image || q.answerImage);
              return `<button class="board-cell ${used?'used':''}" ${(used||!canPick)?'disabled':''} data-action="pick-cell" data-ci="${ci}" data-qi="${vi}">${used ? '' : cellValue}${hasImg && !used ? `<span class="cell-img-icon" title="Питання/відповідь з картинкою">${icon('image',12)}</span>` : ''}</button>`;
            }).join('')
          ).join('')}
        </div>
      </div>
      <div class="player-bar">
        ${nonHostPlayers.map(p => {
          const isPicker = p.id === r.currentPicker;
          const isMe = p.id === state.myId;
          let cls = 'player-chip';
          if (isPicker) cls += ' current-picker';
          if (isMe) cls += ' me';
          if (state.isHost) cls += ' editable';
          const clickAttr = state.isHost ? `data-action="edit-score" data-player="${p.id}"` : '';
          return `<div class="${cls}" ${clickAttr}>
            <div class="player-chip-top">
              <span class="player-avatar">${p.avatar}</span>
              <div class="player-chip-name">${esc(p.name)}</div>
            </div>
            <div class="player-chip-score ${(p.score||0) < 0 ? 'negative' : ''}">${(p.score||0) > 0 ? '+' : ''}${p.score || 0}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function viewQuestion(){
  const r = state.room;
  if (!r || !r.currentCell) return `<div class="center-screen"><span class="spin">${icon('loader',32)}</span></div>`;
  const {ci, qi} = r.currentCell;
  const cat = r.pack.categories[ci];
  const q = cat.questions[qi];
  const players = getPlayerList(r);
  const nonHostPlayers = players.filter(p => p.id !== r.hostId);
  const buzzed = r.buzzedPlayer ? players.find(p => p.id === r.buzzedPlayer) : null;
  const attempted = r.attemptedBy || [];
  const iAttempted = attempted.includes(state.myId);
  const allAttempted = attempted.length >= nonHostPlayers.length;
  const canIBuzz = !state.isHost && !buzzed && !iAttempted && r.questionState === 'buzzing';
  const iAmBuzzed = buzzed && buzzed.id === state.myId;

  // Auto-size question text by length so long questions fit without page scroll
  const qLen = (q.q || '').length;
  const sizeClass = qLen > 220 ? 'xlong' : qLen > 110 ? 'long' : '';

  // --- STAGE BODY (the question / answer area — scrolls internally if huge) ---
  let stageBody = '';
  if (r.revealAnswer) {
    stageBody = `
      <div class="q-answer-reveal" style="width:100%;">
        <div class="q-answer-reveal-label">ПРАВИЛЬНА ВІДПОВІДЬ</div>
        ${q.answerImage ? `<img src="${q.answerImage}" class="q-image" style="max-height:38vh; margin-bottom:8px;" alt="">` : ''}
        ${q.a && q.a.trim() ? `<div class="q-answer-reveal-text">${escMultiline(q.a)}</div>` : ''}
        ${q.explanation && q.explanation.trim() ? `<div style="margin-top:10px; font-size:16px; font-weight:500; color:var(--green); opacity:0.85; white-space:pre-wrap;">${escMultiline(q.explanation)}</div>` : ''}
        ${(q.q && q.q.trim()) ? `<div style="margin-top:16px; font-size:13px; color:var(--ink-dim); white-space:pre-wrap;">Питання: ${escMultiline(q.q)}</div>` : ''}
      </div>`;
  } else {
    stageBody = `
      ${q.image ? `<img src="${q.image}" class="q-image" style="max-height:42vh;" alt="">` : ''}
      ${q.q && q.q.trim() ? `<div class="qs-question-text ${sizeClass}">${escMultiline(q.q)}</div>` : ''}
      ${state.isHost ? `
        <div style="margin-top:16px; padding:12px; background: rgba(74,222,128,0.08); border:1px dashed rgba(74,222,128,0.3); border-radius:12px; max-width:700px;">
          <div style="font-size:11px; color:var(--ink-dim); letter-spacing:0.15em; text-transform:uppercase; margin-bottom:4px;">ВІДПОВІДЬ (ТІЛЬКИ ТИ БАЧИШ)</div>
          ${q.answerImage ? `<img src="${q.answerImage}" style="max-height:28vh; max-width:100%; border-radius:8px; margin-bottom:8px;" alt="">` : ''}
          ${q.a && q.a.trim() ? `<div style="font-family:'Fraunces',serif; font-weight:700; font-size:18px; color:var(--green); white-space:pre-wrap;">${escMultiline(q.a)}</div>` : ''}
          ${q.explanation && q.explanation.trim() ? `<div style="margin-top:6px; font-size:14px; font-weight:500; color:var(--green); opacity:0.8; white-space:pre-wrap;">${escMultiline(q.explanation)}</div>` : ''}
        </div>
      ` : ''}`;
  }

  // --- TIMER BAR ---
  const timerBar = (() => {
    const now = serverNow();
    if (r.questionState === 'buzzing') {
      const total = buzzSec(r);
      const deadline = r.buzzPhaseDeadline || (now + total * 1000);
      const sec = Math.max(0, Math.ceil((deadline - now) / 1000));
      const pct = Math.min(100, (sec / total) * 100);
      return `<div class="timer-bar" id="timer-bar">
        <div class="timer-bar-label">⏱ Натиснути баззер: <b id="timer-sec">${sec}</b> сек</div>
        <div class="timer-bar-track"><div class="timer-bar-fill" id="timer-fill" style="width:${pct}%; background:var(--accent);"></div></div>
      </div>`;
    }
    if (r.questionState === 'answering') {
      const total = answerSec(r);
      const deadline = r.answerPhaseDeadline || (now + total * 1000);
      const sec = Math.max(0, Math.ceil((deadline - now) / 1000));
      const pct = Math.min(100, (sec / total) * 100);
      return `<div class="timer-bar" id="timer-bar">
        <div class="timer-bar-label">⏱ Відповідь: <b id="timer-sec">${sec}</b> сек</div>
        <div class="timer-bar-track"><div class="timer-bar-fill" id="timer-fill" style="width:${pct}%; background:var(--gold);"></div></div>
      </div>`;
    }
    return '';
  })();

  // --- CONTROLS (buzz button / host judge / countdown / etc.) ---
  let controls = '';

  if (r.questionState === 'countdown' && r.countdownDeadline) {
    const sec = Math.max(0, Math.ceil((r.countdownDeadline - serverNow()) / 1000));
    controls += `<div style="text-align:center; padding:8px 0;">
      <div style="font-size:12px; color:var(--ink-dim); letter-spacing:0.15em; text-transform:uppercase; margin-bottom:4px;">Базер відкриється через</div>
      <div id="countdown-num" style="font-family:'Fraunces',serif; font-weight:900; font-size:56px; color:var(--gold); line-height:1;">${sec}</div>
      <div style="margin-top:4px; font-size:13px; color:var(--ink-dim);">${state.isHost ? 'Читай питання вголос!' : 'Приготуйся натискати!'}</div>
    </div>`;
    if (!state.isHost && r.antiSpamConfig && !iAttempted) {
      controls += `<button class="buzz-btn" data-action="buzz">НАТИСНИ ЩОБ ВІДПОВІСТИ</button>
        <div style="text-align:center; font-size:12px; color:var(--accent);">🔥 Хардкор: натиснеш зарано — штраф 1 сек!</div>`;
    }
  }

  if (r.questionState === 'reading') {
    if (state.isHost) {
      controls += `<div style="text-align:center;">
        <button class="btn btn-accent btn-lg" data-action="open-buzz">${icon('play',18)} Відкрити баззер для гравців</button>
        <div style="margin-top:6px; font-size:12px; color:var(--ink-dim);">Прочитай питання вголос, потім відкрий баззер</div>
      </div>`;
    } else {
      controls += `<div style="text-align:center; color:var(--ink-dim); font-size:14px; padding:8px;">⏳ Ведучий читає питання...</div>`;
      if (r.antiSpamConfig && !iAttempted) {
        controls += `<button class="buzz-btn" data-action="buzz">НАТИСНИ ЩОБ ВІДПОВІСТИ</button>
          <div style="text-align:center; font-size:12px; color:var(--accent);">🔥 Хардкор: натиснеш зарано — штраф 1 сек!</div>`;
      }
    }
  }

  if (buzzed) {
    controls += `<div class="buzzed-banner">
      <div class="buzzed-banner-label">ВІДПОВІДАЄ</div>
      <div class="buzzed-banner-name">${buzzed.avatar} ${esc(buzzed.name)}</div>
      ${iAmBuzzed ? `<div style="font-size:14px; margin-top:4px;">Скажи відповідь — ведучий тебе чує</div>` : ''}
    </div>`;
    if (state.isHost) {
      controls += `<div class="host-controls">
        <button class="btn btn-green btn-lg" data-action="judge" data-correct="1">${icon('check',18)} Правильно (+${q.value})</button>
        <button class="btn btn-red btn-lg" data-action="judge" data-correct="0">${icon('x',18)} Неправильно (−${q.value})</button>
        <button class="btn btn-ghost btn-sm" data-action="judge" data-correct="skip">Не зараховувати</button>
      </div>`;
    }
  } else if (r.questionState === 'buzzing' && !state.isHost) {
    controls += `<button class="buzz-btn" data-action="buzz" ${iAttempted?'disabled':''}>
      ${iAttempted ? 'Ти вже відповідав' : 'НАТИСНИ ЩОБ ВІДПОВІСТИ'}
    </button>`;
    controls += !iAttempted
      ? `<div style="text-align:center; font-size:12px; color:var(--ink-dim);">або натисни <b>Пробіл</b>${r.antiSpamConfig ? ' · 🔥 хардкор: 1 сек між натисканнями' : ''}</div>`
      : `<div style="text-align:center;"><button class="btn btn-ghost btn-sm" data-action="resync">${icon('loader',12)} Базер завис? Оновити</button></div>`;
  }

  if (state.isHost && r.questionState === 'buzzing' && !buzzed) {
    controls += `<div style="text-align:center; color:var(--ink-dim); font-size:14px; padding:8px;">Очікуємо хто першим натисне...</div>`;
  }

  if (attempted.length > 0 && !r.revealAnswer) {
    controls += `<div class="attempted-list">
      ${attempted.map(pid => {
        const p = players.find(x => x.id === pid);
        return p ? `<span class="attempted-chip">${p.avatar} ${esc(p.name)}</span>` : '';
      }).join('')}
    </div>`;
  }

  if (r.revealAnswer && state.isHost) {
    controls += `<div style="text-align:center;">
      <button class="btn btn-gold btn-lg" data-action="back-to-board">${icon('chevronRight',18)} На дошку</button>
    </div>`;
  }

  if (!r.revealAnswer && state.isHost && !buzzed && (r.questionState === 'buzzing' || r.questionState === 'reading' || r.questionState === 'countdown')) {
    controls += `<div style="text-align:center;">
      <button class="btn btn-ghost btn-sm" data-action="reveal-answer">${icon('eye',14)} ${attempted.length > 0 ? 'Показати відповідь і закрити' : 'Пропустити (ніхто не відповів)'}</button>
    </div>`;
  }

  return `
    <div class="question-screen slide-up">
      <div class="qs-topbar">
        <div style="font-size:13px; color:var(--ink-dim);">Кімната <b style="color:var(--gold);">${esc(state.code)}</b></div>
        ${state.isHost ? `<button class="btn btn-ghost btn-sm" data-action="close-question">${icon('x',14)} Закрити питання</button>` : ''}
      </div>

      <div class="qs-stage">
        <div class="qs-stage-header">
          <div class="q-cat">${esc(cat.name)}</div>
          <div class="q-value">${q.value}</div>
        </div>
        <div class="qs-stage-body">
          ${stageBody}
        </div>
      </div>

      <div class="qs-controls">
        ${timerBar}
        ${controls}
      </div>
    </div>
  `;
}

function viewResults(){
  const r = state.room;
  if (!r) return '';
  const players = getPlayerList(r);
  const sorted = players.filter(p => p.id !== r.hostId).sort((a,b)=>(b.score||0)-(a.score||0));
  const winner = sorted[0];
  return `
    <div class="container slide-up" style="min-height:calc(100vh - 48px); display:flex; flex-direction:column; justify-content:center;">
      <div style="text-align:center; margin-bottom:40px;">
        <div class="eyebrow">ФІНАЛ</div>
        <h2 style="font-family:'Fraunces',serif; font-size:64px; font-weight:900; margin-bottom:24px;">Переможець</h2>
        ${winner ? `
          <div class="winner-card">
            <div class="winner-emoji">${winner.avatar}</div>
            <div class="winner-name">${esc(winner.name)}</div>
            <div class="winner-score">${winner.score || 0} БАЛІВ</div>
          </div>
        ` : '<div style="color:var(--ink-dim)">Без переможця</div>'}
      </div>
      <div class="card" style="margin-bottom:24px;">
        <div style="font-size:14px; color:var(--ink-dim); margin-bottom:12px;">Турнірна таблиця</div>
        ${sorted.map((p, rank) => `
          <div class="final-row ${rank===0?'first':''}">
            <div class="rank">${rank+1}</div>
            <span style="font-size:24px;">${p.avatar}</span>
            <div class="name">${esc(p.name)}</div>
            <div class="pts ${(p.score||0)<0?'negative':''}">${p.score || 0}</div>
          </div>
        `).join('')}
      </div>
      <div style="display:flex; gap:12px;">
        ${state.isHost ? `<button class="btn btn-gold btn-lg" style="flex:1;" data-action="play-again">${icon('refresh',18)} Ще раунд</button>` : ''}
        <button class="btn btn-ghost btn-lg" style="flex:1;" data-action="leave">Вийти</button>
      </div>
    </div>
  `;
}

// ============== ROUND DONE / FINAL VIEWS ==============
function viewRoundDone(){
  const r = state.room;
  if (!r) return '';
  const players = getPlayerList(r);
  const sorted = players.filter(p => p.id !== r.hostId).sort((a,b)=>(b.score||0)-(a.score||0));
  const isLastRegularRound = r.currentRound >= r.roundsTotal;
  const nextRound = (r.currentRound || 1) + 1;
  return `
    <div class="container slide-up" style="padding-top:24px;">
      <div style="text-align:center; margin-bottom:32px;">
        <div class="eyebrow">РАУНД ${r.currentRound} ЗАВЕРШЕНО</div>
        <h2 style="font-family:'Fraunces',serif; font-size:48px; font-weight:900; margin-top:8px;">
          ${isLastRegularRound ? 'Останній раунд позаду' : `Раунд ${r.currentRound} з ${r.roundsTotal}`}
        </h2>
      </div>
      <div class="card" style="margin-bottom:24px;">
        <div style="font-size:14px; color:var(--ink-dim); margin-bottom:12px;">
          Поточні бали${state.isHost ? ' · <span style="color:var(--gold);">клікни на гравця щоб змінити бали</span>' : ''}
        </div>
        ${sorted.map((p, rank) => `
          <div class="final-row ${rank===0?'first':''} ${state.isHost ? 'editable-row' : ''}" ${state.isHost ? `data-action="edit-score" data-player="${p.id}"` : ''}>
            <div class="rank">${rank+1}</div>
            <span style="font-size:24px;">${p.avatar}</span>
            <div class="name">${esc(p.name)}</div>
            <div class="pts ${(p.score||0)<0?'negative':''}">${p.score || 0}</div>
            ${state.isHost ? `<span style="margin-left:8px; opacity:0.4; font-size:13px;">✏</span>` : ''}
          </div>
        `).join('')}
      </div>
      ${state.isHost && sorted.some(p => (p.score||0) < 0) ? `
        <div class="info-text" style="margin-bottom:16px;">
          💡 У когось мінусові бали — щоб вони могли зробити ставку у фіналі, підніми їм бали (клік по гравцю вище).
        </div>
      ` : ''}
      ${state.isHost ? `
        ${isLastRegularRound ? `
          ${(() => {
            const fq = state.setupFinalQ || {};
            const finalReady = !!(fq.category?.trim() && fq.q?.trim() && fq.a?.trim());
            return finalReady
              ? `<button class="btn btn-gold btn-lg btn-full" data-action="start-final">${icon('crown',18)} Запустити фінал</button>`
              : `<button class="btn btn-gold btn-lg btn-full" data-action="go-final-setup">${icon('crown',18)} Створити фінальне питання</button>`;
          })()}
          <button class="btn btn-ghost btn-lg btn-full" data-action="skip-to-results" style="margin-top:8px;">Завершити без фіналу</button>
        ` : `
          <button class="btn btn-gold btn-lg btn-full" data-action="go-next-round" data-round="${nextRound}">${icon('chevronRight',18)} Перейти до раунду ${nextRound} (бали ×${nextRound})</button>
        `}
      ` : `
        <div class="card" style="text-align:center; padding:32px;">
          <span class="spin" style="color:var(--gold);">${icon('loader',24)}</span>
          <div style="margin-top:12px;">Очікуємо ведучого...</div>
          <div style="color:var(--ink-dim); font-size:13px; margin-top:8px;">${isLastRegularRound ? 'Готує фінал' : `Готує раунд ${nextRound}`}</div>
        </div>
      `}
    </div>
  `;
}

function viewFinalSetup(){
  const fq = state.setupFinalQ || {category:'', q:'', a:''};
  const r = state.room;
  // "Setup phase" = game hasn't started yet (still in lobby collecting packs)
  const isSetupPhase = !r || r.status === 'lobby';
  return `
    <button class="back-btn" data-action="${isSetupPhase ? 'leave-final-to-modeselect' : 'leave-final-setup'}">${icon('arrowLeft',16)} Назад</button>
    <div class="container slide-up">
      <div class="eyebrow">ФІНАЛЬНИЙ РАУНД</div>
      <h2 style="font-family:'Fraunces',serif; font-size:36px; font-weight:700; margin-bottom:8px; margin-top:8px;">Питання для фіналу</h2>
      <p style="color:var(--ink-dim); margin-bottom:32px;">Гравці поставлять до своїх балів і напишуть відповідь у формі. Ти потім перевіриш кожного.</p>
      <div class="card">
        <input class="input" id="final-cat" placeholder="Категорія (напр. «Світова історія»)" value="${esc(fq.category)}" autocomplete="off" style="margin-bottom:24px;">
        <input class="input" id="final-q" placeholder="Текст питання..." value="${esc(fq.q)}" autocomplete="off" style="margin-bottom:24px;">
        <input class="input" id="final-a" placeholder="Правильна відповідь..." value="${esc(fq.a)}" autocomplete="off" style="color:var(--green);">
      </div>
      ${state.setupErr ? `<div class="err-text">${esc(state.setupErr)}</div>` : ''}
      ${isSetupPhase ? `
        <button class="btn btn-gold btn-lg btn-full" data-action="save-final-setup" style="margin-top:24px;">
          ${icon('check',18)} Зберегти фінальне питання
        </button>
        <div class="info-text">Збережеться разом з паками. Гра запустить фінал автоматично після останнього раунду.</div>
      ` : `
        <button class="btn btn-gold btn-lg btn-full" data-action="start-final" style="margin-top:24px;">
          ${icon('crown',18)} Запустити фінал
        </button>
        <div class="info-text">Кожен гравець побачить категорію (без питання) і поставить бали. Потім побачить питання і напише відповідь.</div>
      `}
    </div>
  `;
}

function viewFinalBid(){
  const r = state.room;
  if (!r || !r.finalQ) return '';
  const players = getPlayerList(r);
  const nonHost = players.filter(p => p.id !== r.hostId);
  const me = players.find(p => p.id === state.myId);
  const myBids = r.finalBids || {};
  const myScore = Math.max(FINAL_MIN_BID_CAP, me?.score || 0);
  const allBidsSubmittedCount = Object.values(myBids).filter(b => b && b.bidSubmitted).length;

  if (state.isHost) {
    return `
      <div class="container slide-up" style="padding-top:24px;">
        <div class="eyebrow">ФІНАЛ · ФАЗА 1 · СТАВКИ</div>
        <h2 style="font-family:'Fraunces',serif; font-size:36px; font-weight:700; margin-top:8px; margin-bottom:8px;">${esc(r.finalQ.category)}</h2>
        <p style="color:var(--ink-dim); margin-bottom:24px;">Гравці бачать тільки категорію і ставлять бали. Питання покажеться у фазі 2.</p>
        <div class="card" style="margin-bottom:16px;">
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:8px;">ПИТАННЯ (тільки ти бачиш)</div>
          <div style="font-family:'Fraunces',serif; font-size:20px; font-weight:700; margin-bottom:12px;">${esc(r.finalQ.q)}</div>
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ВІДПОВІДЬ</div>
          <div style="font-family:'Fraunces',serif; font-size:18px; font-weight:700; color:var(--green);">${esc(r.finalQ.a)}</div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div style="font-size:14px; color:var(--ink-dim); margin-bottom:12px;">
            Поставили ставку: ${allBidsSubmittedCount} з ${nonHost.length}
          </div>
          ${nonHost.map(p => {
            const sub = myBids[p.id];
            const done = sub && sub.bidSubmitted;
            return `<div class="final-row">
              <span style="font-size:20px;">${p.avatar}</span>
              <div class="name">${esc(p.name)}</div>
              <div style="color:${done?'var(--green)':'var(--ink-dim)'}; font-size:13px;">${done ? `✓ ${sub.bid}` : '⌛ Очікуємо'}</div>
            </div>`;
          }).join('')}
        </div>
        ${allBidsSubmittedCount === nonHost.length && nonHost.length > 0 ? `
          <button class="btn btn-gold btn-lg btn-full" data-action="start-final-answer-phase" style="margin-top:8px;">
            ${icon('play',18)} Показати питання гравцям (90 сек на відповідь)
          </button>
        ` : `
          <button class="btn btn-ghost btn-lg btn-full" data-action="start-final-answer-phase" style="margin-top:8px;">
            Не чекати решту, показати питання зараз
          </button>
        `}
      </div>
    `;
  }

  // Player view
  const bid = state.finalBidLocal;
  const ans = state.finalAnswerLocal;
  const validBid = Number.isInteger(bid) && bid >= 0 && bid <= myScore;
  const myBid = myBids[state.myId];
  const bidAlreadySubmitted = myBid && myBid.bidSubmitted;
  return `
    <div class="container slide-up" style="padding-top:24px;">
      <div class="eyebrow">ФІНАЛ · ФАЗА 1 · СТАВКА</div>
      <h2 style="font-family:'Fraunces',serif; font-size:36px; font-weight:900; margin-top:8px;">${esc(r.finalQ.category)}</h2>
      <p style="color:var(--ink-dim); margin-top:8px; margin-bottom:24px;">Постав скільки балів готовий поставити на правильну відповідь. Питання покажуть після того як всі поставлять.</p>
      ${bidAlreadySubmitted ? `
        <div class="card" style="text-align:center;">
          <div style="font-size:48px; margin-bottom:12px;">✓</div>
          <div style="font-size:14px; color:var(--ink-dim); margin-bottom:4px;">ТВОЯ СТАВКА</div>
          <div style="font-family:'Fraunces',serif; font-size:42px; font-weight:900; color:var(--gold);">${myBid.bid}</div>
          <div style="margin-top:12px; color:var(--ink-dim); font-size:13px;">Очікуємо інших гравців і питання від ведучого</div>
        </div>
      ` : `
        <div class="card">
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ТВОЇ БАЛИ</div>
          <div style="font-family:'Fraunces',serif; font-size:36px; font-weight:900; color:var(--gold); margin-bottom:16px;">${me?.score || 0}</div>
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">СКІЛЬКИ СТАВИШ (0 — ${myScore})</div>
          <input type="number" class="input" id="final-bid" min="0" max="${myScore}" value="${bid}" style="font-family:'Fraunces',serif; font-size:24px; font-weight:700; color:var(--accent);">
          ${(me?.score || 0) < FINAL_MIN_BID_CAP ? `<div style="font-size:12px; color:var(--ink-dim); margin-top:6px;">У тебе мало балів, тож можеш поставити до ${FINAL_MIN_BID_CAP} — маєш шанс відігратись 🎯</div>` : ''}
        </div>
        <div id="final-bid-err" class="err-text" style="display:${validBid ? 'none' : 'block'};">Ставка має бути від 0 до ${myScore}</div>
        <button id="final-submit-btn" class="btn btn-accent btn-lg btn-full" data-action="submit-final-bid" ${!validBid ? 'disabled' : ''} style="margin-top:16px;">
          ${icon('check',18)} Подати ставку
        </button>
      `}
    </div>
  `;
}

// FINAL ANSWER PHASE — question is revealed, players have a timer to answer
function viewFinalAnswer(){
  const r = state.room;
  if (!r || !r.finalQ) return '';
  const players = getPlayerList(r);
  const nonHost = players.filter(p => p.id !== r.hostId);
  const me = players.find(p => p.id === state.myId);
  const bids = r.finalBids || {};
  const myBid = bids[state.myId];
  const allAnsweredCount = Object.values(bids).filter(b => b && b.answerSubmitted).length;

  if (state.isHost) {
    return `
      <div class="container slide-up" style="padding-top:24px;">
        <div class="eyebrow">ФІНАЛ · ФАЗА 2 · ВІДПОВІДЬ</div>
        <h2 style="font-family:'Fraunces',serif; font-size:36px; font-weight:700; margin-top:8px; margin-bottom:8px;">${esc(r.finalQ.category)}</h2>
        ${r.finalPhaseDeadline ? (() => {
          const sec = Math.max(0, Math.ceil((r.finalPhaseDeadline - serverNow()) / 1000));
          const pct = Math.min(100, (sec / FINAL_SECONDS) * 100);
          return `<div class="timer-bar" id="timer-bar" style="margin-top:16px;">
            <div class="timer-bar-label">⏱ До завершення: <b id="timer-sec">${sec}</b> сек</div>
            <div class="timer-bar-track"><div class="timer-bar-fill" id="timer-fill" style="width:${pct}%; background:var(--gold);"></div></div>
          </div>`;
        })() : ''}
        <div class="card" style="margin-top:24px;">
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:8px;">ПИТАННЯ</div>
          <div style="font-family:'Fraunces',serif; font-size:22px; font-weight:700; margin-bottom:16px;">${esc(r.finalQ.q)}</div>
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ВІДПОВІДЬ</div>
          <div style="font-family:'Fraunces',serif; font-size:18px; font-weight:700; color:var(--green);">${esc(r.finalQ.a)}</div>
        </div>
        <div class="card" style="margin-top:16px;">
          <div style="font-size:14px; color:var(--ink-dim); margin-bottom:12px;">
            Відповіли: ${allAnsweredCount} з ${nonHost.length}
          </div>
          ${nonHost.map(p => {
            const sub = bids[p.id];
            const done = sub && sub.answerSubmitted;
            return `<div class="final-row">
              <span style="font-size:20px;">${p.avatar}</span>
              <div class="name">${esc(p.name)}</div>
              <div style="color:${done?'var(--green)':'var(--ink-dim)'}; font-size:13px;">${done ? '✓ Готово' : '⌛ Думає'}</div>
            </div>`;
          }).join('')}
        </div>
        ${allAnsweredCount === nonHost.length && nonHost.length > 0 ? `
          <button class="btn btn-gold btn-lg btn-full" data-action="go-final-reveal" style="margin-top:16px;">
            ${icon('eye',18)} Переглянути відповіді
          </button>
        ` : `
          <button class="btn btn-ghost btn-lg btn-full" data-action="go-final-reveal" style="margin-top:16px;">
            Не чекати решту, переглянути зараз
          </button>
        `}
      </div>
    `;
  }

  // Player view
  if (myBid && myBid.answerSubmitted) {
    return `
      <div class="container slide-up" style="padding-top:24px;">
        <div class="eyebrow">ФІНАЛ · ВІДПОВІДЬ ПОДАНО</div>
        <h2 style="font-family:'Fraunces',serif; font-size:36px; font-weight:700; margin-top:8px;">Готово</h2>
        <div class="card" style="margin-top:24px; text-align:center;">
          <div style="font-size:48px; margin-bottom:12px;">✓</div>
          <div style="color:var(--ink-dim); margin-bottom:12px;">Очікуємо інших гравців і вердикт ведучого</div>
          <div style="font-size:13px;">Твоя ставка: <b style="color:var(--gold);">${myBid.bid}</b></div>
          <div style="font-size:13px; margin-top:4px;">Твоя відповідь: <b>${esc(myBid.answer || '')}</b></div>
        </div>
      </div>
    `;
  }

  const ans = state.finalAnswerLocal;
  return `
    <div class="container slide-up" style="padding-top:24px;">
      <div class="eyebrow">ФІНАЛ · ФАЗА 2 · ВІДПОВІДЬ</div>
      <h2 style="font-family:'Fraunces',serif; font-size:32px; font-weight:900; margin-top:8px;">${esc(r.finalQ.category)}</h2>
      ${r.finalPhaseDeadline ? (() => {
        const sec = Math.max(0, Math.ceil((r.finalPhaseDeadline - serverNow()) / 1000));
        const pct = Math.min(100, (sec / FINAL_SECONDS) * 100);
        return `<div class="timer-bar" id="timer-bar" style="margin-top:12px; margin-bottom:8px;">
          <div class="timer-bar-label">⏱ Залишилось: <b id="timer-sec">${sec}</b> сек</div>
          <div class="timer-bar-track"><div class="timer-bar-fill" id="timer-fill" style="width:${pct}%; background:var(--accent);"></div></div>
        </div>`;
      })() : ''}
      <p style="color:var(--ink-dim); margin-top:8px; margin-bottom:16px;">Твоя ставка: <b style="color:var(--gold);">${myBid?.bid ?? 0}</b> балів. Напиши відповідь — встигни до закінчення часу.</p>
      <div class="card">
        <div style="font-size:13px; color:var(--ink-dim); margin-bottom:8px;">ПИТАННЯ</div>
        <div style="font-family:'Fraunces',serif; font-size:22px; font-weight:700; margin-bottom:16px;">${esc(r.finalQ.q)}</div>
        <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ТВОЯ ВІДПОВІДЬ</div>
        <input class="input" id="final-answer" placeholder="Напиши відповідь..." value="${esc(ans)}" autocomplete="off">
      </div>
      <button id="final-submit-btn" class="btn btn-accent btn-lg btn-full" data-action="submit-final-answer" ${!ans.trim() ? 'disabled' : ''} style="margin-top:16px;">
        ${icon('check',18)} Подати відповідь
      </button>
    </div>
  `;
}

function viewFinalReveal(){
  const r = state.room;
  if (!r || !r.finalQ) return '';
  const players = getPlayerList(r);
  const nonHost = players.filter(p => p.id !== r.hostId);
  const bids = r.finalBids || {};
  const judgement = r.finalJudgement || {};
  const base = r.finalBaseScores || {};

  // Everyone who placed a bid participates in the reveal — even if they didn't
  // submit an answer (their bid still gets deducted as a wrong answer).
  // Order: smallest bid first → biggest bid last (classic Jeopardy drama).
  const participants = nonHost
    .filter(p => bids[p.id] && bids[p.id].bidSubmitted)
    .sort((a, b) => {
      const ba = (typeof bids[a.id].bid === 'number') ? bids[a.id].bid : 0;
      const bb = (typeof bids[b.id].bid === 'number') ? bids[b.id].bid : 0;
      return ba - bb;
    });
  // Players who didn't even place a bid — shown separately, nothing to judge
  const nonParticipants = nonHost.filter(p => !bids[p.id] || !bids[p.id].bidSubmitted);

  const revealIdx = r.finalRevealIndex || 0;
  const total = participants.length;
  const currentPlayer = revealIdx < total ? participants[revealIdx] : null;
  const allRevealed = revealIdx >= total;
  const currentJudged = currentPlayer && (judgement[currentPlayer.id] === 'correct' || judgement[currentPlayer.id] === 'wrong');

  // Card renderer for an already-revealed (judged) player — compact
  const revealedCard = (p) => {
    const sub = bids[p.id];
    const baseScore = base[p.id] != null ? base[p.id] : (p.score || 0);
    const curScore = p.score || 0;
    const verdict = judgement[p.id];
    const safeBid = (typeof sub.bid === 'number' && !isNaN(sub.bid)) ? sub.bid : 0;
    const borderClr = verdict === 'correct' ? 'rgba(74,222,128,0.5)' : verdict === 'wrong' ? 'rgba(232,74,48,0.5)' : 'var(--line)';
    return `<div class="card" style="margin-bottom:10px; border-color:${borderClr}; opacity:0.9;">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">${p.avatar}</span>
        <div style="flex:1; min-width:0;">
          <b style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(p.name)}</b>
          <span style="font-size:13px; color:var(--ink-dim);">${sub.answerSubmitted && sub.answer ? `«${esc(sub.answer)}»` : '⏱ не відповів'} · ставка ${safeBid}</span>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; font-weight:700; color:${verdict==='correct'?'var(--green)':'var(--accent)'};">${verdict==='correct'?'✓':'✗'}</div>
          <div style="font-family:'Fraunces',serif; font-weight:900; font-size:18px; color:${curScore<0?'var(--accent)':'var(--gold)'};">
            <span style="color:var(--ink-faint); font-size:12px;">${baseScore}→</span>${curScore}
          </div>
        </div>
      </div>
    </div>`;
  };

  // Big spotlight card for the current player being judged
  const spotlightCard = (p) => {
    const sub = bids[p.id];
    const baseScore = base[p.id] != null ? base[p.id] : (p.score || 0);
    const curScore = p.score || 0;
    const verdict = judgement[p.id];
    const safeBid = (typeof sub.bid === 'number' && !isNaN(sub.bid)) ? sub.bid : 0;
    const borderClr = verdict === 'correct' ? 'var(--green)' : verdict === 'wrong' ? 'var(--accent)' : 'var(--gold)';
    return `<div class="card spotlight-card" style="border:2px solid ${borderClr}; padding:24px;">
      <div style="text-align:center; margin-bottom:16px;">
        <div style="font-size:48px; margin-bottom:4px;">${p.avatar}</div>
        <div style="font-family:'Fraunces',serif; font-weight:900; font-size:24px;">${esc(p.name)}</div>
        <div style="font-size:13px; color:var(--gold); font-weight:700; margin-top:4px;">поставив ${safeBid} балів</div>
      </div>
      <div style="background:var(--soft); padding:16px; border-radius:12px; text-align:center; margin-bottom:16px;">
        <div style="font-size:11px; color:var(--ink-dim); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px;">ВІДПОВІДЬ</div>
        ${sub.answerSubmitted && sub.answer ? `
          <div style="font-family:'Fraunces',serif; font-weight:700; font-size:24px;">${esc(sub.answer)}</div>
        ` : `
          <div style="font-family:'Fraunces',serif; font-weight:700; font-size:18px; color:var(--accent);">⏱ Не встиг відповісти</div>
        `}
      </div>
      ${verdict ? `
        <div style="text-align:center; margin-bottom:8px;">
          <span style="font-size:16px; font-weight:700; color:${verdict==='correct'?'var(--green)':'var(--accent)'};">
            ${verdict==='correct'?'✓ ПРАВИЛЬНО':'✗ НЕПРАВИЛЬНО'}
          </span>
        </div>
        <div style="text-align:center; font-family:'Fraunces',serif; font-weight:900; font-size:32px;">
          <span style="color:var(--ink-faint); font-size:20px;">${baseScore}</span>
          <span style="color:var(--ink-faint);"> → </span>
          <span style="color:${curScore<0?'var(--accent)':'var(--gold)'};">${curScore}</span>
        </div>
      ` : `
        <div style="text-align:center; font-size:14px; color:var(--ink-dim);">
          Поточні бали: <b style="color:var(--ink);">${curScore}</b>
        </div>
      `}
      ${state.isHost ? `
        <div style="display:flex; gap:8px; margin-top:20px;">
          <button class="btn ${verdict==='correct'?'btn-green':'btn-ghost'} btn-lg" style="flex:1;" data-action="judge-final" data-player="${p.id}" data-verdict="correct">
            ${icon('check',18)} Правильно (+${safeBid})
          </button>
          <button class="btn ${verdict==='wrong'?'btn-red':'btn-ghost'} btn-lg" style="flex:1;" data-action="judge-final" data-player="${p.id}" data-verdict="wrong">
            ${icon('x',18)} Неправильно (−${safeBid})
          </button>
        </div>
      ` : `
        <div style="text-align:center; margin-top:16px; font-size:13px; color:var(--ink-dim);">
          ${verdict ? 'Ведучий оцінив відповідь' : 'Ведучий оцінює відповідь...'}
        </div>
      `}
    </div>`;
  };

  return `
    <div class="container slide-up" style="padding-top:24px;">
      <div class="eyebrow">ФІНАЛ · ПЕРЕВІРКА ВІДПОВІДЕЙ ${total > 0 ? `· ${Math.min(revealIdx+1, total)}/${total}` : ''}</div>
      <h2 style="font-family:'Fraunces',serif; font-size:28px; font-weight:700; margin-top:8px;">${esc(r.finalQ.category)}</h2>
      <div class="card" style="margin-top:12px;">
        <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ПИТАННЯ</div>
        <div style="font-family:'Fraunces',serif; font-size:18px; font-weight:700; margin-bottom:12px;">${esc(r.finalQ.q)}</div>
        ${r.finalQ.answerImage ? `<img src="${r.finalQ.answerImage}" style="max-height:45vh; max-width:100%; border-radius:8px; margin-bottom:8px;" alt="">` : ''}
        <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ПРАВИЛЬНА ВІДПОВІДЬ</div>
        <div style="font-family:'Fraunces',serif; font-size:18px; font-weight:700; color:var(--green);">${esc(r.finalQ.a)}</div>
      </div>

      ${revealIdx > 0 ? `
        <div style="margin-top:20px;">
          ${participants.slice(0, Math.min(revealIdx, total)).map(revealedCard).join('')}
        </div>
      ` : ''}

      ${currentPlayer ? `
        <div style="margin-top:16px;">
          ${spotlightCard(currentPlayer)}
        </div>
        ${state.isHost ? `
          <button class="btn ${currentJudged?'btn-gold':'btn-ghost'} btn-lg btn-full" data-action="next-final-reveal" ${!currentJudged?'disabled':''} style="margin-top:16px;">
            ${revealIdx + 1 < total ? `${icon('chevronRight',18)} Наступний гравець` : `${icon('chevronRight',18)} До результатів нижче`}
          </button>
        ` : ''}
      ` : ''}

      ${allRevealed ? `
        ${nonParticipants.length > 0 ? `
          <div style="margin-top:20px;">
            <div style="font-size:12px; color:var(--ink-dim); margin-bottom:8px;">Не відповідали у фіналі:</div>
            ${nonParticipants.map(p => `
              <div class="card" style="margin-bottom:8px; opacity:0.6;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="font-size:20px;">${p.avatar}</span>
                  <div style="flex:1;">${esc(p.name)}</div>
                  <div style="font-family:'Fraunces',serif; font-weight:900; color:${(p.score||0)<0?'var(--accent)':'var(--gold)'};">${p.score||0}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${state.isHost ? `
          <button class="btn btn-gold btn-lg btn-full" data-action="finalize-final" style="margin-top:16px;">
            ${icon('trophy',18)} Показати фінальну таблицю
          </button>
        ` : `
          <div style="text-align:center; margin-top:16px; color:var(--ink-dim); font-size:13px;">
            <span class="spin" style="color:var(--gold);">${icon('loader',18)}</span> Очікуємо фінальну таблицю...
          </div>
        `}
      ` : ''}

      ${!state.isHost && !currentPlayer && !allRevealed ? `
        <div style="text-align:center; margin-top:20px; color:var(--ink-dim); font-size:13px;">Ведучий розпочинає перевірку...</div>
      ` : ''}
    </div>
  `;
}

// ============== FORMAT HELP MODAL ==============
// ============== CHAT WIDGET ==============
function viewChatWidget(){
  const r = state.room;
  const chat = r.chat || {};
  const msgs = Object.entries(chat)
    .map(([id, m]) => ({ id, ...m }))
    .sort((a,b) => (a.ts||0) - (b.ts||0));
  const lastTs = msgs.length ? msgs[msgs.length-1].ts : 0;
  const unread = msgs.filter(m => (m.ts||0) > state.chatLastSeenTs && m.uid !== state.myId).length;

  if (!state.chatOpen) {
    return `
      <button class="chat-fab" data-action="open-chat" title="Чат">
        ${icon('chat', 22)}
        ${unread > 0 ? `<span class="chat-fab-badge">${unread > 9 ? '9+' : unread}</span>` : ''}
      </button>
    `;
  }

  return `
    <div class="chat-panel">
      <div class="chat-header">
        <div style="font-family:'Fraunces',serif; font-weight:700; font-size:16px;">💬 Чат</div>
        <button class="chat-close" data-action="close-chat">${icon('x', 18)}</button>
      </div>
      <div class="chat-messages" id="chat-messages">
        ${msgs.length === 0 ? `<div style="text-align:center; color:var(--ink-faint); font-size:13px; padding:24px 8px;">Поки порожньо. Напиши перше повідомлення 👇</div>` : msgs.map(m => {
          const mine = m.uid === state.myId;
          const isHostMsg = m.uid === r.hostId;
          return `<div class="chat-msg ${mine ? 'mine' : ''}">
            <div class="chat-msg-meta">${m.avatar || '👤'} ${esc(m.name || '?')}${isHostMsg ? ' 🎙' : ''}</div>
            <div class="chat-msg-bubble">${esc(m.text)}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="chat-input-row">
        <input class="input" id="chat-input" placeholder="Повідомлення..." value="${esc(state.chatInputLocal || '')}" autocomplete="off" maxlength="300">
        <button class="btn btn-gold btn-sm" data-action="send-chat" style="white-space:nowrap;">${icon('send', 16)}</button>
      </div>
    </div>
  `;
}

// ============== CHANGELOG MODAL ==============
function viewChangelogModal(){
  return `
    <div class="modal-backdrop" data-action="close-changelog">
      <div class="modal" data-stop="1" style="max-width: 540px; max-height: 85vh; overflow-y: auto;">
        <div class="modal-title">📋 Що нового</div>
        <div class="modal-subtitle">Quiz Night · поточна версія v${APP_VERSION}</div>
        <div style="margin-top: 16px;">
          ${CHANGELOG.map((entry, i) => `
            <div style="margin-bottom: 20px;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <span style="font-family:'Fraunces',serif; font-weight:900; font-size:18px; color:${i===0?'var(--gold)':'var(--ink)'};">v${entry.v}</span>
                ${i===0 ? `<span style="background:var(--gold); color:var(--bg); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px; letter-spacing:0.05em;">ОСТАННЯ</span>` : ''}
                <span style="font-size:12px; color:var(--ink-faint);">${entry.date}</span>
              </div>
              <ul style="margin:0; padding-left:18px; color:var(--ink-dim); font-size:13px; line-height:1.7;">
                ${entry.changes.map(c => `<li>${esc(c)}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-action="close-changelog">Закрити</button>
        </div>
      </div>
    </div>
  `;
}

function viewFormatHelpModal(){
  return `
    <div class="modal-backdrop" data-action="close-format-help">
      <div class="modal" data-stop="1" style="max-width: 560px; max-height: 85vh; overflow-y: auto;">
        <div class="modal-title">📚 Як зробити свій пак?</div>
        <div class="modal-subtitle">Інструкція + приклади</div>

        <div style="margin-top: 16px;">
          <div style="font-family:'Fraunces',serif; font-weight:700; font-size:16px; color:var(--gold); margin-bottom:8px;">1. Структура файлу</div>
          <div style="font-size:14px; line-height:1.6; color:var(--ink-dim); margin-bottom:16px;">
            Файл має містити <b style="color:var(--ink);">6 категорій × 5 питань</b> = 30 питань на раунд.
            Якщо граєш 2 чи 3 раунди — для кожного раунду окремий файл.
          </div>

          <div style="font-family:'Fraunces',serif; font-weight:700; font-size:16px; color:var(--gold); margin-bottom:8px;">2. Назва категорії</div>
          <div style="background:var(--soft); padding:10px 14px; border-radius:8px; font-family:ui-monospace,monospace; font-size:13px; margin-bottom:8px;">
# Кіно
          </div>
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:16px;">
            Починається з <code style="background:var(--soft); padding:1px 5px; border-radius:3px;">#</code> + пробіл + назва.
          </div>

          <div style="font-family:'Fraunces',serif; font-weight:700; font-size:16px; color:var(--gold); margin-bottom:8px;">3. Питання</div>
          <div style="background:var(--soft); padding:10px 14px; border-radius:8px; font-family:ui-monospace,monospace; font-size:13px; margin-bottom:8px; white-space:pre-wrap;">200 | У якій країні зняли «Паразити»? | Південна Корея
400 | Хто зіграв Нео? | Кіану Рівз</div>
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:16px;">
            Формат: <b style="color:var(--ink);">ВАРТІСТЬ | ПИТАННЯ | ВІДПОВІДЬ</b>.
            Розділювач — символ <code style="background:var(--soft); padding:1px 5px; border-radius:3px;">|</code>.
            Вартості: <b style="color:var(--ink);">200, 400, 600, 800, 1000</b>.
            <br><br>
            <b style="color:var(--ink);">Перелік у стовпчик:</b> щоб у питанні чи відповіді щось було з нового рядка, напиши <code style="background:var(--soft); padding:1px 5px; border-radius:3px;">\\n</code> там де треба перенос. У <b>.docx</b> можна просто писати з нового рядка в тій самій клітинці.
            <br><br>
            <b style="color:var(--ink);">Пояснення до відповіді:</b> після відповіді постав <code style="background:var(--soft); padding:1px 5px; border-radius:3px;">//</code> і допиши пояснення — воно покажеться окремо під відповіддю.
          </div>
          <div style="background:var(--soft); padding:10px 14px; border-radius:8px; font-family:ui-monospace,monospace; font-size:13px; margin-bottom:16px; white-space:pre-wrap;">600 | Назви три кольори:\\nЧервоний\\nЗелений\\nСиній | будь-що
400 | Столиця Австралії? | Канберра // не Сідней, як часто думають</div>

          <div style="font-family:'Fraunces',serif; font-weight:700; font-size:16px; color:var(--gold); margin-bottom:8px;">4. Картинки (тільки .docx)</div>
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:8px; line-height:1.6;">
            <b style="color:var(--ink);">📷 Картинка-питання:</b> вставляй картинку прямо В РЯДОК питання (у тому ж абзаці що й текст рядка).
            <br>
            <b style="color:var(--ink);">📷 Картинка-відповідь:</b> вставляй картинку в НАСТУПНИЙ абзац після рядка питання (окремим абзацом).
          </div>
          <div style="background:var(--soft); padding:10px 14px; border-radius:8px; font-family:ui-monospace,monospace; font-size:12px; margin-bottom:16px; line-height:1.7;">
200 |  | Кіану Рівз 📷 ← картинка тут = ПИТАННЯ
<br>
400 | Прапор якої країни? | Японія
<br>📷 ← окремий абзац = ВІДПОВІДЬ
          </div>

          <div style="font-family:'Fraunces',serif; font-weight:700; font-size:16px; color:var(--gold); margin-bottom:8px;">5. Особливі випадки</div>
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:16px; line-height:1.7;">
            • Якщо питання — тільки картинка (без тексту), лиши поле порожнім: <code>200 | | відповідь</code>
            <br>• Якщо відповідь — тільки картинка, лиши порожнім: <code>200 | питання | </code> + картинка нижче
            <br>• Якщо у питанні є символ <code>|</code> — заміни його на тире
            <br>• Можеш лишати порожні рядки між категоріями для зручності
          </div>

          <div style="font-family:'Fraunces',serif; font-weight:700; font-size:16px; color:var(--gold); margin-bottom:8px;">6. Скачай готовий шаблон</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a class="btn btn-gold btn-sm" href="template.docx" download="template.docx" style="text-decoration:none; flex:1; min-width:140px;">
              ${icon('upload',14)} template.docx
            </a>
            <a class="btn btn-ghost btn-sm" href="template.txt" download="template.txt" style="text-decoration:none; flex:1; min-width:140px;">
              ${icon('file',14)} template.txt
            </a>
          </div>
          <div style="font-size:12px; color:var(--ink-dim); margin-top:8px;">
            Відкрий шаблон у Word → заміни питання своїми → завантаж на сайт.
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" data-action="close-format-help">Закрити</button>
        </div>
      </div>
    </div>
  `;
}

// ============== SCORE EDIT MODAL ==============
function viewScoreEditModal(){
  const r = state.room;
  const p = r.players[state.editingScorePlayerId];
  if (!p) return '';
  const current = p.score || 0;
  const inputVal = state.scoreEditInputValue === '' ? String(current) : state.scoreEditInputValue;
  return `
    <div class="modal-backdrop" data-action="close-score-edit">
      <div class="modal" data-stop="1">
        <div class="modal-title">${p.avatar} ${esc(p.name)}</div>
        <div class="modal-subtitle">Корекція балів вручну. Зміни синхронізуються одразу.</div>
        <div class="modal-score ${current < 0 ? 'negative' : ''}" id="modal-score-value">${current > 0 ? '+' : ''}${current}</div>

        <div class="score-buttons">
          <button class="score-btn minus" data-action="score-delta" data-delta="-1000">−1000</button>
          <button class="score-btn minus" data-action="score-delta" data-delta="-500">−500</button>
          <button class="score-btn minus" data-action="score-delta" data-delta="-200">−200</button>
          <button class="score-btn minus" data-action="score-delta" data-delta="-100">−100</button>
          <button class="score-btn plus" data-action="score-delta" data-delta="100">+100</button>
          <button class="score-btn plus" data-action="score-delta" data-delta="200">+200</button>
          <button class="score-btn plus" data-action="score-delta" data-delta="500">+500</button>
          <button class="score-btn plus" data-action="score-delta" data-delta="1000">+1000</button>
        </div>

        <div style="margin-top:16px;">
          <div style="font-size:12px; color:var(--ink-dim); margin-bottom:4px;">Точне значення:</div>
          <div style="display:flex; gap:8px;">
            <input type="number" class="input" id="score-edit-input" value="${esc(inputVal)}" style="font-family:'Fraunces',serif; font-size:20px; font-weight:700; padding:6px 0;">
            <button class="btn btn-gold btn-sm" data-action="score-set-exact" style="white-space:nowrap;">Встановити</button>
          </div>
        </div>

        <div class="modal-actions" style="flex-direction:column; gap:8px;">
          <button class="btn btn-ghost btn-full" data-action="kick-player" data-player="${state.editingScorePlayerId}" style="color:var(--accent); border-color:rgba(232,74,48,0.3);">${icon('x',16)} Видалити гравця з гри</button>
          <button class="btn btn-ghost btn-full" data-action="close-score-edit">Закрити</button>
        </div>
      </div>
    </div>
  `;
}

function attachListeners(){
  document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', handleAction);
  });
  // Track join/host inputs so state persists across re-renders
  const joinCode = document.getElementById('join-code');
  if (joinCode) joinCode.addEventListener('input', e => {
    state.joinCodeInput = e.target.value;
  });
  const joinName = document.getElementById('join-name');
  if (joinName) joinName.addEventListener('input', e => {
    state.joinNameInput = e.target.value;
  });
  const hostName = document.getElementById('host-name');
  if (hostName) hostName.addEventListener('input', e => {
    state.hostNameInput = e.target.value;
  });
  document.querySelectorAll('[data-name="ai-topic"]').forEach(el => {
    el.addEventListener('input', e => {
      const i = parseInt(e.target.dataset.key, 10);
      state.setupAiTopics[i] = e.target.value;
    });
  });
  document.querySelectorAll('[data-name="cat-name"]').forEach(el => {
    el.addEventListener('input', e => {
      const ci = parseInt(e.target.dataset.key, 10);
      if (state.setupManualPack) state.setupManualPack.categories[ci].name = e.target.value;
    });
  });
  document.querySelectorAll('[data-name="manual-q"]').forEach(el => {
    el.addEventListener('input', e => {
      const [ci, qi] = e.target.dataset.key.split('-').map(Number);
      if (state.setupManualPack) state.setupManualPack.categories[ci].questions[qi].q = e.target.value;
    });
  });
  document.querySelectorAll('[data-name="manual-a"]').forEach(el => {
    el.addEventListener('input', e => {
      const [ci, qi] = e.target.dataset.key.split('-').map(Number);
      if (state.setupManualPack) state.setupManualPack.categories[ci].questions[qi].a = e.target.value;
    });
  });
  // Pack name input
  const savePackInput = document.getElementById('save-pack-name');
  if (savePackInput) {
    savePackInput.addEventListener('input', e => { state.setupSavePackName = e.target.value; });
  }
  // File input
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileChange);
  }
  // Drag-and-drop
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault(); dropzone.classList.remove('drag');
      const file = e.dataTransfer.files[0];
      if (file) processUploadedFile(file);
    });
  }
  // Final setup inputs (host)
  const fc = document.getElementById('final-cat');
  if (fc) fc.addEventListener('input', e => { state.setupFinalQ.category = e.target.value; });
  const fq = document.getElementById('final-q');
  if (fq) fq.addEventListener('input', e => { state.setupFinalQ.q = e.target.value; });
  const fa = document.getElementById('final-a');
  if (fa) fa.addEventListener('input', e => { state.setupFinalQ.a = e.target.value; });
  // Final bid inputs (player)
  const fb = document.getElementById('final-bid');
  if (fb) fb.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    state.finalBidLocal = isNaN(v) ? 0 : v;
    // Update the submit button's disabled state without full re-render
    updateFinalSubmitButton();
  });
  const fans = document.getElementById('final-answer');
  if (fans) fans.addEventListener('input', e => {
    state.finalAnswerLocal = e.target.value;
    updateFinalSubmitButton();
  });
  // Chat input
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('input', e => { state.chatInputLocal = e.target.value; });
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
    });
  }
  // Auto-scroll chat to bottom
  const chatMsgs = document.getElementById('chat-messages');
  if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
  // Score edit modal input
  const seInput = document.getElementById('score-edit-input');
  if (seInput) seInput.addEventListener('input', e => {
    state.scoreEditInputValue = e.target.value;
  });
  // Prevent modal content clicks from triggering backdrop close
  document.querySelectorAll('[data-stop="1"]').forEach(el => {
    el.addEventListener('click', e => e.stopPropagation());
  });
}

async function handleAction(e){
  const el = e.currentTarget;
  const action = el.dataset.action;
  switch (action) {
    case 'go-home': leave(); break;
    case 'go-join': state.screen = 'join'; state.err=''; render(true); break;
    case 'go-host': state.screen = 'hostSetup'; state.err=''; render(true); break;
    case 'join-avatar': state.joinAvatar = el.dataset.avatar; lsSet(LS_AVATAR, el.dataset.avatar); render(true); break;
    case 'host-avatar': state.hostAvatar = el.dataset.avatar; lsSet(LS_AVATAR, el.dataset.avatar); render(true); break;
    case 'do-join': await doJoin(); break;
    case 'do-host-create': await doHostCreate(); break;
    case 'go-mode-select':
      state.subScreen = 'modeSelect';
      state.setupSource = null;
      state.setupErr = '';
      // Preserve already-collected packs/rounds when re-entering setup from lobby.
      // Only initialise on a truly fresh setup (nothing collected yet).
      if (!state.setupRoundsTotal && Object.keys(state.setupRoundPacks || {}).length === 0) {
        state.setupRoundsTotal = null;
        state.setupCurrentRound = 1;
        state.setupRoundPacks = {};
        state.editingRound = null;
      }
      render(true); break;
    case 'leave-mode-select': state.subScreen = null; render(true); break;
    case 'pick-rounds':
      // Just set the number of rounds; don't start. Keep already-picked packs that still fit.
      state.setupRoundsTotal = parseInt(el.dataset.rounds, 10);
      // Drop packs for rounds beyond the new total
      Object.keys(state.setupRoundPacks).forEach(k => {
        if (parseInt(k,10) > state.setupRoundsTotal) delete state.setupRoundPacks[k];
      });
      state.setupErr = '';
      render(true); break;
    case 'pick-round-pack':
      // Open the pack picker for a specific round
      state.editingRound = parseInt(el.dataset.round, 10);
      state.setupCurrentRound = state.editingRound;
      state.subScreen = 'questionSetup';
      state.setupSource = null;
      state.setupFilePack = null;
      state.setupAiPreview = null;
      state.setupManualPack = null;
      state.setupErr = '';
      render(true); break;
    case 'pick-final-setup':
      state.subScreen = 'finalSetup';
      state.setupErr = '';
      render(true); break;
    case 'start-all-rounds':
      await startAllRounds();
      break;
    case 'set-buzz-sec':
      state.setupBuzzSeconds = parseInt(el.dataset.sec, 10);
      render(true); break;
    case 'set-answer-sec':
      state.setupAnswerSeconds = parseInt(el.dataset.sec, 10);
      render(true); break;
    case 'set-buzz-mode':
      state.setupBuzzMode = el.dataset.mode;
      render(true); break;
    case 'set-anti-spam':
      state.setupAntiSpam = el.dataset.anti === '1';
      render(true); break;
    case 'set-countdown-sec':
      state.setupCountdownSeconds = parseInt(el.dataset.sec, 10);
      render(true); break;
    case 'go-question-setup': state.subScreen = 'questionSetup'; state.setupSource = null; state.setupErr=''; render(true); break;
    case 'leave-question-setup': state.subScreen = 'modeSelect'; state.editingRound = null; state.setupErr=''; render(true); break;
    case 'set-source':
      state.setupSource = el.dataset.source || null;
      state.setupErr='';
      if (state.setupSource === 'manual' && !state.setupManualPack) state.setupManualPack = emptyManualPack();
      if (state.setupSource === 'saved') await refreshPacks();
      render(true); break;
    case 'use-saved-pack': await assignPackToRound(state.savedPacks.find(p=>p.id===el.dataset.id)?.pack); break;
    case 'delete-pack': await handleDeletePack(el.dataset.id); break;
    case 'start-preset': await assignPackToRound(SAMPLE_PACK); break;
    case 'open-file-picker': document.getElementById('file-input')?.click(); break;
    case 'reset-file': state.setupFilePack = null; state.setupErr=''; render(true); break;
    case 'start-file': await assignPackToRound(state.setupFilePack); break;
    case 'save-file-pack': await saveCurrentPack(state.setupFilePack); break;
    case 'ai-generate': await aiGenerate(); break;
    case 'ai-clear': state.setupAiPreview = null; render(true); break;
    case 'start-ai': await assignPackToRound(state.setupAiPreview); break;
    case 'save-ai-pack': await saveCurrentPack(state.setupAiPreview); break;
    case 'start-manual': await assignPackToRound(state.setupManualPack); break;
    case 'save-manual-pack': await saveCurrentPack(state.setupManualPack); break;
    case 'add-image': await pickImageFor(el.dataset.key, 'image'); break;
    case 'clear-image': clearImageFor(el.dataset.key, 'image'); break;
    case 'add-answer-image': await pickImageFor(el.dataset.key, 'answerImage'); break;
    case 'clear-answer-image': clearImageFor(el.dataset.key, 'answerImage'); break;
    case 'copy-code': copyCode(); break;
    case 'pick-cell': await pickCell(parseInt(el.dataset.ci,10), parseInt(el.dataset.qi,10)); break;
    case 'open-buzz': await openBuzz(); break;
    case 'buzz': await buzz(); break;
    case 'resync': await resyncRoom(); break;
    case 'judge': await judge(el.dataset.correct); break;
    case 'reveal-answer': await revealAnswer(); break;
    case 'close-question': await closeQuestion(); break;
    case 'back-to-board': await backToBoard(); break;
    case 'end-game': await endGame(); break;
    case 'play-again': await playAgain(); break;
    case 'leave': leave(); break;
    // Round / final actions
    case 'go-next-round': await goNextRound(parseInt(el.dataset.round, 10)); break;
    case 'skip-to-results': await skipToResults(); break;
    case 'go-final-setup':
      state.subScreen = 'finalSetup';
      state.setupErr = '';
      if (!state.setupFinalQ) state.setupFinalQ = {category:'', q:'', a:''};
      render(true); break;
    case 'leave-final-setup': state.subScreen = null; render(true); break;
    case 'leave-final-to-modeselect':
      state.subScreen = 'modeSelect'; state.setupErr=''; render(true); break;
    case 'save-final-setup': {
      // Read inputs (they live in state already via listeners, but ensure latest)
      const fq = state.setupFinalQ || {};
      if (!fq.category?.trim() || !fq.q?.trim() || !fq.a?.trim()) {
        state.setupErr = 'Заповни категорію, питання і відповідь (або натисни Назад щоб пропустити фінал)';
        render(true); break;
      }
      state.subScreen = 'modeSelect';
      state.setupErr = '';
      render(true); break;
    }
    case 'start-final': await startFinalRound(); break;
    case 'submit-final-bid': await submitFinalBid(); break;
    case 'submit-final-answer': await submitFinalAnswer(); break;
    case 'start-final-answer-phase': await startFinalAnswerPhase(); break;
    case 'go-final-reveal': await goFinalReveal(); break;
    case 'next-final-reveal': await nextFinalReveal(); break;
    case 'judge-final': await judgeFinalPlayer(el.dataset.player, el.dataset.verdict); break;
    case 'finalize-final': await finalizeFinal(); break;
    // Score edit
    case 'edit-score':
      e.stopPropagation();
      state.editingScorePlayerId = el.dataset.player;
      state.scoreEditInputValue = '';
      render(true); break;
    case 'close-score-edit':
      // Only close if backdrop or close button itself was clicked (not modal content)
      if (el.dataset.action === 'close-score-edit') {
        state.editingScorePlayerId = null;
        state.scoreEditInputValue = '';
        render(true);
      }
      break;
    case 'score-delta':
      e.stopPropagation();
      await applyScoreDelta(parseInt(el.dataset.delta, 10));
      break;
    case 'score-set-exact':
      e.stopPropagation();
      await applyScoreExact();
      break;
    case 'kick-player':
      e.stopPropagation();
      await kickPlayer(el.dataset.player);
      break;
    case 'show-format-help':
      state.showFormatHelp = true;
      render(true); break;
    case 'close-format-help':
      if (el.dataset.action === 'close-format-help') {
        state.showFormatHelp = false;
        render(true);
      }
      break;
    case 'show-changelog':
      state.showChangelog = true;
      render(true); break;
    case 'close-changelog':
      if (el.dataset.action === 'close-changelog') {
        state.showChangelog = false;
        render(true);
      }
      break;
    case 'open-chat':
      state.chatOpen = true;
      state.chatLastSeenTs = Date.now();
      render(true); break;
    case 'close-chat':
      state.chatOpen = false;
      render(true); break;
    case 'send-chat':
      await sendChat();
      break;
  }
}

// ============== FILE HANDLING ==============
async function handleFileChange(e){
  const file = e.target.files[0];
  if (file) await processUploadedFile(file);
}

async function processUploadedFile(file){
  state.setupErr = '';
  state.setupLoading = true; render(true);
  try {
    let pack;
    const name = file.name.toLowerCase();
    if (name.endsWith('.docx')) {
      pack = await parseDocxFile(file);
    } else if (name.endsWith('.txt') || name.endsWith('.md')) {
      const text = await file.text();
      pack = await parseTextToPack(text);
    } else {
      throw new Error('Підтримуються тільки .docx і .txt');
    }
    if (!pack.categories || pack.categories.length === 0) {
      throw new Error('Не знайшли жодної категорії. Перевір формат файлу.');
    }
    state.setupFilePack = pack;
    state.setupSavePackName = file.name.replace(/\.(docx|txt|md)$/i, '');
  } catch (e) {
    console.error(e);
    state.setupErr = 'Помилка: ' + (e.message || 'не вдалося розпарсити файл');
  }
  state.setupLoading = false;
  render(true);
}

let pendingImageKey = null;
let pendingImageField = 'image';
async function pickImageFor(key, field = 'image'){
  pendingImageKey = key;
  pendingImageField = field;
  const input = document.getElementById('img-input');
  if (!input) return;
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const [ci, qi] = pendingImageKey.split('-').map(Number);
      if (state.setupManualPack) {
        state.setupManualPack.categories[ci].questions[qi][pendingImageField] = dataUrl;
        render(true);
      }
    } catch (err) { console.error(err); alert('Не вдалося завантажити картинку'); }
  };
  input.click();
}
function clearImageFor(key, field = 'image'){
  const [ci, qi] = key.split('-').map(Number);
  if (state.setupManualPack) {
    state.setupManualPack.categories[ci].questions[qi][field] = null;
    render(true);
  }
}

// ============== PACKS ==============
async function refreshPacks(){
  state.savedPacks = await listPacks();
  state.loadedPacksOnce = true;
  render(true);
}
async function saveCurrentPack(pack){
  if (!pack) return;
  let name = state.setupSavePackName?.trim();
  if (!name) { name = prompt('Назва пака:') || ''; name = name.trim(); }
  if (!name) return;
  state.setupErr = '';
  try {
    const saved = await savePack(name, pack);
    if (saved) {
      state.savedPacks = [saved, ...state.savedPacks];
      state.setupSavePackName = '';
      alert('Пак збережено в БД ✓');
      render(true);
    } else {
      state.setupErr = 'Не вдалося зберегти (без деталей)';
      render(true);
    }
  } catch (e) {
    console.error('[saveCurrentPack] error:', e);
    state.setupErr = 'Помилка збереження: ' + (e.message || e);
    render(true);
    alert('Не вдалося зберегти: ' + (e.message || e));
  }
}
async function useSavedPack(id){
  const found = state.savedPacks.find(p => p.id === id);
  if (!found) return;
  await startGame(found.pack);
}
async function handleDeletePack(id){
  if (!confirm('Видалити цей пак назавжди?')) return;
  await deletePack(id);
  state.savedPacks = state.savedPacks.filter(p => p.id !== id);
  render(true);
}

// ============== ACTIONS ==============
async function doJoin(){
  state.err = '';
  state.loading = true; render(true);
  // Use state (kept in sync with input via listener), not DOM lookup
  const rawCode = (state.joinCodeInput || '').replace(/\s+/g, '').toUpperCase();
  const c = rawCode;
  const name = (state.joinNameInput || lsGet(LS_NAME) || '').trim();
  console.log('[Join] code:', JSON.stringify(c), 'length:', c.length, 'name:', JSON.stringify(name));
  if (c.length === 0) { state.err = 'Введи код кімнати'; state.loading=false; render(true); return; }
  if (c.length !== 4) { state.err = `Код має бути з 4 символів (зараз ${c.length})`; state.loading=false; render(true); return; }
  if (!name) { state.err = 'Введи нікнейм'; state.loading=false; render(true); return; }
  const r = await getRoom(c);
  if (!r) { state.err = `Кімнату "${c}" не знайдено. Перевір код у ведучого.`; state.loading=false; render(true); return; }
  lsSet(LS_NAME, name);
  const players = r.players || {};
  // Check if I'm already in (reconnecting)
  const existing = Object.values(players).find(p => p.id === state.myId);
  if (!existing) {
    players[state.myId] = { id: state.myId, name, avatar: state.joinAvatar, score: 0 };
    // Clear any stale "kicked" flag so re-joining works
    await update(ref(db, `rooms/${c}`), { players, [`kicked/${state.myId}`]: null });
  }
  state.code = c; state.isHost = (r.hostId === state.myId);
  lsSet(LS_CODE, c);
  state.screen = 'lobby'; state.loading=false; state.err = '';
  attachRoomListener(c);
  render(true);
}

async function doHostCreate(){
  const name = (state.hostNameInput || lsGet(LS_NAME) || '').trim();
  if (!name) { state.err = 'Введи нікнейм'; render(true); return; }
  lsSet(LS_NAME, name);
  const c = genCode();
  const room = {
    hostId: state.myId,
    status: 'lobby',
    players: {
      [state.myId]: { id: state.myId, name, avatar: state.hostAvatar, score: 0 }
    },
    pack: null, usedCells: {}, currentCell: null,
    buzzedPlayer: null, attemptedBy: [], questionState: null,
    currentPicker: null, revealAnswer: false,
    createdAt: Date.now(),
  };
  await setRoomFull(c, room);
  state.code = c; state.isHost = true; state.screen = 'lobby'; state.err='';
  lsSet(LS_CODE, c);
  attachRoomListener(c);
  render(true);
}

function attachRoomListener(code){
  if (state.unsubscribeRoom) state.unsubscribeRoom();
  state.unsubscribeRoom = listenRoom(code, (data) => {
    if (!data) {
      // Room deleted/expired
      leave();
      return;
    }
    // Detect being kicked: host removed me from players (or marked kicked)
    if (!state.isHost && state.myId) {
      const kicked = (data.kicked && data.kicked[state.myId]);
      const removed = data.players && !data.players[state.myId];
      // Only treat as kick if we were previously in the room
      if ((kicked || removed) && state.room && state.room.players && state.room.players[state.myId]) {
        if (state.unsubscribeRoom) { state.unsubscribeRoom(); state.unsubscribeRoom = null; }
        lsDel(LS_CODE);
        state.room = null; state.code = ''; state.isHost = false;
        state.screen = 'home'; state.subScreen = null;
        state.err = 'Ведучий видалив тебе з гри.';
        state.lastRenderHash = '';
        render(true);
        return;
      }
    }
    // Reset anti-spam cooldown when a new cell/question begins
    const prevCell = state.room?.currentCell;
    const newCell = data.currentCell;
    const cellChanged = JSON.stringify(prevCell) !== JSON.stringify(newCell);
    if (cellChanged) { state.lastBuzzAttempt = 0; state.buzzCooldownUntil = 0; }
    state.room = data;
    // Sync screen with status (only for the standard board/question/results flow;
    // round_done/final_* are rendered by status check directly)
    if (!state.subScreen) {
      const statusToScreen = {lobby:'lobby', board:'board', question:'question', results:'results'};
      const wanted = statusToScreen[data.status];
      if (wanted && state.screen !== wanted && ['lobby','board','question','results'].includes(state.screen)) {
        state.screen = wanted;
      }
    }
    // If the host has the score-edit modal open, avoid a full re-render (it would
    // flicker). Just refresh the score number shown in the modal incrementally.
    if (state.editingScorePlayerId && document.getElementById('modal-score-value')) {
      const p = data.players && data.players[state.editingScorePlayerId];
      if (p) updateScoreModalOnly(p.score || 0);
      // Update the underlying hash so a later real change still renders
      state.lastRenderHash = computeHash();
      return;
    }
    render();
  });
}

// Validate a pack, return array of problem strings (empty = valid)
function validatePack(pack){
  const problems = [];
  if (!pack || !pack.categories || pack.categories.length < CATS_PER_BOARD) {
    problems.push(`Потрібно ${CATS_PER_BOARD} категорій, знайдено ${pack?.categories?.length || 0}`);
    return problems;
  }
  pack.categories.slice(0, CATS_PER_BOARD).forEach((c, ci) => {
    if (!c.name || !c.name.trim()) problems.push(`Категорія №${ci+1}: порожня назва`);
    const qs = c.questions || [];
    if (qs.length < QS_PER_CAT) problems.push(`Категорія "${c.name||ci+1}": лише ${qs.length}/5 питань`);
    qs.forEach((q, qi) => {
      const hasText = q.q && q.q.trim();
      const hasImage = !!q.image;
      const hasAnsText = q.a && q.a.trim();
      const hasAnsImage = !!q.answerImage;
      if (!hasText && !hasImage) problems.push(`"${c.name||ci+1}" · ${q.value || VALUES[qi]}: порожнє питання`);
      if (!hasAnsText && !hasAnsImage) problems.push(`"${c.name||ci+1}" · ${q.value || VALUES[qi]}: порожня відповідь`);
    });
  });
  return problems;
}

// Assign a chosen pack to the round slot the host is editing, then return to mode select
async function assignPackToRound(pack){
  const problems = validatePack(pack);
  if (problems.length > 0) {
    state.setupErr = 'Проблеми у паку:\n• ' + problems.slice(0, 8).join('\n• ') + (problems.length > 8 ? `\n...і ще ${problems.length-8}` : '');
    render(true); return;
  }
  const roundN = state.editingRound || 1;
  state.setupRoundPacks[roundN] = pack;
  state.editingRound = null;
  state.subScreen = 'modeSelect';
  state.setupSource = null;
  state.setupFilePack = null;
  state.setupAiPreview = null;
  state.setupManualPack = null;
  state.setupErr = '';
  render(true);
}

// Start the game once all round packs are collected
async function startAllRounds(){
  if (!state.isHost) return;
  const rt = state.setupRoundsTotal || 1;
  for (let i = 1; i <= rt; i++) {
    if (!state.setupRoundPacks[i]) {
      state.setupErr = `Не завантажено пак для раунду ${i}`;
      render(true); return;
    }
  }
  state.setupCurrentRound = 1;
  await startGame(state.setupRoundPacks[1]);
}

async function startGame(pack){
  console.log('[startGame] pack:', pack);
  if (!pack || !pack.categories || pack.categories.length < CATS_PER_BOARD) {
    state.setupErr = `Потрібно ${CATS_PER_BOARD} категорій. У файлі знайдено: ${pack?.categories?.length || 0}.\n\nПеревір формат файлу — має бути 6 рядків що починаються з "#" і потім по 5 питань під кожним.`;
    render(true); return;
  }
  const problems = [];
  pack.categories.slice(0, CATS_PER_BOARD).forEach((c, ci) => {
    if (!c.name || !c.name.trim()) problems.push(`Категорія №${ci+1}: порожня назва`);
    const qs = c.questions || [];
    if (qs.length < QS_PER_CAT) problems.push(`Категорія "${c.name||ci+1}": лише ${qs.length}/5 питань`);
    qs.forEach((q, qi) => {
      const hasText = q.q && q.q.trim();
      const hasImage = !!q.image;
      const hasAnsText = q.a && q.a.trim();
      const hasAnsImage = !!q.answerImage;
      // Allow empty question if there's an image (image-only question)
      if (!hasText && !hasImage) {
        problems.push(`"${c.name||ci+1}" · ${q.value || VALUES[qi]} балів: порожнє питання (немає ні тексту, ні картинки)`);
      }
      // Allow empty answer text if there's an answer image
      if (!hasAnsText && !hasAnsImage) {
        problems.push(`"${c.name||ci+1}" · ${q.value || VALUES[qi]} балів: порожня відповідь (немає ні тексту, ні картинки)`);
      }
    });
  });
  if (problems.length > 0) {
    state.setupErr = 'Знайдено проблеми у паку:\n• ' + problems.slice(0, 8).join('\n• ') + (problems.length > 8 ? `\n...і ще ${problems.length-8}` : '');
    render(true); return;
  }
  state.setupLoading = true; render(true);
  const r = await getRoom(state.code);
  if (!r) { state.setupErr = 'Кімната зникла'; state.setupLoading=false; render(true); return; }
  const players = r.players || {};
  const playerList = Object.values(players);

  // Multi-round logic
  const roundNum = state.setupCurrentRound || 1;
  const roundsTotal = state.setupRoundsTotal || 1;
  const isFirstRound = roundNum === 1;
  const valueMult = roundNum;

  // Reset scores only on first round
  if (isFirstRound) {
    for (const pid of Object.keys(players)) {
      players[pid] = { ...players[pid], score: 0 };
    }
  }

  // Pick first picker — top scorer (or random for first round)
  const nonHost = playerList.filter(p => p.id !== r.hostId);
  let firstPicker;
  if (isFirstRound) {
    firstPicker = nonHost[0];
  } else {
    // After round 1: lowest scorer picks first (Jeopardy tradition)
    firstPicker = [...nonHost].sort((a,b)=>(a.score||0)-(b.score||0))[0];
  }

  const cleanPack = {
    name: pack.name || 'Custom',
    categories: pack.categories.slice(0, CATS_PER_BOARD).map(c => ({
      name: c.name,
      questions: c.questions.slice(0, QS_PER_CAT).map((q, i) => ({
        value: VALUES[i] * valueMult,
        q: q.q, a: q.a, explanation: q.explanation || null, image: q.image || null, answerImage: q.answerImage || null,
      }))
    }))
  };
  const patch = {
    pack: cleanPack,
    status: 'board',
    usedCells: {},
    currentCell: null,
    buzzedPlayer: null,
    attemptedBy: [],
    questionState: null,
    currentPicker: firstPicker ? firstPicker.id : null,
    revealAnswer: false,
    currentRound: roundNum,
    players
  };
  if (isFirstRound) {
    patch.roundsTotal = roundsTotal;
    patch.finalQ = null;
    patch.finalBids = null;
    patch.finalJudgement = null;
    patch.buzzSecondsConfig = state.setupBuzzSeconds || BUZZ_SECONDS;
    patch.answerSecondsConfig = state.setupAnswerSeconds || ANSWER_SECONDS;
    patch.buzzModeConfig = state.setupBuzzMode || 'instant';
    patch.antiSpamConfig = !!state.setupAntiSpam;
    patch.countdownSecondsConfig = state.setupCountdownSeconds || 5;
  }
  await update(ref(db, `rooms/${state.code}`), patch);
  state.subScreen = null;
  state.screen = 'board';
  state.setupLoading = false; state.setupErr = '';
  state.setupFilePack = null; state.setupAiPreview = null;
  render(true);
}

async function aiGenerate(){
  state.setupErr = '';
  const filled = state.setupAiTopics.filter(t => t && t.trim()).length;
  if (filled < CATS_PER_BOARD) { state.setupErr = `Заповни всі ${CATS_PER_BOARD} тем`; render(true); return; }
  state.setupLoading = true; render(true);
  try {
    const { pack, issues } = await generateAIPack(state.setupAiTopics);
    state.setupAiPreview = pack;
    if (issues.length > 0) {
      state.setupErr = `AI може мати проблеми у питаннях:\n• ${issues.slice(0,5).join('\n• ')}\nПереглянь прев'ю — або згенеруй ще раз.`;
    }
  } catch (e) {
    console.error(e);
    state.setupErr = 'AI помилка: ' + (e.message || 'не вдалося');
  }
  state.setupLoading = false;
  render(true);
}

function copyCode(){
  if (navigator.clipboard) navigator.clipboard.writeText(state.code);
  state.copied = true; render(true);
  setTimeout(()=>{ state.copied = false; render(true); }, 1500);
}

async function pickCell(ci, qi){
  const r = state.room;
  if (!r) return;
  if (!state.isHost) return; // only host picks
  if (r.usedCells && r.usedCells[`${ci}-${qi}`]) return;
  const now = serverNow();
  const mode = r.buzzModeConfig || (r.manualBuzzConfig ? 'manual' : 'instant');
  const patch = {
    currentCell: {ci, qi},
    buzzedPlayer: null,
    attemptedBy: [],
    buzzPhaseRemainingMs: null,
    answerPhaseDeadline: null,
    countdownDeadline: null,
    revealAnswer: false,
    phaseStartedAt: now,
    status: 'question'
  };
  if (mode === 'manual') {
    // Host presses "open buzzer" when ready
    patch.questionState = 'reading';
    patch.buzzPhaseDeadline = null;
  } else if (mode === 'countdown') {
    // Show a countdown to all players, buzzer opens automatically after it
    const cd = r.countdownSecondsConfig || 5;
    patch.questionState = 'countdown';
    patch.countdownDeadline = now + cd * 1000;
    patch.buzzPhaseDeadline = null;
  } else {
    // instant
    patch.questionState = 'buzzing';
    patch.buzzPhaseDeadline = now + buzzSec(r) * 1000;
  }
  await update(ref(db, `rooms/${state.code}`), patch);
}

// Called by host when countdown finishes — opens the buzzer
async function openBuzzAfterCountdown(){
  const fresh = await getRoom(state.code);
  if (!fresh) return;
  if (fresh.questionState !== 'countdown') return;
  if (fresh.countdownDeadline && serverNow() < fresh.countdownDeadline) return;
  const now = serverNow();
  await update(ref(db, `rooms/${state.code}`), {
    questionState: 'buzzing',
    buzzPhaseDeadline: now + buzzSec(fresh) * 1000,
    countdownDeadline: null,
  });
}

async function openBuzz(){
  if (!state.isHost) return;
  const r = state.room;
  const now = serverNow();
  await update(ref(db, `rooms/${state.code}`), {
    questionState: 'buzzing',
    buzzPhaseDeadline: now + buzzSec(r) * 1000,
  });
}

// Re-fetch fresh room state and re-attach the listener (fixes a stuck/frozen
// realtime connection for a player whose buzzer appears unresponsive).
async function resyncRoom(){
  if (!state.code) return;
  try {
    const fresh = await getRoom(state.code);
    if (fresh) {
      state.room = fresh;
      // Clear any local cooldown that might be lingering
      state.lastBuzzAttempt = 0;
      state.buzzCooldownUntil = 0;
      state.lastRenderHash = '';
    }
    // Re-establish the realtime listener in case it dropped
    attachRoomListener(state.code);
    render(true);
  } catch (e) {
    console.error('[resync]', e);
  }
}

async function buzz(){
  if (state.isHost) return;
  if (!state.myId) return;
  if (!state.code) return;
  const r = state.room;
  if (!r || r.status !== 'question') return;
  if ((r.attemptedBy||[]).includes(state.myId)) return;

  // Anti-spam (hardcore): every press counts toward the cooldown — even presses
  // made BEFORE the buzzer opens. Pressing early = you're locked out for 1s, so
  // someone who waits for the buzzer can beat a spammer to it.
  if (r.antiSpamConfig) {
    const now0 = Date.now();
    if (state.lastBuzzAttempt && (now0 - state.lastBuzzAttempt) < 1000) {
      // Still cooling down — ignore + extend lockout (mashing hurts you)
      state.buzzCooldownUntil = state.lastBuzzAttempt + 1000;
      showBuzzCooldownHint();
      state.lastBuzzAttempt = now0;
      return;
    }
    state.lastBuzzAttempt = now0;
    state.buzzCooldownUntil = now0 + 1000;
  }

  // Buzzer must be open to actually register the buzz. If it's not open yet
  // (reading/countdown) the press above already triggered the cooldown, but
  // nothing is registered — the player simply wasted their press.
  if (r.questionState !== 'buzzing') return;
  if (r.buzzedPlayer) return;

  // Work from fresh DB state to avoid stale local issues
  const fresh = await getRoom(state.code);
  if (!fresh) return;
  if (fresh.status !== 'question') return;
  if (fresh.questionState !== 'buzzing') return;
  if (fresh.buzzedPlayer) return;
  if ((fresh.attemptedBy||[]).includes(state.myId)) return;
  // NOTE: we deliberately do NOT reject based on Date.now() vs buzzPhaseDeadline.
  // A player's local clock can be skewed minutes ahead, which would make every
  // buzz look "expired" and silently block them. The host closes the question on
  // timeout using its own clock; the player only needs the buzzer to be open.
  const now = serverNow();
  let remaining = buzzSec(fresh) * 1000;
  if (fresh.buzzPhaseDeadline) {
    const calc = fresh.buzzPhaseDeadline - now;
    remaining = Math.max(1000, Math.min(buzzSec(fresh) * 1000, calc > 0 ? calc : buzzSec(fresh) * 1000));
  }
  // Atomically claim the buzzer: only the FIRST writer wins. Concurrent buzzes
  // won't overwrite each other, so the wrong name never briefly appears.
  const buzzedRef = ref(db, `rooms/${state.code}/buzzedPlayer`);
  try {
    const res = await runTransaction(buzzedRef, (cur) => {
      if (cur) return; // someone already buzzed — abort, keep theirs
      return state.myId;
    });
    if (!res.committed || res.snapshot.val() !== state.myId) return; // we didn't win
  } catch (e) {
    console.error('[buzz transaction]', e);
    return;
  }
  // We won the buzzer — set the answering phase fields
  await update(ref(db, `rooms/${state.code}`), {
    questionState: 'answering',
    buzzPhaseRemainingMs: remaining,
    answerPhaseDeadline: now + answerSec(fresh) * 1000,
  });
}

// Briefly flash the buzz button red to signal cooldown
function showBuzzCooldownHint(){
  const btn = document.querySelector('.buzz-btn');
  if (!btn) return;
  btn.classList.add('cooldown');
  setTimeout(() => { const b = document.querySelector('.buzz-btn'); if (b) b.classList.remove('cooldown'); }, 600);
}

async function judge(correctStr){
  if (!state.isHost) return;
  // Read fresh state so buzzPhaseRemainingMs / attemptedBy are accurate
  const r = await getRoom(state.code);
  if (!r || !r.buzzedPlayer || !r.currentCell) return;
  const {ci, qi} = r.currentCell;
  const q = r.pack.categories[ci].questions[qi];
  const buzzedId = r.buzzedPlayer;
  const players = { ...r.players };
  const patch = {};

  if (correctStr === '1') {
    players[buzzedId] = { ...players[buzzedId], score: (players[buzzedId].score||0) + q.value };
    patch.usedCells = { ...(r.usedCells||{}), [`${ci}-${qi}`]: true };
    patch.currentPicker = buzzedId;
    patch.revealAnswer = true;
    patch.questionState = 'closed';
    patch.buzzedPlayer = null;
    patch.buzzPhaseDeadline = null;
    patch.answerPhaseDeadline = null;
    patch.buzzPhaseRemainingMs = null;
  } else if (correctStr === '0') {
    players[buzzedId] = { ...players[buzzedId], score: (players[buzzedId].score||0) - q.value };
    const newAttempted = [...(r.attemptedBy||[]), buzzedId];
    const nonHostCount = Object.values(r.players||{}).filter(p => p.id !== r.hostId).length;
    patch.attemptedBy = newAttempted;
    patch.buzzedPlayer = null;
    // If everyone has already attempted, close the question
    if (newAttempted.length >= nonHostCount) {
      patch.usedCells = { ...(r.usedCells||{}), [`${ci}-${qi}`]: true };
      patch.questionState = 'closed';
      patch.revealAnswer = true;
      patch.buzzPhaseDeadline = null;
      patch.buzzPhaseRemainingMs = null;
      patch.answerPhaseDeadline = null;
    } else {
      patch.questionState = 'buzzing';
      const remaining = (typeof r.buzzPhaseRemainingMs === "number" && r.buzzPhaseRemainingMs > 0) ? r.buzzPhaseRemainingMs : (buzzSec(r) * 1000);
      patch.buzzPhaseDeadline = serverNow() + remaining;
      patch.buzzPhaseRemainingMs = null;
      patch.answerPhaseDeadline = null;
    }
  } else {
    // "skip" / not counted
    const newAttempted = [...(r.attemptedBy||[]), buzzedId];
    const nonHostCount = Object.values(r.players||{}).filter(p => p.id !== r.hostId).length;
    patch.attemptedBy = newAttempted;
    patch.buzzedPlayer = null;
    if (newAttempted.length >= nonHostCount) {
      patch.usedCells = { ...(r.usedCells||{}), [`${ci}-${qi}`]: true };
      patch.questionState = 'closed';
      patch.revealAnswer = true;
      patch.buzzPhaseDeadline = null;
      patch.buzzPhaseRemainingMs = null;
      patch.answerPhaseDeadline = null;
    } else {
      patch.questionState = 'buzzing';
      const remaining = (typeof r.buzzPhaseRemainingMs === "number" && r.buzzPhaseRemainingMs > 0) ? r.buzzPhaseRemainingMs : (buzzSec(r) * 1000);
      patch.buzzPhaseDeadline = serverNow() + remaining;
      patch.buzzPhaseRemainingMs = null;
      patch.answerPhaseDeadline = null;
    }
  }
  patch.players = players;
  await update(ref(db, `rooms/${state.code}`), patch);
}

// Called when a timer expires. Any client can trigger this; we check
// state freshness before applying changes to avoid double-firing.
async function timeoutBuzzPhase(){
  const fresh = await getRoom(state.code);
  if (!fresh) return;
  // Only fire if we're still in buzzing and deadline has passed
  if (fresh.questionState !== 'buzzing') return;
  if (!fresh.buzzPhaseDeadline || serverNow() < fresh.buzzPhaseDeadline) return;
  // Never auto-close a question that just started (guards against clock races)
  if (fresh.phaseStartedAt && serverNow() - fresh.phaseStartedAt < 1200) return;
  if (!fresh.currentCell) return;
  const {ci, qi} = fresh.currentCell;
  const used = { ...(fresh.usedCells||{}), [`${ci}-${qi}`]: true };
  const patch = {
    usedCells: used,
    revealAnswer: true,
    questionState: 'closed',
    buzzedPlayer: null,
    buzzPhaseDeadline: null,
    answerPhaseDeadline: null,
    buzzPhaseRemainingMs: null,
  };
  try {
    await update(ref(db, `rooms/${state.code}`), patch);
  } catch (e) {
    console.error('[timeoutBuzzPhase] write failed (likely permissions):', e);
  }
}

async function timeoutAnswerPhase(){
  const fresh = await getRoom(state.code);
  if (!fresh) return;
  if (fresh.questionState !== 'answering') return;
  if (!fresh.answerPhaseDeadline || serverNow() < fresh.answerPhaseDeadline) return;
  if (!fresh.buzzedPlayer || !fresh.currentCell) return;
  // Treat as wrong: deduct value, return to buzzing or close if all attempted
  const {ci, qi} = fresh.currentCell;
  const q = fresh.pack.categories[ci].questions[qi];
  const buzzedId = fresh.buzzedPlayer;
  const players = { ...fresh.players };
  players[buzzedId] = { ...players[buzzedId], score: (players[buzzedId].score||0) - q.value };
  const newAttempted = [...(fresh.attemptedBy||[]), buzzedId];
  const nonHostCount = Object.values(fresh.players||{}).filter(p => p.id !== fresh.hostId).length;

  if (newAttempted.length >= nonHostCount) {
    await update(ref(db, `rooms/${state.code}`), {
      players,
      attemptedBy: newAttempted,
      usedCells: { ...(fresh.usedCells||{}), [`${ci}-${qi}`]: true },
      buzzedPlayer: null,
      questionState: 'closed',
      revealAnswer: true,
      buzzPhaseDeadline: null,
      buzzPhaseRemainingMs: null,
      answerPhaseDeadline: null,
    });
  } else {
    const remaining = fresh.buzzPhaseRemainingMs || (buzzSec(fresh) * 1000);
    await update(ref(db, `rooms/${state.code}`), {
      players,
      attemptedBy: newAttempted,
      buzzedPlayer: null,
      questionState: 'buzzing',
      buzzPhaseDeadline: serverNow() + remaining,
      buzzPhaseRemainingMs: null,
      answerPhaseDeadline: null,
    });
  }
}

async function revealAnswer(){
  if (!state.isHost) return;
  const r = state.room;
  if (!r || !r.currentCell) return;
  const {ci, qi} = r.currentCell;
  const used = { ...(r.usedCells||{}), [`${ci}-${qi}`]: true };
  await update(ref(db, `rooms/${state.code}`), {
    usedCells: used,
    revealAnswer: true,
    questionState: 'closed',
    buzzedPlayer: null,
    buzzPhaseDeadline: null,
    answerPhaseDeadline: null,
    buzzPhaseRemainingMs: null,
  });
}

async function closeQuestion(){
  if (!state.isHost) return;
  await update(ref(db, `rooms/${state.code}`), {
    currentCell: null, buzzedPlayer: null, attemptedBy: [],
    questionState: null, revealAnswer: false, status: 'board',
    buzzPhaseDeadline: null, answerPhaseDeadline: null, buzzPhaseRemainingMs: null,
  });
}

async function backToBoard(){
  if (!state.isHost) return;
  const r = state.room;
  if (!r) return;
  const totalCells = CATS_PER_BOARD * QS_PER_CAT;
  const isRoundDone = Object.keys(r.usedCells || {}).length >= totalCells;
  await update(ref(db, `rooms/${state.code}`), {
    currentCell: null, buzzedPlayer: null, attemptedBy: [],
    questionState: null, revealAnswer: false,
    status: isRoundDone ? 'round_done' : 'board',
    buzzPhaseDeadline: null, answerPhaseDeadline: null, buzzPhaseRemainingMs: null,
  });
}

async function endGame(){
  if (!state.isHost) return;
  if (!confirm('Завершити гру і показати фінальні результати?')) return;
  await update(ref(db, `rooms/${state.code}`), { status: 'results', currentCell: null });
}

async function playAgain(){
  if (!state.isHost) return;
  const r = state.room;
  if (!r) return;
  const players = { ...r.players };
  for (const pid of Object.keys(players)) {
    players[pid] = { ...players[pid], score: 0 };
  }
  await update(ref(db, `rooms/${state.code}`), {
    status: 'lobby', players, pack: null, usedCells: {},
    currentCell: null, buzzedPlayer: null, attemptedBy: [],
    questionState: null, currentPicker: null, revealAnswer: false,
    roundsTotal: null, currentRound: null,
    finalQ: null, finalBids: null, finalJudgement: null, finalBaseScores: null,
    chat: null
  });
}

// ============== ROUND / FINAL ACTIONS ==============
async function goNextRound(nextRoundNum){
  if (!state.isHost) return;
  const r = state.room;
  if (!r) return;
  state.setupCurrentRound = nextRoundNum;
  state.setupRoundsTotal = r.roundsTotal || nextRoundNum;
  // Use the pack collected during setup
  const pack = state.setupRoundPacks?.[nextRoundNum];
  if (!pack) {
    // Fallback: if packs weren't pre-collected (e.g. old flow), ask to pick
    state.editingRound = nextRoundNum;
    state.setupSource = null;
    state.setupErr = '';
    state.setupFilePack = null;
    state.setupAiPreview = null;
    state.setupManualPack = null;
    state.subScreen = 'questionSetup';
    render(true);
    return;
  }
  await startGame(pack);
}

async function skipToResults(){
  if (!state.isHost) return;
  if (!confirm('Завершити гру без фінального раунду?')) return;
  await update(ref(db, `rooms/${state.code}`), { status: 'results' });
}

async function startFinalRound(){
  if (!state.isHost) return;
  const fq = state.setupFinalQ || {};
  if (!fq.category?.trim() || !fq.q?.trim() || !fq.a?.trim()) {
    state.setupErr = 'Заповни категорію, питання і відповідь';
    render(true); return;
  }
  const r = state.room;
  // Snapshot scores before final so verdicts can be re-applied idempotently
  const baseScores = {};
  for (const [pid, p] of Object.entries(r.players || {})) {
    baseScores[pid] = p.score || 0;
  }
  await update(ref(db, `rooms/${state.code}`), {
    status: 'final_bid',
    currentRound: 'final',
    finalQ: { category: fq.category.trim(), q: fq.q.trim(), a: fq.a.trim() },
    finalBids: {},
    finalJudgement: {},
    finalBaseScores: baseScores,
    finalPhaseDeadline: null,
  });
  state.subScreen = null;
  state.setupFinalQ = {category:'', q:'', a:''};
  render(true);
}

// Timeout for final_answer phase (90 sec to write answer)
async function timeoutFinalPhase(){
  const fresh = await getRoom(state.code);
  if (!fresh) return;
  if (fresh.status !== 'final_answer') return;
  if (!fresh.finalPhaseDeadline || serverNow() < fresh.finalPhaseDeadline) return;
  await update(ref(db, `rooms/${state.code}`), {
    status: 'final_reveal',
    finalPhaseDeadline: null,
    finalRevealIndex: 0,
  });
}

async function submitFinalBid(){
  const r = state.room;
  if (!r || state.isHost) return;
  if (r.status !== 'final_bid') return;
  const me = r.players?.[state.myId];
  if (!me) return;
  // If a player has 0 or negative score, still let them bid up to a floor so they
  // can play the final (classic Jeopardy rule). Otherwise cap at their score.
  const maxBid = Math.max(FINAL_MIN_BID_CAP, me.score || 0);
  const bid = state.finalBidLocal;
  if (!Number.isInteger(bid) || bid < 0 || bid > maxBid) return;
  await update(ref(db, `rooms/${state.code}/finalBids/${state.myId}`), {
    bid, bidSubmitted: true, bidSubmittedAt: Date.now()
  });
}

async function submitFinalAnswer(){
  const r = state.room;
  if (!r || state.isHost) return;
  if (r.status !== 'final_answer') return;
  const ans = (state.finalAnswerLocal || '').trim();
  if (!ans) return;
  // Ensure bid exists — fall back to 0 if player skipped phase 1
  const existing = r.finalBids?.[state.myId];
  const bidVal = (existing && typeof existing.bid === 'number') ? existing.bid : 0;
  const bidSubmitted = !!(existing && existing.bidSubmitted);
  await update(ref(db, `rooms/${state.code}/finalBids/${state.myId}`), {
    bid: bidVal, bidSubmitted,
    answer: ans, answerSubmitted: true, answerSubmittedAt: Date.now()
  });
}

async function startFinalAnswerPhase(){
  if (!state.isHost) return;
  await update(ref(db, `rooms/${state.code}`), {
    status: 'final_answer',
    finalPhaseDeadline: serverNow() + FINAL_SECONDS * 1000,
  });
}

async function goFinalReveal(){
  if (!state.isHost) return;
  await update(ref(db, `rooms/${state.code}`), { status: 'final_reveal', finalRevealIndex: 0 });
}

// Advance to reveal the next player's answer
async function nextFinalReveal(){
  if (!state.isHost) return;
  const r = state.room;
  if (!r) return;
  const cur = r.finalRevealIndex || 0;
  await update(ref(db, `rooms/${state.code}`), { finalRevealIndex: cur + 1 });
}

// ============== CHAT ==============
async function sendChat(){
  const r = state.room;
  if (!r || !state.code) return;
  const text = (state.chatInputLocal || '').trim();
  if (!text) return;
  const msgId = genId();
  const me = r.players?.[state.myId];
  const name = state.isHost ? (me?.name || 'Ведучий') : (me?.name || lsGet(LS_NAME) || 'Гравець');
  const avatar = me?.avatar || (state.isHost ? '🎙' : '👤');
  const msg = {
    uid: state.myId,
    name: name,
    avatar: avatar,
    text: text.slice(0, 300),
    ts: Date.now(),
  };
  state.chatInputLocal = '';
  state.chatLastSeenTs = Date.now();
  // Clear the input field immediately for responsiveness
  const inp = document.getElementById('chat-input');
  if (inp) inp.value = '';
  try {
    await set(ref(db, `rooms/${state.code}/chat/${msgId}`), msg);
  } catch (e) {
    console.error('[sendChat]', e);
  }
}

async function judgeFinalPlayer(playerId, verdict){
  if (!state.isHost) return;
  const r = state.room;
  if (!r) return;
  const sub = r.finalBids?.[playerId];
  // Base score = score before final (fallback to current if missing)
  const base = (r.finalBaseScores && r.finalBaseScores[playerId] != null)
    ? r.finalBaseScores[playerId]
    : (r.players?.[playerId]?.score || 0);
  const rawBid = sub?.bid;
  const bidNum = (typeof rawBid === 'number' && !isNaN(rawBid)) ? rawBid : parseInt(rawBid, 10);
  const safeBid = Number.isFinite(bidNum) ? bidNum : 0;
  let newScore = base;
  if (verdict === 'correct') newScore = base + safeBid;
  else if (verdict === 'wrong') newScore = base - safeBid;
  // Multi-path update: set verdict AND recompute score from base (idempotent)
  await update(ref(db, `rooms/${state.code}`), {
    [`finalJudgement/${playerId}`]: verdict,
    [`players/${playerId}/score`]: newScore,
  });
}

async function finalizeFinal(){
  if (!state.isHost) return;
  const r = state.room;
  if (!r) return;
  // Scores already applied live via judgeFinalPlayer. Just move to results.
  try {
    await update(ref(db, `rooms/${state.code}`), { status: 'results' });
  } catch (e) {
    console.error('[finalizeFinal] failed:', e);
    alert('Помилка завершення: ' + (e.message || e));
  }
}

// ============== MANUAL SCORE EDIT (host only) ==============
async function applyScoreDelta(delta){
  if (!state.isHost || !state.editingScorePlayerId) return;
  const r = state.room;
  if (!r || !r.players || !r.players[state.editingScorePlayerId]) return;
  const pid = state.editingScorePlayerId;
  const cur = r.players[pid].score || 0;
  const next = cur + delta;
  // Optimistic local update + incremental DOM update (no full render → no flicker)
  r.players[pid].score = next;
  updateScoreModalOnly(next);
  // Persist in the background
  update(ref(db, `rooms/${state.code}/players/${pid}`), { score: next }).catch(e => console.error('[score]', e));
}

async function applyScoreExact(){
  if (!state.isHost || !state.editingScorePlayerId) return;
  const raw = (state.scoreEditInputValue || '').trim();
  if (raw === '') return;
  const v = parseInt(raw, 10);
  if (isNaN(v)) return;
  const pid = state.editingScorePlayerId;
  const r = state.room;
  if (r && r.players && r.players[pid]) r.players[pid].score = v;
  state.scoreEditInputValue = '';
  updateScoreModalOnly(v);
  update(ref(db, `rooms/${state.code}/players/${pid}`), { score: v }).catch(e => console.error('[score]', e));
}

// Update only the score number shown in the open edit modal — avoids a full
// re-render (which causes a visible flicker) while the host taps +/- buttons.
function updateScoreModalOnly(next){
  const el = document.getElementById('modal-score-value');
  if (el) {
    el.textContent = (next > 0 ? '+' : '') + next;
    el.classList.toggle('negative', next < 0);
  }
  const inp = document.getElementById('score-edit-input');
  if (inp && document.activeElement !== inp) inp.value = String(next);
}

async function kickPlayer(pid){
  if (!state.isHost || !pid) return;
  if (pid === state.myId) return; // can't kick self
  const r = state.room;
  const p = r?.players?.[pid];
  const pname = p?.name || 'гравця';
  if (!confirm(`Видалити ${pname} з гри?`)) return;
  // Remove player + mark them kicked so their client can react
  await update(ref(db, `rooms/${state.code}`), {
    [`players/${pid}`]: null,
    [`kicked/${pid}`]: true,
  });
  // Close score modal if open on this player
  if (state.editingScorePlayerId === pid) {
    state.editingScorePlayerId = null;
    state.scoreEditInputValue = '';
  }
  render(true);
}

async function leave(){
  if (state.unsubscribeRoom) { state.unsubscribeRoom(); state.unsubscribeRoom = null; }
  // Remove self from room
  if (state.code && state.myId) {
    try {
      const r = await getRoom(state.code);
      if (r && r.players) {
        if (state.isHost) {
          // Host leaving — delete room
          await deleteRoom(state.code);
        } else {
          const players = { ...r.players };
          delete players[state.myId];
          if (Object.keys(players).length === 0) {
            await deleteRoom(state.code);
          } else {
            await update(ref(db, `rooms/${state.code}`), { players });
          }
        }
      }
    } catch (e) { console.error(e); }
  }
  lsDel(LS_CODE);
  state.screen = 'home'; state.code=''; state.room=null; state.isHost=false;
  state.subScreen=null; state.setupSource=null; state.setupAiPreview=null;
  state.setupManualPack=null; state.setupFilePack=null;
  state.setupRoundPacks={}; state.setupRoundsTotal=null; state.editingRound=null;
  state.setupFinalQ={category:'', q:'', a:''};
  state.err=''; state.setupErr='';
  state.lastRenderHash = '';
  render(true);
}

// ============== INIT ==============
async function init(){
  render(true);
  if (!FIREBASE_CONFIGURED) return;
  // Track clock skew between this device and Firebase servers, so timers work
  // even if the player's local clock is wrong (a common cause of "buzzer dead").
  try {
    onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      const off = snap.val();
      if (typeof off === 'number') state.serverTimeOffset = off;
    });
  } catch (_) {}
  // Anonymous auth
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      state.myId = user.uid;
      state.authReady = true;
      // Restore saved avatar/name
      const savedAvatar = lsGet(LS_AVATAR);
      if (savedAvatar && AVATARS.includes(savedAvatar)) {
        state.joinAvatar = savedAvatar;
        state.hostAvatar = savedAvatar;
      }
      // Try reconnect
      const savedCode = lsGet(LS_CODE);
      if (savedCode) {
        const r = await getRoom(savedCode);
        if (r && r.players && r.players[state.myId]) {
          state.code = savedCode;
          state.isHost = (r.hostId === state.myId);
          state.room = r;
          state.screen = (['board','question','results'].includes(r.status)) ? r.status : 'lobby';
          // For round_done/final_* statuses, screen doesn't matter — render() uses room.status
          if (['round_done','final_bid','final_reveal'].includes(r.status)) state.screen = 'lobby';
          attachRoomListener(savedCode);
        } else {
          lsDel(LS_CODE);
        }
      }
      render(true);
    }
  });
  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.error('Auth error', e);
    state.err = 'Не вдалося підключитися до Firebase. Перевір налаштування.';
    render(true);
  }
}

init();

// ============== KEYBOARD: spacebar to buzz ==============
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' && e.key !== ' ') return;
  // Don't hijack space when typing in an input/textarea
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
  const r = state.room;
  if (!r) return;
  if (state.isHost) return;
  if (r.status !== 'question') return;
  if ((r.attemptedBy||[]).includes(state.myId)) return;
  // In anti-spam mode, presses during reading/countdown also count (and get
  // penalised) — that's the whole point. buzz() handles the logic.
  const open = r.questionState === 'buzzing';
  const earlyPhase = r.questionState === 'reading' || r.questionState === 'countdown';
  if (open || (r.antiSpamConfig && earlyPhase)) {
    if (r.buzzedPlayer) return;
    e.preventDefault();
    buzz();
  }
});


// ============== INCREMENTAL UI UPDATES (no full re-render) ==============
function updateFinalSubmitButton(){
  const r = state.room;
  if (!r) return;
  const me = r.players?.[state.myId];
  if (!me) return;
  const btn = document.getElementById('final-submit-btn');
  const err = document.getElementById('final-bid-err');

  if (r.status === 'final_bid') {
    // Phase 1: only the bid matters
    const myScore = Math.max(FINAL_MIN_BID_CAP, me.score || 0);
    const bid = state.finalBidLocal;
    const validBid = Number.isInteger(bid) && bid >= 0 && bid <= myScore;
    if (err) err.style.display = validBid ? 'none' : 'block';
    if (btn) {
      if (!validBid) btn.setAttribute('disabled', '');
      else btn.removeAttribute('disabled');
    }
  } else if (r.status === 'final_answer') {
    // Phase 2: only the answer text matters
    const ans = (state.finalAnswerLocal || '').trim();
    if (btn) {
      if (!ans) btn.setAttribute('disabled', '');
      else btn.removeAttribute('disabled');
    }
  }
}

// ============== TIMER TICK ==============
// Re-render every 250ms while a timer is running so the countdown updates,
// and have the host fire timeouts when deadlines pass.
function updateTimerOnly(){
  const r = state.room;
  if (!r) return;
  const now = serverNow();
  // Countdown phase: update the big number
  if (r.status === 'question' && r.questionState === 'countdown' && r.countdownDeadline) {
    const cdSec = Math.max(0, Math.ceil((r.countdownDeadline - now) / 1000));
    const cdEl = document.getElementById('countdown-num');
    if (cdEl) cdEl.textContent = cdSec;
    return;
  }
  let sec, total;
  if (r.status === 'question' && r.questionState === 'buzzing') {
    total = buzzSec(r);
    const deadline = r.buzzPhaseDeadline || (now + total * 1000);
    sec = Math.max(0, Math.ceil((deadline - now) / 1000));
  } else if (r.status === 'question' && r.questionState === 'answering') {
    total = answerSec(r);
    const deadline = r.answerPhaseDeadline || (now + total * 1000);
    sec = Math.max(0, Math.ceil((deadline - now) / 1000));
  } else if (r.status === 'final_answer' && r.finalPhaseDeadline) {
    sec = Math.max(0, Math.ceil((r.finalPhaseDeadline - now) / 1000));
    total = FINAL_SECONDS;
  } else {
    return;
  }
  const pct = Math.min(100, (sec / total) * 100);
  const secEl = document.getElementById('timer-sec');
  const fillEl = document.getElementById('timer-fill');
  if (secEl) secEl.textContent = sec;
  if (fillEl) fillEl.style.width = pct + '%';
}

setInterval(() => {
  const r = state.room;
  if (!r) return;
  const now = serverNow();
  // Failsafe grace: if the host doesn't advance a phase within 1.5s of the
  // deadline (host backgrounded, lagging, disconnected), any client triggers it.
  const GRACE = 1500;
  // Small buffer so a timeout never fires in the same instant a deadline is set
  // (prevents a race where picking a new question is immediately auto-closed).
  const BUF = 400;
  if (r.status === 'question') {
    if (r.questionState === 'countdown') {
      if (r.countdownDeadline && now >= r.countdownDeadline + BUF) {
        if (state.isHost || now >= r.countdownDeadline + GRACE) openBuzzAfterCountdown();
      } else {
        updateTimerOnly();
      }
    } else if (r.questionState === 'buzzing') {
      if (r.buzzPhaseDeadline && now >= r.buzzPhaseDeadline + BUF) {
        if (state.isHost || now >= r.buzzPhaseDeadline + GRACE) timeoutBuzzPhase();
      } else {
        updateTimerOnly();
      }
    } else if (r.questionState === 'answering') {
      if (r.answerPhaseDeadline && now >= r.answerPhaseDeadline + BUF) {
        if (state.isHost || now >= r.answerPhaseDeadline + GRACE) timeoutAnswerPhase();
      } else {
        updateTimerOnly();
      }
    }
  } else if (r.status === 'final_answer') {
    if (r.finalPhaseDeadline && now >= r.finalPhaseDeadline + BUF) {
      if (state.isHost || now >= r.finalPhaseDeadline + GRACE) timeoutFinalPhase();
    } else {
      updateTimerOnly();
    }
  }
}, 250);
