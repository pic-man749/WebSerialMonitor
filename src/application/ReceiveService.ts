/**
 * ReceiveService - Inbound data management use case
 *
 * Responsibilities:
 *   - Registers itself as the receive callback on the active ISerialPort
 *   - Accumulates received bytes in an internal buffer (capped at 1 MB)
 *   - Delivers ReceivedChunk events to the UI via an onData callback
 *   - Supports pause / resume: while paused keeps buffering but queues
 *     chunks and flushes them in arrival order when resumed
 *
 * The active port is injected by App.ts on connection state changes.
 * ReceiveService has no dependency on WebSerialPort or ConnectionService.
 */

import type { ISerialPort } from '../domain/interfaces/ISerialPort.js';
import {
  type ReceivedChunk,
  createReceivedChunk,
} from '../domain/models/ReceivedData.js';

/** Hard cap on accumulated receive buffer bytes (1 MB). */
const MAX_BUFFER_BYTES = 1024 * 1024;

export class ReceiveService {
  private _port: ISerialPort | null = null;
  private _isPaused = false;

  /**
   * Raw byte chunks accumulated since the last clearBuffer().
   * Oldest chunks are evicted when the total exceeds MAX_BUFFER_BYTES.
   */
  private readonly _buffer: Uint8Array[] = [];
  private _totalBufferBytes = 0;

  /**
   * ReceivedChunk items queued while paused.
   * Drained in order when resume() is called.
   */
  private readonly _pauseQueue: ReceivedChunk[] = [];

  private _dataCallback: ((chunk: ReceivedChunk) => void) | null = null;

  // ---- Port injection --------------------------------------------------

  /**
   * Binds this service to an open port and registers the internal
   * receive handler.  Call once after connection is established.
   */
  setPort(port: ISerialPort): void {
    this._port = port;
    port.onReceive((data) => this._handleIncomingData(data));
  }

  /** Detaches from the current port. Call after disconnection. */
  clearPort(): void {
    this._port = null;
  }

  // ---- Callback registration ------------------------------------------

  /** Registers the consumer that receives data chunks from the port. */
  onData(callback: (chunk: ReceivedChunk) => void): void {
    this._dataCallback = callback;
  }

  // ---- Pause / resume --------------------------------------------------

  /** Suspends delivery to the onData callback while still accumulating. */
  pause(): void {
    this._isPaused = true;
  }

  /**
   * Resumes delivery.  All chunks queued during the pause are flushed
   * to the callback in arrival order before new chunks are delivered.
   */
  resume(): void {
    if (!this._isPaused) return;
    this._isPaused = false;

    for (const chunk of this._pauseQueue) {
      this._dataCallback?.(chunk);
    }
    this._pauseQueue.length = 0;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  // ---- Buffer ----------------------------------------------------------

  /**
   * Returns the entire accumulated buffer as a single contiguous
   * Uint8Array.  The returned array is a copy; callers may mutate it
   * without affecting internal state.
   */
  getBuffer(): Uint8Array {
    if (this._buffer.length === 0) return new Uint8Array(0);
    if (this._buffer.length === 1) return this._buffer[0]!.slice();

    const out = new Uint8Array(this._totalBufferBytes);
    let offset = 0;
    for (const chunk of this._buffer) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  /** Clears the accumulated buffer without affecting the pause state. */
  clearBuffer(): void {
    this._buffer.length = 0;
    this._totalBufferBytes = 0;
  }

  /** Total bytes currently held in the accumulation buffer. */
  get totalBytesBuffered(): number {
    return this._totalBufferBytes;
  }

  // ---- Private --------------------------------------------------------

  private _handleIncomingData(data: Uint8Array): void {
    // Store a defensive copy in the accumulation buffer.
    const copy = data.slice();
    this._buffer.push(copy);
    this._totalBufferBytes += copy.length;

    // Enforce 1 MB cap: evict oldest chunks until under the limit.
    while (this._totalBufferBytes > MAX_BUFFER_BYTES) {
      const dropped = this._buffer.shift();
      if (dropped === undefined) break;
      this._totalBufferBytes -= dropped.length;
    }

    // Create chunk and deliver (or queue if paused).
    const chunk = createReceivedChunk(data);
    if (this._isPaused) {
      this._pauseQueue.push(chunk);
    } else {
      this._dataCallback?.(chunk);
    }
  }
}
