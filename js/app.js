/* 专升本真题刷题 - 主应用 */
'use strict';

/* ---------- 工具 ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const TYPE_LABEL = {
  single: '单选', analysis: '辨析', short: '简答', essay: '论述',
  phonetics: '语音', cloze: '完形', reading: '阅读', dialogue: '补全对话', composition: '作文'
};
const SUBJECTIVE = new Set(['analysis', 'short', 'essay', 'composition']);
const isObj = q => !SUBJECTIVE.has(q.type);
/* 单选题干若没有空位且不是问句，末尾补填空提示 */
const stemText = q => {
  let s = q.stem || (q.type === 'phonetics' ? '选出划线部分读音与其他三个不同的单词：' : '');
  if (q.type === 'single' && !/____|（\s*）|\(\s*\)|[?？]$/.test(s)) s += '（　　）';
  return s;
};
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

/* ---------- 题库 ---------- */
const BANK = {};   /* pol / eng / extra */
const IDX = {};    /* qid -> {q, year, sub} */

async function loadBank() {
  const get = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
  const [pol, eng, extra] = await Promise.all([
    get('data/politics.json'), get('data/english.json'), get('data/extra.json')
  ]);
  if (pol) BANK.pol = pol;
  if (eng) BANK.eng = eng;
  if (extra) BANK.extra = extra;
  for (const key of ['pol', 'eng']) {
    const b = BANK[key]; if (!b) continue;
    for (const y of b.years) {
      for (const q of b.papers[y].questions) IDX[q.id] = { q, year: +y, sub: key };
    }
  }
  if (BANK.extra) {
    for (const it of BANK.extra.items) IDX[it.id] = { q: it, year: 0, sub: 'extra' };
  }
}

function subjName(sub) {
  if (sub === 'pol') return '政治';
  if (sub === 'eng') return '英语';
  return BANK.extra ? BANK.extra.name : '加练';
}
function subjQs(sub) {
  const b = BANK[sub];
  return b ? b.years.flatMap(y => b.papers[y].questions) : [];
}
function paperObjCount(sub, year) {
  return BANK[sub].papers[String(year)].questions.filter(isObj).length;
}
function paperSubjCount(sub, year) {
  return BANK[sub].papers[String(year)].questions.filter(q => !isObj(q)).length;
}

/* ---------- 学习统计 ---------- */
function subjStat(sub) {
  const qs = subjQs(sub).filter(isObj);
  let done = 0, right = 0;
  for (const q of qs) {
    const r = Store.rec(q.id);
    if (r && (r.c + r.w) > 0) { done++; if (r.r === 1) right++; }
  }
  return { total: qs.length, done, right, rate: pct(right, done) };
}
function subjStatAll(sub) {
  const qs = subjQs(sub).filter(isObj);
  let right = 0, wrong = 0;
  for (const q of qs) {
    const r = Store.rec(q.id);
    if (r) { right += r.c; wrong += r.w; }
  }
  return { total: qs.length, right, wrong, rate: pct(right, right + wrong) };
}
function cardStat() {
  const qs = subjQs('pol').filter(q => !isObj(q));
  let known = 0, seen = 0;
  for (const q of qs) {
    const r = Store.rec(q.id);
    if (r && r.sr != null) { seen++; if (r.sr === 1) known++; }
  }
  return { total: qs.length, seen, known };
}

/* ---------- 顶栏与路由 ---------- */
function setBar(title, opts = {}) {
  $('#topbar').innerHTML = `
    <div class="bar">
      <div class="t-side">${opts.back ? `<button class="back" onclick="history.back()">‹</button>` : ''}</div>
      <div class="t-title">${esc(title)}</div>
      <div class="t-side right">${opts.right || ''}</div>
    </div>
    ${opts.sub ? `<div class="sub">${esc(opts.sub)}</div>` : ''}`;
}

function route() {
  return location.hash.replace(/^#\/?/, '').split('/');
}

async function render() {
  window.scrollTo(0, 0);
  const [p0, p1] = route();
  if (!p0) return viewHome();
  if (p0 === 'papers' && BANK[p1]) return viewPapers(p1);
  if (p0 === 'quiz') return viewQuiz();
  if (p0 === 'random') return viewRandom();
  if (p0 === 'wrong') return viewWrong();
  if (p0 === 'stats') return viewStats();
  if (p0 === 'cards') return viewCards();
  if (p0 === 'extra' && BANK.extra) return viewExtra();
  viewHome();
}

/* ---------- 首页 ---------- */
function viewHome() {
  setBar('专升本真题刷题');
  const pol = BANK.pol, eng = BANK.eng;
  const totQ = (pol ? subjQs('pol').filter(isObj).length : 0) + (eng ? subjQs('eng').filter(isObj).length : 0);
  const st = { done: 0, right: 0 };
  for (const sub of ['pol', 'eng']) {
    if (!BANK[sub]) continue;
    const s = subjStat(sub);
    st.done += s.done; st.right += s.right;
  }
  const cs = cardStat();

  const subjCard = (key, bank, icon, cls) => {
    if (!bank || !bank.years || !bank.years.length) return '';
    const s = subjStat(key);
    const years = bank.years;
    return `
      <div class="card subj-card" onclick="location.hash='#/papers/${key}'">
        <div class="subj-ico ${cls}">${icon}</div>
        <div class="grow">
          <h3>${subjName(key)} <span class="muted small" style="font-weight:400">${years[years.length - 1]}–${years[0]}年真题</span></h3>
          <div class="meta"><span>客观题 ${s.total} 题</span><span>已刷 ${s.done}</span><span>正确率 ${s.rate}%</span></div>
          <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct(s.done, s.total)}%"></div></div>
        </div>
        <span class="muted">›</span>
      </div>`;
  };

  const func = (hash, ico, t, d) => `
    <div class="card func-card" style="margin:0" onclick="location.hash='${hash}'">
      <div class="ico">${ico}</div><div class="t">${t}</div><div class="d">${d}</div>
    </div>`;

  $('#app').innerHTML = `
    <div class="fade">
      <div class="hero">
        <h1>专升本真题刷题</h1>
        <p>历年真题 · 随机组卷 · 掌握度追踪</p>
        <div class="nums">
          <div><b>${totQ}</b><span>真题客观题</span></div>
          <div><b>${st.done}</b><span>已刷题数</span></div>
          <div><b>${pct(st.right, st.done)}%</b><span>总正确率</span></div>
          <div><b>${cs.total ? cs.known + '/' + cs.total : '—'}</b><span>主观题背会</span></div>
        </div>
      </div>
      ${subjCard('pol', pol, '政', 'pol')}
      ${subjCard('eng', eng, '英', 'eng')}
      <div class="grid2" style="margin-bottom:10px">
        ${func('#/random', '🎲', '随机组卷', '考察掌握度')}
        ${func('#/wrong', '📕', '错题本', `${Store.wrongIds().length} 题待攻克`)}
        ${func('#/cards', '🧠', '政治背诵卡', '主观题 自测记忆')}
        ${func('#/stats', '📊', '统计', '正确率与进度')}
      </div>
      ${BANK.extra ? `<div class="grid2">${func('#/extra', '✏️', '政治加练', '选择题 498 自测')}</div>` : ''}
    </div>`;
}

/* ---------- 年份列表 ---------- */
function viewPapers(sub) {
  const b = BANK[sub];
  setBar(subjName(sub) + ' · 历年真题', { back: true });
  const rows = b.years.map(y => {
    const obj = paperObjCount(sub, y), sj = paperSubjCount(sub, y);
    const qs = b.papers[y].questions.filter(isObj);
    let done = 0, right = 0;
    for (const q of qs) {
      const r = Store.rec(q.id);
      if (r && (r.c + r.w) > 0) { done++; if (r.r === 1) right++; }
    }
    return `
      <div class="card paper-row">
        <div class="yr">${y}</div>
        <div class="info">
          <div class="meta"><span>客观题 ${obj}</span>${sj ? `<span>主观题 ${sj}</span>` : ''}<span>已刷 ${done}/${obj}</span><span>${done ? '正确率 ' + pct(right, done) + '%' : '未开始'}</span></div>
          <div class="bar-track"><div class="bar-fill ${sub}" style="width:${pct(done, obj)}%"></div></div>
        </div>
        <div class="acts">
          <button class="btn sm ${sub}" onclick="startPaper('${sub}',${y},'practice')">练习</button>
          <button class="btn sm plain" onclick="startPaper('${sub}',${y},'exam')">考试</button>
        </div>
      </div>`;
  }).join('');
  const extraBtn = sub === 'pol'
    ? `<button class="btn ghost block" onclick="location.hash='#/cards'">🧠 主观题背诵卡（辨析 / 简答 / 论述）</button>` : '';
  $('#app').innerHTML = `<div class="fade">${rows}<div style="height:4px"></div>${extraBtn}</div>`;
}

function startPaper(sub, year, mode) {
  let qids = BANK[sub].papers[String(year)].questions.map(q => q.id);
  if (mode === 'exam') qids = qids.filter(id => isObj(IDX[id].q));
  startSession({
    mode, sub,
    label: year + '年真题',
    qids,
    examMin: mode === 'exam' ? 150 : null
  });
}

function startSession(cfg) {
  sessionStorage.setItem('scft.session', JSON.stringify(Object.assign({
    idx: 0, answers: {}, locked: {}, ratings: {}, revealed: {}, t0: Date.now()
  }, cfg)));
  location.hash = '#/quiz';
}

/* ---------- 刷题引擎 ---------- */
let QUIZ = null;
let timerInt = null;

function viewQuiz() {
  const raw = sessionStorage.getItem('scft.session');
  if (!raw) { location.hash = '#/'; return; }
  QUIZ = JSON.parse(raw);
  QUIZ.answers = QUIZ.answers || {};
  drawQuiz();
}

function quizQuestions() { return QUIZ.qids.map(id => IDX[id].q); }
function curQ() { return IDX[QUIZ.qids[QUIZ.idx]].q; }
function saveQuiz() { sessionStorage.setItem('scft.session', JSON.stringify(QUIZ)); }

function quizTitle() {
  const m = { practice: '练习模式', exam: '考试模式', review: '错题回顾', wrong: '错题重练', random: '随机组卷' };
  return QUIZ.label + ' · ' + (m[QUIZ.mode] || '');
}

function drawQuiz() {
  clearInterval(timerInt);
  setBar(quizTitle(), {
    back: true,
    right: QUIZ.mode === 'exam'
      ? `<button onclick="confirmSubmit()">交卷</button>`
      : `<button onclick="quitQuiz()">退出</button>`
  });

  if (QUIZ.idx >= QUIZ.qids.length) { return drawQuizEnd(); }

  const q = curQ();
  const total = QUIZ.qids.length;
  const isExam = QUIZ.mode === 'exam';
  const prog = pct(QUIZ.idx + (isExam ? 0 : 1), total);

  let timerHtml = '';
  if (isExam) {
    timerHtml = `<span id="qt" class="muted small" style="margin-left:auto"></span>`;
    timerInt = setInterval(tickExam, 1000);
    tickExam();
  }

  const head = `
    <div class="q-head">
      <span class="tag ${QUIZ.sub === 'eng' ? 'eng' : QUIZ.sub === 'pol' ? 'pol' : 'gray'}">${TYPE_LABEL[q.type] || '题目'}</span>
      <span class="muted small">${QUIZ.idx + 1} / ${total}</span>
      <div class="bar-track grow" style="flex:1"><div class="bar-fill" style="width:${prog}%"></div></div>
      ${timerHtml}
    </div>`;

  let body = '';
  if (q.pid) {
    const ptxt = BANK[QUIZ.sub].papers[String(IDX[QUIZ.qids[QUIZ.idx]].year)].passages[q.pid];
    if (ptxt) {
      body += `<details class="passage" ${isGroupStart(q) ? 'open' : ''}>
        <summary>${q.type === 'dialogue' ? '对话原文' : q.type === 'cloze' ? '完形原文' : '阅读原文'}</summary>
        <div class="ptxt">${esc(ptxt)}</div></details>`;
    }
  }
  const stem = stemText(q);
  body += `<div class="q-stem">${esc(stem)}</div>`;

  if (isObj(q)) {
    body += `<div id="opts">` + q.options.map((o, i) => {
      const L = LETTERS[i];
      const sel = (QUIZ.answers[q.id] || '').includes(L);
      return `<div class="opt ${sel ? 'sel' : ''}" data-l="${L}" onclick="pickOpt('${L}')">
        <span class="l">${L}.</span><span>${esc(o)}</span></div>`;
    }).join('') + `</div>`;
    if (!isExam && QUIZ.locked[q.id]) body += feedbackHtml(q);
  } else {
    if (QUIZ.revealed[q.id]) {
      body += `<div class="subjective-answer"><div class="cap">参考答案</div>${esc(q.answer)}${q.exp ? '<hr class="sep">' + esc(q.exp) : ''}</div>
        <div class="qnav" id="rate-btns">
          <button class="btn bad-ghost" onclick="rateSubj(0)">😰 记不牢</button>
          <button class="btn ok" onclick="rateSubj(1)">😄 记住了</button>
        </div>`;
    } else {
      body += `<button class="btn ghost block" style="margin-top:16px" onclick="revealSubj()">查看参考答案</button>`;
    }
  }

  let nav = '';
  if (isExam) {
    nav = `<div class="qnav">
      <button class="btn plain" ${QUIZ.idx === 0 ? 'disabled' : ''} onclick="quizGo(-1)">上一题</button>
      <button class="btn plain" onclick="openSheet()">答题卡</button>
      <button class="btn" ${QUIZ.idx === total - 1 ? 'onclick="confirmSubmit()"' : 'onclick="quizGo(1)"'}>
        ${QUIZ.idx === total - 1 ? '交卷' : '下一题'}</button>
    </div>`;
  } else if (isObj(q) && QUIZ.locked[q.id]) {
    nav = `<div class="qnav"><button class="btn block" onclick="quizGo(1)">
      ${QUIZ.idx === total - 1 ? '完成查看小结' : '下一题 →'}</button></div>`;
  }

  $('#app').innerHTML = `<div class="fade"><div class="card">${head}${body}</div>${nav}</div>`;
}

function isGroupStart(q) {
  const i = QUIZ.idx;
  return i === 0 || IDX[QUIZ.qids[i - 1]].q.pid !== q.pid;
}

function tickExam() {
  const el = $('#qt'); if (!el) return;
  const left = QUIZ.examMin * 60 - (Date.now() - QUIZ.t0) / 1000;
  if (left <= 0) { el.textContent = '时间到'; clearInterval(timerInt); return; }
  el.textContent = '⏱ ' + fmtDur(left);
}

function pickOpt(L) {
  const q = curQ();
  if (QUIZ.mode === 'exam') {
    QUIZ.answers[q.id] = L;
    saveQuiz();
    /* 重绘当前选项状态 */
    document.querySelectorAll('#opts .opt').forEach(el => {
      el.classList.toggle('sel', (QUIZ.answers[q.id] || '').includes(el.dataset.l));
    });
    return;
  }
  if (QUIZ.locked[q.id]) return;
  QUIZ.answers[q.id] = L;
  QUIZ.locked[q.id] = 1;
  const ok = L === q.answer;
  Store.recordObj(q.id, ok);
  saveQuiz();
  paintOptions(q, L);
  $('#app .card').insertAdjacentHTML('beforeend', feedbackHtml(q, ok));
  const nav = `<div class="qnav"><button class="btn block" onclick="quizGo(1)">
    ${QUIZ.idx === QUIZ.qids.length - 1 ? '完成查看小结' : '下一题 →'}</button></div>`;
  $('#app .card').insertAdjacentHTML('afterend', nav);
  const navOld = $('#app > .qnav'); if (navOld) navOld.remove();
}

function paintOptions(q, picked) {
  document.querySelectorAll('#opts .opt').forEach(el => {
    const L = el.dataset.l;
    el.classList.add('locked');
    el.onclick = null;
    if (L === q.answer) el.classList.add('ok');
    else if (L === picked) el.classList.add('bad');
    else el.classList.add('dim');
    el.classList.remove('sel');
  });
}

function feedbackHtml(q, ok) {
  const right = ok !== undefined ? ok : (QUIZ.answers[q.id] === q.answer);
  return `<div class="fb ${right ? 'ok' : 'bad'}">
    <div class="verdict">${right ? '✅ 回答正确' : '❌ 回答错误'}</div>
    <div class="ans-line">正确答案：<b>${esc(q.answer)}</b>　你选的：<b>${esc(QUIZ.answers[q.id] || '—')}</b></div>
    ${q.exp ? `<div class="exp">${esc(q.exp)}</div>` : ''}
  </div>`;
}

function revealSubj() {
  QUIZ.revealed[curQ().id] = 1;
  saveQuiz();
  drawQuiz();
}
function rateSubj(know) {
  const q = curQ();
  QUIZ.ratings[q.id] = know;
  Store.recordSubj(q.id, know);
  saveQuiz();
  quizGo(1);
}

function quizGo(d) {
  QUIZ.idx += d;
  saveQuiz();
  if (QUIZ.idx >= QUIZ.qids.length) drawQuizEnd();
  else drawQuiz();
}

function openSheet() {
  const grid = QUIZ.qids.map((id, i) => {
    const done = QUIZ.answers[id] != null && QUIZ.answers[id] !== '';
    return `<b class="${done ? 'done' : ''} ${i === QUIZ.idx ? 'cur' : ''}" onclick="jumpTo(${i})">${i + 1}</b>`;
  }).join('');
  const doneN = QUIZ.qids.filter(id => QUIZ.answers[id]).length;
  modal(`<h3>答题卡（已答 ${doneN}/${QUIZ.qids.length}）</h3><div class="sheet-grid">${grid}</div>
    <button class="btn block" style="margin-top:16px" onclick="confirmSubmit()">交卷</button>`);
}
function jumpTo(i) { QUIZ.idx = i; saveQuiz(); closeModal(); drawQuiz(); }

function confirmSubmit() {
  const doneN = QUIZ.qids.filter(id => QUIZ.answers[id]).length;
  modal(`<h3>交卷确认</h3><p class="muted">已答 ${doneN} / ${QUIZ.qids.length} 题，未答的题按错误计。确定交卷？</p>
    <div class="grid2"><button class="btn plain" onclick="closeModal()">再检查下</button>
    <button class="btn" onclick="submitExam()">确定交卷</button></div>`);
}

function submitExam() {
  closeModal();
  clearInterval(timerInt);
  let right = 0;
  const wrongIds = [];
  for (const id of QUIZ.qids) {
    const q = IDX[id].q;
    const ok = QUIZ.answers[id] === q.answer;
    Store.recordObj(id, ok);
    if (ok) right++; else wrongIds.push(id);
  }
  QUIZ.result = { right, total: QUIZ.qids.length, wrongIds, dur: (Date.now() - QUIZ.t0) / 1000 };
  QUIZ.idx = QUIZ.qids.length;
  saveQuiz();
  Store.addHist({ ts: Date.now(), mode: '考试', sub: QUIZ.sub, label: QUIZ.label, total: QUIZ.qids.length, right, dur: Math.round(QUIZ.result.dur) });
  drawExamResult();
}

function quitQuiz() {
  if (QUIZ.mode === 'exam') { clearInterval(timerInt); }
  const doneN = Object.keys(QUIZ.answers).length;
  if (doneN > 0 && !confirm('已作答 ' + doneN + ' 题，退出后本组进度将丢弃（练习记录已实时保存）。确定退出？')) return;
  clearInterval(timerInt);
  sessionStorage.removeItem('scft.session');
  QUIZ = null;
  location.hash = '#/';
}

/* ---------- 结算页 ---------- */
function drawQuizEnd() {
  if (QUIZ.mode === 'exam' && QUIZ.result) return drawExamResult();
  if (QUIZ.mode === 'random') return drawRandomReport();
  return drawPracticeSummary();
}

function typeGroups(qids) {
  const g = {};
  for (const id of qids) {
    const q = IDX[id].q;
    const k = TYPE_LABEL[q.type] || '其他';
    (g[k] = g[k] || []).push(id);
  }
  return g;
}

function drawPracticeSummary() {
  setBar('练习小结', { back: true });
  const objIds = QUIZ.qids.filter(id => isObj(IDX[id].q));
  const subjIds = QUIZ.qids.filter(id => !isObj(IDX[id].q));
  let right = 0, answered = 0;
  for (const id of objIds) {
    const r = Store.rec(id);
    if (r && (r.c + r.w) > 0 && QUIZ.answers[id]) { answered++; if (QUIZ.answers[id] === IDX[id].q.answer) right++; }
  }
  const known = subjIds.filter(id => QUIZ.ratings[id] === 1).length;
  $('#app').innerHTML = `<div class="fade card score-hero">
    <div class="big">${right}<small> / ${answered}</small></div>
    <div class="sub2">客观题答对 ${pct(right, answered)}%${subjIds.length ? `　主观题记住 ${known}/${subjIds.length}` : ''}</div>
  </div>
  ${breakdownHtml(objIds)}
  <div class="grid2" style="margin-top:12px">
    <button class="btn ghost block" onclick="location.hash='#/'">返回首页</button>
    <button class="btn block" onclick="reWrong()">再练错题</button>
  </div>`;
}

function breakdownHtml(qids) {
  const g = typeGroups(qids);
  let rows = '';
  for (const t in g) {
    let r = 0;
    for (const id of g[t]) {
      const a = QUIZ.answers[id];
      if (a && a === IDX[id].q.answer) r++;
    }
    const p = pct(r, g[t].length);
    rows += `<div class="rep-row"><span class="nm">${t}</span>
      <div class="bar-track grow"><div class="bar-fill ${p >= 80 ? 'ok' : p >= 60 ? '' : 'pol'}" style="width:${p}%"></div></div>
      <span class="pct">${g[t].length}题 ${p}%</span></div>`;
  }
  return rows ? `<div class="card"><div class="bold" style="margin-bottom:2px">分类正确率</div>${rows}</div>` : '';
}

function drawExamResult() {
  setBar('考试结果', { back: true });
  const R = QUIZ.result;
  $('#app').innerHTML = `<div class="fade">
    <div class="card score-hero">
      <div class="big">${R.right}<small> / ${R.total}</small></div>
      <div class="sub2">正确率 ${pct(R.right, R.total)}%　用时 ${fmtDur(R.dur)}</div>
    </div>
    ${breakdownHtml(QUIZ.qids)}
    ${R.wrongIds.length ? wrongListCard(R.wrongIds) : '<div class="card center muted">🎉 全部答对，没有错题</div>'}
    <div class="grid2" style="margin-top:12px">
      <button class="btn ghost block" onclick="location.hash='#/'">返回首页</button>
      ${R.wrongIds.length ? `<button class="btn block" onclick="reWrong()">错题回顾</button>` : ''}
    </div></div>`;
}

function wrongListCard(ids) {
  const rows = ids.slice(0, 8).map(id => {
    const { q, year } = IDX[id];
    return `<div class="list-item" onclick="event.stopPropagation();modal(qDetailHtml('${id}'))">
      <div class="stem-x">${esc((q.stem || q.options?.join(' / ') || '').slice(0, 60))}</div>
      <div class="muted small" style="margin-top:3px"><span class="tag gray">${TYPE_LABEL[q.type]}</span> ${year ? year + '年' : ''} 正确答案 ${esc(q.answer)}</div>
    </div>`;
  }).join('');
  return `<div class="card"><div class="bold" style="margin-bottom:4px">本次错题 ${ids.length} 题（点击查看解析）</div>${rows}
    ${ids.length > 8 ? `<div class="muted small center" style="margin-top:8px">……其余见错题本</div>` : ''}</div>`;
}

function reWrong() {
  const ids = (QUIZ.mode === 'exam' && QUIZ.result ? QUIZ.result.wrongIds
    : QUIZ.qids.filter(id => isObj(IDX[id].q) && QUIZ.answers[id] && QUIZ.answers[id] !== IDX[id].q.answer));
  if (!ids.length) return;
  startSession({ mode: 'review', sub: QUIZ.sub, label: '错题回顾', qids: shuffle(ids) });
}

/* ---------- 随机组卷 ---------- */
const RB = { subs: { pol: true, eng: false }, count: 20, smart: true };

function viewRandom() {
  setBar('随机组卷', { back: true });
  RB.years = RB.years || null; /* null = 全部 */
  $('#app').innerHTML = `<div class="fade" id="rb-root"></div>`;
  drawRandomForm();
}

function rbPool() {
  let pool = [];
  for (const sub of ['pol', 'eng']) {
    if (!RB.subs[sub] || !BANK[sub]) continue;
    const b = BANK[sub];
    for (const y of b.years) {
      if (RB.years && !RB.years[sub].has(y)) continue;
      for (const q of b.papers[y].questions) {
        if (isObj(q) && q.options && q.answer) pool.push(q.id);
      }
    }
  }
  return pool;
}

function drawRandomForm() {
  const yearChips = sub => {
    if (!RB.years) return '';
    const b = BANK[sub]; if (!b) return '';
    return `<div class="chips">${b.years.map(y =>
      `<button class="chip ${RB.years[sub].has(y) ? 'on' : ''}" onclick="rbToggleYear('${sub}','${y}')">${y.slice(2)}</button>`).join('')}
      <button class="chip" onclick="rbAllYears('${sub}')">全选</button></div>`;
  };
  const pol = BANK.pol ? subjStat('pol') : null;
  const eng = BANK.eng ? subjStat('eng') : null;
  const pool = rbPool();
  $('#rb-root').innerHTML = `
    <div class="card">
      <div class="bold" style="margin-bottom:10px">科目</div>
      <div class="grid2">
        ${pol ? `<button class="btn ${RB.subs.pol ? '' : 'plain'} block" onclick="rbToggleSub('pol')">政治</button>` : ''}
        ${eng ? `<button class="btn ${RB.subs.eng ? '' : 'plain'} block" onclick="rbToggleSub('eng')">英语</button>` : ''}
      </div>
      ${RB.subs.pol ? `<div class="muted small" style="margin:12px 0 6px">政治年份${RB.years ? '（点选年份）' : '：全部'}</div>${RB.years ? yearChips('pol') : ''}` : ''}
      ${RB.subs.eng ? `<div class="muted small" style="margin:12px 0 6px">英语年份</div>${RB.years ? yearChips('eng') : ''}` : ''}
      <div class="row" style="margin-top:12px">
        <div class="grow">
          <div class="bold">按年份筛选</div>
          <div class="muted small">开启后可勾选年份范围</div>
        </div>
        <label class="switch"><input type="checkbox" ${RB.years ? 'checked' : ''} onchange="rbToggleYearFilter(this.checked)"><i></i></label>
      </div>
    </div>
    <div class="card">
      <div class="row">
        <div class="grow"><div class="bold">题目数量</div><div class="muted small">题池共 ${pool.length} 题</div></div>
        <div class="stepper">
          <button onclick="rbSetCount(-10)">−</button><b>${RB.count}</b><button onclick="rbSetCount(10)">＋</button>
        </div>
      </div>
      <div class="chips" style="margin-top:12px">${[10, 20, 30, 40, 50].map(n =>
        `<button class="chip ${RB.count === n ? 'on' : ''}" onclick="RB.count=${n};drawRandomForm()">${n} 题</button>`).join('')}</div>
    </div>
    <div class="card">
      <div class="row">
        <div class="grow"><div class="bold">智能抽题</div><div class="muted small">优先抽没做过和做错的题，弱项练得多</div></div>
        <label class="switch"><input type="checkbox" ${RB.smart ? 'checked' : ''} onchange="RB.smart=this.checked;drawRandomForm()"><i></i></label>
      </div>
    </div>
    <button class="btn block" ${pool.length < 5 ? 'disabled' : ''} onclick="rbStart()">🎲 生成 ${Math.min(RB.count, pool.length)} 题试卷</button>
    <div style="height:8px"></div>`;
}
function rbToggleSub(s) { RB.subs[s] = !RB.subs[s]; if (RB.years && BANK[s]) RB.years[s] = new Set(BANK[s].years); drawRandomForm(); }
function rbToggleYearFilter(on) { RB.years = on ? { pol: new Set(BANK.pol ? BANK.pol.years : []), eng: new Set(BANK.eng ? BANK.eng.years : []) } : null; drawRandomForm(); }
function rbToggleYear(sub, y) { RB.years[sub].has(y) ? RB.years[sub].delete(y) : RB.years[sub].add(y); drawRandomForm(); }
function rbAllYears(sub) { RB.years[sub] = new Set(BANK[sub].years); drawRandomForm(); }
function rbSetCount(d) { RB.count = Math.max(5, Math.min(100, RB.count + d)); drawRandomForm(); }

function rbStart() {
  const pool = rbPool();
  let picked;
  if (RB.smart) {
    const weighted = [];
    for (const id of pool) {
      const r = Store.rec(id);
      let w = 2;
      if (!r || (!r.c && !r.w)) w = 6;
      else if (r.r === 0) w = 5;
      else if (r.c >= 2 && r.r === 1) w = 1;
      weighted.push([id, w]);
    }
    picked = [];
    const bag = weighted.slice();
    while (picked.length < Math.min(RB.count, pool.length) && bag.length) {
      const tot = bag.reduce((s, x) => s + x[1], 0);
      let roll = Math.random() * tot, hit = 0;
      for (let i = 0; i < bag.length; i++) {
        roll -= bag[i][1];
        if (roll <= 0) { hit = i; break; }
      }
      picked.push(bag[hit][0]);
      bag.splice(hit, 1);
    }
    picked = shuffle(picked);
  } else {
    picked = shuffle(pool).slice(0, Math.min(RB.count, pool.length));
  }
  startSession({ mode: 'random', sub: null, label: `随机组卷 ${picked.length} 题`, qids: picked });
}

function drawRandomReport() {
  setBar('掌握度报告', { back: true });
  const bySub = {}, wrongIds = [];
  let right = 0;
  for (const id of QUIZ.qids) {
    const info = IDX[id];
    const a = QUIZ.answers[id];
    const ok = a && a === info.q.answer;
    if (ok) right++; else wrongIds.push(id);
    const s = bySub[info.sub] = bySub[info.sub] || { right: 0, total: 0 };
    s.total++; if (ok) s.right++;
  }
  const subRows = Object.entries(bySub).map(([sub, s]) => {
    const p = pct(s.right, s.total);
    return `<div class="rep-row"><span class="nm">${subjName(sub)}</span>
      <div class="bar-track grow"><div class="bar-fill ${p >= 80 ? 'ok' : p >= 60 ? '' : 'pol'}" style="width:${p}%"></div></div>
      <span class="pct">${s.right}/${s.total}</span></div>`;
  }).join('');
  const weak = Object.entries(typeGroups(QUIZ.qids)).map(([t, ids]) => {
    let r = 0;
    for (const id of ids) if (QUIZ.answers[id] === IDX[id].q.answer) r++;
    return { t, p: pct(r, ids.length), n: ids.length };
  }).filter(x => x.p < 70).sort((a, b) => a.p - b.p);

  Store.addHist({ ts: Date.now(), mode: '随机', sub: null, label: QUIZ.label, total: QUIZ.qids.length, right, dur: Math.round((Date.now() - QUIZ.t0) / 1000) });

  $('#app').innerHTML = `<div class="fade">
    <div class="card score-hero">
      <div class="big">${pct(right, QUIZ.qids.length)}<small>%</small></div>
      <div class="sub2">答对 ${right} / ${QUIZ.qids.length} 题</div>
    </div>
    <div class="card"><div class="bold" style="margin-bottom:2px">分科目</div>${subRows}</div>
    ${breakdownHtml(QUIZ.qids)}
    ${weak.length ? `<div class="card"><div class="bold">⚠️ 薄弱题型（正确率 <70%）</div>
      ${weak.map(w => `<div class="rep-row"><span class="nm">${w.t}</span><div class="bar-track grow"><div class="bar-fill pol" style="width:${w.p}%"></div></div><span class="pct">${w.p}%</span></div>`).join('')}
      <div class="muted small" style="margin-top:8px">建议：多用随机组卷抽这些题型，或回真题练习模式过一遍对应年份。</div></div>` : ''}
    ${wrongIds.length ? wrongListCard(wrongIds) : '<div class="card center muted">🎉 本卷全部答对！</div>'}
    <div class="grid2" style="margin-top:12px">
      <button class="btn ghost block" onclick="location.hash='#/'">返回首页</button>
      ${wrongIds.length ? `<button class="btn block" onclick="reWrong()">错题回顾</button>` : ''}
    </div></div>`;
}

/* ---------- 错题本 ---------- */
function viewWrong() {
  setBar('错题本', { back: true });
  const ids = Store.wrongIds();
  if (!ids.length) {
    $('#app').innerHTML = `<div class="fade"><div class="card empty"><span class="ico">🎉</span>错题本是空的<br>去刷题吧，做错的题会自动收进来</div></div>`;
    return;
  }
  const bySub = { pol: [], eng: [] };
  for (const id of ids) if (bySub[IDX[id].sub]) bySub[IDX[id].sub].push(id);
  const sec = sub => bySub[sub].length ? `
    <div class="card">
      <div class="row" style="margin-bottom:6px">
        <div class="grow bold">${subjName(sub)}（${bySub[sub].length} 题）</div>
        <button class="btn sm" onclick="startSession({mode:'wrong',sub:'${sub}',label:'错题重练',qids:shuffle(bySub['${sub}'])})">重练本组</button>
      </div>
      ${bySub[sub].map(id => {
        const { q, year } = IDX[id];
        return `<div class="list-item" onclick="modal(qDetailHtml('${id}'))">
          <div class="stem-x">${esc((q.stem || (q.options || []).join(' / ')).slice(0, 70))}</div>
          <div class="muted small" style="margin-top:3px"><span class="tag ${sub === 'pol' ? 'pol' : 'eng'}">${TYPE_LABEL[q.type]}</span> ${year}年 · 错 ${Store.rec(id).w} 次 · 正确答案 ${esc(q.answer)}</div>
        </div>`;
      }).join('')}
    </div>` : '';
  $('#app').innerHTML = `<div class="fade">${sec('pol')}${sec('eng')}
    <button class="btn ghost block" onclick="startSession({mode:'wrong',sub:null,label:'错题重练',qids:shuffle(Store.wrongIds())})">全部错题混合重练（${ids.length} 题）</button>
    <div style="height:6px"></div></div>`;
}

function qDetailHtml(id) {
  const { q, year } = IDX[id];
  const r = Store.rec(id) || {};
  return `<h3><span class="tag ${IDX[id].sub === 'pol' ? 'pol' : 'eng'}">${TYPE_LABEL[q.type]}</span> ${year ? year + '年真题' : ''} <span class="muted small">做对 ${r.c || 0} / 错 ${r.w || 0}</span></h3>
    ${q.pid ? '' : ''}
    <div class="q-stem" style="font-size:15px">${esc(q.stem || '(见原文)' )}</div>
    ${(q.options || []).map((o, i) => {
      const L = LETTERS[i];
      const cls = L === q.answer ? 'ok' : '';
      return `<div class="opt ${cls} locked"><span class="l">${L}.</span><span>${esc(o)}</span></div>`;
    }).join('')}
    ${q.answer && isObj(q) ? `<div class="fb ok" style="margin-top:12px"><div class="ans-line">正确答案：<b>${esc(q.answer)}</b></div>${q.exp ? `<div class="exp">${esc(q.exp)}</div>` : ''}</div>` : ''}
    ${!isObj(q) ? `<div class="subjective-answer"><div class="cap">参考答案</div>${esc(q.answer)}</div>` : ''}`;
}

/* ---------- 统计 ---------- */
function viewStats() {
  setBar('学习统计', { back: true });
  const sec = sub => {
    if (!BANK[sub]) return '';
    const b = BANK[sub];
    const rows = b.years.map(y => {
      const qs = b.papers[y].questions.filter(isObj);
      let done = 0, right = 0;
      for (const q of qs) {
        const r = Store.rec(q.id);
        if (r && (r.c + r.w) > 0) { done++; if (r.r === 1) right++; }
      }
      const p = pct(right, done);
      return `<div class="rep-row"><span class="nm">${y}</span>
        <div class="bar-track grow"><div class="bar-fill ${sub}" style="width:${pct(done, qs.length)}%"></div></div>
        <span class="pct muted small" style="width:auto">${done}/${qs.length}</span>
        <span class="pct">${done ? p + '%' : '—'}</span></div>`;
    }).join('');
    const s = subjStatAll(sub);
    const cs = cardStat();
    return `<div class="card">
      <div class="row"><div class="bold grow">${subjName(sub)}</div>
      <span class="muted small">累计对 ${s.right} · 错 ${s.wrong} · 正确率 ${s.rate}%</span></div>
      ${sub === 'pol' ? `<div class="muted small" style="margin-top:2px">背诵卡：自评 ${cs.total ? cs.known + '/' + cs.total + ' 背会' : '未开始'}</div>` : ''}
      <hr class="sep">${rows}</div>`;
  };
  const hist = Store.data.hist.slice(0, 12).map(h => `
    <div class="list-item" style="cursor:default">
      <div class="row"><div class="grow">
        <div class="small bold">${esc(h.label)}</div>
        <div class="muted small">${new Date(h.ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${h.mode}</div></div>
      <div class="small bold">${h.right}/${h.total}</div></div>
    </div>`).join('');
  $('#app').innerHTML = `<div class="fade">${sec('pol')}${sec('eng')}
    <div class="card"><div class="bold" style="margin-bottom:4px">最近练习</div>${hist || '<div class="muted small">暂无记录</div>'}</div></div>`;
}

/* ---------- 背诵卡（政治主观题 / 加练） ---------- */
const CD = { year: 'all', type: 'all', order: 'rand' };

function viewCards() {
  setBar('政治背诵卡', { back: true, sub: '辨析 · 简答 · 论述　自评记忆' });
  drawCardSetup();
}
function viewExtra() {
  setBar('政治加练 · 选择498', { back: true, sub: '点开看答案，自评会不会' });
  drawExtra();
}

function cardPool() {
  const qs = subjQs('pol').filter(q => !isObj(q));
  return qs.filter(q => {
    const info = IDX[q.id];
    if (CD.year !== 'all' && String(info.year) !== CD.year) return false;
    if (CD.type !== 'all' && q.type !== CD.type) return false;
    return true;
  }).map(q => q.id);
}

function drawCardSetup() {
  const b = BANK.pol;
  const years = ['all'].concat(b.years);
  const types = ['all', 'analysis', 'short', 'essay'];
  const pool = cardPool();
  $('#app').innerHTML = `<div class="fade">
    <div class="card">
      <div class="muted small" style="margin-bottom:6px">年份</div>
      <div class="chips">${years.map(y => `<button class="chip pol ${CD.year === y ? 'on' : ''}" onclick="CD.year='${y}';drawCardSetup()">${y === 'all' ? '全部' : y}</button>`).join('')}</div>
      <div class="muted small" style="margin:6px 0 6px">题型</div>
      <div class="chips">${types.map(t => `<button class="chip pol ${CD.type === t ? 'on' : ''}" onclick="CD.type='${t}';drawCardSetup()">${t === 'all' ? '全部' : TYPE_LABEL[t]}</button>`).join('')}</div>
      <div class="muted small" style="margin:6px 0 6px">当前范围 ${pool.length} 题</div>
    </div>
    <button class="btn block pol" style="background:var(--pol)" ${pool.length ? '' : 'disabled'} onclick="startCards(cardPool())">开始背诵</button>
    <div style="height:6px"></div></div>`;
}

let CARD = null;
function startCards(ids) {
  CARD = { ids: shuffle(ids), i: 0, flip: false, known: 0, unknown: 0 };
  drawCard();
}
function drawCard() {
  setBar('政治背诵卡', { back: true });
  if (CARD.i >= CARD.ids.length) {
    const total = CARD.ids.length;
    $('#app').innerHTML = `<div class="fade card score-hero">
      <div class="big" style="color:var(--ok)">${CARD.known}<small> / ${total}</small></div>
      <div class="sub2">自评"记住了" ${pct(CARD.known, total)}%，记不牢的下次重点背</div></div>
      <div class="grid2">
        <button class="btn ghost block" onclick="CARD=null;viewCards()">重新筛选</button>
        <button class="btn block" onclick="startCards(CARD.ids.filter(id=>CARD_ratings(id)===0).concat().length?CARD.ids.filter(id=>Store.rec(id)?.sr===0):CARD.ids)">再背没记住的</button>
      </div><div style="height:6px"></div>`;
    return;
  }
  const id = CARD.ids[CARD.i];
  const { q, year } = IDX[id];
  const r = Store.rec(id);
  $('#app').innerHTML = `<div class="fade">
    <div class="bar-track" style="margin-bottom:12px"><div class="bar-fill pol" style="width:${pct(CARD.i, CARD.ids.length)}%"></div></div>
    <div class="flip-card" onclick="CARD.flip=!CARD.flip;drawCard()">
      <div class="cap"><span class="tag pol">${TYPE_LABEL[q.type]}</span><span class="tag gray">${year}年</span>
        ${r && r.sr === 1 ? '<span class="tag ok">已背会</span>' : r && r.sr === 0 ? '<span class="tag bad">记不牢</span>' : ''}</div>
      <div class="front">
        <div class="stem">${esc(q.stem)}</div>
        ${CARD.flip
          ? `<div class="subjective-answer" style="margin-top:14px"><div class="cap">参考答案</div>${esc(q.answer)}${q.exp ? '<hr class="sep">' + esc(q.exp) : ''}</div>`
          : `<div class="hint">👆 点击卡片显示参考答案</div>`}
      </div>
    </div>
    <div class="qnav">
      <button class="btn bad-ghost" onclick="CARD.flip=true;cardRate(0)">😰 记不牢</button>
      <button class="btn ok" onclick="CARD.flip=true;cardRate(1)">😄 记住了</button>
    </div>
    <div class="center muted small" style="margin-top:10px">自评会直接计入，无需先点卡片</div></div>`;
}
function cardRate(know) {
  const id = CARD.ids[CARD.i];
  Store.recordSubj(id, know);
  if (know) CARD.known++; else CARD.unknown++;
  CARD.i++; CARD.flip = false;
  drawCard();
}

/* 加练 498 */
let EX = null;
function drawExtra() {
  const items = BANK.extra.items;
  if (!EX || EX.done) EX = { ids: shuffle(items.map(i => i.id)), i: 0, known: 0 };
  if (EX.i >= EX.ids.length) {
    $('#app').innerHTML = `<div class="fade card score-hero">
      <div class="big" style="color:var(--ok)">${EX.known}<small> / ${EX.ids.length}</small></div>
      <div class="sub2">本轮自评"会"</div></div>
      <button class="btn block" onclick="EX=null;drawExtra()">再来一轮</button><div style="height:6px"></div>`;
    return;
  }
  const id = EX.ids[EX.i];
  const q = IDX[id].q;
  const r = Store.rec(id);
  $('#app').innerHTML = `<div class="fade">
    <div class="bar-track" style="margin-bottom:12px"><div class="bar-fill pol" style="width:${pct(EX.i, EX.ids.length)}%"></div></div>
    <div class="flip-card" onclick="EX.flip=!EX.flip;drawExtra()">
      <div class="cap"><span class="tag pol">第 ${q.n} 题</span>${r && r.sr === 1 ? '<span class="tag ok">会</span>' : r && r.sr === 0 ? '<span class="tag bad">不会</span>' : ''}</div>
      <div class="front">
        <div class="stem">${esc(q.stem)}</div>
        ${EX.flip ? `<div class="subjective-answer" style="margin-top:14px"><div class="cap">答案</div>${esc(q.answer)}</div>` : '<div class="hint">👆 点击显示答案</div>'}
      </div>
    </div>
    <div class="qnav">
      <button class="btn bad-ghost" onclick="EX.flip=true;exRate(0)">不会</button>
      <button class="btn ok" onclick="EX.flip=true;exRate(1)">会</button>
    </div></div>`;
}
function exRate(know) {
  Store.recordSubj(EX.ids[EX.i], know);
  if (know) EX.known++;
  EX.i++; EX.flip = false;
  drawExtra();
}

/* ---------- 弹层 ---------- */
function modal(html) {
  $('#modal-root').innerHTML = `<div class="mask" onclick="if(event.target===this)closeModal()">
    <div class="sheet-body">${html}</div></div>`;
}
function closeModal() { $('#modal-root').innerHTML = ''; }

/* ---------- 启动 ---------- */
window.addEventListener('hashchange', () => { closeModal(); render(); });
(async function boot() {
  Store.load();
  await loadBank();
  if (BANK.pol && BANK.pol.years && !Object.keys(RB).includes('years')) { /* init lazy */ }
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
