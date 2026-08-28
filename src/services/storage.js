import { readFileSync, writeFileSync, renameSync, unlinkSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Ensures the target directory exists.
 * @param {string} dirPath
 */
export function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Safely reads a JSON file with automatic fallback and backup recovery.
 * @template T
 * @param {string} filePath
 * @param {T} defaultValue
 * @returns {T}
 */
export function readJson(filePath, defaultValue) {
  if (!existsSync(filePath)) {
    return structuredClone(defaultValue);
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    if (!raw.trim()) {
      throw new Error(`File ${filePath} is empty`);
    }
    return JSON.parse(raw);
  } catch (primaryErr) {
    const backupPath = `${filePath}.bak`;
    if (existsSync(backupPath)) {
      try {
        const backupRaw = readFileSync(backupPath, 'utf-8');
        return JSON.parse(backupRaw);
      } catch {
        // Fallback to defaultValue if backup is also corrupted
      }
    }
    return structuredClone(defaultValue);
  }
}

/**
 * Atomically writes data to a JSON file by writing to a temporary file first,
 * optionally backing up the existing file, and then renaming the temp file.
 * @param {string} filePath
 * @param {unknown} data
 * @param {{ backup?: boolean, spaces?: number }} [options]
 */
export function writeJsonAtomic(filePath, data, options = {}) {
  const { backup = true, spaces = 2 } = options;
  const dir = dirname(filePath);
  ensureDir(dir);

  const jsonString = JSON.stringify(data, null, spaces);
  const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}`;

  try {
    // 1. Write to temporary file
    writeFileSync(tempPath, jsonString, 'utf-8');

    // 2. Create backup of current file before overwriting if requested and source exists
    if (backup && existsSync(filePath)) {
      const backupPath = `${filePath}.bak`;
      try {
        copyFileSync(filePath, backupPath);
      } catch {
        // Backup failure should not prevent write
      }
    }

    // 3. Atomic rename
    renameSync(tempPath, filePath);
  } catch (err) {
    // Clean up temporary file if write or rename failed
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup error
      }
    }
    throw err;
  }
}
