/**
 * WebSerialPort - Web Serial API adapter
 *
 * Concrete implementation of ISerialPort backed by the browser's
 * Web Serial API.  The ConnectionService (Phase 4) creates instances
 * via the static factory methods; application code depends only on
 * the ISerialPort abstraction.
 *
 * Receive-loop error policy:
 *   - Non-fatal (transient hardware) errors: surface via onError callback,
 *     release the reader lock, then restart the loop.
 *   - Fatal errors: surface via onError callback, perform full cleanup,
 *     and stop the loop.
 *   - Device disconnect: detected via navigator.serial 'disconnect' event;
 *     surfaces via onDisconnect callback with minimal cleanup.
 */

import type { SerialConfig } from '../domain/models/SerialConfig.js';
import type { ISerialPort, PortInfo } from '../domain/interfaces/ISerialPort.js';

/**
 * The Web Serial API fires SerialConnectionEvent on connect/disconnect.
 * Declared locally to avoid dependency on a specific @types package version.
 */
interface SerialConnectionEvent extends Event {
  readonly port: SerialPort;
}

/**
 * DOMException name values that represent transient hardware conditions.
 * The loop retries after releasing the reader lock.
 */
const NON_FATAL_ERROR_NAMES = new Set([
  'BufferOverrunError',
  'FramingError',
  'ParityError',
  'BreakError',
]);

export class WebSerialPort implements ISerialPort {
  private readonly _nativePort: SerialPort;

  private _reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private _isOpen = false;
  private _readLoopAborted = false;

  private _receiveCallback: ((data: Uint8Array) => void) | null = null;
  private _errorCallback: ((error: Error) => void) | null = null;
  private _disconnectCallback: (() => void) | null = null;

  // Bound event handler stored so the same reference is used for
  // both addEventListener and removeEventListener.
  private readonly _onSerialDisconnect: (event: Event) => void;

  private constructor(nativePort: SerialPort) {
    this._nativePort = nativePort;
    this._onSerialDisconnect = (event: Event) => {
      const e = event as SerialConnectionEvent;
      if (e.port === this._nativePort) {
        void this._handleDeviceDisconnect();
      }
    };
  }

  // ---- Static factory methods ----------------------------------------

  /**
   * Shows the browser's port-picker dialog and returns a WebSerialPort
   * wrapping the selected port.
   * Must be called from within a user gesture (e.g. button click).
   */
  static async requestPort(filters: SerialPortFilter[] = []): Promise<WebSerialPort> {
    const port = await navigator.serial.requestPort({ filters });
    return new WebSerialPort(port);
  }

  /**
   * Returns WebSerialPort instances for all ports the user has previously
   * granted access to.
   */
  static async getPorts(): Promise<WebSerialPort[]> {
    const ports = await navigator.serial.getPorts();
    return ports.map((p) => new WebSerialPort(p));
  }

  // ---- ISerialPort: lifecycle -----------------------------------------

  async open(config: SerialConfig): Promise<void> {
    if (this._isOpen) {
      throw new Error('WebSerialPort: port is already open.');
    }

    await this._nativePort.open({
      baudRate:    config.baudRate,
      dataBits:    config.dataBits,
      stopBits:    config.stopBits,
      parity:      config.parity,
      flowControl: config.flowControl,
    });

    this._isOpen = true;
    this._readLoopAborted = false;

    navigator.serial.addEventListener('disconnect', this._onSerialDisconnect);

    // Run in background – errors are surfaced via _errorCallback.
    void this._runReceiveLoop();
  }

  async close(): Promise<void> {
    if (!this._isOpen) return;

    this._readLoopAborted = true;

    await this._cancelReader();

    try {
      await this._nativePort.close();
    } catch {
      // Ignore – port may already be closed (e.g. device pulled out).
    }

    this._isOpen = false;
    navigator.serial.removeEventListener('disconnect', this._onSerialDisconnect);
  }

  // ---- ISerialPort: I/O ----------------------------------------------

  async write(data: Uint8Array): Promise<void> {
    if (!this._isOpen) {
      throw new Error('WebSerialPort: cannot write, port is not open.');
    }
    if (!this._nativePort.writable) {
      throw new Error('WebSerialPort: port.writable is null.');
    }

    const writer = this._nativePort.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      // Always release so the next write can acquire a new writer.
      writer.releaseLock();
    }
  }

  // ---- ISerialPort: callbacks ----------------------------------------

  onReceive(callback: (data: Uint8Array) => void): void {
    this._receiveCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this._errorCallback = callback;
  }

  onDisconnect(callback: () => void): void {
    this._disconnectCallback = callback;
  }

  // ---- ISerialPort: getters ------------------------------------------

  get isOpen(): boolean {
    return this._isOpen;
  }

  get portInfo(): PortInfo | null {
    if (!this._isOpen) return null;
    const info = this._nativePort.getInfo();
    return {
      ...(info.usbVendorId  !== undefined ? { usbVendorId:  info.usbVendorId  } : {}),
      ...(info.usbProductId !== undefined ? { usbProductId: info.usbProductId } : {}),
    } satisfies PortInfo;
  }

  // ---- Private helpers -----------------------------------------------

  /**
   * Main receive loop.  Runs until the port is closed or a fatal error
   * occurs.  Non-fatal hardware errors cause the loop to restart after
   * releasing the reader lock.
   */
  private async _runReceiveLoop(): Promise<void> {
    while (!this._readLoopAborted && this._isOpen) {
      if (!this._nativePort.readable) {
        // Stream ended – treat as fatal.
        break;
      }

      const reader = this._nativePort.readable.getReader();
      this._reader = reader;
      try {
        // Inner read loop: exits on stream done or abort signal.
        while (true) {
          const { value, done } = await reader.read();
          if (done || this._readLoopAborted) break;
          if (value !== undefined && value.length > 0) {
            this._receiveCallback?.(value);
          }
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (this._readLoopAborted) {
          // close() was called concurrently – normal exit path.
          break;
        }

        this._errorCallback?.(error);

        if (NON_FATAL_ERROR_NAMES.has(error.name)) {
          // Transient hardware error: fall through to releaseLock and retry.
        } else {
          // Fatal error: full teardown.
          await this._fatalCleanup();
          return;
        }
      } finally {
        this._releaseReader();
      }
    }
  }

  /** Cancels the current reader (if any) and waits for it to settle. */
  private async _cancelReader(): Promise<void> {
    if (!this._reader) return;
    try {
      await this._reader.cancel();
    } catch {
      // Ignore – may already be in a done state.
    }
    this._releaseReader();
  }

  /** Releases the reader lock without cancelling. */
  private _releaseReader(): void {
    if (!this._reader) return;
    try {
      this._reader.releaseLock();
    } catch {
      // Already released.
    }
    this._reader = null;
  }

  /**
   * Called on a fatal receive error.
   * Tears down all resources without firing onDisconnect (that is for
   * physical disconnects only); the error has already been delivered
   * via onError.
   */
  private async _fatalCleanup(): Promise<void> {
    this._readLoopAborted = true;
    this._isOpen = false;
    this._releaseReader();
    try {
      await this._nativePort.close();
    } catch {
      // Ignore.
    }
    navigator.serial.removeEventListener('disconnect', this._onSerialDisconnect);
  }

  /**
   * Called when the navigator.serial 'disconnect' event fires for this
   * specific port.  The read loop will be aborting on its own (reader
   * will return done=true), so only bookkeeping is needed here.
   */
  private async _handleDeviceDisconnect(): Promise<void> {
    if (!this._isOpen) return;

    this._readLoopAborted = true;
    this._isOpen = false;

    // Do not await _cancelReader here: the stream is already done.
    this._releaseReader();

    navigator.serial.removeEventListener('disconnect', this._onSerialDisconnect);

    this._disconnectCallback?.();
  }
}
