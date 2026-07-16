import HojaGamepad from './gamepad.js';

// Dynamic module loader and settings management
import { registerSettingsModules } from './module-registry.js';
import { enableTooltips } from './tooltips.js';
import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { 
    pico_update_attempt_flash, 
    pico_exit_bootloader_attempt,
    pico_complete_uf2_picker_flash,
    pico_has_cached_uf2,
    setUpdateStatus,
} from './pico_update.js';
import { listHojaBuilds, getBuildManifest } from './hoja_builds.js';

/** @type {'hidden' | 'update-available' | 'awaiting-bootloader' | 'bootloader-flash' | 'bootloader-install' | 'uf2-drive-select' | 'update-complete'} */
let fwUiMode = 'hidden';
let pendingFwUrl = undefined;
let pendingFwChecksum = undefined;
let pendingIsLegacy = false;
let buildsLoaded = false;

/** Debug mode via URL: ?debug, ?debug=1, ?debug=force-update, ?debug&forceUpdate=1 */
const DEBUG_URL_PARAMS = new URLSearchParams(window.location.search);
const DEBUG_MODE = (() => {
    if (!DEBUG_URL_PARAMS.has('debug')) return false;
    const v = (DEBUG_URL_PARAMS.get('debug') || '1').toLowerCase();
    return v !== '0' && v !== 'false' && v !== 'off';
})();
let debugForceFwOnConnect = DEBUG_MODE && (
    DEBUG_URL_PARAMS.get('debug') === 'force-update' ||
    DEBUG_URL_PARAMS.get('forceUpdate') === '1' ||
    DEBUG_URL_PARAMS.get('force-update') === '1'
);

async function isOnline() {
    try {
        // Any HTTP response means the browser has network; 404 is still "online".
        await fetch('/ping.json', { method: 'HEAD', cache: 'no-store' });
        console.log("ONLINE");
        return true;
    } catch (error) {
        // Fall back to browser connectivity flag (Live Server may lack ping.json).
        const online = navigator.onLine !== false;
        console.log(online ? "ONLINE" : "OFFLINE");
        return online;
    }
}

// In your app.js or main entry point
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Check install state when page loads
            await checkInstallState();
            
            // Register service worker
            const registration = await navigator.serviceWorker.register('/hoja2/app_sw.js');
            console.log('Service Worker registered with scope:', registration.scope);

            // Listen for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('Service Worker update found!');
                
                newWorker.addEventListener('statechange', () => {
                    console.log('Service Worker state:', newWorker.state);
                    
                    if (newWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // New version installed but waiting to activate
                            console.log('New content is available; please refresh.');
                            enableNotifMessage('App has updated. Refresh to complete update.');
                        } else {
                            // First time installation
                            console.log('Content is cached for offline use.');
                        }
                    }
                });
            });

        } catch (error) {
            console.error('ServiceWorker registration failed:', error);
        }
    });
}

// In your app.js or main entry point
let deferredPrompt; // Store the prompt event for later use

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    // Update UI to show the install button
    enableInstallButton(true);
});

// Add this to know when the app is installed
window.addEventListener('appinstalled', (evt) => {
    // App is installed, hide the install button
    enableInstallButton(false);
    // Clear the deferredPrompt
    deferredPrompt = null;
});

// Function to check if app is already installed
async function checkInstallState() {
    // First check if it's already installed via getInstalledRelatedApps()
    if ('getInstalledRelatedApps' in navigator) {
        const relatedApps = await navigator.getInstalledRelatedApps();
        const isInstalled = relatedApps.length > 0;
        if (isInstalled) {
            enableInstallButton(false);
            return true;
        }
    }
    
    // Also check if it was installed via other means
    const displayMode = window.matchMedia('(display-mode: standalone)').matches ||
                       window.matchMedia('(display-mode: window-controls-overlay)').matches ||
                       window.navigator.standalone === true;
    
    if (displayMode) {
        enableInstallButton(false);
        return true;
    }
    
    return false;
}

// Function to show install prompt when install button is clicked
async function installApp() {
    if (!deferredPrompt) {
        return;
    }
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    // Clear the deferredPrompt
    deferredPrompt = null;
}

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();

// GAMEPAD_CMD_RESET_TO_BOOTLOADER = 1
const bootloaderCmd = 1;
const gamepadCfgBlock = 0;

class ConfigApp {

    #appIcons = [];

    constructor(appTitleHeader) {

        this.appGridContainer = document.getElementById('app-grid-container');
        this.appGrid = document.getElementById('app-grid');
        this._appTitleHeader = appTitleHeader;
        this._currentAppTitle = -1;
        this._closeCallback = null;

        // Contain our scrollable module content container
        this.moduleScrollable = document.getElementById('module-content-container');
        // Contains our module view
        this.moduleContainer = document.getElementById('module-container');
        // Contains header and content
        this.moduleView = document.getElementById('module-view');
        // We render to this part
        this.moduleContent = document.getElementById('module-content');

        // Back button in our module view
        this.backButton = document.getElementById('back-button');

        this.registerKeyboardEvents();
        this.loadSettingsModules();
    }

    setCloseCallback(callback) {
        this._closeCallback = callback;
    }

    setNotificationBadge(idx, show) {
        try {
            const icon = this.#appIcons[idx];
            let badge = icon.querySelector('.notification-badge');
            
            if (!badge && show) {
                // Create badge if it doesn't exist
                badge = document.createElement('div');
                badge.className = 'notification-badge';
                badge.textContent = '!';
                icon.appendChild(badge);
                
                // Trigger reflow before adding visible class for animation
                badge.offsetHeight;
                badge.classList.add('visible');
            } else if (badge) {
                if (show) {
                    badge.classList.add('visible');
                } else {
                    badge.classList.remove('visible');
                    // Optional: Remove badge element after animation
                    badge.addEventListener('transitionend', () => {
                        badge.remove();
                    });
                }
            }
        } catch(err) {
            console.error('Error setting notification badge:', err);
        }
    }

    currentModule() {
        return this._currentAppTitle;
    }

    registerKeyboardEvents() {
        this.backButton.addEventListener('click', () => this.closemoduleView());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closemoduleView();
            }
        });

        // Handle mobile back gesture
        window.onpopstate = (event) => {
            event.preventDefault();
            this.closemoduleView();
            // Only handle back gesture if a module is open
            // Push a new state to maintain history stack (keep query params e.g. ?debug=)
            history.pushState(null, '', window.location.pathname + window.location.search);
        };

        // Add initial state when app loads (preserve ?debug= etc.)
        history.pushState(null, '', window.location.pathname + window.location.search);
    }

    async loadSettingsModules() {
        const modules = await registerSettingsModules();
        modules.forEach(module => this.createSettingsIcon(module));
    }

    createSettingsIcon(module) {
        const iconContainer = document.createElement('div');
        iconContainer.className = 'module-icon';

        const icon = document.createElement('div');
        icon.className = 'icon';

        icon.style.backgroundColor = module.color || this.getRandomColor();
        
        const svgIcon = document.createElement('img');
        svgIcon.src = "assets/icons/"+module.icon;
        svgIcon.className = 'svg-icon';
        svgIcon.alt = `${module.name} icon`;
        
        // Add error handler for fallback
        svgIcon.onerror = () => {
            svgIcon.remove();
            icon.textContent = module.name.charAt(0).toUpperCase();
            console.error(`Failed to load SVG for ${module.name}`);
        };

        icon.appendChild(svgIcon);

        const label = document.createElement('span');
        label.textContent = module.name;

        iconContainer.appendChild(icon);
        iconContainer.appendChild(label);

        icon.addEventListener('click', () => {
            if(icon.getAttribute("enabled") == "true")
            {
                // Open module
                this.openmoduleView(module, module.name)
            }
                
        });

        this.appGrid.appendChild(iconContainer);

        this.#appIcons.push(icon);

        // Initialize without badge
        this.setNotificationBadge(this.#appIcons.length - 1, false);
    }

    enableIcon(idx, enable)
    {
        try 
        {
            if(enable)
            {
                this.#appIcons[idx].setAttribute("enabled", "true");

            }
            else {
                this.#appIcons[idx].setAttribute("enabled", "false");
            }
                
        }
        catch(err) {

        }
    }

    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    setView(view) {
        if (view) {
            this.appGridContainer.setAttribute("visible", "true");
            this.moduleContainer.setAttribute("visible", "false");
            this.moduleContainer.scrollTo(0,0);
        }
        else {
            this.moduleContainer.setAttribute("visible", "true");
            this.appGridContainer.setAttribute("visible", "false");
        }
    }

    async openmoduleView(module, title) {
        // Reset scrollable position
        this.moduleScrollable.scrollTo(0, 0);
    
        let moduleUrl = module.path;
        let moduleScript;
    
        try {
            if (isOnline()) {
                // Online: Directly import the module
                moduleScript = await import(moduleUrl);
            } else {
                // Offline: Load from the first available cache
                const cacheNames = await caches.keys();
                if (cacheNames.length === 0) throw new Error('No caches found');
    
                const cache = await caches.open(cacheNames[0]);
                const response = await cache.match(moduleUrl);
    
                if (!response) {
                    throw new Error(`Module ${moduleUrl} not found in cache.`);
                }
    
                let moduleText = await response.text();
    
                // Rewrite relative imports to absolute paths
                moduleText = moduleText.replace(
                    /import\s+["'](\.\.\/[^"']+)["']/g,
                    (match, relativePath) => {
                        const absolutePath = new URL(relativePath, location.origin).href;
                        return `import "${absolutePath}"`;
                    }
                );
    
                const blob = new Blob([moduleText], { type: "application/javascript" });
                const blobUrl = URL.createObjectURL(blob);
    
                moduleScript = await import(blobUrl);
                URL.revokeObjectURL(blobUrl); // Clean up
            }
        } catch (error) {
            console.error(`Error loading module ${moduleUrl}:`, error);
            return;
        }
    
        // Clear previous content
        this.moduleContent.innerHTML = '';
    
        // Render module content
        if (moduleScript.render) {
            if (this._appTitleHeader)
                this._appTitleHeader.innerHTML = title;
            moduleScript.render(this.moduleContent);
        }
    
        // Set current module title
        this._currentAppTitle = title;
    
        this.setView(true);
    }

    closemoduleView() {
        if (this._closeCallback) {
            this._closeCallback();
        }
        this.setView(false);
    }
}

const parseBufferText = buffer => {
    const text = new TextDecoder().decode(buffer).trim();
    return text === '~' ? false : text;
};

async function getManifestVersion(manifestUrl) {

    if(!isOnline()) return false;

    let response = await fetch(manifestUrl);

    if(response.ok) {
        const data = await response.json();
        if(data.fw_version) 
        return {
            version: data.fw_version,
            checksum: data.checksum
        };
        else return false;
    }
}

function enableInstallButton(enable) {
    const installButton = document.getElementById("app-install-button");

    if(enable) {
        console.log("Install button enable.");
        installButton.setAttribute("visible", "true");
    }
    else {
        console.log("Install button disable.");
        installButton.setAttribute("visible", "false");
    }
}

async function enableNotifMessage(msg) {
    const fwMessageBox = document.getElementById("fw-update-box");
    const notifMsgBox = document.getElementById("notif-msg-box");

    if(msg != "") {
        fwMessageBox.setAttribute("visible", "false");

        notifMsgBox.innerHTML = msg;

        notifMsgBox.setAttribute("visible", "true");
    }
    else {
        notifMsgBox.setAttribute("visible", "false");
    }
}

function getFwUiElements() {
    return {
        box: document.getElementById('fw-update-box'),
        title: document.getElementById('fw-update-title'),
        guide: document.getElementById('fw-update-guide'),
        picker: document.getElementById('fw-install-picker'),
        installConfirm: document.getElementById('fw-install-confirm'),
        uf2Tips: document.getElementById('fw-uf2-tips'),
        select: document.getElementById('fw-device-select'),
        updateButton: document.getElementById('update-button'),
        restartButton: document.getElementById('exit-bootloader-button'),
        dismissButton: document.getElementById('dismiss-fw-button'),
    };
}

function hideFwUpdateUi() {
    const { box, picker, installConfirm, uf2Tips } = getFwUiElements();
    fwUiMode = 'hidden';
    box.setAttribute('visible', 'false');
    picker.hidden = true;
    if (installConfirm) installConfirm.checked = false;
    uf2Tips.hidden = true;
    setUpdateButtonLabel('Update');
}

function setFwGuide(title, guide) {
    const els = getFwUiElements();
    els.title.textContent = title;
    els.guide.textContent = guide;
}

function setUpdateButtonLabel(text) {
    const { updateButton } = getFwUiElements();
    updateButton.setAttribute('ready-text', text);
    // Refresh visible label if currently ready/disabled
    const state = updateButton.getAttribute('state') || 'ready';
    if (state === 'ready' || state === 'disabled') {
        updateButton.setAttribute('state', state);
        const btn = updateButton.shadowRoot?.querySelector('.single-shot-button');
        if (btn && state === 'ready') btn.textContent = text;
    }
}

/**
 * Shared success screen for every flash path (Picoboot, UF2 picker, install, update).
 */
function showUpdateComplete() {
    const { box, picker, uf2Tips, updateButton, restartButton, dismissButton } = getFwUiElements();

    fwUiMode = 'update-complete';
    pendingFwUrl = undefined;
    pendingFwChecksum = undefined;
    pendingIsLegacy = false;

    picker.hidden = true;
    uf2Tips.hidden = true;

    setFwGuide(
        'Update Complete',
        'Firmware was written successfully. Wait a moment for the controller to reboot, then click Connect.'
    );
    setUpdateStatus('Done - click Connect when ready', 100, true);

    // Gray out Update / Restart; only Dismiss stays active
    updateButton.setAttribute('disabled-text', 'Update');
    restartButton.setAttribute('disabled-text', 'Restart');
    updateButton.enableButton(false);
    restartButton.enableButton(false);
    dismissButton.enableButton(true);
    dismissButton.setAttribute('ready-text', 'Dismiss');
    const dismissBtn = dismissButton.shadowRoot?.querySelector('.single-shot-button');
    if (dismissBtn) {
        dismissBtn.textContent = 'Dismiss';
        dismissBtn.disabled = false;
    }

    box.setAttribute('visible', 'true');
}

function applyFlashResult(result) {
    if (result === true) {
        showUpdateComplete();
        return true;
    }
    if (result?.needsUserAction) {
        if (result.reason === 'directory-picker') {
            showUf2DriveStep();
            return true;
        }
        if (result.reason === 'manual-download') {
            showManualUf2Step(result.uf2Url);
            return true;
        }
        setFwGuide(
            'Action Needed',
            'Click Update to authorize the Pico bootloader device in the browser popup.'
        );
        setUpdateStatus('Click Update to continue', 0, false);
        setUpdateButtonLabel('Authorize');
        return true;
    }
    return false;
}

/**
 * Shared flash pipeline for update + install (Picoboot → UF2 drive → manual).
 * Always enters bootloader-flash mode so USB reconnects don't dismiss the panel.
 */
async function runFirmwareFlash(url, checksum, { allowRequestDevice = true } = {}) {
    if (!url) {
        setUpdateStatus('No firmware URL available.', 0, false);
        return false;
    }

    pendingFwUrl = url;
    pendingFwChecksum = checksum;
    fwUiMode = 'bootloader-flash';

    const { picker } = getFwUiElements();
    picker.hidden = true;

    const result = await pico_update_attempt_flash(url, checksum, { allowRequestDevice });
    return applyFlashResult(result);
}

async function resolveInstallSelection() {
    const { select } = getFwUiElements();
    const option = select.selectedOptions[0];
    if (!option?.value) return null;

    let checksum = null;
    try {
        const manifest = await getBuildManifest(option.dataset.manifestUrl);
        if (manifest?.checksum) checksum = manifest.checksum;
    } catch (error) {
        console.warn('Could not load manifest checksum:', error);
    }

    return { url: option.dataset.uf2Url, checksum };
}

function refreshBootloaderInstallState() {
    const { select, installConfirm, updateButton } = getFwUiElements();
    if (fwUiMode !== 'bootloader-install') return;

    const hasSelection = !!select?.selectedOptions?.[0]?.value;
    const hasConfirmed = !!installConfirm?.checked;
    updateButton.enableButton(hasSelection && hasConfirmed);
}

/** Update + install: rebooted gamepad or bare bootloader with known firmware */
async function startBootloaderFlashSession({ allowRequestDevice = true } = {}) {
    if (!pendingFwUrl) {
        setUpdateStatus('No firmware URL available.', 0, false);
        return false;
    }

    await showBootloaderFlash();
    return await runFirmwareFlash(pendingFwUrl, pendingFwChecksum, { allowRequestDevice });
}

function isActiveFwSession() {
    return [
        'awaiting-bootloader',
        'bootloader-flash',
        'bootloader-install',
        'uf2-drive-select',
        'update-complete',
    ].includes(fwUiMode);
}

async function populateDeviceSelect() {
    const { select } = getFwUiElements();
    if (buildsLoaded && select.options.length > 1) return;

    select.innerHTML = '<option value="">Loading devices...</option>';
    try {
        const builds = await listHojaBuilds();
        select.innerHTML = '<option value="">Choose a device...</option>';

        const nukeOption = document.createElement('option');
        nukeOption.value = 'full-reset-nuke';
        nukeOption.textContent = 'FULL RESET - NUKE';
        nukeOption.dataset.uf2Url = '/hoja2/firmware/universal_flash_nuke.uf2';
        nukeOption.dataset.binUrl = '';
        nukeOption.dataset.manifestUrl = '';
        select.appendChild(nukeOption);

        for (const build of builds) {
            const option = document.createElement('option');
            option.value = build.id;
            option.textContent = build.label;
            option.dataset.uf2Url = build.uf2Url;
            option.dataset.binUrl = build.binUrl;
            option.dataset.manifestUrl = build.manifestUrl;
            select.appendChild(option);
        }
        buildsLoaded = true;
    } catch (error) {
        console.error('Failed to load HOJA builds:', error);
        select.innerHTML = '<option value="">Could not load device list</option>';
    }
}

function wireFwButtons() {
    const { updateButton, restartButton, dismissButton, select, installConfirm } = getFwUiElements();

    updateButton.setOnClick(async () => {
        return await handleFwUpdateClick();
    });

    restartButton.setOnClick(async () => {
        return await pico_exit_bootloader_attempt();
    });

    dismissButton.setOnClick(async () => {
        hideFwUpdateUi();
        pendingFwUrl = undefined;
        pendingFwChecksum = undefined;
        pendingIsLegacy = false;
        dismissButton.setAttribute('ready-text', 'Dismiss');
        const dismissBtn = dismissButton.shadowRoot?.querySelector('.single-shot-button');
        if (dismissBtn) dismissBtn.textContent = 'Dismiss';
        setUpdateStatus('Ready', 0, false);
        return true;
    });

    select.addEventListener('change', async () => {
        if (fwUiMode !== 'bootloader-install') return;

        const fw = await resolveInstallSelection();
        if (fw) {
            pendingFwUrl = fw.url;
            pendingFwChecksum = fw.checksum;
        } else {
            pendingFwUrl = undefined;
            pendingFwChecksum = undefined;
        }

        refreshBootloaderInstallState();
    });

    installConfirm?.addEventListener('change', () => {
        refreshBootloaderInstallState();
    });
}

async function handleFwUpdateClick() {
    // Staged UF2 step: folder picker when cached, otherwise manual download
    if (fwUiMode === 'uf2-drive-select') {
        if (pico_has_cached_uf2()) {
            try {
                await pico_complete_uf2_picker_flash();
                showUpdateComplete();
                return true;
            } catch (error) {
                console.error(error);
                // If picker itself was blocked, fall back to manual download
                const msg = String(error?.message || error).toLowerCase();
                if (pendingFwUrl && (msg.includes('security policy') || msg.includes('folder picker blocked'))) {
                    window.open(pendingFwUrl, '_blank');
                    showManualUf2Step(pendingFwUrl);
                    return true;
                }
                setUpdateStatus(error.message || 'Folder selection failed.', 0, false);
                return false;
            }
        }
        if (pendingFwUrl) {
            window.open(pendingFwUrl, '_blank');
            showUpdateComplete();
            return true;
        }
        setUpdateStatus('No firmware file ready.', 0, false);
        return false;
    }

    // Step 1: connected gamepad → reboot into BOOTSEL (do NOT wait for ACK — device dies)
    if (fwUiMode === 'update-available') {
        if (!gamepad) return false;

        setFwGuide(
            'Entering Bootloader',
            'Resetting into bootloader mode. When the Pico bootloader appears, click Update to download and flash firmware.'
        );
        setUpdateStatus('Sending reboot to bootloader...', 10, true);
        fwUiMode = 'awaiting-bootloader';
        setUpdateButtonLabel('Update');

        try {
            if (pendingIsLegacy) {
                // Fire-and-forget — device will disconnect
                gamepad.setBootloaderLegacy().catch(() => {});
            } else {
                await gamepad.rebootToBootloader();
            }

            setUpdateStatus('Waiting for Pico bootloader...', 30, true);
            return true;
        } catch (error) {
            console.error(error);
            // Device may have already rebooted mid-transfer; treat as success
            if (fwUiMode === 'awaiting-bootloader') {
                setUpdateStatus('Waiting for Pico bootloader...', 30, true);
                return true;
            }
            setUpdateStatus('Failed to enter update mode.', 0, false);
            fwUiMode = 'update-available';
            setUpdateButtonLabel('Bootloader');
            return false;
        }
    }

    // Step 2: flash (manual click — has user gesture for requestDevice / folder picker)
    if (fwUiMode === 'awaiting-bootloader' || fwUiMode === 'bootloader-flash') {
        return await startBootloaderFlashSession({ allowRequestDevice: true });
    }

    // Install HOJA onto a bare bootloader — same flash pipeline as updates
    if (fwUiMode === 'bootloader-install') {
        const fw = await resolveInstallSelection();
        if (!fw) {
            setUpdateStatus('Select a device first.', 0, false);
            return false;
        }

        pendingFwUrl = fw.url;
        pendingFwChecksum = fw.checksum;
        return await startBootloaderFlashSession({ allowRequestDevice: true });
    }

    return false;
}

/**
 * Connected gamepad has a newer firmware available.
 */
async function showUpdateAvailable(url, checksum, { legacy = false, debugForced = false } = {}) {
    const { box, picker, uf2Tips, updateButton, restartButton, dismissButton } = getFwUiElements();

    pendingFwUrl = url;
    pendingFwChecksum = checksum;
    pendingIsLegacy = legacy;
    fwUiMode = 'update-available';

    picker.hidden = true;
    uf2Tips.hidden = true;
    setUpdateButtonLabel('Bootloader');
    setFwGuide(
        debugForced ? 'Update Available (Debug)' : 'Update Available',
        debugForced
            ? 'Debug mode: forcing the update flow even though firmware is up to date. Click Bootloader to reset into update mode and test the full flow.'
            : 'A newer firmware is available. Click Bootloader to reset your controller into update mode. When the Pico bootloader appears, click Update to flash.'
    );
    setUpdateStatus('Ready', 0, false);

    updateButton.enableButton(true);
    restartButton.enableButton(false);
    dismissButton.enableButton(true);
    dismissButton.setAttribute('ready-text', 'Dismiss');
    const dismissBtn = dismissButton.shadowRoot?.querySelector('.single-shot-button');
    if (dismissBtn) dismissBtn.textContent = 'Dismiss';
    box.setAttribute('visible', 'true');
}

async function tryShowGamepadFwUpdate(fwVersion, { debugForced = false } = {}) {
    const firmwareUrl = parseBufferText(gamepad.device_static.firmware_url);
    if (!firmwareUrl) {
        if (debugForced) {
            setUpdateStatus('Debug: no firmware URL on device.', 0, false);
        }
        return false;
    }

    const checksum = fwVersion?.checksum ?? null;
    await showUpdateAvailable(firmwareUrl, checksum, { debugForced });
    return true;
}

function updateDebugButtonUi() {
    const btn = document.getElementById('debug-button');
    if (!btn) return;

    if (!DEBUG_MODE) {
        btn.setAttribute('visible', 'false');
        return;
    }

    btn.setAttribute('visible', 'true');
    btn.setAttribute('data-active', debugForceFwOnConnect ? 'true' : 'false');
    btn.textContent = debugForceFwOnConnect ? 'Debug: FW ON' : 'Debug: FW';
    btn.title = debugForceFwOnConnect
        ? 'Force update prompt on connect (on). Click to turn off, or force now if connected.'
        : 'Click to force the update prompt on the next connect (or now if connected).';
}

async function toggleDebugForceFw() {
    debugForceFwOnConnect = !debugForceFwOnConnect;
    updateDebugButtonUi();

    if (debugForceFwOnConnect && gamepad?.isConnected) {
        const fwVersion = await getManifestVersion(parseBufferText(gamepad.device_static.manifest_url));
        await tryShowGamepadFwUpdate(fwVersion, { debugForced: true });
    }

    return true;
}

/**
 * Pico bootloader present and we already know which firmware to flash.
 */
async function showBootloaderFlash() {
    const { box, picker, uf2Tips, updateButton, restartButton, dismissButton } = getFwUiElements();

    fwUiMode = 'bootloader-flash';
    picker.hidden = true;
    uf2Tips.hidden = true;
    setUpdateButtonLabel('Update');
    setFwGuide(
        'Ready to Flash',
        'Flashing firmware… If direct USB flashing is blocked, you will get clear steps to select the RPI-RP2 drive.'
    );
    setUpdateStatus('Bootloader detected', 40, true);

    updateButton.enableButton(true);
    restartButton.enableButton(true);
    dismissButton.enableButton(true);
    box.setAttribute('visible', 'true');
}

/**
 * Show instructions BEFORE opening the OS folder picker (picker covers the page).
 */
function showUf2DriveStep() {
    const { box, picker, uf2Tips, updateButton, restartButton, dismissButton } = getFwUiElements();

    fwUiMode = 'uf2-drive-select';
    picker.hidden = true;
    uf2Tips.hidden = false;

    setFwGuide(
        'Select RPI-RP2 Drive',
        'Direct USB flashing is unavailable on this system. Read the steps below, then click the button - a folder dialog will open on top of this page.'
    );
    setUpdateStatus('Ready - pick RPI-RP2 in the next dialog', 100, false);
    setUpdateButtonLabel('Select RPI-RP2');

    updateButton.enableButton(true);
    restartButton.enableButton(true);
    dismissButton.enableButton(true);
    box.setAttribute('visible', 'true');
}

/**
 * Last-resort path when the folder picker API is unavailable.
 */
function showManualUf2Step(uf2Url) {
    const { box, picker, uf2Tips, updateButton, restartButton, dismissButton } = getFwUiElements();

    fwUiMode = 'uf2-drive-select';
    pendingFwUrl = uf2Url;
    picker.hidden = true;
    uf2Tips.hidden = false;

    setFwGuide(
        'Copy UF2 to RPI-RP2',
        'Click Download UF2, then copy the file onto the drive named RPI-RP2 in File Explorer. The controller will reboot when the copy finishes.'
    );
    setUpdateStatus('Download the UF2, then copy it to RPI-RP2', 100, false);
    setUpdateButtonLabel('Download UF2');

    updateButton.enableButton(true);
    restartButton.enableButton(false);
    dismissButton.enableButton(true);
    box.setAttribute('visible', 'true');
}

/**
 * Bare Pico bootloader with no known device firmware — offer HOJA install.
 */
async function showBootloaderInstall() {
    const { box, picker, installConfirm, uf2Tips, updateButton, restartButton, dismissButton } = getFwUiElements();

    pendingFwUrl = undefined;
    pendingFwChecksum = undefined;
    pendingIsLegacy = false;
    fwUiMode = 'bootloader-install';

    uf2Tips.hidden = true;
    setUpdateButtonLabel('Install');
    setFwGuide(
        'Install HOJA?',
        'A Raspberry Pi bootloader was detected. Select your device below, then click Install. The same update steps apply - including RPI-RP2 or RP2350 drive selection on Windows.'
    );
    setUpdateStatus('Select a device to continue', 0, false);

    picker.hidden = false;
    if (installConfirm) installConfirm.checked = false;
    await populateDeviceSelect();

    updateButton.enableButton(false);
    restartButton.enableButton(true);
    dismissButton.enableButton(true);
    box.setAttribute('visible', 'true');
}

async function enableLegacyFwUpdateMessage(url) {
    await showUpdateAvailable(url, null, { legacy: true });
}

function isPicoBootloaderDevice(device) {
    return device?.vendorId === 0x2e8a
        && (device?.productId === 0x0003 || device?.productId === 0x000f);
}

async function handlePicoBootloaderConnect() {
    // Don't reset an in-progress flow or interrupt the UF2/manual step
    if (fwUiMode === 'uf2-drive-select') {
        return;
    }
    if (fwUiMode === 'bootloader-flash' || fwUiMode === 'awaiting-bootloader') {
        return;
    }

    // After a successful flash or nuke, allow a fresh bootloader connect
    // to reopen the installer when there is no pending known firmware.
    if (fwUiMode === 'update-complete' && !pendingFwUrl) {
        await showBootloaderInstall();
        return;
    }

    // Known firmware (gamepad update or install device already selected)
    if (pendingFwUrl) {
        try {
            await startBootloaderFlashSession({ allowRequestDevice: false });
        } catch (error) {
            console.error('Auto-flash failed:', error);
            setUpdateStatus('Click Update to retry flash', 0, false);
        }
        return;
    }

    if (fwUiMode !== 'bootloader-install') {
        await showBootloaderInstall();
    }
}

async function handlePicoBootloaderDisconnect() {
    // Keep the panel open for every active bootloader flash / install step
    if (isActiveFwSession()) {
        return;
    }
    hideFwUpdateUi();
}

async function sendSaveCommand() {
    if(gamepad) {
        return gamepad.save();
    }
    else {
        console.log("No Gamepad Present");
        return false;
    }
}

async function badgeCheck() {
    if (!gamepad?.isConnected) return;

    const analogCfgBlockNumber = 2;
    const hoverCfgBlockNumber = 1;

    try {
        await gamepad.requestBlock(analogCfgBlockNumber);
        await gamepad.requestBlock(hoverCfgBlockNumber);
    } catch (error) {
        console.warn('badgeCheck skipped (device not ready):', error.message || error);
        return;
    }

    if(!gamepad.hover_cfg.hover_calibration_set) {
            window.configApp.setNotificationBadge(1, true);
    }
    else window.configApp.setNotificationBadge(1, false);

    if (!gamepad.analog_cfg.analog_calibration_set) {
            window.configApp.setNotificationBadge(2, true);
    }
    else window.configApp.setNotificationBadge(2, false);

    // Check Baseband Version if we have external updates
    if(gamepad.bluetooth_static.external_update_supported) {
        let currentBasebandVersion = await getCurrentBasebandVersion();

        if(gamepad.bluetooth_static.external_version_number < currentBasebandVersion) {
            window.configApp.setNotificationBadge(9, true);
        }
        else window.configApp.setNotificationBadge(9, false);
    }
}

async function getCurrentBasebandVersion() {
        if(!isOnline()) return false;

        const btManifestUrl = "https://raw.githubusercontent.com/HandHeldLegend/HOJA-ESP32-Baseband/master/manifest.json";
        let response = await fetch(btManifestUrl);
    
        if(response.ok) {
            const data = await response.json();
            if(data.fw_version) return data.fw_version;
            else return false;
        }
    }

function hasEsp32ExternalWirelessHardware() {
    return gamepad.bluetooth_static.external_update_supported > 0;
}

// Initialize the app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {

    const connectButton = document.getElementById('connect-button');
    const saveButton = document.getElementById('save-button');
    const appTitleHeader = document.getElementById('app-title');

    if(!navigator.usb) {
        console.error("USB API not supported in this browser.");
        enableNotifMessage("USB API not supported. Please use a Chromium based browser.");
    }

    window.configApp = new ConfigApp(appTitleHeader);

    saveButton.setOnClick(sendSaveCommand);

    const changelogButton = document.getElementById("changelog-button");
    changelogButton.setOnClick(() => {
        window.open('https://docs.handheldlegend.com/s/portal/doc/whats-new-xmtMoBg2Pu', '_blank');
        return true;
    });

    const debugButton = document.getElementById('debug-button');
    if (debugButton) {
        debugButton.addEventListener('click', () => {
            toggleDebugForceFw();
        });
        updateDebugButtonUi();
        if (DEBUG_MODE) {
            console.log('Hoja debug mode enabled. Add ?debug=force-update to auto-force the update prompt on connect.');
        }
    }

    var debug = false;

    if (debug) {
        // Debug module
        const debugModule = [
            {
                name: 'Debug',
                path: '../modules/analog-md.js',
                icon: '🌐',
                color: '#3498db'
            }];

        window.configApp.openmoduleView(debugModule[0], "Debug");
    }

    window.configApp.setCloseCallback(async () => {
        try {
            await badgeCheck();
        } catch (error) {
            console.warn('Close badge check skipped:', error);
        }
    });

    enableTooltips(document);

    async function connectHandle() {
        // Enable Icons
        window.configApp.enableIcon(0, true); // Gamepad

        window.configApp.enableIcon(1, true); // Remap
        
        
        let analogEnable = (gamepad.analog_static.axis_rx | gamepad.analog_static.axis_lx) ? true : false;
        window.configApp.enableIcon(2, analogEnable); // Analog

        window.configApp.enableIcon(3, analogEnable); // Snapback

        window.configApp.enableIcon(4, gamepad.rgb_static.rgb_groups>0); // RGB
        

        let imuEnable = (gamepad.imu_static.axis_gyro_a) ? true : false;
        window.configApp.enableIcon(5, imuEnable); // IMU

        let hapticEnable = (gamepad.haptic_static.haptic_hd | gamepad.haptic_static.haptic_sd) ? true : false;
        window.configApp.enableIcon(6, hapticEnable); // Haptic

        window.configApp.enableIcon(7, true); // User

        let batteryEnable = (gamepad.battery_static.battery_capacity_mah > 0) ? true : false;
        window.configApp.enableIcon(8, batteryEnable); // Battery

        let wirelessEnable = (gamepad.bluetooth_static.bluetooth_bdr_supported | gamepad.bluetooth_static.bluetooth_ble_supported) ? true : false;
        window.configApp.enableIcon(9, wirelessEnable); // Battery

        await badgeCheck();

        // Enable Save
        saveButton.enableButton(true);

        // Get FW version and compare
        let fwVersion = await getManifestVersion(parseBufferText(gamepad.device_static.manifest_url));

        const debugForced = DEBUG_MODE && debugForceFwOnConnect;
        const updateAvailable = fwVersion !== false
            && fwVersion.version > gamepad.device_static.fw_version;

        if (updateAvailable || debugForced) {
            await tryShowGamepadFwUpdate(fwVersion, { debugForced });
        }
        else {
            // Firmware current — clear update / complete panels
            if (fwUiMode !== 'hidden' && fwUiMode !== 'bootloader-install') {
                hideFwUpdateUi();
                pendingFwUrl = undefined;
                pendingFwChecksum = undefined;
            }
        }
    }

    function disconnectHandle() {
        // Disable Save
        saveButton.enableButton(false);
        connectButton.setState('off');

        // Keep pending FW URL if we just asked the device to enter bootloader
        if (fwUiMode === 'update-available') {
            hideFwUpdateUi();
            pendingFwUrl = undefined;
            pendingFwChecksum = undefined;
            pendingIsLegacy = false;
        }

        // Avoid module close work that talks to USB while rebooting into bootloader
        if (fwUiMode === 'awaiting-bootloader' || fwUiMode === 'bootloader-flash') {
            for(let i = 0; i < 10; i++)
            {
                window.configApp.enableIcon(i, false);
                window.configApp.setNotificationBadge(i, false);
            }
            saveButton.enableButton(false);
            connectButton.setState('off');
            return true;
        }

        console.log("Closing module: " + window.configApp.currentModule());

        const keepWirelessModuleForExternalUpdate =
            hasEsp32ExternalWirelessHardware()
            && window.configApp.currentModule() == "Wireless";

        if (!keepWirelessModuleForExternalUpdate) {
            window.configApp.closemoduleView();
        }

        for(let i = 0; i < 10; i++)
        {
            window.configApp.enableIcon(i, false);
            window.configApp.setNotificationBadge(i, false);
        }

        return true;
    }

    gamepad.setConnectHook(connectHandle);
    gamepad.setDisconnectHook(disconnectHandle);
    gamepad.setLegacyDetectionHook(enableLegacyFwUpdateMessage);
    gamepad.setBootloaderHook(handlePicoBootloaderConnect);

    wireFwButtons();

    if (navigator.usb) {
        // Listen for device connect/disconnect events for Pico Bootloader
        navigator.usb.addEventListener('connect', async (event) => {
            console.log('USB device connected:', event.device);
            if (isPicoBootloaderDevice(event.device)) {
                console.log('Pico Boot Device Detected');
                await handlePicoBootloaderConnect();
            }
        });

        // Listen for device disconnect events for Pico Bootloader
        navigator.usb.addEventListener('disconnect', async (event) => {
            console.log('USB device disconnected:', event.device);
            if (isPicoBootloaderDevice(event.device)) {
                console.log('Pico Boot Device disconnected!');
                await handlePicoBootloaderDisconnect();
            }
        });

        // If a Pico bootloader is already authorized/connected on load, offer install
        try {
            const existing = await navigator.usb.getDevices();
            if (existing.some(isPicoBootloaderDevice) && !pendingFwUrl) {
                await showBootloaderInstall();
            }
        } catch (error) {
            console.warn('Could not query existing USB devices:', error);
        }
    }

    // Optional async handlers for connection/disconnection
    connectButton.setOnHandler(async () => {
        return await gamepad.connect();
    });

    connectButton.setOffHandler(async () => {
        return await gamepad.disconnect();
    });

    const installButton = document.getElementById('app-install-button');
    installButton.addEventListener('click', async function () {
        await installApp();
    });
});

