/**
 * Cross-platform binary resolution for yt-dlp, ffmpeg, and ffprobe.
 * Works seamlessly on Windows (local dev with .exe) and Linux (Docker / Render).
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const isWin = process.platform === 'win32';
const BIN_DIR = path.resolve(__dirname, '../bin');

function isExecutable(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (isWin) return true;
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Resolves the absolute path to a binary or returns the executable name.
 * @param {'yt-dlp' | 'ffmpeg' | 'ffprobe'} name
 * @returns {string}
 */
function findBinary(name) {
  // 1. Check local project bin/ folder
  const localCandidates = isWin
    ? [path.join(BIN_DIR, `${name}.exe`), path.join(BIN_DIR, name)]
    : [path.join(BIN_DIR, name), path.join(BIN_DIR, `${name}.exe`)];

  for (const candidate of localCandidates) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  // 2. Check standard Linux/macOS paths
  if (!isWin) {
    const unixPaths = [
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`,
      `/bin/${name}`,
    ];
    for (const p of unixPaths) {
      if (isExecutable(p)) {
        return p;
      }
    }
  }

  // 3. Check PATH via 'where' or 'which'
  try {
    const cmd = isWin ? `where ${name}` : `which ${name}`;
    const output = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf-8' });
    const lines = output.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0 && isExecutable(lines[0])) {
      return lines[0];
    }
  } catch (_) {}

  // 4. Fallback to binary name
  return isWin ? `${name}.exe` : name;
}

/**
 * Checks whether a binary is available and executable.
 * @param {string} name
 * @returns {boolean}
 */
function hasBinary(name) {
  const resolved = findBinary(name);
  if (path.isAbsolute(resolved)) {
    return isExecutable(resolved);
  }
  try {
    const cmd = isWin ? `where ${name}` : `which ${name}`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Directory containing ffmpeg, suitable for yt-dlp's --ffmpeg-location parameter.
 * @returns {string | null}
 */
function getFfmpegDir() {
  const ffmpegPath = findBinary('ffmpeg');
  if (path.isAbsolute(ffmpegPath) && fs.existsSync(ffmpegPath)) {
    return path.dirname(ffmpegPath);
  }
  return null;
}

module.exports = {
  findBinary,
  hasBinary,
  getFfmpegDir,
  BIN_DIR,
};
