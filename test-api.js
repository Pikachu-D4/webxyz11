const http = require('http');

function testApi(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseBody));
        } catch {
          resolve(responseBody);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== Eomeg API Tests ===\n');

  // Test 1: Analyze YouTube URL
  console.log('1. POST /api/analyze (YouTube)');
  const yt = await testApi('POST', '/api/analyze', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  console.log('   Success:', yt.success);
  console.log('   Platform:', yt.platform);
  console.log('   Formats:', yt.formats ? yt.formats.length : 0);
  console.log('   Demo:', yt.demo);
  console.log('');

  // Test 2: Analyze Instagram URL
  console.log('2. POST /api/analyze (Instagram Reel)');
  const ig = await testApi('POST', '/api/analyze', { url: 'https://www.instagram.com/reel/ABC123/' });
  console.log('   Success:', ig.success);
  console.log('   Platform:', ig.platform);
  console.log('   Type:', ig.type);
  console.log('');

  // Test 3: Invalid URL
  console.log('3. POST /api/analyze (Invalid URL)');
  const bad = await testApi('POST', '/api/analyze', { url: 'https://twitter.com/test' });
  console.log('   Success:', bad.success);
  console.log('   Error:', bad.error);
  console.log('');

  // Test 4: Download job
  console.log('4. POST /api/download');
  const dl = await testApi('POST', '/api/download', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', formatId: 'yt-1080-av' });
  console.log('   Success:', dl.success);
  console.log('   JobId:', dl.jobId);
  console.log('');

  if (dl.jobId) {
    // Test 5: Job status
    console.log('5. GET /api/job (immediate poll)');
    const job1 = await testApi('GET', '/api/job?id=' + dl.jobId);
    console.log('   Status:', job1.status);
    console.log('   Progress:', job1.progress);
    console.log('');

    // Wait and poll again
    await new Promise((r) => setTimeout(r, 6000));
    console.log('6. GET /api/job (after 6s)');
    const job2 = await testApi('GET', '/api/job?id=' + dl.jobId);
    console.log('   Status:', job2.status);
    console.log('   Progress:', job2.progress);
    console.log('   Download URL:', job2.downloadUrl || 'N/A');
    console.log('');
  }

  // Test 7: Upscale job
  console.log('7. POST /api/upscale');
  const up = await testApi('POST', '/api/upscale', { sourceUrl: 'temp://test', targetResolution: '1080p' });
  console.log('   Success:', up.success);
  console.log('   JobId:', up.jobId);
  console.log('');

  // Test 8: Invalid upscale resolution
  console.log('8. POST /api/upscale (invalid resolution)');
  const badUp = await testApi('POST', '/api/upscale', { sourceUrl: 'temp://test', targetResolution: '8k' });
  console.log('   Success:', badUp.success);
  console.log('   Error:', badUp.error);
  console.log('');

  console.log('=== All tests completed ===');
}

runTests().catch(console.error);
