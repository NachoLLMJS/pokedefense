/* PokeDefense simulation. rate is attacks/second; distances are board pixels. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TD = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const catalog = [
    {id:'treecko',name:'Treecko',dex:252,cost:100,damage:13,range:360,rate:1,color:'#67c66b',role:'Razor Leaf'},
    {id:'charmander',name:'Charmander',dex:4,cost:120,damage:24,range:135,rate:0.85,color:'#ff9954',role:'Ember'},
    {id:'squirtle',name:'Squirtle',dex:7,cost:95,damage:11,range:150,rate:1.1,color:'#63bcf2',role:'Water Gun'},
    {id:'pikachu',name:'Pikachu',dex:25,cost:145,damage:19,range:155,rate:1.2,color:'#ffdd54',role:'Thunder Shock'},
    {id:'piplup',name:'Piplup',dex:393,cost:80,damage:12,range:300,rate:2.2,color:'#88cfee',role:'Bubble'},
    {id:'fennekin',name:'Fennekin',dex:653,cost:130,damage:21,range:300,rate:0.85,color:'#f4ae68',role:'Ember'}
  ];
  const evolutionLines={
    treecko:[[252,'Treecko'],[253,'Grovyle'],[254,'Sceptile']],
    charmander:[[4,'Charmander'],[5,'Charmeleon'],[6,'Charizard']],
    squirtle:[[7,'Squirtle'],[8,'Wartortle'],[9,'Blastoise']],
    pikachu:[[25,'Pikachu'],[26,'Raichu']],
    piplup:[[393,'Piplup'],[394,'Prinplup'],[395,'Empoleon']],
    fennekin:[[653,'Fennekin'],[654,'Braixen'],[655,'Delphox']]
  };
  for(const d of catalog)d.forms=evolutionLines[d.id].map(([dex,name])=>({dex,name}));
  const defenderDex=[...new Set(catalog.flatMap(d=>d.forms.map(f=>f.dex)))];
  function form(tower){
    const d=catalog.find(d=>d.id===tower.type);
    if(!d)return null;
    return d.forms[Math.min(d.forms.length-1,Math.max(0,tower.level-1))];
  }
  const path = [{x:-30,y:150},{x:220,y:150},{x:220,y:420},{x:480,y:420},{x:480,y:230},{x:710,y:230},{x:710,y:485},{x:835,y:485},{x:835,y:295}];
  const pads = [{x:100,y:80},{x:110,y:225},{x:300,y:105},{x:145,y:340},{x:300,y:330},{x:340,y:495},{x:410,y:270},{x:560,y:340},{x:580,y:150},{x:650,y:410},{x:900,y:95},{x:790,y:350},{x:750,y:565},{x:910,y:445}];
  function stats(tower) {
    const d=catalog.find(d=>d.id===tower.type);
    if (!d) return null;
    const l=tower.level-1;
    return {damage:d.damage*Math.pow(1.55,l),range:d.range+l*14,rate:d.rate*(1+l*0.12),
      upgradeCost:Math.ceil(d.cost*(0.75+tower.level*0.5)),sellValue:Math.floor(tower.spent*0.7)};
  }
  const enemyPools = [
    [10,13,16,19,21,23,29,32,43,46,48,69],
    [27,41,50,52,56,58,60,66,74,77,81,84],
    [88,92,96,98,100,104,109,111,114,116,118,120],
    [123,125,126,127,128,138,140,147,163,167,177,179],
    [183,187,194,198,200,207,215,220,228,234,246,280]
  ];
  const enemyDex = [...new Set([...enemyPools.flat(),95,149,150])];
  function enemyPool(n) { return enemyPools[Math.min(4,Math.max(0,Math.floor((n-1)/3)))]; }
  function waveInfo(n) {
    return {count:8+4*(n-1),boss:n%5===0,title:n%5===0 ? 'Boss: '+({5:'Onix',10:'Dragonite',15:'Mewtwo'}[n] || 'Guardian') : 'Wild Pokémon · Wave '+n};
  }
  const lengths=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.y-path[i].y));
  const totalLength=lengths.reduce((a,b)=>a+b,0);
  function position(e) {
    let distance=e.progress;
    for(let i=0;i<lengths.length;i++) {
      if(distance<=lengths[i]) {
        const f=distance/lengths[i];
        e.x=path[i].x+(path[i+1].x-path[i].x)*f; e.y=path[i].y+(path[i+1].y-path[i].y)*f; return;
      }
      distance-=lengths[i];
    }
    e.x=path[path.length-1].x; e.y=path[path.length-1].y;
  }
  class Game {
    startWave() {
      if(this.status!=='ready' || this.wave>=this.maxWaves) return false;
      this.wave++; this.status='wave'; this._remaining=waveInfo(this.wave).count; this._spawnTimer=0; return true;
    }
    update(dt) {
      if(!Number.isFinite(dt) || dt<=0) return;
      // Small integration steps prevent fast enemies skipping towers and delayed frames dropping attacks.
      while(dt>1e-9) {
        if(this.status==='won' || this.status==='lost') return;
        const step=this.status==='wave' ? Math.min(dt,0.01) : dt;
        this._step(step); dt-=step;
      }
    }
    _step(dt) {
      if(this.status==='won' || this.status==='lost') return;
      for(const fx of this.effects) fx.life-=dt;
      this.effects=this.effects.filter(fx=>fx.life>0);
      if(this.status!=='wave') return;
      this._spawnTimer-=dt;
      while(this._remaining>0 && this._spawnTimer<=0) {
        const boss=this.wave%5===0 && this._remaining===1;
        const maxHp=(35+this.wave*13)*(boss ? 6 : 1);
        this.enemies.push({id:this._nextId++,dex:boss ? ({5:95,10:149,15:150}[this.wave] || 95) : enemyPool(this.wave)[(waveInfo(this.wave).count-this._remaining+this.wave*3)%enemyPool(this.wave).length],
          x:path[0].x,y:path[0].y,hp:maxHp,maxHp,progress:0,speed:(52+this.wave*2)*(boss ? 0.7 : 1),boss,slow:0});
        this._remaining--; this._spawnTimer+=0.85;
      }
      for(const e of this.enemies) {
        const slowed=Math.min(dt,e.slow);
        e.progress+=e.speed*(dt-slowed+slowed*0.55); e.slow=Math.max(0,e.slow-dt); position(e);
      }
      if (typeof this.combatStep === 'function') this.combatStep(dt,this);
      else for(const t of this.towers) {
        const s=stats(t); t.cooldown=Math.max(0,t.cooldown-dt);
        if(t.cooldown>0) continue;
        const target=this.enemies.filter(e=>e.hp>0 && Math.hypot(e.x-t.x,e.y-t.y)<=s.range)
          .sort((a,b)=>b.progress-a.progress)[0];
        if(!target) continue;
        target.hp-=s.damage; t.cooldown=1/s.rate;
        this.effects.push({x:t.x,y:t.y,tx:target.x,ty:target.y,color:catalog.find(d=>d.id===t.type).color,life:0.22,maxLife:0.22,kind:t.type});
      }
      this.enemies=this.enemies.filter(e=> {
        if(e.hp>0) {
          if(e.progress<totalLength) return true;
          this.hp=Math.max(0,this.hp-(e.boss ? 4 : 1)); return false;
        }
        this.kills++; this.gold+=e.boss ? 90+this.wave*5 : 12+this.wave; return false;
      });
      if(this.hp<=0) { this._finishWave('lost'); return; }
      if(this._remaining===0 && this.enemies.length===0) {
        this.gold+=55+this.wave*10; this._finishWave(this.wave>=this.maxWaves ? 'won' : 'ready');
      }
    }
    _finishWave(status) {
      this.status=status;
      this.effects=[];
      for(const t of this.towers)t.cooldown=0;
      if(typeof this.combatEnd==='function')this.combatEnd(status,this);
    }
    build(type,pad) {
      if(this.status==='won' || this.status==='lost') return false;
      const d=catalog.find(d=>d.id===type);
      if (!d || !Number.isInteger(pad) || !pads[pad] || this.towers.some(t=>t.pad===pad) || this.gold<d.cost) return false;
      const t={id:this._nextId++,type,dex:d.dex,pad,x:pads[pad].x,y:pads[pad].y,level:1,spent:d.cost,cooldown:0};
      this.gold-=d.cost; this.towers.push(t); this.selectedId=t.id; return true;
    }
    upgrade(id) {
      if(this.status==='won' || this.status==='lost') return false;
      const t=this.towers.find(t=>t.id===id);
      if (!t || t.level>=3) return false;
      const s=stats(t); if(this.gold<s.upgradeCost) return false;
      this.gold-=s.upgradeCost; t.spent+=s.upgradeCost; t.level++;t.dex=form(t).dex; return true;
    }
    sell(id) {
      if(this.status==='won' || this.status==='lost') return false;
      const i=this.towers.findIndex(t=>t.id===id); if(i<0) return false;
      this.gold+=stats(this.towers[i]).sellValue; this.towers.splice(i,1);
      if(this.selectedId===id) this.selectedId=null; return true;
    }
    constructor() { this.reset(); }
    reset() {
      this.gold=420; this.hp=20; this.wave=0; this.maxWaves=15;
      this.towers=[]; this.enemies=[]; this.effects=[];
      this.status='ready'; this.kills=0; this.selectedId=null; this._nextId=1;
      this._remaining=0; this._spawnTimer=0;
    }
  }
  return {catalog,path,pads,Game,stats,waveInfo,enemyPools,enemyPool,enemyDex,form,defenderDex};
});
