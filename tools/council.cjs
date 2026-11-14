// Freeze a judging packet and independently verify the panel's arithmetic.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const weights = {A1:10,A2:9,A3:6,A4:6,A5:5,B1:7,B2:9,B3:8,B4:5,B5:7,C1:8,C2:5,C3:7,C4:5,C5:3};
const [command, round] = process.argv.slice(2);
if (!/^\d+$/.test(round || '')) throw Error('Usage: node tools/council.cjs prepare|score ROUND');
const dir = path.join(root, 'judging', `round-${round}`);
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
if (command === 'prepare') {
  if (fs.existsSync(path.join(dir, 'BUILD.json'))) throw Error('This round is already frozen');
  const packet = path.join(dir, 'packet');
  fs.mkdirSync(packet, {recursive:true});
  for (const [source, destination] of [['game/index.html','index.html'],['BRIEF.md','BRIEF.md'],['RUBRIC.md','RUBRIC.md'],['NOTES.md','NOTES.md']]) {
    fs.copyFileSync(path.join(root, source), path.join(packet, destination));
  }
  const game = fs.readFileSync(path.join(packet, 'index.html'));
  const manifest = {sha256:hash(game),bytes:game.length,rubric_sha256:hash(fs.readFileSync(path.join(packet,'RUBRIC.md'))),models:[
    {judge:1,lens:'game design',model:'claude-opus-5-5',effort:'high'},
    {judge:2,lens:'visual and interaction',model:'gpt-6.1-sol',effort:'xhigh'},
    {judge:3,lens:'technical quality',model:'gpt-6-astra',effort:'high'}
  ]};
  fs.writeFileSync(path.join(dir,'BUILD.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify(manifest));
} else if (command === 'score') {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir,'BUILD.json')));
  if (hash(fs.readFileSync(path.join(dir,'packet/index.html'))) !== manifest.sha256) throw Error('Judged build changed');
  if (hash(fs.readFileSync(path.join(dir,'packet/RUBRIC.md'))) !== manifest.rubric_sha256) throw Error('Judged rubric changed');
  const totals = [1,2,3].map(judge => {
    const data = JSON.parse(fs.readFileSync(path.join(dir,`judge-${judge}.json`)));
    let total = 0;
    for (const [key,weight] of Object.entries(weights)) {
      const criterion = data.criteria?.[key];
      const score = criterion?.score ?? data.scores?.[key];
      if (!Number.isInteger(score) || score < 1 || score > 10) throw Error(`Judge ${judge}: invalid ${key}`);
      if (!criterion?.evidence || !criterion?.below_10) throw Error(`Judge ${judge}: missing ${key} evidence or limitations`);
      total += score*weight/10;
    }
    total = Math.round(total*10)/10;
    return {judge,model:manifest.models[judge-1].model,total,reported_total:data.weighted_total,arithmetic_match:Math.abs(total-data.weighted_total)<.001};
  });
  const result = {build:manifest.sha256,judges:totals,panel:Math.round(totals.reduce((sum,j)=>sum+j.total,0)/3*100)/100};
  fs.writeFileSync(path.join(dir,'scores.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} else throw Error('Unknown command');
