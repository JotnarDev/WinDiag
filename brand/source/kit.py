# Regenerates every brand file from the geometry in mark.py:
#   python3 brand/source/kit.py
# Writes brand/svg, brand/png, brand/icons and the app and website icons in the repo
# (build/, resources/, src/renderer/src/assets/, website/public/). Needs Pillow and fontTools.
import sys,os,math,json
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
from mark import *
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.basePen import BasePen
OUT=os.path.normpath(os.path.join(HERE,'..'))
CYAN='#22E3F2'; CYAN_DEEP='#0E7490'; CARBON='#141619'; GRAPH='#23262B'; PAPER='#F4F5F6'
FONT=os.path.join(HERE,'fonts','SpaceGrotesk-Variable.ttf')
for d in ['svg','png','icons/web']:
    os.makedirs(f'{OUT}/{d}',exist_ok=True)
# ---------- wordmark ----------
font=instantiateVariableFont(TTFont(FONT),{'wght':600})
gs=font.getGlyphSet(); cmap=font.getBestCmap(); upm=font['head'].unitsPerEm
TRACK=-6  # font units, slight tightening for display size
KERN={('W','i'):-10,('D','i'):0,('a','g'):0}
class FlatPen(BasePen):
    def __init__(s,gs,T): super().__init__(gs); s.T=T; s.cs=[]; s.cur=None
    def _moveTo(s,p): s.cur=[('M',s.T(p))]; s.cs.append(s.cur); s.last=p
    def _lineTo(s,p): s.cur.append(('L',s.T(p))); s.last=p
    def _curveToOne(s,a,b,c):
        p0=s.last
        for i in range(1,13):
            t=i/12; x=(1-t)**3*p0[0]+3*(1-t)**2*t*a[0]+3*(1-t)*t*t*b[0]+t**3*c[0]; y=(1-t)**3*p0[1]+3*(1-t)**2*t*a[1]+3*(1-t)*t*t*b[1]+t**3*c[1]
            s.cur.append(('L',s.T((x,y))))
        s.last=c
    def _qCurveToOne(s,a,b):
        p0=s.last
        for i in range(1,11):
            t=i/10; x=(1-t)**2*p0[0]+2*(1-t)*t*a[0]+t*t*b[0]; y=(1-t)**2*p0[1]+2*(1-t)*t*a[1]+t*t*b[1]; s.cur.append(('L',s.T((x,y))))
        s.last=b
    def _closePath(s): pass
def wordmark(text,x0,base,cap):
    s=cap/font['OS/2'].sCapHeight; x=0; d=''; cs=[]; prev=None
    for ch in text:
        g=cmap[ord(ch)]
        if prev: x+=KERN.get((prev,ch),0)+TRACK
        ox=x
        sp=SVGPathPen(gs); gs[g].draw(TransformPen(sp,(s,0,0,-s,x0+ox*s,base))); d+=sp.getCommands()
        fp=FlatPen(gs,lambda p,ox=ox:(x0+(ox+p[0])*s,base-p[1]*s)); gs[g].draw(fp); cs+=fp.cs
        x+=font['hmtx'][g][0]; prev=ch
    return d,cs,(x-0)*s  # width approx (advance)
# ---------- symbol ----------
def sym(m,dx=0,dy=0,k=1.0):
    T=lambda c:[(s[0],(dx+s[1][0]*k,dy+s[1][1]*k)) if s[0] in 'ML' else ('A',dx+s[1]*k,dy+s[2]*k,s[3]*k,s[4],s[5]) for s in c]
    return {key:[T(c) for c in v] if v else None for key,v in m.items()}
M=mark(bump=False); MS=mark(small=True)
def layers(m,mode,wcol=None):
    """mode: color | mono(col) ; returns list of (contours, colour)"""
    if mode=='color': return [(m['body'],CYAN),(m['face'],CARBON),(m['w'],PAPER)]
    return [(m['body'],mode),(m['w'],mode)]
def write_svg(path,items,w,h,title,bg=None,size=None):
    sz=f' width="{size}" height="{size}"' if size else ''
    body=''.join(f'<path fill="{c}" fill-rule="evenodd" d="{d if isinstance(d,str) else to_svg(d)}"/>' for d,c in items)
    b=f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    open(path,'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}"{sz} role="img" aria-label="{title}"><title>{title}</title>{b}{body}</svg>\n')
def render(items,W,H,scale,bg=(0,0,0,0)):
    """items: list of (contours-list, colour); raster at W*scale"""
    w,h=round(W*scale),round(H*scale); im=Image.new('RGBA',(w,h),bg); ss=4
    for cs,c in items:
        mask=Image.new('L',(w*ss,h*ss),0)
        acc=None
        for cont in cs:
            m=Image.new('1',(w*ss,h*ss),0); ImageDraw.Draw(m).polygon([(x*scale*ss,y*scale*ss) for x,y in to_poly(cont)],fill=1)
            from PIL import ImageChops; acc=m if acc is None else ImageChops.logical_xor(acc,m)
        mask=acc.convert('L').resize((w,h),Image.BOX)
        im.paste(Image.new('RGBA',(w,h),c),(0,0),mask)
    return im
# symbol svgs
def sitems(m,mode): return [(c,col) for c,col in layers(m,mode)]
for name,m in [('windiag-symbol',M),('windiag-symbol-small',MS)]:
    write_svg(f'{OUT}/svg/{name}.svg',sitems(m,'color'),256,256,'WinDiag')
    for tag,col in [('black','#000000'),('white','#FFFFFF'),('cyan',CYAN),('carbon',CARBON)]:
        write_svg(f'{OUT}/svg/{name}-{tag}.svg',sitems(m,col),256,256,'WinDiag')
# lockups
CAPH=88; GAP=48
wd,wcs,ww=wordmark('WinDiag',256+GAP,128+CAPH/2,CAPH)
HW=math.ceil(max(p[1][0] for c in wcs for p in c if p[0]!='A')+16)
def lock_items(m,mode,wcol):
    return sitems(m,mode)+[(wd,wcol)]
LOCK={'horizontal':{'w':HW,'h':256}}
for tag,mode,wcol in [('on-dark','color',PAPER),('on-light','color',CARBON),('black','#000000','#000000'),('white','#FFFFFF','#FFFFFF')]:
    write_svg(f'{OUT}/svg/windiag-horizontal-{tag}.svg',lock_items(M,mode,wcol),HW,256,'WinDiag')
# stacked
SC=78; sd,scs,sw=wordmark('WinDiag',0,0,SC)
xs=[p[1][0] for c in scs for p in c]; mn,mx=min(xs),max(xs)
SW=math.ceil(max(256,mx-mn+32)); sx=(SW-(mx-mn))/2-mn; base=256+40+SC
sd,scs,sw=wordmark('WinDiag',sx,base,SC); SH=math.ceil(max(p[1][1] for c in scs for p in c)+16)
Ms=sym(M,dx=(SW-256)/2)
for tag,mode,wcol in [('on-dark','color',PAPER),('on-light','color',CARBON),('black','#000000','#000000'),('white','#FFFFFF','#FFFFFF')]:
    write_svg(f'{OUT}/svg/windiag-stacked-{tag}.svg',sitems(Ms,mode)+[(sd,wcol)],SW,SH,'WinDiag')
# wordmark only
wd0,wcs0,ww0=wordmark('WinDiag',0,CAPH,CAPH); WH=CAPH*1.3
for tag,col in [('carbon',CARBON),('paper',PAPER),('black','#000000'),('white','#FFFFFF')]:
    write_svg(f'{OUT}/svg/windiag-wordmark-{tag}.svg',[(wd0,col)],ww0,WH,'WinDiag')
# ---------- PNGs ----------
def sym_png(size,m=None,bg=(0,0,0,0)):
    m=m or (MS if size<=32 else M); return render([(c,col) for c,col in layers(m,'color')],256,256,size/256,bg)
for s in (16,24,32,48,64,128,256,512,1024): sym_png(s).save(f'{OUT}/png/windiag-symbol-{s}.png')
render([(M['body'],'#000'),(M['w'],'#000')],256,256,2).save(f'{OUT}/png/windiag-symbol-black-512.png')
render([(M['body'],'#fff'),(M['w'],'#fff')],256,256,2).save(f'{OUT}/png/windiag-symbol-white-512.png')
hl=lambda wc: [(c,col) for c,col in layers(M,'color')]+[(wcs,wc)]
render(hl(PAPER),HW,256,1200/HW).save(f'{OUT}/png/windiag-horizontal-on-dark-1200.png')
render(hl(CARBON),HW,256,1200/HW).save(f'{OUT}/png/windiag-horizontal-on-light-1200.png')
render([(c,col) for c,col in layers(Ms,'color')]+[(scs,PAPER)],SW,SH,800/SH).save(f'{OUT}/png/windiag-stacked-on-dark-800.png')
render([(c,col) for c,col in layers(Ms,'color')]+[(scs,CARBON)],SW,SH,800/SH).save(f'{OUT}/png/windiag-stacked-on-light-800.png')
# ---------- Windows .ico ----------
ico_sizes=[16,24,32,48,64,128,256]
imgs=[sym_png(s) for s in ico_sizes]
imgs[-1].save(f'{OUT}/icons/windiag.ico',format='ICO',sizes=[(s,s) for s in ico_sizes],append_images=imgs[:-1])
# ---------- web icons ----------
W_=f'{OUT}/icons/web'
write_svg(f'{W_}/favicon.svg',sitems(MS,'color'),256,256,'WinDiag')
fav=[sym_png(s) for s in (16,32,48)]
fav[-1].save(f'{W_}/favicon.ico',format='ICO',sizes=[(16,16),(32,32),(48,48)],append_images=fav[:-1])
for s,im in zip((16,32,48),fav): im.save(f'{W_}/favicon-{s}.png')
def on_tile(size,k):
    bg=Image.new('RGBA',(size,size),CARBON); m=sym(M,dx=128-128*k,dy=128-128*k,k=k)
    return Image.alpha_composite(bg,render([(c,col) for c,col in layers(m,'color')],256,256,size/256))
on_tile(180,0.78).convert('RGB').save(f'{W_}/apple-touch-icon.png')
sym_png(192).save(f'{W_}/icon-192.png'); sym_png(512).save(f'{W_}/icon-512.png')
on_tile(512,0.66).save(f'{W_}/maskable-512.png')
json.dump({"name":"WinDiag","short_name":"WinDiag","icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png"},{"src":"maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}],"theme_color":CARBON,"background_color":CARBON,"display":"standalone"},open(f'{W_}/site.webmanifest','w'),indent=2)
open(f'{W_}/head-snippet.html','w').write('''<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#141619">
''')
# ---------- OG image ----------
og=Image.new('RGBA',(1200,630),CARBON)
lk=render(hl(PAPER),HW,256,150/256); og.alpha_composite(lk,((1200-lk.width)//2,190))
fnt=ImageFont.truetype(FONT,34); fnt.set_variation_by_axes([500])
d=ImageDraw.Draw(og); t='Test it. Fix it. Hand it over.'; tw=d.textlength(t,font=fnt)
d.text(((1200-tw)/2,400),t,font=fnt,fill='#9AA0A6')
d.rectangle((0,622,1200,630),fill=CYAN)
og.convert('RGB').save(f'{OUT}/png/og-image.png')
# ---------- repo drop-in ----------
R=os.path.normpath(os.path.join(OUT,'..'))  # the repo root
write_svg(f'{R}/build/icon.svg',sitems(M,'color'),256,256,'WinDiag',size=1024)
write_svg(f'{R}/build/icon-small.svg',sitems(MS,'color'),256,256,'WinDiag',size=1024)
import shutil; shutil.copy(f'{OUT}/icons/windiag.ico',f'{R}/build/icon.ico')
sym_png(1024).save(f'{R}/build/icon.png'); sym_png(512).save(f'{R}/resources/icon.png')
sym_png(64).save(f'{R}/src/renderer/src/assets/app-icon.png')
sym_png(64).save(f'{R}/website/public/app-icon.png'); sym_png(64).save(f'{R}/website/public/favicon.png')
write_svg(f'{R}/website/public/app-icon.svg',sitems(M,'color'),256,256,'WinDiag')
shutil.copy(f'{OUT}/png/og-image.png',f'{R}/website/public/og-image.png')
# ---------- kit overview (brand/kit-overview.png) ----------
def ofont(s,w=500):
    fo=ImageFont.truetype(FONT,s); fo.set_variation_by_axes([w]); return fo
ov=Image.new('RGBA',(1600,1300),'#0E0F11'); od=ImageDraw.Draw(ov)
od.text((48,36),'WinDiag — brand kit',font=ofont(36,700),fill=PAPER)
def tile(path,box,bg,mw,mh):
    x,y,w,h=box; od.rounded_rectangle((x,y,x+w,y+h),14,fill=bg)
    a=Image.open(path); kk=min(mw/a.width,mh/a.height); a=a.resize((int(a.width*kk),int(a.height*kk)),Image.LANCZOS)
    ov.alpha_composite(a,(x+(w-a.width)//2,y+(h-a.height)//2))
tile(f'{OUT}/png/windiag-horizontal-on-dark-1200.png',(48,100,960,260),CARBON,860,170)
tile(f'{OUT}/png/windiag-horizontal-on-light-1200.png',(48,380,960,260),PAPER,860,170)
tile(f'{OUT}/png/windiag-stacked-on-dark-800.png',(1028,100,524,540),GRAPH,360,360)
for row,(bg,yy) in enumerate([('#202124',660),('#F3F3F3',870)]):
    od.rounded_rectangle((48,yy,1008,yy+200),14,fill=bg); xx=80
    for s in (128,64,48,32,24,16):
        ov.alpha_composite(Image.open(f'{OUT}/png/windiag-symbol-{s}.png'),(xx,yy+100-s//2)); xx+=s+50
    od.text((xx+20,yy+90),'128 · 64 · 48 · 32 · 24 · 16 px',font=ofont(18),fill='#9AA0A6' if row==0 else '#5d5d5d')
for i,(n,c) in enumerate([('Cyan',CYAN),('Carbon',CARBON),('Paper',PAPER),('Graphite',GRAPH),('Cyan Deep',CYAN_DEEP)]):
    yy=660+i*82; od.rounded_rectangle((1028,yy,1552,yy+72),12,fill=c,outline='#3a3d42')
    tc=CARBON if n in ('Cyan','Paper') else PAPER
    od.text((1052,yy+20),n,font=ofont(24,600),fill=tc); od.text((1408,yy+22),c,font=ofont(20),fill=tc)
od.rounded_rectangle((48,1090,1552,1260),14,fill='#2b2e33'); xx=90
for p,bg in [('windiag-symbol-black-512.png','#ffffff'),('windiag-symbol-white-512.png',CARBON),('windiag-symbol-white-512.png',CYAN_DEEP)]:
    od.rounded_rectangle((xx,1105,xx+140,1245),10,fill=bg); ov.alpha_composite(Image.open(f'{OUT}/png/{p}').resize((120,120),Image.LANCZOS),(xx+10,1115)); xx+=170
od.text((620,1160),'one colour · reversed',font=ofont(20),fill='#9AA0A6')
ov.alpha_composite(Image.open(f'{OUT}/png/og-image.png').convert('RGBA').resize((300,158)),(1220,1096))
ov.convert('RGB').save(f'{OUT}/kit-overview.png')
print('kit written to',OUT)
