// Måler hvilke modelfelter der faktisk påvirker resultatet (ændrer ét felt ad gangen). Kør: NODE_PATH=$(npm root -g) node tools/probe-settings.mjs
// OBS: "DEAD" betyder kun "ingen effekt i grundmodellen" – felter for inaktive moduler (armering m.m.) skal testes i modeller hvor de er aktive.
import { openEngine, clone } from '../tests/lib/engine.mjs';
const e = await openEngine();
const base = clone(e.baseModel);
const fp = (o)=>{ if(!o.result) return 'ERR:'+JSON.stringify(o.fejl||o.tilstand).slice(0,80);
  const r=o.result; return JSON.stringify({u:r.maksUdnyttelse,ev:r.eftervisninger.map(x=>[x.id,x.NRd,x.VRd,x.NEd,x.VEd,x.udnyttelse,x.relevant]),pk:r.partialkoefficienter,ak:r.ankerkraefter,adv:r.advarsler?.length}); };
const b = await e.load(base); const bf = fp(b);
const leaves=[]; (function walk(o,p){ for(const [k,v] of Object.entries(o)){ const q=[...p,k]; if(v&&typeof v==='object'&&!Array.isArray(v)) walk(v,q); else if(!Array.isArray(v)) leaves.push([q,v]); } })(base,[]);
const skip=/^(projekt|meta|version)/;
const setp=(m,p,v)=>{let o=m; for(const k of p.slice(0,-1)) o=o[k]; o[p.at(-1)]=v;};
const res={dead:[],live:[],rej:[]};
for(const [p,v] of leaves){ const path=p.join('.'); if(skip.test(path)) continue;
  let cands=[];
  if(typeof v==='number') cands=[v===0?1:v*1.3, v*0.7];
  else if(typeof v==='boolean') cands=[!v];
  else if(v===null) cands=[100, 0.5, 20];
  else if(typeof v==='string'){ const enums={ 'indstillinger.kontrolklasse':['lempet','skaerpet'],'indstillinger.konsekvensklasse':['CC1','CC3'],'indstillinger.interaktion':['kvadratisk','lineaer','summation'],'beton.klasse':['C50/60'],'anker.type':['indlimet'],'anker.staalklasse':['5.8'],'plade.hulfrigang':['stor'],'plade.mellemlaeg':['mortel'],'plade.indspaending':['stiv'],'beton.armering.afskalning':['normal'],'beton.armering.kantarmering':['kant'],'indstillinger.staalInteraktionVedLoeftestang':['inkluder','med'],'indstillinger.pryoutEnkeltanker':['alle','enkelt','samlet'],'anker.hovedForm':['firkant'],'beton.armering.ankerarmeringTraek.foering':['god'],'beton.armering.ankerarmeringForskydning.type':['kant']}; cands=enums[path]||[]; }
  let changed=false, anyOk=false, errs=[];
  for(const c of cands){ const m=clone(base); setp(m,p,c); const o=await e.load(m); const f=fp(o); if(f.startsWith('ERR')){errs.push(f);continue;} anyOk=true; if(f!==bf){changed=true;break;} }
  (changed?res.live:anyOk?res.dead:res.rej).push(path+(errs.length&&!anyOk?'  ['+errs[0]+']':''));
}
console.log('LIVE',res.live.length,'\nDEAD (no effect on any result in base case)\n'+res.dead.join('\n'),'\nREJECTED/NONE\n'+res.rej.join('\n'));
await e.close();
