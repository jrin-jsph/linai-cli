/**
 * LearningEngine — Command History & User Corrections
 *
 * Persists successful commands and user corrections to disk.
 * Used to build context-aware prompts in future runs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CORRECTIONS_FILE = path.join(DATA_DIR, 'corrections.json');

export class LearningEngine {
  constructor() {
    this.config = getConfig();
    this._ensureDataDir();
  }

  /**
   * Logs a successful pipeline execution to history.
   * @param {object} ctx - pipeline context
   */
  async log(ctx) {
    if (!this.config.learning?.enabled) return;

    const entry = {
      timestamp: new Date().toISOString(),
      rawInput: ctx.rawInput,
      command: ctx.command,
      corrected: ctx.correctedCommand || null,
      exitCode: ctx.executionResult?.exitCode ?? null,
    };

    const history = this._read(HISTORY_FILE);
    history.push(entry);

    // Trim to max entries
    const max = this.config.learning?.maxHistoryEntries || 1000;
    if (history.length > max) history.splice(0, history.length - max);

    this._write(HISTORY_FILE, history);
    logger.debug(`[LearningEngine] Logged command to history.`);
  }

  /**
   * Records a user correction (wrong → right command).
   * @param {string} wrong - original command
   * @param {string} right - corrected command
   */
  async correct(wrong, right) {
    const corrections = this._read(CORRECTIONS_FILE);
    corrections.push({ wrong, right, timestamp: new Date().toISOString() });
    this._write(CORRECTIONS_FILE, corrections);
    logger.info(`[LearningEngine] Correction recorded.`);
  }

  /**
   * Returns the most recent N history entries for prompt building.
   * @param {number} n
   * @returns {object[]}
   */
  getRecentHistory(n = 10) {
    const history = this._read(HISTORY_FILE);
    return history.slice(-n);
  }

  _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(HISTORY_FILE)) this._write(HISTORY_FILE, []);
    if (!fs.existsSync(CORRECTIONS_FILE)) this._write(CORRECTIONS_FILE, []);
  }

  _read(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return [];
    }
  }

  _write(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
