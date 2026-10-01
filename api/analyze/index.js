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
    let raw = (err.message || 'Failed to analyze media.').trim();
    let msg = raw;

    if (/private video/i.test(raw)) {
      msg = 'This video is private and cannot be downloaded.';
    } else if (/unavailable|does not exist|removed/i.test(raw)) {
      msg = 'This video is unavailable or was deleted.';
    } else if (/sign in to confirm/i.test(raw) || /bot/i.test(raw)) {
      msg = 'YouTube requires verification (bot check). Please try again in a few moments.';
    } else if (/empty media response/i.test(raw) || /not granting access/i.test(raw)) {
      msg = 'Instagram blocked unauthenticated access (login required).';
    } else if (/timed out/i.test(raw)) {
      msg = 'Analysis timed out. Please try again.';
    } else {
      const cleanLine = raw
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('ERROR:') || l.length > 0) || raw;
      msg = cleanLine.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/i, '').trim();
    }

    return sendJSON(res, 500, {
      success: false,
      error: msg,
      rawError: raw,
    });
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
