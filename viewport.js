(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TDView=api;})(typeof window!=='undefined'?window:globalThis,()=>{
function fit(width,height){const mobile=width<900,landscape=mobile&&width>height;const top=landscape?120:mobile?150:135,bottom=landscape?100:mobile?145:155,right=mobile?12:290,left=mobile?12:22;const aw=Math.max(100,width-left-right),ah=Math.max(100,height-top-bottom),scale=Math.min(aw/960,ah/640);return{width,height,scale,x:left+(aw-960*scale)/2,y:top+(ah-640*scale)/2};}
function toScreen(view,x,y){return{x:view.x+x*view.scale,y:view.y+y*view.scale};}
function toBoard(view,x,y){return{x:(x-view.x)/view.scale,y:(y-view.y)/view.scale};}
return{fit,toScreen,toBoard};});