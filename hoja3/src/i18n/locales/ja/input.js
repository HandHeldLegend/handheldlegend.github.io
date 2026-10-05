/**
 * Japanese translations — input. English source text → translation.
 * Machine-drafted; NEEDS NATIVE REVIEW. Terminology: src/i18n/GLOSSARY.md.
 */
export default {
  // ---- Page, tabs, mode card (view.js) ----
  'Remap': '割り当て変更',
  'Analog calibration': 'アナログキャリブレーション',
  'Output mode': '出力モード',
  '{mode} mode': '{mode}モード',
  '{mode}:': '{mode}：',
  'Each mode has its own layout. Pick the one you play in, then tap a button below to change it.':
    'モードごとに個別の配置があります。プレイするモードを選び、下のボタンをタップして変更してください。',
  'Reset this mode': 'このモードをリセット',
  'Reset {mode}': '{mode}をリセット',
  'Reset all modes': 'すべてのモードをリセット',
  'Quickly reset this mode to its default layout.': 'このモードをデフォルトの配置にすばやく戻します。',
  'Reset every mode?': 'すべてのモードをリセットしますか？',
  'Reset {mode} mode?': '{mode}モードをリセットしますか？',
  'All six layouts go back to this controller\'s defaults. Your changes in every mode are lost.':
    '6つの配置すべてがこのコントローラーのデフォルトに戻ります。すべてのモードでの変更は失われます。',
  'Every input in {mode} mode goes back to this controller\'s default layout and settings. Other modes are not affected.':
    '{mode}モードのすべての入力が、このコントローラーのデフォルトの配置と設定に戻ります。他のモードには影響しません。',
  'All modes reset to defaults — press Save to keep it.': 'すべてのモードをデフォルトに戻しました。保持するには「保存」を押してください。',
  '{mode} mode reset to defaults — press Save to keep it.': '{mode}モードをデフォルトに戻しました。保持するには「保存」を押してください。',
  'The controller did not confirm the reset. Try again.': 'コントローラーがリセットを確認しませんでした。もう一度お試しください。',
  'Reset': 'リセット',
  'Done': '完了',
  'Save': '保存',
  'Cancel': 'キャンセル',
  'This controller doesn\'t have a {mode} connection, so this layout is only kept for completeness.':
    'このコントローラーには{mode}接続がないため、この配置は参考として保持されているだけです。',

  // ---- Mode descriptions (mapping.js) ----
  'Nintendo Switch, and Switch Pro mode on PC.': 'Nintendo Switch、およびPCでのSwitch Proモード。',
  'Windows PCs and Xbox-style games.': 'Windows PCとXbox形式のゲーム。',
  'SNES / NES consoles through the controller port.': 'コントローラーポート経由のSNES / NES本体。',
  'Nintendo 64 through the controller port.': 'コントローラーポート経由のNintendo 64。',
  'GameCube / Wii through the controller port, and GameCube adapter (Slippi) mode over USB.':
    'コントローラーポート経由のGameCube / Wii、およびUSBでのGameCubeアダプター（Slippi）モード。',
  'Steam mode for Steam and SDL games on PC (supports paddles and extra buttons).':
    'PCのSteamおよびSDLゲーム向けのSteamモード（パドルと追加ボタンに対応）。',

  // ---- Input grid ----
  'Buttons & inputs': 'ボタンと入力',
  'What each input sends.': '各入力が送信する内容です。',
  'What each input sends in {mode} mode. Pressed inputs light up.': '{mode}モードで各入力が送信する内容です。押している入力は点灯します。',
  'Buttons': 'ボタン',
  'Analog inputs': 'アナログ入力',
  'Stick directions': 'スティック方向',
  'Hall-effect inputs that measure how far they are pressed, such as analog triggers. They can act as a button with an adjustable activation point, as rapid trigger, or as a full analog output.':
    'アナログトリガーなど、押し込み量を測定するホール効果入力です。作動ポイントを調整できるボタン、ラピッドトリガー、またはフルアナログ出力として使えます。',
  'Each stick direction can be sent somewhere else too — for example to the d-pad or a button.':
    'スティックの各方向も、十字キーやボタンなど別の出力に割り当てられます。',
  'This controller did not report any remappable inputs.': 'このコントローラーから割り当て変更できる入力が報告されませんでした。',
  '{input} sends {output} in {mode} mode.': '{input}は{mode}モードで{output}を送信します。',
  '{input} is off in {mode} mode.': '{input}は{mode}モードでオフです。',
  'Threshold mode, activation point {value}.': 'しきい値モード、作動ポイント{value}。',
  'Rapid trigger mode.': 'ラピッドトリガーモード。',
  'Full analog mode.': 'フルアナログモード。',
  'Threshold {value}': 'しきい値 {value}',
  'Rapid': 'ラピッド',
  'Analog inputs need calibration.': 'アナログ入力のキャリブレーションが必要です。',
  'Calibrate them so presses register across their full travel.': 'ストローク全体で押し込みを検出できるよう、キャリブレーションしてください。',
  'Calibrate now': '今すぐキャリブレーション',
  'Needs calibration': 'キャリブレーションが必要',
  'Close editor': 'エディターを閉じる',
  'Pick an input': '入力を選択',
  'Choose a button on the left to see what it does and change it.': '左側のボタンを選ぶと、その動作を確認・変更できます。',

  // ---- Editor (editor.js) ----
  '{input} in {mode} mode': '{mode}モードの{input}',
  'sends in {mode} mode': '{mode}モードでの送信先',
  'Change': '変更',
  'Nothing': 'なし',
  'Input disabled in this mode': 'このモードでは入力が無効です',
  'Send in {mode} mode': '{mode}モードでの送信先',
  'Outputs in {mode} mode': '{mode}モードの出力',
  'None': 'なし',
  'Disable this input in this mode': 'このモードでこの入力を無効にする',
  'used by {inputs}': '{inputs}で使用中',
  'D-pad': '十字キー',
  'Analog triggers': 'アナログトリガー',
  'Live': 'ライブ',
  'What the controller reports for this input with the current settings. Press it to test.':
    '現在の設定でコントローラーがこの入力について報告している値です。押してテストしてください。',
  '{input} live value': '{input}のライブ値',
  'Pressed': '押下中',
  'Released': '未入力',
  'Mode': 'モード',
  'Analog mode': 'アナログモード',
  'Presses as soon as it moves down, and releases as soon as it starts coming back up — great for fast repeated presses.':
    '押し下げ始めた瞬間にオンになり、戻り始めた瞬間にオフになります。すばやい連打に最適です。',
  'Counts as pressed once it passes the activation point, like a normal button with an adjustable trigger point.':
    '作動ポイントを超えると押下と判定されます。作動位置を調整できる通常のボタンのように動作します。',
  'Sends the full analog travel, so games see exactly how far it is pressed.':
    'アナログのストローク全体を送信するため、ゲームは押し込み量を正確に認識できます。',
  'Pick an output to set how this analog input behaves.': '出力を選ぶと、このアナログ入力の動作を設定できます。',
  'Rapid trigger sensitivity': 'ラピッドトリガー感度',
  'Activation point': '作動ポイント',
  'How far it has to travel to change state: down this much to press, back up this much to release. Smaller = quicker re-presses, but more sensitive to light touches.':
    '状態が切り替わるのに必要な移動量です。この分だけ押し下げるとオン、この分だけ戻るとオフになります。小さいほど再入力が速くなりますが、軽く触れただけでも反応しやすくなります。',
  'How far you press before it counts. {half} is halfway down.': '押下と判定されるまでの押し込み量です。{half}で半分です。',
  'Travel needed to press or release.': 'オン／オフに必要な移動量です。',
  'How far down it must go to count as pressed.': '押下と判定されるのに必要な押し込み量です。',
  'Output when pressed': '押したときの出力',
  'How far {output} is pushed when this input fires.': 'この入力が作動したときの{output}の出力量です。',
  'In GameCube mode, analog triggers driven this way always output at least {min} (the console\'s resting minimum).':
    'GameCubeモードでは、この方法で動かすアナログトリガーは常に{min}以上を出力します（本体の待機時の最小値）。',
  'Copy settings': '設定をコピー',
  'Paste settings': '設定を貼り付け',
  'Copy this input\'s mode and values, then paste them onto another analog input.':
    'この入力のモードと値をコピーして、別のアナログ入力に貼り付けられます。',
  'Settings copied — open another analog input and press Paste.': '設定をコピーしました。別のアナログ入力を開いて「設定を貼り付け」を押してください。',
  'Settings copied inside the app (clipboard access was blocked).': 'アプリ内に設定をコピーしました（クリップボードへのアクセスがブロックされました）。',
  'Nothing to paste — copy an analog input\'s settings first.': '貼り付ける内容がありません。先にアナログ入力の設定をコピーしてください。',
  'Settings pasted.': '設定を貼り付けました。',
  'Calibration': 'キャリブレーション',
  'Calibrate': 'キャリブレーション',
  'Finish': '完了',
  'Calibrating all…': 'すべてキャリブレーション中…',
  'Press Calibrate, push it all the way down and release 3–4 times, then press Finish.':
    '「キャリブレーション」を押し、奥まで押し込んで離す動作を3～4回繰り返してから「完了」を押してください。',

  // ---- Input / output kinds and analog modes (mapping.js) ----
  'Button': 'ボタン',
  'Analog': 'アナログ',
  'Stick direction': 'スティック方向',
  'Off': 'オフ',
  'Disabled': '無効',
  'Analog trigger': 'アナログトリガー',
  'Rapid trigger': 'ラピッドトリガー',
  'Threshold': 'しきい値',
  'Full analog': 'フルアナログ',

  // ---- Output names (descriptive ones; printed button names stay as-is) ----
  'D Up': '十字キー上',
  'D Down': '十字キー下',
  'D Left': '十字キー左',
  'D Right': '十字キー右',
  'Plus': '+ボタン',
  'Minus': '−ボタン',
  'Capture': 'キャプチャー',
  'Back': 'バック',
  'Guide': 'ガイド',
  'Share': 'シェア',
  'South': '下ボタン',
  'East': '右ボタン',
  'West': '左ボタン',
  'North': '上ボタン',
  'C Up': 'C上',
  'C Down': 'C下',
  'C Left': 'C左',
  'C Right': 'C右',
  'S Guide': 'Sガイド',

  // ---- Output hints ----
  'Left trigger (analog)': '左トリガー（アナログ）',
  'Right trigger (analog)': '右トリガー（アナログ）',
  'L trigger (analog)': 'Lトリガー（アナログ）',
  'R trigger (analog)': 'Rトリガー（アナログ）',
  'L trigger click (digital)': 'Lトリガーのクリック（デジタル）',
  'R trigger click (digital)': 'Rトリガーのクリック（デジタル）',
  'Left trigger (digital)': '左トリガー（デジタル）',
  'Right trigger (digital)': '右トリガー（デジタル）',
  'Left paddle 1': '左パドル1',
  'Right paddle 1': '右パドル1',
  'Left paddle 2': '左パドル2',
  'Right paddle 2': '右パドル2',
  'Misc 3 (power)': 'その他3（電源）',
  'Misc 4': 'その他4',
  'Misc 5': 'その他5',
  'Misc 6': 'その他6',
  'Touchpad 1': 'タッチパッド1',
  'Touchpad 2': 'タッチパッド2',
  'Stick left': '左スティック',
  'Stick right': '右スティック',

  // ---- Calibration tab (calibration.js) ----
  'Teach the controller the full travel of its analog (hall-effect) inputs, such as triggers.':
    'トリガーなどのアナログ（ホール効果）入力のストローク全体をコントローラーに記憶させます。',
  'Start calibration': 'キャリブレーション開始',
  'Finish calibration': 'キャリブレーション終了',
  'Press {button}.': '{button}を押します。',
  'Fully press and release every analog input below 3–4 times.': '下のすべてのアナログ入力を、奥まで押して離す動作を3～4回繰り返します。',
  'Check each bar now reaches both ends, then press {button}.': '各バーが両端まで届くことを確認してから、{button}を押します。',
  'Calibrating.': 'キャリブレーション中です。',
  'Fully press and release every analog input 3–4 times, then press Finish.':
    'すべてのアナログ入力を奥まで押して離す動作を3～4回繰り返してから、「キャリブレーション終了」を押してください。',
  'Calibrating…': 'キャリブレーション中…',
  'Calibrated': 'キャリブレーション済み',
  'Range {min}–{max}': '範囲 {min}～{max}',
  'Not calibrated': '未キャリブレーション',
  'This controller has no analog inputs to calibrate.': 'このコントローラーにはキャリブレーションするアナログ入力がありません。',
  'The controller did not start calibrating. Try again.': 'コントローラーがキャリブレーションを開始しませんでした。もう一度お試しください。',
  'Calibration finished — press Save to keep it.': 'キャリブレーションが完了しました。保持するには「保存」を押してください。',
  'The controller did not confirm the calibration.': 'コントローラーがキャリブレーションを確認しませんでした。',
};
