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
  let result;
  try {
    result = await provider.analyze(url);
  } catch (err) {
    console.error('[Analyze Error]', err);
    let msg = err.message || 'Failed to analyze media.';
    if (/private video/i.test(msg)) {
      msg = 'This video is private and cannot be downloaded.';
    } else if (/unavailable|does not exist|removed/i.test(msg)) {
      msg = 'This video is unavailable or was deleted.';
    } else if (/sign in to confirm/i.test(msg) || /bot/i.test(msg)) {
      msg = 'YouTube is temporarily requiring bot verification. Please try another link or wait a moment.';
    } else if (/timed out/i.test(msg)) {
      msg = 'Analysis timed out. Please try again.';
    } else if (msg.length > 120) {
      msg = 'Could not extract media info. Please verify the URL and try again.';
    }
    return sendError(res, 500, msg);
  }

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
