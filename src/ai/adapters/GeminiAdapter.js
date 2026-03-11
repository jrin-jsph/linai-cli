/**
 * GeminiAdapter — Google Gemini Provider Adapter
 *
 * Wraps the Google Generative AI SDK for use by AIProviderManager.
 * Requires GEMINI_API_KEY environment variable.
 */

import { logger } from '../../utils/logger.js';

export class GeminiAdapter {
  constructor(aiConfig = {}) {
    this.apiKey = aiConfig.apiKey || process.env.GEMINI_API_KEY;
    this.model  = aiConfig.model || aiConfig.geminiModel || 'gemini-1.5-flash';
    this.temperature = aiConfig.temperature ?? 0.2;
  }

  /**
   * @param {{ system: string, user: string }} request
   * @returns {Promise<string>}
   */
  async complete({ system, user }) {
    logger.debug(`[GeminiAdapter] model=${this.model}`);

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: system,
      generationConfig: { temperature: this.temperature },
    });

    const result = await model.generateContent(user);
    return result.response.text().trim();
  }
}
