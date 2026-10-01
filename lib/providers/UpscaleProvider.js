/**
 * UpscaleProvider — Abstract interface for AI video super-resolution backends.
 *
 * Concrete implementations could wrap Topaz, Real-ESRGAN, a custom ML service, etc.
 */
class UpscaleProvider {
  /**
   * Create an upscale processing job.
   * @param {string} sourceUrl — temporary URL of the source video
   * @param {string} targetResolution — e.g. '1080p', '1440p', '4k'
   * @returns {Promise<{ jobId: string }>}
   */
  async createJob(sourceUrl, targetResolution) {
    throw new Error('UpscaleProvider.createJob() not implemented');
  }

  /**
   * Poll the status of an upscale job.
   * @param {string} jobId
   * @returns {Promise<UpscaleJobStatus>}
   *
   * UpscaleJobStatus shape:
   * {
   *   status: 'queued' | 'preparing' | 'uploading' | 'upscaling' | 'encoding' | 'completed' | 'failed',
   *   stage: string,
   *   progress: number,             // 0–100
   *   downloadUrl: string | null,   // temporary URL when completed
   *   error: string | null
   * }
   */
  async getJobStatus(jobId) {
    throw new Error('UpscaleProvider.getJobStatus() not implemented');
  }
}

module.exports = UpscaleProvider;
