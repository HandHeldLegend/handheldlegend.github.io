/**
 * Japanese translations — rgb. English source text → translation.
 * Machine-drafted; NEEDS NATIVE REVIEW. Terminology: src/i18n/GLOSSARY.md.
 */

/** Per-group color settings ("Group 1 color" … "Group 32 color") are generated, like rgb/settings.js. */
const groupColors = {};
for (let i = 1; i <= 32; i++) { // RGB_MAX_GROUPS
  groupColors[`Group ${i} color`] = `グループ${i}の色`;
  groupColors[`Color of LED group ${i} as listed on the RGB page (group names and count depend on the controller, e.g. "D-Pad" or "A").`] =
    `RGBページに表示されるLEDグループ${i}の色です（グループ名と数はコントローラーによって異なります。例：「D-Pad」や「A」）。`;
}

export default {
  ...groupColors,

  // Lighting
  'Lighting': 'ライティング',
  'Pick an effect — the preview shows roughly how it looks.': '効果を選んでください。プレビューでおおよその見た目を確認できます。',
  'Preview of the selected lighting effect': '選択中のライティング効果のプレビュー',
  'Effect': '効果',
  'Lighting effect: Authentic (classic face-button colors for the output mode; called Chroma in older apps), Static (your colors), Rainbow, React (flash on press) or Fairy (blend between your first six colors).': 'ライティング効果：オーセンティック（出力モードに応じたフェイスボタンのクラシックカラー。旧アプリではChromaと呼ばれていました）、固定色（設定した色）、レインボー、リアクト（押すと点灯）、フェアリー（最初の6色の間で変化）。',
  'Authentic': 'オーセンティック',
  'Static': '固定色',
  'Rainbow': 'レインボー',
  'React': 'リアクト',
  'Fairy': 'フェアリー',
  'Face buttons light up in the classic colors of the current output mode (Switch/SNES: A red, B yellow, X blue, Y green) and follow your remaps; other LEDs glow soft white. Your colors are only used for the player LEDs.': 'フェイスボタンが現在の出力モードのクラシックカラー（Switch/SNES：Aは赤、Bは黄、Xは青、Yは緑）で光り、割り当て変更にも追従します。その他のLEDは柔らかな白色に光ります。設定した色はプレイヤーLEDにのみ使われます。',
  'Each group glows steadily in the color you pick below.': '各グループが下で選んだ色で常に点灯します。',
  'All LEDs (except the player LEDs) fade together through the colors of the rainbow. Animation time sets how long each color step takes.': 'すべてのLED（プレイヤーLEDを除く）が虹の色を順番にフェードします。アニメーション時間で各色のステップの長さを設定します。',
  'Lights flash on in your colors when you press an input, then fade out over the animation time. The player LEDs stay lit in their color.': '入力を押すと設定した色でライトが点灯し、アニメーション時間をかけてフェードアウトします。プレイヤーLEDは設定した色で点灯したままです。',
  'Every LED (except the player LEDs) slowly blends between the first six colors below, like fairy lights.': '各LED（プレイヤーLEDを除く）が、下の最初の6色の間をゆっくりと変化します。フェアリーライトのような効果です。',
  'This controller is using an effect this app doesn’t know about.': 'このコントローラーは、このアプリが認識できない効果を使用しています。',

  // Brightness & timing
  'Brightness & timing': '明るさとタイミング',
  'Changes apply instantly — press Save to keep them.': '変更はすぐに反映されます。保持するには「保存」を押してください。',
  'Brightness': '明るさ',
  'How bright the LEDs are, from off to full.': 'LEDの明るさです（オフから最大まで）。',
  'To save battery, the controller limits brightness to about a third while connected wirelessly.': 'バッテリー節約のため、ワイヤレス接続中は明るさが約3分の1に制限されます。',
  'Animation time': 'アニメーション時間',
  'How long one animation step or fade takes, in milliseconds. Lower is faster.': 'アニメーションの1ステップまたはフェードにかかる時間（ミリ秒）です。小さいほど速くなります。',
  'ms': 'ms',
  'Idle glow': 'アイドル時の点灯',
  'After a while without input the lights go dark and a single LED glows to show battery status. Turn off to keep it dark too.': 'しばらく入力がないとライトが消え、1つのLEDだけがバッテリー状態を示して点灯します。オフにすると、そのLEDも消灯します。',
  'Cyan = on battery, orange = charging, green = fully charged.': 'シアン＝バッテリー駆動、オレンジ＝充電中、緑＝充電完了。',

  // Colors
  'Colors': 'カラー',
  'One color per LED group. Tap a swatch to pick, or type a hex code.': 'LEDグループごとに1色です。スウォッチをタップして選ぶか、16進コードを入力してください。',
  'Group {n}': 'グループ{n}',
  '{name} color': '{name}の色',
  'Player': 'プレイヤー',
  'These LEDs also show your player number when connected and chase while pairing, using this color.': 'これらのLEDは、接続中はプレイヤー番号を表示し、ペアリング中はこの色で流れるように点灯します。',
  'Always shows this color, in every mode.': 'どのモードでも常にこの色で点灯します。',
  'Unused': '未使用',
  'Fairy {n}': 'フェアリー{n}',
  'Authentic mode picks its own colors, so your colors are ignored, except the Player LED.': 'オーセンティックモードでは色が自動で決まるため、プレイヤーLED以外は設定した色が使われません。',
  'Your colors are ignored in Rainbow mode, except the Player LED.': 'レインボーモードでは、プレイヤーLED以外は設定した色が使われません。',
  'Fairy mode blends between the first six colors below. The Player LED always keeps its own color.': 'フェアリーモードでは、下の最初の6色の間で色が変化します。プレイヤーLEDは常に設定した色のままです。',
  'Quick palettes': 'クイックパレット',
  'Color presets': 'カラープリセット',
  'Ocean': 'オーシャン',
  'Sunset': 'サンセット',
  'Lavender': 'ラベンダー',
  'Snow': 'スノー',
  'Apply the {name} palette': '{name}パレットを適用',
  '{name} colors applied': '{name}カラーを適用しました',
  'Undo': '元に戻す',
  'Paste to all': 'すべてに貼り付け',
  'Pasting…': '貼り付け中…',
  'Pasted': '貼り付けました',
  'No color': '色がありません',
  'Set every group to a hex color from your clipboard': 'クリップボードの16進カラーをすべてのグループに設定',
  'Clipboard access was blocked. Copy a hex color like #FF8800 and try again.': 'クリップボードへのアクセスがブロックされました。#FF8800 のような16進カラーをコピーして、もう一度お試しください。',
  'The clipboard doesn’t contain a hex color like #FF8800.': 'クリップボードに #FF8800 のような16進カラーが含まれていません。',
  'All group colors': '全グループの色',
  'Set every LED group to the same color at once (like hoja2’s “Paste All”).': 'すべてのLEDグループを一度に同じ色に設定します（hoja2の「Paste All」と同様）。',
};
