/**
 * Japanese translations — snapback. English source text → translation.
 * Machine-drafted; NEEDS NATIVE REVIEW. Terminology: src/i18n/GLOSSARY.md.
 */
export default {
  // ---- Shared / generic (duplicated here so this area is complete on its own) ----
  'Left': '左',
  'Right': '右',
  'Stick': 'スティック',
  'Left stick': '左スティック',
  'Right stick': '右スティック',
  'Off': 'オフ',
  'View': '表示',

  // ---- View ----
  'Auto watches for the moment you let go and holds back only the rebound — there is no cutoff to tune.': '「自動」は手を離した瞬間を検出し、跳ね返りだけを抑えます。調整するカットオフはありません。',
  'Filter off: the stick reports its raw output. Use this to see your stick’s natural snapback.': 'フィルターオフ：スティックは生の出力を送ります。スティック本来のスナップバックを確認するときに使います。',
  'Snapback filter': 'スナップバックフィルター',
  'Changes apply instantly — press Save to keep them.': '変更はすぐに反映されます。保持するには「保存」を押してください。',
  '{stick}: snapback waveform': '{stick}：スナップバック波形',
  'Flick the right stick…': '右スティックを弾いてください…',
  'Flick the left stick…': '左スティックを弾いてください…',
  'No capture yet': 'まだ記録がありません',
  'Recent right stick captures': '右スティックの最近の記録',
  'Recent left stick captures': '左スティックの最近の記録',
  'Waiting for the right stick to be flicked and released.': '右スティックを倒して離すのを待っています。',
  'Waiting for the left stick to be flicked and released.': '左スティックを倒して離すのを待っています。',
  'Listening': '待機中',
  'Overshoot': 'オーバーシュート',
  'How far the stick swung past center to the other side after release. Lower is better.': '離した後にスティックが中心を越えて反対側へ振れた量。小さいほど良好です。',
  'Settled': '収束',
  'Time until the stick stays within ±5 % of center.': 'スティックが中心から ±5 % 以内に収まるまでの時間。',
  'Peak +': 'ピーク +',
  'Highest value recorded.': '記録された最大値。',
  'Peak −': 'ピーク −',
  'Lowest value recorded.': '記録された最小値。',
  '{axis} at {time}': '{axis}（{time}）',
  'Analyzer': 'アナライザー',
  'What the right stick does in the 31 ms after you let go.': '右スティックを離した後 31 ms の動き。',
  'What the left stick does in the 31 ms after you let go.': '左スティックを離した後 31 ms の動き。',
  'Captured': '記録しました',
  'Flick again to compare — the last few captures stay below the plot.': 'もう一度弾いて比較できます。直近の記録はグラフの下に残ります。',
  'New right stick capture': '右スティックの新しい記録',
  'New left stick capture': '左スティックの新しい記録',
  'How to test:': 'テスト方法：',
  'Push a stick all the way to one side and let it snap back. The controller records the moment it returns and shows it under that stick. Try each filter mode to compare.': 'スティックを片側いっぱいまで倒して離し、戻らせます。戻る瞬間をコントローラーが記録し、そのスティックの下に表示します。各フィルターモードを試して比較してください。',

  // ---- Waveform ----
  'Left stick X': '左スティック X',
  'Left stick Y': '左スティック Y',
  'Right stick X': '右スティック X',
  'Right stick Y': '右スティック Y',
  'Snapback waveform': 'スナップバック波形',
  'Waiting for a flick…': 'スティックを弾くのを待っています…',

  // ---- Settings (settings.js) ----
  'Filter mode': 'フィルターモード',
  'How the left stick suppresses the rebound past center after you let go.': '左スティックを離した後、中心を越える跳ね返りをどう抑えるか。',
  'How the right stick suppresses the rebound past center after you let go.': '右スティックを離した後、中心を越える跳ね返りをどう抑えるか。',
  'Low-pass: smooths fast movement near the center (adjust with the cutoff). Auto: detects a release and holds back the rebound only when it happens. Off: raw stick output — use this to see your stick’s natural snapback.': 'ローパス：中心付近の速い動きを滑らかにします（カットオフで調整）。自動：離した瞬間を検出し、そのときだけ跳ね返りを抑えます。オフ：スティックの生の出力。スティック本来のスナップバックを確認するときに使います。',
  'Low-pass': 'ローパス',
  'Auto': '自動',
  'Filter cutoff': 'カットオフ周波数',
  'Low-pass cutoff frequency for the left stick. Lower = stronger smoothing.': '左スティックのローパスカットオフ周波数。低いほど強く平滑化します。',
  'Low-pass cutoff frequency for the right stick. Lower = stronger smoothing.': '右スティックのローパスカットオフ周波数。低いほど強く平滑化します。',
  'Lower values remove more bounce but add a touch of delay to fast flicks near the center; higher values feel snappier but let more rebound through. Default 60 Hz. Only used in Low-pass mode.': '低い値は跳ね返りをより除去しますが、中心付近の素早い操作にわずかな遅延が生じます。高い値は反応が軽快になる一方、跳ね返りが残りやすくなります。デフォルトは 60 Hz。ローパスモードでのみ使用します。',
  'Hz': 'Hz',
};
