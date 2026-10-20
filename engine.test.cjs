'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const enginePath = require('node:path').join(__dirname, 'engine.js');
let TD = require(enginePath);
const fresh = () => new TD.Game();
const advance = (g, seconds, step=0.05) => { for(let t=0;t<seconds-1e-8;t+=step) g.update(Math.min(step,seconds-t)); };
test('every wave adds exactly four enemies, beginning with eight', () => {
  for(let n=1;n<=30;n++) assert.equal(TD.waveInfo(n).count,8+4*(n-1));
});
test('combatEnd runs once at each actual ready, won or lost transition without visual updates', () => {
  for(const status of ['ready','won','lost']) {
    const g=fresh();g.build('charmander',0);g.startWave();g._remaining=0;
    if(status==='won')g.maxWaves=1;
    if(status==='lost') {g.hp=1;g.enemies=[{id:99,dex:19,hp:100,maxHp:100,progress:100000,speed:0,slow:0}];}
    g.effects.push({life:10});g.towers[0].cooldown=3;
    let ends=0;
    g.combatEnd=(state,game)=>{ends++;assert.equal(state,status);assert.equal(game,g);assert.equal(game.status,status);assert.equal(game.effects.length,0);assert.equal(game.towers[0].cooldown,0);};
    g.update(0.01);assert.equal(g.status,status);assert.equal(ends,1);
    g.update(2);assert.equal(ends,1);
  }
});
test('waves spawn gradually with complete enemy records and follow the winding path', () => {
  for(let n=1;n<=15;n++) {
    const info=TD.waveInfo(n); assert.ok(Number.isInteger(info.count) && info.count>0);
    assert.equal(info.boss,n%5===0); assert.ok(info.title.length>0);
  }
  const g=fresh(); assert.equal(g.startWave(),true); assert.equal(g.wave,1); assert.equal(g.status,'wave');
  assert.equal(g.startWave(),false); g.update(0.05);
  assert.equal(g.enemies.length,1);
  const e=g.enemies[0];
  for(const k of ['id','dex','x','y','hp','maxHp','progress','speed','boss','slow']) assert.notEqual(e[k],undefined,k);
  assert.ok(e.speed>0 && e.maxHp>0); assert.equal(e.hp,e.maxHp); assert.equal(e.boss,false);
  const p=e.progress; advance(g,1); assert.ok(e.progress>p); assert.equal(e.y,150);
  assert.ok(g.enemies.length>1 && g.enemies.length<TD.waveInfo(1).count);
  advance(g,250/e.speed); assert.ok(e.y>150); assert.equal(e.x,220);
});
function arena(type, progresses=[150,140,130,20]) {
  const g=fresh(); g.build(type,0); g.startWave(); g.update(0.01);
  g.towers[0].cooldown=0; g.effects=[];
  g.enemies=progresses.map((progress,i)=>({id:100+i,dex:19,x:progress-30,y:150,hp:1000,maxHp:1000,progress,speed:0,boss:false,slow:0}));
  return g;
}
test('large updates preserve spawning, cooldown damage and movement like small steps', () => {
  const a=fresh(), b=fresh();
  for(const g of [a,b]) { g.build('piplup',0); g.build('squirtle',1); g.startWave(); }
  a.update(8); advance(b,8,0.01);
  assert.equal(a.kills,b.kills); assert.equal(a.gold,b.gold); assert.equal(a.enemies.length,b.enemies.length);
  for(let i=0;i<a.enemies.length;i++) {
    assert.equal(a.enemies[i].id,b.enemies[i].id);
    assert.ok(Math.abs(a.enemies[i].progress-b.enemies[i].progress)<1e-6);
    assert.ok(Math.abs(a.enemies[i].hp-b.enemies[i].hp)<1e-6);
  }
  const c=fresh(); c.startWave(); c.update(120); assert.equal(c.status,'ready'); assert.equal(c.hp,12);
});
test('invalid and zero delta times are no-ops in every live state', () => {
  const g=arena('piplup'); g.update(0.01);
  for(const dt of [0,-1,NaN,Infinity,-Infinity,undefined,null,'1']) {
    const before=JSON.stringify(g); g.update(dt); assert.equal(JSON.stringify(g),before,String(dt));
  }
});
test('fifteen cleared waves win, reject further actions and freeze all terminal state', () => {
  const g=fresh(); g.build('piplup',0); const tower=g.towers[0];
  for(let wave=1;wave<=15;wave++) {
    assert.equal(g.startWave(),true);
    for(let i=0;i<2000 && g.status==='wave';i++) { g.update(0.05); for(const e of g.enemies) e.hp=0; }
    assert.equal(g.wave,wave); assert.equal(g.status,wave===15 ? 'won' : 'ready');
  }
  assert.equal(g.hp,20); assert.equal(g.kills,Array.from({length:15},(_,i)=>TD.waveInfo(i+1).count).reduce((a,b)=>a+b,0));
  for(const status of ['won','lost']) {
    g.status=status; g.effects.push({life:1,maxLife:1});
    const state=JSON.stringify(g); g.update(1);
    assert.equal(g.startWave(),false); assert.equal(g.build('piplup',1),false);
    assert.equal(g.upgrade(tower.id),false); assert.equal(g.sell(tower.id),false);
    assert.equal(JSON.stringify(g),state);
  }
});
test('every fifth wave contains exactly one stronger boss that leaks four health', () => {
  for(const n of [5,10,15]) {
    const g=fresh(); g.wave=n-1; g.startWave();
    for(let i=0;i<TD.waveInfo(n).count*18;i++) {
      g.update(0.05); for(const e of g.enemies) { e.originalSpeed ??= e.speed; e.speed=0; }
    }
    for(const e of g.enemies) e.speed=e.originalSpeed;
    assert.equal(g.enemies.length,TD.waveInfo(n).count);
    const bosses=g.enemies.filter(e=>e.boss); assert.equal(bosses.length,1);
    const boss=bosses[0], normal=g.enemies.find(e=>!e.boss);
    assert.ok(boss.maxHp>normal.maxHp*3); assert.ok(boss.speed<normal.speed);
    boss.progress=100000; g.update(0.01); assert.equal(g.hp,16);
    assert.equal(g.kills,0);
  }
});
test('leaks damage the house, never count as kills and stop simulation on defeat', () => {
  const g=fresh(); g.startWave(); g.update(0.01);
  const e=g.enemies[0]; e.progress=100000; g.update(0.01);
  assert.equal(g.hp,19); assert.equal(g.kills,0); assert.equal(g.enemies.length,0);
  advance(g,200); assert.equal(g.hp,12); assert.equal(g.status,'ready');
  g.hp=1; g.startWave(); advance(g,200);
  assert.equal(g.status,'lost'); assert.equal(g.hp,0);
  const state=JSON.stringify(g); g.update(100); assert.equal(JSON.stringify(g),state);
  assert.equal(g.startWave(),false);
});
test('kills award gold once, remove corpses and completion awards wave income once', () => {
  const g=arena('piplup',[150]); g.enemies[0].hp=1;
  const gold=g.gold; g.update(0.01);
  assert.equal(g.kills,1); assert.equal(g.enemies.length,0); assert.ok(g.gold>gold);
  const afterKill=g.gold; advance(g,0.2); assert.equal(g.gold,afterKill); assert.equal(g.status,'wave');
  g.towers=[];
  for(let i=0;i<2000 && g.status==='wave';i++) {
    for(const e of g.enemies) e.hp=0;
    g.update(0.05);
  }
  assert.equal(g.status,'ready'); assert.equal(g.kills,TD.waveInfo(1).count);
  assert.ok(g.gold>afterKill); const completeGold=g.gold;
  advance(g,20); assert.equal(g.gold,completeGold);
});
test('fallback ranged attacks do not invent poison, chain, splash or slow effects',()=>{
  for(const d of TD.catalog){const g=arena(d.id,[150,140,130]);g.update(.01);assert.ok(g.enemies[0].hp<1000,d.id);assert.equal(g.enemies[1].hp,1000);assert.equal(g.enemies[0].slow,0);assert.equal(g.enemies[0].poison,undefined);}
});
test('attacks prioritize furthest enemy in range, respect cooldowns and create fading effects', () => {
  const g=fresh(); g.build('piplup',0); const t=g.towers[0];
  g.startWave(); g.update(0.01);
  const make=(id,progress)=>({id,dex:19,x:-30+progress,y:150,hp:1000,maxHp:1000,progress,speed:0,boss:false,slow:0});
  g.enemies=[make(101,130),make(102,155),make(103,800)];t.cooldown=0;g.effects=[];
  g.update(0.01);
  assert.equal(g.enemies[0].hp,1000); assert.equal(g.enemies[1].hp,988); assert.equal(g.enemies[2].hp,1000);
  assert.ok(t.cooldown>0); assert.equal(g.effects.length,1);
  const fx=g.effects[0];
  for(const k of ['x','y','tx','ty','color','life','maxLife','kind']) assert.notEqual(fx[k],undefined,k);
  assert.equal(fx.x,t.x); assert.equal(fx.ty,150); assert.ok(fx.life>0 && fx.life<=fx.maxLife);
  g.update(0.1); assert.equal(g.enemies[1].hp,988); assert.ok(fx.life<fx.maxLife);
  advance(g,0.4); assert.equal(g.enemies[1].hp,976);
  g.enemies=[]; g.status='ready'; advance(g,1); assert.equal(g.effects.length,0);
});
test('building, upgrading and selling obey prices, pad ownership and selection', () => {
  const g=fresh(), def=TD.catalog[0];
  for (const pad of [-1,14,0.5,'0',NaN]) assert.equal(g.build(def.id,pad),false);
  assert.equal(g.build('invalid',0),false);
  assert.equal(g.build(def.id,0),true);
  const t=g.towers[0];
  assert.equal(g.selectedId,t.id); assert.equal(t.type,def.id); assert.equal(t.pad,0);
  assert.equal(t.x,TD.pads[0].x); assert.equal(t.y,TD.pads[0].y);
  assert.equal(t.level,1); assert.equal(t.spent,def.cost); assert.equal(t.cooldown,0);
  assert.equal(g.gold,420-def.cost); assert.equal(g.build(def.id,0),false);
  const s=TD.stats(t);
  assert.equal(s.damage,def.damage); assert.equal(s.range,def.range); assert.equal(s.rate,def.rate);
  assert.ok(s.upgradeCost>0); assert.equal(s.sellValue,Math.floor(t.spent*0.7));
  assert.equal(g.upgrade('invalid'),false); assert.equal(g.sell('invalid'),false);
  assert.equal(g.upgrade(t.id),true); assert.equal(t.level,2);
  assert.equal(t.spent,def.cost+s.upgradeCost); assert.equal(g.gold,420-t.spent);
  const upgraded=TD.stats(t);
  assert.ok(upgraded.damage>s.damage && upgraded.range>s.range && upgraded.rate>s.rate);
  g.gold=0; assert.equal(g.upgrade(t.id),false); assert.equal(g.build(def.id,1),false);
  assert.equal(g.sell(t.id),true); assert.equal(g.gold,upgraded.sellValue);
  assert.equal(g.towers.length,0); assert.equal(g.selectedId,null); assert.equal(g.sell(t.id),false);
  assert.equal(TD.stats({type:'bad',level:1}),null);
});
test('reset clears pending wave timers and restores deterministic restart state', () => {
  const g=fresh(); g.build('treecko',0); g.startWave(); g.update(2); g.reset();
  const other=fresh(); assert.deepEqual(g,other);
  for(const game of [g,other]) { game.build('fennekin',0); game.startWave(); game.update(5); }
  assert.deepEqual(g,other);
});
test('new game and reset restore all public state without sharing arrays', () => {
  const g = fresh();
  assert.equal(g.gold,420); assert.equal(g.hp,20); assert.equal(g.wave,0);
  assert.equal(g.maxWaves,15); assert.equal(g.status,'ready'); assert.equal(g.kills,0);
  assert.equal(g.selectedId,null);
  for (const k of ['towers','enemies','effects']) assert.deepEqual(g[k],[]);
  g.gold=0; g.hp=1; g.wave=12; g.kills=99; g.status='lost'; g.selectedId=3;
  g.towers.push({}); g.enemies.push({}); g.effects.push({}); g.reset();
  assert.equal(g.gold,420); assert.equal(g.hp,20); assert.equal(g.wave,0);
  assert.equal(g.kills,0); assert.equal(g.status,'ready'); assert.equal(g.selectedId,null);
  for (const k of ['towers','enemies','effects']) assert.deepEqual(g[k],[]);
  assert.notEqual(g.towers,fresh().towers);
});
test('exports the catalog, winding path and fourteen usable pads in Node and browser', () => {
  assert.ok(fs.existsSync(enginePath), 'engine.js exists');
  TD = require(enginePath);
  assert.equal(TD.catalog.length, 6);
  assert.deepEqual(TD.catalog.map(t => t.dex), [252,4,7,25,393,653]);
  for (const t of TD.catalog) {
    for (const key of ['id','name','dex','cost','damage','range','rate','color','role']) assert.ok(t[key] !== undefined, key);
    for (const key of ['cost','damage','range','rate']) assert.ok(t[key] > 0);
  }
  assert.deepEqual(TD.path.at(-1), {x:835,y:295});
  assert.equal(TD.pads.length, 14);
  assert.equal(new Set(TD.pads.map(p => `${p.x},${p.y}`)).size,14);
  for (const p of TD.pads) assert.ok(p.x>0 && p.x<960 && p.y>0 && p.y<640);
  const context = {window:{}};
  vm.runInNewContext(fs.readFileSync(enginePath,'utf8'), context);
  assert.equal(context.window.TD.catalog.length,6);
});

test('enemy stages introduce sixty source species with deterministic wave composition',()=>{
  assert.ok(TD.enemyDex.length>=60);
  const seen=new Set();
  for(let n=1;n<=15;n++){
    const g=fresh();g.hp=1000;g.wave=n-1;g.startWave();for(let i=0;i<5500;i++){g.update(.01);for(const e of g.enemies)e.speed=0;}
    const all=g.enemies.map(e=>e.dex);for(const d of all)seen.add(d);
    assert.ok(new Set(all.filter(d=>![95,149,150].includes(d))).size>=7,`wave ${n} variety`);
    assert.equal(all.length,TD.waveInfo(n).count);
    for(const d of all) assert.ok(TD.enemyDex.includes(d));
    const next=fresh();next.hp=1000;next.wave=n-1;next.startWave();for(let i=0;i<5500;i++){next.update(.01);for(const e of next.enemies)e.speed=0;}
    assert.deepEqual(next.enemies.map(e=>e.dex),all);
  }
  assert.ok(seen.size>=60,seen.size);
});
