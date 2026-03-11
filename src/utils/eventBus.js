/**
 * eventBus — Internal Node.js EventEmitter Bus
 *
 * A shared singleton EventEmitter used for decoupled communication
 * between modules and plugins.
 *
 * Events emitted by CommandChainEngine:
 *   context.detected, intent.parsed, params.extracted,
 *   command.generated, command.safety.checked, command.simulated,
 *   command.executed, command.failed, command.explained
 */

import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50); // allow many plugin subscribers
