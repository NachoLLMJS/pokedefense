from pathlib import Path
from PIL import Image
import hashlib
ROOT=Path(__file__).resolve().parent
original=ROOT.parent/'8192.gif'
retained=ROOT/'assets/source-buildings.gif'
asset=ROOT/'assets/nexus-house.png'
assert retained.exists(),'Supplied building sheet must be retained'
assert retained.read_bytes()==original.read_bytes(),'Source sheet must be copied exactly'
source=Image.open(retained)
assert source.n_frames==1
expected=source.convert('RGBA').crop((76,91,140,166))
actual=Image.open(asset).convert('RGBA')
assert actual.size==(64,75),actual.size
assert actual.tobytes()==expected.tobytes(),'Use supplied pixels and transparency, not a redrawn house'
assert actual.getchannel('A').getextrema()==(0,255)
assert not (ROOT/'assets/nexus.png').exists(),'Retired house must not be loaded accidentally'
print({'nexus':'orange-roof chimney house from supplied GIF','pixels':'exact crop, original alpha','size':actual.size,'source_frames':source.n_frames,'sha256':hashlib.sha256(actual.tobytes()).hexdigest()})
