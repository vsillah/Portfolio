#!/usr/bin/env python3
"""Make privacy-safe review excerpt reels from the exact local L02 motion outputs."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, re, subprocess

HERE=Path(__file__).resolve().parent
QA=HERE/'qa';QA.mkdir(exist_ok=True)
CAP=HERE/'l02-optional-captions.vtt'
SPECS=[('P01 opening',10,2,False),('P02 case',120,2,True),
       ('P03 value',243,3,True),('C03 cutaway',275,2,False),
       ('Question bridge',384,1.5,True),('P04 return',392,1.5,True)]
FONT='/System/Library/Fonts/Avenir Next.ttc'

def cue_at(t):
    for block in re.split(r'\n\s*\n',CAP.read_text()):
        m=re.search(r'(\d\d):(\d\d):(\d\d)\.(\d+) --> (\d\d):(\d\d):(\d\d)\.(\d+)',block)
        if not m:continue
        v=list(map(int,m.groups()))
        a=v[0]*3600+v[1]*60+v[2]+v[3]/1000
        b=v[4]*3600+v[5]*60+v[6]+v[7]/1000
        if a<=t<b:return ' '.join(block[m.end():].split()),a,b
    raise ValueError(f'no cue at {t}')

def wrap(d,s,font,width):
    lines=['']
    for word in s.split():
        trial=(lines[-1]+' '+word).strip()
        if d.textbbox((0,0),trial,font=font)[2]>width:lines.append(word)
        else:lines[-1]=trial
    return lines

def caption_png(path,size,text):
    w,h=size;im=Image.new('RGBA',size,(0,0,0,0));d=ImageDraw.Draw(im)
    font=ImageFont.truetype(FONT,50 if w>1000 else 25,index=3)
    maxw=int(w*.77) if w>1000 else w-40
    lines=wrap(d,text,font,maxw)
    lineh=62 if w>1000 else 32
    top=(h-158)-lineh*len(lines) if w>1000 else (h-85)-lineh*len(lines)
    x0=(w-maxw)//2-24 if w>1000 else 16
    x1=w-x0
    d.rounded_rectangle((x0,top-12,x1,top+lineh*len(lines)+12),radius=10,fill=(3,19,27,225))
    for j,s in enumerate(lines):
        box=d.textbbox((0,0),s,font=font);x=(w-(box[2]-box[0]))//2
        d.text((x,top+j*lineh),s,font=font,fill=(250,248,238,255))
    im.save(path)

def run(args):subprocess.run(args,check=True)

def make(aspect,size):
    src=HERE/f'l02-presenter-{aspect}-review-{size[0]}x{size[1]}.mp4'
    work=QA/f'walkthrough-{aspect}-parts'
    if work.exists():raise SystemExit(f'walkthrough already attempted: {aspect}')
    work.mkdir()
    parts=[];rows=[]
    for i,(name,start,duration,captions) in enumerate(SPECS):
        clip=work/f'{i:02d}.mp4'
        args=['ffmpeg','-v','error','-n','-ss',str(start),'-t',str(duration),'-i',str(src)]
        if captions:
            line,a,b=cue_at(start+.2)
            if start+duration>b+.1:raise SystemExit(f'caption changes inside clip: {name}')
            overlay=work/f'{i:02d}-caption.png';caption_png(overlay,size,line)
            args+=['-loop','1','-i',str(overlay),'-filter_complex','[0:v][1:v]overlay=0:0:shortest=1,format=yuv420p[v]','-map','[v]','-map','0:a:0']
        else:
            line=None;args+=['-map','0:v:0','-map','0:a:0']
        args+=['-r','25','-c:v','libx264','-preset','ultrafast','-crf','21','-pix_fmt','yuv420p',
               '-c:a','aac','-b:a','192k','-ar','48000','-ac','1','-movflags','+faststart',str(clip)]
        run(args);parts.append(clip)
        rows.append({'scene':name,'source_start_seconds':start,'duration_seconds':duration,'optional_caption_overlay':line})
    listing=work/'parts.ffconcat'
    listing.write_text(''.join(f"file '{p.resolve()}'\n" for p in parts))
    out=QA/f'l02-presenter-{aspect}-human-qa-walkthrough.mp4'
    run(['ffmpeg','-v','error','-n','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(out)])
    h=hashlib.sha256(out.read_bytes()).hexdigest()
    return {'path':str(out),'sha256':h,'segments':rows}

def main():
    outputs={'desktop':make('desktop',(1920,1080)),'portrait':make('portrait',(390,844))}
    (QA/'walkthrough-receipt.json').write_text(json.dumps({'status':'review_excerpt_from_exact_rendered_pair','outputs':outputs,'caption_source':str(CAP),'privacy':'synthetic teaching art and approved presenter only; no private app state','limitation':'MP4 excerpts show the exact rendered media and cue states; browser player interaction was separately checked in the in-app review route.'},indent=2)+'\n')
    print(json.dumps({k:{'path':v['path'],'sha256':v['sha256']} for k,v in outputs.items()},indent=2))
if __name__=='__main__':main()
