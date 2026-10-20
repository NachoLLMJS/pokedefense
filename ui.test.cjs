const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
test('browser entry installs the original skill runtime and draws actual source attack animations',()=>{const html=fs.readFileSync(__dirname+'/index.html','utf8'),app=fs.readFileSync(__dirname+'/app.js','utf8');for(const f of ['source/core/sprites.js','source/data/moves.js','source/entities/vfx.js','source/entities/fx.js','source/entities/projectile.js','source/systems/combat.js','source/core/audio.js','skill-bridge.js'])assert.ok(html.includes(f),f);for(const hook of ['RescueSkills.configureCatalog(TD)','RescueSkills.install(game)','skills.updateVisuals','skills.drawGround','skills.draw(ctx)','actor.anim.draw','skills.reset()'])assert.ok(app.includes(hook),hook);assert.ok(!app.includes('for(const e of game.effects)'),'No placeholder attack beams');});
test('playable shell exposes canvas, deployment, wave, pause, speed, upgrade and restart controls',()=>{const html=fs.readFileSync(__dirname+'/index.html','utf8');for(const id of ['battlefield','roster','launch','pause','speed','upgrade','sell','restart','overlay','gold','health','wave'])assert.ok(html.includes(`id="${id}"`),id);assert.ok(html.includes('engine.js'));assert.ok(html.includes('app.js'));});
test('all enemy walk sprites are byte-identical source copies and pads clear the new house',()=>{
 const TD=require('./engine.js');assert.equal(TD.enemyDex.length,63);
 for(const dex of TD.enemyDex){const file=`assets/pokemon/${dex}/Walk.png`;assert.deepEqual(fs.readFileSync(`${__dirname}/${file}`),fs.readFileSync(`${__dirname}/../PokeSurvivor/${file}`),file);}
 for(const p of TD.pads)assert.ok(!(p.x>789&&p.x<917&&p.y>145&&p.y<295),'House obscures a deployment spot');
 const app=fs.readFileSync(__dirname+'/app.js','utf8'),html=fs.readFileSync(__dirname+'/index.html','utf8');
 assert.ok(app.includes('assets/nexus-house.png'));assert.ok(!html.includes('assets/nexus.png'));
});
