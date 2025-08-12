// app.js — multilingua con caricamento JSON, soglia di passaggio, audio robusto e highlighting errori
const PAGE_SIZE = 20;
let words = [];
let currentPage = 0;
let attemptsForPage = {};
let userAnswers = [];
let questionLang = '';
let answerLang = '';

// voci TTS
let availableVoices = [];

function el(id){ return document.getElementById(id) }

function initVoices(){
  if(!('speechSynthesis' in window)) return;
  availableVoices = window.speechSynthesis.getVoices() || [];
}
if('speechSynthesis' in window){
  initVoices();
  window.speechSynthesis.onvoiceschanged = initVoices;
}

async function loadWordsFromUrl(url){
  try {
    const resp = await fetch(url);
    words = await resp.json();
    populateLanguageSelectors();
  } catch(e){
    console.error('Errore caricamento', e);
    words = [];
  }
}

function loadWordsFromFile(file){
  const reader = new FileReader();
  reader.onload = e => {
    try {
      words = JSON.parse(e.target.result);
      populateLanguageSelectors();
      currentPage = 0;
      renderMemorizeView();
      renderAttempts();
    } catch(err){
      alert('Errore nel parsing del file JSON');
    }
  };
  reader.readAsText(file);
}

function populateLanguageSelectors(){
  if(words.length === 0) return;
  const keys = Object.keys(words[0]).filter(k => k !== 'id');
  const selectQ = el('questionLang');
  const selectA = el('answerLang');
  selectQ.innerHTML = '';
  selectA.innerHTML = '';
  keys.forEach(k => {
    const optQ = document.createElement('option');
    optQ.value = k; optQ.textContent = k;
    selectQ.appendChild(optQ);
    const optA = document.createElement('option');
    optA.value = k; optA.textContent = k;
    selectA.appendChild(optA);
  });
  selectQ.value = questionLang && keys.includes(questionLang) ? questionLang : keys[0];
  selectA.value = answerLang && keys.includes(answerLang) ? answerLang : keys[1] || keys[0];
  questionLang = selectQ.value;
  answerLang = selectA.value;
}

function totalPages(){ return Math.max(1, Math.ceil(words.length / PAGE_SIZE)) }

function wordsForPage(page){
  const start = page * PAGE_SIZE;
  const end = Math.min(words.length, start + PAGE_SIZE);
  return words.slice(start, end);
}

function renderPageInfo(){
  el('currentPage').textContent = (currentPage + 1);
  el('totalPages').textContent = totalPages();
}

function renderMemorizeView(){
  const list = el('wordList');
  list.innerHTML = '';
  const pageWords = wordsForPage(currentPage);
  pageWords.forEach((p, idx) => {
    const li = document.createElement('li');
    const encoded = encodeURIComponent(p[questionLang] ?? '');
    li.innerHTML = `<span class="q">${p[questionLang]}</span><span class="a">${p[answerLang]}</span>` +
                   `<button type="button" class="speak-btn" data-say="${encoded}">🔊</button>`;
    list.appendChild(li);
  });
  renderPageInfo();
  el('toQuizBtn').disabled = pageWords.length === 0;
}

function showElement(id, show){
  if(show) el(id).classList.remove('hidden'); else el(id).classList.add('hidden');
}

function startQuiz(){
  const pageWords = wordsForPage(currentPage);
  userAnswers = Array(pageWords.length).fill('');
  const ol = el('quizList');
  ol.innerHTML = '';
  pageWords.forEach((p, idx) => {
    const q = p[questionLang] ?? '';
    const encoded = encodeURIComponent(q);
    const li = document.createElement('li');
    li.className = 'quiz-item';
    li.innerHTML = `<label>${idx+1}. ${q} <button type="button" class="speak-btn" data-say="${encoded}">🔊</button></label>` +
                   `<input type="text" data-idx="${idx}" />`;
    ol.appendChild(li);
  });
  el('nextPageBtn').disabled = true; // blocca avanzamento finché non superi la soglia
  showElement('memorizeView', false);
  showElement('quizView', true);
  showElement('scoreBox', false);
  renderPageInfo();
  setTimeout(()=> {
    const first = document.querySelector('#quizList input');
    if(first) first.focus();
  }, 50);
}

function normalize(s){
  return s ? s.toString().trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '') : '';
}

function checkAnswers(){
  const pageWords = wordsForPage(currentPage);
  const inputs = document.querySelectorAll('#quizList input');
  // pulizia feedback precedente
  document.querySelectorAll('#quizList .quiz-item').forEach(li=>{
    li.classList.remove('correct','wrong');
    const fb = li.querySelector('.feedback'); if(fb) fb.remove();
  });
  let correct = 0;
  inputs.forEach(inp => {
    const idx = parseInt(inp.dataset.idx,10);
    const given = normalize(inp.value);
    const expectedRaw = pageWords[idx][answerLang] ?? '';
    const expected = normalize(expectedRaw);
    const li = inp.closest('.quiz-item');
    if(given === expected && given.length > 0){
      correct += 1;
      li.classList.add('correct');
    } else {
      li.classList.add('wrong');
      const fb = document.createElement('div');
      fb.className = 'feedback';
      fb.innerHTML = `Corretto: <strong>${expectedRaw}</strong>` + (given.length === 0 ? ' (mancante)' : '');
      li.appendChild(fb);
    }
  });
  const total = pageWords.length;
  const required = Math.ceil(total * 0.9);
  const percent = Math.round((correct / total) * 100);
  saveAttempt(currentPage);
  const box = el('scoreBox');
  box.innerHTML = `Esatte: <strong>${correct}</strong> su <strong>${total}</strong> — ${percent}%.
    ` + (correct >= required ? '<span style="color:green">Hai passato la pagina ✅</span>' :
    `<span style="color:red">Devi raggiungere almeno ${required} risposte corrette (90%).</span>`);
  showElement('scoreBox', true);
  el('nextPageBtn').disabled = !(correct >= required);
  renderAttempts();
}

function goToNextPage(){
  currentPage = Math.min(totalPages()-1, currentPage + 1);
  saveProgress();
  renderMemorizeView();
  showElement('memorizeView', true);
  showElement('quizView', false);
}

function mapLang(key){
  const k = (key || '').toLowerCase();
  if(k.includes('ital')) return 'it-IT';
  if(k.includes('campidan') || k.includes('sard')) return 'it-IT'; // fallback per sardo
  if(k.includes('german') || k.includes('tedesc')) return 'de-DE';
  if(k.includes('portug') || k.includes('portogh')) return 'pt-PT';
  if(k.includes('span') || k.includes('spagn')) return 'es-ES';
  if(k.includes('english') || k.includes('ingles')) return 'en-US';
  return 'it-IT';
}

function pickVoice(langTag){
  if(!availableVoices || !availableVoices.length) return null;
  let v = availableVoices.find(v=> (v.lang||'').toLowerCase() === langTag.toLowerCase());
  if(v) return v;
  v = availableVoices.find(v=> (v.lang||'').toLowerCase().startsWith(langTag.slice(0,2).toLowerCase()));
  return v || null;
}

function speakText(text, langHint){
  if(!('speechSynthesis' in window)) return;
  const lang = mapLang(langHint);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const voice = pickVoice(lang);
  if(voice) u.voice = voice;
  u.rate = 1; u.pitch = 1;
  // su iOS a volte serve cancellare la coda prima
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function handleSpeakButton(e){
  const btn = e.target.closest('.speak-btn');
  if(!btn) return;
  const encoded = btn.getAttribute('data-say') || '';
  const text = decodeURIComponent(encoded);
  speakText(text, questionLang);
}

function saveAttempt(page){
  attemptsForPage[page] = (attemptsForPage[page] || 0) + 1;
  localStorage.setItem('lang_trainer_attempts', JSON.stringify(attemptsForPage));
}

function saveProgress(){
  const state = { currentPage, attemptsForPage, questionLang, answerLang };
  localStorage.setItem('lang_trainer_state', JSON.stringify(state));
}

function loadProgress(){
  try {
    const st = JSON.parse(localStorage.getItem('lang_trainer_state') || '{}');
    if(typeof st.currentPage === 'number') currentPage = st.currentPage;
    attemptsForPage = JSON.parse(localStorage.getItem('lang_trainer_attempts') || '{}') || {};
    if(st.questionLang) questionLang = st.questionLang;
    if(st.answerLang) answerLang = st.answerLang;
  } catch(e){ console.warn('No saved state') }
}

function renderAttempts(){
  el('attempts').textContent = attemptsForPage[currentPage] || 0;
}

function resetProgress(){
  if(confirm('Sei sicuro di voler resettare il progresso?')) {
    localStorage.removeItem('lang_trainer_state');
    localStorage.removeItem('lang_trainer_attempts');
    currentPage = 0;
    attemptsForPage = {};
    renderMemorizeView();
    showElement('memorizeView', true);
    showElement('quizView', false);
    renderAttempts();
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await loadWordsFromUrl('words.json');
  loadProgress();
  populateLanguageSelectors();
  // delega per pulsanti audio (funziona anche su contenuti generati)
  document.body.addEventListener('click', handleSpeakButton);
  el('questionLang').addEventListener('change', ()=>{ questionLang = el('questionLang').value; saveProgress(); renderMemorizeView(); });
  el('answerLang').addEventListener('change', ()=>{ answerLang = el('answerLang').value; saveProgress(); renderMemorizeView(); });
  el('fileInput').addEventListener('change', e => {
    if(e.target.files.length > 0) loadWordsFromFile(e.target.files[0]);
  });
  if(!questionLang) questionLang = 'italian';
  if(!answerLang) answerLang = 'campidanese';
  renderPageInfo();
  renderMemorizeView();
  renderAttempts();
  el('toQuizBtn').addEventListener('click', startQuiz);
  el('checkBtn').addEventListener('click', checkAnswers);
  el('nextPageBtn').addEventListener('click', goToNextPage);
  el('resetBtn').addEventListener('click', resetProgress);
});