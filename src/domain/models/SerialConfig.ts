/**
 * SerialConfig - Serial connection settings value object
 *
 * Represents immutable connection parameters.
 * All validation is performed at the boundary (UI layer); this
 * module provides the canonical type, defaults, and a lightweight
 * guard for programmatic construction.
 */

export type DataBits = 7 | 8;
export type StopBits = 1 | 2;
export type Parity = 'none' | 'even' | 'odd';
export type FlowControl = 'none' | 'hardware';

export interface SerialConfig {
  readonly baudRate: number;
  readonly dataBits: DataBits;
  readonly stopBits: StopBits;
  readonly parity: Parity;
  readonly flowControl: FlowControl;
}

/** Preset baud-rate options offered in the UI. */
export const BAUD_RATE_PRESETS = [
  300, 1200, 2400, 4800, 9600, 19200, 38400,
  57600, 115200, 230400, 460800, 921600,
] as const;

export const DEFAULT_SERIAL_CONFIG: SerialConfig = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
} as const;

export class SerialConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SerialConfigValidationError';
  }
}

/**
 * Validates a SerialConfig object and returns it unchanged if valid,
 * or throws SerialConfigValidationError if any value is out of range.
 */
export function validateSerialConfig(config: SerialConfig): SerialConfig {
  if (!Number.isInteger(config.baudRate) || config.baudRate <= 0) {
    throw new SerialConfigValidationError(
      `Invalid baudRate: ${config.baudRate}. Must be a positive integer.`
    );
  }
  if (config.dataBits !== 7 && config.dataBits !== 8) {
    throw new SerialConfigValidationError(
      `Invalid dataBits: ${config.dataBits}. Must be 7 or 8.`
    );
  }
  if (config.stopBits !== 1 && config.stopBits !== 2) {
    throw new SerialConfigValidationError(
      `Invalid stopBits: ${config.stopBits}. Must be 1 or 2.`
    );
  }
  if (!['none', 'even', 'odd'].includes(config.parity)) {
    throw new SerialConfigValidationError(
      `Invalid parity: "${config.parity}". Must be "none", "even", or "odd".`
    );
  }
  if (!['none', 'hardware'].includes(config.flowControl)) {
    throw new SerialConfigValidationError(
      `Invalid flowControl: "${config.flowControl}". Must be "none" or "hardware".`
    );
  }
  return config;
}

/**
 * Creates a validated SerialConfig by merging partial overrides
 * onto the default config.
 */
export function createSerialConfig(
  overrides: Partial<SerialConfig> = {}
): SerialConfig {
  const config: SerialConfig = { ...DEFAULT_SERIAL_CONFIG, ...overrides };
  return validateSerialConfig(config);
}
