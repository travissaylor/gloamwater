'use strict';
const fs=require('fs'),path=require('path');
const r=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../judge-2.json'),'utf8'));
const keys=['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5'];
const weights={A1:10,A2:9,A3:6,A4:6,A5:5,B1:7,B2:9,B3:8,B4:5,B5:7,C1:8,C2:5,C3:7,C4:5,C5:3};
const checks={fifteen_scores:Object.keys(r.scores).length===15,valid_scores:keys.every(k=>Number.isInteger(r.scores[k])&&r.scores[k]>=1&&r.scores[k]<=10),criteria_match:keys.every(k=>r.criteria[k].score===r.scores[k]),specific_evidence:keys.every(k=>r.criteria[k].evidence.length>100),limitations:keys.every(k=>r.scores[k]===10||r.criteria[k].below_10.length>0),screenshots_exist:r.evidence.screenshots.every(p=>fs.existsSync(p)),reports_exist:Object.values(r.evidence.reports).every(p=>fs.existsSync(p))};
const total=Math.round(keys.reduce((n,k)=>n+r.scores[k]*weights[k]/10,0)*10)/10;
checks.arithmetic=total===r.weighted_total;
const result={pass:Object.values(checks).every(Boolean),checks,weighted_total:total,judge:r.judge,model:r.model};
fs.writeFileSync(path.join(__dirname,'review-validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
if(!result.pass)process.exitCode=1;

