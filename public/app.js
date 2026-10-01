/* ═══════════════════════════════════════════════════════════════
   Eomeg Downloader — Client Application
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── DOM References ──────────────────────────────────────── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    urlInput:        $('#urlInput'),
    clearBtn:        $('#clearBtn'),
    analyzeBtn:      $('#analyzeBtn'),
    analyzeBtnText:  $('#analyzeBtnText'),
    errorMessage:    $('#errorMessage'),
    errorText:       $('#errorText'),
    demoNotice:      $('#demoNotice'),
    resultSection:   $('#resultSection'),
    skeletonCard:    $('#skeletonCard'),
    resultCard:      $('#resultCard'),
    resultThumbnail: $('#resultThumbnail'),
    platformBadge:   $('#platformBadge'),
    durationBadge:   $('#durationBadge'),
    resultMeta:      $('#resultMeta'),
    resultTitle:     $('#resultTitle'),
    formatFilters:   $('#formatFilters'),
    formatsList:     $('#formatsList'),
    upscaleSection:  $('#upscaleSection'),
    upscaleSource:   $('#upscaleSource'),
    upscaleTargets:  $('#upscaleTargets'),
    startUpscaleBtn: $('#startUpscaleBtn'),
    upscaleBtnText:  $('#upscaleBtnText'),
    processingCard:  $('#processingCard'),
    processingTitle: $('#processingTitle'),
    processingStages:$('#processingStages'),
    progressBarFill: $('#progressBarFill'),
    readyCard:       $('#readyCard'),
    finalDownloadBtn:$('#finalDownloadBtn'),
    finalDownloadLabel: $('#finalDownloadLabel'),
    anotherQualityBtn: $('#anotherQualityBtn'),
    themeToggle:     $('#themeToggle'),
    themeIcon:       $('#themeIcon'),
    historyToggle:   $('#historyToggle'),
    historyBadge:    $('#historyBadge'),
    historyPanel:    $('#historyPanel'),
    historyBackdrop: $('#historyBackdrop'),
    historyCloseBtn: $('#historyCloseBtn'),
    historyClearBtn:  $('#historyClearBtn'),
    historyList:     $('#historyList'),
  };

  /* ── State ───────────────────────────────────────────────── */
  let currentState = 'empty'; // empty | loading | result | processing | ready | error
  let analysisData = null;
  let currentFilter = 'all';
  let currentSort = 'desc'; // resolution descending
  let selectedUpscaleTarget = null;
  let pollingTimer = null;

  /* ═══════════════════════════════════════════════════════════
     THEME
     ═══════════════════════════════════════════════════════════ */

  function initTheme() {
    const saved = localStorage.getItem('eomeg-theme');
    const theme = saved || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('eomeg-theme', next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    els.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  /* ═══════════════════════════════════════════════════════════
     URL INPUT
     ═══════════════════════════════════════════════════════════ */

  function onUrlInput() {
    const val = els.urlInput.value.trim();
    els.clearBtn.classList.toggle('visible', val.length > 0);
  }

  function clearUrl() {
    els.urlInput.value = '';
    els.clearBtn.classList.remove('visible');
    hideError();
    els.urlInput.focus();
  }

  function onUrlKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      analyzeUrl();
    }
  }

  /* ═══════════════════════════════════════════════════════════
     VALIDATION (client-side — also validated server-side)
     ═══════════════════════════════════════════════════════════ */

  const YT_REGEX = /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)/i;
  const IG_REGEX = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\//i;

  function isValidUrl(url) {
    return YT_REGEX.test(url) || IG_REGEX.test(url);
  }

  /* ═══════════════════════════════════════════════════════════
     API CALLS
     ═══════════════════════════════════════════════════════════ */

  async function apiPost(endpoint, body) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function apiGet(endpoint) {
    const res = await fetch(endpoint);
    return res.json();
  }

  /* ═══════════════════════════════════════════════════════════
     ANALYZE
     ═══════════════════════════════════════════════════════════ */

  async function analyzeUrl() {
    const url = els.urlInput.value.trim();

    if (!url) {
      showError('Please enter a URL.');
      return;
    }

    if (!isValidUrl(url)) {
      showError('Please enter a valid YouTube or Instagram URL.');
      return;
    }

    hideError();
    setState('loading');

    try {
      const data = await apiPost('/api/analyze', { url });

      if (!data.success) {
        showError(data.error || 'Analysis failed. Please try again.');
        setState('empty');
        return;
      }

      analysisData = data;
      renderResult(data);
      setState('result');

      if (data.demo) {
        els.demoNotice.classList.remove('hidden');
      } else {
        els.demoNotice.classList.add('hidden');
      }
    } catch (err) {
      console.error('Analyze error:', err);
      showError('The processing service is temporarily unavailable. Please try again later.');
      setState('empty');
    }
  }

  /* ═══════════════════════════════════════════════════════════
     STATE MANAGEMENT
     ═══════════════════════════════════════════════════════════ */

  function setState(state) {
    currentState = state;

    // Button states
    const loading = state === 'loading';
    els.analyzeBtn.disabled = loading;
    els.analyzeBtnText.textContent = loading ? '' : 'Analyze';
    if (loading) {
      els.analyzeBtnText.insertAdjacentHTML('afterend', '<span class="spinner" id="analyzeSpinner"></span>');
    } else {
      const spinner = $('#analyzeSpinner');
      if (spinner) spinner.remove();
    }

    // Section visibility
    els.resultSection.classList.toggle('hidden', state === 'empty');
    els.skeletonCard.classList.toggle('hidden', state !== 'loading');
    els.resultCard.classList.toggle('hidden', state !== 'result');
    els.processingCard.classList.toggle('hidden', state !== 'processing');
    els.readyCard.classList.toggle('hidden', state !== 'ready');
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER RESULT
     ═══════════════════════════════════════════════════════════ */

  function renderResult(data) {
    // Thumbnail
    if (data.thumbnail) {
      els.resultThumbnail.src = data.thumbnail;
      els.resultThumbnail.alt = data.title || 'Media thumbnail';
    }

    // Platform badge
    els.platformBadge.textContent = data.platform || '';

    // Duration
    if (data.duration) {
      els.durationBadge.textContent = formatDuration(data.duration);
      els.durationBadge.classList.remove('hidden');
    } else {
      els.durationBadge.classList.add('hidden');
    }

    // Meta tags
    const metaTags = [];
    if (data.type) metaTags.push(data.type);
    if (data.originalResolution) metaTags.push(data.originalResolution);
    els.resultMeta.innerHTML = metaTags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');

    // Title
    els.resultTitle.textContent = data.title || 'Untitled media';

    // Format filters
    renderFormatFilters(data.formats);

    // Formats list
    renderFormats(data.formats);

    // Upscale section
    renderUpscaleSection(data);
  }

  /* ── Format Filters ─────────────────────────────────────── */

  function renderFormatFilters(formats) {
    const types = new Set(['all']);
    formats.forEach((f) => {
      if (f.hasAudio && f.width) types.add('video+audio');
      else if (f.width && !f.hasAudio) types.add('video only');
      else if (!f.width && f.hasAudio) types.add('audio only');
    });

    els.formatFilters.innerHTML = '';
    types.forEach((type) => {
      const btn = document.createElement('button');
      btn.className = `filter-btn${type === currentFilter ? ' active' : ''}`;
      btn.textContent = type === 'all' ? 'All' : capitalize(type);
      btn.addEventListener('click', () => {
        currentFilter = type;
        $$('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderFormats(analysisData.formats);
      });
      els.formatFilters.appendChild(btn);
    });
  }

  /* ── Format Items ───────────────────────────────────────── */

  function renderFormats(formats) {
    let filtered = formats;

    if (currentFilter === 'video+audio') {
      filtered = formats.filter((f) => f.hasAudio && f.width);
    } else if (currentFilter === 'video only') {
      filtered = formats.filter((f) => f.width && !f.hasAudio);
    } else if (currentFilter === 'audio only') {
      filtered = formats.filter((f) => !f.width && f.hasAudio);
    }

    // Sort by resolution (height) descending
    filtered.sort((a, b) => (b.height || 0) - (a.height || 0));

    els.formatsList.innerHTML = '';

    if (filtered.length === 0) {
      els.formatsList.innerHTML = '<p style="text-align:center;color:var(--text-tertiary);padding:1rem;">No formats match this filter.</p>';
      return;
    }

    filtered.forEach((format) => {
      const item = document.createElement('div');
      item.className = 'format-item';
      item.setAttribute('role', 'listitem');

      const audioClass = !format.width ? 'audio-only' : format.hasAudio ? 'audio-yes' : 'audio-no';
      const audioLabel = !format.width ? '🎵 Audio only' : format.hasAudio ? '🔊 Audio' : '🔇 Video only';

      const isUltra = format.id && format.id.startsWith('crf18_');
      if (isUltra) {
        item.style.border = '1px solid rgba(245, 158, 11, 0.4)';
        item.style.background = 'rgba(245, 158, 11, 0.04)';
      }

      item.innerHTML = `
        <div class="format-details">
          ${isUltra ? '<span class="format-info-chip" style="background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;font-weight:700;">⭐ BEST QUALITY (AUTO ENHANCED)</span>' : ''}
          <span class="format-quality">${escapeHtml(format.quality)}</span>
          ${format.fps ? `<span class="format-info-chip">${format.fps} FPS</span>` : ''}
          ${format.codec ? `<span class="format-info-chip">${escapeHtml(format.codec.toUpperCase())}</span>` : ''}
          <span class="format-info-chip ${audioClass}">${audioLabel}</span>
          <span class="format-info-chip">${escapeHtml((format.format || '').toUpperCase())}</span>
          ${format.fileSize ? `<span class="format-size">${formatFileSize(format.fileSize)}</span>` : ''}
        </div>
        <button class="download-btn" data-format-id="${escapeHtml(format.id)}" aria-label="Download ${escapeHtml(format.quality)} ${escapeHtml(format.format || '')}" ${isUltra ? 'style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-weight:700;"' : ''}>
          ${isUltra ? '⚡ 1-Click Best' : '⬇️ Download'}
        </button>
      `;

      const btn = item.querySelector('.download-btn');
      btn.addEventListener('click', () => startDownload(format));

      els.formatsList.appendChild(item);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     UPSCALE SECTION
     ═══════════════════════════════════════════════════════════ */

  function renderUpscaleSection(data) {
    // Only show upscale for video content
    const hasVideo = data.formats.some((f) => f.width && f.height);
    if (!hasVideo) {
      els.upscaleSection.classList.add('hidden');
      return;
    }

    els.upscaleSection.classList.remove('hidden');
    selectedUpscaleTarget = null;
    els.startUpscaleBtn.disabled = true;
    els.upscaleBtnText.textContent = 'Select a target resolution';

    // Determine max source resolution
    const maxHeight = Math.max(...data.formats.filter((f) => f.height).map((f) => f.height));
    const sourceLabel = heightToLabel(maxHeight);

    els.upscaleSource.innerHTML = `Source: <strong>${sourceLabel}</strong>`;

    // Determine available targets
    const TARGETS = [
      { label: '1080p', height: 1080 },
      { label: '1440p', height: 1440 },
      { label: '4K', height: 2160 },
    ];

    const available = TARGETS.filter((t) => t.height > maxHeight);

    els.upscaleTargets.innerHTML = '';
    if (available.length === 0) {
      els.upscaleSection.classList.add('hidden');
      return;
    }

    available.forEach((target) => {
      const btn = document.createElement('button');
      btn.className = 'upscale-target-btn';
      btn.textContent = target.label;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.addEventListener('click', () => {
        selectedUpscaleTarget = target.label.toLowerCase();
        $$('.upscale-target-btn').forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        els.startUpscaleBtn.disabled = false;
        els.upscaleBtnText.textContent = `Upscale to ${target.label}`;
      });
      els.upscaleTargets.appendChild(btn);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     DOWNLOAD FLOW
     ═══════════════════════════════════════════════════════════ */

  async function startDownload(format) {
    if (!analysisData) return;

    const url = els.urlInput.value.trim();
    setState('processing');

    els.processingTitle.textContent = 'Processing your download…';
    renderProcessingStages([
      { label: 'Preparing', status: 'active' },
      { label: 'Downloading', status: 'pending' },
      { label: 'Processing', status: 'pending' },
      { label: 'Finalizing', status: 'pending' },
    ]);
    els.progressBarFill.style.width = '0%';

    try {
      const result = await apiPost('/api/download', {
        url,
        formatId: format.id,
        title: analysisData.title || '',
      });

      if (!result.success) {
        showError(result.error || 'Download failed.');
        setState('result');
        return;
      }

      pollDownloadJob(result.jobId, format);
    } catch (err) {
      console.error('Download error:', err);
      showError("We couldn't process this media. Please try again.");
      setState('result');
    }
  }

  function pollDownloadJob(jobId, format) {
    clearInterval(pollingTimer);

    pollingTimer = setInterval(async () => {
      try {
        const status = await apiGet(`/api/job?id=${encodeURIComponent(jobId)}`);
        const progress = status.progress || 0;

        els.progressBarFill.style.width = `${progress}%`;
        updateDownloadStages(progress);

        if (status.status === 'completed') {
          clearInterval(pollingTimer);
          pollingTimer = null;
          showDownloadReady(status.downloadUrl, format);
        } else if (status.status === 'failed') {
          clearInterval(pollingTimer);
          pollingTimer = null;
          showError(status.error || "We couldn't process this media. Please try again.");
          setState('result');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 800);
  }

  function updateDownloadStages(progress) {
    const stages = [
      { label: 'Preparing', threshold: 10 },
      { label: 'Downloading', threshold: 40 },
      { label: 'Processing', threshold: 75 },
      { label: 'Finalizing', threshold: 100 },
    ];

    const mapped = stages.map((s, i) => {
      const prevThreshold = i === 0 ? 0 : stages[i - 1].threshold;
      let status = 'pending';
      if (progress >= s.threshold) status = 'completed';
      else if (progress >= prevThreshold) status = 'active';
      return { ...s, status };
    });

    renderProcessingStages(mapped);
  }

  function renderProcessingStages(stages) {
    els.processingStages.innerHTML = stages.map((s) => `
      <div class="stage-item ${s.status}">
        <div class="stage-icon">
          ${s.status === 'completed' ? '✓' : s.status === 'active' ? '•' : '○'}
        </div>
        <span class="stage-label">${escapeHtml(s.label)}</span>
        ${s.status === 'completed' ? '<span class="stage-pct">✓</span>' : ''}
      </div>
    `).join('');
  }

  function showDownloadReady(downloadUrl, format) {
    setState('ready');

    const ext = (format && format.format ? format.format : 'mp4').toLowerCase().replace(/^\./, '');
    const rawTitle = (analysisData && analysisData.title) ? analysisData.title : 'video';
    const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '').trim() || 'video';
    const qualTag = (format && format.quality && /4k|1440|2k|crf/i.test(format.quality))
      ? ` [${format.quality.toUpperCase()}]`
      : '';
    const fileName = `${cleanTitle}${qualTag}.${ext}`;

    const finalUrl = downloadUrl.includes('?') 
      ? `${downloadUrl}&file=${encodeURIComponent(fileName)}` 
      : `${downloadUrl}?file=${encodeURIComponent(fileName)}`;

    els.finalDownloadBtn.href = finalUrl;
    els.finalDownloadBtn.setAttribute('download', fileName);
    els.finalDownloadLabel.textContent = `Download ${ext.toUpperCase()}`;
    els.finalDownloadBtn.onclick = null;

    // Save to history
    saveToHistory({
      title: analysisData.title || 'Untitled',
      thumbnail: analysisData.thumbnail,
      platform: analysisData.platform,
      quality: format.quality,
      format: format.format,
      date: new Date().toISOString(),
    });
  }

  /* ═══════════════════════════════════════════════════════════
     UPSCALE FLOW
     ═══════════════════════════════════════════════════════════ */

  async function startUpscale() {
    if (!selectedUpscaleTarget || !analysisData) return;

    setState('processing');

    els.processingTitle.textContent = 'AI Upscaling in progress…';
    renderProcessingStages([
      { label: 'Preparing video', status: 'active' },
      { label: 'Uploading', status: 'pending' },
      { label: 'AI Upscaling', status: 'pending' },
      { label: 'Encoding', status: 'pending' },
      { label: 'Finalizing', status: 'pending' },
    ]);
    els.progressBarFill.style.width = '0%';

    try {
      const sourceUrl = els.urlInput.value.trim();
      const result = await apiPost('/api/upscale', {
        sourceUrl,
        targetResolution: selectedUpscaleTarget,
        title: analysisData.title || 'media',
      });

      if (!result.success) {
        showError(result.error || 'Upscale failed.');
        setState('result');
        return;
      }

      pollUpscaleJob(result.jobId);
    } catch (err) {
      console.error('Upscale error:', err);
      showError("We couldn't process this media. Please try again.");
      setState('result');
    }
  }

  function pollUpscaleJob(jobId) {
    clearInterval(pollingTimer);

    const STAGE_MAP = {
      queued: 0,
      preparing: 0,
      uploading: 1,
      upscaling: 2,
      encoding: 3,
      completed: 4,
    };

    pollingTimer = setInterval(async () => {
      try {
        const status = await apiGet(`/api/upscale?id=${encodeURIComponent(jobId)}`);
        const progress = status.progress || 0;

        els.progressBarFill.style.width = `${progress}%`;

        const stageIdx = STAGE_MAP[status.stage] ?? 0;
        const stages = ['Preparing video', 'Uploading', 'AI Upscaling', 'Encoding', 'Finalizing'];
        const mapped = stages.map((label, i) => ({
          label,
          status: i < stageIdx ? 'completed' : i === stageIdx ? 'active' : 'pending',
        }));
        renderProcessingStages(mapped);

        if (status.status === 'completed') {
          clearInterval(pollingTimer);
          pollingTimer = null;
          showDownloadReady(status.downloadUrl, {
            quality: selectedUpscaleTarget,
            format: 'mp4',
          });

          saveToHistory({
            title: `${analysisData.title || 'Untitled'} (AI Upscaled)`,
            thumbnail: analysisData.thumbnail,
            platform: analysisData.platform,
            quality: selectedUpscaleTarget,
            format: 'mp4',
            date: new Date().toISOString(),
            upscaled: true,
          });
        } else if (status.status === 'failed') {
          clearInterval(pollingTimer);
          pollingTimer = null;
          showError(status.error || 'Upscaling failed. Please try again.');
          setState('result');
        }
      } catch (err) {
        console.error('Upscale polling error:', err);
      }
    }, 1000);
  }

  /* ═══════════════════════════════════════════════════════════
     ERROR HANDLING
     ═══════════════════════════════════════════════════════════ */

  function showError(message) {
    els.errorText.textContent = message;
    els.errorMessage.classList.remove('hidden');
  }

  function hideError() {
    els.errorMessage.classList.add('hidden');
  }

  /* ═══════════════════════════════════════════════════════════
     DOWNLOAD HISTORY (localStorage)
     ═══════════════════════════════════════════════════════════ */

  const HISTORY_KEY = 'eomeg-history';
  const MAX_HISTORY = 50;

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveToHistory(item) {
    const history = getHistory();
    history.unshift(item);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    updateHistoryBadge();
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderHistoryList();
    updateHistoryBadge();
  }

  function updateHistoryBadge() {
    const count = getHistory().length;
    if (count > 0) {
      els.historyBadge.textContent = count > 99 ? '99+' : count;
      els.historyBadge.classList.remove('hidden');
    } else {
      els.historyBadge.classList.add('hidden');
    }
  }

  function renderHistoryList() {
    const history = getHistory();

    if (history.length === 0) {
      els.historyList.innerHTML = '<div class="history-empty">No recent downloads</div>';
      return;
    }

    els.historyList.innerHTML = history.map((item) => `
      <div class="history-item">
        <img class="history-item-thumb" src="${escapeHtml(item.thumbnail || '')}" alt="" loading="lazy" onerror="this.style.display='none'" />
        <div class="history-item-info">
          <div class="history-item-title">${escapeHtml(item.title || 'Untitled')}</div>
          <div class="history-item-meta">
            ${escapeHtml(item.platform || '')} • ${escapeHtml(item.quality || '')} • ${escapeHtml(item.format || '').toUpperCase()}
            ${item.upscaled ? ' • AI Upscaled' : ''}
            <br />${formatDate(item.date)}
          </div>
        </div>
      </div>
    `).join('');
  }

  function toggleHistory(open) {
    const isOpen = open ?? !els.historyPanel.classList.contains('open');
    els.historyPanel.classList.toggle('open', isOpen);
    els.historyBackdrop.classList.toggle('open', isOpen);
    if (isOpen) renderHistoryList();
  }

  /* ═══════════════════════════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════════════════════════ */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDuration(seconds) {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function heightToLabel(h) {
    if (h >= 2160) return '4K';
    if (h >= 1440) return '1440p';
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 480) return '480p';
    if (h >= 360) return '360p';
    return `${h}p`;
  }

  /* ═══════════════════════════════════════════════════════════
     EVENT LISTENERS
     ═══════════════════════════════════════════════════════════ */

  function init() {
    initTheme();
    updateHistoryBadge();

    els.urlInput.addEventListener('input', onUrlInput);
    els.urlInput.addEventListener('keydown', onUrlKeyDown);
    els.clearBtn.addEventListener('click', clearUrl);
    els.analyzeBtn.addEventListener('click', analyzeUrl);
    els.themeToggle.addEventListener('click', toggleTheme);

    els.historyToggle.addEventListener('click', () => toggleHistory());
    els.historyCloseBtn.addEventListener('click', () => toggleHistory(false));
    els.historyBackdrop.addEventListener('click', () => toggleHistory(false));
    els.historyClearBtn.addEventListener('click', clearHistory);

    els.startUpscaleBtn.addEventListener('click', startUpscale);

    els.anotherQualityBtn.addEventListener('click', () => {
      if (analysisData) {
        setState('result');
      }
    });

    // Handle paste events
    els.urlInput.addEventListener('paste', () => {
      setTimeout(onUrlInput, 0);
    });

    // Keyboard shortcut: Escape to close history
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.historyPanel.classList.contains('open')) {
        toggleHistory(false);
      }
    });
  }

  // ── Boot ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
