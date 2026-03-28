/**
 * EventBus - Type-safe component-to-component event bus
 *
 * Provides decoupled communication between UI components via a
 * publish-subscribe mechanism.  All event names and payloads are
 * statically typed through EventMap.
 *
 * Usage:
 *   bus.on('connection:stateChanged', ({ state }) => { ... });
 *   bus.emit('connection:stateChanged', { state: 'connected' });
 *
 *   // Void events (no payload):
 *   bus.on('ui:pauseReceive', () => { ... });
 *   bus.emit('ui:pauseReceive');
 */

import type { ConnectionState } from '../application/ConnectionService.js';
import type { ReceivedChunk } from '../domain/models/ReceivedData.js';
import type { SendMessage } from '../domain/models/SendMessage.js';

import type { PortInfo } from '../domain/interfaces/ISerialPort.js';

// ---- Event map --------------------------------------------------------

export type EventMap = {
  /** Fired whenever the serial connection state changes. */
  'connection:stateChanged': { state: ConnectionState; error?: Error; portInfo?: PortInfo | null };
  /** Fired for every incoming data chunk from the port. */
  'serial:dataReceived': { chunk: ReceivedChunk };
  /** Fired after a message has been successfully written to the port. */
  'serial:dataSent': { message: SendMessage };
  /** Fired when a non-fatal or fatal serial error is encountered. */
  'serial:error': { error: Error };
  /** UI request to clear the receive buffer and display. */
  'ui:clearReceiveBuffer': void;
  /** UI request to pause receive display updates. */
  'ui:pauseReceive': void;
  /** UI request to resume receive display updates. */
  'ui:resumeReceive': void;
};

// ---- Handler type helpers --------------------------------------------

/**
 * Maps each event key to the appropriate handler function signature:
 *   - void payload → () => void
 *   - typed payload → (payload: T) => void
 */
type EventHandler<P> = P extends void ? () => void : (payload: P) => void;

// ---- EventBus --------------------------------------------------------

export class EventBus {
  /**
   * Internal handler registry.  Keyed by event name; values are Sets
   * of raw callbacks stored as `(p: unknown) => void` to allow a
   * single map type.  The public API enforces correct signatures.
   */
  private readonly _registry = new Map<
    keyof EventMap,
    Set<(payload: unknown) => void>
  >();

  /**
   * Subscribes `handler` to `event`.
   * For void events the handler takes no arguments.
   */
  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    let set = this._registry.get(event);
    if (!set) {
      set = new Set();
      this._registry.set(event, set);
    }
    set.add(handler as (payload: unknown) => void);
  }

  /**
   * Unsubscribes a previously registered handler.
   * Safe to call even if the handler was never registered.
   */
  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this._registry.get(event)?.delete(handler as (payload: unknown) => void);
  }

  /**
   * Fires `event`, invoking all registered handlers synchronously.
   *
   * For void events the payload argument is omitted:
   *   bus.emit('ui:pauseReceive');
   *
   * For typed events a payload must be supplied:
   *   bus.emit('serial:dataReceived', { chunk });
   */
  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [payload: EventMap[K]]
  ): void {
    const handlers = this._registry.get(event);
    if (!handlers || handlers.size === 0) return;

    // For void events args is empty; payload will be undefined, which is
    // fine because void handlers ignore their argument.
    const payload = args.length > 0 ? args[0] : undefined;
    for (const h of handlers) {
      h(payload);
    }
  }
}
