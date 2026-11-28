import html
import json
from pathlib import Path
from datetime import date,datetime,timezone,timedelta
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
JST=timezone(timedelta(hours=9))
CITIES={'morimachi':'森町','iwata':'磐田','fukuroi':'袋井','kakegawa':'掛川','hamamatsu':'浜松','kikugawa':'菊川','omaezaki':'御前崎','kosai':'湖西'}
ORIGIN='https://enshu-lifehack.com'
def parse_time(s): return datetime.fromisoformat(s.replace('Z','+00:00'))
def esc(s): return html.escape(str(s),quote=True)
def safe_url(s):
 u=urlparse(s)
 return u.scheme=='https' and u.hostname and not u.username and not u.password and not any(c.isspace() for c in s)
def say(d): return f'{d.month}月{d.day}日'
def main():
 data=json.loads((PUB/'weekend-events-data.json').read_text(encoding='utf-8-sig'))
 assert data['schema']==1 and set(data['regions'])==set(CITIES)|{'enshu'}
 now=parse_time(data['regions']['enshu']['checkedAt'])
 assert now.utcoffset() is not None
 today=now.astimezone(JST).date()
 saturday=today+timedelta((5-today.weekday()) if today.weekday()!=6 else -1)
 ranges=[(max(today,saturday),saturday+timedelta(1),'今週末'),(saturday+timedelta(7),saturday+timedelta(8),'次の週末')]
 body=[]
 for code,name in CITIES.items():
  reg=data['regions'][code]; seen=set()
  assert reg['name']==name and len(reg['events'])<=60
  updated=parse_time(reg['checkedAt'])
  assert updated.utcoffset() is not None and updated<=now+timedelta(minutes=5)
  for x in reg['events']:
   assert safe_url(x['url']) and x['title'].strip() and x['area']==name
   assert x['status'] in ('scheduled','weather','cancelled','postponed','closed')
   start,end=date.fromisoformat(x['start']),date.fromisoformat(x['end'])
   assert start<=end and (end-start).days<=370
   st=parse_time(x['checkedAt']); assert st.utcoffset() is not None and st<=updated+timedelta(minutes=5)
   assert (x['title'],x['start'],x['end']) not in seen; seen.add((x['title'],x['start'],x['end']))
   if x.get('endsAt'): assert parse_time(x['endsAt']).astimezone(JST).date()==end
  items=[]
  for start,end,label in ranges:
   records=[]
   for x in sorted(reg['events'],key=lambda x:(x['start'],x['title'])):
    if (x['status'] not in ('scheduled','weather') or date.fromisoformat(x['start'])>end or date.fromisoformat(x['end'])<start or now-parse_time(x['checkedAt'])>timedelta(hours=36) or (x.get('endsAt') and parse_time(x['endsAt'])<=now)): continue
    a,b=date.fromisoformat(x['start']),date.fromisoformat(x['end'])
    details=[say(a)+(f'〜{say(b)}' if b!=a else ''),x.get('hours'),x.get('venue'),x.get('note')]
    if x['status']=='weather': details.append('天候による変更は主催者発表を確認')
    records.append(f'<li><a href="{esc(x["url"])}">{esc(x["title"])}</a>　{esc("／".join(y for y in details if y))}</li>')
   if records: items.append(f'<li><strong>{label}（{say(start)}〜{say(end)}）</strong><ul>{"".join(records)}</ul></li>')
  body.append(f'<section id="{code}" data-weekend-events="{code}" data-weekend-layout="all" aria-labelledby="{code}-heading"><h2 id="{code}-heading">{name}の週末イベント</h2><p data-weekend-status>確認時の記録：{updated.astimezone(JST):%Y/%m/%d %H:%M}（日本時間）。変更・中止は公式発表をご確認ください。</p><ul data-weekend-list>{"".join(items)}</ul><p><a href="https://{code}.enshu-lifehack.com/">{name}ライフハックへ</a></p></section>')
 expected=[x for code in CITIES for x in data['regions'][code]['events']]
 assert sorted(data['regions']['enshu']['events'],key=lambda x:(x['area'],x['start'],x['title']))==sorted(expected,key=lambda x:(x['area'],x['start'],x['title']))
 cards=''.join(f'<a href="#{k}">{v}</a>' for k,v in CITIES.items())
 title='遠州の今週末のイベント｜8市町の公式情報'
 desc='森町・磐田・袋井・掛川・浜松・菊川・御前崎・湖西の週末イベント。日程・会場と主催者の公式情報を確認できます。'
 layout=f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><meta name="description" content="{desc}"><link rel="canonical" href="{ORIGIN}/weekend-events/"><script defer src="/weekend-events.js"></script><style>body{{margin:0;background:#f7f8f5;color:#20332b;font:1rem/1.72 system-ui,sans-serif}}main,header{{max-width:65rem;margin:auto;padding:1rem}}a{{color:#145f50;text-underline-offset:.2em}}nav{{display:flex;gap:.5rem;flex-wrap:wrap}}nav a{{padding:.3rem .68rem;background:#e3f0e8;border-radius:.45rem}}section{{margin:1rem 0;padding:1rem;background:white;border:1px solid #ceded4;border-radius:.6rem;scroll-margin-top:1rem}}h1,h2{{line-height:1.35}}li{{margin:.25rem 0;overflow-wrap:anywhere}}</style></head><body><header><a href="/">遠州ライフハック</a></header><main><h1>遠州の今週末のイベント</h1><p>{desc} 毎日、掲載元を確認し、変更・中止や終了に合わせて更新します。</p><nav aria-label="市町を選ぶ">{cards}</nav>{''.join(body)}<p>未掲載の催しもあります。予約の要否、開催の可否、臨時休館は主催者の発表をご確認ください。</p></main></body></html>'''
 p=PUB/'weekend-events/index.html';p.parent.mkdir(exist_ok=True);p.write_text(layout+'\n',encoding='utf-8',newline='\n')
 print('Weekend data validated:',len(CITIES),'cities /',len(expected),'records')
if __name__=='__main__': main()
