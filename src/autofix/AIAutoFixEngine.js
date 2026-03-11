/**
 * AIAutoFixEngine — Automated Error Recovery
 *
 * When a command fails, sends the failed command + stderr to AI
 * and receives a corrected command for retry.
 */

import { AIExecutor } from '../ai/AIExecutor.js';
import { logger } from '../utils/logger.js';

const SYSTEM_PROMPT = `You are a Linux command debugger and auto-fixer.
Given a failed shell command and its stderr output, provide a corrected command.
Rules:
- Respond with ONLY the corrected command string, no markdown, no backticks, no explanation.
- If the command cannot be fixed, respond with: CANNOT_FIX
- Never include unsafe or destructive changes not implied by the original intent.`;

export class AIAutoFixEngine {
  constructor() {
    this.ai = new AIExecutor();
  }

  /**
   * Attempts to auto-fix a failed command using AI.
   * @param {string} failedCommand - The command that failed
   * @param {string} stderr - The error output
   * @param {object} envContext - Environment context
   * @returns {Promise<string|null>} corrected command or null if unfixable
   */
  async fix(failedCommand, stderr, envContext = {}) {
    logger.debug(`[AIAutoFixEngine] Attempting fix for: ${failedCommand}`);

    const userMessage = [
      `Failed command: ${failedCommand}`,
      `Error output: ${stderr?.slice(0, 500)}`,
      `Environment: distro=${envContext.distro}, shell=${envContext.shell}, cwd=${envContext.cwd}`,
    ].join('\n');

    const response = await this.ai.complete({
      system: SYSTEM_PROMPT,
      user: userMessage,
    });

    if (!response || response.trim() === 'CANNOT_FIX') {
      logger.warn('[AIAutoFixEngine] Could not auto-fix command.');
      return null;
    }

    const corrected = response.trim().replace(/^`+|`+$/g, '');
    logger.info(`[AIAutoFixEngine] Corrected command: ${corrected}`);
    return corrected;
  }
}
