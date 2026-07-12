# Codex 作業ワークフロー

このリポジトリでシミュレーターを作成・改善するときの確認手順です。

## 目的

- Python や Node.js の PATH 状態に依存せず、ローカル表示確認を安定させる。
- PowerShell の文字コード設定に依存せず、UTF-8 の破損や文字化けを検出する。
- iPad 横置き・縦置き・向き変更中の再生継続を、毎回同じ条件で確認する。

## ローカル表示

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
```

既定では `http://127.0.0.1:8766/` でリポジトリ直下を配信します。

別ポートを使う場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8780
```

このサーバーは Python や Node.js を使わず、PowerShell/.NET のみで動きます。

## ローカル開発ツール

追加の自動化用に、リポジトリ外の `C:\Users\tadan\codex\.local-tools` に Node.js LTS と Playwright を置きます。リポジトリにはバイナリを入れません。

状態確認:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-local-tools.ps1
```

未セットアップ、または復元する場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/install-local-tools.ps1
```

Playwright を使う一時的な Node スクリプトを実行する場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run-local-node.ps1 -Evaluate "const { chromium } = require('playwright'); console.log(typeof chromium.launch)"
```

PowerShell では `npm.ps1` が実行ポリシーで弾かれることがあるため、直接使う場合は `npm.cmd` / `npx.cmd` を呼びます。

## 文字コード確認

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-encoding.ps1
```

確認内容:

- 対象ファイルが UTF-8 として読めるか
- 置換文字 `U+FFFD` が入っていないか
- HTML に `<meta charset="UTF-8">` があるか
- 典型的な文字化け由来の文字列が入っていないか

## HTML 簡易確認

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-html-smoke.ps1
```

確認内容:

- `html` / `title` / `viewport` / `canvas` などの基本要素
- 重複 `id`
- `script` タグの開閉数

特定ページだけ確認する場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-html-smoke.ps1 -Path projectile/projectile-simulator.html
```

## iPad 向き変更確認

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-ipad-viewport.ps1
```

既定では以下を確認します。

- `projectile/projectile-simulator.html`
- `projectile-variations/projectile-variation-lab.html`

確認内容:

- `1024x768 -> 768x1024 -> 1024x768` の切り替え
- 再生中の時刻が進み続けること
- 再生ボタンが「一時停止」のまま保たれること
- 横スクロールが出ないこと
- キャンバス全体が見える位置で見切れないこと

特定ページだけ確認する場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-ipad-viewport.ps1 -Path motion-graph-lab/motion-graph-lab.html
```

ページによって再生ボタンや時刻スライダーの ID が違う場合は、スクリプト側へ対応を追加してから使います。

## ブラウザ実行の共通確認

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-browser-smoke.ps1
```

確認内容:

- 全HTMLをローカルサーバー経由で実ブラウザに読み込めるか
- `1280x720`、`1024x768`、`768x1024` で横スクロールが出ないか
- ページ読み込み時の JavaScript エラー、`console.error`、未処理 Promise rejection がないか
- `title` と本文が空ではないか

Git管理下のHTMLだけを確認する場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command '$paths = git ls-files "*.html"; & "./tools/check-browser-smoke.ps1" -Path $paths'
```

狭い表示で数px程度の丸め誤差を許容するため、既定では `8px` までの横方向差分は失敗扱いにしません。厳密に見る場合は `-MaxHorizontalOverflow 0` を指定します。

ブラウザ検証系のスクリプトは、既定で空きポートを選び、DevTools 応答にタイムアウトをかけます。ポート競合やブラウザ応答待ちで止まったように見える場合は、同じコマンドを無理に繰り返す前に、対象ページやセレクタの指定を確認します。

## 指定要素の見た目確認

index のカード、アイコン、特定パネル、ボタンなど、画面全体ではなく一部の見た目を確認したい場合は `tools/check-visual-target.ps1` を使います。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-visual-target.ps1 -Path index.html -Selector "a[href='./circular-motion/circular-motion-simulator.html'] .icon"
```

確認内容:

- ローカルサーバー経由で対象ページを開く
- 指定セレクタの要素を画面中央へスクロールする
- 指定要素だけを `.tmp/visual-targets/` にスクリーンショット保存する
- ページ全体の横スクロール、対象要素内のはみ出し、console error を検出する

iPad 相当の見た目も同時に見る場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-visual-target.ps1 -Path index.html -Selector "a[href='./circular-motion/circular-motion-simulator.html'] .icon" -ViewportWidth 1024,768 -ViewportHeight 768,1024
```

CSS セレクタに属性値を書く場合は、PowerShell の引用で崩れないよう、外側をダブルクォート、属性値をシングルクォートにします。

このツールも既定で空きポートを選ぶため、通常は `-Port` を指定しません。出力先の `.tmp/visual-targets/` は確認用の一時領域です。

よく見る対象は `tools/visual-targets.json` に登録して、まとめて確認できます。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-visual-targets.ps1
```

登録済み対象を確認する場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-visual-targets.ps1 -List
```

対象名を絞る場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-visual-targets.ps1 -Name index-circular-motion-icon
```

## まとめて確認

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
```

表示調整だけでブラウザ確認が不要な場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1 -SkipViewport
```

対象HTMLを絞る場合は、`-HtmlPath index.html,circular-motion/circular-motion-simulator.html` のようにカンマ区切りで渡してもよいです。

登録済みの見た目確認も含める場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1 -SkipViewport -CheckVisualTargets
```

## 新しいシミュレーター作成時の最低確認

1. `tools/check-encoding.ps1`
2. `tools/check-html-smoke.ps1 -Path <対象HTML>`
3. `tools/serve.ps1` で手元表示
4. `tools/check-browser-smoke.ps1 -Path <対象HTML>`
5. 見た目で気になる箇所は `tools/check-visual-target.ps1 -Path <対象HTML> -Selector "<CSSセレクタ>"` で要素単位の画像を確認
6. iPad 横置き相当で主表示・主要操作が収まるか確認
7. 再生があるページでは、向き変更中にアニメーションが途切れないか確認

新規ページを `tools/check-ipad-viewport.ps1` で自動確認したい場合は、再生ボタン、時刻スライダー、必要な長時間再生条件をスクリプトに追加します。
