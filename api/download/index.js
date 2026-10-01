/**
 * POST /api/download
 *
 * Creates a download / processing job for a specific format.
 */
const { parseBody, sendJSON, sendError, withMiddleware } = require('../../lib/apiHelpers');
const { validateUrl } = require('../../lib/validation');
const { getMediaProvider } = require('../../lib/providers');

module.exports = withMiddleware(async (req, res) => {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed.');
  }

  const body = await parseBody(req);
  const url = (body.url || '').trim();
  const formatId = (body.formatId || '').trim();

  if (!url || !formatId) {
    return sendError(res, 400, 'Both url and formatId are required.');
  }

  const { valid, error } = validateUrl(url);
  if (!valid) {
    return sendError(res, 400, error);
  }

  const title = (body.title || '').trim();

  const provider = getMediaProvider();
  const result = await provider.createDownloadJob(url, formatId, title);

  return sendJSON(res, 200, {
    success: true,
    jobId: result.jobId,
  });
});
