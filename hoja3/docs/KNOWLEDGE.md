# HHL Gamepad Config — troubleshooting knowledge base

Customer-facing answers for HOJA-firmware controllers and the HHL Gamepad Config app. Each `##` section is one
topic; the comment under the heading gives its id (used by the MCP `troubleshoot` tool and
`hhl://knowledge/<id>` resources) and search keywords. Links like `#/joysticks` are app deep links — the MCP
server expands them to full URLs.

Writing rules: only state what the app and firmware actually do. If a step depends on the specific controller,
point the customer to the controller’s manual (the Firmware page shows a **Manual** link when the controller
provides one).

## Connecting a controller
<!-- topic: connecting; keywords: connect, connection, picker, not showing, not found, no device, access denied, busy, can't connect, won't connect, usb -->

1. Use a supported browser — Chrome, Edge, Opera or another Chromium browser on desktop or Android (see
   `browser-support`).
2. Plug the controller in with a USB **data** cable (see `data-cables`).
3. Press **Connect** (top bar or [Home](#/)) and pick the controller in the browser’s device list.
4. If it isn’t listed or connecting fails: unplug it, hold **A** (the South button) while plugging it back in,
   then try again (see `config-mode`). Only Switch and Steam modes talk to the app (see `modes`).
5. “The controller is busy in another tab or app” means something else has it open — close other tabs of the app
   (or other configuration tools) and try again.

When connected, the top bar shows the controller name and Home shows its firmware build and anything that needs
attention (for example “Joysticks need calibration”). The app also checks for a firmware update on every connect.

A controller that appears as **RP2 Boot** / **RPI-RP2** / **RP2350** is in its bootloader, not running HOJA — see
`firmware-update` or `install-hoja`.

## Browser support (WebUSB)
<!-- topic: browser-support; keywords: webusb, browser, chrome, edge, firefox, safari, opera, brave, android, not supported, usb isn't available, chromium -->

The app talks to controllers with **WebUSB**, which only Chromium-based browsers provide:

- **Works:** Chrome, Edge, Opera and other Chromium browsers on Windows, macOS, Linux, ChromeOS and Android.
- **Doesn’t work:** Safari, Firefox, and every browser on iPhone/iPad (see `ios`).

If the app says “USB isn’t available in this browser”, switch browsers. The app must be opened over **https**
(the official site) or `http://localhost`; firmware flashing also needs this “secure context”, and the RPI-RP2
folder picker refuses raw IP addresses.

Without USB you can still explore everything with the demo controller (`?demo`, or **Try the demo** on Home) and
use the [Arena](#/arena).

## Hold A (South) while plugging in
<!-- topic: config-mode; keywords: hold a, south, plug in, boot mode, config mode, start in, recover mode, wrong mode, default mode -->

Holding **A** (on Switch-style layouts; the **South** face button on others) while plugging the controller in
starts it in a mode the config app can talk to. Use it when:

- the controller doesn’t show up or won’t connect;
- you changed **Default mode** on the [Gamepad](#/gamepad) page to something other than Switch or Steam
  (XInput, Slippi, GameCube, N64, SNES) — those modes don’t talk to the app.

Keep holding the button until the controller has powered up, then press **Connect**.

## Which modes work with the app
<!-- topic: modes; keywords: mode, output mode, switch, steam, sinput, xinput, slippi, gamecube, n64, snes, default mode, which modes -->

Only **Switch** and **Steam** modes talk to HHL Gamepad Config (Steam mode is also called SInput in firmware and older docs). The other output modes — **XInput**
(Xbox-style for Windows PCs), **Slippi** (GameCube adapter mode for Slippi/Dolphin), **GameCube**, **N64** and
**SNES** — are for playing, not configuring.

- **Default mode** ([Gamepad](#/gamepad)) chooses the mode the controller starts in. After changing it to a
  non-config mode, hold A (South) while plugging in to get back to the app (see `config-mode`).
- Button mapping is stored **per output mode**: on the [Input](#/input) page choose the profile
  (`#/input?mode=switch|xinput|snes|n64|gamecube|sinput`) before remapping.
- Native GameCube/N64 and SNES output only exist on controllers with that hardware support.

## USB data cables
<!-- topic: data-cables; keywords: cable, usb cable, charge only, charging cable, data cable, hub, adapter, nothing happens -->

Many USB cables only carry power. If the controller charges or lights up but never appears in the browser’s
device list, try a cable you know transfers data (for example one that works for file transfer with a phone).
Plugging straight into the computer instead of through a hub or adapter can also help rule out problems.

## Stick calibration
<!-- topic: stick-calibration; keywords: calibrate, calibration, joystick, stick, range, corners, circle, octagon, notches, angles, needs calibration -->

Open [Joysticks](#/joysticks) (`#/joysticks?stick=left&tab=calibrate`). The app flags “Joysticks need
calibration” on Home when the controller has never been calibrated.

1. Start calibration (**Calibrate**). Both sticks are calibrated together.
2. Move **both** sticks slowly in full circles, all the way to the edge, several times.
3. Press **Stop**.
4. Check the live view: both sticks should reach the full output range and rest in the center.
5. Press **Save** so the calibration survives unplugging (see `saving`).

Notched/gated sticks can fine-tune their angle map on the same page (capture an angle by holding the stick in the
notch). Resetting angles also resets calibration to defaults, so recalibrate afterwards. Axis inversion is only
offered when the firmware allows it.

## Stick drift
<!-- topic: stick-drift; keywords: drift, drifting, moving on its own, deadzone, center, center, jitter, not centered, stick drift -->

1. **Recalibrate first** (see `stick-calibration`) — most drift is a stale calibration.
2. If the stick still creeps when untouched, raise the **inner deadzone** for that stick on
   [Joysticks](#/joysticks) a little at a time (`joysticks.leftDeadzone` / `joysticks.rightDeadzone`). Too much
   deadzone makes small movements feel dead.
3. If the stick doesn’t reach the edges, lower the **outer deadzone** or recalibrate.
4. Watch the live view (or the [Arena](#/arena) input display) to confirm, then **Save**.

If the stick “bounces” past center when released rather than drifting, that’s snapback (see `snapback`).

## Snapback (stick bounce on release)
<!-- topic: snapback; keywords: snapback, bounce, rebound, release, melee, dash back, flick, low-pass, lpf, filter, cutoff -->

When a stick is let go it can spring past center for a moment; games may read that as an input (a classic
example is an unwanted dash-back in Melee). The [Snapback](#/snapback) page (`#/snapback?stick=left`) filters it
per stick:

- **Low-pass** (default): smooths fast movement near the center. **Filter cutoff** 30–150 Hz (default 60 Hz):
  lower removes more bounce but adds a touch of delay to fast flicks; higher feels snappier but lets more
  rebound through.
- **Auto**: detects a release and holds back the rebound only when it happens.
- **Off**: raw stick output — useful to see the stick’s natural snapback.

Calibrate the sticks first, then tune snapback while watching the live analyzer, and **Save**.

## Analog trigger calibration
<!-- topic: trigger-calibration; keywords: trigger, triggers, analog trigger, hall effect, hover, rapid trigger, threshold, calibrate triggers, analog inputs need calibration -->

Controllers with analog (hall-effect) inputs calibrate them on the [Input](#/input) page. Home shows “Analog
inputs need calibration” when they haven’t been.

1. Start calibration of all analog inputs (**Start**).
2. Fully press and release every analog input (triggers, analog buttons) 3–4 times.
3. Press **Stop** and check each input reaches its full range.
4. **Save**.

Each analog input mapped to a button can then use **Threshold** (press registers past a set point) or **Rapid**
(rapid trigger: re-triggers after moving back by a set delta). On controllers with HD haptics, **Trigger
haptics** (`haptics.triggerFeedback`) pulses when a trigger passes that threshold or delta.

## Updating firmware
<!-- topic: firmware-update; keywords: update, firmware, upgrade, bootloader, bootsel, rpi-rp2, rp2350, uf2, flash, update mode, picoboot, interrupted, info_uf2 -->

The app checks for new firmware each time a controller connects; Home and [Firmware](#/firmware) show **Update
available**. Downloads need an internet connection. Keep the controller plugged in throughout.

1. Press **Update now** → **Enter update mode**. The controller restarts into its bootloader.
2. Flashing usually starts by itself. If the browser asks, press **Update** and allow access to the Pico
   bootloader (shown as **RP2 Boot**).
3. If direct USB flashing is blocked (common on Windows), the app switches to the **RPI-RP2 drive** method: press
   **Select RPI-RP2**, and in the folder dialog open the drive named **RPI-RP2** (or **RP2350**) — you should see
   `INFO_UF2.TXT` inside — and choose it. Don’t pick Downloads or Documents.
4. Last resort (no folder picker): **Download UF2**, then copy the file onto the RPI-RP2/RP2350 drive in your file
   manager. The controller reboots when the copy finishes and the drive disappears — that’s normal.
5. When it says **Update complete**, give the controller a moment to restart and press **Connect**.

Older controllers whose firmware the app can’t configure are prompted to update before settings unlock.
If an update is interrupted, see `nuke-recovery` — boards are very hard to permanently brick.

## Installing HOJA on a blank board
<!-- topic: install-hoja; keywords: install, blank board, new build, diy, pico, bootsel, boot pads, rp2 boot, choose build, wrong build, brick -->

From [Firmware](#/firmware) (`#/firmware?build=<id>` preselects a build):

1. Unplug the controller (and remove the battery if it has one).
2. Hold the **BOOTSEL** button (or bridge the boot pads) and plug it in. A drive named **RPI-RP2** or **RP2350**
   appears.
3. Press **Select bootloader** and pick the **RP2 Boot** device — the installer opens.
4. Choose your exact controller build, tick the warning box, then **Install**. The same RPI-RP2 drive steps as an
   update may follow (see `firmware-update`).

Pick the right build: firmware made for different hardware can stop the controller working until it’s re-flashed
from BOOTSEL. Use the `list_firmware_builds` tool (or the Firmware page) for build names. Manual UF2 downloads are
also on the Firmware page for copying onto the drive yourself.

## Recovery and full reset (nuke)
<!-- topic: nuke-recovery; keywords: nuke, recover, recovery, bricked, brick, stuck, bootloader loop, corrupted, factory reset, erase, wipe, interrupted update, restart from bootloader -->

- **Stuck in the bootloader** after an interrupted update: on [Firmware](#/firmware) press **Restart from
  bootloader**, or reinstall from the installer (see `install-hoja`). If restarting fails, unplug and replug.
- **Still misbehaving after reinstalling:** in the installer choose **Full reset — erase flash (nuke)**. It wipes
  the whole flash, including all settings and calibration. Then enter BOOTSEL again and install your build, and
  recalibrate sticks and triggers.
- Controllers running legacy firmware the app doesn’t recognize are recovered the same way: Firmware → Install
  with BOOTSEL.

## Wireless and pairing
<!-- topic: wireless-pairing; keywords: wireless, bluetooth, pair, pairing, esp32, baseband, wireless module, dongle, wlan, pin, mac address -->

The [Wireless](#/wireless) page appears for controllers with Bluetooth hardware. It shows the wireless chip
status and, on controllers with an updatable external wireless module (ESP32), its firmware version — Home flags
“Wireless module update available” when a newer one exists.

- **WLAN dongle PIN** (`wireless.dongleKey`, 0000–9999): the controller and the WLAN dongle must use the **same**
  4-digit PIN. Pick one that differs from friends’ controllers nearby.
- **MAC address**: the base address used for USB and Bluetooth modes (each mode uses its own increment). Changing
  it can break existing pairings, so it isn’t settable by link.
- The app doesn’t pair the controller with a console or PC itself; follow the controller’s manual for the pairing
  steps (the Firmware page links it when available). The firmware remembers the paired host separately for
  Switch and Steam modes.

## Battery status
<!-- topic: battery-status; keywords: battery, charging, charged, discharging, pmic, fuel gauge, not present, not responding, no battery, unconfirmed, led color, percent, n/a -->

The [Battery](#/battery) page appears when the controller reports a battery.

- **Charging state:** Discharging (on battery), Charging, or Fully charged.
- **Charger (PMIC):**
  - *Active* — working with a battery present.
  - *Active · No battery* — the charger works but no pack is attached. **Not an error** (e.g. running on USB).
  - *Active · Battery unconfirmed* — the charger can’t confirm the pack.
  - *Not responding* — the charger didn’t answer. Also expected in boot modes that skip battery setup.
  - *Not present* — this build has no charger driver.
  - The battery pack is checked once at power-up; replug after connecting a battery.
- **Fuel gauge:** Active, Inactive or Not present. The percentage only shows with an active fuel gauge (otherwise
  N/A).
- **Status LED** (when the RGB idle glow is on): cyan = on battery, orange = charging, green = fully charged.

## Saving settings
<!-- topic: saving; keywords: save, saved, lost settings, reset after unplug, changes disappeared, not saving, persist, flash, apply -->

Every change is sent to the controller **immediately** so you can feel it right away, but it lives in the
controller’s memory only until you press **Save** — that writes everything to flash. The Save button glows while
there are unsaved changes. Unplugging or powering off without saving loses them (the app warns before
disconnecting).

Settings links from support or an assistant (`#/apply?...`) always show a confirmation first: **Apply** changes
them live (press Save later), **Apply & save** also writes them to flash, **Cancel** changes nothing.

## iPhone and iPad
<!-- topic: ios; keywords: ios, iphone, ipad, safari, apple, mobile, phone, add to home screen -->

iPhone and iPad browsers (including Chrome on iOS) can’t connect to USB controllers — Apple doesn’t provide
WebUSB. On iOS you can still install the app (Share → **Add to Home Screen**), try the demo controller and use
the [Arena](#/arena). To configure or update the controller, use a computer or an Android device with a Chromium
browser (see `browser-support`).

## Motion (gyro) calibration
<!-- topic: motion-calibration; keywords: gyro, motion, imu, accelerometer, motion controls, drifting gyro, calibrate gyro, sensitivity -->

On [Motion](#/motion) (controllers with an IMU): place the controller on a flat, solid surface, run calibration.
**Motion controls** can be turned off, and gyro/accelerometer sensitivity is
adjustable per axis (0.5×–2×). **Save** afterwards.

## Rumble (haptics)
<!-- topic: haptics; keywords: rumble, vibration, haptics, hd rumble, too strong, too weak, no rumble, test feedback -->

On [Haptics](#/haptics): **Intensity** (`haptics.intensity`, 0–100 %) sets rumble strength; **Test feedback**
plays a pulse so you can feel it. HD-haptics controllers also offer **Trigger haptics**. Changes apply instantly —
press **Save** to keep them.
