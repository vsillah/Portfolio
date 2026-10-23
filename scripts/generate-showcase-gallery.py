"""Build source-grounded, explicitly illustrative secondary service frames."""

from html import escape
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'public' / 'showcases'
OUT.mkdir(exist_ok=True)


def text(x, y, value, size=30, color='#f5f3f0', weight=500, spacing=0):
    return (f'<text x="{x}" y="{y}" fill="{color}" font-family="Inter,Arial,sans-serif" '
            f'font-size="{size}" font-weight="{weight}" letter-spacing="{spacing}">{escape(value)}</text>')


def box(x, y, width, height, fill='#1b2d48', stroke='#465979', radius=22):
    return f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'


def line(x1, y1, x2, y2, color='#d4af37'):
    return f'<path d="M{x1} {y1}L{x2} {y2}" fill="none" stroke="{color}" stroke-width="3" stroke-linecap="round"/>'


def save(filename, title, eyebrow, subtitle, scene, accent='#d4af37'):
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-labelledby="title desc">
<title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}. Illustrative concept, not a product screenshot.</desc>
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#101b2e"/><stop offset="1" stop-color="#263957"/></linearGradient></defs>
<rect width="1200" height="720" fill="url(#bg)"/><circle cx="1065" cy="65" r="260" fill="{accent}" opacity=".06"/>
<rect x="42" y="42" width="1116" height="636" rx="30" fill="none" stroke="#71839b" stroke-opacity=".4"/>
{text(78,107,eyebrow.upper(),18,accent,700,4)}{text(78,164,title,45,'#f5f3f0',700)}
{text(78,206,subtitle,22,'#b8c4d6')}
{scene}
{line(78,628,1122,628,'#71839b')}
{text(78,658,'ILLUSTRATIVE CONCEPT · NOT A PRODUCT SCREENSHOT',15,'#cbd5e1',700,2)}
{text(1118,658,'AMADUTOWN',15,accent,700,2).replace('x="1118"','x="1118" text-anchor="end"')}
</svg>'''
    (OUT / filename).write_text(svg)


save('gallery-inbound-chatbot-workflow.svg', 'A question gets a clear handoff', 'Workflow',
     'From first message to a reviewed lead',
     box(78,262,320,300) + text(104,308,'01 / INQUIRY',18,'#d4af37',700) + text(104,366,'What do you need?',27) +
     box(103,397,267,105,'#263d5a','#6684a3',15) + text(125,439,'A visitor asks',23) + text(125,472,'for a next step',20,'#c4d2df') +
     line(419,412,501,412) + box(515,262,290,300) + text(541,308,'02 / REVIEW',18,'#d4af37',700) +
     text(541,369,'Route the request',25) + text(541,420,'Need',20,'#bdd1dd') + text(541,454,'Consent',20,'#bdd1dd') + text(541,488,'Owner',20,'#bdd1dd') +
     line(824,412,878,412) + box(893,262,229,300) + text(918,308,'03 / HANDOFF',18,'#d4af37',700) +
     text(918,374,'Human',27) + text(918,411,'follow-up',27) + text(918,481,'No silent send',17,'#b9c8d8'), '#70b8c6')

save('gallery-lead-workflow-outcome.svg', 'A lead with context', 'Outcome',
     'A reviewable handoff before follow-up',
     box(90,268,438,286) + text(120,318,'REVIEWED SIGNAL',18,'#d4af37',700) + text(120,376,'Why this lead matters',29) +
     line(121,405,491,405,'#53718f') + text(120,448,'Source recorded',20,'#c4d2df') + text(120,487,'Fit assessed',20,'#c4d2df') +
     line(548,410,644,410) + box(665,268,444,286,'#1c3447','#5598a6') + text(697,318,'NEXT ACTION',18,'#7ed4d3',700) +
     text(697,378,'Owner sees the case',29) + text(697,438,'Review  →  decide  →  reply',23,'#c4d2df') +
     text(697,494,'Outcome stays traceable',20,'#c4d2df'), '#7ed4d3')

save('gallery-website-ux-workflow.svg', 'Make the next step obvious', 'Workflow',
     'A focused page review and revision path',
     box(80,270,323,280) + text(111,315,'OBSERVE',18,'#d4af37',700) + text(111,372,'Where do people',25) +
     text(111,407,'lose the path?',25) + text(111,481,'Page + task review',19,'#b9c8d8') +
     line(416,410,466,410) + box(480,270,318,280,'#2b304e','#8e86c0') + text(511,315,'DECIDE',18,'#b8abed',700) +
     text(511,372,'One clearer',27) + text(511,407,'primary action',27) + text(511,481,'Copy + hierarchy',19,'#c5c4dc') +
     line(811,410,861,410) + box(875,270,248,280,'#213a47','#6faea9') + text(903,315,'CHECK',18,'#8ad0c1',700) +
     text(903,372,'Test the',26) + text(903,407,'new path',26) + text(903,481,'Mobile first',19,'#bdd8d2'), '#b8abed')

save('gallery-accelerated-cohort-outcome.svg', 'Leave with a build you can test', 'Cohort outcome',
     'A scoped prototype, a decision log, and a next test',
     box(88,278,1024,272) + text(130,326,'THE WORK LEAVES THE ROOM',18,'#d4af37',700) +
     box(129,364,275,132,'#263953','#7a91a8',16) + text(152,406,'Scoped prototype',23) + text(152,449,'One useful path',18,'#c4d2df') +
     box(462,364,275,132,'#263953','#7a91a8',16) + text(485,406,'Decision log',23) + text(485,449,'Why it changed',18,'#c4d2df') +
     box(795,364,275,132,'#263953','#7a91a8',16) + text(818,406,'Next test',23) + text(818,449,'What to learn',18,'#c4d2df'), '#c6aeed')

save('gallery-masterclass-outcome.svg', 'A working idea, examined', 'Masterclass outcome',
     'Build a prototype and name the next decision',
     box(96,270,482,288,'#243450','#8a8fb3') + text(128,320,'BUILD LAB',18,'#c5b5ed',700) +
     text(128,386,'Working prototype',30) + text(128,442,'A use case someone can test',20,'#bdc9d8') +
     line(597,414,655,414) + box(673,270,430,288,'#1d3a42','#6bafa7') +
     text(705,320,'REVIEW CHECKPOINT',18,'#8ed9c5',700) + text(705,386,'Decision made visible',27) +
     text(705,442,'Keep, revise, or stop',21,'#bdc9d8'), '#c5b5ed')

save('gallery-self-paced-course-poster.svg', 'Why Accelerated Exists', 'Module 0 · course preview',
     'A lesson packet is ready for review; the video is not rendered',
     box(78,250,1044,335,'#1b2d48','#9d8351',27) +
     '<circle cx="942" cy="414" r="103" fill="#d4af37" opacity=".11"/><circle cx="942" cy="414" r="74" fill="none" stroke="#d4af37" stroke-width="4"/>' +
     '<path d="M922 380L979 414L922 448Z" fill="#d4af37"/>' +
     text(119,308,'ACCELERATED / LESSON 00',20,'#d4af37',700,3) +
     text(119,381,'AI speed needs',47,'#f5f3f0',700) + text(119,439,'human judgment.',47,'#f5f3f0',700) +
     text(119,516,'Signal  /  Decision  /  Loop  /  Learning',22,'#bbc9d8') +
     text(942,533,'POSTER ONLY',16,'#e5cb80',700,2).replace('x="942"','x="942" text-anchor="middle"'), '#d4af37')

save('gallery-leadgen-in-use.svg', 'A lead enters the system', 'Product-in-use concept',
     'A privacy-safe view of intake and review, based on the public offer',
     box(78,259,492,311,'#1b3045','#6da6b3') + text(108,316,'CONTACT INTAKE',23,'#8ed6dd',700) +
     box(108,351,432,62,'#263e55','#789aaa',12) + text(132,392,'What are you trying to solve?',26) +
     box(108,430,432,65,'#263e55','#789aaa',12) + text(132,472,'Business email',26,'#d5e1e9') +
     line(590,414,646,414) + box(666,259,456,311,'#26314b','#a295c3') +
     text(697,316,'REVIEW QUEUE',23,'#ccbdeb',700) + text(697,386,'New inquiry',38,'#fff',700) +
     text(697,436,'Source captured',27,'#d3d8e8') + text(697,479,'Human follow-up',27,'#d3d8e8'), '#8ed6dd')

print('Generated 6 secondary service frames and 1 product frame in', OUT)
