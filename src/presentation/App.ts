/**
 * App - Root component: wires services ↔ EventBus ↔ UI components
 *
 * Responsibilities:
 *   - Creates and owns all service and component instances
 *   - Builds the full-page DOM layout (header → connection → receive → send → history)
 *   - Bridges ConnectionService/SendService/ReceiveService events to EventBus
 *   - Delegates UI callbacks to the appropriate service methods
 *
 * Layout (matches spec §5.1):
 *   ┌─ header (StatusBar) ─────────────────────────────────┐
 *   ├─ ConnectionPanel ────────────────────────────────────┤
 *   ├─ ReceivePanel (flex: 1, text + hex split) ──────────┤
 *   ├─ SendPanel ──────────────────────────────────────────┤
 *   └─ SendHistoryList (collapsible) ─────────────────────┘
 */

import { EventBus } from './EventBus.js';
import { StatusBar } from './components/StatusBar.js';
import { ConnectionPanel } from './components/ConnectionPanel.js';
import { ReceivePanel } from './components/ReceivePanel.js';
import { SendPanel } from './components/SendPanel.js';
import { SendHistoryList } from './components/SendHistoryList.js';

import { ConnectionService } from '../application/ConnectionService.js';
import { SendService } from '../application/SendService.js';
import { ReceiveService } from '../application/ReceiveService.js';

export class App {
  private readonly root: HTMLElement;

  // Services
  private readonly bus = new EventBus();
  private readonly connectionService = new ConnectionService();
  private readonly sendService = new SendService();
  private readonly receiveService = new ReceiveService();

  // UI Components
  private readonly statusBar: StatusBar;
  private readonly connectionPanel: ConnectionPanel;
  private readonly receivePanel: ReceivePanel;
  private readonly sendPanel: SendPanel;
  private readonly historyList: SendHistoryList;

  constructor(root: HTMLElement) {
    this.root = root;

    // ---- Instantiate UI components (all take EventBus) ----
    this.statusBar = new StatusBar(this.bus);
    this.connectionPanel = new ConnectionPanel(this.bus);
    this.receivePanel = new ReceivePanel(this.bus);
    this.sendPanel = new SendPanel(this.bus);
    this.historyList = new SendHistoryList(this.bus);

    // ---- Wire service → EventBus bridges ----
    this._wireConnectionService();
    this._wireReceiveService();

    // ---- Wire UI callbacks → service calls ----
    this._wireConnectionPanel();
    this._wireSendPanel();
    this._wireHistoryList();

    // ---- Wire EventBus → service calls (pause/resume/clear) ----
    this._wireReceiveEvents();
  }

  /** Builds DOM layout and mounts all components. */
  mount(): void {
    this.root.textContent = '';

    const main = document.createElement('main');
    main.className = 'app-main';

    this.statusBar.mount(this.root);        // header (outside main)
    this.connectionPanel.mount(main);
    this.receivePanel.mount(main);
    this.sendPanel.mount(main);
    this.historyList.mount(main);

    this.root.appendChild(main);
  }

  // ==================================================================
  //  Service → EventBus bridges
  // ==================================================================

  private _wireConnectionService(): void {
    this.connectionService.onStateChange((state, error) => {
      // Forward to EventBus so all components react
      // Build payload conditionally to satisfy exactOptionalPropertyTypes
      const port = this.connectionService.getPort();
      const portInfo = port?.portInfo ?? null;

      const payload: Record<string, unknown> = { state };
      if (error) payload['error'] = error;
      if (state === 'connected' && portInfo) payload['portInfo'] = portInfo;

      this.bus.emit(
        'connection:stateChanged',
        payload as { state: typeof state; error?: Error; portInfo?: import('../domain/interfaces/ISerialPort.js').PortInfo | null },
      );

      // Inject / detach port into Send & Receive services
      if (state === 'connected') {
        if (port) {
          this.sendService.setPort(port);
          this.receiveService.setPort(port);
        }
      } else {
        this.sendService.setPort(null);
        this.receiveService.clearPort();
      }
    });
  }

  private _wireReceiveService(): void {
    this.receiveService.onData((chunk) => {
      this.bus.emit('serial:dataReceived', { chunk });
    });
  }

  // ==================================================================
  //  UI callbacks → Service calls
  // ==================================================================

  private _wireConnectionPanel(): void {
    this.connectionPanel.setCallbacks({
      onRequestPort: () => {
        // Must be called inside a user gesture (click) for requestPort()
        void this.connectionService.requestPort().catch((err: unknown) => {
          console.error('[App] requestPort failed:', err);
        });
      },

      onConnect: (config) => {
        void this.connectionService.connect(config).catch((err: unknown) => {
          console.error('[App] connect failed:', err);
        });
      },

      onDisconnect: () => {
        void this.connectionService.disconnect();
      },
    });
  }

  private _wireSendPanel(): void {
    this.sendPanel.setCallbacks({
      onSend: (text, format, lineEnding) => {
        void this.sendService
          .send(text, format, lineEnding)
          .then((message) => {
            this.bus.emit('serial:dataSent', { message });
          })
          .catch((err: unknown) => {
            const error = err instanceof Error ? err : new Error(String(err));
            this.bus.emit('serial:error', { error });
            console.error('[App] send failed:', error);
          });
      },
    });
  }

  private _wireHistoryList(): void {
    this.historyList.setCallbacks({
      onResend: (text, format) => {
        this.sendPanel.setInput(text, format);
      },
      onClear: () => {
        this.sendService.clearHistory();
      },
    });
  }

  // ==================================================================
  //  EventBus → Service calls (UI-initiated actions)
  // ==================================================================

  private _wireReceiveEvents(): void {
    this.bus.on('ui:pauseReceive', () => {
      this.receiveService.pause();
    });

    this.bus.on('ui:resumeReceive', () => {
      this.receiveService.resume();
    });

    this.bus.on('ui:clearReceiveBuffer', () => {
      this.receiveService.clearBuffer();
    });
  }
}
