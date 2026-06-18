import { supabase } from './supabaseClient.js';

// ────────────────────────────────────────────
// 날짜 / 요일 헬퍼
// ────────────────────────────────────────────

// 오늘 날짜를 KST 기준 'YYYY-MM-DD'로 (서버 UTC와 어긋나지 않게 직접 계산)
export function todayStr() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// 오늘 요일 (0=월 … 6=일). JS getDay는 0=일이라 보정.
export function todayDow() {
  return (new Date().getDay() + 6) % 7;
}

// 이 항목이 오늘 보여야 하는지: repeat_days가 비었으면 매일, 아니면 오늘 요일 포함 시
export function showsToday(app, dow = todayDow()) {
  if (!app.repeat_days || app.repeat_days.length === 0) return true;
  return app.repeat_days.includes(dow);
}

// ────────────────────────────────────────────
// 앱(체크 항목) 조회 / CRUD
// ────────────────────────────────────────────

export async function fetchApps() {
  const { data, error } = await supabase
    .from('pedometer_apps')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addApp({ name, category = '기타', points = 0, url = null, repeat_days = null, sort_order = 0 }) {
  const { data, error } = await supabase
    .from('pedometer_apps')
    .insert({ name, category, points, url, repeat_days, sort_order })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateApp(id, fields) {
  const { data, error } = await supabase
    .from('pedometer_apps')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteApp(id) {
  const { error } = await supabase.from('pedometer_apps').delete().eq('id', id);
  if (error) throw error;
}

// 프리셋 여러 개 일괄 추가
export async function addPresetApps(rows) {
  const { data, error } = await supabase
    .from('pedometer_apps')
    .insert(rows)
    .select();
  if (error) throw error;
  return data || [];
}

// ────────────────────────────────────────────
// 체크인 (오늘 체크 / 누적 포인트)
// ────────────────────────────────────────────

// 오늘 체크된 항목들: [{ app_id, points }]
export async function fetchTodayCheckins() {
  const { data, error } = await supabase
    .from('pedometer_checkins')
    .select('app_id, points')
    .eq('checkin_date', todayStr());
  if (error) throw error;
  return data || [];
}

// 누적 적립 포인트 합산
export async function fetchTotalPoints() {
  const { data, error } = await supabase
    .from('pedometer_checkins')
    .select('points');
  if (error) throw error;
  return (data || []).reduce((sum, r) => sum + (r.points || 0), 0);
}

// 체크인 (날짜+app_id unique 제약 → upsert로 중복 방지)
export async function checkIn(appId, points) {
  const { error } = await supabase
    .from('pedometer_checkins')
    .upsert(
      { app_id: appId, checkin_date: todayStr(), points },
      { onConflict: 'app_id,checkin_date' }
    );
  if (error) throw error;
}

// 체크 해제
export async function uncheckIn(appId) {
  const { error } = await supabase
    .from('pedometer_checkins')
    .delete()
    .eq('app_id', appId)
    .eq('checkin_date', todayStr());
  if (error) throw error;
}

// 이번 달 날짜별 체크 여부 (도장판용): { 'YYYY-MM-DD': true }
export async function fetchMonthCheckins(year, monthIndex0) {
  const start = new Date(year, monthIndex0, 1);
  const end = new Date(year, monthIndex0 + 1, 0);
  const fmt = (dt) => {
    const l = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
    return l.toISOString().slice(0, 10);
  };
  const { data, error } = await supabase
    .from('pedometer_checkins')
    .select('checkin_date')
    .gte('checkin_date', fmt(start))
    .lte('checkin_date', fmt(end));
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.checkin_date] = true; });
  return map;
}

// ────────────────────────────────────────────
// 일정(이벤트) — 2단계
//  ※ 지금은 로그인 없이 동작(전체 공유). 3단계에서 owner_id + 개별 공유로 전환.
// ────────────────────────────────────────────

// 한 달 일정 조회 (달력 점 표시용)
export async function fetchEventsMonth(year, monthIndex0) {
  const fmt = (dt) => {
    const l = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
    return l.toISOString().slice(0, 10);
  };
  const start = fmt(new Date(year, monthIndex0, 1));
  const end = fmt(new Date(year, monthIndex0 + 1, 0));
  const { data, error } = await supabase
    .from('pedometer_events')
    .select('*')
    .gte('event_date', start)
    .lte('event_date', end)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data || [];
}

// 오늘이면서 '할 일(is_todo)'인 일정 → 체크리스트에 끼워넣기용
export async function fetchTodayTodoEvents() {
  const { data, error } = await supabase
    .from('pedometer_events')
    .select('*')
    .eq('event_date', todayStr())
    .eq('is_todo', true);
  if (error) throw error;
  return data || [];
}

export async function addEvent({ title, event_date, start_time = null, is_todo = true, color = '--chip-mint' }) {
  const { data, error } = await supabase
    .from('pedometer_events')
    .insert({ title, event_date, start_time, is_todo, color })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(id, fields) {
  const { data, error } = await supabase
    .from('pedometer_events')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('pedometer_events').delete().eq('id', id);
  if (error) throw error;
}

// 일정 완료 토글 (2단계는 done 불리언, 3단계에서 done_by 사용자로 전환)
export async function setEventDone(id, done) {
  const { error } = await supabase
    .from('pedometer_events')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────
// 프리셋 9종 (코디님이 실제로 쓰는 앱)
// points는 임시 기본값 — 앱에서 수정 가능
// ────────────────────────────────────────────
export const PRESETS = [
  { name: '토스 만보기',       category: '만보기',     points: 100, url: null, icon: 'walk'  },
  { name: '캐시워크',          category: '만보기',     points: 100, url: null, icon: 'walk'  },
  { name: '모니모 만보기',     category: '만보기',     points: 30,  url: null, icon: 'walk'  },
  { name: '머니워크',          category: '만보기',     points: 50,  url: null, icon: 'walk'  },
  { name: '모니모 기상인증',   category: '기상·인증',  points: 30,  url: null, icon: 'sun'   },
  { name: '모니모 함께걷기',   category: '함께·미션',  points: 30,  url: null, icon: 'heart' },
  { name: '기후행동 기후소득', category: '기후·미션',  points: 50,  url: null, icon: 'leaf'  },
  { name: '캐시는 내차지',     category: '포인트적립', points: 50,  url: null, icon: 'coin'  },
  { name: '스마일패스',        category: '포인트적립', points: 50,  url: null, icon: 'coin'  },
];
