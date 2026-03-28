/**
 * ConnectionService - Serial port connection use case
 *
 * Owns the lifecycle of a WebSerialPort instance.
 * UI components depend only on this service (via EventBus wiring in App.ts),
 * never on the infrastructure adapter directly.
 *
 * Port selection flow:
 *   1. requestPort()       – shows browser's native port picker, stores result
 *   2. connect(config)     – opens the stored port with the given settings
 *   3. disconnect()        – closes the port, resets state
 *
 * Previously-authorised ports can be retrieved with getPreviousPorts() and
 * injected with setSelectedPort() to skip the picker dialog.
 */

import type { SerialConfig } from '../domain/models/SerialConfig.js';
import type { ISerialPort } from '../domain/interfaces/ISerialPort.js';
import { WebSerialPort } from '../infrastructure/WebSerialPort.js';

export type ConnectionState = 'disconnected' | 'connected' | 'error';

export type ConnectionStateHandler = (
  state: ConnectionState,
  error?: Error
) => void;

export class ConnectionService {
  private _state: ConnectionState = 'disconnected';
  /** Port chosen by the user but not yet open. */
  private _selectedPort: WebSerialPort | null = null;
  /** Currently open port. */
  private _activePort: WebSerialPort | null = null;

  private readonly _handlers = new Set<ConnectionStateHandler>();

  // ---- Observers -------------------------------------------------------

  onStateChange(handler: ConnectionStateHandler): void {
    this._handlers.add(handler);
  }

  offStateChange(handler: ConnectionStateHandler): void {
    this._handlers.delete(handler);
  }

  // ---- Queries ---------------------------------------------------------

  getConnectionState(): ConnectionState {
    return this._state;
  }

  /** Returns the currently open port, or null if not connected. */
  getPort(): ISerialPort | null {
    return this._activePort;
  }

  // ---- Port selection --------------------------------------------------

  /**
   * Shows the browser's native port-picker dialog.
   * Silently ignores NotFoundError (user cancelled the dialog).
   * Must be called from within a user gesture.
   */
  async requestPort(): Promise<void> {
    try {
      this._selectedPort = await WebSerialPort.requestPort();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        // User dismissed the dialog – treat as a no-op.
        return;
      }
      throw err;
    }
  }

  /**
   * Returns WebSerialPort instances for all ports the user has
   * previously granted access to.  Used to populate a "known devices"
   * list in the UI.
   */
  async getPreviousPorts(): Promise<WebSerialPort[]> {
    return WebSerialPort.getPorts();
  }

  /**
   * Selects a specific port without showing the picker dialog.
   * Intended for reconnecting to a previously-authorised device.
   */
  setSelectedPort(port: WebSerialPort): void {
    this._selectedPort = port;
  }

  // ---- Lifecycle -------------------------------------------------------

  /**
   * Opens the selected port with the supplied configuration.
   * If already connected, disconnects first.
   * Throws if no port has been selected.
   */
  async connect(config: SerialConfig): Promise<void> {
    if (!this._selectedPort) {
      throw new Error(
        'ConnectionService: no port selected. ' +
        'Call requestPort() or setSelectedPort() before connect().'
      );
    }

    if (this._state === 'connected') {
      await this.disconnect();
    }

    const port = this._selectedPort;

    // Register event handlers before open() so no events are missed.
    port.onError((err) => {
      this._setState('error', err);
    });

    port.onDisconnect(() => {
      this._activePort = null;
      this._setState('error', new Error('デバイスが切断されました'));
    });

    try {
      await port.open(config);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._setState('error', error);
      throw error;
    }

    this._activePort = port;
    this._setState('connected');
  }

  /** Closes the active port and transitions to the disconnected state. */
  async disconnect(): Promise<void> {
    if (this._activePort) {
      await this._activePort.close();
      this._activePort = null;
    }
    this._setState('disconnected');
  }

  // ---- Private ---------------------------------------------------------

  private _setState(state: ConnectionState, error?: Error): void {
    this._state = state;
    for (const h of this._handlers) h(state, error);
  }
}
