// Judge-1 private driver: desktop 1280x800 Chromium, native mouse + keyboard, network log.
// Imports Playwright from the frozen packet's tools/node_modules. Writes only to judge-1/desktop.
const path=require('path');const fs=require('fs');
const R='C:/Users/travi/.t3/worktrees/gloamwater/t3-201b6bf7-54dc20bc5d519c6e/judging/round-6';
const { chromium } = require(R+'/packet/tools/node_modules/playwright');
const OUT=R+'/judge-1/desktop';const URL='file:///'+R+'/packet/index.html';
(async()=>{
  const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:800}});
  const p=await ctx.newPage();const net=[],errs=[];
  p.on('request',r=>net.push(r.url().slice(0,120)));p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  await p.goto(URL);await p.waitForTimeout(1500);
  await p.screenshot({path:OUT+'/01-title.png'});
  const focus=async()=>p.evaluate(()=>{const a=document.activeElement;return a?(a.id||a.className||a.tagName)+' | '+(a.innerText||a.getAttribute('aria-label')||'').slice(0,40):null;});
  const log=[];
  // native keyboard: Enter on focused Cast off
  log.push('focus at load: '+await focus());
  await p.keyboard.press('Enter');await p.waitForTimeout(1200);log.push('after Enter: '+await focus());
  await p.keyboard.type('Keys');await p.keyboard.press('Enter');await p.waitForTimeout(1500);
  log.push('after name+Enter: '+await focus());
  await p.screenshot({path:OUT+'/02-tour.png'});
  // skip tour by Escape
  await p.keyboard.press('Escape');await p.waitForTimeout(1000);log.push('after Esc: '+await focus());
  await p.screenshot({path:OUT+'/03-after-esc.png'});
  for(let i=0;i<6;i++){await p.keyboard.press('Tab');await p.waitForTimeout(150);log.push('Tab '+i+': '+await focus());}
  await p.screenshot({path:OUT+'/04-tab-focus.png'});
  await p.keyboard.press('ArrowDown');await p.waitForTimeout(300);log.push('ArrowDown: '+await focus());
  await p.keyboard.press('b');await p.waitForTimeout(1000);log.push('b: '+await focus());
  await p.screenshot({path:OUT+'/05-key-b.png'});
  await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');await p.waitForTimeout(300);
  await p.screenshot({path:OUT+'/06-arrows.png'});
  await p.keyboard.press('Escape');await p.waitForTimeout(800);log.push('Esc: '+await focus());
  await p.keyboard.press('3');await p.waitForTimeout(1000);log.push('3: '+await focus());
  await p.screenshot({path:OUT+'/07-key-3.png'});
  await p.keyboard.press('?');await p.waitForTimeout(1000);
  await p.screenshot({path:OUT+'/08-help.png'});await p.keyboard.press('Escape');await p.waitForTimeout(600);
  await p.keyboard.press('m');await p.waitForTimeout(400);
  log.push('mute aria: '+await p.evaluate(()=>[...document.querySelectorAll('[aria-label*=ound i],[title*=ound i]')].map(e=>e.getAttribute('aria-pressed')+'/'+e.getAttribute('aria-label')).join(';')));
  await p.keyboard.press('m');
  // hover on a map node
  const node=p.locator('g.node').nth(2);await node.hover();await p.waitForTimeout(500);await p.screenshot({path:OUT+'/09-hover.png'});
  // reduced motion
  const p2=await (await b.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'})).newPage();
  await p2.goto(URL);await p2.waitForTimeout(800);
  const rm=await p2.evaluate(()=>({animateEls:document.querySelectorAll('#title animate').length,mm:matchMedia('(prefers-reduced-motion: reduce)').matches}));
  log.push('reduced-motion: '+JSON.stringify(rm));
  const nonFile=net.filter(u=>!u.startsWith('file:')&&!u.startsWith('data:')&&!u.startsWith('blob:'));
  const res={url:URL,requests:net.length,nonFileRequests:nonFile,errors:errs,log};
  fs.writeFileSync(OUT+'/desktop-check.json',JSON.stringify(res,null,1));console.log(JSON.stringify(res,null,1));
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
