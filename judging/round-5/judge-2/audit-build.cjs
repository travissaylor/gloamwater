'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),packet=path.join(root,'packet'),build=JSON.parse(fs.readFileSync(path.join(root,'BUILD.json'),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const game=path.join(packet,'index.html');
const result={game:{expected:build.sha256,actual:hash(game),bytes:fs.statSync(game).size},rubric:{expected:build.rubric_sha256,actual:hash(path.join(packet,'RUBRIC.md'))},helpers:build.helper_files.map(h=>({file:h.file,expected:h.sha256,actual:hash(path.join(packet,'tools',h.file))}))};
result.pass=result.game.actual===result.game.expected&&result.game.bytes===build.bytes&&result.rubric.expected===result.rubric.actual&&result.helpers.every(h=>h.actual===h.expected);
fs.writeFileSync(path.join(__dirname,'build-integrity.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:result.pass,gameBytes:result.game.bytes,helpers:result.helpers.length}));
if(!result.pass)process.exitCode=1;

