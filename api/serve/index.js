/**
 * GET /api/serve?id=<jobId>
 *
 * Serves the completed download file from the local downloads directory,
 * or handles demo file generation / redirect.
 */
const fs = require('fs');
const path = require('path');
const { sendError, withMiddleware } = require('../../lib/apiHelpers');
const { getMediaProvider } = require('../../lib/providers');

const MIME_MAP = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.opus': 'audio/opus',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

module.exports = withMiddleware(async (req, res) => {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed.');
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathnameSegments = url.pathname.split('/').filter(Boolean);
  let jobId = url.searchParams.get('id');
  let pathFilename = null;

  if (!jobId && pathnameSegments.length >= 3 && pathnameSegments[0] === 'api' && pathnameSegments[1] === 'serve') {
    jobId = pathnameSegments[2];
    pathFilename = pathnameSegments[3] ? decodeURIComponent(pathnameSegments[3]) : null;
  }

  if (!jobId) {
    return sendError(res, 400, 'Job ID is required.');
  }

  const provider = getMediaProvider();
  const status = await provider.getJobStatus(jobId);

  if (status.status !== 'completed') {
    return sendError(res, 400, 'Job is not ready for download yet.');
  }

  let resolvedFile = status.resolvedFile;
  const downloadsDir = path.resolve(__dirname, '../../downloads');
  if ((!resolvedFile || !fs.existsSync(resolvedFile)) && fs.existsSync(downloadsDir)) {
    const matches = fs.readdirSync(downloadsDir).filter((f) => f.startsWith(jobId));
    if (matches.length > 0) {
      resolvedFile = path.join(downloadsDir, matches[0]);
    }
  }

  // Force redirect query-based requests (/api/serve?id=...) to clean path ending with .mp4
  // This guarantees Chrome and Edge save the file with the proper extension!
  if (url.searchParams.has('id') && pathnameSegments.length < 4) {
    const ext = resolvedFile ? (path.extname(resolvedFile) || '.mp4') : '.mp4';
    const safeTitle = (status.title || 'video').replace(/[\\/:*?"<>|]/g, '').trim() || 'video';
    const redirectFilename = `${safeTitle}${ext}`;
    res.writeHead(302, {
      'Location': `/api/serve/${jobId}/${encodeURIComponent(redirectFilename)}`,
    });
    return res.end();
  }

  // 1. If there is a real downloaded file on disk, stream it
  if (resolvedFile && fs.existsSync(resolvedFile)) {
    try {
      const ext = path.extname(resolvedFile).toLowerCase() || '.mp4';
      const mime = MIME_MAP[ext] || 'video/mp4';
      const stat = fs.statSync(resolvedFile);

      const queryFile = pathFilename || url.searchParams.get('file') || url.searchParams.get('filename');
      let filename;
      if (queryFile) {
        filename = queryFile.replace(/[\\/:*?"<>|]/g, '').trim();
        if (!filename.toLowerCase().endsWith(ext)) {
          filename += ext;
        }
      } else {
        const safeTitle = (status.title || 'video').replace(/[\\/:*?"<>|]/g, '').trim() || 'video';
        filename = `${safeTitle}${ext}`;
      }

      const asciiFilename = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '') || `video${ext}`;

      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-cache',
      });

      const stream = fs.createReadStream(resolvedFile);
      stream.pipe(res);
      return;
    } catch (err) {
      console.error('[Serve Error]', err);
      return sendError(res, 500, 'Failed to stream media file.');
    }
  }

  // 2. Demo mode fallback sample file
  if (status._demo) {
    const filename = `eomeg-demo-${jobId.slice(0, 8)}.txt`;
    const content = [
      '═══════════════════════════════════════════════════════════',
      '  Eomeg Downloader — Demo Download',
      '═══════════════════════════════════════════════════════════',
      '',
      `  Job ID:    ${jobId}`,
      `  Status:    ${status.status}`,
      `  Date:      ${new Date().toISOString()}`,
      '',
      '  ⚠️  This is a demo file.',
      '',
      '═══════════════════════════════════════════════════════════',
    ].join('\n');

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': Buffer.byteLength(content, 'utf-8'),
    });
    return res.end(content);
  }

  // 3. External redirect if downloadUrl points to a remote CDN
  if (status.downloadUrl && status.downloadUrl.startsWith('http')) {
    res.writeHead(302, { Location: status.downloadUrl });
    return res.end();
  }

  return sendError(res, 404, 'Download file not found.');
});
