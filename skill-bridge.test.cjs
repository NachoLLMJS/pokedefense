'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = __dirname;
const ORIGINAL = path.join(ROOT, '../PokeSurvivor/js');
const MODULES = ['core/sprites.js','data/types.js','data/pokedex.js','data/moves.js','data/starters.js','entities/vfx.js','entities/fx.js','entities/projectile.js','systems/combat.js'];
function load() {
  const c = {console, performance, setTimeout, Date, Math: Object.create(Math)};
  c.Math.random = () => 0.5;
  c.window = c;
  vm.createContext(c);
  for (const f of ['source/core/util.js','sprite-meta.js', ...MODULES.map(f=>'source/'+f),'engine.js','skill-bridge.js']) {
    assert.ok(fs.existsSync(path.join(ROOT,f)), `Required real combat integration file missing: ${f}`);
    vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),c,{filename:f});
  }
  c.RescueSkills.configureCatalog(c.TD);
  return c;
}
function arena(c, type='charmander', progress=180) {
  c.G.World={projectileBlock:()=>false,propsInCircle:()=>[],isWall:()=>false};
  const g=new c.TD.Game(); g.gold=10000; g.build(type,0); g.startWave(); g._remaining=0;
  const e={id:99,dex:133,x:150,y:150,hp:1000,maxHp:1000,progress,speed:0,slow:0,boss:false};
  g.enemies=[e];
  return {g,e,t:g.towers[0]};
}
test('target priority cannot select an unreachable enemy outside the original projectile acquisition limit', () => {
  const c=load(),{g,e,t}=arena(c,'pikachu');
  t.x=673;t.y=150;e.progress=520;
  g.enemies.push({...e,id:100,progress:500});
  const b=c.RescueSkills.install(g);g.update(0.01);
  assert.equal(c.G.Projectiles.count,1,'a valid nearer target must not be starved by the 520px source target gate');
  assert.equal(b.actor(t.id).target.id,100);
});

test('projectile upgrades extend real travel range without changing canonical speed or visual identity', () => {
  const c=load(),{g,t}=arena(c,'charmander'),b=c.RescueSkills.install(g);
  g.upgrade(t.id);g.update(0.01);
  const p=c.G.Projectiles.all()[0],m=b.actor(t.id).move;
  assert.equal(p.vx*p.vx+p.vy*p.vy,m.speed*m.speed);
  assert.ok(Math.abs(p.life*m.speed-c.TD.stats(t).range)<1e-9);
  assert.equal(p.vis.proj,'fire');assert.equal(p.dmg,18*1.55);
});

test('all six defenders execute canonical source moves and lethal source hits reward only once', () => {
  for(const type of ['treecko','charmander','squirtle','pikachu','piplup','fennekin']) {
    const c=load(),{g,e,t}=arena(c,type),b=c.RescueSkills.install(g);
    t.x=180;t.y=150;e.hp=e.maxHp=1;
    const a=b.actor(t.id), expected=c.G.startMoveOf(a.dex);
    let ticks=0;const tick=c.G.Combat.tick;
    c.G.Combat.tick=(...args)=>{ticks++;tick(...args);};
    g.update(0.2);
    assert.equal(a.move.id,expected,type);assert.ok(ticks>0,type);
    assert.equal(g.kills,1,type);assert.equal(g.enemies.length,0,type);
    const gold=g.gold;g.update(0.3);assert.equal(g.gold,gold,type);
    assert.equal(g.effects.length,0,type);
    assert.equal(a.anim.cur,'Idle',type);assert.ok(['projectile','boomerang','nova'].includes(a.move.kind),type);
  }
});

test('combat uses scoped translated read-only world, preserves original renderer and filters dead enemies', () => {
  const c=load(),{g,e}=arena(c),b=c.RescueSkills.install(g),queries=[];
  const originalWorld={
    projectileBlock(x,y,r){queries.push([x,y,r]);return false;},
    propsInCircle(){throw Error('combat must not consume original props');},
    damageProp(){throw Error('combat must not damage original terrain');},
    draw(){return 'original renderer';}
  };
  c.G.World=originalWorld;
  c.RescueMap={toWorld:(x,y)=>({x:x-480,y:y-320})};
  const manager={unrelated:true};c.G.EnemyMgr=manager;
  g.enemies.push({...e,id:100,hp:0});
  let seen;
  const tick=c.G.Combat.tick;
  c.G.Combat.tick=(...args)=>{seen=c.G.EnemyMgr.all();tick(...args);};
  g.update(0.01);
  assert.equal(seen.length,1);
  const p=c.G.Projectiles.all()[0];
  assert.equal(queries[0][0],p.x-480);assert.equal(queries[0][1],p.y-320);
  assert.equal(c.G.World,originalWorld);assert.equal(c.G.EnemyMgr,manager);
  assert.equal(c.G.World.draw(),'original renderer');
  const all=c.G.Projectiles.all;
  c.G.Combat.resolve=()=>{throw Error('test combat failure');};
  assert.throws(()=>g.update(0.01),/test combat failure/);
  assert.equal(c.G.Projectiles.all,all);assert.equal(c.G.World,originalWorld);assert.equal(c.G.EnemyMgr,manager);
});

test('Water Gun and Thunder Shock retain original projectile shapes and piercing rather than slow or chain', () => {
  for(const [type,shape,pierce] of [['squirtle','drop',1],['pikachu','bolt',2]]) {
    const c=load(),{g,e,t}=arena(c,type),b=c.RescueSkills.install(g);
    t.x=100;t.y=150;
    g.enemies.push({...e,id:100,progress:220});
    g.update(0.01);
    const p=c.G.Projectiles.all()[0];
    assert.equal(p.vis.proj,shape);assert.equal(p.pierce,pierce);
    g.update(0.3);
    const d=b.actor(t.id).move.dmg;
    assert.equal(e.hp,1000-d);
    assert.equal(g.enemies[1].hp,1000-d);
    assert.equal(e.slow,0);assert.equal(g.effects.length,0);
  }
});

test('selling cleans actor-owned attacks and reset cannot reuse old animation or move cooldown state', () => {
  const c=load(),{g,t}=arena(c),b=c.RescueSkills.install(g);
  g.update(0.01);const old=b.actor(t.id);
  assert.equal(c.G.Projectiles.count,1);
  g.sell(t.id);g.update(0.01);
  assert.equal(b.actor(t.id),null);
  assert.equal(c.G.Projectiles.count,0,'removed defender attacks are discarded');
  g.reset();b.reset();
  assert.equal(c.G.Projectiles.count,0);assert.equal(c.G.FX.count,0);assert.equal(c.G.Combat.fieldCount,0);
  g.build('charmander',0);
  const next=b.actor(g.towers[0].id);
  assert.notEqual(next,old);assert.equal(next.move.t,0);assert.equal(next.anim.cur,'Idle');
});

test('multiple defenders resolve each original projectile exactly once with its actual owner', () => {
  const c=load(),{g,e,t}=arena(c,'squirtle');
  g.build('pikachu',1);const second=g.towers[1];second.x=t.x;second.y=t.y;
  const b=c.RescueSkills.install(g);g.update(0.3);
  assert.equal(e.hp,973,'one Water Gun plus one Thunder Shock, no fabricated chain');
  assert.equal(b.actor(t.id).dmgDealt,14);
  assert.equal(b.actor(second.id).dmgDealt,13);
  assert.equal(e.slow,0,'Water Gun does not carry fake defense slow');
  assert.equal(g.hp,20,'stationary defenders do not take contact damage');
});

test('casts preserve original sound API and do not replace a supplied audio wrapper', () => {
  const c=load(),{g}=arena(c,'squirtle'),shots=[];
  const audio={sfx:(...args)=>shots.push(args)};c.G.Audio=audio;
  c.RescueSkills.install(g);g.update(0.01);
  assert.equal(c.G.Audio,audio);
  assert.equal(shots.length,1);assert.equal(shots[0][0],'shot');
  assert.equal(shots[0][1].kind,'projectile');assert.equal(shots[0][1].type,'water');
});

test('burn and poison use source stack, tick and expiration rules without legacy poison corruption', () => {
  const c=load(),{g,e,t}=arena(c);
  const b=c.RescueSkills.install(g);
  for(let i=0;i<40 && e.hp===1000;i++) g.update(0.01);
  assert.equal(e.hp,982);assert.equal(e.burn,1);
  g.sell(t.id);g.update(0.01);
  assert.equal(e.hp,980,'source burn immediately ticks rounded 1.6 × 1.06');
  g.update(3.1);
  assert.equal(e.burn,0);
  const after=e.hp;g.update(1);assert.equal(e.hp,after,'burn expires');
  let adapted;
  const original=c.G.Combat.tick;
  c.G.Combat.tick=(...args)=>{adapted=c.G.EnemyMgr.all()[0];original(...args);};
  g.build('piplup',0);g.update(0.01);
  adapted.applyPoison(2);const hp=e.hp;g.update(0.01);
  assert.equal(e.hp,hp-25,'source poison tick: 1.2% max HP per stack plus one');
  assert.ok(Number.isFinite(e.hp));
  assert.equal(adapted.poison,2);
  g.update(4.1);assert.equal(adapted.poison,0);
});

test('visual API updates animation and original FX once, without advancing combat, and draws actual VFX', () => {
  const c=load(), {g,e,t}=arena(c);
  const calls=[];
  const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args]),set:(o,k,v)=>(o[k]=v,true)});
  c.document={createElement:()=>({getContext:()=>ctx})};
  c.Image=class {set src(value){this.width=256;this.height=256;if(this.onload)this.onload();}};
  const b=c.RescueSkills.install(g);
  g.update(0.01);
  const p=c.G.Projectiles.all()[0],px=p.x,hp=e.hp;
  const a=b.actor(t.id);
  let updates=0;const update=c.G.FX.update;
  c.G.FX.update=dt=>{updates++;update(dt);};
  b.updateVisuals(0.05);
  assert.equal(updates,1);assert.ok(a.anim.t>0 || a.anim.frame>0);
  assert.equal(p.x,px);assert.equal(e.hp,hp);
  let ground=0;const drawGround=c.G.Combat.drawGroundFields;
  c.G.Combat.drawGroundFields=ctx=>{ground++;drawGround(ctx);};
  b.drawGround(ctx);b.draw(ctx);a.anim.draw(ctx,a.x,a.y);
  assert.equal(ground,1);
  assert.ok(calls.some(c=>c[0]==='drawImage'),'original sprites and rasterized source VFX are drawn');
  assert.ok(calls.some(c=>c[0]==='fillRect'),'original VFX pixel atlas generated on canvas');
  assert.equal(p.x,px);assert.equal(e.hp,hp);
});

test('Treecko uses the original Razor Leaf projectile and ranged upgrades, not melee',()=>{
 const c=load(),{g,e,t}=arena(c,'treecko'),b=c.RescueSkills.install(g);g.update(.01);
 const a=b.actor(t.id),p=c.G.Projectiles.all()[0];
 assert.equal(a.move.id,'razor-leaf');assert.equal(a.move.kind,'boomerang');assert.equal(a.anim.cur,'Shoot');
 assert.ok(p && p.vis.proj==='leaf');assert.equal(e.hp,1000);
 g.upgrade(t.id);b.clearWave();g.update(.01);
 assert.equal(a.move.radius,c.TD.stats(t).range);
 assert.ok(Math.abs(a.cdMul-1/1.12)<1e-12);
});

test('real Ember flies before hitting and only source resolve can apply attack damage', () => {
  const c=load(), {g,e,t}=arena(c);
  const bridge=c.RescueSkills.install(g);
  g.update(0.01);
  assert.equal(e.hp,1000,'projectile is not instant legacy damage');
  assert.equal(c.G.Projectiles.count,1);
  const p=c.G.Projectiles.all()[0];
  assert.equal(p.vis.proj,'fire'); assert.equal(p.mtype,'fire');
  assert.equal(p.dmg,18); assert.equal(bridge.actor(t.id).anim.cur,'Shoot');
  const resolve=c.G.Combat.resolve;
  c.G.Combat.resolve=()=>{};
  g.update(0.25); assert.equal(e.hp,1000,'no adapter or legacy attack damage');
  c.G.Combat.resolve=resolve;
  bridge.reset(); t.cooldown=0;
  for(let i=0;i<40 && e.hp===1000;i++) g.update(0.01);
  assert.equal(e.hp,982,'one canonical Ember hit from original swept collision');
  assert.equal(e.burn,1,'original move applies burn through enemy adapter');
  assert.ok(bridge.actor(t.id).dmgDealt>=18);
  assert.equal(g.effects.length,0,'no bespoke defense beam effects');
});

test('engine callback exclusively owns attacks before normal death and reward accounting', () => {
  const {Game}=require('./engine.js');
  const g=new Game(); g.build('charmander',0); g.startWave(); g._remaining=0;
  const e={id:99,dex:19,x:100,y:150,hp:100,maxHp:100,progress:130,speed:0,slow:0,boss:false};
  g.enemies=[e]; let steps=0;
  g.combatStep=(dt,game)=>{ assert.equal(game,g); steps++; };
  g.update(0.01);
  assert.equal(steps,1,'simulation invokes source combat once per substep');
  assert.equal(e.hp,100,'legacy instant damage must not run alongside source combat');
  g.combatStep=()=>{e.hp=0;}; g.update(0.01);
  assert.equal(g.kills,1); assert.equal(g.enemies.length,0);
});

test('catalog derives all six canonical starter moves from byte-identical original modules', () => {
  const c = load();
  for (const f of MODULES) assert.deepEqual(fs.readFileSync(path.join(ROOT,'source',f)),fs.readFileSync(path.join(ORIGINAL,f)),f);
  const ids = ['razor-leaf','ember','water-gun','thunder-shock','bubble','ember'];
  c.TD.catalog.forEach((d,i) => {
    const m=c.G.Moves.instance(c.G.startMoveOf(d.dex));
    assert.equal(d.moveId,ids[i]);
    assert.equal(d.moveId,m.id);
    assert.equal(d.damage,m.dmg);
    assert.equal(d.rate,1/m.cd);
    assert.equal(d.range,m.radius || m.speed*m.life);
    assert.equal(d.moveKind,m.kind);assert.notEqual(m.kind,'melee');
    assert.ok(d.role.includes(d.moveName));
  });
});

test('Piplup Bubble upgrades extend original radial projectile travel without changing its eight-bubble pattern',()=>{
 const c=load(),{g,t}=arena(c,'piplup'),b=c.RescueSkills.install(g);g.upgrade(t.id);g.update(.01);
 const a=b.actor(t.id),shots=c.G.Projectiles.all();assert.equal(a.move.kind,'nova');assert.equal(shots.length,8);
 for(const p of shots){assert.equal(p.vis.proj,'bubble');assert.ok(Math.abs(p.life*a.move.speed-c.TD.stats(t).range)<1e-9);}
});

test('wave completion clears every attack and field while preserving defender identity and upgrades',()=>{
 for(const outcome of ['ready','won','lost']){
  const c=load(),{g,e,t}=arena(c),b=c.RescueSkills.install(g);g.upgrade(t.id);g.update(.01);
  const a=b.actor(t.id);assert.ok(c.G.Projectiles.count>0);c.G.FX.px(10,10,'#fff');
  if(outcome==='won')g.maxWaves=1;
  if(outcome==='lost'){g.hp=1;e.progress=100000;}else e.hp=0;
  g.update(.01);assert.equal(g.status,outcome);
  assert.equal(c.G.Projectiles.count,0);assert.equal(c.G.Combat.fieldCount,0);assert.equal(c.G.FX.count,0);
  assert.equal(g.effects.length,0);assert.equal(b.actor(t.id),a);assert.equal(t.level,2);
  assert.equal(a.move.t,0);assert.equal(t.cooldown,0);assert.equal(a.target,null);assert.equal(a.anim.cur,'Idle');
  b.clearWave();assert.equal(b.actor(t.id),a);
 }
});

test('evolution switches original animation and body geometry while retaining ranged moves and projectile ownership',()=>{
 const c=load(),{g,t}=arena(c),b=c.RescueSkills.install(g);g.update(.01);
 const a=b.actor(t.id),move=a.move,p=c.G.Projectiles.all()[0],cooldown=move.t;a.anim.dir=6;
 assert.equal(a.dex,4);assert.ok(g.upgrade(t.id));
 const same=b.actor(t.id);assert.equal(same,a);assert.equal(a.dex,5);assert.equal(a.anim.dex,5);assert.equal(a.anim.dir,6);
 assert.equal(a.move,move);assert.equal(a.move.t,cooldown);assert.equal(p.owner,a);assert.ok(c.G.Projectiles.all().includes(p));
 assert.equal(a.r,c.G.Sprites.bodyRadius(5));assert.equal(a.bodyH,c.G.Sprites.bodyHeight(5));
 assert.ok(g.upgrade(t.id));b.updateVisuals(.01);assert.equal(a.dex,6);assert.equal(a.anim.dex,6);assert.equal(a.move.id,'ember');
 assert.equal(a.move.kind,'projectile');assert.equal(g.upgrade(t.id),false);
});
test('every defender evolution retains its learned original ranged ability and source sprite metadata',()=>{
 const c=load();
 for(const d of c.TD.catalog){
  const {g,t}=arena(c,d.id),b=c.RescueSkills.install(g),a=b.actor(t.id),move=a.move;
  for(let level=1;level<=3;level++){
   if(level>1)assert.ok(g.upgrade(t.id));b.updateVisuals(.01);
   const f=c.TD.form(t);assert.equal(a.dex,f.dex);assert.equal(a.anim.dex,f.dex);assert.equal(a.move,move);
   assert.ok(c.G.Sprites.animMeta(f.dex,'Idle'));assert.ok(c.G.Sprites.animMeta(f.dex,'Shoot'));
   assert.ok(['projectile','boomerang','nova'].includes(a.move.kind));
   assert.equal(c.G.DEX_BY[f.dex].name,f.name);
  }
 }
});
test('Piplup family faces down during idle, radial casts, evolution and wave cleanup',()=>{
 const c=load(),{g,t}=arena(c,'piplup'),b=c.RescueSkills.install(g);
 for(const dex of [393,394,395]){
  const a=b.actor(t.id);assert.equal(a.dex,dex);assert.equal(a.anim.dir,0);
  for(const aim of [0,Math.PI/2,Math.PI,-Math.PI/2]){a.aim=aim;a.cast(a.move);assert.equal(a.anim.dir,0,'Bubble is radial; sprite must face down regardless of target');}
  b.updateVisuals(.2);assert.equal(a.anim.dir,0);b.clearWave();assert.equal(a.anim.dir,0);
  if(dex!==395){assert.ok(g.upgrade(t.id));assert.equal(b.actor(t.id),a);}
 }
 const other=arena(c,'charmander'),bridge=c.RescueSkills.install(other.g),a=bridge.actor(other.t.id);
 a.aim=0;a.cast(a.move);assert.equal(a.anim.dir,c.G.Sprites.dirFromAngle(0),'other families still face their targets');
});

test('Raichu final stat upgrade does not replace its animation again',()=>{
 const c=load(),{g,t}=arena(c,'pikachu'),b=c.RescueSkills.install(g);const a=b.actor(t.id);
 g.upgrade(t.id);b.updateVisuals(.01);assert.equal(a.dex,26);const anim=a.anim;
 g.upgrade(t.id);b.updateVisuals(.01);assert.equal(a.dex,26);assert.equal(a.anim,anim);
});
