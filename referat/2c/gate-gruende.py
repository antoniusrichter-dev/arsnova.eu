# VERSUCHSCODE (Referat 2C, 5.4) – kein Produktpfad.
# Spiegelt hasAcceptableQaSummaryQuality (apps/backend/src/lib/qaSummaryQuality.ts:59-83, 1.3.0)
# zeilengenau nach, um je Lauf die ERSTE nicht erfüllte Gate-Bedingung (Zeilennummer) zu benennen.
# Gegenprobe: Ergebnis ok/abgelehnt stimmt je Lauf mit dem Produkt-Gate (auswertung.csv gate_ok) überein.
# Aufruf aus Repo-Root: python3 referat/2c/gate-gruende.py > referat/evidenz/2c/gate-gruende.txt
import json,re,glob,unicodedata,collections,sys
ex=[json.loads(l) for l in open('referat/evidenz/2c/llm-exchanges.jsonl')]
TECH=[r'\b(?:source|quellen)[- ]?ids?\b',r'\b(?:token|kontext)[- ]?budget\b',r'\b(?:aufgrund|wegen)\s+(?:des|eines|dem)?\s*(?:token[- ]?|kontext[- ]?)?budgets?\b',r'\b(?:einige|mehrere|\d+)\s+(?:fragen|themen|einträge|inhalte)\s+(?:wurden\s+)?nicht berücksichtigt\b',r'\b(?:some|several|\d+)\s+(?:questions|topics|items|sources)\s+(?:were\s+)?(?:not included|omitted)\b',r'\b(?:als\s+)?(?:pending|pinned|active)(?:-status)?\s+(?:markiert|gekennzeichnet)\b',r'\bstatus\s*[:=]\s*(?:pending|pinned|active)\b']
DANG=r'\b(?:eine|einen|einem|einer|hohe|niedrige|mehrere|wenige|positive[nmrs]?|negative[nmrs]?|starke[nmrs]?|geringe[nmrs]?)\s*[.!?…»”’)]*$'
def parts(t):
    ci=t.find(':'); m=re.search(r'\s[–—-]\s',t)
    if ci>0: i,l=ci,1
    elif m: i,l=m.start(),len(m.group(0))
    else: return None
    if i<=0 or i>48: return None
    lead=re.sub(r'^[\s*_`~#]+|[\s*_`~#]+$','',unicodedata.normalize('NFKC',t[:i])).strip().lower()
    body=re.sub(r'[*_`~#]+','',t[i+l:]).strip()
    return (lead,body) if lead and body else None
def gate(o):
    if o['status']=='failed': return 'ok(failed)'
    if o['status']=='uncertain' and not o['statements']: return 'ok(uncertain-leer)'
    if len(o['statements'])<2: return 'Z65 <2 Aussagen'
    ps=[parts(s['text']) for s in o['statements']]
    if any(p is None for p in ps): return f'Z68 ohne Lead ({sum(p is None for p in ps)}/{len(ps)})'
    for s,p in zip(o['statements'],ps):
        t=s['text']
        if '**' in t or '__' in t or '`' in t: return 'Z74 Markup'
        if any(re.search(x,t,re.I) for x in TECH): return 'Z74 Technik-Meta'
        if re.search(DANG,p[1],re.I): return 'Z74 abgebrochen'
        if not(len(p[1])>=12 and re.search(r'[.!?…»”’)]$',p[1])): return 'Z74 unvollständig'
    leads=[p[0] for p in ps]
    if len(set(leads))!=len(leads): return 'Z80 doppelter Lead'
    if any(l in {'beispiel','beispiele','frage','fragen'} for l in leads): return 'Z82 generischer Lead'
    return 'ok'
res=collections.defaultdict(collections.Counter)
out=[]
for d in ['baseline','ablation','ablation-wiederholung-nach-oom']:
    for f in sorted(glob.glob(f'referat/evidenz/2c/{d}/*-lauf[0-9].json')):
        j=json.load(open(f)); run=j['run'] if d=='baseline' else j
        e=[x for x in ex if x['startedAt']>=run['startedAt']-50 and x['endedAt']<=run['endedAt']+50]
        if not e or e[0].get('status')!=200: res[(d,run['fall'],run.get('variante','voll'))]['ungültig']+=1; continue
        o=json.loads(e[0]['response']['choices'][0]['message']['content'])['output']
        en=sum(bool(re.search(r'\b(the|is|of|and|with)\b',s['text'])) for s in o['statements'])
        g=gate(o); res[(d,run['fall'],run.get('variante','voll'))][g+(' EN' if en>len(o['statements'])/2 else '')]+=1
for k,v in res.items(): print(*k, dict(v))
