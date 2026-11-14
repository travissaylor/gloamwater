const fs=require('fs'),path=require('path');
for(const name of process.argv.slice(2)){const p=path.join(__dirname,name,'report.json');const r=JSON.parse(fs.readFileSync(p));console.log(name,JSON.stringify(r,(k,v)=>['focusWalks','focusLog','inputLog','observations','decisions','actions','turns','trace','navigation'].includes(k)?undefined:v,2).slice(0,14000));}
