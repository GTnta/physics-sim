# ケプラーの第二法則のアイコン

- 作成日: 2026-10-21
- 生成方法: built-in image_gen。HTML・SVGを描画してPNG化したものではない。
- スタイル参照: `assets/index-icons/vertical-loop-motion.png`、`assets/index-icons/circular-shm-vector-graphs.png`
- 採用画像: `assets/index-icons/kepler-second-law-generated.png`
- 状態: Codexでレビューしてindexへ反映し、ユーザーの正式公開指示を受けた採用画像。

## レビュー

### 内容・物理的な意味

- 大きい横長の楕円、左焦点付近の太陽、共通の太陽から伸びる2つの掃過領域に構成を絞った。
- 近い側は短く幅広い領域、遠い側は長く細い領域とし、形が違っても面積が等しい関係を模式的に示す。
- 掃過領域の外側の境界は楕円の円弧に沿う。軌道上の2点を直線で結ぶ三角形にはしていない。
- 採用画像では、塗り領域を画素で概算した左右比も約1.04となり、明らかな面積の偏りは解消した。線の太さやアンチエイリアスの影響があるため、画像そのものを等面積の数値的証明としては使わない。

### 見た目・縮小表示

- 白い線と半透明の白い塗り、オレンジ系のグラデーションで既存の力学アイコンに合わせた。
- 元画像、54pxの実寸表示、54pxの拡大、実際のindexカード内で確認した。
- 太陽・楕円・2つの領域を54pxでも判別できる。輪郭は初期候補より太くし、線の途切れ・飛び出し・余分な図形・不自然な矢印はない。
- 領域同士の境界は太陽へ集め、外枠の角丸は既存のindexのCSSに任せた。
- デスクトップ・iPad縦横・スマートフォン相当のカードで読み込みと縦横比を確認。狭いカードでアイコンが横に縮む既存の配置も、公開状態を折り返す形で修正した。

### 不採用候補

1. 太陽が左焦点より大きく右へ寄っていたもの。
2. 焦点位置は改善したが、縮小時の線が弱く、遠い側の領域が大きめだったもの。

## 最終修正のプロンプト

対象は2番目の生成候補。以下の指示で修正した3番目の生成画像を採用した。

```text
Refine this square Kepler icon; preserve the same orange gradient, single horizontal ellipse, broad near/left shaded sector and narrow far/right shaded sector. No text, no arrows, no additional symbols. Two specific corrections are required.
1) Use truly bold small-icon linework. The current outlines look like thin hairlines at 54px. Make the white orbit outline approximately TWICE AS THICK as now, a robust 38-42px stroke in this 1254px square. Make the four straight radial boundaries similarly bold, approximately 30-34px. Smooth precise clean lines. Keep the existing orbit centerline geometry and generous background margin, no cropping.
2) Scientific geometry: move the white Sun disk center a little farther LEFT, from the current x=222 to x=186 at y=613, so that it coincides with the ellipse's actual left focus. Sun disk diameter about 80px. Keep the broad near-sector endpoints at approximately (270,320) and (270,900) ON THE ORBIT, and reconnect their radial boundaries to the corrected Sun. Keep its translucent white fill. REDUCE THE ANGULAR WIDTH OF THE FAR/RIGHT SECTOR: move its two boundary planet dots CLOSER TOGETHER along the orbit, to approximately (1188,550) and (1188,676), instead of the current y~518 and y~698. Thus the right sector has a smaller end height, about 126px, to make its swept area match the compact broad left sector. Reconnect both right boundaries to the same corrected Sun and keep a curved outer boundary exactly on the ellipse. All four endpoint dots exactly on the orbit, no old ghost dots or lines remaining.
Everything remains flat white line art on opaque orange gradient. No shadows or glow, no stray marks, no thin secondary outlines. The key priorities are a Sun actually at the left focus, approximately equal shaded area despite very different shapes, and bold readable outlines at 54x54.
```
