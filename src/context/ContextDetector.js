/**
 * ContextDetector — Detects Runtime Environment
 *
 * Gathers information about the user's current environment:
 * - Current working directory
 * - Active shell
 * - Linux distro / OS version
 * - Current user and sudo availability
 * - Available package managers and tools
 */

import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const KNOWN_TOOLS = [
  'find', 'grep', 'awk', 'sed', 'curl', 'wget', 'tar', 'zip', 'unzip',
  'git', 'docker', 'kubectl', 'npm', 'node', 'python3', 'pip3',
  'apt', 'apt-get', 'yum', 'dnf', 'pacman', 'brew', 'snap', 'flatpak',
  'systemctl', 'journalctl', 'ps', 'kill', 'top', 'htop', 'lsof', 'netstat', 'ss',
];

export class ContextDetector {
  /**
   * Detects and returns the current environment context.
   * @returns {Promise<object>} envContext
   */
  async detect() {
    const cwd = process.cwd();
    const user = os.userInfo().username;
    const shell = process.env.SHELL || '/bin/bash';
    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();

    const distro = this._getDistro();
    const availableTools = this._detectTools();
    const projectType = this._detectProjectType(cwd);

    const ctx = {
      cwd,
      user,
      shell,
      platform,
      arch,
      hostname,
      distro,
      availableTools,
      projectType,
      env: {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        LANG: process.env.LANG,
      },
    };

    logger.debug(`[ContextDetector] ${JSON.stringify(ctx)}`);
    return ctx;
  }

  /**
   * Detects the type of project based on files in the current directory.
   * @param {string} cwd
   * @returns {string|null} e.g. 'Node.js', 'Python', 'Rust', or null
   */
  _detectProjectType(cwd) {
    try {
      if (fs.existsSync(path.join(cwd, 'package.json'))) return 'Node.js';
      if (fs.existsSync(path.join(cwd, 'requirements.txt')) || fs.existsSync(path.join(cwd, 'Pipfile')) || fs.existsSync(path.join(cwd, 'pyproject.toml'))) return 'Python';
      if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) return 'Rust';
      if (fs.existsSync(path.join(cwd, 'go.mod'))) return 'Go';
      if (fs.existsSync(path.join(cwd, 'pom.xml')) || fs.existsSync(path.join(cwd, 'build.gradle'))) return 'Java';
      if (fs.existsSync(path.join(cwd, 'Gemfile'))) return 'Ruby';
      if (fs.existsSync(path.join(cwd, 'composer.json'))) return 'PHP';
    } catch (e) {
      logger.debug(`[ContextDetector] Failed to detect project type: ${e.message}`);
    }
    return null;
  }

  /**
   * Reads /etc/os-release to determine the Linux distro.
   * Falls back gracefully on non-Linux platforms.
   * @returns {string}
   */
  _getDistro() {
    try {
      const raw = execSync('cat /etc/os-release 2>/dev/null || sw_vers 2>/dev/null || echo "Unknown"', {
        encoding: 'utf8',
        timeout: 2000,
      });
      const match = raw.match(/PRETTY_NAME="?([^"\n]+)"?/);
      return match ? match[1] : raw.split('\n')[0].trim();
    } catch {
      return `${os.platform()} ${os.release()}`;
    }
  }

  /**
   * Checks which known tools are available in $PATH.
   * @returns {string[]}
   */
  _detectTools() {
    return KNOWN_TOOLS.filter((tool) => {
      try {
        execSync(`command -v ${tool}`, { stdio: 'ignore', timeout: 1000 });
        return true;
      } catch {
        return false;
      }
    });
  }
}
