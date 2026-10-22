# ケプラーの第三法則のアイコン

- 作成日: 2026-10-22
- 生成方法: built-in image_gen。HTMLやSVGで作図してPNG化した画像ではない。
- スタイル参照: `assets/index-icons/kepler-second-law-generated.png`、`assets/index-icons/vertical-loop-motion.png`、`assets/index-icons/circular-shm-vector-graphs.png`
- 採用画像: `assets/index-icons/kepler-third-law-generated.png`（1254×1254 PNG）
- 状態: Codexの原寸・縮小レビュー後にindexへ反映。2026-10-22の指示により仮バージョンとしてpushした後、同日の正式公開指示を受けて採用画像として継続使用。

## 内容・物理のレビュー

- 異なる大きさの2つの楕円、左焦点付近の共通の太陽、各軌道上の惑星、針の進みが違う2つの時計に絞った。
- 楕円は同心にはせず、太陽側へ中心をずらす構図。軌道同士は接触・交差させず、太陽と惑星も区別した。
- 初回候補は2つの楕円が左端で接していたため不採用。線幅、太陽の位置を段階的に修正した。
- 採用画像の白線を走査して楕円を概算すると、左焦点のx座標は外側約241px、内側約225px、太陽中心は約224pxだった。生成図には近似誤差があり、54px換算では焦点間の差は1px未満。数値的な証明や正確な作図としては用いない。
- 時計は周期の比較を表す模式図。時計と惑星の厳密な同時刻の対応や周期比を、この画像から読み取らせるものではない。

## 見た目のレビュー

- 第二法則と同じオレンジ〜金色のなだらかなグラデーション、白のみの図形で統一した。
- 白線を補強し、原寸、54pxの実寸、54pxの拡大、実際のindexカードで確認した。
- 2つの軌道と2つの時計を小さな表示でも判別できる。文字・数式・多色の線・不要な矢印は入れない。
- 原寸では軌道同士、太陽と軌道、時計と軌道の間に背景が残る。線の飛び出し、時計からの針のはみ出し、余分な線、旧太陽の残像はない。
- 原図と54px比較シートは画像を表示した上で目視した。比較シートの縮小処理はレビュー用であり、採用PNGをコードで描き直したものではない。

## 生成プロンプトの構成

新規生成では次を指定した。

- 54px用の太い白線と、既存の力学アイコンに合うオレンジのグラデーション。
- 異なる長半径・共通の左焦点を持つ2つの水平な楕円、太陽1つ、軌道上の惑星を各1つ。
- 下側に単純な時計を2つ。左は針が右向き、右は12時から約35度進んだ位置。
- 楕円の接触、余分な線、はみ出し、文字、数式、陰影、装飾的な星空を禁止。

初回生成後、楕円の中心と半径の具体的な座標を指定して左端の接触を解消し、白線を補強した。続いて太陽を小さくし、焦点側へ移動する修正を行った。

### 採用画像を生成した最終修正プロンプト

対象は、同じ構図の3番目の生成候補。

```text
Make ONE localized correction only: the solid white Sun disk INSIDE the small ellipse is too far right. Move that Sun disk visibly LEFT by about TWO THIRDS OF ITS CURRENT DIAMETER, and make its diameter about 25 percent smaller. It should sit close to, but NOT touch, the leftmost inner orbital curve, with a slim clear orange gap between the Sun and that curve. The present orange gap is too wide: reduce the gap to around one-quarter of the Sun's new diameter. Aim for the Sun center to be aligned with the common left focus near the left side of BOTH ellipses, NOT near the center of the inner ellipse. Erase the old white Sun at its current location and seamlessly restore the orange gradient there. Keep EXACTLY ONE Sun. Keep every other element completely unchanged: both existing elliptical orbit paths, both planet dots on those paths, both clocks with their hands, the bold white line weights, and all orange gradient colors. Do not move or reshape any orbital line. Do not add anything. This is only a leftward repositioning and modest shrinking of the isolated Sun dot.
```
