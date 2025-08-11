// German Trainer Web App
const PAGE_SIZE = 20;
let words = [];
let currentPage = 0;
let attemptsForPage = {};
let userAnswers = [];

function el(id){ return document.getElementById(id) }

async function loadWords(){
  try {
    const resp = await fetch('words.json');
    words = await resp.json();
  } catch(e){
    console.error('Errore caricamento words.json', e);
    words = [];
  }
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
  pageWords.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="german">${p.german}</span><span class="italian">${p.italian}</span>`;
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
    const li = document.createElement('li');
    li.className = 'quiz-item';
    li.innerHTML = `<label>${idx+1}. ${p.italian}</label><input type="text" data-idx="${idx}" />`;
    ol.appendChild(li);
  });
  showElement('memorizeView', false);
  showElement('quizView', true);
  showElement('scoreBox', false);
  renderPageInfo();
  // focus first input
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
    const expected = normalize(pageWords[idx].german);
    if(given === expected) { correct += 1; inp.style.borderColor = '#0a0' } else { inp.style.borderColor = '#a00' }
  });
  const required = Math.ceil(pageWords.length * 0.9);
  const percent = Math.round((correct / pageWords.length) * 100);
  saveAttempt(currentPage);
  const box = el('scoreBox');
  box.innerHTML = `Hai ottenuto <strong>${percent}%</strong> (${correct}/${pageWords.length}). ` +
    (correct >= required ? 'Hai passato la pagina ✅' : `Devi raggiungere almeno ${required} risposte corrette per passare (90%).` );
  showElement('scoreBox', true);
  if(correct >= required){
    // advance
    currentPage = Math.min(totalPages()-1, currentPage + 1);
    saveProgress();
    // show memorize of next or finished
    renderMemorizeView();
    showElement('memorizeView', true);
    showElement('quizView', false);
  } else {
    // stay: go back to memorize to retry
    showElement('memorizeView', true);
    showElement('quizView', false);
  }
  renderAttempts();
}

function saveAttempt(page){
  attemptsForPage[page] = (attemptsForPage[page] || 0) + 1;
  localStorage.setItem('german_trainer_attempts', JSON.stringify(attemptsForPage));
}

function saveProgress(){
  const state = { currentPage, attemptsForPage };
  localStorage.setItem('german_trainer_state', JSON.stringify(state));
}

function loadProgress(){
  try {
    const st = JSON.parse(localStorage.getItem('german_trainer_state') || '{}');
    if(typeof st.currentPage === 'number') currentPage = st.currentPage;
    attemptsForPage = JSON.parse(localStorage.getItem('german_trainer_attempts') || '{}') || {};
  } catch(e){ console.warn('No saved state') }
}

function renderAttempts(){
  el('attempts').textContent = attemptsForPage[currentPage] || 0;
}

function resetProgress(){
  if(confirm('Sei sicuro di voler resettare il progresso?')) {
    localStorage.removeItem('german_trainer_state');
    localStorage.removeItem('german_trainer_attempts');
    currentPage = 0;
    attemptsForPage = {};
    renderMemorizeView();
    showElement('memorizeView', true);
    showElement('quizView', false);
    renderAttempts();
  }
}

function showAddHomeInstructions(){
  alert('Per aggiungere alla schermata Home su iPhone: in Safari, tocca il pulsante Condividi → "Aggiungi a Home" (Add to Home Screen).');
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await loadWords();
  loadProgress();
  renderPageInfo();
  renderMemorizeView();
  renderAttempts();

  el('toQuizBtn').addEventListener('click', startQuiz);
  el('checkBtn').addEventListener('click', checkAnswers);
  el('resetBtn').addEventListener('click', resetProgress);
  el('addHome').addEventListener('click', showAddHomeInstructions);
});
