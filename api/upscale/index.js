/**
 * POST /api/upscale         — Create an upscale job
 * GET  /api/upscale?id=xxx  — Poll upscale job status
 */
const { parseBody, sendJSON, sendError, withMiddleware } = require('../../lib/apiHelpers');
const { getUpscaleProvider } = require('../../lib/providers');

const VALID_RESOLUTIONS = ['1080p', '1440p', '4k', '2160p'];

module.exports = withMiddleware(async (req, res) => {
  const provider = getUpscaleProvider();

  // ── POST — create job ─────────────────────────────────────
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const sourceUrl = (body.sourceUrl || '').trim();
    const targetResolution = (body.targetResolution || '').trim().toLowerCase();

    if (!sourceUrl) {
      return sendError(res, 400, 'sourceUrl is required.');
    }
    if (!VALID_RESOLUTIONS.includes(targetResolution)) {
      return sendError(res, 400, `Invalid target resolution. Allowed: ${VALID_RESOLUTIONS.join(', ')}`);
    }

    const title = (body.title || '').trim();
    const result = await provider.createJob(sourceUrl, targetResolution, title);
    return sendJSON(res, 200, { success: true, jobId: result.jobId });
  }

  // ── GET — poll status ─────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const jobId = url.searchParams.get('id');

    if (!jobId) {
      return sendError(res, 400, 'Job ID is required.');
    }

    const status = await provider.getJobStatus(jobId);
    return sendJSON(res, 200, { success: true, ...status });
  }

  return sendError(res, 405, 'Method not allowed.');
});
