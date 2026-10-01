/**
 * POST /api/analyze
 *
 * Accepts a public YouTube or Instagram URL, validates it,
 * and returns metadata + available formats via the configured MediaProvider.
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

  // Validate
  const { valid, error } = validateUrl(url);
  if (!valid) {
    return sendError(res, 400, error);
  }

  // Analyze via provider
  const provider = getMediaProvider();
  const result = await provider.analyze(url);

  if (!result) {
    return sendError(res, 422, 'This type of media is not currently supported.');
  }

  // Flag demo mode so the frontend can show a notice
  const isDemo = !result._real && !process.env.MEDIA_API_URL;

  return sendJSON(res, 200, {
    success: true,
    demo: isDemo,
    ...result,
  });
});
