/**
 * ISerialPort - Abstract serial port interface
 *
 * Defines the contract that the infrastructure adapter
 * (WebSerialPort) must fulfil.  Application-layer services depend
 * only on this interface, never on the concrete adapter, keeping
 * the dependency direction correct (Domain ← Application ← Infrastructure).
 */

import type { SerialConfig } from '../models/SerialConfig.js';

/** Subset of USB port metadata exposed by the Web Serial API. */
export interface PortInfo {
  readonly usbVendorId?: number;
  readonly usbProductId?: number;
}

export interface ISerialPort {
  /**
   * Opens the port with the supplied configuration.
   * Starts the internal receive loop after the port is open.
   * Rejects if the port is already open or the OS denies access.
   */
  open(config: SerialConfig): Promise<void>;

  /**
   * Closes the port gracefully:
   * cancel reader → releaseLock → port.close().
   * Resolves even if the port was already closed.
   */
  close(): Promise<void>;

  /**
   * Sends raw bytes over the port.
   * Acquires a writer, writes the data, then immediately releases
   * the lock so subsequent writes are not blocked.
   * Rejects if the port is not open.
   */
  write(data: Uint8Array): Promise<void>;

  /**
   * Registers a callback invoked for every received data chunk.
   * Replaces any previously registered callback.
   */
  onReceive(callback: (data: Uint8Array) => void): void;

  /**
   * Registers a callback invoked when a non-fatal or fatal receive
   * error occurs.  The adapter decides whether to retry or close.
   */
  onError(callback: (error: Error) => void): void;

  /**
   * Registers a callback invoked when the physical device is
   * disconnected (navigator.serial 'disconnect' event).
   */
  onDisconnect(callback: () => void): void;

  /** True when the port is currently open and the receive loop is running. */
  readonly isOpen: boolean;

  /**
   * USB vendor / product IDs of the connected device, or null if
   * the port is not open or the information is unavailable.
   */
  readonly portInfo: PortInfo | null;
}
