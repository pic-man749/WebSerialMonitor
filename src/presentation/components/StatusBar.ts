/**
 * StatusBar - Connection status indicator component
 *
 * Renders the application title and a live connection-state badge
 * in the header bar.  Subscribes to 'connection:stateChanged' via
 * EventBus to keep itself in sync.
 */

import type { EventBus } from '../EventBus.js';
import type { ConnectionState } from '../../application/ConnectionService.js';
import type { PortInfo } from '../../domain/interfaces/ISerialPort.js';

export class StatusBar {
  private readonly el: HTMLElement;
  private readonly indicatorEl: HTMLSpanElement;
  private readonly labelEl: HTMLSpanElement;
  private readonly detailEl: HTMLSpanElement;

  constructor(private readonly bus: EventBus) {
    this.el = document.createElement('header');
    this.el.className = 'app-header';

    // App title
    const title = document.createElement('h1');
    title.className = 'app-header__title';
    title.textContent = 'WebSerialMonitor';

    // Status section
    const status = document.createElement('div');
    status.className = 'status-bar';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    this.indicatorEl = document.createElement('span');
    this.indicatorEl.className = 'status-bar__indicator status-bar__indicator--disconnected';

    this.labelEl = document.createElement('span');
    this.labelEl.className = 'status-bar__label';
    this.labelEl.textContent = '未接続';

    this.detailEl = document.createElement('span');
    this.detailEl.className = 'status-bar__detail';

    status.append(this.indicatorEl, this.labelEl, this.detailEl);
    this.el.append(title, status);

    this.bus.on('connection:stateChanged', ({ state, error, portInfo }) => {
      this.update(state, error, portInfo);
    });
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  update(state: ConnectionState, error?: Error, portInfo?: PortInfo | null): void {
    // Reset modifier classes
    this.indicatorEl.className = 'status-bar__indicator';

    switch (state) {
      case 'disconnected':
        this.indicatorEl.classList.add('status-bar__indicator--disconnected');
        this.labelEl.textContent = '未接続';
        this.detailEl.textContent = '';
        break;
      case 'connected': {
        this.indicatorEl.classList.add('status-bar__indicator--connected');
        this.labelEl.textContent = '接続中';
        this.detailEl.textContent = this._formatPortInfo(portInfo);
        break;
      }
      case 'error':
        this.indicatorEl.classList.add('status-bar__indicator--error');
        this.labelEl.textContent = 'エラー';
        this.detailEl.textContent = error?.message ?? '';
        break;
    }
  }

  private _formatPortInfo(info?: PortInfo | null): string {
    if (!info) return '';
    const parts: string[] = [];
    if (info.usbVendorId !== undefined) {
      parts.push(`VID: 0x${info.usbVendorId.toString(16).padStart(4, '0').toUpperCase()}`);
    }
    if (info.usbProductId !== undefined) {
      parts.push(`PID: 0x${info.usbProductId.toString(16).padStart(4, '0').toUpperCase()}`);
    }
    return parts.length > 0 ? `(${parts.join(', ')})` : '';
  }
}
