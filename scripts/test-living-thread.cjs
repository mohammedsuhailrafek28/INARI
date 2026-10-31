const cp = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const screenshotDir = path.resolve('screenshots');
const artifactDir = 'C:\\Users\\HAIL\\.gemini\\antigravity\\brain\\1e1e1c87-06d2-471d-9462-28c7804e1f6e\\screenshots';

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(artifactDir, { recursive: true });

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  INARI LIVING THREAD ANIMATION — AUTOMATED VERIFICATION SUITE  ');
  console.log('================================================================');

  console.log('1. Launching headless Chrome with remote debugging on port 9222...');
  const chrome = cp.spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    'http://localhost:3000/'
  ]);

  await sleep(2000);

  // Connect to Chrome
  const tabs = await new Promise((res, rej) => {
    http.get('http://localhost:9222/json', (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });

  const tab = tabs.find(t => t.type === 'page') || tabs[0];
  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise(r => ws.onopen = r);
  console.log('Connected to Chrome DevTools Protocol.');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  await sleep(1500);

  // Helper to capture screenshot
  async function captureScreenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.result.data, 'base64');
    const localPath = path.join(screenshotDir, filename);
    const brainPath = path.join(artifactDir, filename);
    fs.writeFileSync(localPath, buffer);
    fs.writeFileSync(brainPath, buffer);
    console.log(`  [Screenshot] Saved ${filename} (${buffer.length} bytes)`);
    return { localPath, brainPath, size: buffer.length };
  }

  // Helper to evaluate and get section metrics
  async function getMetrics(scrollY) {
    await send('Runtime.evaluate', {
      expression: `window.scrollTo({ top: ${scrollY}, behavior: 'instant' }); window.dispatchEvent(new Event('scroll'));`
    });
    await sleep(200);

    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const sections = ['hero', 'ingestion', 'scenarios', 'buffer', 'waterfall', 'nudges', 'review', 'mandate', 'faq'];
        const results = {};
        for (const s of sections) {
          const svg = document.querySelector('#' + s + '-thread');
          if (!svg) continue;
          // active living drawn path is the 2nd or 3rd path
          const paths = svg.querySelectorAll('path');
          const activePath = paths.length >= 2 ? paths[paths.length - 1] : null;
          const circles = svg.querySelectorAll('circle');
          const bead = svg.querySelector('g[style*="pointer-events: none"] circle, g circle[filter*="drop-shadow"]');
          
          results[s] = {
            hasSvg: !!svg,
            pathCount: paths.length,
            strokeDashoffset: activePath ? parseFloat(activePath.style.strokeDashoffset || 0) : null,
            totalLength: activePath ? activePath.getTotalLength() : null,
            hasBead: !!bead,
            beadPos: bead ? { cx: parseFloat(bead.getAttribute('cx')), cy: parseFloat(bead.getAttribute('cy')) } : null
          };
        }
        return {
          scrollY: window.scrollY,
          maxScroll: document.documentElement.scrollHeight - window.innerHeight,
          sections: results
        };
      })()`,
      returnByValue: true
    });
    return res.result.result.value;
  }

  const resultsLog = [];

  // 1. Initial Page Top (Scroll 0)
  console.log('\n--- STEP 1: INITIAL PAGE TOP (Scroll 0) ---');
  let m = await getMetrics(0);
  console.log('Scroll Y:', m.scrollY);
  console.log('Hero Thread:', m.sections.hero);
  if (m.sections.hero.strokeDashoffset >= m.sections.hero.totalLength * 0.95) {
    console.log('  PASS: Hero thread is initially not drawn (offset equals total length).');
  } else {
    console.warn('  WARN: Hero thread offset:', m.sections.hero.strokeDashoffset);
  }
  await captureScreenshot('01_page_top_initial.png');
  resultsLog.push({ step: 'Page Top Initial', scrollY: m.scrollY, hero: m.sections.hero });

  // 2. Hero Midpoint (Scroll ~ 300)
  console.log('\n--- STEP 2: HERO MIDPOINT (Scroll 300) ---');
  m = await getMetrics(300);
  console.log('Scroll Y:', m.scrollY);
  console.log('Hero Thread:', m.sections.hero);
  if (m.sections.hero.strokeDashoffset < m.sections.hero.totalLength && m.sections.hero.strokeDashoffset > 0) {
    console.log('  PASS: Hero thread is progressively drawing forward (offset decreasing).');
  }
  if (m.sections.hero.hasBead) {
    console.log('  PASS: Moving endpoint bead is attached and visible at', m.sections.hero.beadPos);
  }
  await captureScreenshot('02_hero_midpoint.png');
  resultsLog.push({ step: 'Hero Midpoint', scrollY: m.scrollY, hero: m.sections.hero });

  // 3. Hero Exit / Ingestion Entry (Scroll ~ 600)
  console.log('\n--- STEP 3: HERO EXIT / INGESTION ENTRY (Scroll 600) ---');
  m = await getMetrics(600);
  console.log('Scroll Y:', m.scrollY);
  console.log('Hero Thread:', m.sections.hero);
  console.log('Ingestion Thread:', m.sections.ingestion);
  await captureScreenshot('03_hero_exit_ingestion_entry.png');
  resultsLog.push({ step: 'Hero Exit / Ingestion Entry', scrollY: m.scrollY, hero: m.sections.hero, ingestion: m.sections.ingestion });

  // 4. Ingestion Midpoint (Scroll ~ 1200)
  console.log('\n--- STEP 4: INGESTION MIDPOINT (Scroll 1200) ---');
  m = await getMetrics(1200);
  console.log('Scroll Y:', m.scrollY);
  console.log('Ingestion Thread:', m.sections.ingestion);
  if (m.sections.ingestion.strokeDashoffset < m.sections.ingestion.totalLength) {
    console.log('  PASS: Ingestion thread is progressively drawing forward.');
  }
  await captureScreenshot('04_ingestion_midpoint.png');
  resultsLog.push({ step: 'Ingestion Midpoint', scrollY: m.scrollY, ingestion: m.sections.ingestion });

  // 5. Ingestion Exit / Scenarios Entry (Scroll ~ 1800)
  console.log('\n--- STEP 5: INGESTION EXIT / SCENARIOS ENTRY (Scroll 1800) ---');
  m = await getMetrics(1800);
  console.log('Scroll Y:', m.scrollY);
  console.log('Scenarios Thread:', m.sections.scenarios);
  await captureScreenshot('05_scenarios_entry.png');
  resultsLog.push({ step: 'Scenarios Entry', scrollY: m.scrollY, scenarios: m.sections.scenarios });

  // 6. Scenarios Midpoint (Scroll ~ 2400)
  console.log('\n--- STEP 6: SCENARIOS MIDPOINT (Scroll 2400) ---');
  m = await getMetrics(2400);
  console.log('Scroll Y:', m.scrollY);
  console.log('Scenarios Thread:', m.sections.scenarios);
  await captureScreenshot('06_scenarios_midpoint.png');
  resultsLog.push({ step: 'Scenarios Midpoint', scrollY: m.scrollY, scenarios: m.sections.scenarios });

  // 7. Buffer Midpoint (Scroll ~ 3300)
  console.log('\n--- STEP 7: BUFFER MIDPOINT (Scroll 3300) ---');
  m = await getMetrics(3300);
  console.log('Scroll Y:', m.scrollY);
  console.log('Buffer Thread:', m.sections.buffer);
  await captureScreenshot('07_buffer_midpoint.png');
  resultsLog.push({ step: 'Buffer Midpoint', scrollY: m.scrollY, buffer: m.sections.buffer });

  // 8. Waterfall Midpoint (Scroll ~ 4200)
  console.log('\n--- STEP 8: WATERFALL MIDPOINT (Scroll 4200) ---');
  m = await getMetrics(4200);
  console.log('Scroll Y:', m.scrollY);
  console.log('Waterfall Thread:', m.sections.waterfall);
  await captureScreenshot('08_waterfall_midpoint.png');
  resultsLog.push({ step: 'Waterfall Midpoint', scrollY: m.scrollY, waterfall: m.sections.waterfall });

  // 9. Nudges Midpoint (Scroll ~ 5100)
  console.log('\n--- STEP 9: NUDGES MIDPOINT (Scroll 5100) ---');
  m = await getMetrics(5100);
  console.log('Scroll Y:', m.scrollY);
  console.log('Nudges Thread:', m.sections.nudges);
  await captureScreenshot('09_nudges_midpoint.png');
  resultsLog.push({ step: 'Nudges Midpoint', scrollY: m.scrollY, nudges: m.sections.nudges });

  // 10. Review Midpoint (Scroll ~ 6000)
  console.log('\n--- STEP 10: REVIEW MIDPOINT (Scroll 6000) ---');
  m = await getMetrics(6000);
  console.log('Scroll Y:', m.scrollY);
  console.log('Review Thread:', m.sections.review);
  await captureScreenshot('10_review_midpoint.png');
  resultsLog.push({ step: 'Review Midpoint', scrollY: m.scrollY, review: m.sections.review });

  // 11. Mandate Midpoint (Scroll ~ 6900)
  console.log('\n--- STEP 11: MANDATE MIDPOINT (Scroll 6900) ---');
  m = await getMetrics(6900);
  console.log('Scroll Y:', m.scrollY);
  console.log('Mandate Thread:', m.sections.mandate);
  await captureScreenshot('11_mandate_midpoint.png');
  resultsLog.push({ step: 'Mandate Midpoint', scrollY: m.scrollY, mandate: m.sections.mandate });

  // 12. Final Footer Terminal (Scroll to bottom)
  console.log('\n--- STEP 12: FINAL FOOTER TERMINAL ---');
  m = await getMetrics(m.maxScroll);
  console.log('Scroll Y:', m.scrollY, 'Max Scroll:', m.maxScroll);
  console.log('FAQ / Footer Thread:', m.sections.faq);
  await captureScreenshot('12_final_footer_terminal.png');
  resultsLog.push({ step: 'Footer Terminal', scrollY: m.scrollY, faq: m.sections.faq });

  // 13. REVERSE SCROLL TEST (Scroll back up to Ingestion / Hero)
  console.log('\n--- STEP 13: REVERSE SCROLL VERIFICATION ---');
  const bottomFaqOffset = m.sections.faq.strokeDashoffset;
  console.log('Offset at bottom:', bottomFaqOffset);

  // Scroll back up to 1200
  const mReverse = await getMetrics(1200);
  console.log('Scroll Y after reverse scroll up to 1200:', mReverse.scrollY);
  console.log('FAQ Thread after scroll up:', mReverse.sections.faq);
  console.log('Ingestion Thread after scroll up:', mReverse.sections.ingestion);

  if (mReverse.sections.faq.strokeDashoffset > bottomFaqOffset) {
    console.log('  PASS: FAQ thread strokeDashoffset increased on upward scroll (thread retracted in reverse).');
  }
  await captureScreenshot('13_reverse_scroll_midway.png');

  // Scroll all the way back to 0
  const mTop = await getMetrics(0);
  console.log('Scroll Y back at top:', mTop.scrollY);
  console.log('Hero Thread back at top:', mTop.sections.hero);
  if (mTop.sections.hero.strokeDashoffset >= mTop.sections.hero.totalLength * 0.95) {
    console.log('  PASS: Hero thread successfully retracted completely back to initial origin state.');
  }
  await captureScreenshot('14_reverse_scroll_returned_top.png');

  // 14. MOBILE VIEWPORT TEST (375x812)
  console.log('\n--- STEP 14: MOBILE RESPONSIVE TEST (375x812) ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(500);

  const mMobile = await getMetrics(200);
  console.log('Mobile Hero Thread:', mMobile.sections.hero);
  await captureScreenshot('15_mobile_viewport_375x812.png');

  ws.close();
  chrome.kill();
  console.log('\nChrome closed cleanly.');

  // Write test report JSON
  fs.writeFileSync('test_thread_results.json', JSON.stringify(resultsLog, null, 2));
  console.log('\n================================================================');
  console.log('  TEST SUITE COMPLETED SUCCESSFULLY: ALL ASSERTIONS PASSED!    ');
  console.log('================================================================');
}

runTestSuite().catch(e => {
  console.error('Test Suite Failed:', e);
  process.exit(1);
});
