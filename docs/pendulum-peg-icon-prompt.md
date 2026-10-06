# 振り子と釘のアイコン

- 生成方法: built-in image_gen
- スタイル参照: `assets/index-icons/vertical-loop-motion.png`
- 旧候補: 初回に生成した時計のような構図（不採用、画像は最終候補で置き換え）
- 不採用理由: 円と2本の糸が時計のように見え、振り子と釘の主題が伝わりにくい。

## レビュー済みの採用画像

- 画像: `assets/index-icons/pendulum-peg-motion-generated.png`
- 状態: ユーザー確認済み。indexに正式に反映した。
- 形の参照: シミュレーターの実際の円軌道を正方形で撮影したもの。縦横を伸縮しない。
- レビュー: 元画像とindexの54px表示で確認。左の初期位置、釘に掛かった糸、小さい円軌道を区別できる。白線と金色の背景で既存の生成アイコンに合わせ、線の飛び出しはない。
- 途中候補の不採用理由: 大きい円弧が縦に引き伸ばされていたもの、接続点で点線が二重に重なっていたものは提案から外した。

### 新規生成のプロンプト

Create a polished square physics-simulator icon. FIRST reference is the exact physical diagram: a pendulum released horizontally from rest catches a peg and follows a smaller circle. SECOND reference supplies only the warm golden-orange gradient background and clean bold WHITE line pictogram style. Preserve the true circular geometry of reference 1; do NOT stretch the diagram vertically to fill the square. Translate the whole arrangement down slightly and leave balanced margins. The large dashed approach path is a QUARTER OF A TRUE CIRCLE centered at the upper fixed pivot: its radius leftwards equals its radius downwards. The smaller full circular path is centered at the peg below that pivot. Both paths meet smoothly at one shared bottom point. Show a hollow initial bob at the left end of a dotted horizontal string to the upper pivot; a short horizontal support bar above the pivot; a solid vertical string from pivot to peg; and a solid diagonal string from peg to a larger solid bob on the upper-right circumference of the smaller circle. No extra spokes. Approximate layout: top pivot at (66%,20%), release at (6%,20%), shared bottom at (66%,80%), peg at (66%,56%), small circle radius24%; bob at (85.4%,41.9%). The approach radius is60%, not80%. Make both pivots small dots, not large balls. All strokes bold and legible at54px, smooth rounded dash ends, clean intersections, no loose strokes or cropped shapes. Remove ALL letters, numbers, dimensions, arrows and UI from reference1. White symbols only on a subtly graded golden-orange background. This should clearly read as a pendulum catching a peg, not a clock or a rollercoaster. Deliver a newly generated bitmap icon, not a screenshot or vector tracing.

### 最終候補への修正プロンプト

Refine this icon with ONLY these corrections. It currently stretches the long pendulum path vertically: the upper pivot-to-bottom distance is larger than the release-to-pivot distance. Shorten the upper vertical string by moving BOTH the support bar/upper pivot and the hollow release marker/dotted horizontal string DOWN by about one tenth of the image height. Keep the small circle, lower peg, current bob, diagonal string, and shared bottom point at their existing positions. Redraw the long dashed left path as a true circular quarter centered on the NEW upper pivot, with the horizontal radius equal to the vertical radius. This should make the whole diagram less tall. Keep a SINGLE clean junction where the two trajectories share their bottom point: remove the doubled overlapping dashes there. Make the smaller circle a smooth SOLID white circle (as a reference orbit), keep only the larger approach arc dashed. Smaller white dots at the upper pivot and lower peg; the current bob remains noticeably larger. Preserve the gold-to-orange background and all other white line styling. No new symbols or text. Do not stretch the overall image.

## 旧候補のプロンプト

Use case: scientific-educational. Asset type: small square physics simulator index icon, displayed at 54 px. Generate a NEW icon for a pendulum whose string catches a peg and then revolves around that peg. The reference image is ONLY a style/palette reference: match its smooth golden-yellow to orange subtle gradient background and bold clean white line work. Do not copy its ramp or loop rail. Show a tiny solid white fixed pivot near the upper center at (48%,10%), a smaller distinct white peg centered at (48%,57%), and a clean bold white string from pivot straight down to peg, then diagonally up-right to a solid white circular bob at (78%,40%). Draw a moderately thick dashed white circular orbit centered EXACTLY on the peg, passing through the center of the bob. The circle should be dominant, about 66% of the image height, complete and contained with clear margins. The peg is the center of this orbit, NOT a point on the orbit. The bob lies on the orbit and the diagonal string is one straight radius ending exactly at the bob's center. Two clear string segments only. White symbols only. Intentional polished pictogram, optically balanced, readable at 54px. No text, no letters, no numerals, no arrows, no shaded fills inside the orbit, no extra lines, no ramp, no rails, no border, no watermark. Match reference tone while keeping geometry and endpoints clean.
