const fs=require('fs'),path=require('path');
const pw=require('C:/Users/travi/.t3/worktrees/gloamwater/t3-201b6bf7-54dc20bc5d519c6e/tools/node_modules/playwright');
const root=process.cwd(),out=path.join(root,'judging/round-3/judge-3'),url='file:///'+root.replaceAll('\\','/')+'/judging/round-3/packet/index.html';
const src=fs.readFileSync('tools/phone/server.js','utf8');const audio=src.split('const AUDIO_INIT = `')[1].split('`;')[0];
const log=[];function record(x){log.push(x);fs.writeFileSync(path.join(out,'safe-run-log.json'),JSON.stringify(log,null,2));console.log(JSON.stringify(x));}
(async()=>{const browser=await pw.webkit.launch();try{for(let run=1;run<=1;run++){
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});await ctx.addInitScript(audio);await ctx.setOffline(true);const p=await ctx.newPage();p.setDefaultTimeout(4000);const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.on('request',r=>requests.push(r.url()));
const pause=ms=>p.waitForTimeout(ms);async function tap(s){const el=p.locator(s).first();await el.scrollIntoViewIfNeeded();const b=await el.boundingBox();if(!b)throw Error('no box '+s);await p.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);await pause(450);}
async function shot(n){await p.screenshot({path:path.join(out,n+'.png')});}
await p.goto(url);await pause(800);if(run===1)await shot('safe-title');await tap('#t-new');await tap('#go');await pause(900);await tap('[data-skip]');await pause(500);
for(let turn=0;turn<60;turn++){
let state=await p.evaluate(()=>({day:S.day,loc:S.loc,cash:S.cash,debt:S.debt,hull:S.hull,over:S.over}));record({run,state});if(state.over)break;
if(turn===0){await shot('safe-market');if(run===1){await tap('#b-mute2');record({audioMuted:await p.evaluate(()=>({muted:Sound.muted,audio:window.__pwAudio}))});await tap('#b-mute2');}}
await tap('#mnav [data-v="market"]'); // Sell current owned goods through touch sheets; selection uses only current market and owned inventory.
const sells=await p.evaluate(()=>GOODS.filter(g=>S.cargo[g.id].q&&S.stock[S.loc][g.id]).map(g=>g.id));
for(const id of sells){await tap('.row[data-g="'+id+'"]');await tap('[data-mode="sell"]');await tap('[data-max]');await tap('#qgo');}
if(state.day>=30){await tap('#mnav [data-v="harbor"]');await tap('[data-act="settle"]');await tap('[data-choice="yes"]');await pause(1800);await shot('safe-ending');record({run,ending:await p.locator('#modal').innerText(),tally:await p.evaluate(()=>tally('complete'))});break;}
// Buy a locally cheap affordable good, never inspect other districts' unseen prices or future events.
const buy=await p.evaluate(()=>GOODS.filter(g=>S.stock[S.loc][g.id]&&maxBuy(g.id)>0).map(g=>({id:g.id,ratio:price(g.id)/g.base})).sort((a,b)=>a.ratio-b.ratio)[0]);
if(buy&&buy.ratio<1.1){await tap('.row[data-g="'+buy.id+'"]');if(await p.locator('#qgo').isEnabled())await tap('#qgo');else await tap('[data-x]');}
await tap('#mnav [data-v="map"]'); await tap('#nodes [data-d="lq"]'); await tap('[data-act="stay"]');for(let j=0;j<80;j++){await pause(350);let a=await p.evaluate(()=>({over:S.over,busy,modal:!document.querySelector('#modal').hidden,choices:[...document.querySelectorAll('#modal [data-choice]:not(:disabled)')].map(e=>({key:e.dataset.choice,text:e.innerText})),night:!!document.querySelector('.nightcard')}));if(a.over){await shot('safe-ending');record({run,ending:await p.locator('#modal').innerText()});break;}if(a.modal&&a.choices.length){record({run,event:a.choices});const c=a.choices.find(x=>['ok','no','leave','shelter','yield','pay'].includes(x.key))||a.choices[0];await tap('[data-choice="'+c.key+'"]');}else if(a.night){await p.touchscreen.tap(195,400);}else if(!a.busy)break;}
await pause(700);if(await p.evaluate(()=>S.over))break;
}
record({run,final:await p.evaluate(()=>({day:S.day,over:S.over,stats:S.stats,tally:tally(S.hull<=0?'sunk':'complete')})),errors,requests,audio:await p.evaluate(()=>window.__pwAudio)});
await p.reload();await pause(700);record({run,scoresAfterReload:await p.evaluate(()=>loadScores())});await ctx.close();}
}finally{await browser.close();}})().catch(e=>{record({fatal:e.stack});process.exitCode=1});


