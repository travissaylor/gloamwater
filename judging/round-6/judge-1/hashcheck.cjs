const fs=require('fs'),crypto=require('crypto'),path=require('path');
const R='C:/Users/travi/.t3/worktrees/gloamwater/t3-201b6bf7-54dc20bc5d519c6e/judging/round-6';
const P=R+'/packet';const B=JSON.parse(fs.readFileSync(R+'/BUILD.json','utf8'));
const h=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
let fail=0;const out=[];
const g=h(P+'/index.html'),sz=fs.statSync(P+'/index.html').size;
out.push(`game ${g===B.sha256&&sz===B.bytes?'OK':'MISMATCH'} ${g} ${sz}`);if(g!==B.sha256||sz!==B.bytes)fail=1;
const r=h(P+'/RUBRIC.md');out.push(`rubric ${r===B.rubric_sha256?'OK':'MISMATCH'} ${r}`);if(r!==B.rubric_sha256)fail=1;
let ok=0;for(const f of B.helper_files){const a=h(P+'/tools/'+f.file);if(a===f.sha256)ok++;else{fail=1;out.push('helper MISMATCH '+f.file+' '+a);}}
out.push(`helpers OK ${ok}/${B.helper_files.length}`);
// aggregate guess: sha256 of "file sha\n" lines
const agg1=crypto.createHash('sha256').update(B.helper_files.map(f=>`${f.sha256}  ${f.file}\n`).join('')).digest('hex');
const agg2=crypto.createHash('sha256').update(B.helper_files.map(f=>`${f.file} ${f.sha256}\n`).join('')).digest('hex');
const agg3=crypto.createHash('sha256').update(JSON.stringify(B.helper_files)).digest('hex');
out.push('helper_sha256 aggregate '+([agg1,agg2,agg3].includes(B.helper_sha256)?'reproduced':'method unknown (per-file hashes all checked)'));
out.push('fail='+fail+' at '+new Date().toISOString());
console.log(out.join('\n'));
