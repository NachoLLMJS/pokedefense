/* Standalone, local-only adapters around the unmodified PokeSurvivor runtime. */
(function(root) {
  'use strict';
  const G = root.G;
  const ENGLISH = {'razor-leaf':'Razor Leaf',bubble:'Bubble',ember:'Ember','water-gun':'Water Gun','thunder-shock':'Thunder Shock',tackle:'Tackle'};
  function configureCatalog(TD) {
    for (const d of TD.catalog) {
      const m = G.Moves.instance(G.startMoveOf(d.dex));
      d.moveId = m.id;
      d.moveName = ENGLISH[m.id] || m.name;
      d.moveKind = m.kind;
      d.damage = m.dmg;
      d.rate = 1 / m.cd;
      d.range = m.radius || m.speed * m.life;
      d.role = d.moveName + ' · ' + m.kind;
    }
    return TD.catalog;
  }
  function install(game) {
    const TD=root.TD;
    const actors=new Map(), enemies=new WeakMap();
    let now=0;
    G.Settings=G.Settings || {fx:2,get:key=>key==='dmgNumbers'};
    G.Audio=G.Audio || {sfx(){}};
    G.Coop={active:false};
    G.Weather={mult:()=>1};
    G.Camera={sees:(x,y,margin=0)=>x>=-margin && y>=-margin && x<=960+margin && y<=640+margin,kick(){}};
    function enemy(e) {
      if(enemies.has(e)) return enemies.get(e);
      const a={
        get id(){return e.id;},get x(){return e.x;},get y(){return e.y;},
        get dead(){return e.hp<=0;},get types(){return (G.DEX_BY[e.dex]||{}).types || ['normal'];},
        get hp(){return e.hp;},get burn(){return e.burn||0;},get poison(){return e.rescuePoison||0;},
        r:G.Sprites.bodyRadius(e.dex),bodyH:G.Sprites.bodyHeight(e.dex),
        behavior:'thief',kx:0,ky:0,cy(){return e.y;},strike(){},
        hurt(amount,color,dx,dy,knock,eff){
          if(e.hp<=0) return;
          const d=Math.max(1,Math.round(amount)); e.hp-=d; e.flash=0.09;
          G.FX.dmgText(e.x,e.y-this.bodyH-4,d,eff==='super'?'#ffe14d':eff==='weak'?'#a3abb8':color,!!e.boss);
          G.FX.spark(e.x,e.y-this.bodyH*0.5,color,dx,dy,3);
        },
        applyBurn(n=1){e.burn=Math.min(8,(e.burn||0)+n);e.burnT=3;},
        applyPoison(n=1){e.rescuePoison=Math.min(8,(e.rescuePoison||0)+n);e.poisonT=4;},
        applySlow(factor,dur=1.2){e.slow=Math.max(e.slow||0,dur);}
      };
      enemies.set(e,a); return a;
    }
    function actor(id) {
      const t=game.towers.find(t=>t.id===id);
      if(!t) return null;
      let a=actors.get(id);
      if(!a) {
        const d=TD.catalog.find(d=>d.id===t.type),m=G.Moves.instance(d.moveId),f=TD.form(t);
        a={id,dex:f.dex,x:t.x,y:t.y,r:G.Sprites.bodyRadius(f.dex),bodyH:G.Sprites.bodyHeight(f.dex),
          anim:new G.Sprites.Animator(f.dex),move:m,aim:0,atk:1,cdMul:1,dead:false,dmgDealt:0,
          activeGroup(){return [this.move];},onDealt(){},hurt(){},hasItem(){return false;},
          cast(m){
            G.Audio.sfx('shot',{kind:m.kind,type:m.type});
            // Bubble is radial: keep the whole Piplup lineage facing down (source row 0).
            this.anim.dir=t.type==='piplup'?0:G.Sprites.dirFromAngle(this.aim);
            if(this.anim.busy() && this.anim.progress()<0.65) return;
            const name=m.kind==='melee'?'Attack':'Shoot';
            const meta=G.Sprites.animMeta(this.dex,name);
            const len=meta?meta.d.reduce((a,b)=>a+b,0)/60:0.4;
            this.anim.play(name,{speed:Math.max(1,len/(Math.max(0.12,m.cd*this.cdMul)*0.9))});
          }};
        actors.set(id,a);
      }
      const f=TD.form(t);
      if(a.dex!==f.dex){
        const dir=a.anim.dir;
        a.dex=f.dex;a.r=G.Sprites.bodyRadius(f.dex);a.bodyH=G.Sprites.bodyHeight(f.dex);
        a.anim=new G.Sprites.Animator(f.dex);a.anim.dir=dir;
        G.FX.burst(a.x,a.y-a.bodyH*.5,'#fff0a1',18,100);
        G.FX.ring(a.x,a.y,10,60,'#fff0a1',.5,2);
      }
      return a;
    }
    function boundary(fn) {
      const world=G.World, mgr=G.EnemyMgr;
      G.EnemyMgr={all:()=>game.enemies.filter(e=>e.hp>0).map(enemy),
        queryCircle:(x,y,r)=>game.enemies.filter(e=>e.hp>0 && Math.hypot(e.x-x,e.y-y)<=r+enemy(e).r).map(enemy)};
      // The original renderer owns World. Only combat gets this read-only screen adapter.
      const point=(x,y)=>root.RescueMap?root.RescueMap.toWorld(x,y):{x,y};
      G.World={
        projectileBlock(x,y,r){const p=point(x,y);return world && world.projectileBlock?world.projectileBlock(p.x,p.y,r):false;},
        isWall(x,y){const p=point(x,y);return world && world.isWall?world.isWall(p.x,p.y):false;},
        propsInCircle:()=>[],damageProp(){}
      };
      try{return fn();}finally{G.World=world;G.EnemyMgr=mgr;}
    }
    function step(dt) {
      now+=dt;
      for(const [id,a] of actors)if(!game.towers.some(t=>t.id===id)) {
        for(const p of G.Projectiles.all().slice())if(p.owner===a)G.Projectiles.remove(p);
        G.Combat.clearFields(a);actors.delete(id);a.dead=true;
      }
      boundary(()=>{
        // Enemy.update status rules, adapted to TD records (poison stacks must
        // not occupy engine.poison, whose legacy meaning is remaining seconds).
        for(const e of game.enemies) {
          const a=enemy(e);
          if(e.burn>0) {
            e.burnT-=dt;e.burnTick=(e.burnTick||0)-dt;
            if(e.burnTick<=0){e.burnTick=0.5;a.hurt(1.6*e.burn*(1+(e.burnLevel||1)*0.06),'#ff9a4d');}
            if(e.burnT<=0)e.burn=0;
          }
          if(e.rescuePoison>0) {
            e.poisonT-=dt;e.poisonTick=(e.poisonTick||0)-dt;
            if(e.poisonTick<=0){e.poisonTick=0.6;a.hurt(e.maxHp*0.012*e.rescuePoison+1,'#d47cf0');}
            if(e.poisonT<=0)e.rescuePoison=0;
          }
        }
        for(const t of game.towers) {
          const a=actor(t.id),s=TD.stats(t);
          a.x=t.x;a.y=t.y;a.atk=s.damage/a.move.dmg;a.cdMul=1/(s.rate*a.move.cd);
          if(a.move.radius) a.move.radius=s.range;
          else if(['projectile','nova'].includes(a.move.kind))a.move.life=s.range/a.move.speed;
          // The source has a 520px projectile acquisition gate, independent
          // of travel lifetime. Do not let a farther TD-priority target starve
          // an enemy the actual source move can currently acquire.
          const acquisition=a.move.kind==='projectile'?Math.min(s.range,520):s.range;
          a.target=G.EnemyMgr.all().filter(e=>Math.hypot(e.x-a.x,e.y-a.y)<=acquisition).sort((a,b)=>{
            const ea=game.enemies.find(e=>e.id===a.id),eb=game.enemies.find(e=>e.id===b.id);
            return eb.progress-ea.progress;
          })[0] || null;
          if(a.target) a.aim=Math.atan2(a.target.y-a.y,a.target.x-a.x);
          G.Combat.tick(dt,a,now);
          t.cooldown=Math.max(0,a.move.t);
        }
        const first=game.towers.length?actor(game.towers[0].id):{dead:true,x:-9999,y:-9999,r:0,dmgDealt:0,onDealt(){}};
        G.Projectiles.update(dt,first,G.EnemyMgr.all());
        G.Combat.updateFields(dt);
        // Original resolve attributes damage to its `pl` argument (the source
        // has one local player). Give each TD defender its own projectile view,
        // then reflect source removals back into the real shared list.
        const all=G.Projectiles.all, groups=new Map();
        for(const p of all()) {
          const owner=p.owner || first;
          if(!groups.has(owner))groups.set(owner,[]);
          groups.get(owner).push(p);
        }
        for(const [owner,original] of groups) {
          const live=original.slice();
          G.Projectiles.all=()=>live;
          try{G.Combat.resolve(dt,owner,now);}finally{G.Projectiles.all=all;}
          for(const p of original)if(!live.includes(p))G.Projectiles.remove(p);
        }
      });
    }
    function clearWave(){
      G.Projectiles.clear();G.Combat.clearFields();G.FX.clear();game.effects=[];
      for(const t of game.towers){
        t.cooldown=0;
        const a=actor(t.id);a.move.t=0;a.target=null;
        a.anim.once=false;a.anim.hold=false;a.anim.done=false;
        a.anim.loop('Idle');a.anim.frame=0;a.anim.t=0;
      }
    }
    function reset(){actors.clear();G.Projectiles.clear();G.Combat.clearFields();G.FX.clear();now=0;}
    reset();
    game.combatStep=step;
    game.combatEnd=clearWave;
    return {actor,reset,clearWave,
      updateVisuals(dt){
        if(!Number.isFinite(dt) || dt<=0) return;
        for(const t of game.towers) actor(t.id).anim.update(dt);
        G.FX.update(dt);
      },
      drawGround(ctx){G.Combat.drawGroundFields(ctx);},
      draw(ctx){G.Combat.drawAirFields(ctx);G.Projectiles.draw(ctx);G.FX.draw(ctx);}
    };
  }
  root.RescueSkills = { configureCatalog, install };
})(window);
