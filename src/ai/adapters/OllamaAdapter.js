/**
 * OllamaAdapter — Local Ollama Provider Adapter
 *
 * Sends requests to a locally running Ollama server.
 * Requires Ollama to be running on OLLAMA_BASE_URL (default: http://localhost:11434).
 */

import { logger } from '../../utils/logger.js';

export class OllamaAdapter {
  constructor(aiConfig = {}) {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = aiConfig.ollamaModel || 'llama3';
    this.temperature = aiConfig.temperature ?? 0.2;
  }

  /**
   * @param {{ system: string, user: string }} request
   * @returns {Promise<string>}
   */
  async complete({ system, user }) {
    logger.debug(`[OllamaAdapter] model=${this.model} at ${this.baseUrl}`);

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
      options: { temperature: this.temperature },
    });

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) throw new Error(`[OllamaAdapter] HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.message?.content?.trim() ?? '';
  }
}
