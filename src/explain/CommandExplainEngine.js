/**
 * CommandExplainEngine — Plain-English Command Explanation
 *
 * Takes any shell command string and returns a human-readable
 * explanation of what it does, broken down part by part.
 */

import { AIExecutor } from '../ai/AIExecutor.js';
import { logger } from '../utils/logger.js';

const SYSTEM_PROMPT = `You are a Linux command explainer.
Given a shell command, explain what it does in clear, simple English.
Format your response exactly like this:

[One-line summary of what the full command does]

Breakdown:
• [part 1] - [explanation of part 1]
• [part 2] - [explanation of part 2]
• [part 3] - [explanation of part 3]

[Optional warning if the command has dangerous side effects]

Be concise but thorough. Use plain language, not jargon. Do not use markdown headers.`;

export class CommandExplainEngine {
  constructor() {
    this.ai = new AIExecutor();
  }

  /**
   * Explains a shell command in plain English.
   * @param {string} command
   * @returns {Promise<string>} explanation
   */
  async explain(command) {
    logger.debug(`[CommandExplainEngine] Explaining: ${command}`);

    const response = await this.ai.complete({
      system: SYSTEM_PROMPT,
      user: `Command: ${command}`,
    });

    return response.trim();
  }
}
