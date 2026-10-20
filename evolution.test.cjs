'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),TD=require('./engine.js');
const lines={treecko:[[252,'Treecko'],[253,'Grovyle'],[254,'Sceptile']],charmander:[[4,'Charmander'],[5,'Charmeleon'],[6,'Charizard']],squirtle:[[7,'Squirtle'],[8,'Wartortle'],[9,'Blastoise']],pikachu:[[25,'Pikachu'],[26,'Raichu'],[26,'Raichu']],piplup:[[393,'Piplup'],[394,'Prinplup'],[395,'Empoleon']],fennekin:[[653,'Fennekin'],[654,'Braixen'],[655,'Delphox']]};
test('each paid upgrade advances exactly one available form while keeping the defender and pad',()=>{
 for(const [type,forms] of Object.entries(lines)){
  const g=new TD.Game();g.gold=10000;assert.ok(g.build(type,0));const t=g.towers[0],id=t.id;
  for(let i=0;i<forms.length;i++){
   if(i){const before=g.gold,cost=TD.stats(t).upgradeCost;assert.ok(g.upgrade(id));assert.equal(g.gold,before-cost);}
   const f=TD.form(t);assert.equal(f.dex,forms[i][0]);assert.equal(f.name,forms[i][1]);assert.equal(t.dex,f.dex);
   assert.equal(t.id,id);assert.equal(t.type,type);assert.equal(t.pad,0);assert.equal(t.level,i+1);
  }
  const gold=g.gold,spent=t.spent;assert.equal(g.upgrade(id),false);assert.equal(t.level,3);assert.equal(g.gold,gold);assert.equal(t.spent,spent);
 }
});
test('Pikachu evolves at the first upgrade and its final upgrade improves stats without evolving again',()=>{
 const g=new TD.Game();g.gold=10000;g.build('pikachu',0);const t=g.towers[0];
 g.upgrade(t.id);assert.equal(TD.form(t).name,'Raichu');const first=TD.stats(t);
 g.upgrade(t.id);assert.equal(TD.form(t).name,'Raichu');const last=TD.stats(t);
 assert.ok(last.damage>first.damage&&last.range>first.range&&last.rate>first.rate);
});
test('failed upgrades cannot evolve a defender or charge coins',()=>{
 const g=new TD.Game();g.build('charmander',0);g.gold=0;const t=g.towers[0],before=JSON.stringify(t);
 assert.equal(g.upgrade(t.id),false);assert.equal(JSON.stringify(t),before);assert.equal(TD.form(t).name,'Charmander');assert.equal(g.gold,0);
 assert.equal(TD.form({type:'unknown',level:1}),null);
});
