from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent

def deploy(page,kind,pad):
    page.locator(f'.pokemon-card[data-type="{kind}"]').click()
    q=page.evaluate('(i)=>{const p=TD.pads[i];return pokeDefense.toScreen(p.x,p.y)}',pad)
    page.mouse.click(q['x'],q['y'])

def clear_wave(page):
    return page.evaluate('''()=>{const g=pokeDefense.game;for(let i=0;i<12000&&g.status==='wave';i++)g.update(.05);return {hp:g.hp,status:g.status,wave:g.wave,kills:g.kills,projectiles:G.Projectiles.count,fields:G.Combat.fieldCount,fx:G.FX.count}}''')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[];failed=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('requestfailed',lambda req:failed.append(req.url))
    page.goto((ROOT/'index.html').as_uri())
    page.locator('#intro-play').click()
    page.wait_for_function('window.pokeDefense && document.fonts.status === "loaded"')
    for kind,pad in [('treecko',0),('squirtle',1),('pikachu',2),('piplup',3)]:deploy(page,kind,pad)
    assert page.evaluate('pokeDefense.game.towers.length')==4
    page.locator('#launch').click()
    page.wait_for_function('G.Projectiles.count>0')
    page.wait_for_timeout(100)
    state=clear_wave(page)
    assert state['status']=='ready',state
    assert state['projectiles']==state['fields']==state['fx']==0,state
    page.wait_for_function('!document.querySelector("#overlay").hidden',timeout=2500)
    assert page.locator('#overlay-title').inner_text()=='Wave 1 cleared!'
    assert '12' in page.locator('#overlay-copy').inner_text()
    assert page.locator('#overlay-close').inner_text()=='NEXT WAVE →'
    assert page.locator('#overlay-prepare').is_visible()
    r=page.locator('.dialog').bounding_box()
    assert abs(r['x']+r['width']/2-720)<2 and abs(r['y']+r['height']/2-450)<2,r
    assert page.evaluate('pokeDefense.game.towers.every(t=>pokeDefense.skills.actor(t.id).anim.cur==="Idle")')
    before=page.evaluate('JSON.stringify(pokeDefense.skills.actor(pokeDefense.game.towers[0].id).anim.t)')
    page.wait_for_timeout(137)
    after=page.evaluate('JSON.stringify(pokeDefense.skills.actor(pokeDefense.game.towers[0].id).anim.t)')
    assert before!=after,'Idle animation must continue under between-wave modal'
    page.screenshot(path=str(ROOT/'qa-wave-modal-desktop.png'))
    page.locator('#overlay-prepare').click()
    assert page.locator('#overlay').is_hidden()
    assert page.evaluate('pokeDefense.game.status')=='ready'
    page.locator('#launch').click()
    assert page.evaluate('pokeDefense.game.wave')==2
    state2=clear_wave(page)
    assert state2['status']=='ready',state2
    page.wait_for_function('!document.querySelector("#overlay").hidden')
    assert page.locator('#overlay-title').inner_text()=='Wave 2 cleared!'
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(150)
    page.screenshot(path=str(ROOT/'qa-wave-modal-mobile.png'))
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#overlay-close').click()
    assert page.evaluate('pokeDefense.game.wave===3 && pokeDefense.game.status==="wave" && !pokeDefense.paused')
    assert page.locator('#overlay').is_hidden()
    assert page.evaluate('TD.waveInfo(3).count')==16
    # Verify every declared enemy walk sheet decodes, not just file existence.
    assets=page.evaluate('''async()=>{const bad=[];for(const d of TD.enemyDex){const im=new Image();im.src=`assets/pokemon/${d}/Walk.png`;try{await im.decode();const m=G.SPRITE_META[d].a.Walk;if(im.width!==m.w*m.n||im.height!==m.h*m.r)bad.push(d);}catch{bad.push(d);}}return {count:TD.enemyDex.length,bad};}''')
    assert not assets['bad'],assets
    assert not errors,errors
    assert not failed,failed
    result={'wave1':state,'wave2':state2,'modal_next_and_prepare':'PASS','idle_animations':'PASS','mobile_modal':'PASS','enemy_sheets':assets,'console_errors':errors,'failed_resources':failed}
    (ROOT/'qa-phases-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
    browser.close()
