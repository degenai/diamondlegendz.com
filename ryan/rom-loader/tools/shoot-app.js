'use strict';
// Electron side of `npm run screenshots` (start it through tools/screenshots.js, which makes the fake drive).
// The install shown is a real copy, slowed with ROM_LOADER_COPY_DELAY_MS so the bar can be caught mid-way.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const fx = JSON.parse(process.env.ROM_LOADER_FIXTURE); // made by tools/screenshots.js
app.setPath('userData', fx.data);
process.env.ROM_LOADER_COPY_DELAY_MS = '12';
const { ready } = require('../main');

const outDir = path.join(__dirname, '..', 'docs');
const wait = ms => new Promise(r => setTimeout(r, ms));

async function until(win, expr, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await win.webContents.executeJavaScript(expr)) return;
    await wait(100);
  }
  throw new Error('timed out waiting for: ' + expr);
}

async function capture(win) {
  for (let i = 0; ; i++) { // capturePage can fail once while the compositor settles; try a few times
    try { return await win.webContents.capturePage(); } catch (err) { if (i >= 4) throw err; await wait(300); }
  }
}

async function shoot(win, name) {
  const img = await capture(win);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, name), img.toPNG());
  console.log('wrote', path.join(outDir, name), img.getSize());
}

ready.then(async win => {
  try {
    await until(win, "document.querySelectorAll('.tile').length >= 12 && !document.getElementById('btn-rescan').disabled");
    await wait(600);
    await shoot(win, 'screenshot-library.png');
    await win.webContents.executeJavaScript(`
      [...document.querySelectorAll('.tile')].find(t => t.textContent.includes('Kingdom Hearts II')).click();
      document.getElementById('act-install').click();`);
    await until(win, "parseFloat(document.getElementById('progress-fill').style.width) > 35");
    await wait(150);
    await shoot(win, 'screenshot-panel.png');
    console.log('progress text:', await win.webContents.executeJavaScript("document.getElementById('progress-text').textContent"));
    // Let the copy finish so the temp folder has no open files, and check the app saw it through.
    await until(win, "!document.getElementById('act-uninstall').hidden && document.getElementById('progress').hidden", 60000);
    console.log('install finished; panel says:', await win.webContents.executeJavaScript("document.getElementById('panel-state').textContent"));
    app.exit(0);
  } catch (err) {
    console.error(err);
    app.exit(1);
  }
});

