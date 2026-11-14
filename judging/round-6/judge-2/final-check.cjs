const fs=require('fs'),path=require('path');
const p=path.resolve(__dirname,'../packet/tools/profile-evidence');
const cleanup={target:p,exists:fs.existsSync(p)};
if(cleanup.exists){const s=fs.statSync(p);cleanup.birthtime=s.birthtime;cleanup.entries=fs.readdirSync(p);if(s.birthtime.toISOString()==='2026-11-14T19:06:00.751Z'&&cleanup.entries.length===0){fs.rmdirSync(p);cleanup.removedOwnEmptyDefaultDirectory=true;}}
fs.writeFileSync(path.join(__dirname,'cleanup.json'),JSON.stringify(cleanup,null,2));console.log('CLEANUP',JSON.stringify(cleanup));
const src=fs.readFileSync(path.resolve(__dirname,'../packet/index.html'),'utf8').split(/\r?\n/);const i=src.findIndex(x=>/async function sailTo/.test(x));if(i>=0)console.log(src.slice(i,i+45).map((l,j)=>(i+j+1)+': '+l).join('\n'));
const k=JSON.parse(fs.readFileSync(path.join(__dirname,'keyboard/report.json')));console.log('KEY INPUTS',JSON.stringify({tabPresses:k.tabPresses,pointerEventCount:k.pointerEventCount,inputDocuments:k.inputDocuments}));
