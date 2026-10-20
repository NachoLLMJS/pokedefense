'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
test('static release includes runtime and attribution but excludes secrets and local QA artifacts',()=>{
 execFileSync(process.execPath,['build-static.cjs'],{cwd:__dirname});
 const out=path.join(__dirname,'site');
 for(const file of ['index.html','app.js','skill-bridge.js','SOURCE-CREDITS.md','ASSET-SOURCES.txt','source/core/sprites.js','assets/pokemon/393/Idle.png','assets/pokemon/394/Shoot.png','assets/pokemon/395/Shoot.png','assets/nexus-house.png']){
  assert.deepEqual(fs.readFileSync(path.join(out,file)),fs.readFileSync(path.join(__dirname,file)),file);
 }
 for(const file of fs.readdirSync(out,{recursive:true})){
  assert.ok(!/(^|[\\/])(?:\.env[^\\/]*|\.git|\.vercel|qa-[^\\/]*|[^\\/]*\.test\.cjs)$/.test(file),file);
 }
});
