/**
 * SendMessage - Sent message entity
 *
 * Represents a single outbound transmission including the original
 * input, the encoded bytes (with any appended line ending), and
 * metadata for the history panel.
 */

export type InputFormat = 'text' | 'hex';
export type LineEnding = 'none' | 'cr' | 'lf' | 'crlf';

/** Byte sequences appended for each LineEnding option. */
export const LINE_ENDING_BYTES: Readonly<Record<LineEnding, Uint8Array>> = {
  none: new Uint8Array(0),
  cr:   new Uint8Array([0x0d]),
  lf:   new Uint8Array([0x0a]),
  crlf: new Uint8Array([0x0d, 0x0a]),
} as const;

export interface SendMessage {
  /** Unique identifier (timestamp + counter based). */
  readonly id: string;
  /** Wall-clock time at which the message was sent. */
  readonly timestamp: Date;
  /** Encoded bytes including any appended line ending. */
  readonly data: Uint8Array;
  /** Original input format chosen by the user. */
  readonly inputFormat: InputFormat;
  /** Original input string as typed by the user. */
  readonly inputText: string;
  /** Line ending appended during encoding. */
  readonly lineEnding: LineEnding;
}

// Monotonically increasing counter to guarantee unique IDs within
// a session even when two messages are created at the same millisecond.
let _counter = 0;

/**
 * Generates a unique, sortable message ID.
 * Format: `<timestamp_ms>-<counter>` (e.g. "1711609200000-0")
 */
export function generateMessageId(): string {
  return `${Date.now()}-${_counter++}`;
}

/**
 * Constructs a SendMessage entity.
 *
 * @param inputText  Raw string as entered by the user.
 * @param inputFormat Whether the input was plain text or hex.
 * @param data       Fully encoded bytes (including line ending).
 * @param lineEnding Line ending that was appended.
 */
export function createSendMessage(
  inputText: string,
  inputFormat: InputFormat,
  data: Uint8Array,
  lineEnding: LineEnding
): SendMessage {
  return {
    id: generateMessageId(),
    timestamp: new Date(),
    data,
    inputFormat,
    inputText,
    lineEnding,
  };
}
