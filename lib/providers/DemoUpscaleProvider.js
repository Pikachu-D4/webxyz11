/**
 * DemoUpscaleProvider — Development / demonstration upscale provider.
 *
 * Simulates the async upscale job lifecycle with realistic stages
 * so the full UI flow can be tested without a real ML backend.
 */
const { v4: uuidv4 } = require('uuid');
const UpscaleProvider = require('./UpscaleProvider');

const jobs = new Map();

const STAGES = ['queued', 'preparing', 'uploading', 'upscaling', 'encoding', 'completed'];

class DemoUpscaleProvider extends UpscaleProvider {
  async createJob(sourceUrl, targetResolution) {
    const jobId = uuidv4();
    jobs.set(jobId, {
      id: jobId,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      downloadUrl: null,
      error: null,
      _startedAt: Date.now(),
      _totalDuration: 12000 + Math.random() * 6000, // 12–18 s
    });
    return { jobId };
  }

  async getJobStatus(jobId) {
    const job = jobs.get(jobId);
    if (!job) {
      return { status: 'failed', stage: 'failed', progress: 0, downloadUrl: null, error: 'Job not found' };
    }

    const elapsed = Date.now() - job._startedAt;
    const pct = Math.min(100, Math.round((elapsed / job._totalDuration) * 100));

    // Map pct to stages
    let stageIdx;
    if (pct < 5) stageIdx = 0;       // queued
    else if (pct < 15) stageIdx = 1;  // preparing
    else if (pct < 30) stageIdx = 2;  // uploading
    else if (pct < 80) stageIdx = 3;  // upscaling
    else if (pct < 95) stageIdx = 4;  // encoding
    else stageIdx = 5;                // completed

    job.stage = STAGES[stageIdx];
    job.status = stageIdx === 5 ? 'completed' : 'processing';
    job.progress = pct;

    if (stageIdx === 5) {
      job.downloadUrl = `https://demo.eomeg.app/upscaled/${jobId}.mp4`;
    }

    return {
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      downloadUrl: job.downloadUrl,
      error: job.error,
      _demo: true,
    };
  }
}

module.exports = DemoUpscaleProvider;
