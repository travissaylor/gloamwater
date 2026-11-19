const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const ref = process.argv[2] || 'e673dcd';
  const root = path.resolve(__dirname, '..');
  const raw = execFileSync('git', ['show', `${ref}:game/index.html`], { cwd: root });
  const html = raw.toString('utf8').replace(/\r?\n/g, '\r\n');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gloamwater-quote-drift-'));
  const game = path.join(dir, 'index.html');
  let browser;
  try {
    fs.writeFileSync(game, html);
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(pathToFileURL(game).href);
    const result = await page.evaluate(() => {
      const cells = DISTRICTS.flatMap(d => GOODS.map(g => ({ did: d.id, gid: g.id })));
      const values = [[], [], [], []], misses = [0, 0, 0, 0];
      for (let seed = 1; seed <= 100; seed++) {
        const random = Math.random;
        Math.random = () => (Math.imul(seed, 2654435761) >>> 0) / 4294967296;
        newState('Drift sample');
        Math.random = random;
        const samples = [];
        for (let day = 1; day <= NIGHTS; day++) {
          samples.push(cells.map(({did, gid}) => ({
            price: postedAt(did, gid),
            live: S.stock[did][gid],
            fleet: fleetMult(did, gid),
            surge: effectMult(did, gid)>1.05
          })));
          if (day < NIGHTS) advanceDay();
        }
        for (let start = 0; start < samples.length - 1; start++) {
          for (let span = 1; span <= 4 && start + span < samples.length; span++) {
            samples[start].forEach((given, i) => {
              const got = samples[start + span][i];
              if (!given.live || given.surge || given.fleet > got.fleet) return;
              if (!got.live) { misses[span-1]++; return; }
              values[span-1].push(got.price/(given.price*got.fleet/given.fleet));
            });
          }
        }
      }
      return values.map((ratios, i) => {
        ratios.sort((a, b) => a - b);
        const percentile = p => +(ratios[Math.floor(ratios.length*p)]-1).toFixed(3);
        return { span:i+1, buyerPresent:ratios.length, buyerMissing:misses[i],
          p05:percentile(.05), p10:percentile(.10), p20:percentile(.20), p50:percentile(.50) };
      });
    });
    const gameSha = createHash('sha256').update(html).digest('hex');
    console.log(JSON.stringify({ ref, gameSha, seeds: '1–100', result }, null, 2));
  } finally {
    await browser?.close();
    if (fs.existsSync(game)) fs.unlinkSync(game);
    fs.rmdirSync(dir);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
