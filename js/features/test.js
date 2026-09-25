/* ================= TEST (quiz de 10 preguntas al azar) ================= */
// Las preguntas viven en la tabla "test_questions" de Supabase (no en el diccionario
// I18N: son contenido, no interfaz). Cada vez que se pulsa "Iniciar test" se trae el
// banco completo y se eligen 10 al azar entre todas las disponibles.
let testQuizPool = [];           // todas las preguntas traídas de Supabase
let testQuizSelected = [];       // las 10 elegidas al azar para este intento
let testQuizIndex = 0;
let testQuizScore = 0;
let testQuizAnswered = false;

function shuffleArray(arr){
  const copy = arr.slice();
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function startTestQuiz(){
  const introCard = document.querySelector('#test-quiz-intro .test-quiz-intro-card');
  const startBtn = introCard ? introCard.querySelector('button') : null;
  if(startBtn){ startBtn.disabled = true; }

  const { data, error } = await supabaseClient
    .from('test_questions')
    .select('*');

  if(startBtn){ startBtn.disabled = false; }

  if(error){
    console.error('No se ha podido cargar el banco de preguntas', error);
    alert(t('test.loadError'));
    return;
  }
  if(!data || data.length === 0){
    alert(t('test.noQuestions'));
    return;
  }

  testQuizPool = data;
  testQuizSelected = shuffleArray(testQuizPool).slice(0, Math.min(10, testQuizPool.length));
  testQuizIndex = 0;
  testQuizScore = 0;

  document.getElementById('test-quiz-intro').style.display = 'none';
  document.getElementById('test-quiz-results').style.display = 'none';
  document.getElementById('test-quiz-play').style.display = '';
  document.getElementById('test-back-vestuario').style.display = 'none';
  document.getElementById('test-back-intro').style.display = '';
  renderTestQuizQuestion();
}

// Sale del test en marcha y vuelve a la pantalla de inicio de "Test" (no a Vestuario).
function exitTestQuiz(){
  document.getElementById('test-quiz-play').style.display = 'none';
  document.getElementById('test-quiz-results').style.display = 'none';
  document.getElementById('test-quiz-intro').style.display = '';
  document.getElementById('test-back-intro').style.display = 'none';
  document.getElementById('test-back-vestuario').style.display = '';
}

function renderTestQuizQuestion(){
  testQuizAnswered = false;
  const total = testQuizSelected.length;
  const q = testQuizSelected[testQuizIndex];

  document.getElementById('test-quiz-progress-fill').style.width = `${((testQuizIndex) / total) * 100}%`;
  document.getElementById('test-quiz-progress-label').textContent = `${testQuizIndex + 1} / ${total}`;
  document.getElementById('test-quiz-question').textContent = q.question;

  const letters = ['option_a', 'option_b', 'option_c', 'option_d'];
  const optionsBox = document.getElementById('test-quiz-options');
  optionsBox.innerHTML = letters.map((field, i) => `
      <button type="button" class="test-quiz-option" data-index="${i}" onclick="answerTestQuizQuestion(${i})">${escapeHtml(q[field])}</button>
    `).join('');

  document.getElementById('test-quiz-explanation').style.display = 'none';
  document.getElementById('test-quiz-next-btn').style.display = 'none';
}

function answerTestQuizQuestion(chosenIndex){
  if(testQuizAnswered) return;
  testQuizAnswered = true;

  const q = testQuizSelected[testQuizIndex];
  const isCorrect = chosenIndex === q.correct_index;
  if(isCorrect) testQuizScore++;

  document.querySelectorAll('#test-quiz-options .test-quiz-option').forEach(btn => {
    const idx = Number(btn.dataset.index);
    btn.classList.add('disabled');
    if(idx === q.correct_index) btn.classList.add('correct');
    else if(idx === chosenIndex) btn.classList.add('incorrect');
  });

  const expBox = document.getElementById('test-quiz-explanation');
  if(q.explanation){
    document.getElementById('test-quiz-explanation-text').textContent = q.explanation;
    expBox.style.display = '';
  } else {
    expBox.style.display = 'none';
  }

  const total = testQuizSelected.length;
  document.getElementById('test-quiz-progress-fill').style.width = `${((testQuizIndex + 1) / total) * 100}%`;

  const nextBtn = document.getElementById('test-quiz-next-btn');
  nextBtn.textContent = (testQuizIndex === total - 1) ? t('test.finishBtn') : t('test.nextBtn');
  nextBtn.style.display = '';
}

function nextTestQuizQuestion(){
  const total = testQuizSelected.length;
  if(testQuizIndex < total - 1){
    testQuizIndex++;
    renderTestQuizQuestion();
  } else {
    showTestQuizResults();
  }
}

function showTestQuizResults(){
  const total = testQuizSelected.length;
  document.getElementById('test-quiz-play').style.display = 'none';
  document.getElementById('test-quiz-results').style.display = '';
  document.getElementById('test-back-intro').style.display = 'none';
  document.getElementById('test-back-vestuario').style.display = '';
  document.getElementById('test-quiz-score').textContent = `${testQuizScore}/${total}`;
  document.getElementById('test-quiz-score-text').textContent = t('test.resultDefault');

  // 1 punto por cada respuesta acertada, +3 puntos extra si se acierta el 10/10.
  const earned = testQuizScore + (testQuizScore === total && total === 10 ? 3 : 0);
  saveTestQuizPoints(earned);
}

// Suma "earned" a los puntos acumulados de esta jugadora en la tabla test_scores.
// Se lee el total actual y se guarda el nuevo total (no hay contador atómico en
// Supabase para este caso sencillo, y aquí no hay riesgo real de dos intentos
// simultáneos de la misma persona).
async function saveTestQuizPoints(earned){
  if(!currentAuthUserId || !earned) return;
  try{
    const { data: existing, error: readError } = await supabaseClient
      .from('test_scores')
      .select('points')
      .eq('profile_id', currentAuthUserId)
      .maybeSingle();
    if(readError){
      console.error('No se ha podido leer el ranking del test', readError);
      return;
    }
    const newTotal = (existing && existing.points ? existing.points : 0) + earned;
    const { error: writeError } = await supabaseClient
      .from('test_scores')
      .upsert({ profile_id: currentAuthUserId, points: newTotal, updated_at: new Date().toISOString() });
    if(writeError){
      console.error('No se ha podido guardar el ranking del test', writeError);
    }
  }catch(e){
    console.error('Error al guardar los puntos del test', e);
  }
}

function openTestRankingModal(){
  document.getElementById('test-ranking-modal').classList.add('active');
  loadTestRanking();
}
function closeTestRankingModal(){
  document.getElementById('test-ranking-modal').classList.remove('active');
}

async function loadTestRanking(){
  const list = document.getElementById('test-ranking-list');
  list.innerHTML = `<div class="gym-routine-empty" style="padding:14px 0;">${t('test.rankingLoading')}</div>`;

  const { data, error } = await supabaseClient
    .from('test_scores')
    .select('profile_id, points')
    .order('points', { ascending:false });

  if(error){
    console.error('No se ha podido cargar el ranking del test', error);
    list.innerHTML = `<div class="gym-routine-empty" style="padding:14px 0;">${t('test.rankingError')}</div>`;
    return;
  }
  if(!data || !data.length){
    list.innerHTML = `<div class="gym-routine-empty" style="padding:14px 0;">${t('test.rankingEmpty')}</div>`;
    return;
  }

  const pointsAbbr = t('test.pointsAbbr');
  list.innerHTML = data.map((row, i) => {
    // Tu propia fila vive en el roster bajo la clave especial 'me', no bajo tu UUID real.
    const p = row.profile_id === currentAuthUserId ? rosterById['me'] : rosterById[row.profile_id];
    const name = p ? displayName(p) : row.profile_id;
    return `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--line);">
          <span style="font-family:'Oswald',sans-serif; font-weight:700; width:20px; text-align:center; color:var(--text-muted); flex-shrink:0;">${i + 1}</span>
          <span class="avatar">${avatarHtml(p ? p.avatarUrl : '', initials(name), false, '')}</span>
          <b style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(name)}</b>
          <span style="font-weight:700; color:var(--navy); flex-shrink:0;">${row.points} ${escapeHtml(pointsAbbr)}</span>
        </div>
      `;
  }).join('');
}
