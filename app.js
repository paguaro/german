// app.js — multilingua con caricamento JSON, soglia di passaggio e audio (SpeechSynthesis)
const PAGE_SIZE = 20;
let words = [];
let currentPage = 0;
let attemptsForPage = {};
let userAnswers = [];
let questionLang = '';
let answerLang = '';

function el(id){ return document.getElementById(id) }

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
    li.innerHTML = `<span class="q">${p[questionLang]}</span><span class="a">${p[answerLang]}</span>` +
                   `<button type="button" class="speak-btn" onclick="speak('${encodeURIComponent(p[questionLang])}')">🔊</button>`;
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
    const q = p[questionLang];
    const li = document.createElement('li');
    li.className = 'quiz-item';
    li.innerHTML = `<label>${idx+1}. ${q} <button type="button" class="speak-btn" onclick="speak('${encodeURIComponent(q)}')">🔊</button></label>` +
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
  return s ? s.toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
}

function checkAnswers(){
  const pageWords = wordsForPage(currentPage);
  const inputs = document.querySelectorAll('#quizList input');
  let correct = 0;
  inputs.forEach(inp => {
    const idx = parseInt(inp.dataset.idx,10);
    const given = normalize(inp.value);
    const expected = normalize(pageWords[idx][answerLang]);
    if(given === expected) { correct += 1; inp.style.borderColor = '#0a0' } else { inp.style.borderColor = '#a00' }
  });
  const required = Math.ceil(pageWords.length * 0.9);
  const percent = Math.round((correct / pageWords.length) * 100);
  saveAttempt(currentPage);
  const box = el('scoreBox');
  box.innerHTML = `Hai ottenuto <strong>${percent}%</strong> (${correct}/${pageWords.length}). ` +
    (correct >= required ? '<span style="color:green">Hai passato la pagina ✅</span>' : `<span style="color:red">Devi raggiungere almeno ${required} risposte corrette per passare (90%).</span>`);
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

function speak(encodedText){
  const text = decodeURIComponent(encodedText);
  if(!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  // euristica: scegli voce in base alla lingua della domanda
  const langKey = (questionLang || '').toLowerCase();
  if(langKey.includes('ital')) utterance.lang = 'it-IT';
  else if(langKey.includes('campidan') || langKey.includes('sard')) utterance.lang = 'it-IT'; // fallback per sardo
  else if(langKey.includes('german')) utterance.lang = 'de-DE';
  else if(langKey.includes('english') || langKey.includes('ingles')) utterance.lang = 'en-US';
  else utterance.lang = 'it-IT'; // default
  speechSynthesis.speak(utterance);
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