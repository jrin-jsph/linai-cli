/**
 * AIExecutor — Unified AI Prompt Interface
 *
 * Single gateway for all AI completions in the pipeline.
 * Routes every request through AIProviderManager so any module
 * never needs to know which backend is active.
 */

import { AIProviderManager } from './AIProviderManager.js';
import { logger } from '../utils/logger.js';

let _sharedManager = null;

export class AIExecutor {
  constructor() {
    // Singleton-style manager so all modules share the same provider state
    if (!_sharedManager) {
      _sharedManager = new AIProviderManager();
    }
    this.manager = _sharedManager;
  }

  /**
   * Sends a prompt and returns the AI response string.
   * @param {{ system: string, user: string, model?: string }} request
   * @returns {Promise<string>}
   */
  async complete(request) {
    logger.debug(`[AIExecutor] Prompt → "${request.user?.slice(0, 80)}..."`);
    const response = await this.manager.complete(request);
    logger.debug(`[AIExecutor] Response ← "${response?.slice(0, 80)}..."`);
    return response;
  }
}
