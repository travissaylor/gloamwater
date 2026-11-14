const fs=require('fs');
const path=require('path');
(async()=>{const steps=process.argv.slice(2).join(' ');const r=await fetch('http://127.0.0.1:9452/steps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({steps:steps.split(/\s+;;\s+/)})});const t=await r.text();fs.appendFileSync(path.join(__dirname,'touch-session.log'),`\n${new Date().toISOString()}\n${steps}\n${t}\n`);for(const s of JSON.parse(t).results) console.log(`> ${s.step}\n${s.out||s.error}`);})().catch(e=>{console.error(e);process.exitCode=1;});

