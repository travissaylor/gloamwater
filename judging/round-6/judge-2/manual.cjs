'use strict';
const fs=require('fs'),path=require('path'),readline=require('readline');
const {pathToFileURL}=require('url');
const out=__dirname, packet=path.resolve(out,'../packet');
const pw=require(path.join(packet,'tools/node_modules/playwright'));
const audio=fs.readFileSync(path.join(packet,'tools/phone/server.js'),'utf8').match(/const AUDIO_INIT = `([\s\S]*?)`;/)[1];
const probe=fs.readFileSync(path.join(packet,'tools/phone/probe.js'),'utf8');
const log=x=>{fs.appendFileSync(path.join(out,'manual-transcript.jsonl'),JSON.stringify(x)+'\n');console.log(JSON.stringify(x));};
(async()=>{
const browser=await pw.webkit.launch({headless:true});
const context=await browser.newContext({...pw.devices['iPhone 13'],viewport:{width:390,height:844}});
await context.addInitScript(audio);
const page=await context.newPage();page.setDefaultTimeout(8000);
const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
context.on('request',r=>{if(/^https?:/i.test(r.url()))network.push(r.url());});
await page.goto(pathToFileURL(path.join(packet,'index.html')).href);log({ready:true});
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
for await(const line of rl){try{const commands=JSON.parse(line);let result=[];
for(const c of commands){const [op,arg,arg2]=c;
 if(op==='tap')await page.locator(arg).first().tap();
 else if(op==='texttap')await page.getByRole('button',{name:arg,exact:true}).tap();
 else if(op==='key')await page.keyboard.press(arg);
 else if(op==='type')await page.keyboard.type(arg);
 else if(op==='wait')await page.waitForTimeout(arg);
 else if(op==='shot'){await page.screenshot({path:path.join(out,arg),scale:'css'});result.push({shot:arg});}
 else if(op==='text')result.push({text:await page.locator('body').innerText()});
 else if(op==='ui'){await page.evaluate(probe);result.push({ui:await page.evaluate(()=>window.__phoneProbe.ui())});}
 else if(op==='audit'){await page.evaluate(probe);result.push({audit:await page.evaluate(()=>window.__phoneProbe.audit())});}
 else if(op==='size')await page.setViewportSize({width:arg,height:arg2});
 else if(op==='reload')await page.reload();
 else if(op==='scroll')await page.locator(arg).evaluate((e,y)=>e.scrollBy(0,y),arg2);
 else if(op==='audio')result.push({audio:await page.evaluate(()=>({shim:__pwAudio.shim,ctxs:__pwAudio.ctxs.map(x=>({...x.rec,state:x.c.state})),sounds:__pwAudio.sounds}))});
 else if(op==='errors')result.push({errors,network});
 else if(op==='stop'){fs.writeFileSync(path.join(out,'manual-diagnostics.json'),JSON.stringify({errors,network},null,2));await browser.close();log({closed:true});process.exit(0);}
 else throw Error('Unknown operation '+op);
 if(['tap','texttap','key','type'].includes(op))await page.waitForTimeout(400);
}log({commands,result});}catch(e){log({failure:String(e)});}}
await browser.close();
})().catch(e=>{log({fatal:e.stack});process.exit(1);});
