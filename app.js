// ============================================================
// Quiz Night — Своя Гра
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getDatabase, ref, set, get, onValue, off, update, remove, child, serverTimestamp
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
const MAX_IMG_SIZE = 700;     // max width/height px (compromise: visible but compact)
const MAX_IMG_BYTES = 90_000; // ~90KB target after compression (was 150KB)
const BUZZ_SECONDS = 30;       // total time to buzz in (default)
const ANSWER_SECONDS = 15;     // time to answer once buzzed (default)
const FINAL_SECONDS = 90;      // time for players to submit final round bet+answer

// Read room's configured timers, falling back to defaults
function buzzSec(r){ return (r && r.buzzSecondsConfig) || BUZZ_SECONDS; }
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
  setupBuzzSeconds: 30,    // host-configured: time to buzz in
  setupAnswerSeconds: 15,  // host-configured: time to answer
  setupFinalQ: { category:'', q:'', a:'' },
  finalBidLocal: 0,
  finalAnswerLocal: '',
  // Host can manually edit any player's score
  editingScorePlayerId: null,
  scoreEditInputValue: '',
  // Format help modal
  showFormatHelp: false,
  lastRenderHash: '',
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
        cur.questions.push({ value, q: parts[1].trim(), a: parts.slice(2).join(' | ').trim() });
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
      questions.push({ value: v, q: found.q, a: found.a, image: found.image, answerImage: found.answerImage });
    } else {
      questions.push({ value: v, q: '', a: '', image: null, answerImage: null });
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
      // Continuation: append text + images to the last Q block we have
      const lastIdx = lines.length - 1;
      if (isQStart(lines[lastIdx].text)) {
        lines[lastIdx].text = lines[lastIdx].text + ' ' + text;
        lines[lastIdx].images.push(...b.images);
      } else {
        // No Q to merge into — keep block separate, will be ignored later
        lines.push({ text, images: [...b.images] });
      }
    }
  }

  const totalImagesFound = lines.reduce((a,l)=>a+l.images.length, 0);
  console.log('[parseDocx] raw blocks:', rawBlocks.length, 'after merge:', lines.length, 'images:', totalImagesFound);

  // Build text and parse first (without images)
  const fullText = lines.map(l => l.text).join('\n');
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
    setupBuzzSeconds: state.setupBuzzSeconds,
    setupAnswerSeconds: state.setupAnswerSeconds,
    setupFinalQ: state.setupFinalQ,
    editingScorePlayerId: state.editingScorePlayerId,
    showFormatHelp: state.showFormatHelp,
    room: r ? {
      status: r.status, hostId: r.hostId,
      players: r.players, currentCell: r.currentCell,
      buzzedPlayer: r.buzzedPlayer, attemptedBy: r.attemptedBy,
      questionState: r.questionState, currentPicker: r.currentPicker,
      usedCells: r.usedCells, revealAnswer: r.revealAnswer,
      packLoaded: !!(r.pack && r.pack.categories),
      currentRound: r.currentRound, roundsTotal: r.roundsTotal,
      finalQ: r.finalQ, finalBids: r.finalBids, finalJudgement: r.finalJudgement,
    } : null,
  });
}

function render(force){
  const newHash = computeHash();
  if (!force && newHash === state.lastRenderHash) return;
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

  appEl.innerHTML = html;
  attachListeners();

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
            </div>
          `).join('')}
        </div>
      </div>
      ${state.isHost ? `
        <button class="btn btn-gold btn-lg btn-full" data-action="go-mode-select">${icon('play',18)} Налаштувати гру та почати</button>
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
  return `
    <button class="back-btn" data-action="leave-mode-select">${icon('arrowLeft',16)} Назад в лоббі</button>
    <div class="container slide-up">
      <h2 style="font-family:'Fraunces',serif; font-size:36px; font-weight:700; margin-bottom:8px;">Налаштування гри</h2>
      <p style="color:var(--ink-dim); margin-bottom:32px;">Кожен раунд — нова дошка з новим паком. Кожен наступний раунд дає більше очків.</p>

      <div class="card" style="margin-bottom:16px;">
        <div style="font-size:13px; color:var(--ink-dim); margin-bottom:8px;">⏱ ЧАС НА НАТИСКАННЯ БАЗЕРА</div>
        <div class="timer-chip-row">${renderChips(buzzOpts, state.setupBuzzSeconds, 'set-buzz-sec')}</div>
        <div style="font-size:13px; color:var(--ink-dim); margin-top:16px; margin-bottom:8px;">⏱ ЧАС НА ВІДПОВІДЬ (після натискання)</div>
        <div class="timer-chip-row">${renderChips(answerOpts, state.setupAnswerSeconds, 'set-answer-sec')}</div>
      </div>

      <p style="color:var(--ink-dim); margin-bottom:12px; font-size:13px;">Тепер обери кількість раундів — це почне гру:</p>
      <div style="display:grid; gap:12px;">
        <button class="source-card" data-action="pick-rounds" data-rounds="1">
          <div class="source-icon gold">${icon('package',22)}</div>
          <div>
            <div class="source-title">1 раунд</div>
            <div class="source-sub">30 питань · 200–1000 балів · ~30 хв</div>
          </div>
        </button>
        <button class="source-card" data-action="pick-rounds" data-rounds="2">
          <div class="source-icon red">${icon('package',22)}</div>
          <div>
            <div class="source-title">2 раунди</div>
            <div class="source-sub">60 питань · ×1 потім ×2 (400–2000) · ~1 год</div>
          </div>
        </button>
        <button class="source-card" data-action="pick-rounds" data-rounds="3">
          <div class="source-icon blue">${icon('crown',22)}</div>
          <div>
            <div class="source-title">3 раунди</div>
            <div class="source-sub">90 питань · ×1 / ×2 / ×3 · ~1.5 год</div>
          </div>
        </button>
      </div>
      <div class="info-text" style="margin-top: 24px;">
        💡 Після всіх раундів — <b>фінал</b>: гравці ставлять свої бали на одне питання і пишуть відповідь у чат.
      </div>
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
      ${state.setupLoading ? `<span class="spin">${icon('loader',18)}</span>` : 'Стартанути гру'}
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
          ${state.setupLoading ? `<span class="spin">${icon('loader',18)}</span>` : 'Стартанути'}
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
        <button class="btn btn-gold btn-lg" style="flex:1;" data-action="start-ai">Стартанути</button>
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
      ${state.setupLoading ? `<span class="spin">${icon('loader',18)}</span>` : 'Стартанути гру'}
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
  const canPick = state.isHost || isMyPick;
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
          ${isMyPick ? `<b>Твоя черга обирати!</b>` : `Обирає: <b>${esc(picker.avatar)} ${esc(picker.name)}</b>${state.isHost ? ' (або обери ти, як ведучий)' : ''}`}
        </div>
      ` : ''}
      <div class="board-wrap">
        <div class="board">
          ${cats.map(c => `<div class="board-header"><div class="cat-name">${esc(c.name)}</div></div>`).join('')}
          ${VALUES.map((_v, vi) =>
            cats.map((c, ci) => {
              const used = r.usedCells && r.usedCells[`${ci}-${vi}`];
              const cellValue = c.questions[vi]?.value || VALUES[vi];
              return `<button class="board-cell ${used?'used':''}" ${(used||!canPick)?'disabled':''} data-action="pick-cell" data-ci="${ci}" data-qi="${vi}">${used ? '' : cellValue}</button>`;
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

  return `
    <div class="container-lg slide-up">
      <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
        <div style="font-size:13px; color:var(--ink-dim);">Кімната <b style="color:var(--gold);">${esc(state.code)}</b></div>
        ${state.isHost ? `<button class="btn btn-ghost btn-sm" data-action="close-question">${icon('x',14)} Закрити питання</button>` : ''}
      </div>
      <div class="q-stage">
        <div class="q-header">
          <div class="q-cat">${esc(cat.name)}</div>
          <div class="q-value">${q.value}</div>
        </div>
        <div class="q-text">
          ${q.image ? `<img src="${q.image}" class="q-image" alt="">` : ''}
          ${q.q && q.q.trim() ? `<div class="q-text-inner">${esc(q.q)}</div>` : ''}
        </div>
        ${r.revealAnswer ? `
          <div class="q-answer-reveal">
            <div class="q-answer-reveal-label">ПРАВИЛЬНА ВІДПОВІДЬ</div>
            ${q.answerImage ? `<img src="${q.answerImage}" class="q-image" style="max-height:240px; margin-bottom:8px;" alt="">` : ''}
            ${q.a && q.a.trim() ? `<div class="q-answer-reveal-text">${esc(q.a)}</div>` : ''}
          </div>
        ` : (state.isHost ? `
          <div style="margin-top:24px; padding:12px; background: rgba(74,222,128,0.08); border:1px dashed rgba(74,222,128,0.3); border-radius:12px; text-align:center;">
            <div style="font-size:11px; color:var(--ink-dim); letter-spacing:0.15em; text-transform:uppercase; margin-bottom:4px;">ВІДПОВІДЬ (ТІЛЬКИ ТИ БАЧИШ)</div>
            ${q.answerImage ? `<img src="${q.answerImage}" style="max-height:160px; border-radius:8px; margin-bottom:8px;" alt="">` : ''}
            ${q.a && q.a.trim() ? `<div style="font-family:'Fraunces',serif; font-weight:700; font-size:18px; color:var(--green);">${esc(q.a)}</div>` : ''}
          </div>
        ` : '')}
      </div>

      <div style="margin-top:24px;">
        ${(() => {
          // Compute timer seconds left
          const now = Date.now();
          if (r.questionState === 'buzzing' && r.buzzPhaseDeadline) {
            const sec = Math.max(0, Math.ceil((r.buzzPhaseDeadline - now) / 1000));
            const pct = Math.min(100, (sec / buzzSec(r)) * 100);
            return `<div class="timer-bar" id="timer-bar">
              <div class="timer-bar-label">⏱ Натиснути баззер: <b id="timer-sec">${sec}</b> сек</div>
              <div class="timer-bar-track"><div class="timer-bar-fill" id="timer-fill" style="width:${pct}%; background:var(--accent);"></div></div>
            </div>`;
          }
          if (r.questionState === 'answering' && r.answerPhaseDeadline) {
            const sec = Math.max(0, Math.ceil((r.answerPhaseDeadline - now) / 1000));
            const pct = Math.min(100, (sec / answerSec(r)) * 100);
            return `<div class="timer-bar" id="timer-bar">
              <div class="timer-bar-label">⏱ Відповідь: <b id="timer-sec">${sec}</b> сек</div>
              <div class="timer-bar-track"><div class="timer-bar-fill" id="timer-fill" style="width:${pct}%; background:var(--gold);"></div></div>
            </div>`;
          }
          return '';
        })()}

        ${buzzed ? `
          <div class="buzzed-banner">
            <div class="buzzed-banner-label">ВІДПОВІДАЄ</div>
            <div class="buzzed-banner-name">${buzzed.avatar} ${esc(buzzed.name)}</div>
            ${iAmBuzzed ? `<div style="font-size:14px; margin-top:8px;">Скажи відповідь — ведучий тебе чує</div>` : ''}
          </div>
          ${state.isHost ? `
            <div class="host-controls">
              <button class="btn btn-green btn-lg" data-action="judge" data-correct="1">${icon('check',18)} Правильно (+${q.value})</button>
              <button class="btn btn-red btn-lg" data-action="judge" data-correct="0">${icon('x',18)} Неправильно (−${q.value})</button>
              <button class="btn btn-ghost btn-sm" data-action="judge" data-correct="skip">Не зараховувати</button>
            </div>
          ` : ''}
        ` : (r.questionState === 'buzzing' && !state.isHost ? `
          <button class="buzz-btn" data-action="buzz" ${!canIBuzz?'disabled':''}>
            ${iAttempted ? 'Ти вже відповідав' : 'НАТИСНИ ЩОБ ВІДПОВІСТИ'}
          </button>
        ` : '')}

        ${state.isHost && r.questionState === 'buzzing' && !buzzed ? `
          <div style="text-align:center; color:var(--ink-dim); font-size:14px; padding:16px;">
            Очікуємо хто першим натисне...
          </div>
        ` : ''}

        ${attempted.length > 0 && !r.revealAnswer ? `
          <div class="attempted-list">
            ${attempted.map(pid => {
              const p = players.find(x => x.id === pid);
              return p ? `<span class="attempted-chip">${p.avatar} ${esc(p.name)}</span>` : '';
            }).join('')}
          </div>
        ` : ''}

        ${r.revealAnswer && state.isHost ? `
          <div style="text-align:center; margin-top:16px;">
            <button class="btn btn-gold btn-lg" data-action="back-to-board">${icon('chevronRight',18)} На дошку</button>
          </div>
        ` : ''}

        ${!r.revealAnswer && state.isHost && !buzzed && (allAttempted || attempted.length > 0) ? `
          <div style="text-align:center; margin-top:12px;">
            <button class="btn btn-ghost btn-sm" data-action="reveal-answer">${icon('eye',14)} Показати відповідь і закрити</button>
          </div>
        ` : ''}
      </div>

      <div class="player-bar">
        ${nonHostPlayers.map(p => {
          const isBuzzed = buzzed && buzzed.id === p.id;
          const hasAttempted = attempted.includes(p.id);
          const isMe = p.id === state.myId;
          let cls = 'player-chip';
          if (isBuzzed) cls += ' current-picker';
          if (isMe) cls += ' me';
          if (state.isHost) cls += ' editable';
          const clickAttr = state.isHost ? `data-action="edit-score" data-player="${p.id}"` : '';
          return `<div class="${cls}" style="${hasAttempted && !isBuzzed ? 'opacity:0.5;' : ''}" ${clickAttr}>
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
        <div style="font-size:14px; color:var(--ink-dim); margin-bottom:12px;">Поточні бали</div>
        ${sorted.map((p, rank) => `
          <div class="final-row ${rank===0?'first':''}">
            <div class="rank">${rank+1}</div>
            <span style="font-size:24px;">${p.avatar}</span>
            <div class="name">${esc(p.name)}</div>
            <div class="pts ${(p.score||0)<0?'negative':''}">${p.score || 0}</div>
          </div>
        `).join('')}
      </div>
      ${state.isHost ? `
        ${isLastRegularRound ? `
          <button class="btn btn-gold btn-lg btn-full" data-action="go-final-setup">${icon('crown',18)} Перейти до фінального раунду</button>
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
  return `
    <button class="back-btn" data-action="leave-final-setup">${icon('arrowLeft',16)} Назад</button>
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
      <button class="btn btn-gold btn-lg btn-full" data-action="start-final" style="margin-top:24px;">
        ${icon('crown',18)} Запустити фінал
      </button>
      <div class="info-text">Кожен гравець побачить категорію (без питання) і поставить бали (від 0 до своїх балів). Потім побачить питання і напише відповідь.</div>
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
  const myScore = Math.max(0, me?.score || 0);
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
          const sec = Math.max(0, Math.ceil((r.finalPhaseDeadline - Date.now()) / 1000));
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
        const sec = Math.max(0, Math.ceil((r.finalPhaseDeadline - Date.now()) / 1000));
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

  if (state.isHost) {
    const allJudged = nonHost.every(p => judgement[p.id] === 'correct' || judgement[p.id] === 'wrong' || !bids[p.id]);
    return `
      <div class="container slide-up" style="padding-top:24px;">
        <div class="eyebrow">ФІНАЛ · ПЕРЕВІРКА ВІДПОВІДЕЙ</div>
        <h2 style="font-family:'Fraunces',serif; font-size:32px; font-weight:700; margin-top:8px;">${esc(r.finalQ.category)}</h2>
        <div class="card" style="margin-top:16px;">
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ПИТАННЯ</div>
          <div style="font-family:'Fraunces',serif; font-size:20px; font-weight:700; margin-bottom:12px;">${esc(r.finalQ.q)}</div>
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ПРАВИЛЬНА ВІДПОВІДЬ</div>
          <div style="font-family:'Fraunces',serif; font-size:18px; font-weight:700; color:var(--green);">${esc(r.finalQ.a)}</div>
        </div>
        <div style="margin-top:24px;">
          ${nonHost.map(p => {
            const sub = bids[p.id];
            if (!sub || !sub.answerSubmitted) {
              return `<div class="card" style="margin-bottom:12px; opacity:0.5;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:24px;">${p.avatar}</span>
                  <div style="flex:1;"><b>${esc(p.name)}</b></div>
                  <div style="font-size:13px; color:var(--ink-dim);">${sub && sub.bidSubmitted ? `Поставив ${sub.bid}, не встиг відповісти` : 'Не подав ставку'}</div>
                </div>
              </div>`;
            }
            const verdict = judgement[p.id];
            const safeBid = (typeof sub.bid === 'number' && !isNaN(sub.bid)) ? sub.bid : 0;
            return `<div class="card" style="margin-bottom:12px; ${verdict === 'correct' ? 'border-color:rgba(74,222,128,0.4);' : verdict === 'wrong' ? 'border-color:rgba(232,74,48,0.4);' : ''}">
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                <span style="font-size:24px;">${p.avatar}</span>
                <div style="flex:1;"><b>${esc(p.name)}</b></div>
                <div style="font-family:'Fraunces',serif; font-weight:700; color:var(--gold);">Ставка: ${safeBid}</div>
              </div>
              <div style="background:var(--soft); padding:10px 12px; border-radius:8px; font-family:'Fraunces',serif; font-size:18px; font-weight:700; margin-bottom:12px;">
                ${esc(sub.answer)}
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn ${verdict==='correct'?'btn-green':'btn-ghost'} btn-sm" style="flex:1;" data-action="judge-final" data-player="${p.id}" data-verdict="correct">
                  ${icon('check',14)} Правильно (+${safeBid})
                </button>
                <button class="btn ${verdict==='wrong'?'btn-red':'btn-ghost'} btn-sm" style="flex:1;" data-action="judge-final" data-player="${p.id}" data-verdict="wrong">
                  ${icon('x',14)} Неправильно (−${safeBid})
                </button>
              </div>
            </div>`;
          }).join('')}
        </div>
        <button class="btn btn-gold btn-lg btn-full" data-action="finalize-final" ${!allJudged?'disabled':''} style="margin-top:16px;">
          ${icon('trophy',18)} ${allJudged ? 'Зафіксувати результати і перейти до фінальної таблиці' : 'Оціни всіх гравців'}
        </button>
      </div>
    `;
  }

  // Player view (waiting)
  const mySub = bids[state.myId];
  return `
    <div class="container slide-up" style="padding-top:24px;">
      <div class="eyebrow">ФІНАЛ · ПЕРЕВІРКА</div>
      <h2 style="font-family:'Fraunces',serif; font-size:32px; font-weight:700; margin-top:8px;">Ведучий перевіряє відповіді...</h2>
      <div class="card" style="margin-top:24px;">
        <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ПИТАННЯ</div>
        <div style="font-family:'Fraunces',serif; font-size:20px; font-weight:700; margin-bottom:12px;">${esc(r.finalQ.q)}</div>
        <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ПРАВИЛЬНА ВІДПОВІДЬ</div>
        <div style="font-family:'Fraunces',serif; font-size:18px; font-weight:700; color:var(--green);">${esc(r.finalQ.a)}</div>
      </div>
      ${mySub ? `
        <div class="card" style="margin-top:16px;">
          <div style="font-size:13px; color:var(--ink-dim); margin-bottom:4px;">ТВОЯ ВІДПОВІДЬ (СТАВКА: ${mySub.bid})</div>
          <div style="font-family:'Fraunces',serif; font-size:18px; font-weight:700;">${esc(mySub.answer)}</div>
        </div>
      ` : ''}
      <div style="text-align:center; margin-top:24px;">
        <span class="spin" style="color:var(--gold);">${icon('loader',24)}</span>
      </div>
    </div>
  `;
}

// ============== FORMAT HELP MODAL ==============
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
          </div>

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
        <div class="modal-score ${current < 0 ? 'negative' : ''}">${current > 0 ? '+' : ''}${current}</div>

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

        <div class="modal-actions">
          <button class="btn btn-ghost" data-action="close-score-edit">Закрити</button>
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
      state.setupRoundsTotal = null;
      state.setupCurrentRound = 1;
      render(true); break;
    case 'leave-mode-select': state.subScreen = null; render(true); break;
    case 'pick-rounds':
      state.setupRoundsTotal = parseInt(el.dataset.rounds, 10);
      state.setupCurrentRound = 1;
      state.subScreen = 'questionSetup';
      state.setupSource = null;
      render(true); break;
    case 'set-buzz-sec':
      state.setupBuzzSeconds = parseInt(el.dataset.sec, 10);
      render(true); break;
    case 'set-answer-sec':
      state.setupAnswerSeconds = parseInt(el.dataset.sec, 10);
      render(true); break;
    case 'go-question-setup': state.subScreen = 'questionSetup'; state.setupSource = null; state.setupErr=''; render(true); break;
    case 'leave-question-setup': state.subScreen = state.setupCurrentRound === 1 ? 'modeSelect' : null; render(true); break;
    case 'set-source':
      state.setupSource = el.dataset.source || null;
      state.setupErr='';
      if (state.setupSource === 'manual' && !state.setupManualPack) state.setupManualPack = emptyManualPack();
      if (state.setupSource === 'saved') await refreshPacks();
      render(true); break;
    case 'use-saved-pack': await useSavedPack(el.dataset.id); break;
    case 'delete-pack': await handleDeletePack(el.dataset.id); break;
    case 'start-preset': await startGame(SAMPLE_PACK); break;
    case 'open-file-picker': document.getElementById('file-input')?.click(); break;
    case 'reset-file': state.setupFilePack = null; state.setupErr=''; render(true); break;
    case 'start-file': await startGame(state.setupFilePack); break;
    case 'save-file-pack': await saveCurrentPack(state.setupFilePack); break;
    case 'ai-generate': await aiGenerate(); break;
    case 'ai-clear': state.setupAiPreview = null; render(true); break;
    case 'start-ai': await startGame(state.setupAiPreview); break;
    case 'save-ai-pack': await saveCurrentPack(state.setupAiPreview); break;
    case 'start-manual': await startGame(state.setupManualPack); break;
    case 'save-manual-pack': await saveCurrentPack(state.setupManualPack); break;
    case 'add-image': await pickImageFor(el.dataset.key, 'image'); break;
    case 'clear-image': clearImageFor(el.dataset.key, 'image'); break;
    case 'add-answer-image': await pickImageFor(el.dataset.key, 'answerImage'); break;
    case 'clear-answer-image': clearImageFor(el.dataset.key, 'answerImage'); break;
    case 'copy-code': copyCode(); break;
    case 'pick-cell': await pickCell(parseInt(el.dataset.ci,10), parseInt(el.dataset.qi,10)); break;
    case 'open-buzz': await openBuzz(); break;
    case 'buzz': await buzz(); break;
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
    case 'start-final': await startFinalRound(); break;
    case 'submit-final-bid': await submitFinalBid(); break;
    case 'submit-final-answer': await submitFinalAnswer(); break;
    case 'start-final-answer-phase': await startFinalAnswerPhase(); break;
    case 'go-final-reveal': await goFinalReveal(); break;
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
    case 'show-format-help':
      state.showFormatHelp = true;
      render(true); break;
    case 'close-format-help':
      if (el.dataset.action === 'close-format-help') {
        state.showFormatHelp = false;
        render(true);
      }
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
    await update(ref(db, `rooms/${c}`), { players });
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
    render();
  });
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
        q: q.q, a: q.a, image: q.image || null, answerImage: q.answerImage || null,
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
  if (r.usedCells && r.usedCells[`${ci}-${qi}`]) return;
  if (!state.isHost && state.myId !== r.currentPicker) return;
  const now = Date.now();
  await update(ref(db, `rooms/${state.code}`), {
    currentCell: {ci, qi},
    buzzedPlayer: null,
    attemptedBy: [],
    questionState: 'buzzing',
    buzzPhaseDeadline: now + buzzSec(r) * 1000,
    buzzPhaseRemainingMs: null,
    answerPhaseDeadline: null,
    revealAnswer: false,
    status: 'question'
  });
}

async function openBuzz(){
  // Retained for backwards compat (now unused, but harmless)
  if (!state.isHost) return;
  const r = state.room;
  const now = Date.now();
  await update(ref(db, `rooms/${state.code}`), {
    questionState: 'buzzing',
    buzzPhaseDeadline: now + buzzSec(r) * 1000,
  });
}

async function buzz(){
  if (state.isHost) return;
  const r = state.room;
  if (!r) return;
  if (r.buzzedPlayer) return;
  if ((r.attemptedBy||[]).includes(state.myId)) return;
  if (r.questionState !== 'buzzing') return;
  // Anti-race: fetch fresh
  const fresh = await getRoom(state.code);
  if (!fresh || fresh.buzzedPlayer || (fresh.attemptedBy||[]).includes(state.myId)) return;
  if (fresh.questionState !== 'buzzing') return;
  if (fresh.buzzPhaseDeadline && Date.now() > fresh.buzzPhaseDeadline) return;
  const now = Date.now();
  const remaining = fresh.buzzPhaseDeadline ? Math.max(0, fresh.buzzPhaseDeadline - now) : buzzSec(fresh) * 1000;
  await update(ref(db, `rooms/${state.code}`), {
    buzzedPlayer: state.myId,
    questionState: 'answering',
    buzzPhaseRemainingMs: remaining,
    answerPhaseDeadline: now + answerSec(fresh) * 1000,
  });
}

async function judge(correctStr){
  if (!state.isHost) return;
  const r = state.room;
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
      const remaining = r.buzzPhaseRemainingMs || (buzzSec(r) * 1000);
      patch.buzzPhaseDeadline = Date.now() + remaining;
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
      const remaining = r.buzzPhaseRemainingMs || (buzzSec(r) * 1000);
      patch.buzzPhaseDeadline = Date.now() + remaining;
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
  if (!fresh.buzzPhaseDeadline || Date.now() < fresh.buzzPhaseDeadline) return;
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
  await update(ref(db, `rooms/${state.code}`), patch);
}

async function timeoutAnswerPhase(){
  const fresh = await getRoom(state.code);
  if (!fresh) return;
  if (fresh.questionState !== 'answering') return;
  if (!fresh.answerPhaseDeadline || Date.now() < fresh.answerPhaseDeadline) return;
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
      buzzPhaseDeadline: Date.now() + remaining,
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
    finalQ: null, finalBids: null, finalJudgement: null
  });
}

// ============== ROUND / FINAL ACTIONS ==============
async function goNextRound(nextRoundNum){
  if (!state.isHost) return;
  const r = state.room;
  if (!r) return;
  // Set up to pick pack for the next round
  state.setupCurrentRound = nextRoundNum;
  state.setupRoundsTotal = r.roundsTotal || nextRoundNum;
  state.setupSource = null;
  state.setupErr = '';
  state.setupFilePack = null;
  state.setupAiPreview = null;
  state.setupManualPack = null;
  state.subScreen = 'questionSetup';
  render(true);
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
  await update(ref(db, `rooms/${state.code}`), {
    status: 'final_bid',
    currentRound: 'final',
    finalQ: { category: fq.category.trim(), q: fq.q.trim(), a: fq.a.trim() },
    finalBids: {},
    finalJudgement: {},
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
  if (!fresh.finalPhaseDeadline || Date.now() < fresh.finalPhaseDeadline) return;
  await update(ref(db, `rooms/${state.code}`), {
    status: 'final_reveal',
    finalPhaseDeadline: null,
  });
}

async function submitFinalBid(){
  const r = state.room;
  if (!r || state.isHost) return;
  if (r.status !== 'final_bid') return;
  const me = r.players?.[state.myId];
  if (!me) return;
  const maxBid = Math.max(0, me.score || 0);
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
    finalPhaseDeadline: Date.now() + FINAL_SECONDS * 1000,
  });
}

async function goFinalReveal(){
  if (!state.isHost) return;
  await update(ref(db, `rooms/${state.code}`), { status: 'final_reveal' });
}

async function judgeFinalPlayer(playerId, verdict){
  if (!state.isHost) return;
  await update(ref(db, `rooms/${state.code}/finalJudgement`), { [playerId]: verdict });
}

async function finalizeFinal(){
  if (!state.isHost) return;
  const r = state.room;
  if (!r) return;
  const players = { ...r.players };
  const bids = r.finalBids || {};
  const judgement = r.finalJudgement || {};
  // Apply verdicts to scores (if any)
  for (const [pid, sub] of Object.entries(bids)) {
    if (!sub || !sub.answerSubmitted) continue;
    const verdict = judgement[pid];
    // Robustly coerce bid to a number — guard against undefined / NaN / string
    const rawBid = sub.bid;
    const bidNum = (typeof rawBid === 'number' && !isNaN(rawBid)) ? rawBid : parseInt(rawBid, 10);
    const safeBid = (Number.isFinite(bidNum) ? bidNum : 0);
    const curScore = players[pid]?.score || 0;
    if (verdict === 'correct') {
      players[pid] = { ...players[pid], score: curScore + safeBid };
    } else if (verdict === 'wrong') {
      players[pid] = { ...players[pid], score: curScore - safeBid };
    }
  }
  try {
    await update(ref(db, `rooms/${state.code}`), { players, status: 'results' });
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
  await update(ref(db, `rooms/${state.code}/players/${pid}`), { score: next });
  // Update input value too so it stays in sync
  state.scoreEditInputValue = '';
}

async function applyScoreExact(){
  if (!state.isHost || !state.editingScorePlayerId) return;
  const raw = (state.scoreEditInputValue || '').trim();
  if (raw === '') return;
  const v = parseInt(raw, 10);
  if (isNaN(v)) return;
  const pid = state.editingScorePlayerId;
  await update(ref(db, `rooms/${state.code}/players/${pid}`), { score: v });
  state.scoreEditInputValue = '';
  // Keep modal open so host can see the new value
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
  state.err=''; state.setupErr='';
  state.lastRenderHash = '';
  render(true);
}

// ============== INIT ==============
async function init(){
  render(true);
  if (!FIREBASE_CONFIGURED) return;
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

// ============== INCREMENTAL UI UPDATES (no full re-render) ==============
function updateFinalSubmitButton(){
  const r = state.room;
  if (!r) return;
  const me = r.players?.[state.myId];
  if (!me) return;
  const myScore = Math.max(0, me.score || 0);
  const bid = state.finalBidLocal;
  const ans = (state.finalAnswerLocal || '').trim();
  const validBid = Number.isInteger(bid) && bid >= 0 && bid <= myScore;
  const btn = document.getElementById('final-submit-btn');
  const err = document.getElementById('final-bid-err');
  if (err) err.style.display = validBid ? 'none' : 'block';
  if (btn) {
    if (!validBid || !ans) btn.setAttribute('disabled', '');
    else btn.removeAttribute('disabled');
  }
}

// ============== TIMER TICK ==============
// Re-render every 250ms while a timer is running so the countdown updates,
// and have the host fire timeouts when deadlines pass.
function updateTimerOnly(){
  const r = state.room;
  if (!r) return;
  const now = Date.now();
  let sec, total;
  if (r.status === 'question' && r.questionState === 'buzzing' && r.buzzPhaseDeadline) {
    sec = Math.max(0, Math.ceil((r.buzzPhaseDeadline - now) / 1000));
    total = buzzSec(r);
  } else if (r.status === 'question' && r.questionState === 'answering' && r.answerPhaseDeadline) {
    sec = Math.max(0, Math.ceil((r.answerPhaseDeadline - now) / 1000));
    total = answerSec(r);
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
  const now = Date.now();
  if (r.status === 'question') {
    if (r.questionState === 'buzzing' && r.buzzPhaseDeadline) {
      if (now >= r.buzzPhaseDeadline) {
        if (state.isHost) timeoutBuzzPhase();
      } else {
        updateTimerOnly();
      }
    } else if (r.questionState === 'answering' && r.answerPhaseDeadline) {
      if (now >= r.answerPhaseDeadline) {
        if (state.isHost) timeoutAnswerPhase();
      } else {
        updateTimerOnly();
      }
    }
  } else if (r.status === 'final_answer' && r.finalPhaseDeadline) {
    if (now >= r.finalPhaseDeadline) {
      if (state.isHost) timeoutFinalPhase();
    } else {
      updateTimerOnly();
    }
  }
}, 250);
