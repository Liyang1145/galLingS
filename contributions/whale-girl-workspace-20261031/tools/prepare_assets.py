from pathlib import Path
import urllib.request, math
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
game = root/'Seabreeze/game'
(game/'images').mkdir(exist_ok=True)
(game/'fonts').mkdir(exist_ok=True)
for name, top, bottom in [('day',(135,197,209),(238,231,200)),('sunset',(181,164,177),(244,215,174))]:
    im=Image.new('RGB',(1280,720)); d=ImageDraw.Draw(im)
    for y in range(720):
        t=y/720
        col=tuple(int(a*(1-t)+b*t) for a,b in zip(top,bottom))
        d.line((0,y,1280,y),fill=col)
    d.ellipse((900,95,1010,205), fill=(255,237,196))
    d.rectangle((0,285,1280,720), fill=(71,130,143) if name=='day' else (86,126,137))
    for k in range(18):
        y=305+k*24
        pts=[(x,y+math.sin(x/85+k)*6) for x in range(0,1281,8)]
        d.line(pts,fill=(143,187,182),width=2)
    d.polygon([(0,530),(270,505),(540,540),(860,635),(1280,660),(1280,720),(0,720)],fill=(219,205,171))
    d.ellipse((-170,515,250,760),fill=(68,96,101))
    im.save(game/'images'/f'{name}.png')
base='https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/'
for remote,local in [('NotoSansSC%5Bwght%5D.ttf','NotoSansSC.ttf'),('OFL.txt','OFL.txt')]:
    path=game/'fonts'/local
    if not path.exists(): urllib.request.urlretrieve(base+remote,path)
print('Placeholder backgrounds and licensed Chinese font ready.')
