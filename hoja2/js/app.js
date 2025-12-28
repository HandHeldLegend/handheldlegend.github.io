import HojaGamepad from './gamepad.js';

// Dynamic module loader and settings management
import { registerSettingsModules } from './module-registry.js';
import { enableTooltips } from './tooltips.js';
import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { 
    pico_update_attempt_flash, 
    pico_exit_bootloader_attempt 
} from './pico_update.js';

let deviceDetected = false;
let deviceFwUrl = undefined;
let deviceFwChecksum = undefined;

function isWindows() {
  // Check the user agent string for Windows indicators
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Look for common Windows identifiers
  return userAgent.includes('win32') || 
         userAgent.includes('win64') || 
         userAgent.includes('windows') || 
         userAgent.includes('wow64');
}

async function isOnline() {
    try {
        const response = await fetch('/ping.json', { method: 'HEAD', cache: 'no-store' });
        console.log("ONLINE");
        return response.ok;
    } catch (error) {
        console.log("OFFLINE");
        return false; // Network request failed, assume offline
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
            // Push a new state to maintain history stack
            history.pushState(null, '', window.location.pathname);
        };

        // Add initial state when app loads
        history.pushState(null, '', window.location.pathname);
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

async function enableLegacyFwUpdateMessage(url) {
    const bootloaderButton = document.getElementById("bootloader-button");
    const downloadButton = document.getElementById("download-button");
    const fwMessageBox = document.getElementById("fw-update-box");

    bootloaderButton.setOnClick(async () => {
        if(gamepad) {
            await gamepad.setBootloaderLegacy();
            return true;
        }
    });

    downloadButton.setOnClick(() => {
        window.open(url, '_blank');
        return true;
    });

    fwMessageBox.setAttribute("visible", "true");
}

async function enableFwUpdateMessage({enableDropdown, enableBootloader, enableDownload, enableEasy, enableCancel}, url, checksum) {
    const bootloaderButton = document.getElementById("bootloader-button");
    const downloadButton = document.getElementById("download-button");
    const updateButton = document.getElementById("update-button");
    const fwMessageBox = document.getElementById("fw-update-box");
    const cancelButton = document.getElementById("exit-bootloader-button");
    

    if(enableDropdown != undefined) {
        if(enableDropdown) {
            fwMessageBox.setAttribute("visible", "true");
        }
        else {
            fwMessageBox.setAttribute("visible", "false");
        }
    }
    

    if(enableBootloader != undefined) {
        if(enableBootloader) {
            bootloaderButton.setOnClick(async () => {
                if(gamepad) {
                    gamepad.sendConfigCommand(gamepadCfgBlock, bootloaderCmd);
                    return true;
                }
            });
            bootloaderButton.enableButton(true);
        }
        else {
            bootloaderButton.enableButton(false);
        }
    }

    if(enableDownload != undefined)
    {
        if(deviceDetected != true)
        {
            downloadButton.setOnClick(() => {
                window.open('https://docs.handheldlegend.com/s/portal/doc/firmware-list-NVFevpDKbQ', '_blank');
                return true;
            });
        }
        else if(url != undefined && checksum != undefined) {
            downloadButton.setOnClick(() => {
                window.open(url, '_blank');
                return true;
            });
        }

        if(enableDownload) {
            downloadButton.enableButton(true);
        }
        else {
            downloadButton.enableButton(false);
        }
    }

    if(enableEasy != undefined) {

        if(deviceDetected != true)
        {
            updateButton.enableButton(false);
        }
        else if (enableEasy == false) {
            updateButton.enableButton(false);
        }
        else if (enableEasy == true) {
            updateButton.enableButton(true);
        }

        if(url != undefined && checksum != undefined) {
            updateButton.setOnClick(async () => {
                if(gamepad) {
                    await pico_update_attempt_flash(url, checksum);
                    return true;
                }
            });
        }
    }

    if(enableCancel != undefined)
    {
        if(enableCancel == true) {
            cancelButton.setOnClick(async () => {
                await pico_exit_bootloader_attempt();
                return true;
            });
            cancelButton.enableButton(true);
        }
        else {
            cancelButton.enableButton(false);
        }
    }
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

    const analogCfgBlockNumber = 2;
    const hoverCfgBlockNumber = 1;

    // Re-read data
    await gamepad.requestBlock(analogCfgBlockNumber);
    await gamepad.requestBlock(hoverCfgBlockNumber);

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

        //console.log(currentBasebandVersion);
        //console.log(gamepad.bluetooth_static.external_version_number);

        if(gamepad.bluetooth_static.external_version_number < currentBasebandVersion) {
            window.configApp.setNotificationBadge(9, true);
        }
        else window.configApp.setNotificationBadge(9, false);
        // End Baseband Version Check
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

// Initialize the app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {

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
        await badgeCheck();
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

        // Set device detect flag
        deviceDetected = true;

        // Get FW version and compare
        let fwVersion = await getManifestVersion(parseBufferText(gamepad.device_static.manifest_url));

        let debugFw = false;
        
        if(fwVersion == false)
        {

        }
        else if(fwVersion.version > gamepad.device_static.fw_version || debugFw===true) {

            let enableOptions = 
            {
                enableDropdown: true,
                enableBootloader: true,
                enableDownload: true,
                enableEasy: true,
                enableCancel: false
            }

            if(isWindows()) {
                enableOptions.enableEasy = false;
            }

            // Enable FW update
            enableFwUpdateMessage(enableOptions, parseBufferText(gamepad.device_static.firmware_url), fwVersion.checksum);
        }
        else {
            let enableOptions = 
            {
                enableDropdown: false,
                enableBootloader: false,
                enableDownload: false,
                enableEasy: false,
                enableCancel: false
            }
            // Enable FW update
            enableFwUpdateMessage(enableOptions, parseBufferText(gamepad.device_static.firmware_url), fwVersion.checksum);
        }       
    }

    function disconnectHandle() {
        // Disable Save
        saveButton.enableButton(false);
        connectButton.setState('off');

        console.log("Closing module: " + window.configApp.currentModule());

        if(window.configApp.currentModule() != "Wireless") {
            window.configApp.closemoduleView();
        }

        for(let i = 0; i < 10; i++)
        {
            window.configApp.enableIcon(i, false);
            window.configApp.setNotificationBadge(i, false);
        }

        let enableOptions =
        {
            enableDropdown: false,
            enableBootloader: false,
            enableDownload: false,
            enableEasy: false
        };

        return true;
    }

    gamepad.setConnectHook(connectHandle);
    gamepad.setDisconnectHook(disconnectHandle);
    gamepad.setLegacyDetectionHook(enableLegacyFwUpdateMessage);

    const PICO_VID = 0x2e8a;
    const PICO_PID = 0x0003;

    // Listen for device connect/disconnect events for Pico Bootloader
    navigator.usb.addEventListener('connect', event => {
        console.log('USB device connected:', event.device);
        if (event.device.vendorId === PICO_VID && 
            event.device.productId === PICO_PID) {
            console.log('Pico Boot Device Detected');
            
            let enableOptions =
            {
                enableDropdown: true,
                enableBootloader: false,
                enableDownload: true,
                enableEasy: true,
                enableCancel: true
            };

            enableFwUpdateMessage(enableOptions, undefined, undefined);
        }
    });

    // Listen for device disconnect events for Pico Bootloader
    navigator.usb.addEventListener('disconnect', event => {
        console.log('USB device disconnected:', event.device);
        if (event.device.vendorId === PICO_VID && 
            event.device.productId === PICO_PID) {
            console.log('Pico Boot Device disconnected!');
            
            // Clear device detected flag
            deviceDetected = false;

            let enableOptions =
            {
                enableDropdown: false,
                enableBootloader: false,
                enableDownload: false,
                enableEasy: false,
                enableCancel: false
            };

            enableFwUpdateMessage(enableOptions, undefined, undefined);
        }
    });

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

