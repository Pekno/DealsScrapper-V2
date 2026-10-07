const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer-extra');
const Stealth = require('puppeteer-extra-plugin-stealth');
puppeteer.use(Stealth());
const p = new PrismaClient();
const BASE='https://www.leboncoin.fr';

async function getFdata() {
  const b = await puppeteer.launch({ headless:true, args:['--no-sandbox','--disable-blink-features=AutomationControlled','--lang=fr-FR'] });
  const page = await b.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  const fdata = new Promise((res,rej)=>{
    const to=setTimeout(()=>rej(new Error('fdata not seen in 30s')),30000);
    page.on('response', async r=>{ if(!r.url().includes('/api/frontend/v1/data/v7/fdata')||r.status()!==200)return; try{clearTimeout(to);res(await r.json());}catch{} });
  });
  await page.goto(`${BASE}/recherche`,{waitUntil:'domcontentloaded',timeout:35000});
  const body = await fdata;
  await b.close();
  return body;
}
function parse(fdata){
  const out=[]; const raw=fdata?.categories; if(!raw||typeof raw!=='object')return out;
  for(const e of Object.values(raw)){
    const catId=String(e.catId??''); const name=e.name??e.label??''; if(!catId||!name)continue;
    const kids=Array.isArray(e.subcategories)&&e.subcategories.length>0;
    out.push({slug:catId,name,url:`${BASE}/recherche?category=${catId}`,parentId:null,isSelectable:!kids});
    if(kids)for(const s of e.subcategories){ if(s.type==='mirror')continue; const sid=String(s.catId??''); const sn=s.name??s.label??''; if(!sid||!sn)continue; out.push({slug:sid,name:sn,url:`${BASE}/recherche?category=${sid}`,parentId:catId,isSelectable:true}); }
  }
  // dedupe by slug
  const seen=new Set(); return out.filter(c=>!seen.has(c.slug)&&seen.add(c.slug));
}
async function seed(siteId,cats){
  const map=new Map(cats.map(c=>[c.slug,c]));
  function lvl(c){if(!c.parentId)return 0;const par=map.get(c.parentId);return par?lvl(par)+1:1;}
  let n=0;
  for(const c of [...cats].sort((a,b)=>lvl(a)-lvl(b))){
    let pid; if(c.parentId){const pc=await p.category.findFirst({where:{slug:c.parentId,siteId},select:{id:true}});pid=pc?.id;}
    await p.category.upsert({where:{siteId_sourceUrl:{siteId,sourceUrl:c.url}},
      create:{name:c.name,slug:c.slug,site:{connect:{id:siteId}},sourceUrl:c.url,parent:pid?{connect:{id:pid}}:undefined,level:lvl(c),isActive:true,isSelectable:c.isSelectable??true,dealCount:0,avgTemperature:0,popularBrands:[],userCount:0},
      update:{name:c.name,sourceUrl:c.url,parent:pid?{connect:{id:pid}}:{disconnect:true},level:lvl(c),isActive:true,isSelectable:c.isSelectable??true,updatedAt:new Date()}});
    n++;
  }
  return n;
}
(async()=>{
  try{ const f=await getFdata(); const cats=parse(f); console.log('fdata categories parsed:',cats.length); const n=await seed('leboncoin',cats); console.log('leboncoin: seeded',n,'categories'); }
  catch(e){ console.log('leboncoin: FAILED',e.message); }
  await p.$disconnect();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
