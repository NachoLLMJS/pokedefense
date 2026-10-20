/* Only the Flapcha intro presentation is reused; no wallet, API or launch logic. */
(()=>{
 'use strict';
 const loader=document.getElementById('intro-loader');
 const entry=document.getElementById('intro-entry');
 const play=document.getElementById('intro-play');
 const video=loader.querySelector('video');
 const canvas=document.getElementById('battlefield');
 const ui=document.querySelector('.interface');
 const delay=new Promise(resolve=>setTimeout(resolve,1500));
 const font=document.fonts.load('86px "PokemonSolid"').catch(()=>{});
 // The original 1.5s title reveal also waits for the actual game assets and first frame.
 Promise.all([delay,font,window.pokeDefense.ready]).then(()=>requestAnimationFrame(()=>{
  entry.hidden=false;
  play.focus({preventScroll:true});
 }));
 video.play().catch(()=>{}); // Muted autoplay may be blocked; the entry remains usable.
 play.addEventListener('click',()=>{
  loader.hidden=true;
  video.pause();
  canvas.inert=false;
  ui.inert=false;
  canvas.focus({preventScroll:true});
 });
 loader.addEventListener('keydown',event=>{
  if(event.key==='Tab'){
   event.preventDefault();
   if(!entry.hidden)play.focus({preventScroll:true});
  }
 });
})();
