const fs=require('fs'),path=require('path'),crypto=require('crypto');
const round=path.dirname(__dirname),packet=path.join(round,'packet'),b=JSON.parse(fs.readFileSync(path.join(round,'BUILD.json')));
const entries=[{file:'index.html',sha256:b.sha256},{file:'RUBRIC.md',sha256:b.rubric_sha256},...b.helper_files.map(x=>({...x,file:'tools/'+x.file}))];
const checks=entries.map(x=>{const data=fs.readFileSync(path.join(packet,x.file)),actual=crypto.createHash('sha256').update(data).digest('hex');return {...x,actual,bytes:data.length,pass:actual===x.sha256};});
const report={at:new Date().toISOString(),pass:checks.every(x=>x.pass)&&checks[0].bytes===b.bytes,checks};
fs.writeFileSync(path.join(__dirname,process.argv[2]),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,count:checks.length,game:checks[0]}));if(!report.pass)process.exitCode=1;
