/**
 * ReceivePanel - Dual-pane receive data viewer
 *
 * Left pane:  Text view   – byte-level rendering with escape colouring
 * Right pane: HEXDump view – address + hex + ASCII, virtual-scrolled
 *
 * Features:
 *   - Resizable split (drag-handle, default 50:50)
 *   - Auto-scroll that pauses when user scrolls up, resumes at bottom
 *   - Pause / Resume / Clear buttons
 *   - Text selection & clipboard copy
 */

import type { EventBus } from '../EventBus.js';

// ---- Constants --------------------------------------------------------

const BYTES_PER_ROW = 16;
const HEX_ROW_HEIGHT = 20;            // px — must match CSS line-height
const MIN_PANE_PERCENT = 15;           // minimum pane width %

// ---- ReceivePanel -----------------------------------------------------

export class ReceivePanel {
  private readonly el: HTMLElement;

  // Sub-elements
  private readonly textView: HTMLPreElement;
  private readonly hexContainer: HTMLDivElement;
  private readonly hexContent: HTMLDivElement;
  private readonly resizeHandle: HTMLDivElement;
  private readonly leftPane: HTMLDivElement;
  private readonly rightPane: HTMLDivElement;
  private readonly pauseBtn: HTMLButtonElement;

  // State
  private buffer: Uint8Array = new Uint8Array(0);
  private leftRatio = 0.5;
  private isPaused = false;
  private textAutoScroll = true;
  private hexAutoScroll = true;

  constructor(private readonly bus: EventBus) {
    this.el = document.createElement('section');
    this.el.className = 'panel receive-panel';
    this.el.setAttribute('aria-label', '受信データ');

    // Header
    const header = document.createElement('div');
    header.className = 'panel__header';

    const title = document.createElement('span');
    title.className = 'panel__title';
    title.textContent = '受信';

    const actions = document.createElement('div');
    actions.className = 'panel__actions';

    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'btn btn--ghost';
    this.pauseBtn.type = 'button';
    this.pauseBtn.textContent = '⏸ 一時停止';
    this.pauseBtn.setAttribute('aria-label', '受信データの一時停止');
    this.pauseBtn.addEventListener('click', () => this._togglePause());

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn--ghost';
    clearBtn.type = 'button';
    clearBtn.textContent = '🗑 クリア';
    clearBtn.setAttribute('aria-label', '受信データをクリア');
    clearBtn.addEventListener('click', () => this.bus.emit('ui:clearReceiveBuffer'));

    actions.append(this.pauseBtn, clearBtn);
    header.append(title, actions);

    // Body (split panes)
    const body = document.createElement('div');
    body.className = 'receive-panel__body';

    // Left: text view
    this.leftPane = document.createElement('div');
    this.leftPane.className = 'receive-panel__pane receive-panel__pane--text';
    this.textView = document.createElement('pre');
    this.textView.className = 'receive-panel__text-view monospace';
    this.textView.setAttribute('tabindex', '0');
    this.textView.setAttribute('aria-label', 'テキストビュー');
    this.leftPane.appendChild(this.textView);

    // Resize handle
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'receive-panel__resize-handle';
    this.resizeHandle.setAttribute('role', 'separator');
    this.resizeHandle.setAttribute('aria-orientation', 'vertical');
    this.resizeHandle.setAttribute('aria-label', 'テキストビューとHEXビューの幅を調整');
    this.resizeHandle.setAttribute('tabindex', '0');
    this.resizeHandle.setAttribute('aria-valuenow', '50');
    this._initResize();

    // Right: hex dump view (virtual-scrolled)
    this.rightPane = document.createElement('div');
    this.rightPane.className = 'receive-panel__pane receive-panel__pane--hex';

    // Column address header
    const hexHeader = document.createElement('div');
    hexHeader.className = 'receive-panel__hex-header monospace';
    const addrPlaceholder = document.createElement('span');
    addrPlaceholder.className = 'receive-panel__hex-addr';
    addrPlaceholder.textContent = '        ';
    const colNumbers: string[] = [];
    for (let c = 0; c < BYTES_PER_ROW; c++) {
      colNumbers.push(c.toString(16).padStart(2, '0').toUpperCase());
      if (c === 7) colNumbers.push('');
    }
    const colSpan = document.createElement('span');
    colSpan.className = 'receive-panel__hex-bytes';
    colSpan.textContent = colNumbers.join(' ');
    const asciiLabel = document.createElement('span');
    asciiLabel.className = 'receive-panel__hex-ascii';
    asciiLabel.textContent = 'ASCII';
    hexHeader.append(addrPlaceholder, colSpan, asciiLabel);

    this.hexContainer = document.createElement('div');
    this.hexContainer.className = 'receive-panel__hex-container monospace';
    this.hexContent = document.createElement('div');
    this.hexContent.className = 'receive-panel__hex-content';
    this.hexContainer.appendChild(this.hexContent);
    this.rightPane.append(hexHeader, this.hexContainer);

    body.append(this.leftPane, this.resizeHandle, this.rightPane);
    this.el.append(header, body);

    this._applySplitRatio();

    // Auto-scroll watchers
    this.leftPane.addEventListener('scroll', () => {
      this.textAutoScroll = this._isAtBottom(this.leftPane);
    });
    this.hexContainer.addEventListener('scroll', () => {
      this.hexAutoScroll = this._isAtBottom(this.hexContainer);
      this._renderHexVirtual();
    });

    // EventBus hooks
    this.bus.on('serial:dataReceived', ({ chunk }) => {
      this.appendData(chunk.data);
    });
    this.bus.on('ui:clearReceiveBuffer', () => this.clear());
    this.bus.on('ui:pauseReceive', () => this._setPaused(true));
    this.bus.on('ui:resumeReceive', () => this._setPaused(false));
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  // ---- Public API ------------------------------------------------------

  appendData(data: Uint8Array): void {
    if (this.isPaused) return;
    const merged = new Uint8Array(this.buffer.length + data.length);
    merged.set(this.buffer, 0);
    merged.set(data, this.buffer.length);
    this.buffer = merged;
    this._renderTextView(data);
    this._renderHexVirtual();
  }

  setBuffer(buf: Uint8Array): void {
    this.buffer = buf;
    this._rebuildTextView();
    this._renderHexVirtual();
  }

  clear(): void {
    this.buffer = new Uint8Array(0);
    this.textView.textContent = '';
    this.hexContent.textContent = '';
    this.hexContent.style.height = '0px';
  }

  // ---- Text view -------------------------------------------------------

  /**
   * Incrementally append new bytes to the text view.
   * Non-printable bytes are rendered as <span class="escape">\xHH</span>.
   */
  private _renderTextView(data: Uint8Array): void {
    const frag = document.createDocumentFragment();
    let pending = '';

    const flushPlain = () => {
      if (pending.length > 0) {
        frag.appendChild(document.createTextNode(pending));
        pending = '';
      }
    };

    for (let i = 0; i < data.length; i++) {
      const b = data[i]!;
      if (b === 0x09 || b === 0x0a) {
        // Tab or LF: printable control
        pending += String.fromCharCode(b);
      } else if (b === 0x0d) {
        // CR: render as newline; absorb following LF to avoid double newline
        pending += '\n';
        if (i + 1 < data.length && data[i + 1] === 0x0a) {
          i++; // skip LF
        }
      } else if (b >= 0x20 && b <= 0x7e) {
        // Printable ASCII
        pending += String.fromCharCode(b);
      } else {
        // Non-printable: escape
        flushPlain();
        const span = document.createElement('span');
        span.className = 'receive-panel__escape';
        span.textContent = `\\x${b.toString(16).padStart(2, '0').toUpperCase()}`;
        frag.appendChild(span);
      }
    }
    flushPlain();

    this.textView.appendChild(frag);

    if (this.textAutoScroll) {
      this.leftPane.scrollTop = this.leftPane.scrollHeight;
    }
  }

  private _rebuildTextView(): void {
    this.textView.textContent = '';
    if (this.buffer.length > 0) {
      this._renderTextView(this.buffer);
    }
  }

  // ---- HEX dump view (virtual scroll) ----------------------------------

  private _renderHexVirtual(): void {
    const totalRows = Math.ceil(this.buffer.length / BYTES_PER_ROW);
    const totalHeight = totalRows * HEX_ROW_HEIGHT;
    this.hexContent.style.height = `${totalHeight}px`;

    const scrollTop = this.hexContainer.scrollTop;
    const viewHeight = this.hexContainer.clientHeight;

    const firstRow = Math.max(0, Math.floor(scrollTop / HEX_ROW_HEIGHT) - 2);
    const lastRow = Math.min(
      totalRows - 1,
      Math.ceil((scrollTop + viewHeight) / HEX_ROW_HEIGHT) + 2
    );

    // Clear prior rendered rows
    const existing = this.hexContent.querySelectorAll('.receive-panel__hex-row');
    for (const el of existing) el.remove();

    const frag = document.createDocumentFragment();
    for (let r = firstRow; r <= lastRow; r++) {
      frag.appendChild(this._createHexRow(r));
    }
    this.hexContent.appendChild(frag);

    if (this.hexAutoScroll) {
      this.hexContainer.scrollTop = this.hexContainer.scrollHeight;
    }
  }

  private _createHexRow(rowIndex: number): HTMLDivElement {
    const offset = rowIndex * BYTES_PER_ROW;
    const row = document.createElement('div');
    row.className = 'receive-panel__hex-row';
    row.style.position = 'absolute';
    row.style.top = `${rowIndex * HEX_ROW_HEIGHT}px`;
    row.style.height = `${HEX_ROW_HEIGHT}px`;

    // Address
    const addrSpan = document.createElement('span');
    addrSpan.className = 'receive-panel__hex-addr';
    addrSpan.textContent = offset.toString(16).padStart(8, '0').toUpperCase();

    // Hex bytes + ASCII
    const hexParts: string[] = [];
    let ascii = '';
    for (let c = 0; c < BYTES_PER_ROW; c++) {
      const idx = offset + c;
      if (idx < this.buffer.length) {
        const b = this.buffer[idx]!;
        hexParts.push(b.toString(16).padStart(2, '0').toUpperCase());
        ascii += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
      } else {
        hexParts.push('  ');
        ascii += ' ';
      }
      if (c === 7) hexParts.push('');  // extra gap at column 8
    }

    const hexSpan = document.createElement('span');
    hexSpan.className = 'receive-panel__hex-bytes';
    hexSpan.textContent = hexParts.join(' ');

    const asciiSpan = document.createElement('span');
    asciiSpan.className = 'receive-panel__hex-ascii';
    asciiSpan.textContent = ascii;

    row.append(addrSpan, hexSpan, asciiSpan);
    return row;
  }

  // ---- Resize handle ---------------------------------------------------

  private _initResize(): void {
    let startX = 0;
    let startRatio = 0;

    const onMove = (e: PointerEvent) => {
      const bodyRect = this.el.querySelector('.receive-panel__body')!.getBoundingClientRect();
      const dx = e.clientX - startX;
      const newRatio = startRatio + dx / bodyRect.width;
      this.leftRatio = Math.max(MIN_PANE_PERCENT / 100, Math.min(1 - MIN_PANE_PERCENT / 100, newRatio));
      this._applySplitRatio();
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    this.resizeHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startRatio = this.leftRatio;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });

    // Keyboard support for resize handle (Left/Right arrow keys)
    const STEP = 0.02;
    this.resizeHandle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const delta = e.key === 'ArrowLeft' ? -STEP : STEP;
        this.leftRatio = Math.max(
          MIN_PANE_PERCENT / 100,
          Math.min(1 - MIN_PANE_PERCENT / 100, this.leftRatio + delta)
        );
        this._applySplitRatio();
      }
    });
  }

  private _applySplitRatio(): void {
    const leftPct = (this.leftRatio * 100).toFixed(2);
    const rightPct = ((1 - this.leftRatio) * 100).toFixed(2);
    this.leftPane.style.width = `${leftPct}%`;
    this.rightPane.style.width = `${rightPct}%`;
    this.resizeHandle.setAttribute('aria-valuenow', String(Math.round(this.leftRatio * 100)));
  }

  // ---- Pause / resume --------------------------------------------------

  private _togglePause(): void {
    if (this.isPaused) {
      this.bus.emit('ui:resumeReceive');
    } else {
      this.bus.emit('ui:pauseReceive');
    }
  }

  private _setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.pauseBtn.textContent = paused ? '▶ 再開' : '⏸ 一時停止';
    this.pauseBtn.setAttribute('aria-label', paused ? '受信データの表示を再開' : '受信データの一時停止');
  }

  // ---- Helpers ---------------------------------------------------------

  private _isAtBottom(el: HTMLElement): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 2;
  }
}
