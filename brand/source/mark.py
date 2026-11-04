import os,sys,math; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from geo import *
def poly_c(pts): return [('M',pts[0])]+[('L',p) for p in pts[1:]]
def rrect(x,y,w,h,r):
    return [('M',(x+r,y)),('L',(x+w-r,y)),('A',x+w-r,y+r,r,-90,0),('L',(x+w,y+h-r)),('A',x+w-r,y+h-r,r,0,90),
            ('L',(x+r,y+h)),('A',x+r,y+h-r,r,90,180),('L',(x,y+r)),('A',x+r,y+r,r,180,270)]
def clip(poly,y,keep_below):
    out=[]; n=len(poly); ins=lambda p:(p[1]>=y) if keep_below else (p[1]<=y)
    for i in range(n):
        a,b=poly[i],poly[(i+1)%n]
        if ins(a): out.append(a)
        if ins(a)!=ins(b): t=(y-a[1])/(b[1]-a[1]); out.append((a[0]+(b[0]-a[0])*t,y))
    return out
def W(top,bot,mid,hw,ang=68,cx=128,spread=6):
    t=math.tan(math.radians(ang)); xB1=cx-(bot-mid)/t-spread; xT1=xB1-(bot-top)/t; e=24/t
    line=[(xT1-e,top-24),(xT1,top),(xB1,bot),(cx,mid),(2*cx-xB1,bot),(2*cx-xT1,top),(2*cx-xT1+e,top-24)]
    l,r=offset(line,hw); p=l+r[::-1]; return poly_c(clip(clip(p,top,True),bot+hw,False))
def mark(small=False, bump=True):
    body=rrect(16,16,224,224,52)
    if small:   # 16-32 px cut: thicker walls, bigger W, no bump
        face=rrect(40,32,176,152,30); w=W(60,144,96,17,ang=66,spread=48/math.tan(math.radians(60))-48/math.tan(math.radians(66))); return {'body':[body,face],'face':[face],'w':[w],'bump':None}
    face=rrect(38,30,180,164,32)
    if bump:
        w=W(60,140,96,13); b=rrect(104,160,48,12,6)
    else:
        w=W(62,146,100,13,spread=46/math.tan(math.radians(60))-46/math.tan(math.radians(68))); b=None
    return {'body':[body,face],'face':[face],'w':[w],'bump':[b] if b else None}
