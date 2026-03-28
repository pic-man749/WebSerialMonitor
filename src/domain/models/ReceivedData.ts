/**
 * ReceivedData - Received data chunk model
 *
 * Each chunk corresponds to a single read() result from the
 * Web Serial ReadableStream reader.  The presentation layer
 * accumulates chunks into a contiguous buffer; this type carries
 * only what is needed for display and history.
 */

export interface ReceivedChunk {
  /** Wall-clock time at which the chunk arrived. */
  readonly timestamp: Date;
  /** Raw bytes as returned by the serial port reader. */
  readonly data: Uint8Array;
}

/**
 * Creates a ReceivedChunk from a raw Uint8Array snapshot.
 *
 * A defensive copy of the array is made so that callers can safely
 * reuse or release their own buffer without corrupting stored chunks.
 */
export function createReceivedChunk(data: Uint8Array): ReceivedChunk {
  return {
    timestamp: new Date(),
    data: data.slice(),
  };
}
