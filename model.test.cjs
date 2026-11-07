const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateEvents,importData,segmentsForDay,intervals}=require('./model.js');
const e=(id,type,at,mood='steady',note='')=>({id,type,at,mood,note});
test('日付をまたぐ睡眠は各日の0〜24時に分割',()=>{const data=[e('1','bed','2026-11-01T22:00'),e('2','wake','2026-11-02T06:00')];const a=segmentsForDay(data,'2026-11-01')[0],b=segmentsForDay(data,'2026-11-02')[0];assert.equal(a.hours,2);assert.equal(a.left,22/24*100);assert.equal(b.hours,6);assert.equal(b.left,0);assert.equal(b.kind,'sleep');});
test('覚醒区間は終端の就寝時の気分とコメント',()=>{const data=[e('1','wake','2026-11-02T06:00'),e('2','bed','2026-11-02T22:00','low','疲れた')];const s=segmentsForDay(data,'2026-11-02')[0];assert.equal(s.hours,16);assert.equal(s.kind,'low');assert.equal(s.note,'疲れた');assert.equal(s.id,'2');});
test('連続した同種記録・片方のみは区間を推測しない',()=>{assert.equal(intervals([e('1','bed','2026-11-01T22:00')]).length,0);assert.equal(intervals([e('1','bed','2026-11-01T22:00'),e('2','bed','2026-11-02T22:00')]).length,0);});
test('月境界と複数日をまたぐ区間',()=>{const data=[e('1','bed','2026-10-31T22:00'),e('2','wake','2026-11-02T06:00')];assert.equal(segmentsForDay(data,'2026-11-01')[0].hours,24);assert.equal(segmentsForDay(data,'2026-11-02')[0].hours,6);});
test('JSONの往復・不正な日時とIDと気分の拒否',()=>{const data=[e('1','bed','2026-11-01T22:00')];assert.deepEqual(importData(JSON.parse(JSON.stringify({version:2,events:data}))),data);for(const change of [{at:'2026-02-30T22:00'},{at:'2026-11-01T25:00'},{mood:'constructor'},{note:null}])assert.throws(()=>validateEvents([{...data[0],...change}]));assert.throws(()=>validateEvents([...data,...data]));});
test('旧カレンダーの時刻と昼寝を保持・時刻なし記録は通知対象',()=>{const data=importData({version:1,records:{'2026-11-01':{wake:'06:00',bed:'22:00',napStart:'13:00',napEnd:'14:00',mood:'steady',note:'メモ'}}});assert.equal(data.length,4);assert.equal(data[2].type,'bed');assert.equal(data[3].at,'2026-11-01T14:00');assert.throws(()=>importData({version:1,records:{'2026-11-01':{wake:'',bed:'',mood:'steady',note:'メモ'}}}),/時刻がありません/);});
test('旧形式の午前就寝は翌日に移し、コメントは就寝のみ',()=>{
 const records={'2026-10-31':{wake:'06:00',bed:'00:30',napStart:'04:00',napEnd:'05:00',mood:'down',note:'記録'}};
 const data=importData({version:1,records});
 assert.equal(data.find(e=>e.id.endsWith('-bed')).at,'2026-11-01T00:30');
 assert.equal(data.find(e=>e.id.endsWith('-napStart')).at,'2026-10-31T04:00');
 assert.equal(data.filter(e=>e.note).length,1);
 assert.ok(data.filter(e=>e.type==='wake').every(e=>e.note===''));
 const nap=importData({version:1,records:{'2026-11-01':{wake:'06:00',bed:'',napStart:'13:00',napEnd:'14:00',mood:'steady',note:'昼寝'}}});
 assert.equal(nap.find(e=>e.id.endsWith('-napStart')).note,'昼寝');
});
test('日跨ぎ睡眠の表示用合計時間は帯の分割後も保持する',()=>{
 const data=[e('1','bed','2026-11-01T22:00'),e('2','wake','2026-11-02T06:00')];
 for(const day of ['2026-11-01','2026-11-02'])assert.equal(segmentsForDay(data,day)[0].totalHours,8);
 const long=[e('1','bed','2026-10-31T22:00'),e('2','wake','2026-11-02T06:00')];
 for(const day of ['2026-10-31','2026-11-01','2026-11-02'])assert.equal(segmentsForDay(long,day)[0].totalHours,32);
});
test('日跨ぎ覚醒は起床から就寝までの合計時間と気分を保持する',()=>{
 const data=[e('1','wake','2026-11-01T10:00'),e('2','bed','2026-11-02T02:00','up','活動した')];
 const first=segmentsForDay(data,'2026-11-01')[0],second=segmentsForDay(data,'2026-11-02')[0];
 assert.equal(first.hours,14);assert.equal(second.hours,2);
 for(const s of [first,second]){assert.equal(s.totalHours,16);assert.equal(s.kind,'up');assert.equal(s.note,'活動した');}
});
