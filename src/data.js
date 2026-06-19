import { supabase } from './supabaseClient.js';

// ── 날짜 헬퍼 ──
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const todayDow = () => (new Date().getDay() + 6) % 7; // 0=월
export const showsToday = (a, dow) => !a.repeat_days || a.repeat_days.includes(dow);

// ── 앱 CRUD ──
export async function fetchApps() {
  const { data, error } = await supabase.from('pedometer_apps').select('*').order('sort_order');
  if (error) throw error;
  return data;
}
export async function addApp(row) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('pedometer_apps').insert({ ...row, owner_id: user?.id });
  if (error) throw error;
}
export async function updateApp(id, fields) {
  const { error } = await supabase.from('pedometer_apps').update(fields).eq('id', id);
  if (error) throw error;
}
export async function deleteApp(id) {
  const { error } = await supabase.from('pedometer_apps').delete().eq('id', id);
  if (error) throw error;
}
export async function addPresetApps(rows) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('pedometer_apps').insert(rows.map(r => ({ ...r, owner_id: user?.id })));
  if (error) throw error;
}

// 기존 데이터 백필 (owner_id null인 것들)
export async function backfillOwner(userId) {
  await supabase.from('pedometer_apps').update({ owner_id: userId }).is('owner_id', null);
  await supabase.from('pedometer_checkins').update({ owner_id: userId }).is('owner_id', null);
  await supabase.from('pedometer_events').update({ owner_id: userId }).is('owner_id', null);
}

// ── 체크인 CRUD ──
export async function fetchTodayCheckins() {
  const { data, error } = await supabase.from('pedometer_checkins').select('app_id, points').eq('checkin_date', todayStr());
  if (error) throw error;
  return data;
}
export async function fetchTotalPoints() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const { data, error } = await supabase.from('pedometer_checkins').select('points').gte('checkin_date', start);
  if (error) throw error;
  return data.reduce((s, r) => s + (r.points || 0), 0);
}
export async function fetchMonthCheckins(year, month) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const ny = month === 11 ? year + 1 : year;
  const nm = month === 11 ? 1 : month + 2;
  const end = `${ny}-${String(nm).padStart(2, '0')}-01`;
  const { data, error } = await supabase.from('pedometer_checkins').select('checkin_date').gte('checkin_date', start).lt('checkin_date', end);
  if (error) throw error;
  return Object.fromEntries(data.map(r => [r.checkin_date, true]));
}
export async function checkIn(appId, points) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('pedometer_checkins').upsert({ app_id: appId, checkin_date: todayStr(), points, owner_id: user?.id });
  if (error) throw error;
}
export async function uncheckIn(appId) {
  const { error } = await supabase.from('pedometer_checkins').delete().eq('app_id', appId).eq('checkin_date', todayStr());
  if (error) throw error;
}

// ── 일정 CRUD ──
export async function fetchEventsMonth(year, month) {
  const pad = n => String(n).padStart(2, '0');
  const start = `${year}-${pad(month + 1)}-01`;
  const ny = month === 11 ? year + 1 : year;
  const nm = month === 11 ? 1 : month + 2;
  const end = `${ny}-${pad(nm)}-01`;
  const { data, error } = await supabase.from('pedometer_events').select('*').gte('event_date', start).lt('event_date', end).order('start_time');
  if (error) throw error;
  return data;
}
export async function fetchTodayTodoEvents() {
  const { data, error } = await supabase.from('pedometer_events').select('*').eq('event_date', todayStr()).eq('is_todo', true).order('start_time');
  if (error) throw error;
  return data;
}
export async function addEvent(row) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('pedometer_events').insert({ ...row, owner_id: user?.id });
  if (error) throw error;
}
export async function updateEvent(id, fields) {
  const { error } = await supabase.from('pedometer_events').update(fields).eq('id', id);
  if (error) throw error;
}
export async function deleteEvent(id) {
  const { error } = await supabase.from('pedometer_events').delete().eq('id', id);
  if (error) throw error;
}
export async function setEventDone(id, done) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('pedometer_events').update({
    done_by: done ? user?.id : null,
    done_at: done ? new Date().toISOString() : null,
  }).eq('id', id);
  if (error) throw error;
}

// ── 공유 CRUD ──
export async function fetchSharedUsers(eventId) {
  const { data, error } = await supabase.from('pedometer_event_shares').select('shared_with').eq('event_id', eventId);
  if (error) throw error;
  return data.map(r => r.shared_with);
}
export async function shareEvent(eventId, targetUserId) {
  const { error } = await supabase.from('pedometer_event_shares').insert({ event_id: eventId, shared_with: targetUserId });
  if (error) throw error;
}
export async function unshareEvent(eventId, targetUserId) {
  const { error } = await supabase.from('pedometer_event_shares').delete().eq('event_id', eventId).eq('shared_with', targetUserId);
  if (error) throw error;
}
// 카카오 닉네임으로 상대 검색 (auth.users는 직접 못 읽으므로 pedometer_apps owner로 찾기)
export async function findUserByNickname(nickname) {
  // profiles 테이블 없이: 상대방이 앱을 하나라도 등록했으면 owner_id로 찾을 수 있음
  // 현실적으로는 상대 UID를 직접 입력받는 방식으로 구현
  return null;
}

// ── 프리셋 ──
export const PRESETS = [
  { name: '토스 만보기', category: '만보기', points: 100, url: 'https://toss.im' },
  { name: '캐시워크', category: '만보기', points: 100, url: 'https://cashwalk.io' },
  { name: '모니모 만보기', category: '만보기', points: 30, url: '' },
  { name: '머니워크', category: '만보기', points: 50, url: '' },
  { name: '모니모 기상인증', category: '기상·인증', points: 30, url: '' },
  { name: '모니모 함께걷기', category: '함께·미션', points: 30, url: '' },
  { name: '기후행동 기후소득', category: '기후·미션', points: 50, url: '' },
  { name: '캐시는 내차지', category: '포인트적립', points: 50, url: '' },
  { name: '스마일패스', category: '포인트적립', points: 50, url: '' },
];