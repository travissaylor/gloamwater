const fs=require('fs'),path=require('path');
const lines=fs.readFileSync(path.join(__dirname,'../packet/index.html'),'utf8').split(/\r?\n/),selected=new Set();
lines.forEach((s,i)=>{if(/localStorage|AudioContext|const (?:GOODS|DISTRICTS|EVENTS)|function tally|prefers-reduced-motion|function (?:rand|rng)|const (?:audio|Audio|sound|Sound|sfx|SFX)/.test(s)){const n=/AudioContext/.test(s)?100:/localStorage/.test(s)?5:4;for(let j=Math.max(0,i-5);j<Math.min(lines.length,i+n);j++)selected.add(j);}});
const text=[...selected].sort((a,b)=>a-b).map(i=>(i+1)+': '+lines[i]).join('\n');
fs.writeFileSync(path.join(__dirname,'source-audit.txt'),text);console.log(text);
const r=JSON.parse(fs.readFileSync(path.join(__dirname,'regression/report.json')));console.log('FULL RUNS',JSON.stringify(r.checks.find(x=>x.name.startsWith('Two full'))));
const k=JSON.parse(fs.readFileSync(path.join(__dirname,'keyboard/report.json')));console.log('KEYBOARD SUMMARY',JSON.stringify({keys:Object.keys(k),result:k.result&&{day:k.result.day,ending:k.result.ending},inputs:k.inputs,pass:k.pass,errors:k.errors,network:k.network}));
const stray=path.resolve(__dirname,'../packet/tools/profile-evidence');if(fs.existsSync(stray)){console.log('EMPTY DEFAULT DIR',JSON.stringify({entries:fs.readdirSync(stray),birthtime:fs.statSync(stray).birthtime}));}
