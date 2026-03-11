/**
 * SafetyFilter — Command Risk Assessment
 *
 * Scores commands on a 0–100 risk scale and decides whether to:
 *   - Allow (score < 70)
 *   - Require confirmation (70 ≤ score < 95)
 *   - Block entirely (score ≥ 95)
 *
 * Uses pattern matching for known dangerous commands,
 * with an AI fallback for ambiguous cases.
 */

import { logger } from '../utils/logger.js';

/** High-risk patterns that are always blocked (score: 100) */
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\/(?:\s|$)/,           // rm -rf /
  /rm\s+-rf\s+~(?:\s|$)/,            // rm -rf ~
  /\bmkfs\b/,                        // format filesystem (mkfs, mkfs.ext4, etc.)
  /dd\s+.*of=\/dev\/(sd|hd|nvme)/,   // dd to raw disk
  />\s*\/dev\/(sd|hd|nvme)/,         // redirect to raw disk
  /chmod\s+-R\s+777\s+\//,           // chmod 777 on root
  /:\(\)\s*\{.*\};/,                 // fork bomb
  /\b(shutdown|reboot|halt|poweroff)\b/, // system shutdown/reboot
];

/** Medium-risk patterns (score: 75) */
const WARN_PATTERNS = [
  { re: /\brm\b.*-r/i, score: 75, reason: 'Recursive delete' },
  { re: /\bcrontab\b.*-r/i, score: 80, reason: 'Removing crontab' },
  { re: /\bkill\b.*-9/i, score: 70, reason: 'Force kill process' },
  { re: /\bchmod\b.*777/i, score: 72, reason: 'Open permissions (777)' },
  { re: /\bapt.*(remove|purge)/i, score: 70, reason: 'Package removal' },
  { re: /\bsystemctl\s+(stop|disable)/i, score: 70, reason: 'Stopping/disabling service' },
  { re: /\biptables\b.*-F/i, score: 80, reason: 'Flushing firewall rules' },
  { re: /\btruncate\b/i, score: 70, reason: 'File truncation' },
  { re: /\bpasswd\b/i, score: 75, reason: 'Password change' },
];

export class SafetyFilter {
  /**
   * Scores and assesses the safety of a command.
   * @param {string} command
   * @param {object} envContext
   * @returns {{ score: number, decision: 'safe'|'confirm'|'blocked', reason: string }}
   */
  async check(command, envContext = {}) {
    logger.debug(`[SafetyFilter] Checking: ${command}`);

    // 1. Check hard-blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        logger.warn(`[SafetyFilter] BLOCKED — matches pattern: ${pattern}`);
        return { score: 100, decision: 'blocked', reason: 'Matched a hard-blocked dangerous pattern.' };
      }
    }

    // 2. Check warn patterns
    for (const { re, score, reason } of WARN_PATTERNS) {
      if (re.test(command)) {
        const decision = score >= 95 ? 'blocked' : 'confirm';
        logger.warn(`[SafetyFilter] ${decision.toUpperCase()} — ${reason} (score: ${score})`);
        return { score, decision, reason };
      }
    }

    // 3. Check for sudo escalation
    if (/\bsudo\b/.test(command)) {
      return { score: 65, decision: 'confirm', reason: 'Command requires sudo (privilege escalation).' };
    }

    // 4. Default: safe
    return { score: 10, decision: 'safe', reason: 'No dangerous patterns detected.' };
  }
}
