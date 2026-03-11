/**
 * OpenAIAdapter — OpenAI GPT Provider Adapter
 *
 * Wraps the OpenAI SDK for use by AIProviderManager.
 * Supports GPT-4o and other chat completion models.
 */

import OpenAI from 'openai';
import { logger } from '../../utils/logger.js';

export class OpenAIAdapter {
  constructor(aiConfig = {}) {
    const clientOptions = {
      apiKey: aiConfig.apiKey || process.env.OPENAI_API_KEY,
    };
    if (aiConfig.baseURL) clientOptions.baseURL = aiConfig.baseURL;
    
    this.client = new OpenAI(clientOptions);
    this.model = aiConfig.model || 'gpt-4o';
    this.temperature = aiConfig.temperature ?? 0.2;
  }

  /**
   * @param {{ system: string, user: string, model?: string }} request
   * @returns {Promise<string>}
   */
  async complete({ system, user, model }) {
    logger.debug(`[OpenAIAdapter] model=${model || this.model}`);
    const response = await this.client.chat.completions.create({
      model: model || this.model,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return response.choices[0].message.content.trim();
  }
}
