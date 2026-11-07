'use strict';
const MOODS = { high: '躁', up: 'やや躁', steady: '安定', down: 'やや鬱', low: '鬱' };
function validTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return Number.isFinite(+d) && localTime(d) === value;
}
function localTime(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function validateEvents(events) {
  if (!Array.isArray(events)) throw Error('記録の配列が必要です。');
  const ids = new Set();
  return events.map(e => {
    if (!e || typeof e.id !== 'string' || !e.id || ids.has(e.id) || !['bed','wake'].includes(e.type) || !validTime(e.at) || !Object.hasOwn(MOODS,e.mood) || typeof e.note !== 'string' || e.note.length > 1000) throw Error('記録の日時・気分・形式を確認してください。');
    ids.add(e.id); return { id:e.id, type:e.type, at:e.at, mood:e.mood, note:e.note };
  });
}
function importData(data) {
  if (data?.version === 2) return validateEvents(data.events);
  if (data?.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) throw Error('対応していないJSON形式です。');
  const events = [];
  for (const [day,r] of Object.entries(data.records)) {
    if (!r || typeof r.note !== 'string' || r.note.length > 1000 || !(r.mood === '' || Object.hasOwn(MOODS,r.mood))) throw Error('旧形式の記録が不正です。');
    let count = 0;
    for (const [key,type] of [['wake','wake'],['bed','bed'],['napStart','bed'],['napEnd','wake']]) {
      if (r[key] === undefined || r[key] === '') continue;
      if (typeof r[key] !== 'string') throw Error('旧形式の時刻が不正です。');
      let at = `${day}T${r[key]}`;
      if (!validTime(at)) throw Error('旧形式の日時が不正です。');
      if (key === 'bed' && Number(r[key].slice(0,2)) < 12) {
        const next = new Date(at); next.setDate(next.getDate()+1); at = localTime(next);
      }
      const commentTarget = r.bed ? 'bed' : 'napStart';
      events.push({id:`calendar-${day}-${key}`,type,at,mood:r.mood || 'steady',note:key === commentTarget ? r.note : ''}); count++;
    }
    if (!count && (r.note || r.mood)) throw Error(`${day} は時刻がありません。カレンダーで時刻を入力してから再エクスポートしてください。`);
  }
  return validateEvents(events);
}
function intervals(events) {
  const sorted = [...events].sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
  return sorted.slice(0,-1).flatMap((e,i) => {
    const next = sorted[i+1];
    if (e.type === next.type || e.at === next.at) return [];
    return [{start:new Date(e.at),end:new Date(next.at),kind:e.type === 'bed'?'sleep':next.mood,note:next.note,id:next.id}];
  });
}
function segmentsForDay(events, day) {
  const start = new Date(`${day}T00:00`), end = new Date(start); end.setDate(end.getDate()+1);
  return intervals(events).filter(x=>x.start<end && x.end>start).map(x=>{
    const a = new Date(Math.max(+x.start,+start)), b = new Date(Math.min(+x.end,+end));
    const minute = d => d.getHours()*60+d.getMinutes();
    return {...x,left:minute(a)/1440*100,width:((+b===+end?1440:minute(b))-minute(a))/1440*100,hours:(b-a)/3600000,totalHours:(x.end-x.start)/3600000};
  });
}
if (typeof module !== 'undefined') module.exports={MOODS,localTime,validTime,validateEvents,importData,intervals,segmentsForDay};
