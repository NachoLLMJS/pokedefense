from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(r'C:\Users\nacho\Desktop\PokeDefense')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto((ROOT/'index.html').as_uri())
    page.wait_for_function('window.pokeDefense && window.RescueMap && document.fonts.status === "loaded"')
    assert page.evaluate('RescueMap.seed')==723
    assert page.evaluate('document.querySelectorAll(".pokemon-card").length')==6
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(ROOT/'qa-map-desktop.png'),full_page=True)
    map_state=page.evaluate('({source:RescueMap.source,biome:RescueMap.biome,props:G.World.visibleProps(RescueMap.camera).length,seed:RescueMap.seed})')
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(150)
    assert page.evaluate('innerWidth')==390
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(ROOT/'qa-map-mobile.png'),full_page=True)
    assert not errors,errors
    print(json.dumps({'file_protocol':'PASS','desktop':'PASS','mobile_390':'PASS','console_errors':errors,'map':map_state},indent=2))
    browser.close()
