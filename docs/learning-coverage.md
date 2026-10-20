# シミュレーターの学び・記録状況

確認日: 2026-10-21

## 範囲と方法

- `data/index.json` に掲載した33件を対象に、`docs/codex-notes.md` の参照、現行実装、関連するGit履歴を照合した。
- 個別ページの参照記録がなかった12件を補い、既存の記録だけでは不足していた3力の固定モードと鉛直ループの運動・時間操作も補足した。
- 既存の共通知識があるものは残し、今回の補足は現行コードから確認できる事実と次回の注意として追記した。過去の会話をすべて再現したという意味ではない。
- これは記録の監査であり、33件の物理挙動やすべての端末を再テストした記録ではない。今回の公開確認はケプラーとindexを中心に別途実施する。
- 詳細は `codex-notes.md` の該当教材名・ファイル名から検索する。没・旧版・試作専用HTMLは本表の対象外。

## 一覧

| 教材 | 実装 | 記録の扱い |
| --- | --- | --- |
| 川と船の合成速度 | `relative-motion/river_boat_vector_simulator.html` | 既存の相対速度・操作の記録を保持 |
| 相対運動の視点切り替え | `relative-motion/relative-motion-reference-simulator.html` | 既存の視点・3D表示の記録を保持 |
| モーションマップ | `motion-map/motion-map-simulator.html` | 今回補足: 等時刻サンプル、反転、終端区間 |
| 表現の相互変換 | `representation-translation/representation-translation.html` | 今回補足: 共通の運動データと誤答の区別 |
| 運動のグラフ作成 学習モード | `motion-graph-lab/motion-graph-lab.html` | 今回補足: 実行後DOM、傾き・積分、点の制約 |
| 運動のグラフ作成 クイズモード | `motion-graph-lab/motion-graph-quiz.html` | 今回補足: 候補の同値判定と正答の一意性 |
| 投射運動シミュレーター | `projectile/projectile-simulator.html` | 既存の画角・パラメーター・タッチ操作の記録を保持 |
| 投射運動バリエーション | `projectile-variations/projectile-variation-lab.html` | 既存の比較表示の記録を保持 |
| モンキーハンティング | `monkey-hunting/monkey-hunting.html` | 既存の2D/3D同期、固定カメラ、出会い・接地判定を保持。仮版の状態は変更しない |
| 3力のつりあい | `forces/three-force-equilibrium.html` | 既存の成分・ラベル配置を保持し、固定モードを補足 |
| てこのつりあい | `rigid-equilibrium/lever-balance-simulator.html` | 今回補足: 符号付きモーメントと予想・確認の分離 |
| 二点支えのつりあい | `rigid-equilibrium/two-support-beam-simulator.html` | 既存の反力・タッチ操作の記録を保持 |
| 二本のひもでつるす棒 | `rigid-equilibrium/two-string-sign-simulator.html` | 既存の幾何拘束・張力・段階学習の記録を保持 |
| 剛体のつりあいクイズ | `rigid-equilibrium/rigid-equilibrium-quiz.html` | 既存の格子操作・平行力・出題の偏りに関する記録を保持 |
| 転倒条件 | `rigid-equilibrium/tipping-condition-simulator.html` | 今回補足: すべりと転倒の別々の限界・作用線 |
| 衝突と運動量保存 | `momentum/collision-momentum-simulator.html` | 今回補足: 相対速度、反発係数、エネルギーとの区別 |
| 斜め衝突と運動量保存 | `momentum/oblique-collision-momentum-simulator.html` | 既存の円盤接触・法線・重心・運動量比較を保持 |
| 等速円運動 | `circular-motion/circular-motion-simulator.html` | 既存の角速度・ベクトル・ラベル整理の記録を保持 |
| 円運動の加速度の向き | `circular-motion/circular-acceleration-direction.html` | 今回補足: 同じベクトルを使う段階導出、極限、再生操作 |
| 鉛直面内の円運動 | `circular-motion/vertical-loop-motion.html` | 既存の高さドラッグに加え、軌道・反力・離脱・往復・時刻スナップを補足 |
| 振り子と釘の円運動 | `circular-motion/pendulum-peg-motion.html` | 既存の張力条件・プリセット・導出・画面占有面積の記録を保持 |
| 等速円運動と単振動 | `circular-motion/circular-shm-connection.html` | 既存の共通スケール・位相スナップ・初期化の記録を保持 |
| 単振動の速度・加速度 | `circular-motion/circular-shm-vector-graphs.html` | 既存のベクトルとグラフの倍率・色・アイコンレビューを保持 |
| ケプラーの第二法則 | `kepler-laws/kepler-second-law.html` | 今回のモデル・固定比較点・枠・概要・生成アイコン・公開方針を記録 |
| 波の重ね合わせ | `wave-superposition/wave-superposition-sim.html` | 既存の色、包絡線、RAF、注目帯、タッチ、公開検証を保持 |
| 反射波 | `wave-reflection/wave-reflection-simulator.html` | 既存の境界条件・有限波面・媒質点・腹と節・時刻操作を保持 |
| 弦の共鳴 | `resonance/string-resonance-sim.html` | 今回補足: モード、表示用の共鳴近似、表示速度との区別 |
| 気柱の共鳴 | `resonance/air-column-resonance-sim.html` | 今回補足: 開管/閉管、変位と密度、開口端補正 |
| 気柱の共鳴管実験 | `resonance/resonance-tube-experiment-sim.html` | 今回補足: 有効長、共鳴位置、判定と記録 |
| ドップラー効果の導出 | `doppler-effect/doppler-effect.html` | 既存の日本語表記・段階導出の共通方針を保持 |
| ドップラー効果 平面波 | `doppler-effect/doppler-plane-wave-sim.html` | 今回補足: 放出位置・時刻を固定した波面と到達イベント |
| ドップラー効果 点波源 | `doppler-effect/doppler-point-source-sim.html` | 既存の日本語表記と、今回の放出位置・時刻に関する共通知見を参照 |
| 運動する反射板のドップラー効果 | `doppler-effect/doppler-moving-reflector-sim.html` | 既存の波・矢印・数値・式の区別に関する記録を保持 |

## 今回の共通の記録

- タイトル下は「法則・現象の説明 → 何を観察するか」の順にする。
- 外枠、主現象の大きさ、操作の間隔は別々に調整し、図を小さくして見かけ上の収まりだけを優先しない。
- 生成画像の物理的な意味と、線幅・はみ出し・縮小時の美しさを別々にレビューする。指定した座標が生成結果でも守られたとは限らない。
- indexのアイコンはflexによる横縮みを防ぎ、実際のカードで縦横比を測る。
- 利用者向けの更新ログと、実装履歴・学びを分ける。正式公開のログを残し、仮公開と細かな調整はGit履歴へ任せる。
