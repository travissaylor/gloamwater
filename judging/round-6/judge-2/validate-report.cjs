const fs=require('fs'),path=require('path'),assert=require('assert');
const file=path.resolve(__dirname,'../judge-2.json'),raw=fs.readFileSync(file,'utf8'),r=JSON.parse(raw);
const w={A1:10,A2:9,A3:6,A4:6,A5:5,B1:7,B2:9,B3:8,B4:5,B5:7,C1:8,C2:5,C3:7,C4:5,C5:3};
assert.equal(r.judge,2);assert.equal(r.model,'gpt-6.1-sol');assert.equal(Object.keys(r.scores).length,15);assert.equal(Object.keys(r.criteria).length,15);
for(const k of Object.keys(w)){assert(Number.isInteger(r.scores[k])&&r.scores[k]>=1&&r.scores[k]<=10);assert.equal(r.criteria[k].score,r.scores[k]);assert(r.criteria[k].evidence.length);assert(r.scores[k]===10||r.criteria[k].below_10.length);}
const total=Number(Object.keys(w).reduce((n,k)=>n+w[k]*r.scores[k]/10,0).toFixed(1));assert.equal(total,r.weighted_total);assert(/"weighted_total":\s*84\.0[,\s]/.test(raw));
for(const f of ['hashes-before.json','hashes-after.json']){const h=JSON.parse(fs.readFileSync(path.join(__dirname,f)));assert(h.pass&&h.checks.length===48&&h.checks.every(c=>c.pass));}
for(const folder of ['regression','events','keyboard','profile'])assert(JSON.parse(fs.readFileSync(path.join(__dirname,folder,'report.json'))).pass);
const diagnostics=JSON.parse(fs.readFileSync(path.join(__dirname,'manual-diagnostics.json')));assert.equal(diagnostics.errors.length,0);assert.equal(diagnostics.network.length,0);
const result={pass:true,report:file,criteria:15,weightSum:Object.values(w).reduce((a,b)=>a+b,0),weighted_total:total,allHelperAndBuildHashesMatch:true,allRunnersPass:true,manualErrors:diagnostics.errors,manualNetwork:diagnostics.network};
fs.writeFileSync(path.join(__dirname,'report-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
