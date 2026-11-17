import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
const [out,seed,sec,y0]=process.argv.slice(2);
const srv=spawn('node',['scripts/serve.mjs','dist','4599'],{stdio:'ignore'}); await new Promise(r=>setTimeout(r,1500));
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.addInitScript(()=>{ window.VINTEREST_TOUR='off'; });
await p.goto(`http://localhost:4599/team/?seed=${seed}&view=console`); await p.waitForSelector('[data-look="preview"]',{timeout:60000}); await p.waitForTimeout(600);
await p.click('[data-testid="c2-nav-tab"]'); await p.waitForTimeout(250); await p.click(`[data-testid="console-nav-${sec}"]`); await p.mouse.move(900,500); await p.waitForTimeout(700);
const ys=(y0||'0').split(','); for(const [i,y] of ys.entries()){ await p.evaluate(y=>{ document.querySelector('[data-testid="team-console"] [data-scroll]').scrollTop=+y; },y); await p.waitForTimeout(250); await p.screenshot({path:`${out}-${i}.png`}); }
console.log(errs); await b.close(); srv.kill();
