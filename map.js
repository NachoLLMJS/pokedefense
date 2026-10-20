/* Coordinate adapter only. All terrain and props remain the unmodified PokeSurvivor world. */
(()=>{'use strict';const offset={x:-480,y:-320};const seed=723;
G.World.reset(seed);G.World.setBiome(0,true);
const camera={w:960,h:640,left:()=>offset.x,top:()=>offset.y,sees:(x,y,r=0)=>x+r>=offset.x&&x-r<=offset.x+960&&y+r>=offset.y&&y-r<=offset.y+640};
const toWorld=(x,y)=>({x:x+offset.x,y:y+offset.y});
const toScreen=(x,y)=>({x:x-offset.x,y:y-offset.y});
function terrainAt(x,y){const p=toWorld(x,y);return G.World.kindAt(p.x,p.y);}
function isFree(x,y,r=12){const p=toWorld(x,y);return G.World.isFree(p.x,p.y,r);}
// A seed selects a real, reproducible map from the original generator; no tiles or props are overwritten.
for(const p of TD.pads)if(!isFree(p.x,p.y,15)||terrainAt(p.x,p.y)!=='floor')throw Error('Deployment spot intersects the original terrain.');
for(let i=1;i<TD.path.length;i++){const a=TD.path[i-1],b=TD.path[i],n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/8);for(let j=0;j<=n;j++){const x=a.x+(b.x-a.x)*j/n,y=a.y+(b.y-a.y)*j/n;if(x>=8&&x<=952&&y>=8&&y<=632&&!isFree(x,y,10))throw Error('Wave route intersects the original terrain.');}}
window.RescueMap={seed,offset,camera,toWorld,toScreen,isFree,terrainAt,source:'PokeSurvivor',biome:G.World.biomeName()};
})();