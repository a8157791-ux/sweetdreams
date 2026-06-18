import './style.css';
import {
  fetchApps, fetchTodayCheckins, fetchTotalPoints, fetchMonthCheckins,
  addApp, updateApp, deleteApp, addPresetApps,
  checkIn, uncheckIn,
  fetchEventsMonth, fetchTodayTodoEvents, addEvent, updateEvent, deleteEvent, setEventDone,
  todayStr, todayDow, showsToday, PRESETS,
} from './data.js';
import { supabase } from './supabaseClient.js';

// ────────────────────────────────────────────
// 상태
// ────────────────────────────────────────────
const now0 = new Date();
const state = {
  apps: [], checked: {}, total: 0, monthMap: {},
  selDow: todayDow(), loading: true,
  user: null,
  tab: 'today',                 // 'today' | 'cal'
  todayEvents: [],              // 오늘 + is_todo 일정 (체크리스트용)
  events: [],                   // calYear/calMonth 의 일정
  calYear: now0.getFullYear(),
  calMonth: now0.getMonth(),
  selDate: todayStr(),
};

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

// 일정 데이터 로딩 실패해도(테이블 아직 없을 때) 앱 전체가 죽지 않게
const safe = (p) => p.catch(() => []);

// ────────────────────────────────────────────
// 아이콘 / 색상
// ────────────────────────────────────────────
const ICON = {
  walk: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3F362A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4c1.4 0 2.4 1.2 2.4 3 0 2.2-1 4-1 6 0 1.4.6 2 .6 3.2 0 1-.7 1.8-1.7 1.8s-1.7-.8-1.7-2c0-2 .4-3.4.4-5.4C7 8 6.4 4 8 4Z" fill="#F6D8AE"/><circle cx="15.5" cy="6.5" r="2.6" fill="#CFE6C6"/></svg>`,
  sun: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3F362A" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="4.2" fill="#F4D98A"/><path d="M12 4.5v2M5.5 7l1.4 1.4M18.5 7l-1.4 1.4M4 14h2M18 14h2"/></svg>`,
  coin: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3F362A" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="12" r="7.5" fill="#F6D8AE"/><path d="M12 8v8M9.5 10.5c0-1.2 1-1.8 2.5-1.8s2.5.6 2.5 1.6-1 1.5-2.5 1.7-2.5.7-2.5 1.7 1 1.6 2.5 1.6 2.5-.6 2.5-1.8" stroke-width="1.6"/></svg>`,
  leaf: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3F362A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 5C9 5 5 10 5 16c0 1.5.4 2.5.4 2.5S11 18 15 13s3-8 3-8Z" fill="#CFE6C6"/><path d="M6 18C9 14 12 11 16 8" stroke-width="1.6"/></svg>`,
  heart: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3F362A" stroke-width="2" stroke-linejoin="round"><path d="M12 19S5 14.5 5 9.7C5 7.4 6.7 6 8.6 6c1.5 0 2.7 1 3.4 2 .7-1 1.9-2 3.4-2C17.3 6 19 7.4 19 9.7 19 14.5 12 19 12 19Z" fill="#F4CFCC"/></svg>`,
  cal: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3F362A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="3" fill="#F4CFCC"/><line x1="4" y1="9.5" x2="20" y2="9.5"/><line x1="8" y1="3" x2="8" y2="6.5"/><line x1="16" y1="3" x2="16" y2="6.5"/></svg>`,
};
function iconKey(c) {
  if (c?.includes('만보')) return 'walk';
  if (c?.includes('기상')) return 'sun';
  if (c?.includes('함께')) return 'heart';
  if (c?.includes('기후')) return 'leaf';
  return 'coin';
}
function chipVar(c) {
  if (c?.includes('만보')) return '--chip-mint';
  if (c?.includes('기상')) return '--chip-peach';
  if (c?.includes('함께')) return '--chip-blush';
  if (c?.includes('기후')) return '--chip-sky';
  if (c?.includes('포인트')) return '--chip-lilac';
  return '--chip-default';
}
const COLORS = ['--chip-mint', '--chip-peach', '--chip-blush', '--chip-sky', '--chip-lilac'];

// ────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const fmt = (n) => n.toLocaleString('ko-KR');
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function weekDates() {
  const n = new Date(); const monday = new Date(n);
  monday.setDate(n.getDate() - todayDow());
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}
function dateLabelToday() {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[todayDow()]}요일`;
}
function fmtTime(t) {
  if (!t) return '';
  const [H, M] = t.split(':').map(Number);
  const ap = H < 12 ? '오전' : '오후';
  const h12 = ((H + 11) % 12) + 1;
  return `${ap} ${h12}시${M ? ` ${M}분` : ''}`;
}
const todayVisible = () => state.apps.filter((a) => showsToday(a, todayDow()));
const selVisible = () => state.apps.filter((a) => showsToday(a, state.selDow));
function userName() {
  const m = state.user?.user_metadata || {};
  return m.name || m.full_name || m.user_name || m.nickname || m.preferred_username || '나';
}

// ────────────────────────────────────────────
// SVG 조각
// ────────────────────────────────────────────
const MOON = `<svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
  <path d="M30 8 C18 8 11 17 11 27 C11 36 19 41 27 39 C20 36 17 30 17 24 C17 17 22 11 30 8 Z" fill="#F4D98A" stroke="#3F362A" stroke-width="2.4" stroke-linejoin="round"/>
  <circle cx="22" cy="24" r="1.4" fill="#3F362A"/><circle cx="27" cy="24" r="1.4" fill="#3F362A"/>
  <path d="M22.5 28 Q24.5 30 26.5 28" stroke="#3F362A" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M38 14 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6 Z" fill="#E8A93C" stroke="#3F362A" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;
const TICK = `<svg class="tick" viewBox="0 0 24 24"><path d="M5 13 l4 4 L19 6"/></svg>`;
const STAR = `<svg class="star" width="16" height="16" viewBox="0 0 16 16"><path d="M8 1l1.8 3.8L14 5.4l-3 3 .8 4.1L8 10.6 4.2 12.5 5 8.4 2 5.4l4.2-.6Z" fill="#E8A93C" stroke="#3F362A" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

// ────────────────────────────────────────────
// 렌더 — 전체
// ────────────────────────────────────────────
function render() {
  const app = $('#app');
  if (state.loading) {
    app.innerHTML = `<div class="wrap"><div class="loading"><div class="spinner"></div><div>불러오는 중…</div></div></div>`;
    return;
  }
  app.innerHTML = `<div class="wrap">${state.tab === 'today' ? todayView() : calView()}</div>`;
  ensureTabbar();
  if (state.tab === 'today') updateTally();
}

// ── 오늘 탭 ──
function todayView() {
  const isToday = state.selDow === todayDow();
  return `
    <header class="top">
      <span class="moon">${MOON}</span>
      <div>
        <div class="wordmark">매일 밤 잠들기 전 나를 생각해</div>
        <div class="greet">${esc(userName())}님,<br><span class="em">잘 걸었어요?</span></div>
        <div class="date">${dateLabelToday()} 밤</div>
      </div>
      <button class="logout" data-action="logout">로그아웃</button>
    </header>

    <div class="week">${weekHTML()}</div>

    <section class="card tally">
      <div class="tally-row">
        <div><div class="label">오늘 적립</div><div class="today" id="todayPts"></div></div>
        <div class="sum"><div class="label">이번 달 누적</div><div><b id="sumPts"></b></div></div>
      </div>
      <div class="bar">
        <div class="track"><div class="fill" id="fill"></div></div>
        <div class="cap"><span class="hand" id="progText"></span><span id="goalText"></span></div>
      </div>
    </section>

    <section class="card month">
      <h3>🌙 이번 달 잠들기 전 기록</h3>
      <div class="sub">매일 밤 체크하면 동그라미가 칠해져요</div>
      <div class="dots" id="dots">${dotsHTML()}</div>
    </section>

    <div class="sec">
      <h2>${isToday ? '오늘의 체크리스트' : `${WEEKDAYS[state.selDow]}요일 미리보기`}</h2>
      <span class="count" id="secCount"></span>
    </div>
    ${!isToday ? `<div class="dow-hint" style="margin:-4px 4px 10px">👀 오늘이 아니라 미리보기예요 — 체크는 오늘만 돼요</div>` : ''}
    <div class="list" id="list">${listHTML()}</div>
    <div class="done-note" id="doneNote">오늘 할 일 끝 — 푹 자요 🌙</div>

    <div class="actions">
      <button class="btn primary" data-action="open-add">＋ 앱 추가하기</button>
      <button class="btn" data-action="open-preset">내 앱 불러오기</button>
    </div>
    <div class="foot">매일 밤 잠들기 전 나를 생각해</div>`;
}

function weekHTML() {
  const dates = weekDates();
  return WEEKDAYS.map((dn, i) => {
    const has = state.apps.some((a) => a.repeat_days && a.repeat_days.includes(i));
    return `<button class="day ${i === state.selDow ? 'sel' : ''}" data-action="selday" data-dow="${i}">
      <span class="dn">${dn}</span><span class="num">${dates[i].getDate()}</span>
      <span class="has ${has ? '' : 'none'}"></span></button>`;
  }).join('');
}

function listHTML() {
  const isToday = state.selDow === todayDow();
  const vis = isToday ? todayVisible() : selVisible();
  const evs = isToday ? state.todayEvents : [];
  if (!vis.length && !evs.length) {
    return `<div class="empty">아직 오늘 할 일이 없어요.<br>앱을 추가하거나 달력에서 일정을 등록해보세요!</div>`;
  }
  let h = evs.map((e) => {
    const time = e.start_time ? `<span class="chip">${fmtTime(e.start_time)}</span>` : '';
    return `<div class="item event ${e.done ? 'done' : ''}" data-action="toggle-event" data-id="${e.id}">
      <span class="ic">${ICON.cal}</span>
      <span class="meta"><span class="name">${esc(e.title)}</span>
        <span class="lower"><span class="chip" style="background:var(${e.color || '--chip-blush'})">📅 오늘 일정</span>${time}</span></span>
      <button class="more" data-action="edit-event" data-id="${e.id}" aria-label="수정">⋯</button>
      <span class="check">${TICK}${STAR}</span></div>`;
  }).join('');
  h += vis.map((a) => {
    const done = a.id in state.checked;
    const repeat = a.repeat_days && a.repeat_days.length;
    const tag = repeat
      ? `<span class="chip repeat">🔁 매주 ${a.repeat_days.map((d) => WEEKDAYS[d]).join('·')}요일</span>`
      : `<span class="chip" style="background:var(${chipVar(a.category)})">${esc(a.category)}</span>`;
    const pts = a.points ? `<span class="pts">+${fmt(a.points)}P</span>` : '';
    return `<div class="item ${done ? 'done' : ''}" data-action="toggle" data-id="${a.id}">
      <span class="ic">${ICON[iconKey(a.category)]}</span>
      <span class="meta"><span class="name">${esc(a.name)}</span><span class="lower">${tag}${pts}</span></span>
      <button class="more" data-action="edit" data-id="${a.id}" aria-label="수정">⋯</button>
      <span class="check">${TICK}${STAR}</span></div>`;
  }).join('');
  return h;
}

function dotsHTML() {
  const n = new Date(); const y = n.getFullYear(), m = n.getMonth();
  const days = new Date(y, m + 1, 0).getDate(); const td = n.getDate();
  let h = '';
  for (let d = 1; d <= days; d++) {
    const key = dateKey(y, m, d);
    let cls = 'dot';
    if (state.monthMap[key]) cls += ' done';
    else if (d === td) cls += ' today';
    else if (d > td) cls += ' future';
    h += `<span class="${cls}">${d}</span>`;
  }
  return h;
}

function updateTally() {
  const isToday = state.selDow === todayDow();
  const visApps = isToday ? todayVisible() : selVisible();
  const appsDone = visApps.filter((a) => a.id in state.checked).length;
  const evs = isToday ? state.todayEvents : [];
  const total = visApps.length + evs.length;
  const done = appsDone + evs.filter((e) => e.done).length;
  const pts = todayVisible().reduce((s, a) => s + (a.id in state.checked ? a.points : 0), 0);

  const set = (id, html) => { const el = $('#' + id); if (el) el.innerHTML = html; };
  set('todayPts', `<small>+</small>${fmt(pts)}<small>P</small>`);
  set('sumPts', `${fmt(state.total)}P`);
  set('secCount', `${done} / ${total}`);
  const fill = $('#fill'); if (fill) fill.style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
  set('progText', `${total}개 중 ${done}개 완료`);
  set('goalText', `목표 ${total}개`);
  const note = $('#doneNote'); if (note) note.classList.toggle('show', total > 0 && done === total && isToday);
}

// ── 달력 탭 ──
function calView() {
  const y = state.calYear, m = state.calMonth;
  return `
    <div class="calhead">
      <button data-action="cal-prev" aria-label="이전 달">‹</button>
      <span class="m">${y}년 ${m + 1}월</span>
      <button data-action="cal-next" aria-label="다음 달">›</button>
    </div>
    <section class="card cal">
      <div class="dow">${WEEKDAYS.map((d, i) => `<span class="${i === 6 ? 'sun' : ''}">${d}</span>`).join('')}</div>
      <div class="grid">${calCellsHTML()}</div>
    </section>
    <section class="card daypanel" id="daypanel">${dayPanelHTML()}</section>
    <button class="addbtn" data-action="add-event">＋ 일정 추가하기</button>
    <div class="foot">날짜를 누르면 그 날 일정이 보여요</div>`;
}

function calCellsHTML() {
  const y = state.calYear, m = state.calMonth;
  const first = (new Date(y, m, 1).getDay() + 6) % 7;   // 0=월
  const days = new Date(y, m + 1, 0).getDate();
  const n = new Date();
  const thisMonth = (n.getFullYear() === y && n.getMonth() === m);
  let h = '';
  for (let i = 0; i < first; i++) h += `<div class="cell muted"></div>`;
  for (let d = 1; d <= days; d++) {
    const ds = dateKey(y, m, d);
    const evs = state.events.filter((e) => e.event_date === ds);
    const dots = evs.slice(0, 3).map((e) => `<span class="evdot" style="background:var(${e.color || '--chip-mint'})"></span>`).join('');
    let cls = 'cell';
    if (thisMonth && d === n.getDate()) cls += ' today';
    if (ds === state.selDate) cls += ' sel';
    h += `<button class="${cls}" data-action="cal-day" data-date="${ds}"><span class="cd">${d}</span><span class="evdots">${dots}</span></button>`;
  }
  return h;
}

function dayPanelHTML() {
  const ds = state.selDate;
  const evs = state.events.filter((e) => e.event_date === ds)
    .sort((a, b) => (a.start_time || '99').localeCompare(b.start_time || '99'));
  const [, mm, dd] = ds.split('-');
  let h = `<h3>${+mm}월 ${+dd}일${ds === todayStr() ? ' · 오늘' : ''}</h3>`;
  if (!evs.length) {
    h += `<div class="empty">이 날 일정이 없어요.<br>아래 ＋ 버튼으로 추가해보세요!</div>`;
  } else {
    h += evs.map((e) => `
      <div class="ev ${e.done ? 'done' : ''}" data-action="toggle-event-cal" data-id="${e.id}">
        <span class="bul">${e.done ? '<svg width="10" height="10" viewBox="0 0 24 24"><path d="M5 13l4 4L19 6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>
        <span class="ebody"><span class="et">${esc(e.title)}</span>
          <span class="es">
            <span>${e.start_time ? fmtTime(e.start_time) : '하루 종일'}</span>
            ${e.is_todo ? `<span class="tag" style="background:var(--chip-peach)">✓ 체크리스트</span>` : ''}
          </span></span>
        <button class="eedit" data-action="edit-event" data-id="${e.id}" aria-label="수정">⋯</button>
      </div>`).join('');
  }
  return h;
}
function rerenderDayPanel() { const p = $('#daypanel'); if (p) p.innerHTML = dayPanelHTML(); }

// ────────────────────────────────────────────
// 바텀 탭바
// ────────────────────────────────────────────
let tabbarEl;
function ensureTabbar() {
  if (!tabbarEl) {
    tabbarEl = document.createElement('nav');
    tabbarEl.className = 'tabbar';
    tabbarEl.innerHTML = `
      <button class="tab" data-tab="today">
        <svg viewBox="0 0 24 24" fill="none" stroke="#9A8C74" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h11M4 12h11M4 17h7"/><path d="M18 6l1.6 1.6L22 5"/></svg>오늘</button>
      <button class="tab" data-tab="cal">
        <svg viewBox="0 0 24 24" fill="none" stroke="#9A8C74" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="3"/><line x1="4" y1="9.5" x2="20" y2="9.5"/><line x1="8" y1="3" x2="8" y2="6.5"/><line x1="16" y1="3" x2="16" y2="6.5"/></svg>달력</button>`;
    document.body.append(tabbarEl);
    tabbarEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      if (state.tab === b.dataset.tab) return;
      state.tab = b.dataset.tab; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  tabbarEl.style.display = 'flex';
  tabbarEl.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
}
function hideTabbar() { if (tabbarEl) tabbarEl.style.display = 'none'; }

// ────────────────────────────────────────────
// 체크 토글 — 앱
// ────────────────────────────────────────────
async function toggle(id, el) {
  if (state.selDow !== todayDow()) { toast('오늘 날짜에만 체크할 수 있어요'); return; }
  const app = state.apps.find((a) => a.id === id); if (!app) return;
  const was = id in state.checked;
  if (was) { delete state.checked[id]; state.total -= app.points; }
  else { state.checked[id] = app.points; state.total += app.points; }
  el.classList.toggle('done', !was); refreshMonthToday(); updateTally();
  try { was ? await uncheckIn(id) : await checkIn(id, app.points); }
  catch (e) {
    if (was) { state.checked[id] = app.points; state.total += app.points; }
    else { delete state.checked[id]; state.total -= app.points; }
    el.classList.toggle('done', was); refreshMonthToday(); updateTally();
    toast('저장에 실패했어요. 잠시 후 다시 시도해줘요');
  }
}
function refreshMonthToday() {
  const key = todayStr();
  if (Object.keys(state.checked).length > 0) state.monthMap[key] = true; else delete state.monthMap[key];
  const dots = $('#dots'); if (dots) dots.innerHTML = dotsHTML();
}

// ────────────────────────────────────────────
// 체크 토글 — 일정
// ────────────────────────────────────────────
function syncEventDone(id, val) {
  const a = state.events.find((e) => e.id === id); if (a) a.done = val;
  const b = state.todayEvents.find((e) => e.id === id); if (b) b.done = val;
}
async function toggleEventChecklist(id, el) {
  const ev = state.todayEvents.find((e) => e.id === id); if (!ev) return;
  const next = !ev.done;
  syncEventDone(id, next); el.classList.toggle('done', next); updateTally();
  try { await setEventDone(id, next); }
  catch (e) { syncEventDone(id, !next); el.classList.toggle('done', !next); updateTally(); toast('저장에 실패했어요'); }
}
async function toggleEventCal(id) {
  const ev = state.events.find((e) => e.id === id); if (!ev) return;
  const next = !ev.done;
  syncEventDone(id, next); rerenderDayPanel();
  try { await setEventDone(id, next); }
  catch (e) { syncEventDone(id, !next); rerenderDayPanel(); toast('저장에 실패했어요'); }
}

// ────────────────────────────────────────────
// 바텀시트
// ────────────────────────────────────────────
let sheetEl, backdropEl;
function ensureSheet() {
  if (sheetEl) return;
  backdropEl = document.createElement('div');
  backdropEl.className = 'sheet-backdrop'; backdropEl.dataset.action = 'close';
  sheetEl = document.createElement('div'); sheetEl.className = 'sheet';
  document.body.append(backdropEl, sheetEl);
}
function openSheet(html) {
  ensureSheet();
  sheetEl.innerHTML = `<div class="sheet-handle"></div>` + html;
  requestAnimationFrame(() => { backdropEl.classList.add('show'); sheetEl.classList.add('show'); });
}
function closeSheet() { if (sheetEl) { backdropEl.classList.remove('show'); sheetEl.classList.remove('show'); } }

// 프리셋 시트
let presetPicks = new Set();
function openPreset() {
  presetPicks = new Set();
  const existing = new Set(state.apps.map((a) => a.name));
  const avail = PRESETS.filter((p) => !existing.has(p.name));
  const body = avail.length
    ? avail.map((p) => `<div class="preset-item" data-action="preset-pick" data-name="${esc(p.name)}">
        <span class="pname">${esc(p.name)}</span>
        <span class="ppts">${p.points ? '+' + fmt(p.points) + 'P' : ''}</span>
        <span class="pcheck">✓</span></div>`).join('')
    : `<div class="empty">프리셋 9종이 이미 다 추가돼 있어요 🎉</div>`;
  openSheet(`
    <div class="sheet-title">내 앱 불러오기</div>
    <div class="sheet-sub">자주 쓰는 앱을 골라서 한 번에 추가해요</div>
    <div class="sheet-body">${body}</div>
    ${avail.length ? `<div class="sheet-actions"><button class="btn ghost" data-action="close">닫기</button><button class="btn primary" data-action="preset-add">추가하기</button></div>` : ''}`);
}

// 앱 추가/수정 폼
let formId = null, formDows = new Set();
function openForm(editApp = null) {
  formId = editApp?.id ?? null;
  formDows = new Set(editApp?.repeat_days || []);
  const cats = ['만보기', '기상·인증', '함께·미션', '기후·미션', '포인트적립', '기타'];
  openSheet(`
    <div class="sheet-title">${editApp ? '항목 수정' : '직접 추가하기'}</div>
    <div class="sheet-body">
      <div class="field"><label>이름</label><input id="f-name" type="text" placeholder="예) 토스 만보기" value="${esc(editApp?.name || '')}"></div>
      <div class="field"><div class="row2">
        <div><label>카테고리</label><select id="f-cat">${cats.map((c) => `<option ${editApp?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div><label>포인트</label><input id="f-pts" type="number" inputmode="numeric" placeholder="0" value="${editApp?.points ?? ''}"></div>
      </div></div>
      <div class="field"><label>링크 (선택)</label><input id="f-url" type="text" placeholder="앱/사이트 주소" value="${esc(editApp?.url || '')}"></div>
      <div class="field"><label>반복 요일 (안 고르면 매일 떠요)</label>
        <div class="dow-pick">${WEEKDAYS.map((d, i) => `<button class="dow-chip ${formDows.has(i) ? 'on' : ''}" data-action="dow-toggle" data-dow="${i}">${d}</button>`).join('')}</div>
        <div class="dow-hint">특정 요일만 고르면 그 요일에만 체크리스트에 떠요</div></div>
    </div>
    <div class="sheet-actions">
      ${editApp ? `<button class="btn danger" data-action="delete">삭제</button>` : `<button class="btn ghost" data-action="close">닫기</button>`}
      <button class="btn primary" data-action="save">저장</button>
    </div>`);
}

// 일정 추가/수정 폼
let evId = null, evColor = '--chip-mint';
function openEventForm(editEv = null) {
  evId = editEv?.id ?? null;
  evColor = editEv?.color || '--chip-mint';
  const date = editEv?.event_date || state.selDate || todayStr();
  const time = editEv?.start_time ? editEv.start_time.slice(0, 5) : '';
  const todo = editEv ? editEv.is_todo : true;
  openSheet(`
    <div class="sheet-title">${editEv ? '일정 수정' : '일정 추가'}</div>
    <div class="sheet-body">
      <div class="field"><label>일정 이름</label><input id="e-title" type="text" placeholder="예) 친구랑 저녁 약속" value="${esc(editEv?.title || '')}"></div>
      <div class="field"><div class="row2">
        <div><label>날짜</label><input id="e-date" type="date" value="${date}"></div>
        <div><label>시간 (선택)</label><input id="e-time" type="time" value="${time}"></div>
      </div></div>
      <div class="field"><label>색</label>
        <div class="color-pick">${COLORS.map((c) => `<button class="color-dot ${c === evColor ? 'on' : ''}" data-action="ev-color" data-c="${c}" style="background:var(${c})" aria-label="색"></button>`).join('')}</div></div>
      <label class="opt-row"><input id="e-todo" type="checkbox" ${todo ? 'checked' : ''}> 오늘 할 일이면 체크리스트에도 띄우기</label>
    </div>
    <div class="sheet-actions">
      ${editEv ? `<button class="btn danger" data-action="del-event">삭제</button>` : `<button class="btn ghost" data-action="close">닫기</button>`}
      <button class="btn primary" data-action="save-event">저장</button>
    </div>`);
}

// ────────────────────────────────────────────
// 액션 — 앱
// ────────────────────────────────────────────
async function presetAdd() {
  if (!presetPicks.size) { closeSheet(); return; }
  const maxSort = state.apps.reduce((m, a) => Math.max(m, a.sort_order || 0), 0);
  const rows = PRESETS.filter((p) => presetPicks.has(p.name)).map((p, i) => ({
    name: p.name, category: p.category, points: p.points, url: p.url, repeat_days: null, sort_order: maxSort + 1 + i,
  }));
  try { await addPresetApps(rows); closeSheet(); await reload(); toast(`${rows.length}개 추가했어요`); }
  catch (e) { toast('추가에 실패했어요'); }
}
async function saveForm() {
  const name = $('#f-name').value.trim();
  if (!name) { toast('이름을 적어줘요'); return; }
  const category = $('#f-cat').value;
  const points = parseInt($('#f-pts').value, 10) || 0;
  const url = $('#f-url').value.trim() || null;
  const repeat_days = formDows.size ? [...formDows].sort((a, b) => a - b) : null;
  try {
    if (formId) { await updateApp(formId, { name, category, points, url, repeat_days }); toast('수정했어요'); }
    else { const ms = state.apps.reduce((m, a) => Math.max(m, a.sort_order || 0), 0); await addApp({ name, category, points, url, repeat_days, sort_order: ms + 1 }); toast('추가했어요'); }
    closeSheet(); await reload();
  } catch (e) { toast('저장에 실패했어요'); }
}
async function removeApp() {
  if (!formId) return;
  if (!confirm('이 항목을 삭제할까요? 체크 기록도 함께 지워져요.')) return;
  try { await deleteApp(formId); delete state.checked[formId]; closeSheet(); await reload(); toast('삭제했어요'); }
  catch (e) { toast('삭제에 실패했어요'); }
}

// ────────────────────────────────────────────
// 액션 — 일정
// ────────────────────────────────────────────
async function saveEvent() {
  const title = $('#e-title').value.trim();
  if (!title) { toast('일정 이름을 적어줘요'); return; }
  const event_date = $('#e-date').value;
  if (!event_date) { toast('날짜를 골라줘요'); return; }
  const t = $('#e-time').value;
  const start_time = t ? `${t}:00` : null;
  const is_todo = $('#e-todo').checked;
  try {
    if (evId) { await updateEvent(evId, { title, event_date, start_time, is_todo, color: evColor }); toast('일정을 수정했어요'); }
    else { await addEvent({ title, event_date, start_time, is_todo, color: evColor }); toast('일정을 추가했어요'); }
    if (event_date.startsWith(`${state.calYear}-${pad(state.calMonth + 1)}`)) state.selDate = event_date;
    closeSheet(); await reloadEvents(); render();
  } catch (e) { toast('저장에 실패했어요. 일정 테이블(SQL) 실행을 확인해줘요'); }
}
async function removeEvent() {
  if (!evId) return;
  if (!confirm('이 일정을 삭제할까요?')) return;
  try { await deleteEvent(evId); closeSheet(); await reloadEvents(); render(); toast('일정을 삭제했어요'); }
  catch (e) { toast('삭제에 실패했어요'); }
}

// ────────────────────────────────────────────
// 토스트
// ────────────────────────────────────────────
let toastEl, toastTimer;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.append(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// ────────────────────────────────────────────
// 이벤트 위임
// ────────────────────────────────────────────
$('#app').addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]'); if (!t) return;
  const { action, id, dow, date } = t.dataset;
  switch (action) {
    case 'toggle': toggle(id, t); break;
    case 'edit': openForm(state.apps.find((a) => a.id === id)); break;
    case 'toggle-event': toggleEventChecklist(id, t); break;
    case 'edit-event': {
      const ev = state.events.find((x) => x.id === id) || state.todayEvents.find((x) => x.id === id);
      if (ev) openEventForm(ev);
      break;
    }
    case 'selday': state.selDow = +dow; render(); break;
    case 'open-preset': openPreset(); break;
    case 'open-add': openForm(null); break;
    case 'cal-prev': shiftMonth(-1); break;
    case 'cal-next': shiftMonth(1); break;
    case 'cal-day': state.selDate = date; render(); break;
    case 'toggle-event-cal': toggleEventCal(id); break;
    case 'add-event': openEventForm(null); break;
    case 'logout': signOut(); break;
    case 'kakao-login': signInKakao(); break;
  }
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]'); if (!t || !sheetEl) return;
  if (!sheetEl.contains(t) && t !== backdropEl) return;
  const { action, name, dow, c } = t.dataset;
  switch (action) {
    case 'close': closeSheet(); break;
    case 'preset-pick': (presetPicks.has(name) ? presetPicks.delete(name) : presetPicks.add(name)); t.classList.toggle('picked'); break;
    case 'preset-add': presetAdd(); break;
    case 'dow-toggle': { const d = +dow; (formDows.has(d) ? formDows.delete(d) : formDows.add(d)); t.classList.toggle('on'); break; }
    case 'save': saveForm(); break;
    case 'delete': removeApp(); break;
    case 'ev-color': evColor = c; sheetEl.querySelectorAll('.color-dot').forEach((b) => b.classList.toggle('on', b.dataset.c === c)); break;
    case 'save-event': saveEvent(); break;
    case 'del-event': removeEvent(); break;
  }
});

// ────────────────────────────────────────────
// 데이터 로드
// ────────────────────────────────────────────
async function shiftMonth(delta) {
  let m = state.calMonth + delta, y = state.calYear;
  if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
  state.calMonth = m; state.calYear = y;
  state.selDate = (new Date().getFullYear() === y && new Date().getMonth() === m) ? todayStr() : dateKey(y, m, 1);
  state.events = await safe(fetchEventsMonth(y, m));
  render();
}
async function reloadEvents() {
  const [me, te] = await Promise.all([
    safe(fetchEventsMonth(state.calYear, state.calMonth)),
    safe(fetchTodayTodoEvents()),
  ]);
  state.events = me; state.todayEvents = te;
}
async function reload() {
  const n = new Date();
  const [apps, checkins, total, monthMap, me, te] = await Promise.all([
    fetchApps(), fetchTodayCheckins(), fetchTotalPoints(),
    fetchMonthCheckins(n.getFullYear(), n.getMonth()),
    safe(fetchEventsMonth(state.calYear, state.calMonth)),
    safe(fetchTodayTodoEvents()),
  ]);
  state.apps = apps; state.checked = {};
  checkins.forEach((c) => { state.checked[c.app_id] = c.points; });
  state.total = total; state.monthMap = monthMap;
  state.events = me; state.todayEvents = te;
  state.loading = false; render();
}
async function renderApp() {
  state.loading = true; render();
  try { await reload(); }
  catch (e) {
    console.error(e);
    $('#app').innerHTML = `<div class="wrap"><div class="empty">데이터를 불러오지 못했어요 😢<br>인터넷 연결이나 Supabase 설정을 확인해줘요.<br><br><small>${esc(e.message || e)}</small></div></div>`;
  }
}

// ── 로그인 ──
function renderLogin() {
  hideTabbar();
  $('#app').innerHTML = `<div class="login-wrap"><div class="login-card">
    <div class="login-moon">${MOON}</div>
    <div class="login-title">매일 밤<br>잠들기 전 나를 생각해</div>
    <div class="login-sub">오늘 하루도 수고한 나를 위해 🌙<br>카카오로 시작해요</div>
    <button class="kakao-btn" data-action="kakao-login">카카오로 로그인</button>
  </div></div>`;
}
async function signInKakao() {
  try { await supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: window.location.origin } }); }
  catch (e) { toast('로그인을 시작하지 못했어요'); }
}
async function signOut() {
  try { await supabase.auth.signOut(); } catch (e) { /* noop */ }
  state.user = null; hideTabbar(); renderLogin();
}

async function boot() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    state.user = session?.user ?? null;
  } catch (e) { state.user = null; }

  if (state.user) await renderApp();
  else renderLogin();

  supabase.auth.onAuthStateChange((event, session) => {
    const u = session?.user ?? null;
    const changed = (u?.id) !== (state.user?.id);
    state.user = u;
    if (!u) renderLogin();
    else if (changed) renderApp();
  });
}
boot();