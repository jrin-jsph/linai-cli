/**
 * ExecutionEngine — Shell Command Runner
 *
 * Executes shell commands via child_process.spawn,
 * streams stdout/stderr in real time, and returns the full result.
 */

import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

export class ExecutionEngine {
  /**
   * Executes a shell command and returns the result.
   * @param {string} command - The full shell command string
   * @param {object} options
   * @param {string} [options.cwd] - Working directory
   * @param {number} [options.timeout] - Timeout in ms (default: 30000)
   * @param {boolean} [options.stream] - Stream output to stdout (default: true)
   * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
   */
  async execute(command, options = {}) {
    const { cwd = process.cwd(), timeout = 30000, stream = true } = options;

    logger.debug(`[ExecutionEngine] Executing: ${command}`);

    return new Promise((resolve, reject) => {
      const proc = spawn(command, [], {
        cwd,
        env: process.env,
        stdio: stream ? 'inherit' : 'pipe',
        shell: true, // Automatically uses cmd.exe on Windows, /bin/sh on POSIX
      });

      let stdout = '';
      let stderr = '';

      if (!stream) {
        if (proc.stdout) proc.stdout.on('data', (d) => { stdout += d.toString(); });
        if (proc.stderr) proc.stderr.on('data', (d) => { stderr += d.toString(); });
      }

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`[ExecutionEngine] Command timed out after ${timeout}ms: ${command}`));
      }, timeout);

      proc.on('close', (exitCode) => {
        clearTimeout(timer);
        logger.debug(`[ExecutionEngine] Exit code: ${exitCode}`);
        resolve({ exitCode: exitCode ?? 1, stdout, stderr });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
