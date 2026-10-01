/**
 * GET /api/job?id=<jobId>
 *
 * Returns the current status of a download job.
 */
const { sendJSON, sendError, withMiddleware } = require('../../lib/apiHelpers');
const { getMediaProvider } = require('../../lib/providers');

module.exports = withMiddleware(async (req, res) => {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed.');
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const jobId = url.searchParams.get('id');

  if (!jobId) {
    return sendError(res, 400, 'Job ID is required.');
  }

  const provider = getMediaProvider();
  const status = await provider.getJobStatus(jobId);

  return sendJSON(res, 200, {
    success: true,
    ...status,
  });
});
