from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent

def deploy(page,kind,pad):
    page.locator(f'.pokemon-card[data-type="{kind}"]').click()
    cv=page.locator('#battlefield');cv.scroll_into_view_if_needed()
    point=page.evaluate('(i)=>{const p=TD.pads[i];return pokeDefense.toScreen(p.x,p.y)}',pad)
    page.mouse.click(point['x'],point['y'])

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    errors=[];failed=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('requestfailed',lambda req:failed.append(req.url))
    page.goto((ROOT/'index.html').as_uri())
    page.locator('#intro-play').click()
    page.wait_for_function('window.pokeDefense && window.RescueSkills && document.fonts.status === "loaded"')
    page.evaluate('''()=>{window.qaCalls={casts:0,vfx:0,projectiles:0,shapes:{}};const tick=G.Combat.tick;G.Combat.tick=function(...args){qaCalls.casts++;return tick.apply(this,args)};const draw=G.VFX.draw;G.VFX.draw=function(...args){qaCalls.vfx++;qaCalls.shapes[args[1]]=(qaCalls.shapes[args[1]]||0)+1;return draw.apply(this,args)};const spawn=G.Projectiles.spawn;G.Projectiles.spawn=function(...args){qaCalls.projectiles++;return spawn.apply(this,args)}}''')
    assert page.locator('.pokemon-card').count()==6
    cost=page.evaluate('TD.catalog[0].cost');deploy(page,'treecko',0)
    assert page.evaluate('pokeDefense.game.towers.length')==1
    assert page.evaluate('pokeDefense.game.gold')==420-cost
    up=page.evaluate('TD.stats(pokeDefense.game.towers[0]).upgradeCost')
    page.locator('#upgrade').click()
    assert page.evaluate('pokeDefense.game.towers[0].level')==2
    assert page.evaluate('pokeDefense.game.gold')==420-cost-up
    refund=page.evaluate('TD.stats(pokeDefense.game.towers[0]).sellValue')
    page.locator('#sell').click()
    assert page.evaluate('pokeDefense.game.towers.length')==0
    assert page.evaluate('pokeDefense.game.gold')==420-cost-up+refund
    page.locator('#restart').click();page.locator('#overlay-close').click()
    assert page.evaluate('pokeDefense.game.gold')==420
    deploy(page,'charmander',0);deploy(page,'pikachu',1);deploy(page,'piplup',2)
    page.locator('#launch').click()
    page.wait_for_function('pokeDefense.game.enemies.length>0')
    first=page.evaluate('pokeDefense.game.enemies[0].progress')
    page.wait_for_timeout(650)
    assert page.evaluate('pokeDefense.game.enemies[0].progress')>first
    page.locator('#pause').click();frozen=page.evaluate('JSON.stringify(pokeDefense.game.enemies.map(e=>[e.id,e.progress,e.hp]))')
    page.wait_for_timeout(350)
    assert page.evaluate('JSON.stringify(pokeDefense.game.enemies.map(e=>[e.id,e.progress,e.hp]))')==frozen
    page.locator('#pause').click()
    page.locator('#speed').click();assert page.evaluate('pokeDefense.speed')==2
    page.locator('#speed').click();assert page.evaluate('pokeDefense.speed')==3
    page.wait_for_function('pokeDefense.game.kills>0',timeout=15000)
    canvas=page.locator('#battlefield');canvas.scroll_into_view_if_needed()
    page.screenshot(path=str(ROOT/'qa-gameplay-desktop.png'),full_page=True)
    live=page.evaluate('({hp:pokeDefense.game.hp,kills:pokeDefense.game.kills,wave:pokeDefense.game.wave,calls:qaCalls,moves:TD.catalog.map(t=>({name:t.name,role:t.role,moveId:t.moveId}))})')
    assert live['calls']['casts']>0 and live['calls']['vfx']>0 and live['calls']['projectiles']>0,live
    # Accelerate the real engine, without editing enemy health, balances or damage.
    cleared=page.evaluate('''()=>{const g=pokeDefense.game;for(let i=0;i<5000&&g.status==='wave';i++)g.update(.05);return {status:g.status,hp:g.hp,kills:g.kills,wave:g.wave}}''')
    assert cleared['status']=='ready' and cleared['kills']>0,cleared
    page.wait_for_timeout(200)
    page.locator('#overlay-prepare').click()
    # Defeat and restart use real leaks rather than forged terminal flags.
    page.locator('#restart').click();page.locator('#overlay-close').click()
    lost=page.evaluate('''()=>{const g=pokeDefense.game;for(let w=0;w<15&&g.status!=='lost';w++){g.startWave();for(let n=0;n<8000&&g.status==='wave';n++)g.update(.05)}return {hp:g.hp,status:g.status,wave:g.wave}}''')
    assert lost['status']=='lost' and lost['hp']==0,lost
    page.wait_for_function('!document.querySelector("#overlay").hidden')
    assert page.locator('#overlay-title').inner_text()=='The grove needs you.'
    page.locator('#overlay-close').click()
    assert page.evaluate('pokeDefense.game.gold===420 && pokeDefense.game.hp===20 && pokeDefense.game.wave===0')
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
    assert page.evaluate('innerWidth===390 && document.documentElement.scrollWidth<=innerWidth')
    deploy(page,'squirtle',1);assert page.evaluate('pokeDefense.game.towers.length')==1
    page.screenshot(path=str(ROOT/'qa-gameplay-mobile.png'),full_page=True)
    assert not errors,errors
    assert not failed,failed
    result={'launch':'file://, fully local','placement_upgrade_recall':'PASS','movement_damage_source_vfx':'PASS','pause_speed':'PASS','wave_result':cleared,'defeat_restart':'PASS','mobile_390':'PASS','console_errors':errors,'failed_resources':failed,'live':live}
    (ROOT/'qa-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
    browser.close()
