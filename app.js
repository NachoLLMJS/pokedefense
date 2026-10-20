/* Local, dependency-free presentation. Simulation lives in engine.js. */
(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('battlefield'),ctx=canvas.getContext('2d');
RescueSkills.configureCatalog(TD);
const game=new TD.Game(),skills=RescueSkills.install(game),images=new Map(),house=new Image();house.src='assets/nexus-house.png';
let chosen=TD.catalog[0].id,paused=false,speed=1,time=0,last=performance.now(),hover=-1,muted=true,lastKills=0,terminalShown=false,overlayMode='help',completedWave=0;
const catalog=id=>TD.catalog.find(c=>c.id===id),selected=()=>game.towers.find(t=>t.id===game.selectedId);
function sheet(dex,anim){const key=dex+'/'+anim;if(!images.has(key)){const img=new Image();img.src=`assets/pokemon/${dex}/${anim}.png`;images.set(key,img);}return images.get(key);}
function sprite(c,dex,anim,x,y,scale=2,dir=0,phase=0){let m=G.SPRITE_META[dex]?.a[anim];if(!m)return;const im=sheet(dex,anim);if(!im.complete||!im.naturalWidth)return;let tick=((time+phase)*60)%m.d.reduce((a,b)=>a+b,0),frame=0;while(tick>=m.d[frame]&&frame<m.n-1)tick-=m.d[frame++];c.imageSmoothingEnabled=false;c.drawImage(im,frame*m.w,Math.min(dir,m.r-1)*m.h,m.w,m.h,Math.round(x-m.ax*scale),Math.round(y-m.ay*scale),m.w*scale,m.h*scale);}
for(const id of TD.enemyDex)sheet(id,'Walk');
for(const d of TD.catalog)sheet(d.dex,'Idle');
G.Sprites.preload(TD.defenderDex);
function beep(freq=500){if(muted)return;G.Audio.sfx(freq>=700?'confirm':freq<450?'click':'coin');}
function message(text){$('message').textContent=text;}
function showOverlay(title,copy,label='FIELD GUIDE',mode='help'){
 overlayMode=mode;$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;$('overlay-label').textContent=label;
 $('overlay-close').textContent=mode==='terminal'?'NEW RUN →':mode==='wave'?'NEXT WAVE →':'LET’S GO →';
 $('overlay-prepare').hidden=mode!=='wave';$('overlay').hidden=false;
 $('overlay-close').focus({preventScroll:true});
}
function dismissOverlay(){$('overlay').hidden=true;canvas.focus({preventScroll:true});}
function phaseTransition(){
 if(game.status==='ready'&&game.wave>completedWave){
  completedWave=game.wave;skills.clearWave();paused=false;$('pause').textContent='Ⅱ';
  const next=TD.waveInfo(game.wave+1);sync();
  showOverlay(`Wave ${game.wave} cleared!`,`Your base has ${game.hp} / 20 integrity. Wave reward: ${55+game.wave*10} coins. Next up: ${next.count} Pokémon${next.boss?' including a boss':''} — 4 more than the previous wave. Continue now, or prepare your team first.`,'AREA SECURED','wave');
 }
}
function reset(){game.reset();skills.reset();completedWave=0;paused=false;terminalShown=false;lastKills=0;chosen=TD.catalog[0].id;$('overlay').hidden=true;$('pause').textContent='Ⅱ';message('A fresh start. Choose your partners and prepare the defense.');sync();}
for(const def of TD.catalog){const b=document.createElement('button');b.className='pokemon-card';b.dataset.type=def.id;b.innerHTML=`<canvas class="portrait" width="106" height="96" aria-hidden="true"></canvas><span><strong>${def.name}</strong><small><i class="type-dot" style="background:${def.color}"></i>${def.role}</small></span><span class="price">${def.cost}</span>`;b.title=def.forms.map(f=>f.name).join(' → ');b.setAttribute('aria-label',`Select ${def.name}, ${def.cost} coins. Evolution line: ${b.title}`);b.onclick=()=>{chosen=def.id;game.selectedId=null;message(`${def.name} selected. Click an empty deployment spot.`);beep(600);sync();};$('roster').append(b);}
function sync(){
$('gold').textContent=Math.floor(game.gold);$('health').textContent=`${game.hp} / 20`;$('health-fill').style.width=`${Math.max(0,game.hp)/20*100}%`;$('wave').innerHTML=`${String(game.wave).padStart(2,'0')} <span>/ ${game.maxWaves}</span>`;
for(const b of $('roster').children){b.classList.toggle('selected',b.dataset.type===String(chosen));b.setAttribute('aria-pressed',b.dataset.type===String(chosen));b.disabled=game.status==='lost'||game.status==='won';}
const t=selected(),d=t?catalog(t.type):catalog(chosen),stats=t?TD.stats(t):null,form=t?TD.form(t):d,next=t&&t.level<3?TD.form({...t,level:t.level+1}):null,evolving=next&&next.dex!==form.dex;$('inspector').classList.toggle('has-selection',!!t);
$('inspect-name').textContent=t?`${form.name} · Level ${t.level}`:d?`${d.name} · ${d.cost} coins`:'Every partner has a purpose.';
$('inspect-copy').textContent=t?(evolving?`Next upgrade: ${next.name}. Evolve in place and boost power, range and attack speed.`:t.level<3?'Fully evolved. The next upgrade boosts power, range and attack speed without changing form.':'Final form, maximum level. Your ranged partner is ready for battle.'):d?`${d.role}. Click an empty circular spot on the battlefield to deploy this partner.`:'Mix different partners to build a balanced defense.';
$('inspect-stats').textContent=d?`POWER ${Math.round(stats?.damage??d.damage)}   RANGE ${Math.round(stats?.range??d.range)}   RATE ${(stats?.rate??d.rate).toFixed(1)}/s`:'';
$('upgrade').disabled=!t||t.level>=3||game.gold<stats.upgradeCost||['won','lost'].includes(game.status);$('upgrade').textContent=t?(t.level>=3?'MAX LEVEL':`${evolving?'EVOLVE':'UPGRADE'} · ${stats.upgradeCost}`):'UPGRADE';$('sell').disabled=!t||['won','lost'].includes(game.status);$('sell').textContent=t?`RECALL +${stats.sellValue}`:'RECALL';
const n=Math.min(game.wave+1,game.maxWaves),info=TD.waveInfo(n);$('next-label').textContent=game.status==='wave'?`INCOMING · WAVE ${String(game.wave).padStart(2,'0')}`:`NEXT UP · WAVE ${String(n).padStart(2,'0')}`;$('next-title').textContent=game.status==='wave'?'Hold the line.':info.title;$('wave-detail').textContent=game.status==='wave'?`${game.enemies.length} on the trail · ${game.kills} defeated`:`${info.count} visitors${info.boss?' · Boss encounter':''} · Deploy and upgrade before sending.`;$('launch').disabled=game.status!=='ready';$('launch').innerHTML=game.status==='wave'?'WAVE IN PROGRESS':'SEND WAVE <span>→</span>';
}
function launchWave(){if(game.startWave()){dismissOverlay();paused=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause game');message(`Wave ${game.wave} incoming. Protect the rescue base!`);beep(350);sync();}}
$('launch').onclick=launchWave;
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Resume game':'Pause game');message(paused?'Paused. Take your time to plan.':'Back to the defense.');};
$('speed').onclick=()=>{speed=speed===1?2:speed===2?3:1;$('speed').textContent=speed+'×';};
$('upgrade').onclick=()=>{const t=selected(),before=t?TD.form(t):null;if(t&&game.upgrade(t.id)){const after=TD.form(t);skills.actor(t.id);message(before.dex!==after.dex?`${before.name} evolved into ${after.name}!`:`${after.name} upgraded to level ${t.level}.`);beep(800);sync();}};
$('sell').onclick=()=>{const t=selected();if(t&&game.sell(t.id)){message('Partner recalled. Coins returned to your team.');sync();}};
$('restart').onclick=()=>showOverlay('Start a new run?','This will replace the current defense. Ready to assemble a new team?','NEW ADVENTURE','terminal');
$('help').onclick=()=>showOverlay('Protect your home.','Choose a Pokémon from your team, then click a circular deployment spot. Send a wave when ready. Your partners attack automatically. Click a deployed partner to upgrade or recall it. Survive all 15 waves; every fifth wave brings a boss. Each upgrade evolves your partner if another form is available; otherwise it boosts stats. All attacks stay ranged. Space sends a wave, P pauses, Esc clears selection.');
$('overlay-close').onclick=()=>{if(overlayMode==='terminal')reset();else if(overlayMode==='wave')launchWave();else dismissOverlay();};
$('overlay-prepare').onclick=()=>{dismissOverlay();message('Prepare your partners, then send the next wave when ready.');};
$('inspector-close').onclick=()=>{game.selectedId=null;sync();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message('Fullscreen is unavailable here. You can use F11 in your browser.');}};
$('sound').onclick=()=>{muted=!muted;window.pokeSoundEnabled=!muted;$('sound').textContent=muted?'SOUND OFF':'SOUND ON';beep();};
function position(e){const r=canvas.getBoundingClientRect();return TDView.toBoard(view,e.clientX-r.left,e.clientY-r.top);}
function padAt(p){return TD.pads.findIndex(a=>Math.hypot(a.x-p.x,a.y-p.y)<36);}
canvas.addEventListener('pointermove',e=>{hover=padAt(position(e));});canvas.addEventListener('pointerleave',()=>hover=-1);
canvas.addEventListener('click',e=>{const i=padAt(position(e));if(i<0)return;const t=game.towers.find(t=>t.pad===i);if(t){game.selectedId=t.id;chosen=null;message(`${TD.form(t).name} selected. Evolve, upgrade or recall your partner.`);}else if(chosen){if(game.build(chosen,i)){message(`${catalog(chosen).name} deployed. A new friend on the field!`);beep(700);}else message('Not enough coins to deploy this partner.');}sync();});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){chosen=null;game.selectedId=null;dismissOverlay();sync();return;}
 if(!$('overlay').hidden){if((e.code==='Space'||e.key==='Enter')&&overlayMode==='wave'){e.preventDefault();$('overlay-close').click();}return;}
 if(['BUTTON','INPUT'].includes(document.activeElement.tagName))return;
 if(e.code==='Space'){e.preventDefault();$('launch').click();}if(e.key.toLowerCase()==='p')$('pause').click();
});
// Full-window camera: extend the original world behind overlays, never stretch the game board.
let view=TDView.fit(innerWidth,innerHeight),dpr=Math.min(devicePixelRatio||1,2),mapProps=[];
const renderCamera={w:0,h:0,left:()=>RescueMap.offset.x-view.x/view.scale,top:()=>RescueMap.offset.y-view.y/view.scale,sees(x,y,r=0){return x+r>=this.left()&&x-r<=this.left()+this.w&&y+r>=this.top()&&y-r<=this.top()+this.h;}};
function resize(){view=TDView.fit(innerWidth,innerHeight);dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);renderCamera.w=innerWidth/view.scale;renderCamera.h=innerHeight/view.scale;mapProps=G.World.visibleProps(renderCamera).map(prop=>({...RescueMap.toScreen(prop.x,prop.y),prop,isProp:true}));}
addEventListener('resize',resize);resize();
function drawOriginalProp(item){ctx.save();ctx.translate(-RescueMap.offset.x,-RescueMap.offset.y);G.World.drawProp(ctx,item.prop,time);ctx.restore();}
function drawRoute(){ctx.save();ctx.beginPath();TD.path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.setLineDash([3,12]);ctx.lineWidth=2;ctx.strokeStyle='#f5e8aa66';ctx.stroke();ctx.restore();}
function ring(x,y,r,color,fill){ctx.beginPath();ctx.ellipse(x,y,r,r*.55,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();}
function render(){ctx.setTransform(dpr*view.scale,0,0,dpr*view.scale,dpr*view.x,dpr*view.y);ctx.imageSmoothingEnabled=false;ctx.save();ctx.translate(-RescueMap.offset.x,-RescueMap.offset.y);G.World.drawGround(ctx,renderCamera);G.World.drawLiquid(ctx,renderCamera,time);ctx.restore();drawRoute();skills.drawGround(ctx);for(let i=0;i<TD.pads.length;i++){const p=TD.pads[i],occupied=game.towers.some(t=>t.pad===i);if(!occupied){ring(p.x,p.y,22,i===hover?'#f4f3b6':'#bfd29a88',i===hover?'#d9e7ad44':'#315d2722');ctx.fillStyle=i===hover?'#fff3c2':'#c6dc9a99';ctx.font='19px Pixelify';ctx.textAlign='center';ctx.fillText('+',p.x,p.y+6);}}
const t=selected(),def=t?catalog(t.type):catalog(chosen),p=t||(hover>=0?TD.pads[hover]:null);if(p&&def){ctx.beginPath();ctx.arc(p.x,p.y,t?TD.stats(t).range:def.range,0,Math.PI*2);ctx.fillStyle=def.color+'14';ctx.fill();ctx.strokeStyle=def.color+'88';ctx.lineWidth=1;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);}
ctx.fillStyle='#365c3c44';ctx.beginPath();ctx.ellipse(853,293,65,15,0,0,7);ctx.fill();if(house.complete&&house.naturalWidth)ctx.drawImage(house,789,145,128,150);ctx.textAlign='center';ctx.font='12px Pixelify';ctx.fillStyle='#f8f0cd';ctx.fillText('RESCUE BASE',835,316);ctx.fillStyle='#284d34';ctx.fillRect(802,323,66,5);ctx.fillStyle='#cce998';ctx.fillRect(803,324,64*Math.max(0,game.hp)/20,3);
for(const a of [...mapProps,...game.towers.map(t=>({...t,isTower:true})),...game.enemies].sort((a,b)=>a.y-b.y)){if(a.isProp){drawOriginalProp(a);continue;}if(a.isTower){const d=catalog(a.type);ring(a.x,a.y,23,a.id===game.selectedId?'#fff3b0':d.color,'#35552a66');const actor=skills.actor(a.id);if(actor)actor.anim.draw(ctx,actor.x,actor.y);ctx.font='10px Pixelify';ctx.fillStyle='#f1eac4';ctx.fillText('★'.repeat(a.level),a.x,a.y+21);}else{ctx.fillStyle='#233c2855';ctx.beginPath();ctx.ellipse(a.x,a.y+3,a.boss?23:14,6,0,0,7);ctx.fill();let dir=0,remaining=a.progress;for(let i=1;i<TD.path.length;i++){const p=TD.path[i-1],q=TD.path[i],length=Math.hypot(q.x-p.x,q.y-p.y);if(remaining<=length){dir=G.Sprites.dirFromAngle(Math.atan2(q.y-p.y,q.x-p.x));break;}remaining-=length;}sprite(ctx,a.dex,'Walk',a.x,a.y,a.boss?2.7:1.8,dir,a.id*.2||0);const w=a.boss?47:29;ctx.fillStyle='#334636';ctx.fillRect(a.x-w/2,a.y-42,w,4);ctx.fillStyle=a.boss?'#e4a16d':a.slow?'#87d3db':'#eac183';ctx.fillRect(a.x-w/2+1,a.y-41,(w-2)*Math.max(0,a.hp/a.maxHp),2);if(a.boss){ctx.font='10px Pixelify';ctx.fillStyle='#fff1b3';ctx.fillText('BOSS',a.x,a.y-48);}}}
skills.draw(ctx);
if(hover>=0&&chosen&&!game.towers.some(t=>t.pad===hover)){ctx.globalAlpha=.55;sprite(ctx,catalog(chosen).dex,'Idle',TD.pads[hover].x,TD.pads[hover].y,2.1);ctx.globalAlpha=1;}
for(const b of $('roster').children){const c=b.querySelector('canvas'),cx=c.getContext('2d');cx.clearRect(0,0,c.width,c.height);sprite(cx,catalog(b.dataset.type).dex,'Idle',53,71,2.4);}
if(paused){ctx.fillStyle='#14291c66';ctx.fillRect(0,0,960,640);ctx.font='42px Pixelify';ctx.textAlign='center';ctx.fillStyle='#ecf0cd';ctx.fillText('PAUSED',480,320);}}
let syncTimer=0;function frame(now){const dt=Math.min((now-last)/1000,.06);last=now;if(!paused){time+=dt;if($('overlay').hidden)for(let i=0;i<speed;i++)game.update(dt);if($('overlay').hidden||game.status!=='wave')skills.updateVisuals(dt*speed);}phaseTransition();syncTimer+=dt;if(syncTimer>.12){sync();syncTimer=0;}if(game.kills>lastKills){beep(450);lastKills=game.kills;}if(!terminalShown&&['won','lost'].includes(game.status)){terminalShown=true;showOverlay(game.status==='won'?'Home, safe home.':'The grove needs you.',game.status==='won'?`All 15 waves survived. ${game.kills} visitors defeated. Your rescue base is safe!`:`You reached wave ${game.wave} and defeated ${game.kills} visitors. Try mixing different partners and upgrading before the bosses arrive.`,game.status==='won'?'MISSION COMPLETE':'BASE OVERRUN','terminal');}render();requestAnimationFrame(frame);}
window.pokeDefense={game,skills,get view(){return view;},toScreen:(x,y)=>TDView.toScreen(view,x,y),get chosen(){return chosen;},get paused(){return paused;},get speed(){return speed;},reset};sync();requestAnimationFrame(frame);
})();