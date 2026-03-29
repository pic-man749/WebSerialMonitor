/**
 * SendPanel - Data transmission input component
 *
 * Renders a text/hex input toggle, line-ending selector, an input
 * area, and a Send button.  The actual encoding + writing is delegated
 * to SendService via the callbacks wired in App.ts.
 */

import type { EventBus } from '../EventBus.js';
import type { ConnectionState } from '../../application/ConnectionService.js';
import type { InputFormat, LineEnding } from '../../domain/models/SendMessage.js';
import { SettingsStore } from '../../infrastructure/SettingsStore.js';

interface SendSettings {
  format: InputFormat;
  lineEnding: string;
  clearAfterSend: boolean;
}

const SETTINGS_KEY = 'send';

export interface SendPanelCallbacks {
  onSend: (text: string, format: InputFormat, lineEnding: LineEnding) => void;
}

/** Matches only valid hex characters and whitespace. */
const HEX_PATTERN = /^[0-9a-fA-F\s]*$/;

export class SendPanel {
  private readonly el: HTMLElement;
  private readonly inputEl: HTMLTextAreaElement;
  private readonly formatToggle: HTMLButtonElement;
  private readonly lineEndingSelect: HTMLSelectElement;
  private readonly sendBtn: HTMLButtonElement;
  private readonly warningEl: HTMLSpanElement;
  private readonly clearCheckbox: HTMLInputElement;

  private format: InputFormat = 'text';
  private connected = false;
  private callbacks: SendPanelCallbacks | null = null;

  constructor(private readonly bus: EventBus) {
    this.el = document.createElement('section');
    this.el.className = 'panel send-panel';
    this.el.setAttribute('aria-label', '送信');

    // Header row
    const header = document.createElement('div');
    header.className = 'panel__header';

    const title = document.createElement('span');
    title.className = 'panel__title';
    title.textContent = '送信';

    const controls = document.createElement('div');
    controls.className = 'panel__actions';

    // Format toggle
    this.formatToggle = document.createElement('button');
    this.formatToggle.className = 'btn btn--ghost send-panel__format-btn';
    this.formatToggle.type = 'button';
    this.formatToggle.textContent = 'テキスト';
    this.formatToggle.addEventListener('click', () => this._toggleFormat());

    // Line ending select
    this.lineEndingSelect = document.createElement('select');
    this.lineEndingSelect.className = 'form-select';
    this.lineEndingSelect.id = 'send-line-ending';
    this.lineEndingSelect.setAttribute('aria-label', '改行コード');
    for (const [value, label] of [
      ['none', 'なし'],
      ['cr', 'CR'],
      ['lf', 'LF'],
      ['crlf', 'CR+LF'],
    ] as const) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      this.lineEndingSelect.appendChild(opt);
    }

    // Warning for invalid hex
    this.warningEl = document.createElement('span');
    this.warningEl.className = 'send-panel__warning';
    this.warningEl.hidden = true;

    controls.append(
      this._labeled('入力形式', this.formatToggle),
      this._labeled('改行コード', this.lineEndingSelect),
      this.warningEl,
    );
    header.append(title, controls);

    // Input row
    const inputRow = document.createElement('div');
    inputRow.className = 'send-panel__input-row';

    this.inputEl = document.createElement('textarea');
    this.inputEl.className = 'form-input send-panel__input monospace';
    this.inputEl.rows = 1;
    this.inputEl.placeholder = '送信データを入力…';
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._send();
      }
    });
    this.inputEl.addEventListener('input', () => this._validateInput());

    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'btn btn--primary send-panel__send-btn';
    this.sendBtn.type = 'button';
    this.sendBtn.textContent = '送信';
    this.sendBtn.disabled = true;
    this.sendBtn.addEventListener('click', () => this._send());

    // Clear-after-send checkbox
    const clearLabel = document.createElement('label');
    clearLabel.className = 'send-panel__clear-label';
    this.clearCheckbox = document.createElement('input');
    this.clearCheckbox.type = 'checkbox';
    this.clearCheckbox.checked = true;
    const clearText = document.createTextNode('送信後クリア');
    clearLabel.append(this.clearCheckbox, clearText);

    inputRow.append(this.inputEl, this.sendBtn, clearLabel);
    this.el.append(header, inputRow);

    // Auto-save settings on change
    const save = (): void => this._saveSettings();
    this.formatToggle.addEventListener('click', save);
    this.lineEndingSelect.addEventListener('change', save);
    this.clearCheckbox.addEventListener('change', save);

    // Restore persisted settings
    this._restoreSettings();

    // Connection state listener
    this.bus.on('connection:stateChanged', ({ state }) => {
      this._updateConnectionState(state);
    });
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  setCallbacks(cb: SendPanelCallbacks): void {
    this.callbacks = cb;
  }

  /** Pre-fill the input area (used by history click-to-resend). */
  setInput(text: string, format: InputFormat): void {
    if (format !== this.format) this._toggleFormat();
    this.inputEl.value = text;
    this._validateInput();
  }

  // ---- Private ---------------------------------------------------------

  private _send(): void {
    const text = this.inputEl.value;
    const lineEnding = this.lineEndingSelect.value as LineEnding;
    if (!this.connected) return;
    if (!text && lineEnding === 'none') return;
    this.callbacks?.onSend(text, this.format, lineEnding);
    if (this.clearCheckbox.checked) {
      this.inputEl.value = '';
      this.warningEl.hidden = true;
    }
  }

  private _toggleFormat(): void {
    this.format = this.format === 'text' ? 'hex' : 'text';
    this.formatToggle.textContent = this.format === 'text' ? 'テキスト' : 'HEX';
    this.formatToggle.classList.toggle('send-panel__format-btn--hex', this.format === 'hex');
    this.inputEl.placeholder = this.format === 'text' ? '送信データを入力…' : 'HEX: 48 65 6C 6C 6F';
    this._validateInput();
  }

  private _validateInput(): void {
    if (this.format === 'hex') {
      const valid = HEX_PATTERN.test(this.inputEl.value);
      this.inputEl.classList.toggle('is-invalid', !valid);
      this.warningEl.textContent = valid ? '' : '無効なHEX文字が含まれています';
      this.warningEl.hidden = valid;
    } else {
      this.inputEl.classList.remove('is-invalid');
      this.warningEl.hidden = true;
    }
  }

  private _updateConnectionState(state: ConnectionState): void {
    this.connected = state === 'connected';
    this.sendBtn.disabled = !this.connected;
    this.inputEl.disabled = !this.connected;
  }

  private _saveSettings(): void {
    const settings: SendSettings = {
      format: this.format,
      lineEnding: this.lineEndingSelect.value,
      clearAfterSend: this.clearCheckbox.checked,
    };
    SettingsStore.save(SETTINGS_KEY, settings);
  }

  private _restoreSettings(): void {
    const s = SettingsStore.load<SendSettings>(SETTINGS_KEY);
    if (!s) return;

    if (s.format !== this.format) this._toggleFormat();
    this.lineEndingSelect.value = s.lineEnding;
    this.clearCheckbox.checked = s.clearAfterSend;
  }

  private _labeled(text: string, control: HTMLElement): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'send-panel__field';

    const span = document.createElement('span');
    span.className = 'send-panel__field-label';
    span.textContent = text;

    wrapper.append(span, control);
    return wrapper;
  }
}
