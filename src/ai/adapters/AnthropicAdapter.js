/**
 * AnthropicAdapter — Anthropic Claude Provider Adapter
 *
 * Wraps the Anthropic SDK for use by AIProviderManager.
 * Requires ANTHROPIC_API_KEY environment variable.
 */

import { logger } from '../../utils/logger.js';

export class AnthropicAdapter {
  constructor(aiConfig = {}) {
    this.apiKey = aiConfig.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model  = aiConfig.model || aiConfig.anthropicModel || 'claude-3-5-sonnet-20241022';
    this.temperature = aiConfig.temperature ?? 0.2;
    this.maxTokens = 1024;
  }

  /**
   * @param {{ system: string, user: string }} request
   * @returns {Promise<string>}
   */
  async complete({ system, user }) {
    logger.debug(`[AnthropicAdapter] model=${this.model}`);

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: this.apiKey });

    const message = await client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system,
      messages: [{ role: 'user', content: user }],
    });

    return message.content[0].text.trim();
  }
}
