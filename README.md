# WebSerialMonitor

ブラウザ上で動作するシリアル通信モニタリングツール。  
[Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) を使用し、バックエンドサーバなしのスタティックサイトとして動作します。

こちらで使うことができます: [WebSerialMonitor](https://pic-man749.github.io/WebSerialMonitor/)

## 機能

- シリアル接続 : ボーレートはもちろん、データビット、ストップビット、パリティ、フロー制御を UI から設定可能
- データ受信
  - テキストビュー : テキストとして表示します。制御文字はエスケープ表示 (`\xHH`)します
  - HEX ダンプビュー : バイナリエディタのように16進数表示します
- データ送信 : テキスト / HEX 入力切替、改行コード選択 (なし / CR / LF / CR+LF)

## 対応ブラウザ

| ブラウザ | バージョン |
|----------|-----------|
| Google Chrome | 89+ |
| Microsoft Edge | 89+ |
| Opera | 75+ |

**注**: HTTPS または localhost 上でのみ動作します。

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
| 言語 | TypeScript |
| ビルド | Vite |
| ランタイム依存 | なし（Vanilla JS + ES Modules） |
| スタイリング | CSS Custom Properties + BEM |
| シリアル通信 | Web Serial API |

## ライセンス

MIT
