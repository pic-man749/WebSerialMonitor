/**
 * SendService - Outbound data transmission use case
 *
 * Responsibilities:
 *   - Encode plain text (TextEncoder / UTF-8) or a hex string to Uint8Array
 *   - Append the selected line ending
 *   - Write the bytes to the active serial port
 *   - Maintain a capped history of sent messages (max 1,000)
 *
 * The active port is injected by App.ts whenever the connection state
 * changes; this service itself has no knowledge of WebSerialPort.
 */

import type { ISerialPort } from '../domain/interfaces/ISerialPort.js';
import {
  type InputFormat,
  type LineEnding,
  type SendMessage,
  LINE_ENDING_BYTES,
  createSendMessage,
} from '../domain/models/SendMessage.js';

const MAX_HISTORY = 1_000;

/** Pattern that allows only hex digits and whitespace. */
const HEX_VALID_PATTERN = /^[0-9a-fA-F\s]*$/;

export class HexParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HexParseError';
  }
}

export class SendService {
  private _port: ISerialPort | null = null;
  private readonly _history: SendMessage[] = [];
  private readonly _encoder = new TextEncoder();

  // ---- Port injection --------------------------------------------------

  /** Called by App.ts when a port opens or closes. */
  setPort(port: ISerialPort | null): void {
    this._port = port;
  }

  // ---- Send ------------------------------------------------------------

  /**
   * Encodes `inputText`, appends the chosen line ending, writes to the
   * port, and records the message in the send history.
   *
   * @throws {Error}         if the port is not open
   * @throws {HexParseError} if `format` is 'hex' and `inputText` is invalid
   */
  async send(
    inputText: string,
    format: InputFormat,
    lineEnding: LineEnding
  ): Promise<SendMessage> {
    if (!this._port) {
      throw new Error('SendService: not connected.');
    }

    const payload =
      format === 'hex'
        ? this._encodeHex(inputText, lineEnding)
        : this._encodeText(inputText, lineEnding);

    await this._port.write(payload);

    const message = createSendMessage(inputText, format, payload, lineEnding);
    this._pushHistory(message);
    return message;
  }

  // ---- History ---------------------------------------------------------

  getHistory(): readonly SendMessage[] {
    return this._history;
  }

  clearHistory(): void {
    this._history.length = 0;
  }

  // ---- Private encoding -----------------------------------------------

  private _encodeText(text: string, lineEnding: LineEnding): Uint8Array {
    const body = this._encoder.encode(text);
    return this._concat(body, LINE_ENDING_BYTES[lineEnding]);
  }

  /**
   * Parses a whitespace-separated hex string (e.g. "48 65 6C 6C 6F")
   * or a compact hex string (e.g. "48656C6C6F") into bytes.
   *
   * Validation rules:
   *   - Only characters [0-9 a-f A-F] and whitespace are allowed
   *   - After stripping whitespace the number of hex digits must be even
   */
  private _encodeHex(input: string, lineEnding: LineEnding): Uint8Array {
    if (!HEX_VALID_PATTERN.test(input)) {
      throw new HexParseError(
        'HEX入力に使用できるのは 0–9, a–f, A–F とスペースのみです。'
      );
    }

    const clean = input.replace(/\s+/g, '');

    if (clean.length === 0) {
      return LINE_ENDING_BYTES[lineEnding].slice();
    }

    if (clean.length % 2 !== 0) {
      throw new HexParseError(
        'HEX入力は2桁単位で指定してください（桁数が奇数です）。'
      );
    }

    const body = new Uint8Array(clean.length / 2);
    for (let i = 0; i < body.length; i++) {
      body[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }

    return this._concat(body, LINE_ENDING_BYTES[lineEnding]);
  }

  private _concat(a: Uint8Array, b: Uint8Array): Uint8Array {
    if (b.length === 0) return a;
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  private _pushHistory(message: SendMessage): void {
    this._history.push(message);
    if (this._history.length > MAX_HISTORY) {
      this._history.shift();
    }
  }
}
