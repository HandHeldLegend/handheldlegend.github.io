#!/usr/bin/env bash
# HOJA wireless module (ESP32) updater for Linux and macOS.
# Installs the HCI bridge firmware with esptool. https://handheldlegend.github.io/hoja3/
#
#   bash hoja_wireless_update.sh            # finds the port
#   PORT=/dev/ttyUSB0 bash hoja_wireless_update.sh
set -euo pipefail

BRIDGE_BASE="https://raw.githubusercontent.com/HandHeldLegend/HOJA-ESP32-HCI-Bridge/main/build"
BAUD="${BAUD:-460800}"

echo "==============================================="
echo "      HOJA wireless module (ESP32) updater"
echo "==============================================="
echo

# --- esptool -----------------------------------------------------------------------------------
# esptool sets DTR and RTS together on Linux and macOS (its "tight" reset), which these controllers
# need to enter the ESP32 bootloader reliably.
if command -v esptool >/dev/null 2>&1; then ESPTOOL=(esptool)
elif command -v esptool.py >/dev/null 2>&1; then ESPTOOL=(esptool.py)
elif python3 -c "import esptool" >/dev/null 2>&1; then ESPTOOL=(python3 -m esptool)
else
  echo "[ERROR] esptool isn't installed. Install it, then run this again:"
  echo "    pipx install esptool        (or: python3 -m pip install --user esptool)"
  exit 1
fi
command -v curl >/dev/null 2>&1 || { echo "[ERROR] curl isn't installed."; exit 1; }

# --- firmware ------------------------------------------------------------------------------------
NAME="HCI bridge"; BASE="$BRIDGE_BASE"; APP="hoja_hci_bridge.bin"
echo "Installing: HCI bridge (needs current controller firmware: the app's Wireless page shows \"ESP32 HCI\")"
echo

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[1/3] Downloading bootloader..."
curl -fL --progress-bar "$BASE/bootloader/bootloader.bin" -o "$TMP/bootloader.bin"
echo "[2/3] Downloading partition table..."
curl -fL --progress-bar "$BASE/partition_table/partition-table.bin" -o "$TMP/partitions.bin"
echo "[3/3] Downloading firmware..."
curl -fL --progress-bar "$BASE/$APP" -o "$TMP/firmware.bin"
echo
echo "Download complete."
echo

# --- update mode -------------------------------------------------------------------------------
echo "==============================================="
echo "Put the controller in update mode"
echo "==============================================="
echo "1. Close browser tabs and other apps that might use the controller's serial port."
echo "2. Unplug the controller."
echo "3. Hold Start/Plus and R Bumper (ZR on GC Ultimate), keep holding, and plug it in."
echo "   The lights pulse orange in update mode."
echo "   (Or use the web app's wireless module update up to its Connect step, then close the browser.)"
read -r -p "4. Press Enter to start. " _ || true
echo

# --- port ------------------------------------------------------------------------------------------
if [[ -z "${PORT:-}" ]]; then
  for p in /dev/ttyUSB* /dev/cu.wchusbserial* /dev/cu.usbserial*; do
    [[ -e "$p" ]] && { PORT="$p"; break; }
  done
fi
if [[ -z "${PORT:-}" ]]; then
  echo "[ERROR] No USB serial port found. Check the lights are pulsing orange and use a USB data cable."
  echo "        On Linux, 'sudo modprobe ch341' loads the CH340 driver if it was unloaded."
  exit 1
fi
if [[ ! -r "$PORT" || ! -w "$PORT" ]]; then
  echo "[ERROR] No permission to use $PORT. Add your account to its group (usually dialout or uucp)"
  echo "        and log in again, e.g.: sudo usermod -aG dialout \"$USER\""
  exit 1
fi
if [[ "$(uname)" == "Linux" ]] && systemctl is-active --quiet ModemManager 2>/dev/null; then
  echo "Note: ModemManager is running and can grab new serial ports. If this fails, run"
  echo "      'sudo systemctl stop ModemManager' and try again."
  echo
fi
echo "Using $PORT"
echo

fail() {
  echo
  echo "==============================================="
  echo "[ERROR] Couldn't talk to the wireless module"
  echo "==============================================="
  echo "1. Check the lights are pulsing orange. If not, unplug and enter update mode again."
  echo "2. Use a USB data cable (not charge-only) and plug straight into the computer."
  echo "3. Close any browser tab or app using $PORT, then run this again."
  exit 1
}

# One connection: erase everything, then write (a separate erase left the stub at the high baud rate).
echo "Erasing the module and writing $NAME (takes about a minute)..."
"${ESPTOOL[@]}" --chip esp32 --port "$PORT" --baud "$BAUD" --before default_reset --after hard_reset write_flash --erase-all \
  0x1000 "$TMP/bootloader.bin" \
  0x8000 "$TMP/partitions.bin" \
  0x10000 "$TMP/firmware.bin" || fail

echo
echo "==============================================="
echo "[SUCCESS] $NAME installed."
echo "==============================================="
echo "Unplug the controller to finish. Coming from the older HOJA baseband firmware?"
echo "Pair your Switch and other hosts again."
