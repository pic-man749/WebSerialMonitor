# WebSerialMonitor

ブラウザ上で動作するシリアル通信モニタリングツール。  
[Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) を使用し、バックエンドサーバなしのスタティックサイトとして動作します。

## 機能

- **シリアル接続管理** — ボーレート・データビット・ストップビット・パリティ・フロー制御を UI から設定可能
- **データ送信** — テキスト / HEX 入力切替、改行コード選択 (なし / CR / LF / CR+LF)
- **データ受信（2画面並列表示）**
  - テキストビュー — 制御文字のエスケープ表示 (`\xHH`)、自動スクロール
  - HEX ダンプビュー — アドレス + HEX + ASCII の3カラム、仮想スクロール対応
  - ドラッグによるリサイズハンドルで幅比率を調整可能
- **送信履歴** — タイムスタンプ・テキスト・HEX・バイト数を一覧表示、クリックで再送信
- **デバイス切断検知** — 物理的なデバイス切断を検出し、ステータスバーにエラー表示
- **ダークテーマ** — モノスペースフォント (JetBrains Mono / Fira Code) のターミナル風 UI

## 対応ブラウザ

| ブラウザ | バージョン |
|----------|-----------|
| Google Chrome | 89+ |
| Microsoft Edge | 89+ |
| Opera | 75+ |

> **注**: HTTPS または localhost 上でのみ動作します（Web Serial API の Secure Context 要件）。

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

`http://localhost:5173` で開発サーバが起動します。

## ビルド

```bash
npm run build
```

`dist/` にプロダクションビルドが出力されます。

```bash
npm run preview
```

ビルド成果物のプレビューサーバが起動します。

## ディレクトリ構成

```
src/
├── main.ts                          # エントリポイント（API対応チェック・起動）
├── domain/
│   ├── models/                      # SerialConfig / SendMessage / ReceivedData
│   └── interfaces/                  # ISerialPort（ポート抽象インターフェース）
├── application/                     # ConnectionService / SendService / ReceiveService
├── infrastructure/                  # WebSerialPort（Web Serial API アダプター）
├── presentation/
│   ├── App.ts                       # ルートコンポーネント（統合・配線）
│   ├── EventBus.ts                  # 型安全なイベントバス
│   └── components/                  # StatusBar / ConnectionPanel / ReceivePanel / SendPanel / SendHistoryList
└── styles/
    ├── main.css                     # リセット・レイアウト・共通コンポーネント
    ├── components/                  # 各コンポーネント CSS
    └── themes/
        └── dark.css                 # ダークテーマ（CSS Custom Properties）
```

## 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | TypeScript (strict mode) |
| ビルド | Vite |
| ランタイム依存 | なし（Vanilla JS + ES Modules） |
| スタイリング | CSS Custom Properties + BEM |
| シリアル通信 | Web Serial API |

## ライセンス

MIT
