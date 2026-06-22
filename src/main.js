import './style.css';
import {
  fetchApps, fetchTodayCheckins, fetchTotalPoints, fetchMonthCheckins,
  addApp, updateApp, deleteApp, addPresetApps, backfillOwner,
  checkIn, uncheckIn,
  fetchEventsMonth, fetchTodayTodoEvents, addEvent, updateEvent, deleteEvent, setEventDone,
  fetchSharedUsers, shareEvent, unshareEvent,
  fetchFriends, fetchPendingInvites, getOrCreateInvite, acceptInvite, removeFriend, shareFriendEvent,
  todayStr, todayDow, showsToday, PRESETS,
} from './data.js';
import { supabase } from './supabaseClient.js';

const now0 = new Date();
const state = {
  apps: [], checked: {}, total: 0, monthMap: {},
  selDow: todayDow(), loading: true,
  user: null,
  tab: 'today',
  todayEvents: [],
  events: [],
  calYear: now0.getFullYear(),
  calMonth: now0.getMonth(),
  selDate: todayStr(),
  friends: [],
  pendingInvites: [],
};

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const safe = (p) => p.catch(() => []);

/* ── Aurora 라인 아이콘 (Lucide 스타일, stroke 1.75) ── */
const ICON_PATHS = {
  footprints: 'M4 16v-2.4c0-1.5.9-2.6 2-2.6s2 1.1 2 2.6V16c0 1.1-.9 2-2 2s-2-.9-2-2Zm12-4v-2.4c0-1.5.9-2.6 2-2.6s2 1.1 2 2.6V12c0 1.1-.9 2-2 2s-2-.9-2-2ZM4 11c-.3-1.4-.3-2.7 0-4 .3-1.2 1.2-2 2.2-1.8C7.4 5.4 8 6.6 7.8 8M20 7c.3-1.4.3-2.4 0-3.4-.3-1-1.2-1.6-2.2-1.4',
  sunrise: 'M12 3v3m6.4 2.6 1.4-1.4M2.2 8.2 3.6 9.6M4 17h16M2 21h20M7 17a5 5 0 0 1 10 0M8.5 6.5 12 3l3.5 3.5',
  coins: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M18.1 8.6A6 6 0 1 1 10 18.1',
  sprout: 'M7 20h10M12 20V8M12 8a4 4 0 0 0-4-4H5v1a4 4 0 0 0 4 4h3Zm0 2a4 4 0 0 1 4-4h3v1a4 4 0 0 1-4 4h-3Z',
  handshake: 'M11 17 9.4 15.4a2 2 0 0 1 0-2.8l3.8-3.8a2 2 0 0 1 2.8 0L21 14M3 10l3.5-3.5a2 2 0 0 1 2.8 0L12 9M3 10l4 4M21 14l-4 4-2-2M7 14l3 3',
  calendar: 'M8 2v3M16 2v3M3.5 8.5h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5Z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  users: 'M16 19a4 4 0 0 0-8 0M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20.5 18.5a3.5 3.5 0 0 0-3-3.4M17.5 5.6a3 3 0 0 1 0 5.8',
  check: 'M4 12.5 9 17.5 20 6.5',
  plus: 'M12 5v14M5 12h14',
  chevronL: 'M15 5l-7 7 7 7',
  chevronR: 'M9 5l7 7-7 7',
  flame: 'M12 3c2 3 5 4.5 5 8.5a5 5 0 0 1-10 0c0-1.4.5-2.4 1.2-3.2.3 1 .9 1.7 1.8 1.7.8 0 1-.7 1-1.7C11 6 11 4.5 12 3Z',
  link: 'M9 15l6-6M10.5 6.5 12 5a4 4 0 0 1 6 6l-1.5 1.5M13.5 17.5 12 19a4 4 0 0 1-6-6l1.5-1.5',
  x: 'M6 6l12 12M18 6 6 18',
  repeat: 'M4 9V7a2 2 0 0 1 2-2h11l-2.5-2.5M20 15v2a2 2 0 0 1-2 2H7l2.5 2.5',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
};
function icon(name, size = 22, sw = 1.75) {
  const d = ICON_PATHS[name] || '';
  const segs = d.split(' M').map((seg, i) => `<path d="${i ? 'M' + seg : seg}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">${segs}</svg>`;
}

/* ── 달 일러스트 (crescent + glow + stars) ── */
let moonSeq = 0;
function moonSVG(size = 132, glow = true) {
  const id = 'm' + (moonSeq++);
  return `<svg width="${size}" height="${size}" viewBox="0 0 160 160" fill="none" style="display:block;overflow:visible" aria-hidden="true">
    <defs>
      <radialGradient id="${id}g" cx="50%" cy="46%" r="50%">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.42"/>
        <stop offset="55%" stop-color="var(--accent)" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${id}b" x1="20%" y1="8%" x2="78%" y2="96%">
        <stop offset="0%" stop-color="#FBF1D2"/><stop offset="48%" stop-color="#F1E0AE"/><stop offset="100%" stop-color="#E7CFA4"/>
      </linearGradient>
      <mask id="${id}c"><rect width="160" height="160" fill="black"/><circle cx="78" cy="80" r="40" fill="white"/><circle cx="98" cy="68" r="36" fill="black"/></mask>
    </defs>
    ${glow ? `<circle cx="80" cy="78" r="78" fill="url(#${id}g)"/>` : ''}
    <g mask="url(#${id}c)"><circle cx="78" cy="80" r="40" fill="url(#${id}b)"/></g>
    <circle cx="62" cy="74" r="5" fill="#E3C896" opacity="0.55"/>
    <circle cx="58" cy="92" r="3.4" fill="#E3C896" opacity="0.45"/>
    <circle cx="72" cy="98" r="2.6" fill="#E3C896" opacity="0.4"/>
    <g fill="var(--accent)">
      <path d="M124 44 l2 5.4 5.4 2 -5.4 2 -2 5.4 -2 -5.4 -5.4 -2 5.4 -2 Z" opacity="0.9"/>
      <path d="M118 96 l1.3 3.4 3.4 1.3 -3.4 1.3 -1.3 3.4 -1.3 -3.4 -3.4 -1.3 3.4 -1.3 Z" opacity="0.7"/>
      <circle cx="44" cy="52" r="2" opacity="0.65"/><circle cx="132" cy="78" r="1.6" opacity="0.55"/><circle cx="40" cy="108" r="1.5" opacity="0.5"/>
    </g>
  </svg>`;
}

const CAT_ICON = { '만보기': 'footprints', '기상·인증': 'sunrise', '함께·미션': 'handshake', '기후·미션': 'sprout', '포인트적립': 'coins' };
const iconForCat = (c) => CAT_ICON[c] || 'coins';
const COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--good)', '#E6A23C', '#E5739B'];

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
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[todayDow()]}요일 · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtTime(t) {
  if (!t) return '하루 종일';
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
function initial(name) { return (name || '나').trim().charAt(0) || '나'; }
function isEventDone(e) { return !!e.done_by; }

/* ── 시간대별 랜덤 응원 문구 ── */
function greetMsg() {
  const h = new Date().getHours();
  const msgs = h < 6
    ? ['이 시간에도 깨어있군요', '새벽을 지키고 있네요', '곧 날이 밝아올 거예요']
    : h < 11
    ? ['오늘 하루도 힘차게!', '좋은 아침이에요', '오늘도 잘 걸어봐요', '상쾌한 아침이에요']
    : h < 14
    ? ['밥은 먹었어요?', '점심 산책 어때요?', '오늘 절반 왔어요!', '잘 걷고 있어요?']
    : h < 18
    ? ['오후도 파이팅!', '조금만 더 걸어봐요', '오늘 목표 달성 중!', '잘 걸었어요?']
    : h < 21
    ? ['오늘 하루 수고했어요', '저녁 산책 다녀왔어요?', '잘 걸었어요?', '오늘도 고생했어요']
    : ['오늘도 잘 걸었나요?', '오늘 하루 수고했어요', '오늘 하루도 최고였어요', '편히 잠들어요'];
  const t = new Date();
  const seed = t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
  return msgs[seed % msgs.length];
}

/* ───────────────────────── 렌더 ───────────────────────── */
function render() {
  const app = $('#app');
  if (state.loading) {
    app.innerHTML = `<div class="wrap"><div class="loading"><div class="spinner"></div><div>불러오는 중…</div></div></div>`;
    return;
  }
  app.innerHTML = `<div class="wrap">${state.tab === 'today' ? todayView() : state.tab === 'cal' ? calView() : friendsView()}</div>`;
  ensureTabbar();
  if (state.tab === 'today') updateTally();
}

/* ── 오늘 ── */
function todayView() {
  const isToday = state.selDow === todayDow();
  const name = esc(userName());
  return `
    <div class="rd-head">
      <div class="rd-headmoon">${moonSVG(104, false)}</div>
      <div>
        <div class="rd-eyebrow">${icon('moon', 14)} 오늘 밤</div>
        <div class="rd-title">${name}님,<br>${esc(greetMsg())}</div>
        <div class="rd-sub">${dateLabelToday()}</div>
      </div>
      <button class="rd-avatar" data-action="logout" title="로그아웃">${esc(initial(userName()))}</button>
    </div>

    <div class="rd-card rd-hero">
      <div class="rd-ring">
        <svg width="84" height="84" viewBox="0 0 84 84">
          <circle class="track" cx="42" cy="42" r="37" fill="none" stroke-width="7"/>
          <circle class="bar" id="ringBar" cx="42" cy="42" r="37" fill="none" stroke-width="7" stroke-dasharray="232.5" stroke-dashoffset="232.5"/>
        </svg>
        <div class="pct" id="ringPct">0<span>완료</span></div>
      </div>
      <div class="body">
        <div class="label">오늘 적립한 포인트</div>
        <div class="big" id="heroPts"><small>+</small>0<small>P</small></div>
        <div class="meta" id="heroMeta"></div>
      </div>
    </div>

    <div class="rd-card pad" style="margin-top:12px">
      <div class="rd-weekhead">이번 주</div>
      <div class="rd-week" id="week">${weekHTML()}</div>
    </div>

    <div class="rd-section-label">${isToday ? '오늘의 체크리스트' : `${WEEKDAYS[state.selDow]}요일 미리보기`} <span class="count" id="secCount"></span></div>
    ${!isToday ? `<div class="rd-hint">👀 미리보기예요 — 체크는 오늘만 할 수 있어요</div>` : ''}
    <div class="rd-list" id="list">${listHTML()}</div>
    <div class="rd-donenote" id="doneNote">오늘 할 일 끝 — 푹 자요 🌙</div>

    <div class="rd-actions">
      <button class="rd-btn primary" data-action="open-add">${icon('plus', 17)} 앱 추가</button>
      <button class="rd-btn" data-action="add-event">${icon('calendar', 16)} 일정 추가</button>
    </div>

    <div class="rd-section-label">이번 달 기록 <span class="count" id="heatCount"></span></div>
    <div class="rd-card pad">
      <div class="rd-heat" id="heat">${heatHTML()}</div>
      <div class="rd-streak" id="streak">${streakHTML()}</div>
    </div>

    <div class="rd-foot">매일 밤, 잠들기 전 나를 생각해</div>`;
}

function weekHTML() {
  const dates = weekDates();
  return WEEKDAYS.map((dn, i) => {
    const key = dateKey(dates[i].getFullYear(), dates[i].getMonth(), dates[i].getDate());
    const done = !!state.monthMap[key];
    const has = state.apps.some((a) => a.repeat_days && a.repeat_days.includes(i));
    const cls = ['d', i === state.selDow ? 'on' : '', done ? 'done' : '', has ? 'has' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" data-action="selday" data-dow="${i}"><span>${dn}</span><span class="num">${dates[i].getDate()}</span><span class="ring"></span></button>`;
  }).join('');
}

function listHTML() {
  const isToday = state.selDow === todayDow();
  const vis = isToday ? todayVisible() : selVisible();
  const evs = isToday ? state.todayEvents : [];
  if (!vis.length && !evs.length) {
    return `<div class="rd-empty">아직 오늘 할 일이 없어요.<br>앱을 추가하거나 달력에서 일정을 등록해보세요.</div>`;
  }
  let h = evs.map((e) => {
    const done = isEventDone(e);
    const time = e.start_time ? `<span class="rd-chip">${fmtTime(e.start_time)}</span>` : '';
    const shared = e.owner_id && e.owner_id !== state.user?.id ? `<span class="rd-chip accent">함께</span>` : '';
    return `<div class="rd-row event ${done ? 'done' : ''}" data-action="toggle-event" data-id="${e.id}">
      <div class="rd-ic">${icon('calendar', 19)}</div>
      <div class="rd-body"><div class="name">${esc(e.title)}</div>
        <div class="meta"><span class="rd-tag">오늘 일정</span>${time}${shared}</div></div>
      <button class="rd-more" data-action="edit-event" data-id="${e.id}" aria-label="수정">${icon('more', 18)}</button>
      <div class="rd-check">${icon('check', 14, 2.4)}</div></div>`;
  }).join('');
  h += vis.map((a) => {
    const done = a.id in state.checked;
    const repeat = a.repeat_days && a.repeat_days.length;
    const repeatChip = icon('repeat', 11, 2).replace('<svg', '<svg style="vertical-align:-1px;display:inline-block"');
    const tag = repeat
      ? `<span class="rd-chip">${repeatChip} 매주 ${a.repeat_days.map((d) => WEEKDAYS[d]).join('·')}</span>`
      : `<span class="rd-tag">${esc(a.category)}</span>`;
    const pts = a.points ? `<span class="rd-pts">+${fmt(a.points)}P</span>` : '';
    return `<div class="rd-row ${done ? 'done' : ''}" data-action="toggle" data-id="${a.id}">
      <div class="rd-ic">${icon(iconForCat(a.category), 19)}</div>
      <div class="rd-body"><div class="name">${esc(a.name)}</div>
        <div class="meta">${pts}${tag}</div></div>
      <button class="rd-more" data-action="edit" data-id="${a.id}" aria-label="수정">${icon('more', 18)}</button>
      <div class="rd-check">${icon('check', 14, 2.4)}</div></div>`;
  }).join('');
  return h;
}

function heatHTML() {
  const n = new Date(); const y = n.getFullYear(), m = n.getMonth();
  const days = new Date(y, m + 1, 0).getDate(); const td = n.getDate();
  let h = '';
  for (let d = 1; d <= days; d++) {
    const key = dateKey(y, m, d);
    let cls = 'cell';
    if (state.monthMap[key]) cls += ' hi';
    else if (d === td) cls += ' today';
    h += `<div class="${cls}"></div>`;
  }
  return h;
}
function calcStreak() {
  let s = 0; const d = new Date();
  for (;;) {
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    if (state.monthMap[key]) { s++; d.setDate(d.getDate() - 1); } else break;
  }
  return s;
}
function streakHTML() {
  const s = calcStreak();
  return s > 0
    ? `${icon('flame', 15)} ${s}일 연속 체크 중이에요`
    : `${icon('moon', 15)} 오늘 밤, 첫 체크를 시작해봐요`;
}

function updateTally() {
  const isToday = state.selDow === todayDow();
  const visApps = isToday ? todayVisible() : selVisible();
  const appsDone = visApps.filter((a) => a.id in state.checked).length;
  const evs = isToday ? state.todayEvents : [];
  const total = visApps.length + evs.length;
  const done = appsDone + evs.filter((e) => isEventDone(e)).length;
  const pts = todayVisible().reduce((s, a) => s + (a.id in state.checked ? a.points : 0), 0);

  const heroPts = $('#heroPts'); if (heroPts) heroPts.innerHTML = `<small>+</small>${fmt(pts)}<small>P</small>`;
  const heroMeta = $('#heroMeta'); if (heroMeta) heroMeta.textContent = `이번 달 누적 ${fmt(state.total)}P · ${total}개 중 ${done}개 완료`;
  const secCount = $('#secCount'); if (secCount) secCount.textContent = `${done} / ${total}`;

  const pct = total ? done / total : 0;
  const C = 2 * Math.PI * 37;
  const bar = $('#ringBar'); if (bar) bar.setAttribute('stroke-dashoffset', String(C * (1 - pct)));
  const ringPct = $('#ringPct'); if (ringPct) ringPct.innerHTML = `${Math.round(pct * 100)}<span>완료</span>`;

  const days = new Date(now0.getFullYear(), now0.getMonth() + 1, 0).getDate();
  const checkedDays = Object.keys(state.monthMap).length;
  const heatCount = $('#heatCount'); if (heatCount) heatCount.textContent = `${days}일 중 ${checkedDays}일`;

  const note = $('#doneNote'); if (note) note.classList.toggle('show', total > 0 && done === total && isToday);
}

/* ── 달력 ── */
function calView() {
  const y = state.calYear, m = state.calMonth;
  return `
    <div class="rd-head" style="margin-bottom:8px">
      <div>
        <div class="rd-eyebrow">${icon('calendar', 14)} 달력</div>
        <div class="rd-title" style="margin-top:7px">일정</div>
      </div>
    </div>
    <div class="rd-card pad" style="margin-top:14px">
      <div class="rd-calhead">
        <button class="rd-navbtn" data-action="cal-prev" aria-label="이전 달">${icon('chevronL', 18)}</button>
        <div class="m">${y}년 ${m + 1}월</div>
        <button class="rd-navbtn" data-action="cal-next" aria-label="다음 달">${icon('chevronR', 18)}</button>
      </div>
      <div class="rd-dow">${WEEKDAYS.map((d, i) => `<span class="${i === 6 ? 'sun' : ''}">${d}</span>`).join('')}</div>
      <div class="rd-grid">${calCellsHTML()}</div>
    </div>
    <div class="rd-section-label" id="dayLabel">${dayLabelText()}</div>
    <div class="rd-card pad" id="daypanel">${dayPanelHTML()}</div>
    <button class="rd-btn primary block" style="margin-top:16px" data-action="add-event">${icon('plus', 17)} 일정 추가하기</button>
    <div class="rd-foot">날짜를 누르면 그 날 일정이 보여요</div>`;
}
function calCellsHTML() {
  const y = state.calYear, m = state.calMonth;
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const n = new Date();
  const thisMonth = (n.getFullYear() === y && n.getMonth() === m);
  let h = '';
  for (let i = 0; i < first; i++) h += `<div class="rd-cell muted"></div>`;
  for (let d = 1; d <= days; d++) {
    const ds = dateKey(y, m, d);
    const evs = state.events.filter((e) => e.event_date === ds);
    const dots = evs.slice(0, 3).map(() => `<i></i>`).join('');
    let cls = 'rd-cell';
    if (thisMonth && d === n.getDate()) cls += ' today';
    if (ds === state.selDate) cls += ' sel';
    h += `<button class="${cls}" data-action="cal-day" data-date="${ds}"><span class="cd">${d}</span><span class="evdots">${dots}</span></button>`;
  }
  return h;
}
function dayLabelText() {
  const [, mm, dd] = state.selDate.split('-');
  const evs = state.events.filter((e) => e.event_date === state.selDate);
  return `${+mm}월 ${+dd}일${state.selDate === todayStr() ? ' · 오늘' : ''} <span class="count">${evs.length}개</span>`;
}
function dayPanelHTML() {
  const ds = state.selDate;
  const evs = state.events.filter((e) => e.event_date === ds)
    .sort((a, b) => (a.start_time || '99').localeCompare(b.start_time || '99'));
  if (!evs.length) return `<div class="rd-empty">이 날은 일정이 없어요.<br>아래 버튼으로 추가해보세요.</div>`;
  return evs.map((e) => {
    const done = isEventDone(e);
    const shared = e.owner_id && e.owner_id !== state.user?.id;
    const barColor = e.color && e.color.startsWith('--') ? `var(${e.color})` : (e.color || 'var(--accent)');
    return `<div class="rd-ev ${done ? 'done' : ''}" data-action="toggle-event-cal" data-id="${e.id}">
      <span class="bar" style="background:${barColor}"></span>
      <div class="ebody"><div class="et">${esc(e.title)}</div>
        <div class="es"><span>${e.start_time ? fmtTime(e.start_time) : '하루 종일'}</span>
          ${e.is_todo ? `<span class="rd-chip">체크리스트</span>` : ''}
          ${shared ? `<span class="rd-chip accent">함께</span>` : ''}</div></div>
      <button class="rd-more" data-action="edit-event" data-id="${e.id}" aria-label="수정">${icon('more', 18)}</button>
      <div class="rd-check ck">${icon('check', 14, 2.4)}</div></div>`;
  }).join('');
}
function rerenderDayPanel() {
  const p = $('#daypanel'); if (p) p.innerHTML = dayPanelHTML();
  const l = $('#dayLabel'); if (l) l.innerHTML = dayLabelText();
}

/* ── 친구 ── */
function friendsView() {
  const friends = state.friends;
  const pending = state.pendingInvites;

  const pendingSection = pending.length ? `
    <div class="rd-section-label">받은 초대 <span class="count">${pending.length}</span></div>
    <div class="rd-card pad">
      ${pending.map((inv) => `<div class="rd-friend">
        <div class="rd-fav">💌</div>
        <div class="rd-finfo"><div class="rd-fname">초대가 도착했어요</div><div class="rd-fstat">코드 <span class="code">${esc(inv.invite_code)}</span></div></div>
        <button class="rd-btn primary sm" data-action="accept-invite" data-code="${esc(inv.invite_code)}">수락</button>
        <button class="rd-btn ghost sm" data-action="decline-invite" data-id="${inv.id}">거절</button>
      </div>`).join('')}
    </div>` : '';

  const friendList = friends.length ? friends.map((f) => {
    const nm = f.myNickname || (f.friendId.slice(0, 6) + '…');
    const av = initial(f.myNickname);
    return `<div class="rd-friend">
      <div class="rd-fav">${f.myNickname ? esc(av) : '🌙'}</div>
      <div class="rd-finfo"><div class="rd-fname">${esc(nm)}</div><div class="rd-fstat">함께 체크하는 친구</div></div>
      <button class="rd-btn ghost sm" data-action="remove-friend" data-rowid="${f.id}">끊기</button>
    </div>`;
  }).join('') : `<div class="rd-empty">아직 친구가 없어요.<br>초대 링크를 만들어 함께 시작해요.</div>`;

  return `
    <div class="rd-head">
      <div>
        <div class="rd-eyebrow">${icon('users', 14)} 친구</div>
        <div class="rd-title" style="margin-top:7px">같이 체크해요</div>
        <div class="rd-sub">친구와 함께면 더 오래 이어가요 🌙</div>
      </div>
    </div>
    ${pendingSection}
    <div class="rd-section-label">내 친구 <span class="count">${friends.length}명</span></div>
    <div class="rd-card pad">${friendList}</div>

    <div class="rd-section-label">친구 초대</div>
    <div class="rd-card pad">
      <div style="font-size:13.5px;color:var(--text-muted);line-height:1.6;margin-bottom:14px">초대 링크를 보내면 친구가 바로 함께할 수 있어요.</div>
      <button class="rd-btn primary block" data-action="gen-invite">${icon('link', 16)} 초대 링크 만들기</button>
      <div class="rd-inrow">
        <input class="rd-input" id="invite-code-input" type="text" placeholder="초대 코드 입력" maxlength="8" style="text-transform:uppercase;letter-spacing:2px">
        <button class="rd-btn primary" data-action="accept-code" style="flex:none;padding:0 20px">수락</button>
      </div>
    </div>
    <div class="rd-foot">친구와 함께, 매일 밤</div>`;
}

/* ── 탭바 ── */
let tabbarEl;
const TABS = [{ id: 'today', label: '오늘', ic: 'moon' }, { id: 'cal', label: '달력', ic: 'calendar' }, { id: 'friends', label: '친구', ic: 'users' }];
function ensureTabbar() {
  if (!tabbarEl) {
    tabbarEl = document.createElement('nav');
    tabbarEl.className = 'rd-tabbar';
    tabbarEl.innerHTML = TABS.map((t) =>
      `<button class="rd-tab" data-tab="${t.id}">${icon(t.ic, 20)}<span class="lbl">${t.label}</span>${t.id === 'friends' ? '<span class="badge" id="friendBadge"></span>' : ''}</button>`
    ).join('');
    document.body.append(tabbarEl);
    tabbarEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      if (state.tab === b.dataset.tab) return;
      state.tab = b.dataset.tab; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  tabbarEl.style.display = 'flex';
  tabbarEl.querySelectorAll('.rd-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
  const badge = $('#friendBadge');
  if (badge) { const c = state.pendingInvites.length; badge.classList.toggle('show', c > 0); badge.textContent = c; }
}
function hideTabbar() { if (tabbarEl) tabbarEl.style.display = 'none'; }

/* ── 체크 토글 — 앱 ── */
async function toggle(id, el) {
  if (state.selDow !== todayDow()) { toast('오늘 날짜에만 체크할 수 있어요'); return; }
  const app = state.apps.find((a) => a.id === id); if (!app || !el) return;
  const was = id in state.checked;
  if (was) { delete state.checked[id]; state.total -= app.points; }
  else { state.checked[id] = app.points; state.total += app.points; }
  el.classList.toggle('done', !was); refreshMonthToday(); updateTally();
  try { was ? await uncheckIn(id) : await checkIn(id, app.points); }
  catch (e) {
    if (was) { state.checked[id] = app.points; state.total += app.points; }
    else { delete state.checked[id]; state.total -= app.points; }
    el.classList.toggle('done', was); refreshMonthToday(); updateTally();
    toast('저장에 실패했어요');
  }
}
function refreshMonthToday() {
  const key = todayStr();
  if (Object.keys(state.checked).length > 0) state.monthMap[key] = true; else delete state.monthMap[key];
  const heat = $('#heat'); if (heat) heat.innerHTML = heatHTML();
  const streak = $('#streak'); if (streak) streak.innerHTML = streakHTML();
  const week = $('#week'); if (week) week.innerHTML = weekHTML();
}

/* ── 체크 토글 — 일정 ── */
function syncEventDone(id, val) {
  const uid = val ? state.user?.id : null;
  const a = state.events.find((e) => e.id === id); if (a) a.done_by = uid;
  const b = state.todayEvents.find((e) => e.id === id); if (b) b.done_by = uid;
}
async function toggleEventChecklist(id, el) {
  const ev = state.todayEvents.find((e) => e.id === id); if (!ev || !el) return;
  const next = !isEventDone(ev);
  syncEventDone(id, next); el.classList.toggle('done', next); updateTally();
  try { await setEventDone(id, next); }
  catch (e) { syncEventDone(id, !next); el.classList.toggle('done', !next); updateTally(); toast('저장에 실패했어요'); }
}
async function toggleEventCal(id) {
  const ev = state.events.find((e) => e.id === id); if (!ev) return;
  const next = !isEventDone(ev);
  syncEventDone(id, next); rerenderDayPanel();
  try { await setEventDone(id, next); }
  catch (e) { syncEventDone(id, !next); rerenderDayPanel(); toast('저장에 실패했어요'); }
}

/* ── 바텀시트 ── */
let sheetEl, backdropEl;
function ensureSheet() {
  if (sheetEl) return;
  backdropEl = document.createElement('div');
  backdropEl.className = 'rd-scrim'; backdropEl.dataset.action = 'close';
  sheetEl = document.createElement('div'); sheetEl.className = 'rd-sheet'; sheetEl.setAttribute('role', 'dialog');
  document.body.append(backdropEl, sheetEl);
}
function sheetHead(title, sub) {
  return `<div class="rd-sheet-head"><div><div class="t">${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <button class="rd-sheet-close" data-action="close" aria-label="닫기">${icon('x', 17)}</button></div>`;
}
function openSheet(inner) {
  ensureSheet();
  sheetEl.innerHTML = `<div class="rd-grab"></div>` + inner;
  sheetEl.scrollTop = 0;
  requestAnimationFrame(() => { backdropEl.classList.add('show'); sheetEl.classList.add('show'); });
}
function closeSheet() { if (sheetEl) { backdropEl.classList.remove('show'); sheetEl.classList.remove('show'); } }

/* 앱 추가 — 프리셋 다중 선택 + 직접 추가 */
let presetPicks = new Set();
function openAddApp() {
  presetPicks = new Set();
  const existing = new Set(state.apps.map((a) => a.name));
  const avail = PRESETS.filter((p) => !existing.has(p.name));
  const body = avail.length
    ? `<div class="rd-applist">${avail.map((p) => `<div class="rd-approw" data-action="preset-pick" data-name="${esc(p.name)}">
        <div class="rd-ic">${icon(iconForCat(p.category), 17)}</div>
        <div class="nm">${esc(p.name)}</div>
        <div class="pt">${p.points ? '+' + fmt(p.points) + 'P' : ''}</div>
        <span class="pk">${icon('plus', 18)}</span></div>`).join('')}</div>`
    : `<div class="rd-empty" style="padding:18px 8px">추천 앱 9종이 이미 다 추가돼 있어요 🎉</div>`;
  openSheet(`${sheetHead('앱 추가', '오늘 체크리스트에 더할 적립 앱을 골라요')}
    ${body}
    <div class="rd-sheet-actions">
      <button class="rd-btn ghost" data-action="open-form">직접 추가</button>
      ${avail.length ? `<button class="rd-btn primary" data-action="preset-add">추가하기</button>` : ''}
    </div>`);
}

/* 앱 직접 추가/수정 폼 */
let formId = null, formDows = new Set();
function openForm(editApp = null) {
  formId = editApp?.id ?? null;
  formDows = new Set(editApp?.repeat_days || []);
  const cats = ['만보기', '기상·인증', '함께·미션', '기후·미션', '포인트적립', '기타'];
  openSheet(`${sheetHead(editApp ? '항목 수정' : '직접 추가')}
    <div class="rd-field"><label>이름</label><input class="rd-input" id="f-name" type="text" placeholder="예) 토스 만보기" value="${esc(editApp?.name || '')}"></div>
    <div class="rd-field"><div class="rd-row2">
      <div><label>카테고리</label><select class="rd-input" id="f-cat">${cats.map((c) => `<option ${editApp?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div><label>포인트</label><input class="rd-input" id="f-pts" type="number" inputmode="numeric" placeholder="0" value="${editApp?.points ?? ''}"></div>
    </div></div>
    <div class="rd-field"><label>링크 (선택)</label><input class="rd-input" id="f-url" type="text" placeholder="앱/사이트 주소" value="${esc(editApp?.url || '')}"></div>
    <div class="rd-field"><label>반복 요일 (안 고르면 매일 떠요)</label>
      <div class="rd-dowpick">${WEEKDAYS.map((d, i) => `<button class="rd-dowchip ${formDows.has(i) ? 'on' : ''}" data-action="dow-toggle" data-dow="${i}">${d}</button>`).join('')}</div></div>
    <div class="rd-sheet-actions">
      ${editApp ? `<button class="rd-btn danger" data-action="delete">${icon('trash', 16)} 삭제</button>` : `<button class="rd-btn ghost" data-action="close">닫기</button>`}
      <button class="rd-btn primary" data-action="save">저장</button>
    </div>`);
}

/* 일정 추가/수정 폼 */
let evId = null, evColor = 'var(--accent)', evSharePicks = new Set();
function openEventForm(editEv = null) {
  evId = editEv?.id ?? null;
  evColor = editEv?.color || 'var(--accent)';
  if (evColor.startsWith('--')) evColor = 'var(--accent)';
  evSharePicks = new Set();
  const date = editEv?.event_date || state.selDate || todayStr();
  const time = editEv?.start_time ? editEv.start_time.slice(0, 5) : '';
  const todo = editEv ? editEv.is_todo : true;
  const isOwner = !editEv || !editEv.owner_id || editEv.owner_id === state.user?.id;

  const linkIc = icon('link', 13).replace('<svg', '<svg style="vertical-align:-2px;display:inline-block"');
  const shareUI = isOwner ? `<div class="rd-field">
    <label>${linkIc} 친구와 공유</label>
    ${state.friends.length
      ? `<div class="rd-share-list">${state.friends.map((f) => {
          const fname = f.myNickname || f.friendId.slice(0, 6) + '…';
          return `<button class="rd-share-btn" data-action="toggle-share-friend" data-friendid="${f.friendId}" data-fname="${esc(fname)}">
            <span>🌙 ${esc(fname)}</span><span class="pk">공유</span></button>`;
        }).join('')}</div><div id="share-list" class="rd-share-list" style="margin-top:7px"></div>`
      : `<div class="rd-hint" style="margin:0">아직 친구가 없어요. 친구 탭에서 먼저 친구를 추가해요 🤝</div>`}
  </div>` : '';

  openSheet(`${sheetHead(editEv ? '일정 수정' : '일정 추가')}
    <div class="rd-field"><label>제목</label><input class="rd-input" id="e-title" type="text" placeholder="예) 친구랑 저녁 약속" value="${esc(editEv?.title || '')}"></div>
    <div class="rd-field"><div class="rd-row2">
      <div><label>날짜</label><input class="rd-input" id="e-date" type="date" value="${date}"></div>
      <div><label>시간 (선택)</label><input class="rd-input" id="e-time" type="time" value="${time}"></div>
    </div></div>
    <div class="rd-field"><label>색상</label>
      <div class="rd-swatches">${COLORS.map((c) => `<button class="rd-sw ${c === evColor ? 'on' : ''}" data-action="ev-color" data-c="${c}" style="background:${c}" aria-label="색상"></button>`).join('')}</div></div>
    <div class="rd-field">
      <div class="rd-toggle-row" data-action="toggle-todo">
        <div><div class="lab">오늘 할 일</div><div class="desc">오늘 일정이면 체크리스트에도 떠요</div></div>
        <button class="rd-switch ${todo ? 'on' : ''}" id="e-todo" aria-label="오늘 할 일"><i></i></button>
      </div>
    </div>
    ${shareUI}
    <div class="rd-sheet-actions">
      ${editEv ? `<button class="rd-btn danger" data-action="del-event">${icon('trash', 16)} 삭제</button>` : `<button class="rd-btn ghost" data-action="close">닫기</button>`}
      <button class="rd-btn primary" data-action="save-event">저장</button>
    </div>`);
  if (isOwner && editEv) loadShareList(editEv.id);
}

async function loadShareList(eventId) {
  const list = $('#share-list'); if (!list) return;
  try {
    const uids = await fetchSharedUsers(eventId);
    if (!uids.length) { list.innerHTML = ''; }
    else {
      list.innerHTML = uids.map((uid) => {
        const friend = state.friends.find((f) => f.friendId === uid);
        const label = friend?.myNickname || uid.slice(0, 6) + '…';
        return `<div class="rd-share-item"><span>🌙 ${esc(label)}</span>
          <button class="rd-btn ghost sm" data-action="do-unshare" data-uid="${uid}" data-evid="${eventId}">공유 취소</button></div>`;
      }).join('');
    }
    document.querySelectorAll('.rd-share-btn').forEach((btn) => {
      const shared = uids.includes(btn.dataset.friendid);
      btn.classList.toggle('shared', shared);
      const pk = btn.querySelector('.pk'); if (pk) pk.textContent = shared ? '✓ 공유 중' : '공유';
    });
  } catch (e) { list.innerHTML = ''; }
}

/* ── 액션 — 앱 ── */
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
  if (!confirm('이 항목을 삭제할까요?')) return;
  try { await deleteApp(formId); delete state.checked[formId]; closeSheet(); await reload(); toast('삭제했어요'); }
  catch (e) { toast('삭제에 실패했어요'); }
}

/* ── 액션 — 일정 ── */
async function saveEvent() {
  const title = $('#e-title').value.trim();
  if (!title) { toast('일정 이름을 적어줘요'); return; }
  const event_date = $('#e-date').value;
  if (!event_date) { toast('날짜를 골라줘요'); return; }
  const t = $('#e-time').value;
  const start_time = t ? `${t}:00` : null;
  const is_todo = $('#e-todo').classList.contains('on');
  try {
    if (evId) {
      await updateEvent(evId, { title, event_date, start_time, is_todo, color: evColor });
      toast('일정을 수정했어요');
    } else {
      const newId = await addEvent({ title, event_date, start_time, is_todo, color: evColor });
      if (evSharePicks.size && newId) await Promise.all([...evSharePicks].map((fid) => shareFriendEvent(newId, fid)));
      toast(evSharePicks.size ? `일정 추가 + ${evSharePicks.size}명과 공유했어요 🔗` : '일정을 추가했어요');
    }
    if (event_date.startsWith(`${state.calYear}-${pad(state.calMonth + 1)}`)) state.selDate = event_date;
    closeSheet(); await reloadEvents(); render();
  } catch (e) { toast('저장에 실패했어요'); }
}
async function removeEvent() {
  if (!evId) return;
  if (!confirm('이 일정을 삭제할까요?')) return;
  try { await deleteEvent(evId); closeSheet(); await reloadEvents(); render(); toast('일정을 삭제했어요'); }
  catch (e) { toast('삭제에 실패했어요'); }
}

/* 친구 목록에서 공유 토글 */
async function doToggleShareFriend(friendId, fname, btn) {
  if (!btn) return;
  if (!evId) {
    const isOn = evSharePicks.has(friendId);
    isOn ? evSharePicks.delete(friendId) : evSharePicks.add(friendId);
    btn.classList.toggle('shared', !isOn);
    const pk = btn.querySelector('.pk'); if (pk) pk.textContent = !isOn ? '✓ 공유 예정' : '공유';
    return;
  }
  const isShared = btn.classList.contains('shared');
  try {
    if (isShared) { await unshareEvent(evId, friendId); toast(`${fname}님과 공유를 취소했어요`); }
    else { await shareFriendEvent(evId, friendId); toast(`${fname}님과 공유했어요 🔗`); }
    await loadShareList(evId);
  } catch (e) { toast('공유 설정에 실패했어요'); }
}

/* 초대 링크 */
async function genInvite() {
  try {
    const code = await getOrCreateInvite();
    const url = `${location.origin}?invite=${code}`;
    openSheet(`${sheetHead('친구 초대하기', '아래 링크를 친구에게 보내면 바로 수락할 수 있어요')}
      <div class="rd-uidbox">${esc(url)}</div>
      <div style="margin:10px 2px 0;color:var(--text-faint);font-size:12px">초대 코드 <b style="letter-spacing:2px;color:var(--text)">${esc(code)}</b></div>
      <div class="rd-sheet-actions"><button class="rd-btn ghost" data-action="close">닫기</button><button class="rd-btn primary" id="copy-invite-btn">${icon('link', 16)} 링크 복사</button></div>`);
    $('#copy-invite-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(url).then(() => toast('복사했어요!')).catch(() => toast('복사 실패'));
    });
  } catch (e) { toast('초대 링크 생성에 실패했어요'); }
}
async function doAcceptInvite(code) {
  try { await acceptInvite(code.toUpperCase()); toast('친구가 됐어요 🤝'); await reloadFriends(); render(); }
  catch (e) { toast(e.message || '초대 수락에 실패했어요'); }
}
async function doDeclineInvite(rowId) {
  try { await removeFriend(rowId); toast('초대를 거절했어요'); await reloadFriends(); render(); }
  catch (e) { toast('거절에 실패했어요'); }
}
async function doRemoveFriend(rowId) {
  if (!confirm('이 친구를 목록에서 삭제할까요?')) return;
  try { await removeFriend(rowId); toast('친구를 삭제했어요'); await reloadFriends(); render(); }
  catch (e) { toast('삭제에 실패했어요'); }
}
async function doUnshare(eventId, uid) {
  try { await unshareEvent(eventId, uid); toast('공유를 취소했어요'); await loadShareList(eventId); }
  catch (e) { toast('취소에 실패했어요'); }
}

/* ── 토스트 ── */
let toastEl, toastTimer;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'rd-toast'; document.body.append(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
}

/* ── 이벤트 위임 (페이지) ── */
$('#app').addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]'); if (!t) return;
  const { action, id, dow, date } = t.dataset;
  switch (action) {
    case 'toggle': toggle(id, t.closest('.rd-row')); break;
    case 'edit': openForm(state.apps.find((a) => a.id === id)); break;
    case 'toggle-event': toggleEventChecklist(id, t.closest('.rd-row')); break;
    case 'edit-event': { const ev = state.events.find((x) => x.id === id) || state.todayEvents.find((x) => x.id === id); if (ev) openEventForm(ev); break; }
    case 'selday': state.selDow = +dow; render(); break;
    case 'open-add': openAddApp(); break;
    case 'cal-prev': shiftMonth(-1); break;
    case 'cal-next': shiftMonth(1); break;
    case 'cal-day': state.selDate = date; rerenderDayPanel(); document.querySelectorAll('.rd-cell').forEach((c) => c.classList.toggle('sel', c.dataset.date === date)); break;
    case 'toggle-event-cal': toggleEventCal(id); break;
    case 'add-event': openEventForm(null); break;
    case 'logout': if (confirm('로그아웃 할까요?')) signOut(); break;
    case 'gen-invite': genInvite(); break;
    case 'accept-code': { const code = ($('#invite-code-input')?.value || '').trim().toUpperCase(); if (code) doAcceptInvite(code); else toast('코드를 입력해줘요'); break; }
    case 'accept-invite': doAcceptInvite(t.dataset.code); break;
    case 'decline-invite': doDeclineInvite(t.dataset.id); break;
    case 'remove-friend': doRemoveFriend(t.dataset.rowid); break;
  }
});

/* ── 이벤트 위임 (시트) ── */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]'); if (!t || !sheetEl) return;
  if (!sheetEl.contains(t) && t !== backdropEl) return;
  const { action, name, dow, c, uid, evid } = t.dataset;
  switch (action) {
    case 'close': closeSheet(); break;
    case 'open-form': openForm(null); break;
    case 'preset-pick': {
      (presetPicks.has(name) ? presetPicks.delete(name) : presetPicks.add(name));
      t.classList.toggle('picked');
      const pk = t.querySelector('.pk'); if (pk) pk.innerHTML = presetPicks.has(name) ? icon('check', 18, 2.4) : icon('plus', 18);
      break;
    }
    case 'preset-add': presetAdd(); break;
    case 'dow-toggle': { const d = +dow; (formDows.has(d) ? formDows.delete(d) : formDows.add(d)); t.classList.toggle('on'); break; }
    case 'save': saveForm(); break;
    case 'delete': removeApp(); break;
    case 'ev-color': evColor = c; sheetEl.querySelectorAll('.rd-sw').forEach((b) => b.classList.toggle('on', b.dataset.c === c)); break;
    case 'toggle-todo': { const sw = $('#e-todo'); if (sw) sw.classList.toggle('on'); break; }
    case 'save-event': saveEvent(); break;
    case 'del-event': removeEvent(); break;
    case 'do-unshare': doUnshare(evid, uid); break;
    case 'toggle-share-friend': doToggleShareFriend(t.dataset.friendid, t.dataset.fname, t.closest('.rd-share-btn')); break;
  }
});

/* ── 데이터 로드 ── */
async function shiftMonth(delta) {
  let m = state.calMonth + delta, y = state.calYear;
  if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
  state.calMonth = m; state.calYear = y;
  state.selDate = (new Date().getFullYear() === y && new Date().getMonth() === m) ? todayStr() : dateKey(y, m, 1);
  state.events = await safe(fetchEventsMonth(y, m));
  render();
}
async function reloadEvents() {
  const [me, te] = await Promise.all([safe(fetchEventsMonth(state.calYear, state.calMonth)), safe(fetchTodayTodoEvents())]);
  state.events = me; state.todayEvents = te;
}
async function reloadFriends() {
  const [friends, pending] = await Promise.all([safe(fetchFriends()), safe(fetchPendingInvites())]);
  state.friends = friends; state.pendingInvites = pending;
}
async function reload() {
  const n = new Date();
  const [apps, checkins, total, monthMap, me, te] = await Promise.all([
    fetchApps(), fetchTodayCheckins(), fetchTotalPoints(),
    fetchMonthCheckins(n.getFullYear(), n.getMonth()),
    safe(fetchEventsMonth(state.calYear, state.calMonth)), safe(fetchTodayTodoEvents()),
  ]);
  state.apps = apps; state.checked = {};
  checkins.forEach((c) => { state.checked[c.app_id] = c.points; });
  state.total = total; state.monthMap = monthMap;
  state.events = me; state.todayEvents = te;
  await reloadFriends();
  state.loading = false; render();
}
async function renderApp() {
  state.loading = true; render();
  try { await reload(); }
  catch (e) {
    console.error(e);
    $('#app').innerHTML = `<div class="wrap"><div class="rd-empty">데이터를 불러오지 못했어요 😢<br><small>${esc(e.message || e)}</small></div></div>`;
  }
}

/* ── 로그인 ── */
function renderLogin() {
  hideTabbar();
  $('#app').innerHTML = `<div class="rd-login">
    <div class="moonhero">${moonSVG(150, true)}</div>
    <h1>매일 밤,<br>잠들기 전 나를 생각해</h1>
    <p>오늘 하루도 수고한 나를 위해.<br>가볍게 체크하고, 편히 잠들어요.</p>
    <button class="rd-kakao" data-action="kakao-login">${icon('check', 18, 2.4)} 카카오로 시작하기</button>
    <div class="fine">로그인하면 이용약관에 동의하게 돼요</div>
  </div>`;
  $('#app').querySelector('[data-action="kakao-login"]').addEventListener('click', signInKakao);
}
async function signInKakao() {
  try {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: 'https://sweetdreams-zzz.vercel.app',
        scopes: 'profile_nickname profile_image',
        queryParams: { scope: 'profile_nickname profile_image' },
      },
    });
  } catch (e) { toast('로그인을 시작하지 못했어요'); }
}
async function signOut() {
  try { await supabase.auth.signOut(); } catch (e) { /* noop */ }
  state.user = null; hideTabbar(); renderLogin();
}

async function boot() {
  try { const { data: { session } } = await supabase.auth.getSession(); state.user = session?.user ?? null; }
  catch (e) { state.user = null; }

  const params = new URLSearchParams(location.search);
  const pendingInviteCode = params.get('invite');
  if (pendingInviteCode) history.replaceState({}, '', location.pathname);

  if (state.user) {
    await backfillOwner(state.user.id).catch(() => {});
    if (pendingInviteCode) {
      try { await acceptInvite(pendingInviteCode.toUpperCase()); toast('친구가 됐어요 🤝'); }
      catch (e) { toast(e.message || '초대 코드가 유효하지 않아요'); }
    }
    await renderApp();
  } else {
    if (pendingInviteCode) sessionStorage.setItem('pendingInvite', pendingInviteCode);
    renderLogin();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    const u = session?.user ?? null;
    const changed = (u?.id) !== (state.user?.id);
    state.user = u;
    if (!u) renderLogin();
    else if (changed) {
      backfillOwner(u.id).catch(() => {});
      const saved = sessionStorage.getItem('pendingInvite');
      if (saved) { sessionStorage.removeItem('pendingInvite'); try { await acceptInvite(saved.toUpperCase()); toast('친구가 됐어요 🤝'); } catch (e) { /* noop */ } }
      renderApp();
    }
  });
}
boot();
