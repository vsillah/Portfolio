"""Build source-labeled, product-specific SVG concepts for preview review.

These are illustrative specifications, not screenshots of implemented behavior.
No provider or database writes are performed.
"""

from html import escape
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "showcases"
OUT.mkdir(parents=True, exist_ok=True)


def rect(x, y, w, h, fill, rx=0, stroke="none", sw=1):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def txt(x, y, value, size=26, color="#edf4fc", weight=500, anchor="start"):
    return f'<text x="{x}" y="{y}" fill="{color}" font-family="Arial,Helvetica,sans-serif" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}">{escape(value)}</text>'


def line(x1, y1, x2, y2, color="#6b8299", sw=2):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}"/>'


def base(title, subtitle, accent, scene, filename, category):
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-label="Illustrative concept for {escape(title)}">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#101b2b"/><stop offset="1" stop-color="#233247"/></linearGradient></defs>
{rect(0,0,1200,720,'url(#bg)')}
{rect(36,30,1128,660,'#142339',28,'#496177',1)}
{rect(64,58,12,12,accent,6)}
{txt(88,70,category.upper(),17,'#b9cbd9',700)}
{txt(64,150,title,54,'#fff',700)}
{txt(64,194,subtitle,22,'#b9cbd9')}
{line(64,222,1136,222,'#42556b',2)}
{scene}
{line(64,632,1136,632,'#42556b',1)}
{txt(64,665,'ILLUSTRATIVE CONCEPT · NOT A PRODUCT SCREENSHOT',17,accent,700)}
{txt(1136,665,'AmaduTown showcase preview',15,'#96a8ba',400,'end')}
</svg>'''
    (OUT / filename).write_text(svg)


gold = '#e8bd62'
teal = '#58d9c5'
blue = '#78aef5'
purple = '#b6a0f8'

# Enterprise contribution concepts omit Fidelity marks and private account data.
base('Unified account view','Workplace and retail accounts, one clear picture',teal,
    rect(90,284,260,218,'#1c3950',20,'#54818e') + txt(120,334,'Workplace',26,'#d7f7f1',700) + txt(120,391,'Retirement plan',20) + txt(120,432,'Balance ••••',19,'#91b8bf') +
    rect(850,284,260,218,'#1c3950',20,'#54818e') + txt(880,334,'Retail',26,'#d7f7f1',700) + txt(880,391,'Investing account',20) + txt(880,432,'Balance ••••',19,'#91b8bf') +
    line(350,395,485,395,teal,5) + line(715,395,850,395,teal,5) +
    rect(484,267,232,252,'#e4f4ef',20) + txt(600,330,'FULL VIEW',18,'#24675e',700,'middle') + txt(600,394,'One place',36,'#163d45',700,'middle') + txt(600,444,'to see it all',25,'#366070',400,'middle'),
    'fidelity-fullview-concept.svg','Portfolio contribution')

base('Dividend alerts','A timely event reaches the investor on mobile',blue,
    rect(444,251,312,342,'#090f1b',39,'#97b8d8',5) + rect(461,274,278,298,'#183048',24) +
    txt(485,310,'9:41',21,'#d5e6f6',700) + txt(600,368,'Portfolio alert',24,'#a7caff',700,'middle') +
    rect(484,400,232,121,'#eef6ff',18) + txt(502,435,'Dividend event',22,'#173956',700) + txt(502,468,'Distribution update',17,'#395f7b') + txt(502,495,'View details →',16,'#286ba8',700) +
    rect(105,347,240,126,'#233c58',18,'#5e8cb8') + txt(225,392,'EVENT',18,'#a7caff',700,'middle') + txt(225,432,'Dividend posted',23,'#fff',700,'middle') +
    line(345,411,443,411,blue,4) + rect(849,347,240,126,'#233c58',18,'#5e8cb8') + txt(969,392,'ACTION',18,'#a7caff',700,'middle') + txt(969,432,'Investor informed',23,'#fff',700,'middle') + line(756,411,849,411,blue,4),
    'fidelity-dividend-alert-concept.svg','Portfolio contribution')

base('Portfolio summary','Move the cards that matter most into view',gold,
    rect(115,262,970,327,'#ecf1f4',19) + rect(115,262,970,53,'#cddbe3',19) + txt(148,298,'Portfolio overview',24,'#254055',700) +
    rect(153,342,270,195,'#fff',12,'#c8d4dc') + txt(174,382,'Account value',21,'#2d5367',700) + txt(174,442,'$ ••••••',30,'#122e43',700) + txt(174,505,'↗  Overview',18,'#477f73') +
    rect(462,342,270,195,'#fff',12,'#c8d4dc') + txt(483,382,'Asset mix',21,'#2d5367',700) + '<circle cx="597" cy="455" r="49" fill="none" stroke="#63b9ae" stroke-width="19"/>' + '<path d="M597 406 A49 49 0 0 1 645 457" fill="none" stroke="#e8bd62" stroke-width="19"/>' +
    rect(771,342,270,195,'#fff',12,'#c8d4dc') + txt(792,382,'Activity',21,'#2d5367',700) + txt(792,445,'Recent transactions',17,'#56717e') + txt(792,482,'Upcoming events',17,'#56717e') +
    txt(1090,578,'↔ Customize cards',18,'#e8bd62',700,'end'),
    'fidelity-portfolio-summary-concept.svg','Portfolio contribution')

base('Inbound lead chatbot','Qualify the inquiry, then hand it to a person',teal,
    rect(115,266,550,312,'#eef7f4',24) + txt(148,310,'New visitor conversation',22,'#1b534b',700) +
    rect(146,340,342,58,'#d8e8e5',18) + txt(165,376,'I need help choosing a service.',18,'#1d4d48') +
    rect(242,420,385,74,'#168a7d',18) + txt(265,451,'What outcome matters most',18,'#fff') + txt(265,478,'for your team?',18,'#fff') +
    line(666,422,760,422,teal,5) + rect(761,299,321,235,'#233e4b',20,'#58d9c5') + txt(790,340,'LEAD HANDOFF',19,teal,700) + txt(790,390,'Need: service guidance',20) + txt(790,425,'Context: preserved',20) + txt(790,480,'Ready for review →',19,teal,700),
    'service-inbound-chatbot-concept.svg','Service concept')

base('Lead workflow agent','From a public signal to a reviewed lead record',gold,
    ''.join(rect(x,334,220,188,'#27364c',22,'#a77f43') for x in (90,365,640,915)) +
    txt(200,380,'01  SIGNAL',18,gold,700,'middle') + txt(200,442,'Discover',28,'#fff',700,'middle') +
    txt(475,380,'02  QUALIFY',18,gold,700,'middle') + txt(475,442,'Check fit',28,'#fff',700,'middle') +
    txt(750,380,'03  REVIEW',18,gold,700,'middle') + txt(750,442,'Human gate',28,'#fff',700,'middle') +
    txt(1025,380,'04  RECORD',18,gold,700,'middle') + txt(1025,442,'CRM ready',28,'#fff',700,'middle') +
    ''.join(txt(x,437,'→',35,gold,700,'middle') for x in (338,613,888)),
    'service-lead-workflow-concept.svg','Service concept')

base('Website UX refresh','A clearer page makes the next action obvious',purple,
    rect(101,279,434,288,'#e8eaef',13) + rect(101,279,434,42,'#bcc2ce',13) + txt(133,308,'Before',18,'#425067',700) +
    rect(132,348,364,41,'#aeb5c2',6) + rect(132,407,171,124,'#c3c8d1',7) + rect(324,407,171,124,'#c3c8d1',7) +
    txt(597,440,'→',60,purple,700,'middle') + rect(661,279,438,288,'#fbf9f4',13) + rect(661,279,438,42,'#e0d7ce',13) + txt(694,308,'After',18,'#5d5066',700) +
    txt(700,380,'Find the right next step.',28,'#1b2a3e',700) + txt(700,417,'Clear message. Clear path.',18,'#586477') +
    rect(700,455,213,52,'#715bc1',13) + txt(806,489,'Get started',18,'#fff',700,'middle') +
    rect(952,356,112,151,'#ddd6f6',9),
    'service-website-ux-concept.svg','Service concept')

base('Accelerated cohort','A workshop moves from problem to build',gold,
    rect(98,263,1004,313,'#f5f0e6',18) + txt(138,309,'COHORT WORKSPACE',18,'#8b6b3a',700) +
    ''.join(rect(x,343,274,174,'#fff',15,'#d9c9ac') for x in (138,463,788)) +
    txt(163,382,'01  Find the problem',22,'#243447',700) + txt(163,425,'Name the work people',18,'#586777') + txt(163,452,'need done.',18,'#586777') +
    txt(488,382,'02  Make a plan',22,'#243447',700) + txt(488,425,'Map decisions, data,',18,'#586777') + txt(488,452,'and handoffs.',18,'#586777') +
    txt(813,382,'03  Build and test',22,'#243447',700) + txt(813,425,'Leave with a working',18,'#586777') + txt(813,452,'next step.',18,'#586777'),
    'service-accelerated-cohort-concept.svg','Service concept')

base('Self-paced AI course','Learn, practice, and apply at your own pace',blue,
    rect(105,268,640,315,'#1f334f',21,'#6989b8') + rect(132,296,587,228,'#294a71',13) +
    '<circle cx="425" cy="405" r="43" fill="#e8bd62"/>' + txt(426,419,'▶',30,'#1a2b42',700,'middle') +
    txt(151,557,'Lesson 03 / 08',19,'#b5d1f4',700) +
    rect(787,268,306,315,'#edf4fb',19) + txt(816,310,'COURSE PATH',18,'#3a628b',700) +
    txt(816,367,'✓  Foundations',20,'#18354f') + txt(816,417,'✓  Prompt practice',20,'#18354f') + txt(816,467,'●  Business use case',20,'#18354f',700) + txt(816,517,'○  Build your plan',20,'#597184'),
    'service-self-paced-course-concept.svg','Service concept')

base('Premium AI masterclass','Turn a working idea into a reviewed build',purple,
    rect(88,257,576,330,'#11172a',19,'#776da3') + txt(116,302,'BUILD LAB',18,purple,700) +
    txt(118,356,'01  Define the use case',21,'#dfe4ff') + txt(118,400,'02  Connect the workflow',21,'#dfe4ff') + txt(118,444,'03  Test the edge cases',21,'#dfe4ff') +
    rect(116,490,515,47,'#393453',9) + txt(135,520,'Review checkpoint  →',19,purple,700) +
    line(665,418,758,418,purple,4) + rect(758,284,354,262,'#f4f2fa',20) + txt(788,329,'YOUR BUILD',18,'#654e96',700) +
    txt(788,386,'Working prototype',26,'#292746',700) + txt(788,430,'Clear decision log',20,'#534c70') + txt(788,467,'Next iteration scoped',20,'#534c70'),
    'service-masterclass-concept.svg','Service concept')

manifest_scene = (
    '<defs><linearGradient id="visionA" x2="1" y2="1"><stop stop-color="#7f69bd"/><stop offset="1" stop-color="#283854"/></linearGradient>'
    '<linearGradient id="visionB" x2="1" y2="1"><stop stop-color="#5ca6bd"/><stop offset="1" stop-color="#33406e"/></linearGradient>'
    '<linearGradient id="visionC" x2="1" y2="1"><stop stop-color="#c4a678"/><stop offset="1" stop-color="#554b77"/></linearGradient></defs>' +
    rect(85,263,309,327,'#111b32',21,'#6864a0') + txt(112,305,'STUDIO',18,'#b6a0f8',700) +
    txt(112,341,'Curate experiences',24,'#fff',700) +
    rect(112,365,255,55,'#293450',11) + rect(126,378,29,29,'#8b79c6',7) + txt(171,399,'Lifestyle',18,'#e9e7fb',700) +
    rect(112,432,255,55,'#293450',11) + rect(126,445,29,29,'#71aac3',7) + txt(171,466,'Travel',18,'#e9e7fb',700) +
    rect(112,499,255,55,'#293450',11) + rect(126,512,29,29,'#c4a678',7) + txt(171,533,'Transportation',18,'#e9e7fb',700) +
    rect(424,385,37,37,'#263754',18,'#8481bf') + txt(442,411,'›',28,'#b6a0f8',700,'middle') +
    rect(489,263,625,327,'#101b32',21,'#6864a0') + txt(518,305,'CANVAS',18,'#b6a0f8',700) +
    txt(518,341,'A vision board in motion',24,'#fff',700) +
    rect(518,364,179,188,'url(#visionA)',15) + '<circle cx="608" cy="437" r="52" fill="#ac99df" opacity="0.32"/>' + txt(539,524,'A place to grow',17,'#fff',700) +
    rect(710,364,179,188,'url(#visionB)',15) + '<circle cx="798" cy="425" r="54" fill="#82d4d4" opacity="0.26"/>' + txt(731,524,'A journey ahead',17,'#fff',700) +
    rect(902,364,179,188,'url(#visionC)',15) + '<circle cx="990" cy="435" r="52" fill="#f7d697" opacity="0.24"/>' + txt(923,524,'Room to move',17,'#fff',700)
)
base('ManifestR','Curate experiences, then shape a personal vision board',purple,
    manifest_scene,'manifestr-vision-concept.svg','Vision board concept')

print('Generated 10 illustrative concepts in', OUT)


def capture_frame(filename, title, message, source, accent, image_side='right'):
    # The image remains an unchanged local product capture. Typography and crop
    # make its role legible at card scale; this is a presentation composition.
    left = image_side == 'left'
    # Cards crop a little at each horizontal edge. Keep the headline inside
    # the 1012 px safe center of the 1200 px image.
    ix, tx = (68, 622) if left else (614, 140)
    label = 'SOURCE CAPTURE · PUBLIC PRODUCT UI'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-label="{escape(title)} product UI capture composition">
<defs><clipPath id="screen"><rect x="{ix}" y="66" width="518" height="588" rx="22"/></clipPath></defs>
{rect(0,0,1200,720,'#101c2d')}
{rect(ix-5,61,528,598,'#2e4660',28,accent,3)}
<image href="/{escape(source)}" x="{ix}" y="66" width="518" height="588" preserveAspectRatio="xMidYMid slice" clip-path="url(#screen)"/>
{rect(tx,115,12,12,accent,6)}
{txt(tx,176,title,39,'#fff',700)}
{rect(tx,213,442,4,accent,2)}
{txt(tx,285,message[0],37,'#fff',700)}
{txt(tx,332,message[1],37,accent,700)}
{txt(tx,589,label,16,'#adc0d0',700)}
{txt(tx,621,'AmaduTown product showcase',17,'#7d94a9')}
</svg>'''
    (OUT / filename).write_text(svg)


capture_frame('product-ai-audit-capture.svg','AI Audit Calculator',('See where AI', 'can help first.'),'audit_calculator_img.png',gold)
capture_frame('product-chatbot-capture.svg','Chatbot Template',('Answers grounded', 'in your content.'),'Chatbot_N8N_img.png',teal,'left')
capture_frame('product-eval-capture.svg','Eval Template',('Make answer quality', 'visible.'),'Eval_Template_SS.png',purple,'left')
capture_frame('product-warm-lead-capture.svg','Warm Lead Pack',('Three workflows.', 'One handoff.'),'FB_WarmLead_Pack.png',teal,'left')
print('Generated 4 source-capture compositions in', OUT)

# The wide n8n source has five columns. A card-sized crop severs the adjacent
# column headings and nodes, so show its sequence as a legible source-derived
# concept instead of implying the crop is a complete application screenshot.
leadgen_scene = rect(621,61,518,598,'#243b52',28,blue,3) + rect(635,78,490,564,'#192b40',19)
leadgen_scene += txt(660,121,'SOURCE-DERIVED WORKFLOW',17,blue,700)
leadgen_scene += txt(660,168,'From signal to reviewed lead',24,'#fff',700)
leadgen_steps = [
    ('01','New lead','Public inquiry arrives'),
    ('02','Research agent','Company context checked'),
    ('03','Data extraction','Key details structured'),
    ('04','Lead score','Fit and urgency assessed'),
    ('05','Team notification','Follow-up routed'),
]
for index,(number,title,detail) in enumerate(leadgen_steps):
    y = 202 + index * 80
    leadgen_scene += rect(660,y,438,66,'#253b50',11,'#547494')
    leadgen_scene += rect(680,y+12,42,42,blue,10)
    leadgen_scene += txt(701,y+39,number,15,'#17253a',700,'middle')
    leadgen_scene += txt(739,y+27,title,19,'#fff',700)
    leadgen_scene += txt(739,y+50,detail,15,'#adc0d0')
    if index < 4:
        leadgen_scene += txt(879,y+78,'↓',18,blue,700,'middle')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-label="Illustrative concept for Lead Generation Template based on a public workflow image">
{rect(0,0,1200,720,'#101c2d')}
{leadgen_scene}
{rect(140,115,12,12,blue,6)}
{txt(140,176,'Lead Generation',39,'#fff',700)}
{rect(140,213,442,4,blue,2)}
{txt(140,285,'Capture. Qualify.',37,'#fff',700)}
{txt(140,332,'Follow through.',37,blue,700)}
{txt(140,589,'ILLUSTRATIVE CONCEPT · SOURCE-DERIVED',16,'#adc0d0',700)}
{txt(140,621,'AmaduTown product showcase',17,'#7d94a9')}
</svg>'''
(OUT / 'product-leadgen-workflow-v2.svg').write_text(svg)

# The source diagnostic image contains an operator name and partial account
# fields. Recreate the layout with generic blank fields and no user data.
diagnostic_scene = (
    rect(621,61,518,598,'#243b52',28,gold,3) +
    rect(635,78,490,564,'#192b40',19) +
    txt(660,122,'DIAGNOSTIC INTAKE',17,gold,700) +
    txt(660,167,'Where is work getting stuck?',25,'#fff',700) +
    line(660,188,1099,188,'#41546a',2) +
    txt(660,225,'TEAM OR FUNCTION',15,'#9eb1c4',700) +
    rect(660,238,438,45,'#253b50',9,'#5b7186') +
    txt(680,267,'Select a team',17,'#b6c5d3') +
    txt(660,318,'CURRENT FRICTION',15,'#9eb1c4',700) +
    rect(660,331,438,105,'#253b50',9,'#5b7186') +
    txt(680,366,'Describe the handoff or delay',17,'#b6c5d3') +
    txt(660,481,'WHAT WOULD BETTER LOOK LIKE?',15,'#9eb1c4',700) +
    rect(660,496,438,46,'#253b50',9,'#5b7186') +
    txt(680,525,'Choose an outcome',17,'#b6c5d3') +
    rect(660,569,260,48,gold,11) + txt(790,600,'See next steps →',17,'#17253a',700,'middle')
)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-label="Illustrative concept for Diagnostic Template">
{rect(0,0,1200,720,'#101c2d')}
{diagnostic_scene}
{rect(140,115,12,12,gold,6)}
{txt(140,176,'Diagnostic Template',39,'#fff',700)}
{rect(140,213,442,4,gold,2)}
{txt(140,285,'Turn pain points',37,'#fff',700)}
{txt(140,332,'into a next step.',37,gold,700)}
{txt(140,589,'ILLUSTRATIVE CONCEPT · NO CUSTOMER DATA',16,'#adc0d0',700)}
{txt(140,621,'AmaduTown product showcase',17,'#7d94a9')}
</svg>'''
(OUT / 'product-diagnostic-concept-v2.svg').write_text(svg)
print('Generated 1 privacy-safe diagnostic concept in', OUT)
