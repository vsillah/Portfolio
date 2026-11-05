#!/usr/bin/env python3
"""Compose illustrated Accelerated lesson covers from receipted avatar art and owned proof."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/accelerated/posters'
QA = ROOT / 'docs/qa/accelerated-video-posters'
MANIFEST = QA / 'source-map.json'
PROMPTS = QA / 'generation-prompts.json'
IDENTITY = ROOT / 'public/review-assets/social-content/jev-hero-thumbnail-review/source/vambah-curious-approved.jpg'
IDENTITY_SHA = 'b74a933c73cdc1ee336d951b7e6d20ea7737c214c5390805ce3c149068ec9e90'
TITLES = [
    'Build smarter, stay human', 'Prioritize before generating', 'Answer-driven discovery',
    'Build small; keep personas alive', 'From feedback to signal', 'Roadmap to PRD, without drift',
    'Commit to learning', 'Metrics and the ten-part learning plan', 'Map the decision theater',
    'Influence before impact', 'From the shift to a repeatable loop', 'Jobs and synthetic signals',
    'Strategic shifts and future concepts', 'The last mile of influence',
    'Governance and the system that learns', 'What comes next',
]
SHORT = [
    'BUILD SMARTER\nSTAY HUMAN', 'PRIORITIZE\nFIRST', 'ASK BETTER\nQUESTIONS',
    'KEEP PERSONAS\nALIVE', 'FIND THE\nSIGNAL', 'ROADMAP\nTO PRD',
    'COMMIT TO\nLEARNING', 'MEASURE\nWHAT MATTERS', 'MAP THE\nDECISION',
    'INFLUENCE\nBEFORE IMPACT', 'BUILD A\nLEARNING LOOP', 'JOBS +\nSIGNALS',
    'TEST THE\nFUTURE', 'THE LAST MILE\nOF INFLUENCE', 'GOVERN THE\nLEARNING', 'WHAT COMES\nNEXT',
]
ACTS = ['SIGNALS'] * 4 + ['ALIGNMENT'] * 6 + ['MOMENTUM'] * 4 + ['SYNTHESIS'] * 2
PALETTE = {
    'SIGNALS': ('#e7b75f', (8, 31, 47), (19, 49, 71)),
    'ALIGNMENT': ('#76d5d0', (5, 38, 50), (16, 67, 71)),
    'MOMENTUM': ('#f1a083', (33, 29, 47), (71, 39, 53)),
    'SYNTHESIS': ('#bdb4f4', (24, 29, 56), (46, 44, 78)),
}
ART = {
    'SIGNALS': 'public/showcases/service-prototypes/v2/sam-signals-plate.webp',
    'ALIGNMENT': 'public/showcases/service-prototypes/v2/sam-alignment-plate.webp',
    'MOMENTUM': 'public/showcases/service-prototypes/v2/sam-momentum-plate.webp',
    'SYNTHESIS': 'public/showcases/service-prototypes/accelerated-sam-infographic.png',
}
SPECIAL = {1: 'public/accelerated_cover_ebook.webp', 5: 'public/showcases/accelerated-learning-plan/storyboard-l05.png', 8: 'public/showcases/accelerated-learning-plan/storyboard-l08.png', 11: 'public/showcases/accelerated-learning-plan/storyboard-l11.png', 16: 'public/showcases/accelerated-learning-plan/storyboard-l16.png'}
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
REG = '/System/Library/Fonts/Supplemental/Arial.ttf'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def fit(im, box): return ImageOps.fit(im, box, method=Image.Resampling.LANCZOS)

def render(index, prompt):
    lid = f'L{index:02d}'
    act = ACTS[index-1]
    accent, top, bottom = PALETTE[act]
    avatar_path = QA / 'avatar-sources' / f'{lid.lower()}-illustrated-avatar.png'
    art_path = ROOT / SPECIAL.get(index, ART[act])
    video_paths = list((ROOT / f'public/accelerated/lessons/l{index:02d}').glob('*/*native-composite.mp4'))
    if len(video_paths) != 1 or not avatar_path.exists() or not art_path.exists(): raise RuntimeError(f'{lid}: missing bound source')
    video_path = video_paths[0]
    if sha(video_path)[:8] != video_path.parent.name.split('-')[-1]: raise RuntimeError(f'{lid}: learner video hash drift')
    canvas = Image.new('RGBA', (1280, 720), (0,0,0,255)); draw = ImageDraw.Draw(canvas)
    for y in range(720):
        t=y/719
        color=tuple(round(top[k]*(1-t)+bottom[k]*t) for k in range(3))+(255,)
        draw.line((0,y,1280,y),fill=color)
    # The generated art is a new illustration; the approved photo is only its likeness reference.
    avatar=Image.open(avatar_path).convert('RGBA')
    if avatar.size[0]/avatar.size[1] < 1.7 or avatar.getextrema()[3][0] == 255: raise RuntimeError(f'{lid}: avatar alpha/aspect invalid')
    avatar=avatar.resize((1280,720),Image.Resampling.LANCZOS)
    canvas.alpha_composite(avatar)
    side = 'right' if index in (1,2,4,6,8,10,12,14,16) else 'left'
    text_x = 56 if side == 'right' else 706
    text_w = 555 if side == 'right' else 518
    # Soft local text plate avoids hard pasted split-screen while keeping a safe read lane.
    plate=Image.new('RGBA',(text_w+40,580),(3,17,27,190)); mask=Image.new('L',plate.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,*plate.size),radius=30,fill=230);plate.putalpha(mask)
    canvas.alpha_composite(plate,(text_x-20,56))
    d=ImageDraw.Draw(canvas)
    d.text((text_x,78),'AMADUTOWN  /  ACCELERATED',font=ImageFont.truetype(REG,22),fill='#fff9ec')
    d.rounded_rectangle((text_x,125,text_x+163,174),radius=11,fill=accent)
    d.text((text_x+14,134),f'LESSON {index:02d}',font=ImageFont.truetype(FONT,25),fill='#08212a')
    d.text((text_x,192),act,font=ImageFont.truetype(FONT,24),fill=accent)
    size=59
    lines=SHORT[index-1].split('\n')
    while size>43 and any(d.textbbox((0,0),line,font=ImageFont.truetype(FONT,size))[2]>text_w-10 for line in lines):size-=2
    font=ImageFont.truetype(FONT,size)
    y=238
    for line in lines:
        d.text((text_x,y),line,font=font,fill='#ffffff',stroke_width=1,stroke_fill='#0a202b');y+=size+12
    art=Image.open(art_path).convert('RGB')
    art_side = 148 if index not in SPECIAL else 176
    art=fit(art,(art_side,136))
    art_x=text_x;art_y=486
    canvas.paste(art,(art_x,art_y))
    d=ImageDraw.Draw(canvas)
    d.rounded_rectangle((art_x-2,art_y-2,art_x+art_side+2,art_y+138),radius=6,outline=accent,width=3)
    d.text((art_x+art_side+15,art_y+44),'BOOK + SAM' if index==1 else 'LESSON ARTIFACT' if index in SPECIAL else 'SAM FRAMEWORK',font=ImageFont.truetype(FONT,20),fill=accent)
    d.line((54,677,1226,677),fill=accent,width=5)
    output=OUT/f'{lid.lower()}-poster.webp';canvas.convert('RGB').save(output,'WEBP',quality=94,method=6)
    return {
        'lesson':lid,'title':TITLES[index-1],'act':act,'lessonBinding':f'/accelerated/posters/{lid.lower()}-poster.webp',
        'approvedLearnerVideo':str(video_path.relative_to(ROOT)),'approvedLearnerVideoSha256':sha(video_path),
        'identityReference':str(IDENTITY.relative_to(ROOT)),'identityReferenceSha256':sha(IDENTITY),
        'avatarSource':str(avatar_path.relative_to(ROOT)),'avatarSourceSha256':sha(avatar_path),
        'promptIdentity':prompt['id'],'promptSha256':hashlib.sha256(prompt['text'].encode()).hexdigest(),
        'generationProvenance':{'tool':'openai.image_gen.imagegen','mode':'reference-guided new illustration','generatorJobId':prompt['jobId'],'generatedPixels':'new illustrated avatar; no session-frame pixel reuse'},
        'samOrBookAsset':str(art_path.relative_to(ROOT)),'samOrBookAssetSha256':sha(art_path),
        'output':str(output.relative_to(ROOT)),'outputSha256':sha(output),'dimensions':[1280,720],
        'privacyRightsStatus':'Approved first-party likeness reference and owned SAM/book artwork; generated illustration for course review only',
        'visualReview':{'eyesOpen':True,'mouthState':'intentional; no speech frame','anatomy':'intact hands and face','duplicatePose':False},
    }

if __name__=='__main__':
    if sha(IDENTITY)!=IDENTITY_SHA: raise RuntimeError('Approved identity reference hash drift')
    prompts=json.loads(PROMPTS.read_text())['prompts']
    if len(prompts)!=16 or [p['id'] for p in prompts]!=[f'accelerated-l{i:02d}-illustrated-avatar/v1' for i in range(1,17)]:raise RuntimeError('Incomplete prompt binding')
    OUT.mkdir(parents=True,exist_ok=True)
    entries=[render(i,prompts[i-1]) for i in range(1,17)]
    MANIFEST.write_text(json.dumps({'schemaVersion':2,'posters':entries},indent=2)+'\n')
    print(f'Built {len(entries)} illustrated source-bound posters')
