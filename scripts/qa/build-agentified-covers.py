#!/usr/bin/env python3
"""Compose Agentified lesson heroes from approved plates and new Vambah cutouts."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / 'docs/qa/agentified-lesson-covers'
OUT = ROOT / 'public/agentified/posters'
PACKET = ROOT / 'agentified/workshop/visual-review/packets.json'
SCENES = ROOT / 'agentified/workshop/scene-production/packets'
IDENTITY = ROOT / 'public/review-assets/social-content/jev-hero-thumbnail-review/source/vambah-curious-approved.jpg'
COVER = ROOT / 'public/agentified-cover.jpg'
LOGO = ROOT / 'public/amadutown-logo-upscaled.png'
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
SMALL = '/System/Library/Fonts/Supplemental/Arial.ttf'
TEASERS = [
  ('GIVE IT A JOB', 'GET A RECEIPT'), ('START WITH', 'THE DECISION'),
  ('TRACE THE WORK', 'GRADE SOURCES'), ('TURN FEEDBACK', 'INTO MEMORY'),
  ('MAP THE', 'OPERATING SYSTEM'), ('WHO CAN', 'SAY YES?'),
  ('SPECIFY THE', 'WORK + TEAM'), ('MAKE HANDOFFS', 'TESTABLE'),
  ('MEASURE TRUST', 'CHOOSE REVIEW'), ('GATE SPEND', 'BRIEF DECISIONS'),
  ('RUN THE', 'COCKPIT'), ('PROVE THE', 'WORK SAFELY'),
  ('RESEARCH', 'WITH A GATE'), ('SHOW THE', 'CONTROLS'),
  ('REHEARSE THE', 'AGENTIFIED DAY'), ('AUDIT THE', 'OPERATING FILE'),
]
POSES = [
  'point to a blank receipt', 'hold a decision card', 'trace a route with a clipboard',
  'hold a notebook close to the heart', 'map a system with open hands',
  'raise a permission slip and stop hand', 'hold a specification folio and gesture to a team',
  'pass a handoff card', 'point to a measure while holding a notebook',
  'stop a spend while holding a brief', 'operate a control console',
  'present an evidence card', 'hold research notes and point to a gate',
  'present a board briefing', 'check a watch and daily plan', 'hold an audit sheet',
]

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def rel(path): return str(path.relative_to(ROOT))

def render(index, lesson):
  lid = lesson['id']; visual = lesson['visuals'][0]
  plate = ROOT / visual['source_path']
  avatar = QA / 'avatar-sources' / f'{lid.lower()}-vambah-cutout.png'
  scene = SCENES / f'{lid}.json'
  if sha(plate) != visual['register_sha256'] or not avatar.exists() or not scene.exists():
    raise RuntimeError(f'{lid}: approved source drift or missing cutout')
  if visual['rights']['workshop_redistribution'] != 'approved_for_bound_agentified_lesson_uses':
    raise RuntimeError(f'{lid}: visual rights not approved')
  frame = Image.new('RGBA', (1280, 720), '#081a26')
  d = ImageDraw.Draw(frame)
  for y in range(720):
    t = y / 719
    d.line((0,y,1279,y), fill=(round(7+8*t),round(23+18*t),round(36+18*t),255))
  cover_texture=ImageOps.fit(Image.open(COVER).convert('RGBA'),(1280,720),method=Image.Resampling.LANCZOS)
  cover_texture=cover_texture.filter(ImageFilter.GaussianBlur(14))
  cover_texture.putalpha(Image.new('L',(1280,720),30))
  frame.alpha_composite(cover_texture)
  # The full registered plate remains intact. Feathering joins it to the scene without a card edge.
  art = Image.open(plate).convert('RGBA')
  art.thumbnail((610,382), Image.Resampling.LANCZOS)
  art_box = Image.new('RGBA',(620,390))
  art_box.alpha_composite(art,((620-art.width)//2,(390-art.height)//2))
  edge = Image.new('L',art_box.size,0); ed=ImageDraw.Draw(edge)
  ed.rounded_rectangle((20,12,600,378),radius=42,fill=230)
  edge=edge.filter(ImageFilter.GaussianBlur(24))
  art_box.putalpha(Image.composite(art_box.getchannel('A'),Image.new('L',art_box.size,0),edge))
  frame.alpha_composite(art_box,(18,305))
  # New generated cutout, placed beyond the teaching plate's main read lane.
  person=Image.open(avatar).convert('RGBA')
  if person.getextrema()[3][0] == 255: raise RuntimeError(f'{lid}: avatar has no alpha')
  person=person.resize((980,552),Image.Resampling.LANCZOS)
  frame.alpha_composite(person,(300,165))
  # An ink wash protects teaser text without hiding the face or plate.
  wash=Image.new('RGBA',frame.size,(0,0,0,0)); wd=ImageDraw.Draw(wash)
  for x in range(0,690):
    a=round(200*(1-x/690)**1.7)
    wd.line((x,0,x,310),fill=(4,19,30,a))
  frame=Image.alpha_composite(frame,wash)
  d=ImageDraw.Draw(frame)
  d.line((48,42,615,42),fill='#b89142',width=3)
  d.text((50,60),'AMADUTOWN   /   AGENTIFIED',font=ImageFont.truetype(SMALL,21),fill='#f6e5be')
  d.text((50,98),f'LESSON {index:02d}',font=ImageFont.truetype(FONT,24),fill='#ddb65e')
  headline=TEASERS[index-1]
  size=58
  while size>40:
    font=ImageFont.truetype(FONT,size)
    if max(d.textbbox((0,0),line,font=font)[2] for line in headline)<=590: break
    size-=2
  for j,line in enumerate(headline):
    d.text((48,148+j*(size+9)),line,font=font,fill='#fff8e8',stroke_width=1,stroke_fill='#06121a')
  d.line((48,710,1232,710),fill='#c49b4d',width=2)
  logo=Image.open(LOGO).convert('RGBA'); logo.thumbnail((50,65),Image.Resampling.LANCZOS)
  frame.alpha_composite(logo,(1190,34))
  output=OUT/f'{lid.lower()}-poster.webp'
  frame.convert('RGB').save(output,'WEBP',quality=91,method=6)
  beat=next((s for s in json.loads(scene.read_text())['scenes'] if s['approved_visuals']),None)
  return {
    'lesson':lid,'title':lesson['title'],'scriptSha256':lesson['script_sha256'],
    'scriptBeat':visual['storyboard_beat'],'sceneId':beat['id'] if beat else None,
    'approvedVisualIdentity':visual['source_identity'],'approvedVisualPath':rel(plate),
    'approvedVisualSha256':sha(plate),'rightsStatus':visual['rights']['workshop_redistribution'],
    'canonicalCover':rel(COVER),'canonicalCoverSha256':sha(COVER),
    'identityReference':rel(IDENTITY),'identityReferenceSha256':sha(IDENTITY),
    'avatarSource':rel(avatar),'avatarSourceSha256':sha(avatar),
    'promptIdentity':f'agentified-{lid.lower()}-static-cover-avatar/v1',
    'poseBrief':POSES[index-1], 'inputIdentity':f'{sha(IDENTITY)}:{sha(plate)}:{lesson["script_sha256"]}',
    'logo':rel(LOGO),'logoSha256':sha(LOGO),
    'altText':f'{lid} {lesson["title"]}: Vambah presents the {visual["source_identity"].replace("figure-", "").replace("-publication-plate.png", "").replace("-", " ")} lesson diagram.',
    'posterBinding':f'/agentified/posters/{lid.lower()}-poster.webp',
    'output':rel(output),'outputSha256':sha(output),'dimensions':[1280,720],
    'mediaStatus':'static-cover; video locked',
  }

if __name__ == '__main__':
  packet=json.loads(PACKET.read_text())
  if len(packet['lessons'])!=16: raise RuntimeError('Expected sixteen approved lesson packets')
  OUT.mkdir(parents=True,exist_ok=True)
  entries=[render(i,lesson) for i,lesson in enumerate(packet['lessons'],1)]
  (QA/'source-map.json').write_text(json.dumps({'schemaVersion':1,'baseCommit':'db010ebfe7c14a378fb4ff2102af48c1b1954293','visualPacketSha256':sha(PACKET),'posters':entries},indent=2)+'\n')
  montage=Image.new('RGB',(1280,720),'#071723')
  for i,e in enumerate(entries):
    im=Image.open(ROOT/e['output']).convert('RGB').resize((320,180),Image.Resampling.LANCZOS)
    montage.paste(im,((i%4)*320,(i//4)*180))
  montage.save(QA/'all-sixteen-montage.jpg',quality=92)
  for group in range(4):
    sheet=Image.new('RGB',(2560,1440),'#071723')
    for offset,e in enumerate(entries[group*4:group*4+4]):
      im=Image.open(ROOT/e['output']).convert('RGB')
      sheet.paste(im,((offset%2)*1280,(offset//2)*720))
    sheet.save(QA/f'full-size-contact-{group+1}.jpg',quality=89)
  print('Built sixteen source-bound Agentified covers and feed-size montage')
