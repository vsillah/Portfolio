import re,subprocess,textwrap
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
font_path='/System/Library/Fonts/Supplemental/Arial.ttf'
for lesson in ('L09','L13'):
 for layout in ('desktop','mobile'):
  folder=root/f'agentified/workshop/phase-3b-review/{lesson}/context'
  source=folder/f'{lesson}-{layout}-context.mp4'
  vtt=folder/f'{lesson}-{layout}-context.vtt'
  width,height=(1280,720) if layout=='desktop' else (390,844)
  font=ImageFont.truetype(font_path,28 if layout=='desktop' else 20)
  cues=[]
  for block in vtt.read_text().strip().split('\n\n')[1:]:
   lines=block.splitlines();match=re.fullmatch(r'(\d\d):(\d\d):(\d\d\.\d{3}) --> (\d\d):(\d\d):(\d\d\.\d{3})',lines[0]);assert match,block
   start=int(match[1])*3600+int(match[2])*60+float(match[3]);end=int(match[4])*3600+int(match[5])*60+float(match[6]);text=' '.join(lines[1:])
   cues.append((start,end,text))
  temp=Path('/tmp')/f'agentified-{lesson}-{layout}-overlays';temp.mkdir(exist_ok=True)
  pngs=[]
  for i,(start,end,caption) in enumerate(cues):
   im=Image.new('RGBA',(width,height),(0,0,0,0));draw=ImageDraw.Draw(im)
   max_width=width-60 if layout=='mobile' else width-180
   words=caption.split();lines=[];line=''
   for word in words:
    trial=(line+' '+word).strip()
    if draw.textbbox((0,0),trial,font=font)[2]>max_width and line:lines.append(line);line=word
    else:line=trial
   if line:lines.append(line)
   line_height=28 if layout=='mobile' else 36
   box_height=line_height*len(lines)+24
   y=(552 if layout=='mobile' else height-box_height-28)
   x=12 if layout=='mobile' else 72
   draw.rounded_rectangle((x,y,width-x,y+box_height),radius=10,fill=(3,20,31,228))
   for j,line in enumerate(lines):
    bbox=draw.textbbox((0,0),line,font=font);tx=(width-(bbox[2]-bbox[0]))/2
    draw.text((tx,y+10+j*line_height),line,font=font,fill=(255,255,255,255))
   png=temp/f'{i}.png';im.save(png);pngs.append(png)
  inputs=['-i',str(source)]
  for png in pngs:inputs+=['-loop','1','-framerate','25','-i',str(png)]
  filters=[];prev='[0:v]'
  for i,(start,end,_) in enumerate(cues):
   out=f'[v{i}]';filters.append(f'{prev}[{i+1}:v]overlay=0:0:enable=between(t\\,{start:.3f}\\,{end:.3f}){out}');prev=out
  target=folder/f'{lesson}-{layout}-captioned.mp4'
  cmd=['ffmpeg','-y','-hide_banner','-loglevel','error',*inputs,'-filter_complex',';'.join(filters),'-map',prev,'-map','0:a:0','-map','0:s:0','-t','18' if lesson=='L09' else '16','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','copy','-c:s','copy','-movflags','+faststart',str(target)]
  subprocess.run(cmd,check=True)
  print(target,'cues',len(cues),flush=True)
