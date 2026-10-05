# Translation review checklist (Spanish · Japanese)

All Spanish and Japanese text is a machine-drafted first pass. A native speaker should review the dictionaries in
`src/i18n/locales/{es,ja}/` — start with the items below, which the translators flagged as uncertain. Terminology
lives in `src/i18n/GLOSSARY.md`; update it when a decision is made so future strings stay consistent.

Preview any page in a language with `?lang=es` or `?lang=ja` (e.g. `http://localhost:5173/?demo&lang=ja#/rgb`).

## Cross-area consistency (decide once, then align every area file)

- [ ] **Idle glow** — RGB uses es "Brillo en reposo" / ja "待機中の発光"?; Battery uses es "luz en reposo". Pick one.
- [ ] **Charger chip / PMIC** — es "Chip cargador"; ja 充電チップ vs core's 充電器（PMIC）.
- [ ] **Fuel gauge** — es "medidor de carga"; ja 残量計 (tip: フューエルゲージ).
- [ ] **Japanese spacing around Latin words** — standardizing on no spaces (Bluetoothの…).
- [ ] **Page names used inside sentences** — Save = Guardar / 保存, Wireless = Inalámbrico / ワイヤレス, Input = Entrada / 入力.

## Gamepad · RGB · User · Haptics

Spanish
- [ ] "Con la app" (the "Config app" badge)
- [ ] Effect names: Auténtico, Estático, Arcoíris, Reactivo, Hadas / "Hada {n}" / "luces de hadas" (maybe "luces navideñas")
- [ ] "Carcasa" / "Agarre" (Switch body / grip colors)
- [ ] "Reiniciar en bootloader"
- [ ] "Gatillo L: al soltar" (trigger release)
- [ ] "Sur" (South button)
- [ ] "Aviso de WebUSB"

Japanese
- [ ] "A（下ボタン）" / "Aまたは下" for "A (South)"
- [ ] Effect names: オーセンティック, 固定色, リアクト, フェアリー
- [ ] "アプリ対応" (badge), "設定アプリ" (config app), "警告：" (callout title)
- [ ] "MACアドレス（ベース）", "トリガー振動", "Lトリガー：リリース", "SNES / スーパーファミコン"

## Motion · Battery · Wireless

- [ ] Calibration step "Press Start." is read as the dialog's Start button (es “Iniciar calibración”, ja 「キャリブレーション開始」)
- [ ] Japanese badges: 未搭載 (not present), 非アクティブ (inactive), 未チェック (not checked), 動作中 (active)
- [ ] Spanish: "dongle", "Puerto serial", "driver" (instead of "controlador", which clashes with "control"), "Grabando…" (flashing)
- [ ] Spanish image names mid-sentence without articles ("Descargando tabla de particiones…")
- [ ] Japanese: "Dismiss" and "Close" are both 閉じる; "Ready" = 準備完了
- [ ] FCC statement reference translations (English stays the official text)

## Core · Home · Settings · About · Firmware

Spanish
- [ ] "Compilación" for "build" (installed/latest build, loading builds…)
- [ ] "Ocultar" (Dismiss), "Luces y respuesta" (Lights & feedback group), "Vibración" (Haptics title)
- [ ] "Restablecimiento total — borrar la flash (nuke)"

Japanese
- [ ] "操作" (Controls group), "A（下）" / "{south}ボタン" (South), "見てみる" (Explore), "このアプリについて" (About)
- [ ] "対戦アクション風" wording in the Arena summary

Both
- [ ] Text naming OS/browser menus: iOS "Agregar a inicio", Chrome "Instalar app", folder dialog "Select / Open"
      (Seleccionar / Abrir, 「選択」「開く」) — real labels vary by OS version
- [ ] Setting-validation errors in the apply dialog stay English on purpose (they include setting keys and are shared with AI assistants)

## Joysticks · Snapback

Spanish
- [ ] "Zona de anclaje" (snap zone), "posición" (angle-map slot)
- [ ] "Suelta de golpe el joystick…" (Flick the stick…)
- [ ] "Sobreimpulso" (overshoot), "Estable en" (settled), "Pasa bajos" (low-pass), "Frecuencia de corte" (cutoff)
- [ ] "Trazo" (trace), "guía" (gate); capitalized stick names mid-sentence ("Salida de Joystick izquierdo")
- [ ] Decimal comma from locale formatting (91,8 %) vs a few static texts that say "1.00"

Japanese
- [ ] スナップ範囲 (snap zone), ノッチ (notch), 収束 (settled), 軌跡 (trace), 位置を読み上げ (announce position)

## Input

- [ ] Plus/Minus: es "Botón +/−", ja "+ボタン/−ボタン"
- [ ] Capture/Back/Guide/Share: es "Captura/Atrás/Guía/Compartir", ja "キャプチャー/バック/ガイド/シェア"
- [ ] South/East/West/North: es "Sur/Este/Oeste/Norte", ja "下/右/左/上ボタン"
- [ ] "S Guide" (es "Guía S", ja "Sガイド"); "Misc 3 (power)" (es "Varios 3 (encendido)", ja "その他3（電源）")
- [ ] "Rapid trigger" kept in English in Spanish (tile pill "Rapid")
- [ ] Live meter states: es "Presionado/Suelto", ja "押下中/未入力"
- [ ] ja "{mode}モードでの送信先" used for both "sends in {mode} mode" and "Send in {mode} mode"
- [ ] Hall effect: es "efecto Hall", ja "ホール効果"

<!-- More sections are appended as each area's translator reports. -->
