/**
 * SimulationEngine — Dry-Run Executor
 *
 * Predicts the effects of a command without actually running it.
 * Uses --dry-run flags where tools support them, and AI prediction otherwise.
 */

import { AIExecutor } from '../ai/AIExecutor.js';
import { logger } from '../utils/logger.js';

const DRY_RUN_FLAGS = {
  rsync: '--dry-run',
  apt: '--simulate',
  'apt-get': '--simulate',
  dnf: '--assumeno',
  pacman: '-p',
  ansible: '--check',
};

const SYSTEM_PROMPT = `You are a Linux command simulator.
Given a shell command and environment context, predict what it would do if executed.
Respond with a JSON object:
{
  "prediction": "Human-readable description of what the command would do",
  "affectedPaths": ["/path/one", "/path/two"],
  "isDestructive": false,
  "estimatedDuration": "< 1s"
}
Always respond with ONLY the JSON, no markdown, no explanation.`;

export class SimulationEngine {
  constructor() {
    this.ai = new AIExecutor();
  }

  /**
   * Simulates a command and returns predicted effects.
   * @param {string} command
   * @param {object} envContext
   * @returns {Promise<object>} simulation result
   */
  async simulate(command, envContext = {}) {
    logger.debug(`[SimulationEngine] Simulating: ${command}`);

    // Try native dry-run first
    const nativeResult = this._tryNativeDryRun(command);
    if (nativeResult) return nativeResult;

    // Fall back to AI prediction
    const userMessage = `Command: ${command}\nEnvironment: cwd=${envContext.cwd}, distro=${envContext.distro}`;
    const response = await this.ai.complete({ system: SYSTEM_PROMPT, user: userMessage });

    try {
      const result = JSON.parse(response);
      logger.debug(`[SimulationEngine] Prediction: ${JSON.stringify(result)}`);
      return { ...result, source: 'ai' };
    } catch {
      return { prediction: response, source: 'ai', affectedPaths: [], isDestructive: false };
    }
  }

  /**
   * Checks if the command's tool supports a native --dry-run flag.
   * @param {string} command
   * @returns {object|null}
   */
  _tryNativeDryRun(command) {
    const tool = command.trim().split(' ')[0];
    const flag = DRY_RUN_FLAGS[tool];
    if (flag) {
      return {
        prediction: `Would run: ${command} ${flag}`,
        nativeDryRunFlag: flag,
        source: 'native',
        affectedPaths: [],
        isDestructive: false,
      };
    }
    return null;
  }
}
