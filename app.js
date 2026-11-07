'use strict';
const $ = id => document.getElementById(id);
const COLORS = {sleep:'var(--sleep)',high:'var(--high)',up:'var(--up)',steady:'var(--steady)',down:'var(--down)',low:'var(--low)'};
const KEY = 'mood-sleep-graph-v2';
let events = [], healthy = true, selected = null;
const now = new Date(); let month = new Date(now.getFullYear(),now.getMonth(),1);
function notice(message) { $('notice').textContent=message; $('notice').hidden=!message; }
try { const raw=localStorage.getItem(KEY); if(raw) events=validateEvents(JSON.parse(raw)); }
catch { healthy=false; notice('保存データを読み込めませんでした。上書きを防ぐため保存を停止しています。JSONをインポートして復元してください。'); }
function persist(next,restore=false) {
  if(!healthy&&!restore) { $('form-error').textContent='保存データを読み込めていません。JSONから復元してください。'; return false; }
  try { next=validateEvents(next); localStorage.setItem(KEY,JSON.stringify(next)); events=next; healthy=true; notice(''); return true; }
  catch(e) { $('form-error').textContent='保存できませんでした。保存設定・空き容量を確認してください。'; notice('保存できませんでした。保存設定・空き容量を確認してください。'); return false; }
}
function el(tag,cls,text) { const node=document.createElement(tag); node.className=cls; if(text!==undefined) node.textContent=text; return node; }
function hours(n) { return `${Number(n.toFixed(1))}時間`; }
function dayKey(d) { return localTime(d).slice(0,10); }
for(const [key,label] of Object.entries({sleep:'睡眠',...MOODS})) {
 const item=el('span','',label), swatch=el('i','swatch'); swatch.style.setProperty('--color',COLORS[key]); item.prepend(swatch); $('legend').append(item);
}
for(const [key,label] of Object.entries(MOODS)) {
 const item=el('label',key,label), radio=document.createElement('input'); radio.type='radio';radio.name='mood';radio.value=key;radio.checked=key==='steady';item.style.setProperty('--color',COLORS[key]);item.prepend(radio);$('moods').append(item);
}
function render() {
 $('month-title').textContent=`${month.getFullYear()}年 ${month.getMonth()+1}月`; $('rows').replaceChildren();
 const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 for(let day=1;day<=days;day++) {
  const date=new Date(month.getFullYear(),month.getMonth(),day), key=dayKey(date), row=el('div',`day-row${key===dayKey(new Date())?' current':''}`);
  const label=el('button','day-label',`${month.getMonth()+1}/${day}`);label.append(el('small','',['日','月','火','水','木','金','土'][date.getDay()]));label.setAttribute('aria-label',`${key} の記録を追加`);label.onclick=()=>openEditor(null,`${key}T22:00`);
  const track=el('div','track');
  for(const s of segmentsForDay(events,key)) {
   const text=`${hours(s.totalHours)}${s.note?' · '+s.note:''}`, bar=el('button',`segment ${s.kind}`,text);bar.style.left=`${s.left}%`;bar.style.width=`${s.width}%`;bar.style.setProperty('--color',COLORS[s.kind]);
   bar.title=`${key} ${s.kind==='sleep'?'睡眠':MOODS[s.kind]} ${text}`;bar.setAttribute('aria-label',`${bar.title}、記録を編集`);bar.onclick=()=>openEditor(events.find(e=>e.id===s.id));track.append(bar);
  }
  row.append(label,track);$('rows').append(row);
 }
 $('timeline').replaceChildren();
 const sorted=[...events].sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 const items=[...sorted].reverse();
 for(const e of items) {
  const date=new Date(e.at), button=el('button','entry'), icon=el('span','entry-icon',e.type==='bed'?'🌙':'☀️'), body=el('div','entry-main');icon.setAttribute('aria-hidden','true');
  body.append(el('strong','',`${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()} ${e.at.slice(11)} ${e.type==='bed'?'就寝':'起床'}`));
  const meta=el('div','entry-meta');
  const i=sorted.indexOf(e),prev=sorted[i-1]; if(prev&&prev.type!==e.type&&prev.at!==e.at) meta.append(el('span','',`${e.type==='bed'?'覚醒':'睡眠'} ${hours((date-new Date(prev.at))/3600000)}`));
  body.append(meta);
  if(e.type==='bed'||e.note) {
   const comment=el('p','entry-comment');
   if(e.type==='bed') {const badge=el('span','badge',MOODS[e.mood]);badge.style.setProperty('--color',COLORS[e.mood]);comment.append(badge);}
   if(e.note)comment.append(document.createTextNode(e.note));
   body.append(comment);
  }
  button.append(icon,body);button.onclick=()=>openEditor(e);$('timeline').append(button);
 }
 if(!items.length) { const empty=el('div','empty','まだ記録がありません。\n起床・就寝から、日々のリズムを記録しましょう。');const add=el('button','primary','最初の記録を追加');add.onclick=()=>openEditor();empty.append(add);$('timeline').append(empty); }
}
function updateType() { $('mood-field').hidden=document.querySelector('[name=type]:checked').value==='wake'; }
function openEditor(record=null, at=localTime(new Date())) {
 selected=record?.id||null;$('form').reset();$('form-error').textContent='';$('edit-title').textContent=record?'記録を編集':'記録を追加';$('at').value=record?.at||at;
 document.querySelector(`[name=type][value=${record?.type||'bed'}]`).checked=true;document.querySelector(`[name=mood][value=${record?.mood||'steady'}]`).checked=true;$('note').value=record?.note||'';$('delete').hidden=!record;updateType();$('editor').showModal();
}
document.querySelectorAll('[name=type]').forEach(r=>r.onchange=updateType);
$('add').onclick=()=>openEditor();$('close').onclick=()=>$('editor').close();
$('form').onsubmit=e=>{e.preventDefault();const record={id:selected||crypto.randomUUID(),at:$('at').value,type:document.querySelector('[name=type]:checked').value,mood:document.querySelector('[name=mood]:checked').value,note:$('note').value.trim()};
 try { validateEvents([record]);if(events.some(e=>e.id!==record.id&&e.at===record.at))throw Error('同じ日時の記録があります。既存の記録を編集してください。'); }catch(error){$('form-error').textContent=error.message;return;}
 if(persist([...events.filter(e=>e.id!==selected),record])){month=new Date(new Date(record.at).getFullYear(),new Date(record.at).getMonth(),1);render();$('editor').close();}
};
$('delete').onclick=()=>{if(confirm('この記録を削除しますか？')&&persist(events.filter(e=>e.id!==selected))){render();$('editor').close();}};
$('prev').onclick=()=>{month.setMonth(month.getMonth()-1);render();};$('next').onclick=()=>{month.setMonth(month.getMonth()+1);render();};$('today').onclick=()=>{const d=new Date();month=new Date(d.getFullYear(),d.getMonth(),1);render();};
function view(name) { for(const v of ['graph','timeline']) { $(`${v}-view`).hidden=v!==name;$(`${v}-tab`).toggleAttribute('aria-current',v===name);if(v===name)$(`${v}-tab`).setAttribute('aria-current','page'); } }
$('graph-tab').onclick=()=>view('graph');$('timeline-tab').onclick=()=>view('timeline');
$('export').onclick=()=>{
 if(!healthy){notice('保存データを読み込めていないためエクスポートできません。');return;}
 const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,events},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`躁鬱睡眠グラフ-${dayKey(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try {if(file.size>5000000)throw Error('ファイルは5MB以下にしてください。');const incoming=importData(JSON.parse(await file.text()));
 const merged=new Map(events.map(e=>[e.id,e]));for(const item of incoming)merged.set(item.id,item);
 const all=[...merged.values()];const times=new Set();for(const item of all){if(times.has(item.at))throw Error('同じ日時に複数の記録があります。JSON内の重複を解消してください。');times.add(item.at);}
 if(!confirm(`${incoming.length}件を取り込みます。同じIDの記録は上書きされます。よろしいですか？`))return;
 if(persist(all,true)){if(incoming.length){const d=new Date([...incoming].sort((a,b)=>b.at.localeCompare(a.at))[0].at);month=new Date(d.getFullYear(),d.getMonth(),1);}render();notice(`${incoming.length}件の記録を取り込みました。`);}
 }catch(error){notice(`インポートできませんでした：${error.message}`);}finally{e.target.value='';}
};
render();
