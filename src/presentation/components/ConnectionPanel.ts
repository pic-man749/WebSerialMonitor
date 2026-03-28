/**
 * ConnectionPanel - Serial connection settings & action buttons
 *
 * Renders baud-rate (preset + custom), data bits, stop bits, parity,
 * flow-control selectors, and connect / disconnect buttons.
 *
 * The panel emits no EventBus events directly; instead it exposes
 * callback hooks that App.ts wires to the ConnectionService.
 */

import type { EventBus } from '../EventBus.js';
import type { ConnectionState } from '../../application/ConnectionService.js';
import {
  type SerialConfig,
  type DataBits,
  type StopBits,
  type Parity,
  type FlowControl,
  BAUD_RATE_PRESETS,
  DEFAULT_SERIAL_CONFIG,
} from '../../domain/models/SerialConfig.js';

export interface ConnectionPanelCallbacks {
  onRequestPort: () => void;
  onConnect: (config: SerialConfig) => void;
  onDisconnect: () => void;
}

export class ConnectionPanel {
  private readonly el: HTMLElement;

  private readonly baudSelect: HTMLSelectElement;
  private readonly baudCustom: HTMLInputElement;
  private readonly dataBitsSelect: HTMLSelectElement;
  private readonly stopBitsSelect: HTMLSelectElement;
  private readonly paritySelect: HTMLSelectElement;
  private readonly flowSelect: HTMLSelectElement;

  private readonly connectBtn: HTMLButtonElement;
  private readonly disconnectBtn: HTMLButtonElement;

  private callbacks: ConnectionPanelCallbacks | null = null;

  constructor(private readonly bus: EventBus) {
    this.el = document.createElement('section');
    this.el.className = 'panel connection-panel';
    this.el.setAttribute('aria-label', '接続設定');

    // -- Row --
    const row = document.createElement('div');
    row.className = 'connection-panel__row';

    // Port select button
    const portBtn = document.createElement('button');
    portBtn.className = 'btn btn--ghost connection-panel__port-btn';
    portBtn.textContent = 'ポート選択';
    portBtn.type = 'button';
    portBtn.addEventListener('click', () => this.callbacks?.onRequestPort());

    // Baud rate
    this.baudSelect = this._createSelect(
      'baud-rate',
      'ボーレート',
      [...BAUD_RATE_PRESETS.map(String), 'custom'],
      [...BAUD_RATE_PRESETS.map(String), 'カスタム'],
      String(DEFAULT_SERIAL_CONFIG.baudRate)
    );
    this.baudCustom = document.createElement('input');
    this.baudCustom.className = 'form-input connection-panel__baud-custom';
    this.baudCustom.type = 'number';
    this.baudCustom.min = '1';
    this.baudCustom.placeholder = 'カスタム値';
    this.baudCustom.hidden = true;
    this.baudSelect.addEventListener('change', () => {
      this.baudCustom.hidden = this.baudSelect.value !== 'custom';
    });

    // Data bits
    this.dataBitsSelect = this._createSelect(
      'data-bits', 'データビット',
      ['7', '8'], ['7', '8'],
      String(DEFAULT_SERIAL_CONFIG.dataBits)
    );

    // Stop bits
    this.stopBitsSelect = this._createSelect(
      'stop-bits', 'ストップビット',
      ['1', '2'], ['1', '2'],
      String(DEFAULT_SERIAL_CONFIG.stopBits)
    );

    // Parity
    this.paritySelect = this._createSelect(
      'parity', 'パリティ',
      ['none', 'even', 'odd'], ['none', 'even', 'odd'],
      DEFAULT_SERIAL_CONFIG.parity
    );

    // Flow control
    this.flowSelect = this._createSelect(
      'flow-control', 'フロー制御',
      ['none', 'hardware'], ['none', 'hardware'],
      DEFAULT_SERIAL_CONFIG.flowControl
    );

    // Buttons
    this.connectBtn = document.createElement('button');
    this.connectBtn.className = 'btn btn--success connection-panel__connect-btn';
    this.connectBtn.type = 'button';
    this.connectBtn.textContent = '接続';
    this.connectBtn.addEventListener('click', () => {
      this.callbacks?.onConnect(this.getConfig());
    });

    this.disconnectBtn = document.createElement('button');
    this.disconnectBtn.className = 'btn btn--danger connection-panel__disconnect-btn';
    this.disconnectBtn.type = 'button';
    this.disconnectBtn.textContent = '切断';
    this.disconnectBtn.disabled = true;
    this.disconnectBtn.addEventListener('click', () => {
      this.callbacks?.onDisconnect();
    });

    row.append(
      portBtn,
      this._labeled('ボーレート', this.baudSelect),
      this.baudCustom,
      this._labeled('データビット', this.dataBitsSelect),
      this._labeled('ストップビット', this.stopBitsSelect),
      this._labeled('パリティ', this.paritySelect),
      this._labeled('フロー制御', this.flowSelect),
      this.connectBtn,
      this.disconnectBtn
    );

    this.el.appendChild(row);

    // Listen for state changes
    this.bus.on('connection:stateChanged', ({ state }) => {
      this._updateButtonState(state);
    });
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  setCallbacks(cb: ConnectionPanelCallbacks): void {
    this.callbacks = cb;
  }

  getConfig(): SerialConfig {
    const baudRate =
      this.baudSelect.value === 'custom'
        ? parseInt(this.baudCustom.value, 10) || DEFAULT_SERIAL_CONFIG.baudRate
        : parseInt(this.baudSelect.value, 10);

    return {
      baudRate,
      dataBits: parseInt(this.dataBitsSelect.value, 10) as DataBits,
      stopBits: parseInt(this.stopBitsSelect.value, 10) as StopBits,
      parity: this.paritySelect.value as Parity,
      flowControl: this.flowSelect.value as FlowControl,
    };
  }

  // ---- Private ---------------------------------------------------------

  private _updateButtonState(state: ConnectionState): void {
    const connected = state === 'connected';
    this.connectBtn.disabled = connected;
    this.disconnectBtn.disabled = !connected;

    // Disable selectors while connected
    const selectors = [
      this.baudSelect, this.baudCustom,
      this.dataBitsSelect, this.stopBitsSelect,
      this.paritySelect, this.flowSelect,
    ];
    for (const s of selectors) s.disabled = connected;
  }

  private _createSelect(
    id: string,
    _label: string,
    values: string[],
    labels: string[],
    defaultValue: string
  ): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'form-select';
    select.id = `conn-${id}`;

    for (let i = 0; i < values.length; i++) {
      const opt = document.createElement('option');
      opt.value = values[i]!;
      opt.textContent = labels[i]!;
      if (values[i] === defaultValue) opt.selected = true;
      select.appendChild(opt);
    }
    return select;
  }

  private _labeled(text: string, control: HTMLElement): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'connection-panel__field';

    const span = document.createElement('span');
    span.className = 'connection-panel__field-label';
    span.textContent = text;

    wrapper.append(span, control);
    return wrapper;
  }
}
