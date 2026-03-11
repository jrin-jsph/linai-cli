/**
 * ErrorHandler — Execution Error Classifier
 *
 * Takes a raw execution result (exitCode, stderr) and
 * classifies the error type, producing a user-friendly error report.
 */

import { logger } from '../utils/logger.js';

const ERROR_PATTERNS = [
  { re: /permission denied/i, type: 'permission', hint: 'Try running with sudo.' },
  { re: /command not found/i, type: 'not-found', hint: 'The command may not be installed. Try installing it first.' },
  { re: /no such file or directory/i, type: 'file-not-found', hint: 'Check the path — the file or directory does not exist.' },
  { re: /network is unreachable|could not resolve host/i, type: 'network', hint: 'Check your network connection.' },
  { re: /disk quota exceeded|no space left/i, type: 'disk-full', hint: 'Free up disk space and retry.' },
  { re: /killed/i, type: 'killed', hint: 'Process was killed — possibly OOM or timeout.' },
  { re: /syntax error/i, type: 'syntax', hint: 'The command has a syntax error.' },
  { re: /operation not permitted/i, type: 'permission', hint: 'Insufficient permissions for this operation.' },
];

export class ErrorHandler {
  /**
   * Classifies an execution result into a structured error.
   * @param {{ exitCode: number, stdout: string, stderr: string }} result
   * @returns {{ type: string, message: string, hint: string, raw: string }}
   */
  handle(result) {
    const { exitCode, stderr, stdout } = result;
    const raw = stderr || stdout || `Command exited with code ${exitCode}`;

    for (const { re, type, hint } of ERROR_PATTERNS) {
      if (re.test(raw)) {
        const error = { type, message: raw.trim(), hint, exitCode, raw };
        logger.warn(`[ErrorHandler] ${type}: ${raw.trim()}`);
        return error;
      }
    }

    const error = { type: 'unknown', message: raw.trim(), hint: 'Check the command and try again.', exitCode, raw };
    logger.warn(`[ErrorHandler] unknown error: ${raw.trim()}`);
    return error;
  }
}
