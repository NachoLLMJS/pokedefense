from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    results=[]
    for w,h in [(1920,1080),(1440,900),(1366,768),(1264,569),(390,844),(844,390)]:
        page.set_viewport_size({'width':w,'height':h})
        page.goto((ROOT/'index.html').as_uri())
        page.locator('#intro-play').click()
        page.wait_for_function('window.pokeDefense && document.fonts.status === "loaded"')
        page.wait_for_timeout(200)
        info=page.evaluate('''()=>{const c=document.querySelector('#battlefield'),r=c.getBoundingClientRect();return{width:innerWidth,height:innerHeight,canvas:{x:r.x,y:r.y,w:r.width,h:r.height},overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,blocked:TD.pads.map((p,i)=>{const s=pokeDefense.toScreen(p.x,p.y);const el=document.elementFromPoint(s.x,s.y);return el===c?null:{i,element:el?.className,x:s.x,y:s.y}}).filter(Boolean)}}''')
        assert info['canvas']=={'x':0,'y':0,'w':w,'h':h},info
        assert not info['overflow'],info
        assert not info['blocked'],info
        clipped=page.evaluate('''()=>Array.from(document.querySelectorAll('.pokemon-card')).filter(c=>{const t=c.querySelector('strong').getBoundingClientRect(),r=c.getBoundingClientRect();return t.right>r.right-3}).map(c=>c.querySelector('strong').textContent)''')
        assert not clipped,{'viewport':(w,h),'overflowing_names':clipped}
        # Real click through full-window inverse camera transform.
        page.locator('.pokemon-card[data-type="treecko"]').click()
        point=page.evaluate('pokeDefense.toScreen(TD.pads[4].x,TD.pads[4].y)')
        page.mouse.click(point['x'],point['y'])
        assert page.evaluate('pokeDefense.game.towers.length===1 && pokeDefense.game.towers[0].pad===4')
        assert page.locator('#upgrade').is_visible()
        page.locator('#inspector-close').click()
        assert not page.locator('#inspector').is_visible()
        page.screenshot(path=str(ROOT/f'qa-fullscreen-{w}x{h}.png'))
        results.append(info)
    assert not errors,errors
    print(json.dumps({'fullscreen_map':'PASS','overlay_controls':'PASS','camera_clicks':'PASS','no_obscured_pads':'PASS','console_errors':errors,'viewports':results},indent=2))
    browser.close()
