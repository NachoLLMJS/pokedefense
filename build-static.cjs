'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname,out=path.join(root,'site');
const entries=['index.html','style.css','app.js','engine.js','map.js','viewport.js','skill-bridge.js','sprite-meta.js','source','assets','SOURCE-CREDITS.md','ASSET-SOURCES.txt'];
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
for(const entry of entries)fs.cpSync(path.join(root,entry),path.join(out,entry),{recursive:true});
console.log('Static release built: site/ (explicit runtime and attribution allowlist)');
