from pathlib import Path
import sys, json, math, collections, re

sys.stdout.reconfigure(encoding='utf-8')
WORK = Path(__file__).resolve().parent
SOURCE = WORK / 'dxf/drawing.dxf'

def entities():
    section = None
    block = None
    kind, pairs = None, []
    with SOURCE.open(encoding='utf-8', errors='replace') as stream:
        while True:
            raw = stream.readline()
            if not raw: break
            val = stream.readline().rstrip('\r\n')
            try: code = int(raw.strip())
            except ValueError: continue
            if code == 0:
                if kind is not None:
                    values = dict(pairs)
                    if kind == 'SECTION': section = values.get(2)
                    elif kind == 'ENDSEC': section = None
                    elif kind == 'BLOCK': block = values.get(2)
                    elif kind == 'ENDBLK': block = None
                    elif section in ('ENTITIES', 'BLOCKS'):
                        yield section, block, kind, pairs, values
                kind, pairs = val.strip(), []
            elif kind is not None:
                pairs.append((code,val))

def number(v, k, default=0):
    try: return float(v.get(k,default))
    except (ValueError,TypeError): return default

def points(kind,pairs,v):
    if kind == 'LINE':return [(number(v,10),number(v,20)),(number(v,11),number(v,21))]
    if kind == 'LWPOLYLINE':
        result=[]; x=None
        for k,value in pairs:
            if k==10:x=float(value)
            elif k==20 and x is not None: result.append((x,float(value)));x=None
        return result
    if kind in ('CIRCLE','ARC'):
        x,y,r=number(v,10),number(v,20),number(v,40)
        return [(x-r,y-r),(x+r,y+r)]
    if 10 in v and 20 in v:return [(number(v,10),number(v,20))]
    return []

def expand(b,ps):
    for x,y in ps:
        if not math.isfinite(x+y):continue
        b[0]=min(b[0],x);b[1]=min(b[1],y);b[2]=max(b[2],x);b[3]=max(b[3],y)

def decode(s):
    return re.sub(r'\\U\+([0-9A-Fa-f]{4})',lambda m:chr(int(m[1],16)),s)

def inspect():
    layers={};texts=[];blocks={};types=collections.Counter();bbox=[math.inf,math.inf,-math.inf,-math.inf]
    for section,block,kind,pairs,v in entities():
        ps=points(kind,pairs,v)
        if section=='ENTITIES':
            types[kind]+=1;expand(bbox,ps)
            layer=v.get(8,'0');record=layers.setdefault(layer,{'count':0,'bbox':[math.inf,math.inf,-math.inf,-math.inf]})
            record['count']+=1;expand(record['bbox'],ps)
        else:
            record=blocks.setdefault(block,{'count':0,'bbox':[math.inf,math.inf,-math.inf,-math.inf]});record['count']+=1;expand(record['bbox'],ps)
        if kind in ('TEXT','MTEXT'):
            text=''.join(value for k,value in pairs if k in (1,3))
            texts.append({'section':section,'block':block,'layer':v.get(8),'text':decode(text),'x':number(v,10),'y':number(v,20),'height':number(v,40),'rotation':number(v,50)})
    result={'types':dict(types),'bbox':bbox,'layers':layers,'blocks':blocks,'texts':texts,'caveats':['Low-memory DXF XY inspection only. Block insert transforms and unsupported entities are not flattened into the model bbox. Historical geometry is not a current survey.']}
    (WORK/'inspection.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    hits=[t for t in texts if any(word in t['text'] for word in ['경비','주차','정문','출입','유산','배치','도로','펜스'])]
    print(json.dumps({'types':dict(types),'bbox':bbox,'texts':len(texts),'keyword_texts':hits[:80],'layers':len(layers),'blocks':len(blocks)},ensure_ascii=False))

def render(bbox,filename):
    from PIL import Image,ImageDraw,ImageFont
    xmin,ymin,xmax,ymax=bbox
    side=3000; margin=30;scale=(side-margin*2)/max(xmax-xmin,ymax-ymin)
    w=int((xmax-xmin)*scale)+margin*2;h=int((ymax-ymin)*scale)+margin*2
    image=Image.new('RGB',(w,h),'white');draw=ImageDraw.Draw(image);count=collections.Counter()
    def xy(p):return (margin+(p[0]-xmin)*scale,margin+(ymax-p[1])*scale)
    for section,block,kind,pairs,v in entities():
        if section!='ENTITIES':continue
        ps=points(kind,pairs,v)
        if not ps:continue
        bx=min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)
        if bx[2]<xmin or bx[0]>xmax or bx[3]<ymin or bx[1]>ymax:continue
        if kind=='LINE':draw.line([xy(p) for p in ps],fill='#333333',width=1);count[kind]+=1
        elif kind=='LWPOLYLINE' and len(ps)>1:
            pts=[xy(p) for p in ps]
            if int(number(v,70))&1:pts.append(pts[0])
            draw.line(pts,fill='#333333',width=1);count[kind]+=1
        elif kind in ('CIRCLE','ARC'):
            rect=[xy((ps[0][0],ps[1][1])),xy((ps[1][0],ps[0][1]))]
            try:
                if kind=='CIRCLE':draw.ellipse(rect,outline='#666666')
                else:draw.arc(rect,-number(v,51),-number(v,50),fill='#666666')
                count[kind]+=1
            except ValueError:pass
        elif kind in ('TEXT','MTEXT'):
            text=decode(''.join(value for k,value in pairs if k in (1,3))).replace('\\P',' ')
            fontsize=max(7,min(40,int(number(v,40)*scale)))
            font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',fontsize)
            draw.text(xy(ps[0]),text,font=font,fill='#183c70');count[kind]+=1
        elif kind=='INSERT':
            x,y=xy(ps[0]);draw.line([(x-2,y),(x+2,y)],fill='#a55322');draw.line([(x,y-2),(x,y+2)],fill='#a55322');count[kind]+=1
    dest=WORK/filename;image.save(dest)
    print(json.dumps({'file':str(dest),'image_size':[w,h],'drawn':dict(count),'bbox':bbox,'scale':scale,'caveat':'XY diagnostic only: INSERT blocks marked at insertion point; HATCH and complex objects omitted; text rotation not preserved.'},ensure_ascii=False))

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='render':render([float(s) for s in sys.argv[2:6]],sys.argv[6])
    else:inspect()
