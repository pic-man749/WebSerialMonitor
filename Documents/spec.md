# WebSerialMonitor 仕様書

## 1. プロジェクト概要

### 1.1 目的

WEBブラウザ上で動作するシリアル通信モニタリングツール。TeraTerm のようなシリアルターミナル機能を、バックエンドサーバなしのスタティックサイトとして提供する。

### 1.2 コア技術

| 項目 | 技術 |
|------|------|
| シリアル通信 | [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) |
| フロントエンドフレームワーク | なし（Vanilla JS + ES Modules） |
| スタイリング | CSS Custom Properties + BEM 命名規則 |
| ビルドツール | Vite（バンドル・開発サーバ） |
| 言語 | TypeScript |

### 1.3 対応ブラウザ

Web Serial API のサポート状況に基づく。

| ブラウザ | 対応バージョン |
|----------|----------------|
| Google Chrome | 89+ |
| Microsoft Edge | 89+ |
| Opera | 75+ |
| Firefox | 非対応 |
| Safari | 非対応 |

> **注記**: Web Serial API は Secure Context（HTTPS または localhost）でのみ動作する。

---

## 2. システム構成

### 2.1 全体構成図

```
┌─────────────────────────────────────────────────┐
│  Static Web Server (任意)                        │
│  - HTML / CSS / JS を配信するのみ                  │
│  - ロジックはすべてクライアント側で完結              │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────┐
│  Web Browser (Chrome / Edge)                     │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Presentation Layer (UI)                   │  │
│  │  - 接続パネル / 送信パネル / 受信パネル       │  │
│  └──────────────┬─────────────────────────────┘  │
│  ┌──────────────▼─────────────────────────────┐  │
│  │  Application Layer (Use Cases)             │  │
│  │  - 接続管理 / 送信処理 / 受信処理 / 履歴管理  │  │
│  └──────────────┬─────────────────────────────┘  │
│  ┌──────────────▼─────────────────────────────┐  │
│  │  Domain Layer (Models)                     │  │
│  │  - SerialConfig / Message / ReceivedData   │  │
│  └──────────────┬─────────────────────────────┘  │
│  ┌──────────────▼─────────────────────────────┐  │
│  │  Infrastructure Layer (Adapters)           │  │
│  │  - Web Serial API Adapter                  │  │
│  └──────────────┬─────────────────────────────┘  │
│                 │ Web Serial API                  │
└─────────────────┼────────────────────────────────┘
                  │
          ┌───────▼───────┐
          │  Serial Device │
          └───────────────┘
```

### 2.2 レイヤー構造

| レイヤー | 責務 | 依存方向 |
|----------|------|----------|
| **Presentation** | DOM操作、イベントハンドリング、UI状態管理 | → Application |
| **Application** | ユースケースの実行、レイヤー間の調整 | → Domain, → Infrastructure (Interface) |
| **Domain** | ビジネスモデル、値オブジェクト、ドメインロジック | 依存なし |
| **Infrastructure** | Web Serial API のラッパー、外部API との接続 | → Domain |

依存関係は一方向（上位→下位）とし、Infrastructure は Domain で定義されたインターフェースに依存する（依存性逆転の原則）。

---

## 3. ディレクトリ構成

```
WebSerialMonitor/
├── Documents/
│   └── spec.md                          # 本仕様書
├── index.html                           # エントリポイント
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts                          # アプリケーション初期化
    ├── domain/
    │   ├── models/
    │   │   ├── SerialConfig.ts          # シリアル接続設定の値オブジェクト
    │   │   ├── SendMessage.ts           # 送信メッセージモデル
    │   │   └── ReceivedData.ts          # 受信データモデル
    │   └── interfaces/
    │       └── ISerialPort.ts           # シリアルポート抽象インターフェース
    ├── application/
    │   ├── ConnectionService.ts         # 接続・切断のユースケース
    │   ├── SendService.ts              # 送信のユースケース
    │   └── ReceiveService.ts           # 受信のユースケース
    ├── infrastructure/
    │   ├── WebSerialPort.ts            # Web Serial API アダプター
    │   └── SettingsStore.ts            # localStorage 設定永続化
    ├── presentation/
    │   ├── components/
    │   │   ├── ConnectionPanel.ts      # 接続設定UI
    │   │   ├── SendPanel.ts            # 送信UI
    │   │   ├── ReceivePanel.ts         # 受信UI（テキスト/バイナリ切替）
    │   │   ├── SendHistoryList.ts      # 送信履歴UI
    │   │   └── StatusBar.ts            # 接続ステータス表示
    │   ├── App.ts                      # UIルート・コンポーネント統合
    │   └── EventBus.ts                 # コンポーネント間イベント通信
    └── styles/
        ├── main.css                    # グローバルスタイル・CSS変数定義
        ├── components/
        │   ├── connection-panel.css
        │   ├── send-panel.css
        │   ├── receive-panel.css
        │   ├── send-history.css
        │   └── status-bar.css
        └── themes/
            └── dark.css                # ダークテーマ（デフォルト）
```

---

## 4. 機能仕様

### 4.1 シリアル接続管理

#### 4.1.1 ポート選択

- 「ポート選択」ボタンをクリックすると、ブラウザ標準のシリアルポート選択ダイアログが表示される
- `navigator.serial.requestPort()` を使用し、ユーザージェスチャに基づいてポートを取得する
- 以前に許可されたポートは `navigator.serial.getPorts()` で取得し、再接続用に一覧表示する

#### 4.1.2 接続パラメータ

以下のパラメータをUIから設定可能とする。

| パラメータ | 選択肢 | デフォルト値 |
|------------|--------|-------------|
| ボーレート | 300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, カスタム入力 | 115200 |
| データビット | 7, 8 | 8 |
| ストップビット | 1, 2 | 1 |
| パリティ | none, even, odd | none |
| フロー制御 | none, hardware | none |

#### 4.1.3 接続状態管理

| 状態 | UI表示 | 操作 |
|------|--------|------|
| 未接続 | ステータスバーにグレー表示 | 接続ボタン有効 |
| 接続中 | ステータスバーに緑表示 + ポート情報表示 | 切断ボタン有効 |
| エラー | ステータスバーに赤表示 + エラーメッセージ | 再接続ボタン有効 |

#### 4.1.4 接続・切断シーケンス

**接続時:**
1. `navigator.serial.requestPort()` でポート取得（初回）または過去に許可されたポートを選択
2. `port.open({ baudRate, dataBits, stopBits, parity, flowControl })` でオープン
3. `port.readable.getReader()` で受信ループ開始
4. UI を接続状態に遷移

**切断時:**
1. 受信ループを `reader.cancel()` で停止
2. `reader.releaseLock()` でリーダー解放
3. `port.close()` でポート閉鎖
4. UI を未接続状態に遷移

**デバイス切断（物理切断）時:**
- `navigator.serial` の `disconnect` イベントを監視
- 検出時にステータスをエラー状態に遷移し、リソースをクリーンアップ

---

### 4.2 送信機能

#### 4.2.1 入力形式

| 形式 | 説明 | 入力例 |
|------|------|--------|
| テキスト | ASCII/UTF-8 テキストをそのまま送信 | `Hello World` |
| バイナリ（HEX） | スペース区切りの16進数文字列として入力 | `48 65 6C 6C 6F` |

- 入力形式はトグル（テキスト / HEX）で切り替え可能
- HEX入力時は入力バリデーションを行い、不正な文字はリアルタイムで警告表示

#### 4.2.2 改行コード付与

送信時に末尾に追加する改行コードを以下から選択可能とする。

| 選択肢 | 送信バイト |
|--------|-----------|
| なし | （付与しない） |
| CR | `\r` (0x0D) |
| LF | `\n` (0x0A) |
| CR+LF | `\r\n` (0x0D 0x0A) |

#### 4.2.3 送信処理

1. 入力形式に応じてテキストまたはHEX文字列を `Uint8Array` に変換
2. 選択された改行コードを末尾に追加
3. `port.writable.getWriter()` を取得
4. `writer.write(data)` で送信
5. `writer.releaseLock()` でライター解放
6. 送信履歴に記録
7. 「送信後クリア」チェックボックスがONの場合、送信入力欄をクリアする

#### 4.2.5 送信後クリア設定

- 送信ボタン横に「送信後クリア」チェックボックスを配置する
- デフォルトはON（送信後にテキスト入力欄をクリア）
- OFFにすると送信後も入力内容を保持する（同一データの繰り返し送信に便利）
- 設定は localStorage に永続化される（§4.5 参照）

#### 4.2.4 送信履歴

- 送信した内容を時系列で一覧表示する
- 各エントリに以下の情報を表示:
  - 送信時刻（`HH:MM:SS.mmm` 形式）
  - 送信データ（テキスト表示）
  - 送信データ（HEX表示）
  - 送信バイト数
- 履歴エントリをクリックすると、送信データを送信入力欄に復元できる（再送信用）
- 履歴クリアボタンで一括削除可能

---

### 4.3 受信機能

#### 4.3.1 受信処理

- `port.readable.getReader()` による受信ループで Uint8Array チャンクを受信
- 受信データは内部バッファ (`Uint8Array[]`) に蓄積
- 受信イベントごとにUIを更新

#### 4.3.2 テキスト表示

- 受信したバイト列をUTF-8としてデコードし表示
- ASCII コード外（制御文字 0x00-0x1F（改行・タブ除く）、0x7F、0x80-0xFF）はエスケープ表示する

| 範囲 | 表示形式 | 例 |
|------|---------|-----|
| 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F | `\x{HH}` | `\x01`, `\x1F` |
| 0x09 (TAB) | タブ文字としてそのまま表示 | |
| 0x0A (LF) | 改行として表示 | |
| 0x0D (CR) | 改行として表示（直後のLFと結合） | |
| 0x7F (DEL) | `\x7F` | |
| 0x80-0xFF | `\x{HH}` | `\xA0`, `\xFF` |

- 自動スクロール: 新規データ受信時に最下部へ自動スクロール（ユーザーが上方にスクロール中はポーズし、最下部に戻ると自動スクロール再開）
- テキスト表示エリアからのテキスト選択・コピーが可能

#### 4.3.3 バイナリ表示（HEXダンプ）

バイナリエディタ風の表示形式で受信データを表示する。

```
ADDRESS   00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F  ASCII
--------  -----------------------  -----------------------  ----------------
00000000  48 65 6C 6C 6F 20 57 6F  72 6C 64 0D 0A 00 FF FE  Hello World.....
00000010  41 42 43 44 45 46 47 48  49 4A 4B 4C 4D 4E 4F 50  ABCDEFGHIJKLMNOP
```

- 1行16バイト表示
- アドレス列: 8桁の16進数オフセット（0始まり）
- HEX列: 各バイトをスペース区切りの2桁16進数で表示。8バイトごとにスペースを挿入
- ASCII列: 表示可能文字（0x20-0x7E）はそのまま表示、それ以外は `.` で表示
- 自動スクロール: テキスト表示と同様の挙動

#### 4.3.4 2画面並列表示

- テキストビューとHEXダンプビューは左右に横並びで同時表示する
- 両方のビューは同じ受信データバッファを参照（データの重複保持はしない）
- 各ビューは独立してスクロール可能
- ビュー間の境界はドラッグで幅を調整可能（リサイズハンドル）
- デフォルトの幅比率は 1:1（50%:50%）

#### 4.3.5 受信データ操作

- **クリア**: 受信バッファと表示をクリア
- **一時停止 / 再開**: 表示更新の一時停止（受信自体は継続し内部バッファに蓄積）
- **コピー**: 現在の表示内容をクリップボードにコピー

### 4.5 設定の永続化

各種設定を `localStorage` に保存し、ページ再読み込み後も前回の設定を自動復元する。

#### 4.5.1 保存対象

| グループ | キー | 保存項目 |
|----------|------|----------|
| 接続設定 | `wsm:connection` | ボーレート、カスタムボーレート値、データビット、ストップビット、パリティ、フロー制御 |
| 送信設定 | `wsm:send` | 入力フォーマット（テキスト/HEX）、改行コード、送信後クリア設定 |

#### 4.5.2 保存タイミング

- 各設定値の変更時に即座に保存する（明示的な「保存」操作は不要）

#### 4.5.3 復元タイミング

- 各UIコンポーネントの初期化時にlocalStorageから読み込み、UIに反映する
- 保存データが存在しない場合（初回起動時等）はデフォルト値を使用する
- 保存データの読み込みに失敗した場合（フォーマット不正等）はデフォルト値にフォールバックする

---

## 5. UI設計

### 5.1 レイアウト

```
┌──────────────────────────────────────────────────────────┐
│  ヘッダー（アプリ名 + 接続ステータスバー）                    │
├──────────────────────────────────────────────────────────┤
│  接続パネル                                                │
│  [ポート選択] [ボーレート▼] [データビット▼] [ストップビット▼]  │
│  [パリティ▼] [フロー制御▼]  [●接続] [●切断]                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  受信パネル                          [⏸一時停止] [🗑クリア] │
│  ┌────────────────────────┬─┬─────────────────────────┐  │
│  │ テキストビュー          │↔│ HEXダンプビュー          │  │
│  │                        │ │ ADDRESS  00 01 .. ASCII  │  │
│  │ Hello World\x01\xFF    │ │ 00000000 48 65 .. Hello  │  │
│  │                        │ │ 00000010 41 42 .. ABCD.  │  │
│  │                        │ │                          │  │
│  └────────────────────────┴─┴─────────────────────────┘  │
│              ↔ ドラッグでリサイズ可能                       │
├──────────────────────────────────────────────────────────┤
│  送信パネル                                                │
│  [テキスト | HEX] [改行コード▼: なし/CR/LF/CR+LF]          │
│  ┌──────────────────────────────┐ [送信] [☑送信後クリア]  │
│  │ 送信入力エリア                 │                        │
│  └──────────────────────────────┘                        │
├──────────────────────────────────────────────────────────┤
│  送信履歴パネル（折りたたみ可能）              [🗑クリア]    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 12:34:56.789  "Hello World\r\n"  [48 65 6C ...]   │  │
│  │ 12:34:57.123  "Test"             [54 65 73 74]     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 5.2 デザイン方針

- **ダークテーマ**: ターミナルツールとしての慣例に合わせ、ダークテーマをデフォルトとする
- **モノスペースフォント**: 受信表示・送信入力・履歴にはモノスペースフォント（`JetBrains Mono` または `Fira Code`、フォールバックに `Consolas`, `monospace`）を使用
- **レスポンシブ**: 最小幅 1024px を想定。受信パネルは可能な限り画面高さを占有する。テキストビューとHEXダンプビューは横並び2画面で表示し、ドラッグで幅比率を調整可能とする
- **CSS Custom Properties**: 色・フォント・スペーシングを変数化し、テーマ変更やカスタマイズを容易にする

### 5.3 カラースキーム（ダークテーマ）

| 用途 | CSS変数名 | 値 |
|------|-----------|-----|
| 背景色（メイン） | `--color-bg-primary` | `#1e1e2e` |
| 背景色（パネル） | `--color-bg-secondary` | `#282840` |
| 背景色（入力） | `--color-bg-input` | `#1a1a2e` |
| テキスト色 | `--color-text-primary` | `#cdd6f4` |
| テキスト色（淡） | `--color-text-secondary` | `#a6adc8` |
| アクセントカラー | `--color-accent` | `#89b4fa` |
| 成功（接続中） | `--color-success` | `#a6e3a1` |
| 警告 | `--color-warning` | `#f9e2af` |
| エラー | `--color-error` | `#f38ba8` |
| ボーダー | `--color-border` | `#45475a` |
| エスケープ文字 | `--color-escape` | `#f9e2af` |
| アドレス表示 | `--color-address` | `#89b4fa` |

---

## 6. 詳細設計

### 6.1 ドメインモデル

#### SerialConfig（値オブジェクト）

```typescript
interface SerialConfig {
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  flowControl: 'none' | 'hardware';
}
```

#### SendMessage（エンティティ）

```typescript
interface SendMessage {
  id: string;               // 一意識別子
  timestamp: Date;          // 送信時刻
  data: Uint8Array;         // 送信バイト列（改行コード含む）
  inputFormat: 'text' | 'hex'; // 元の入力形式
  inputText: string;        // 元の入力文字列
  lineEnding: 'none' | 'cr' | 'lf' | 'crlf';
}
```

#### ReceivedData

```typescript
interface ReceivedChunk {
  timestamp: Date;          // 受信時刻
  data: Uint8Array;         // 受信バイト列
}
```

### 6.2 インターフェース

#### ISerialPort（ポートインターフェース）

```typescript
interface ISerialPort {
  open(config: SerialConfig): Promise<void>;
  close(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  onReceive: (callback: (data: Uint8Array) => void) => void;
  onError: (callback: (error: Error) => void) => void;
  onDisconnect: (callback: () => void) => void;
  readonly isOpen: boolean;
  readonly portInfo: { usbVendorId?: number; usbProductId?: number } | null;
}
```

### 6.3 Application Services

#### ConnectionService

```typescript
class ConnectionService {
  requestPort(): Promise<void>;        // ポート選択ダイアログ表示
  connect(config: SerialConfig): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionState(): ConnectionState; // 'disconnected' | 'connected' | 'error'
}
```

#### SendService

```typescript
class SendService {
  send(input: string, format: 'text' | 'hex', lineEnding: LineEnding): Promise<SendMessage>;
  getHistory(): SendMessage[];
  clearHistory(): void;
}
```

#### ReceiveService

```typescript
class ReceiveService {
  start(): void;                        // 受信ループ開始
  stop(): void;                         // 受信ループ停止
  onData: (callback: (chunk: ReceivedChunk) => void) => void;
  getBuffer(): Uint8Array;              // 蓄積データ全体を返す
  clearBuffer(): void;
  pause(): void;                        // 表示更新を一時停止
  resume(): void;                       // 表示更新を再開
}
```

### 6.4 EventBus（コンポーネント間通信）

コンポーネント間の疎結合な通信を実現するために、型安全なイベントバスを使用する。

```typescript
type EventMap = {
  'connection:stateChanged': { state: ConnectionState };
  'serial:dataReceived': { chunk: ReceivedChunk };
  'serial:dataSent': { message: SendMessage };
  'serial:error': { error: Error };
  'ui:clearReceiveBuffer': void;
  'ui:pauseReceive': void;
  'ui:resumeReceive': void;
};

class EventBus {
  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void;
  off<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): void;
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
}
```

---

## 7. 非機能要件

### 7.1 パフォーマンス

| 項目 | 目標値 |
|------|--------|
| 受信表示の更新レート | 最大60fps（requestAnimationFrame ベース） |
| 受信バッファ上限 | 1MB（超過時は先頭から自動破棄） |
| テキスト表示行数上限 | 10,000行（超過時は先頭から自動破棄） |
| HEXダンプ表示 | 仮想スクロール（表示範囲のみDOMレンダリング） |
| 送信履歴上限 | 1,000件（超過時は先頭から自動破棄） |

- 受信データの表示更新は `requestAnimationFrame` でバッチ処理し、チャンクごとのDOM更新を回避する
- HEXダンプビューは大量データ対応のため仮想スクロールを実装する

### 7.2 セキュリティ

| 対策 | 詳細 |
|------|------|
| Secure Context 必須 | HTTPS または localhost でのみ動作。HTTP アクセス時は警告表示 |
| ユーザージェスチャ必須 | `requestPort()` はクリック等のユーザーアクション内でのみ呼び出し |
| XSS対策 | 受信データのDOM挿入には `textContent` を使用し、`innerHTML` は使用しない |
| 入力バリデーション | HEX入力は `[0-9a-fA-F\s]` パターンでバリデーション |
| CSP対応 | Content Security Policy ヘッダを想定した実装（インラインスクリプト・スタイル不使用） |
| 依存ライブラリ | 外部CDN依存を最小化し、バンドルに含める |

### 7.3 アクセシビリティ

- セマンティックHTMLを使用（`<button>`, `<select>`, `<label>` 等）
- キーボード操作対応（Tab移動、Enter送信）
- ARIA属性によるスクリーンリーダー対応（接続状態の `aria-live` 通知等）
- 十分なコントラスト比（WCAG 2.1 AA 準拠）

### 7.4 エラーハンドリング

| エラーケース | ユーザーへの表示 | 内部処理 |
|-------------|----------------|---------|
| Web Serial API 非対応ブラウザ | 対応ブラウザ案内ダイアログ | アプリ起動時に `navigator.serial` を検出 |
| ポート選択キャンセル | メッセージなし（操作キャンセルのため） | 例外を握りつぶし状態を維持 |
| ポートオープン失敗 | エラーメッセージをステータスバーに表示 | エラーログ出力、状態をエラーに遷移 |
| 受信中エラー（非致命的） | ステータスバーに警告表示 | 受信ループ再開（リトライ） |
| 受信中エラー（致命的） | エラーメッセージ + 切断状態に遷移 | リソースクリーンアップ |
| デバイス物理切断 | 「デバイスが切断されました」表示 | disconnect イベントでクリーンアップ |
| 送信失敗 | エラーメッセージをステータスバーに表示 | 例外キャッチ、ライターのロック解放 |

---

## 8. 技術的制約・考慮事項

### 8.1 Web Serial API の制約

- **ユーザージェスチャ必須**: `requestPort()` はボタンクリック等のユーザーアクション内で呼び出す必要がある
- **1ポート = 1タブ**: 同一ポートを複数タブで同時オープンすることはできない
- **ReadableStream ロック**: リーダー取得中はストリームがロックされ、別のリーダーは取得不可。切断前に必ず `releaseLock()` が必要
- **WritableStream ロック**: 同上。書き込みのたびに `getWriter()` → `write()` → `releaseLock()` とする
- **バッファサイズ**: `port.open()` の `bufferSize` は16MB未満

### 8.2 データエンコーディング

- 送信（テキスト）: `TextEncoder` でUTF-8エンコード
- 受信（テキスト表示）: `TextDecoder` は使用せず、バイト単位で表示制御を行う（ASCII外エスケープの要件に対応するため）
- HEX変換: 独自のユーティリティ関数で `Uint8Array ↔ HEX文字列` を変換

---

## 9. 開発・ビルド

### 9.1 開発環境

```bash
# 依存インストール
npm install

# 開発サーバ起動（localhost:5173）
npm run dev

# プロダクションビルド
npm run build

# ビルド成果物プレビュー
npm run preview
```

### 9.2 ビルド出力

- `dist/` ディレクトリに HTML / CSS / JS をバンドル出力
- 出力ファイルはそのまま任意の静的ホスティングサービスにデプロイ可能
- 外部ランタイムサーバ不要

### 9.3 依存パッケージ

| パッケージ | 用途 |
|-----------|------|
| `vite` | ビルドツール・開発サーバ |
| `typescript` | 型安全な開発 |

> **方針**: ランタイム依存ライブラリは使用しない。フレームワーク・UIライブラリは導入せず、Vanilla TypeScript で実装する。

---

## 10. 将来の拡張候補（スコープ外）

以下は初期リリースのスコープ外とするが、アーキテクチャとして拡張可能な設計とする。

- ログのファイル保存（File System Access API）
- マクロ・スクリプト送信（定型コマンドの連続送信）
- タイムスタンプ付きログ形式でのエクスポート
- 複数ポート同時接続
- ライトテーマの切替
- 受信データのフィルタリング・検索
- 送受信データのグラフ表示（数値データのリアルタイムプロット）
