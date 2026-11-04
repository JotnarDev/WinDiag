import math
from PIL import Image, ImageDraw
# contour = list of segments: ('L',(x,y)) or ('A',cx,cy,r,a0,a1) (degrees, screen coords, y down); first must be ('M',(x,y))
def f(v): return ('%.2f'%v).rstrip('0').rstrip('.')
def pt(cx,cy,r,a): return (cx+r*math.cos(math.radians(a)), cy+r*math.sin(math.radians(a)))
def to_svg(contours):
    d=[]
    for c in contours:
        for s in c:
            if s[0]=='M': d.append('M%s %s'%(f(s[1][0]),f(s[1][1])))
            elif s[0]=='L': d.append('L%s %s'%(f(s[1][0]),f(s[1][1])))
            else:
                _,cx,cy,r,a0,a1=s; x,y=pt(cx,cy,r,a1)
                large=1 if abs(a1-a0)>180 else 0; sweep=1 if a1>a0 else 0
                if abs(a1-a0)>=359.9:
                    xm,ym=pt(cx,cy,r,(a0+a1)/2); d.append('A%s %s 0 0 %d %s %s'%(f(r),f(r),sweep,f(xm),f(ym)))
                d.append('A%s %s 0 %d %d %s %s'%(f(r),f(r),large,sweep,f(x),f(y)))
        d.append('Z')
    return ''.join(d)
def to_poly(c):
    p=[]
    for s in c:
        if s[0] in 'ML': p.append(s[1])
        else:
            _,cx,cy,r,a0,a1=s; n=max(8,int(abs(a1-a0)/2))
            p+= [pt(cx,cy,r,a0+(a1-a0)*i/n) for i in range(1,n+1)]
    return p
def raster(paths,size,ss=8,vb=256):
    """paths: list of contour-lists (each path evenodd); union across paths. returns L image (255=ink)"""
    S=size*ss; k=S/vb; out=Image.new('L',(S,S),0)
    for contours in paths:
        acc=Image.new('L',(S,S),0)
        for c in contours:
            m=Image.new('L',(S,S),0); ImageDraw.Draw(m).polygon([(x*k,y*k) for x,y in to_poly(c)],fill=255)
            from PIL import ImageChops; acc=ImageChops.logical_xor(acc.convert('1'),m.convert('1')).convert('L')
        from PIL import ImageChops; out=ImageChops.lighter(out,acc)
    return out.resize((size,size),Image.BOX)
def offset(poly,w):
    """left/right miter offsets of open polyline by half-width w"""
    def side(sgn):
        res=[]
        n=len(poly)
        norms=[]
        for i in range(n-1):
            (x0,y0),(x1,y1)=poly[i],poly[i+1]; L=math.hypot(x1-x0,y1-y0)
            norms.append((-(y1-y0)/L*sgn,(x1-x0)/L*sgn))
        for i in range(n):
            if i==0: nx,ny=norms[0]; res.append((poly[0][0]+nx*w,poly[0][1]+ny*w))
            elif i==n-1: nx,ny=norms[-1]; res.append((poly[-1][0]+nx*w,poly[-1][1]+ny*w))
            else:
                a,b=norms[i-1],norms[i]; mx,my=a[0]+b[0],a[1]+b[1]; dot=mx*a[0]+my*a[1]
                res.append((poly[i][0]+mx*w/dot,poly[i][1]+my*w/dot))
        return res
    return side(1),side(-1)
def svgfile(path,paths_d,fill='#000',bg=None):
    body=''.join('<path fill="%s" fill-rule="evenodd" d="%s"/>'%(fl if isinstance(fl,str) else fill,d) for d,fl in paths_d)
    bgr='<rect width="256" height="256" rx="56" fill="%s"/>'%bg if bg else ''
    open(path,'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">%s%s</svg>\n'%(bgr,body))
