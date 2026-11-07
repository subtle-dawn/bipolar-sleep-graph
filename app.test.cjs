const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup() {
 class Element {
  constructor(){this.children=[];this.attributes={};this.style={setProperty(){}};this.value='';}
  append(...nodes){this.children.push(...nodes);}
  prepend(...nodes){this.children.unshift(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(key,value){this.attributes[key]=value;}
  getAttribute(key){return this.attributes[key];}
  toggleAttribute(key,on){if(on)this.attributes[key]='';else delete this.attributes[key];}
  reset(){} showModal(){this.open=true;} close(){this.open=false;}
 }
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const context=vm.createContext({
  document:{getElementById:get,createElement:()=>new Element(),createTextNode:text=>({textContent:text}),querySelectorAll:()=>[],querySelector:get},
  localStorage:{getItem:()=>null},console
 });
 vm.runInContext(fs.readFileSync('model.js','utf8'),context);
 vm.runInContext(fs.readFileSync('app.js','utf8'),context);
 return {get,run:code=>vm.runInContext(code,context)};
}

test('calendar shows every daily record chronologically with mood and notes',()=>{
 const {get,run}=setup();
 run(`month=new Date(2026,10,1);events=[
 {id:'4',type:'bed',at:'2026-11-02T22:00',mood:'low',note:'evening'},
 {id:'2',type:'bed',at:'2026-11-02T13:00',mood:'steady',note:'nap'},
 {id:'1',type:'wake',at:'2026-11-02T07:00',mood:'steady',note:'morning'},
 {id:'3',type:'wake',at:'2026-11-02T14:00',mood:'steady',note:''}];render();`);
 const cells=get('calendar').children;
 assert.equal(cells.length,35);
 const records=cells[1].children.slice(1);
 assert.equal(records.length,4);
 assert.deepEqual(records.map(n=>n.children.find(c=>c.className.startsWith('calendar-time')).textContent),['☀️ 07:00','🌙 13:00','☀️ 14:00','🌙 22:00']);
 assert.equal(records[1].children[0].textContent,'安定');
 assert.equal(records[2].children.length,1);
 assert.equal(records[1].children[2].textContent,'nap');
 records[1].onclick();
 assert.equal(get('at').value,'2026-11-02T13:00');
 assert.equal(get('edit-title').textContent,'🌙就寝を編集');
});

test('calendar includes adjacent months and date buttons add on the chosen day',()=>{
 const {get,run}=setup();run('month=new Date(2026,7,1);render();');
 const cells=get('calendar').children;
 assert.equal(cells.length,42);
 assert.ok(cells[0].className.includes('outside'));
 assert.equal(cells[0].children.length,1);
 const before=run('localTime(new Date()).slice(11)');
 cells[0].children[0].onclick();assert.equal(get('at').value.slice(0,11),'2026-07-26T');
 assert.ok([before,run('localTime(new Date()).slice(11)')].includes(get('at').value.slice(11)));
 get('calendar-next').onclick();assert.equal(get('calendar-month').textContent,'2026年 9月');
 assert.equal(get('month-title').textContent,'2026年 9月');
});

test('navigation switches among calendar, graph and timeline',()=>{
 const {get}=setup();
 for(const name of ['calendar','graph','timeline']) {
  get(`${name}-tab`).onclick();
  for(const other of ['calendar','graph','timeline'])assert.equal(get(`${other}-view`).hidden,other!==name);
  assert.equal(get(`${name}-tab`).getAttribute('aria-current'),'page');
 }
});

test('header addition defaults to wake and alternates from the latest record',()=>{
 const {get,run}=setup();
 for(const [records,expected] of [
  [[], 'wake'],
  [[{id:'1',type:'wake',at:'2026-11-02T07:00'}], 'bed'],
  [[{id:'2',type:'bed',at:'2026-11-02T22:00'},{id:'1',type:'wake',at:'2026-11-02T07:00'}], 'wake']
 ]) {
  get('[name=type][value=wake]').checked=false;get('[name=type][value=bed]').checked=false;
  run(`events=${JSON.stringify(records)};`);
  get('add').onclick();
  assert.equal(get('editor').open,true);
  assert.equal(get(`[name=type][value=${expected}]`).checked,true);
  assert.equal(get(`[name=type][value=${expected==='wake'?'bed':'wake'}]`).checked,false);
 }
});

test('calendar addition uses only the latest record of the selected day',()=>{
 const {get,run}=setup();
 for(const [records,expected] of [
  [[], 'wake'],
  [[{id:'1',type:'wake',at:'2026-11-02T07:00'}], 'bed'],
  [[{id:'2',type:'bed',at:'2026-11-02T22:00'},{id:'1',type:'wake',at:'2026-11-02T07:00'}], 'wake'],
  [[{id:'1',type:'wake',at:'2026-11-03T07:00'}], 'wake'],
  [[{id:'1',type:'wake',at:'2026-11-02T07:00'},{id:'2',type:'bed',at:'2026-11-03T22:00'}], 'bed']
 ]) {
  get('[name=type][value=wake]').checked=false;get('[name=type][value=bed]').checked=false;
  run(`month=new Date(2026,10,1);events=${JSON.stringify(records.map(e=>({...e,mood:'steady',note:''})))};render();`);
  get('calendar').children[1].children[0].onclick();
  assert.equal(get(`[name=type][value=${expected}]`).checked,true);
  assert.equal(get(`[name=type][value=${expected==='wake'?'bed':'wake'}]`).checked,false);
 }
});
