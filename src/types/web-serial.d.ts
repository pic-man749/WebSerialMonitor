/**
 * Web Serial API type declarations
 *
 * TypeScript's lib.dom.d.ts does not yet bundle the Web Serial API.
 * These declarations match the W3C specification:
 * https://wicg.github.io/serial/
 */

// ---- Primitive types ------------------------------------------------

type ParityType = 'none' | 'even' | 'odd';
type FlowControlType = 'none' | 'hardware';

// ---- Configuration / filter types ----------------------------------

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: ParityType;
  bufferSize?: number;
  flowControl?: FlowControlType;
}

// ---- SerialPortInfo ------------------------------------------------

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

// ---- SerialPort ----------------------------------------------------

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;

  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
  forget(): Promise<void>;
}

// ---- SerialConnectionEvent -----------------------------------------

interface SerialConnectionEvent extends Event {
  readonly port: SerialPort;
}

// ---- Serial --------------------------------------------------------

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;

  onconnect: ((this: Serial, event: SerialConnectionEvent) => void) | null;
  ondisconnect: ((this: Serial, event: SerialConnectionEvent) => void) | null;
}

// ---- Navigator extension -------------------------------------------

interface Navigator {
  readonly serial: Serial;
}
