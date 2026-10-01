/**
 * MediaProvider — Abstract interface for media extraction backends.
 *
 * Any concrete provider (yt-dlp wrapper, RapidAPI service, custom backend, etc.)
 * must implement these methods. The Vercel API routes call only these methods,
 * so swapping the provider never touches the frontend or the routes.
 */
class MediaProvider {
  /**
   * Analyze a public URL and return metadata + available formats.
   * @param {string} url — YouTube or Instagram URL
   * @returns {Promise<AnalysisResult>}
   *
   * AnalysisResult shape:
   * {
   *   platform: 'youtube' | 'instagram',
   *   type: 'video' | 'short' | 'reel' | 'image' | 'carousel',
   *   title: string | null,
   *   thumbnail: string | null,
   *   duration: number | null,          // seconds
   *   originalResolution: string | null, // e.g. '1080p'
   *   formats: Format[]
   * }
   *
   * Format shape:
   * {
   *   id: string,
   *   quality: string,       // e.g. '1080p'
   *   width: number | null,
   *   height: number | null,
   *   fps: number | null,
   *   format: string,        // e.g. 'mp4'
   *   codec: string | null,
   *   hasAudio: boolean,
   *   fileSize: number | null // bytes
   * }
   */
  async analyze(url) {
    throw new Error('MediaProvider.analyze() not implemented');
  }

  /**
   * Create a download / processing job for a specific format.
   * @param {string} url
   * @param {string} formatId
   * @returns {Promise<{ jobId: string }>}
   */
  async createDownloadJob(url, formatId) {
    throw new Error('MediaProvider.createDownloadJob() not implemented');
  }

  /**
   * Poll the status of a download job.
   * @param {string} jobId
   * @returns {Promise<JobStatus>}
   *
   * JobStatus shape:
   * {
   *   status: 'queued' | 'processing' | 'completed' | 'failed',
   *   progress: number,            // 0–100
   *   downloadUrl: string | null,  // temporary URL when completed
   *   error: string | null
   * }
   */
  async getJobStatus(jobId) {
    throw new Error('MediaProvider.getJobStatus() not implemented');
  }
}

module.exports = MediaProvider;
