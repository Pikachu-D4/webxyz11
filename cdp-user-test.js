/**
 * CDP Browser Automation Test for User's YouTube URL
 */
const fs = require('fs');
const path = require('path');

const USER_URL = 'https://youtu.be/c65v3mPCOps?si=3TL-McYk8eYjkbYP';
const ARTIFACT_DIR = 'C:\\Users\\pikac\\.gemini\\antigravity-ide\\brain\\ef170f94-de4b-426f-b120-49c488cc91a8';

async function main() {
  console.log('1. Creating new tab in real Chrome pointing to http://localhost:3000...');
  const newTabRes = await fetch('http://localhost:9222/json/new?http://localhost:3000', { method: 'PUT' });
  const tab = await newTabRes.json();
  console.log('Opened tab:', tab.id, tab.webSocketDebuggerUrl);

  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject, method });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
      else resolve(data.result);
    } else if (data.method) {
      if (data.method.includes('download') || data.method.includes('Download')) {
        console.log(`[CDP Event] ${data.method}:`, data.params);
      }
    }
  };

  await new Promise((res) => (ws.onopen = res));
  console.log('Connected to Chrome DevTools Protocol!');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Browser.setDownloadBehavior', {
    behavior: 'allowAndName',
    downloadPath: 'C:\\Users\\pikac\\Downloads',
    eventsEnabled: true,
  });

  // Wait 2s for page to load
  await new Promise((r) => setTimeout(r, 2000));

  console.log(`2. Entering URL: ${USER_URL}...`);
  await send('Runtime.evaluate', {
    expression: `
      document.querySelector('#urlInput').value = ${JSON.stringify(USER_URL)};
      document.querySelector('#urlInput').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#analyzeBtn').click();
    `,
  });

  console.log('3. Waiting for analysis to complete...');
  let analyzed = false;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const check = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const card = document.querySelector('#resultCard');
          const isVisible = card && !card.classList.contains('hidden');
          const title = document.querySelector('#resultTitle')?.textContent;
          const formats = Array.from(document.querySelectorAll('.format-item')).map(el => ({
            quality: el.querySelector('.format-quality')?.textContent,
            chips: Array.from(el.querySelectorAll('.format-info-chip')).map(c => c.textContent),
            size: el.querySelector('.format-size')?.textContent,
          }));
          return { isVisible, title, formats };
        })()
      `,
      returnByValue: true,
    });

    if (check.result && check.result.value && check.result.value.isVisible && check.result.value.formats.length > 0) {
      console.log('Analysis Complete!');
      console.log('Video Title:', check.result.value.title);
      console.log('Available Formats:', JSON.stringify(check.result.value.formats, null, 2));
      analyzed = true;
      break;
    }
  }

  if (!analyzed) {
    console.error('Analysis timed out.');
    ws.close();
    process.exit(1);
  }

  // Capture screenshot of formats
  console.log('4. Capturing screenshot of analyzed video...');
  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  const ss1Path = path.join(ARTIFACT_DIR, 'analysis_c65v3mPCOps.png');
  fs.writeFileSync(ss1Path, Buffer.from(ss1.data, 'base64'));
  console.log('Saved screenshot to:', ss1Path);

  // Click on 1080p Ultra or standard 1080p
  console.log('5. Clicking Download on 1080p...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.format-item .download-btn');
        if (btn) btn.click();
      })()
    `,
  });

  console.log('6. Waiting for download processing (0 -> 100%)...');
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const status = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const readyCard = document.querySelector('#readyCard');
          const isReady = readyCard && !readyCard.classList.contains('hidden');
          const pct = document.querySelector('#progressBarFill')?.style?.width;
          const downloadBtnHref = document.querySelector('#finalDownloadBtn')?.href;
          return { isReady, pct, downloadBtnHref };
        })()
      `,
      returnByValue: true,
    });

    const val = status.result?.value;
    console.log(`Progress: ${val?.pct || '0%'}`);

    if (val?.isReady) {
      console.log('Ready Card Visible! Download URL:', val.downloadBtnHref);
      ready = true;
      break;
    }
  }

  if (!ready) {
    console.error('Download processing timed out.');
    ws.close();
    process.exit(1);
  }

  // Capture screenshot of Ready Card
  console.log('7. Capturing Ready state screenshot...');
  const ss2 = await send('Page.captureScreenshot', { format: 'png' });
  const ss2Path = path.join(ARTIFACT_DIR, 'ready_c65v3mPCOps.png');
  fs.writeFileSync(ss2Path, Buffer.from(ss2.data, 'base64'));
  console.log('Saved ready screenshot to:', ss2Path);

  // Click final download button
  console.log('8. Clicking Final Download Button in Chrome...');
  await send('Runtime.evaluate', {
    expression: `document.querySelector('#finalDownloadBtn').click()`,
  });

  console.log('9. Waiting 5s for Chrome download to finalize...');
  await new Promise((r) => setTimeout(r, 5000));

  console.log('Test completed successfully!');
  ws.close();
}

main().catch(console.error);
