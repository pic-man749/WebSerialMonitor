/**
 * SendHistoryList - Collapsible panel showing previously sent messages
 *
 * Displays each entry with timestamp, text/hex representation, and
 * byte count.  Clicking an entry fires the resend callback so the
 * SendPanel can be pre-filled for quick re-transmission.
 */

import type { EventBus } from '../EventBus.js';
import type { SendMessage, InputFormat } from '../../domain/models/SendMessage.js';

export interface SendHistoryCallbacks {
  onResend: (text: string, format: InputFormat) => void;
  onClear: () => void;
}

export class SendHistoryList {
  private readonly el: HTMLElement;
  private readonly listEl: HTMLDivElement;
  private readonly toggleBtn: HTMLButtonElement;
  private readonly clearBtn: HTMLButtonElement;
  private expanded = true;
  private callbacks: SendHistoryCallbacks | null = null;

  constructor(private readonly bus: EventBus) {
    this.el = document.createElement('section');
    this.el.className = 'panel send-history';
    this.el.setAttribute('aria-label', '送信履歴');

    // Header
    const header = document.createElement('div');
    header.className = 'panel__header';

    this.toggleBtn = document.createElement('button');
    this.toggleBtn.className = 'btn btn--icon send-history__toggle';
    this.toggleBtn.type = 'button';
    this.toggleBtn.setAttribute('aria-expanded', 'true');
    this.toggleBtn.textContent = '▼';
    this.toggleBtn.addEventListener('click', () => this._toggleExpanded());

    const title = document.createElement('span');
    title.className = 'panel__title';
    title.textContent = '送信履歴';

    const left = document.createElement('div');
    left.className = 'panel__actions';
    left.style.marginRight = 'auto';
    left.append(this.toggleBtn, title);

    this.clearBtn = document.createElement('button');
    this.clearBtn.className = 'btn btn--ghost';
    this.clearBtn.type = 'button';
    this.clearBtn.textContent = '🗑 クリア';
    this.clearBtn.setAttribute('aria-label', '送信履歴をクリア');
    this.clearBtn.addEventListener('click', () => this._clear());

    header.append(left, this.clearBtn);

    // Scrollable list
    this.listEl = document.createElement('div');
    this.listEl.className = 'send-history__list';
    this.listEl.setAttribute('role', 'list');
    this.listEl.setAttribute('aria-label', '送信履歴一覧');

    this.el.append(header, this.listEl);

    // Subscribe
    this.bus.on('serial:dataSent', ({ message }) => {
      this.addEntry(message);
    });
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  setCallbacks(cb: SendHistoryCallbacks): void {
    this.callbacks = cb;
  }

  addEntry(msg: SendMessage): void {
    const row = document.createElement('div');
    row.className = 'send-history__entry';
    row.setAttribute('role', 'listitem');
    row.setAttribute('tabindex', '0');

    // Timestamp
    const ts = document.createElement('span');
    ts.className = 'send-history__ts monospace';
    ts.textContent = this._formatTime(msg.timestamp);

    // Text content
    const text = document.createElement('span');
    text.className = 'send-history__text monospace';
    text.textContent = `"${msg.inputText}"`;

    // Hex
    const hex = document.createElement('span');
    hex.className = 'send-history__hex monospace';
    hex.textContent = this._toHex(msg.data);

    // Byte count
    const bytes = document.createElement('span');
    bytes.className = 'send-history__bytes';
    bytes.textContent = `${msg.data.length} B`;

    row.append(ts, text, hex, bytes);

    row.addEventListener('click', () => {
      this.callbacks?.onResend(msg.inputText, msg.inputFormat);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.callbacks?.onResend(msg.inputText, msg.inputFormat);
      }
    });

    this.listEl.appendChild(row);
    this.listEl.scrollTop = this.listEl.scrollHeight;
  }

  // ---- Private ---------------------------------------------------------

  private _toggleExpanded(): void {
    this.expanded = !this.expanded;
    this.listEl.hidden = !this.expanded;
    this.toggleBtn.textContent = this.expanded ? '▼' : '▶';
    this.toggleBtn.setAttribute('aria-expanded', String(this.expanded));
  }

  private _clear(): void {
    this.listEl.textContent = '';
    this.callbacks?.onClear();
  }

  private _formatTime(d: Date): string {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const pad3 = (n: number) => String(n).padStart(3, '0');
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
  }

  private _toHex(data: Uint8Array): string {
    const parts: string[] = [];
    const limit = Math.min(data.length, 32); // truncate display
    for (let i = 0; i < limit; i++) {
      parts.push(data[i]!.toString(16).padStart(2, '0').toUpperCase());
    }
    return `[${parts.join(' ')}${data.length > 32 ? ' …' : ''}]`;
  }
}
