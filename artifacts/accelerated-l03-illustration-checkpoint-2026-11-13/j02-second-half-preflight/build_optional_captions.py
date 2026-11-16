"""Build review-only optional L03 captions from exact text and local alignment."""
from pathlib import Path
import hashlib, json, re

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OUT=HERE/'whole-lesson-review'
SOURCES=HERE/'caption-sources'
PACK=json.loads((ROOT/'docs/accelerated-course-modules/narration-production-pack-2026-11-10.json').read_text())
LESSON=next(x for x in PACK['lessons'] if x['lesson_id']=='L03')
WINDOW={x['id']:x for x in LESSON['windows']}
J01=next(x['text'] for x in LESSON['speech_jobs'] if x['id']=='J01')
J02=next(x['text'] for x in LESSON['speech_jobs'] if x['id']=='J02')
PROVIDER=json.loads((HERE/'l03-j02-provider-word-timestamps-recovered.json').read_text())['words']
SHA=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
NORM=lambda s:re.sub('[^a-z0-9]','',s.lower())

def asr_words(path,offset=0):
    data=json.loads(path.read_text());out=[];cur=None
    for segment in data['transcription']:
        for token in segment['tokens']:
            fragment=token['text'];a=offset+token['offsets']['from']/1000;b=offset+token['offsets']['to']/1000
            if fragment.startswith('<|'):continue
            if fragment[:1].isspace():
                if cur:out.append(cur)
                cur={'text':fragment.strip(),'start':a,'end':b}
            elif cur:
                cur['text']+=fragment;cur['end']=b
            elif fragment.strip():cur={'text':fragment.strip(),'start':a,'end':b}
    if cur:out.append(cur)
    return [x for x in out if re.search('[A-Za-z0-9]',x['text'])]

full=asr_words(SOURCES/'l03-j01-asr.json')
part1=asr_words(SOURCES/'l03-j01-24-49.json',24)
part2=asr_words(SOURCES/'l03-j01-43-73.json',43)
# The two targeted passes recover words omitted at the original 30/60-second
# ASR chunk edges. Source text remains canonical; local ASR supplies time only.
aligned=[x for x in full if x['end']<23.9]+[x for x in part1 if x['start']>=24 and x['end']<=46.82]+[x for x in part2 if x['start']>=46.46]+[x for x in full if x['start']>=72.83]
j01=J01.replace('-',' ').split()
assert len(j01)==len(aligned)==586
assert all(NORM(a)==NORM(b['text']) or (NORM(a),NORM(b['text']))==('four','4') for a,b in zip(j01,aligned))
assert len(PROVIDER)==302
j02=J02.replace('-',' ').split()
assert all(NORM(a)==NORM(b['text']) for a,b in zip(j02,PROVIDER))

# Join overlaps in the local ASR timing without changing the word sequence.
for i,word in enumerate(aligned):
    if i and word['start']<aligned[i-1]['end']:
        word['start']=aligned[i-1]['end']
    if word['end']<=word['start']:word['end']=word['start']+.04
aligned[112]['end']=min(aligned[112]['end'],36.70)
aligned[283]['start']=max(aligned[283]['start'],95.36)
assert aligned[112]['end']<36.75 and aligned[283]['start']>=95.36

def native(id):
    text=WINDOW[id]['text'].replace('-',' ').split()
    w=asr_words(SOURCES/f'l03-{id.lower()}-asr.json')
    assert len(text)==len(w) and all(NORM(a)==NORM(b['text']) for a,b in zip(text,w))
    w[0]['start']=max(w[0]['start'],.32 if id=='P03' else .384)
    return text,w

cues=[]
def add(start,end,text,kind):
    assert end>start and text.strip()
    cues.append({'start':start,'end':end,'text':text,'kind':kind})

# These native phrase boundaries came from the approved first-half build.
p01=[(0.00,4.47,'Imagine walking into a review with a dashboard redesign.'),
 (4.47,8.45,'You have evidence that people struggle with the current screen.'),
 (8.45,10.25,'You have a proposed fix.'),
 (10.25,13.13,'You put up the first slide and someone asks,'),
 (13.13,16.35,'“Is this the best use of engineering time right now?”'),
 (16.35,18.10,'That is a reasonable question.'),
 (18.10,22.28,'It may feel like a rejection, but it is also a clue.')]
for a,b,s in p01:add(a,b,s,'P01-native')

def word_cues(tokens,timings,offset,kind,max_chars=47,max_seconds=3.5):
    group=[]
    for token,timing in zip(tokens,timings):
        if group:
            line=' '.join(x[0] for x in group)
            pause=timing['start']-group[-1][1]['end']
            if len(line)+len(token)+1>max_chars or timing['end']-group[0][1]['start']>max_seconds or pause>.48:
                add(offset+group[0][1]['start'],offset+group[-1][1]['end']+.10,line,kind);group=[]
        group.append((token,timing))
        if token.endswith(('.', '?', '!')) and len(group)>=4:
            add(offset+group[0][1]['start'],offset+group[-1][1]['end']+.10,' '.join(x[0] for x in group),kind);group=[]
    if group:add(offset+group[0][1]['start'],offset+group[-1][1]['end']+.10,' '.join(x[0] for x in group),kind)

word_cues(j01[:283],aligned[:283],22.28,'C01-local-alignment')
p02=[(117.82,121.30,'A single polished idea invites a yes or no.'),
 (121.90,124.70,'Chapter Four calls this the binary trap.'),
 (125.10,129.42,'The dashboard case becomes easier to discuss'),
 (129.42,131.70,'when the team can compare a quick simplification,'),
 (131.70,134.24,'a deeper rebuild, and a deliberate delay.')]
for a,b,s in p02:add(a,b,s,'P02-native')
word_cues(j01[283:],aligned[283:],39.12,'C02-local-alignment')
for id,offset in [('P03',235.75),('P04',340.83)]:
    tokens,timings=native(id);word_cues(tokens,timings,offset,id+'-native-local-alignment')
word_cues(j02[:287],[{'start':x['start_time'],'end':x['end_time']} for x in PROVIDER[:287]],247.03,'C03-provider-timing')
word_cues(j02[287:],[{'start':x['start_time'],'end':x['end_time']} for x in PROVIDER[287:]],259.31,'C04-provider-timing')

# C04 offset = 353.11 - 93.8 = 259.31. C03 needs the original 247.03 offset.
cues.sort(key=lambda x:x['start'])
for i,cue in enumerate(cues):
    cue['start']=max(0,cue['start'])
    if i and cue['start']<cues[i-1]['end']:
        cues[i-1]['end']=max(cues[i-1]['start']+.04,cue['start']-.02)
    assert cue['end']>cue['start']

def clock(t):
    ms=round(t*1000)
    return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d}.{ms%1000:03d}'

vtt='WEBVTT\n\n'+'\n\n'.join(f"{clock(c['start'])} --> {clock(c['end'])}\n{c['text']}" for c in cues)+'\n'
target=OUT/'l03-whole-lesson-optional-captions.vtt';target.write_text(vtt)
receipt={'status':'local_review_caption_track_pending_player_qa',
 'source':'canonical L03 pack; J01 local whisper.cpp base.en timing; native P03/P04 local base.en timing; J02 original provider word timing',
 'source_asr_sha256':{p.name:SHA(p) for p in SOURCES.glob('*.json')},
 'j01_canonical_words':len(j01),'j02_canonical_words':len(j02),'cue_count':len(cues),
 'cue_kind_counts':{kind:sum(c['kind']==kind for c in cues) for kind in sorted(set(c['kind'] for c in cues))},
 'vtt_sha256':SHA(target),'first_cue':cues[0],'last_cue':cues[-1],
 'qualification_limit':'J01 original provider timing JSON was removed with the prior worktree. This track uses recorded local ASR plus two targeted rescans; source wording is exact, timing needs actual-player review.'}
(OUT/'caption-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'cues':len(cues),'sha256':SHA(target),'last_end':cues[-1]['end']},indent=2))
