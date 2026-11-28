(() => {
  "use strict";
  const host = "https://enshu-lifehack.com";
  const groups = [...document.querySelectorAll("[data-weekend-events]")];
  if (!groups.length) return;
  const day = 86400000;
  const formatter = new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit"});
  const localDay = stamp => formatter.format(new Date(stamp));
  const later = (iso,n) => new Date(Date.parse(iso+"T00:00:00Z")+n*day).toISOString().slice(0,10);
  const friendly = iso => Number(iso.slice(5,7))+"月"+Number(iso.slice(8,10))+"日";
  const set = (e,s) => { if(e) e.textContent=s; };
  const maxAge = 36 * 3600000;
  let payload = null;
  const valid = (stamp,now) => {
    const parsed=Date.parse(stamp);
    return Number.isFinite(parsed) && parsed<=now+300000 && now-parsed<=maxAge;
  };
  const url = s => {
    try {const u=new URL(s); return u.protocol==="https:"&&!u.username&&!u.password ? u.href : null;} catch {return null;}
  };
  function render() {
    const now=Date.now(), today=localDay(now);
    const weekday = new Date(today+"T00:00:00Z").getUTCDay();
    const sat = later(today,weekday===0?-1:6-weekday), sun = later(sat,1);
    const followingSat=later(sat,7), followingSun=later(sun,7);
    for(const g of groups){
      const code=g.dataset.weekendEvents;
      const status=g.querySelector("[data-weekend-status]");
      const list=g.querySelector("[data-weekend-list]");
      if(!list) continue;
      const layout=g.dataset.weekendLayout;
      const region=payload?.regions?.[code];
      const ranges=[[today>sat?today:sat,sun,sat],[followingSat,followingSun,followingSat]];
      list.replaceChildren();
      if(!region||!valid(region.checkedAt,now)){
        set(status,"最新の情報を確認できていません。お出かけ前に主催者の公式情報をご確認ください。");
        continue;
      }
      const items=Array.isArray(region.events)?region.events:[];
      let displayed=0;
      for(const [from,to,displayStart] of ranges){
        const candidates=items.filter(x=>x && valid(x.checkedAt,now) &&
          (x.status==="scheduled"||x.status==="weather") && url(x.url) &&
          x.start<=to && x.end>=from && (!x.endsAt||Date.parse(x.endsAt)>now)).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title,"ja"));
        if(!candidates.length) continue;
        const cluster=document.createElement("li");
        const label=document.createElement("strong");
        label.textContent=(displayStart===sat?"今週末":"次の週末")+"（"+friendly(displayStart)+"〜"+friendly(to)+"）";
        cluster.append(label);
        const ul=document.createElement("ul");
        for(const x of candidates.slice(0,layout==="all"?36:7)){
          const li=document.createElement("li");
          const a=document.createElement("a");a.href=url(x.url);a.textContent=(code==="enshu"&&x.area?"【"+x.area+"】":"")+x.title;
          const dates=friendly(x.start)+(x.end!==x.start?"〜"+friendly(x.end):"");
          const details=[dates,x.hours,x.venue,x.note,x.status==="weather"?"天候による変更は主催者発表を確認":""].filter(Boolean);
          li.append(a,document.createTextNode("　"+details.join("／")));ul.append(li);displayed++;
        }
        cluster.append(ul);list.append(cluster);
      }
      const dateTime=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(region.checkedAt));
      const thisCount=items.filter(x=>x && valid(x.checkedAt,now) && ["scheduled","weather"].includes(x.status) && url(x.url) && x.start<=sun && x.end>=(today>sat?today:sat) && (!x.endsAt||Date.parse(x.endsAt)>now)).length;
      set(status,(thisCount?"":"今週末に掲載できる催しは確認できていません。")+
        "公式情報の確認："+dateTime+"（日本時間）。"+(displayed?"変更・中止はリンク先でご確認ください。":""));
    }
  }
  async function refresh(){
    const hour=new Date().toISOString().slice(0,13);
    try{
      const r=await fetch(host+"/weekend-events-data.json?v="+encodeURIComponent(hour),{cache:"no-store",credentials:"omit"});
      if(!r.ok) throw new Error("unavailable");
      const next=await r.json();
      if(next.schema!==1||typeof next.regions!=="object"||!next.regions) throw new Error("invalid");
      payload=next;
    } catch { /* A prior payload remains visible only within its own freshness limit. */ }
    render();
  }
  render();
  refresh();
  setInterval(refresh,5*60000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden) refresh();});
})();

