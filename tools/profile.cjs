// Chromium diagnostic: normal-speed voyage plus repeated-run heap/listener sampling.
// The voyage uses real game functions with automatic safe dialog answers. This is not human play.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const args=process.argv.slice(2),arg=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const game=path.resolve(arg('--game',path.join(__dirname,'../game/index.html')));
const out=path.resolve(arg('--out',path.join(__dirname,'profile-evidence')));
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--enable-precise-memory-info']});
  const report={game,sha256:crypto.createHash('sha256').update(fs.readFileSync(game)).digest('hex'),method:'Normal-speed Chromium game-function voyage; 40 fixture restarts, garbage collection and CDP metrics',limitations:['Not physical iPhone performance or an audible quality test.','One normal voyage is a timing sample, not a full normal-speed game.','Lifecycle fixtures call startGame directly and are separate from UI play.']};
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'no-preference'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(game).href);
    await page.locator('#t-new').tap();await page.waitForTimeout(500);
    await page.locator('#go').tap();
    await page.locator('[data-skip]').waitFor();await page.locator('[data-skip]').tap();
    await page.waitForTimeout(500);
    // Safe automation answers only the visible offer, never a future outcome.
    await page.evaluate(()=>{window.choose=c=>{const enabled=c.choices.filter(x=>!x.disabled);const safe=['ok','pay','yield','shelter','leave','no'];return Promise.resolve((safe.map(k=>enabled.find(x=>x.key===k)).find(Boolean)||enabled[0]).key);};});
    report.voyage=await page.evaluate(async()=>{
      const frames=[],start=performance.now();let previous=null,sampling=true;
      function sample(now){if(previous!==null)frames.push(now-previous);previous=now;if(sampling)requestAnimationFrame(sample);}
      requestAnimationFrame(sample);await sailTo('sm');sampling=false;
      const sorted=frames.filter(n=>n>0).sort((a,b)=>a-b),at=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
      return {elapsedMs:Math.round(performance.now()-start),day:S.day,frames:frames.length,medianFrameMs:at(.5),p95FrameMs:at(.95),maxFrameMs:sorted.at(-1),fast:FAST,reducedMotion:REDUCED};
    });
    await page.screenshot({path:path.join(out,'normal-arrival.png'),scale:'css'});
    const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
    async function measure(label){
      await page.waitForTimeout(5000);await cdp.send('HeapProfiler.collectGarbage');
      const {metrics}=await cdp.send('Performance.getMetrics');
      const wanted=['JSHeapUsedSize','Nodes','Documents','JSEventListeners','TaskDuration','ScriptDuration'];
      return {label,...Object.fromEntries(metrics.filter(m=>wanted.includes(m.name)).map(m=>[m.name,m.value]))};
    }
    await page.evaluate(()=>{startGame(newState('Profile'),false);});
    report.lifecycle=[await measure('baseline')];
    for(const count of [20,40]){
      await page.evaluate(()=>{for(let i=0;i<20;i++)startGame(newState('Profile'),false);});
      report.lifecycle.push(await measure(count+' restarts'));
    }
    const [baseline,,last]=report.lifecycle;
    report.listenerDelta=last.JSEventListeners-baseline.JSEventListeners;
    report.nodeDelta=last.Nodes-baseline.Nodes;
    report.heapDeltaBytes=last.JSHeapUsedSize-baseline.JSHeapUsedSize;
    report.errors=errors;report.pass=errors.length===0&&report.voyage.day===2&&report.voyage.frames>0&&report.listenerDelta<=5;
  }finally{
    await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  }
  console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
