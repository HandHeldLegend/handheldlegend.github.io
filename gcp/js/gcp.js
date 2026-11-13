/*
 * GC Pocket firmware update page.
 *
 * Everything adapter-specific (firmware links, steps) lives in index.html, one panel per adapter.
 * This script only:
 *   - shows the panel for the adapter the visitor picked (also from ?init=gcp or ?init=gcpplus),
 *   - fills in the latest version and release notes from each firmware repo's manifest.json,
 *   - shows the written-out "What's new" list when it matches that version,
 *   - limits the installer's port list to the GC Pocket itself,
 *   - tells visitors when their browser can't run the GC Pocket installer.
 */
(() => {
  "use strict";

  const panels = [...document.querySelectorAll(".panel[data-adapter]")];
  const radios = [...document.querySelectorAll('input[name="adapter"]')];
  const hint = document.getElementById("pick-hint");

  // ---- Adapter selection ------------------------------------------------------------------

  function showAdapter(id, rememberInUrl) {
    const known = panels.some((panel) => panel.dataset.adapter === id);

    for (const panel of panels) panel.hidden = panel.dataset.adapter !== id;
    for (const radio of radios) radio.checked = radio.value === id;
    hint.hidden = known;

    if (known && rememberInUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("init", id);
      window.history.replaceState(null, "", url);
    }
  }

  for (const radio of radios) {
    radio.addEventListener("change", () => showAdapter(radio.value, true));
  }

  // Links such as /gcp/?init=gcpplus open with that adapter already picked.
  showAdapter(new URL(window.location.href).searchParams.get("init"), false);

  // ---- Latest version and release notes ---------------------------------------------------

  async function loadLatest(panel) {
    const box = panel.querySelector("[data-latest]");
    const version = panel.querySelector("[data-version]");
    const notes = panel.querySelector("[data-notes]");

    try {
      const response = await fetch(panel.dataset.manifest, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();

      version.textContent = `Version ${manifest.fw_version}`;

      const text = String(manifest.changelog ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
      notes.textContent = text;

      // The page carries a fuller, written-out list of changes for one firmware version.
      // Show it when that is the version on offer; for any other version, show the
      // short notes that come with the firmware.
      const explained = panel.querySelector("[data-whatsnew]");
      const explainedIsCurrent = explained !== null && explained.dataset.whatsnew === String(manifest.fw_version);
      if (explained) explained.hidden = !explainedIsCurrent;
      notes.hidden = text === "" || explainedIsCurrent;
    } catch (error) {
      // The update buttons always fetch the newest firmware, so the page still works without this.
      console.warn("Could not load firmware details:", error);
      box.hidden = true;
    }
  }

  panels.forEach(loadLatest);

  // ---- GC Pocket installer (needs Web Serial: Chrome or Edge on a computer) -----------------

  const installer = document.getElementById("install-gcp");
  const serialNotice = document.getElementById("serial-notice");

  // The GC Pocket's chip in update mode: an ESP32-S3, which shows up as Espressif's
  // "USB JTAG/serial debug unit".
  const GC_POCKET_UPDATE_PORT = { usbVendorId: 0x303a, usbProductId: 0x1001 };

  if ("serial" in navigator && window.isSecureContext) {
    // The installer is shared with other pages and asks the browser for any serial port.
    // On this page, narrow the browser's list to the GC Pocket so it is the only thing to pick.
    navigator.serial.requestPort = (options = {}) =>
      Serial.prototype.requestPort.call(navigator.serial, { ...options, filters: [GC_POCKET_UPDATE_PORT] });

    customElements.whenDefined("esp-web-install-button").then(() => {
      const button = installer.querySelector("button");
      if (button) button.textContent = "Install firmware";
    });
  } else {
    installer.hidden = true;
    serialNotice.hidden = false;
  }
})();
