/**
 * AIProviderManager — Multi-Provider AI Backend Router
 *
 * Manages multiple AI providers (OpenAI, Gemini, Ollama, Anthropic)
 * with automatic failover when the primary provider fails.
 *
 * Provider priority is determined by config.ai.provider and
 * config.ai.fallbackProviders.
 */

import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

export class AIProviderManager {
  constructor() {
    this.config = getConfig();
    this._providers = {};
    this._loadProviders();
  }

  /**
   * Lazily loads provider adapters based on config.
   */
  _loadProviders() {
    const { provider, fallbackProviders = [] } = this.config.ai;
    this._providerOrder = [provider, ...fallbackProviders];
  }

  /**
   * Sends a request to the primary provider, falling back on error.
   * @param {{ system: string, user: string, model?: string }} request
   * @returns {Promise<string>} AI response text
   */
  async complete(request) {
    let lastError;
    for (const providerName of this._providerOrder) {
      try {
        logger.debug(`[AIProviderManager] Trying provider: ${providerName}`);
        const adapter = await this._getAdapter(providerName);
        const result = await adapter.complete(request);
        return result;
      } catch (err) {
        logger.warn(`[AIProviderManager] Provider '${providerName}' failed: ${err.message}`);
        lastError = err;
      }
    }
    throw new Error(`[AIProviderManager] All providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Returns (and caches) the adapter for a given provider name.
   * @param {string} name
   * @returns {Promise<object>} provider adapter
   */
  async _getAdapter(name) {
    if (this._providers[name]) return this._providers[name];

    switch (name) {
      case 'other':
      case 'openai': {
        const { OpenAIAdapter } = await import('./adapters/OpenAIAdapter.js');
        this._providers[name] = new OpenAIAdapter(this.config.ai);
        break;
      }
      case 'gemini': {
        const { GeminiAdapter } = await import('./adapters/GeminiAdapter.js');
        this._providers[name] = new GeminiAdapter(this.config.ai);
        break;
      }
      case 'ollama': {
        const { OllamaAdapter } = await import('./adapters/OllamaAdapter.js');
        this._providers[name] = new OllamaAdapter(this.config.ai);
        break;
      }
      case 'anthropic': {
        const { AnthropicAdapter } = await import('./adapters/AnthropicAdapter.js');
        this._providers[name] = new AnthropicAdapter(this.config.ai);
        break;
      }
      default:
        throw new Error(`[AIProviderManager] Unknown provider: ${name}`);
    }

    return this._providers[name];
  }
}
