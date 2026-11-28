const RAW = "https://raw.githubusercontent.com/iwata-monogatari/enshu-lifehack-home/main/public";
const DATA = "/weekend-events-data.json", HUB = "/weekend-events/";
const cities = ["morimachi","iwata","fukuroi","kakegawa","hamamatsu","kikugawa","omaezaki","kosai","enshu"];
const maxBytes = 300000;
function verified(stamp) {
  const age=Date.now()-Date.parse(stamp);
  return Number.isFinite(age)&&age>=-300000&&age<=36*3600000;
}
async function load(r) {
  if(!r?.ok) throw Error('source unavailable');
  const value=await r.text();
  if(value.length>maxBytes) throw Error('unexpected size');
  const p=JSON.parse(value);
  if(p.schema!==1||!cities.every(k=>p.regions?.[k]&&Array.isArray(p.regions[k].events))||!verified(p.regions.enshu.checkedAt)) throw Error('stale or invalid');
  return p;
}
const names={morimachi:"森町",iwata:"磐田",fukuroi:"袋井",kakegawa:"掛川",hamamatsu:"浜松",kikugawa:"菊川",omaezaki:"御前崎",kosai:"湖西"};
const localDay=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"});
const localTime=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const fmt=d=>Number(d.slice(5,7))+"月"+Number(d.slice(8,10))+"日";
const inc=(d,n)=>new Date(Date.parse(d+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const safe=s=>{try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const dated=d=>typeof d==="string"&&/^\d{4}-\d\d-\d\d$/.test(d);
function hub(data){
  const now=Date.now(),today=localDay.format(new Date(now));
  const dow=new Date(today+"T00:00:00Z").getUTCDay(),sat=inc(today,dow===0?-1:6-dow),sun=inc(sat,1);
  const ranges=[[today>sat?today:sat,sun,sat,"今週末"],[inc(sat,7),inc(sun,7),inc(sat,7),"次の週末"]];
  const areas=Object.entries(names).map(([k,n])=>{
    const r=data.regions[k];
    const checked=verified(r?.checkedAt);
    let thisCount=0;
    const lists=checked?ranges.map(([start,end,first,label],i)=>{
      const a=r.events.filter(x=>x&&typeof x.title==="string"&&safe(x.url)&&dated(x.start)&&dated(x.end)&&verified(x.checkedAt)&&["scheduled","weather"].includes(x.status)&&x.start<=end&&x.end>=start&&(!x.endsAt||Date.parse(x.endsAt)>now)).slice(0,36);
      if(!i)thisCount=a.length;
      if(!a.length)return "";
      return "<li><strong>"+label+"（"+fmt(first)+"〜"+fmt(end)+"）</strong><ul>"+a.map(x=>"<li><a href=\""+esc(safe(x.url))+"\">"+esc(x.title)+"</a>　"+esc([fmt(x.start)+(x.end!==x.start?"〜"+fmt(x.end):""),x.hours,x.venue,x.note,x.status==="weather"?"天候による変更は主催者発表を確認":""].filter(Boolean).join("／"))+"</li>").join("")+"</ul></li>";
    }).join(""):"";
    const status=checked?(thisCount?"":"今週末に掲載できる催しは確認できていません。")+"公式情報の確認："+localTime.format(new Date(r.checkedAt))+"（日本時間）。確認後の変更・中止は主催者発表をご覧ください。":"この地域の情報を再確認しています。";
    return '<section id="'+k+'" data-weekend-events="'+k+'" data-weekend-layout="all" aria-labelledby="'+k+'-heading"><h2 id="'+k+'-heading">'+n+'の週末イベント</h2><p data-weekend-status>'+esc(status)+'</p><ul data-weekend-list>'+lists+'</ul><p><a href="https://'+k+'.enshu-lifehack.com/">'+n+'ライフハックへ</a></p></section>';
  }).join("");
  const nav=Object.entries(names).map(([k,n])=>'<a href="#'+k+'">'+n+'</a>').join("");
  return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>遠州の今週末のイベント｜8市町の公式情報</title><meta name="description" content="遠州8市町の週末イベント。日程・会場と主催者の公式情報を確認できます。"><link rel="canonical" href="https://enshu-lifehack.com/weekend-events/"><script defer src="/weekend-events.js"></script><style>body{margin:0;background:#f7f8f5;color:#20332b;font:1rem/1.72 system-ui,sans-serif}main,header{max-width:65rem;margin:auto;padding:1rem}a{color:#145f50;text-underline-offset:.2em}nav{display:flex;gap:.5rem;flex-wrap:wrap}nav a{padding:.3rem .68rem;background:#e3f0e8;border-radius:.45rem}section{margin:1rem 0;padding:1rem;background:white;border:1px solid #ceded4;border-radius:.6rem;scroll-margin-top:1rem}h1,h2{line-height:1.35}li{margin:.25rem 0;overflow-wrap:anywhere}</style></head><body><header><a href="/">遠州ライフハック</a></header><main><h1>遠州の今週末のイベント</h1><p>森町・磐田・袋井・掛川・浜松・菊川・御前崎・湖西の催しを、主催者や自治体の案内から掲載します。</p><nav aria-label="市町を選ぶ">'+nav+'</nav>'+areas+'<p>未掲載の催しもあります。予約の要否、開催の可否、臨時休館は主催者の発表をご確認ください。</p></main></body></html>';
}

export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    const data=path===DATA;
    if((!data&&path!==HUB)||!["GET","HEAD"].includes(request.method)) return env.ASSETS.fetch(request);
    const headers={"Content-Type":data?"application/json; charset=utf-8":"text/html; charset=utf-8","Cache-Control":"public, max-age=120","X-Content-Type-Options":"nosniff",...(data?{"Access-Control-Allow-Origin":"*"}:{})};
    let body=null, source=null;
    try{
      body=await load(await fetch(RAW+DATA,{redirect:"error",signal:AbortSignal.timeout(4000),cf:{cacheEverything:true,cacheTtl:120}}));
      source="repository";
    } catch {}
    if(body===null){
      try{body=await load(await env.ASSETS.fetch(new Request(new URL(DATA,request.url),{method:"GET"})));source="backup";} catch {}
    }
    if(body!==null) return new Response(request.method==="HEAD"?null:(data?JSON.stringify(body):hub(body)),{headers:{...headers,"X-Weekend-Source":source}});
    const message=data?'{"error":"temporarily_unavailable"}':'<!doctype html><html lang="ja"><meta charset="utf-8"><title>遠州の週末イベント</title><h1>遠州の週末イベント</h1><p>最新情報を確認できていません。時間をおいてもう一度ご確認ください。</p><p><a href="/">遠州ライフハックへ</a></p></html>';
    return new Response(request.method==="HEAD"?null:message,{status:503,headers:{...headers,"Cache-Control":"no-store","Retry-After":"300"}});
  },
};

