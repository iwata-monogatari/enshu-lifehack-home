import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import worker from "../src/weekend-worker.mjs";
const p=JSON.parse(await readFile(new URL("../public/weekend-events-data.json",import.meta.url)));
const japan=n=>{const t=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});return new Date(Date.parse(t+"T00:00:00Z")+86400000*n).toISOString().slice(0,10)};
const stamp=new Date().toISOString();
for(const r of Object.values(p.regions)){r.checkedAt=stamp;r.events=[];}
const dow=new Date(japan(0)+"T00:00:00Z").getUTCDay(), n=dow===0?0:6-dow;
p.regions.iwata.events=[{title:"安全 <script>",start:japan(n),end:japan(n),url:"https://example.org/event",checkedAt:stamp,status:"scheduled"},{title:"CANCELLED-ID",start:japan(n),end:japan(n),url:"https://example.org/event",checkedAt:stamp,status:"cancelled"},{title:"ELAPSED-ID",start:japan(n),end:japan(n),url:"https://example.org/event",checkedAt:stamp,status:"scheduled",endsAt:new Date(Date.now()-10000).toISOString()},{title:"STALE-ID",start:japan(n),end:japan(n),url:"https://example.org/event",checkedAt:"2000-01-01T00:00:00Z",status:"scheduled"}];
const env={ASSETS:{fetch:async r=>new URL(r.url).pathname==="/weekend-events-data.json"?Response.json(p):new Response("unrelated")}};
globalThis.fetch=async()=>Response.json(p); // mocked fixed public source, no outbound calls
const req=(p,m="GET")=>new Request("https://enshu-lifehack.com"+p,{method:m});
let result=await worker.fetch(req("/weekend-events/"),env);
assert.equal(result.headers.get("X-Weekend-Source"),"repository");
const body=await result.text();
assert.equal((body.match(/data-weekend-events=/g)||[]).length,8);
assert.match(body,/安全 &lt;script&gt;/);assert.doesNotMatch(body,/CANCELLED-ID|ELAPSED-ID|STALE-ID/);
result=await worker.fetch(req("/weekend-events-data.json"),env);assert.equal(result.headers.get("Access-Control-Allow-Origin"),"*");
assert.equal((await worker.fetch(req("/weekend-events/","HEAD"),env)).body,null);
assert.equal(await (await worker.fetch(req("/existing"),env)).text(),"unrelated");
globalThis.fetch=async()=>new Response("bad",{status:500});
assert.equal((await worker.fetch(req("/weekend-events/"),env)).headers.get("X-Weekend-Source"),"backup");
p.regions.enshu.checkedAt="2000-01-01T00:00:00Z";
assert.equal((await worker.fetch(req("/weekend-events-data.json"),env)).status,503);
assert.equal((await worker.fetch(req("/weekend-events/"),env)).headers.get("X-Weekend-Source"),"browser");
console.log("PASS eight regions, HTML escaping, cancelled/elapsed/stale exclusions, JSON CORS, HEAD, unrelated, backup, expiry");

