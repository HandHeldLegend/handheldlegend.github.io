// Dynamic module loader and settings management
import { registerSettingsModules } from './moduleRegistry.js';
import { enableTooltips } from './tooltips.js';
import TristateButton from './components/tristate-button.js';
import SingleShotButton from './components/single-shot-button.js';
import HojaGamepad from './gamepad/gamepad.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();

class ConfigApp {

    #appIcons = [];

    constructor() {

        this.appGridContainer = document.getElementById('app-grid-container');
        this.appGrid = document.getElementById('app-grid');

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

    registerKeyboardEvents() {
        this.backButton.addEventListener('click', () => this.closemoduleView());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closemoduleView();
            }
        });
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
        icon.textContent = module.icon || module.name.charAt(0).toUpperCase();

        const label = document.createElement('span');
        label.textContent = module.name;

        iconContainer.appendChild(icon);
        iconContainer.appendChild(label);

        icon.addEventListener('click', () => {
            if(icon.getAttribute("enabled") == "true")
            {
                // Open module
                this.openmoduleView(module)
            }
                
        });

        this.appGrid.appendChild(iconContainer);

        this.#appIcons.push(icon);
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

    async openmoduleView(module) {
        // Reset scrollable position
        this.moduleScrollable.scrollTo(0,0);

        // Dynamically import the module
        const settingsModule = await import(module.path);

        // Clear previous content
        this.moduleContent.innerHTML = '';

        // Render module content
        if (settingsModule.render) {
            settingsModule.render(this.moduleContent);
        }

        this.setView(true);
    }

    closemoduleView() {
        this.setView(false);
    }
}

var debug = false;

async function sendSaveCommand() {
    if(gamepad) {
        return gamepad.save();
    }
    else {
        console.log("No Gamepad Present");
        return false;
    }
}

// Initialize the app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.configApp = new ConfigApp();

    const connectButton = document.getElementById('connect-button');
    const saveButton = document.getElementById('save-button');

    saveButton.setOnClick(sendSaveCommand);

    if (debug) {
        // Debug module
        const debugModule = [
            {
                name: 'Debug',
                path: './modules/user-md.js',
                icon: '🌐',
                color: '#3498db'
            }];

        window.configApp.openmoduleView(debugModule[0]);
    }

    enableTooltips();

    function connectHandle() {
        // Enable Icons
        window.configApp.enableIcon(0, true); // Gamepad
        window.configApp.enableIcon(1, true); // Remap
        
        let analogEnable = (gamepad.analog_static.axis_rx | gamepad.analog_static.axis_lx) ? true : false;
        window.configApp.enableIcon(2, analogEnable); // Analog
        window.configApp.enableIcon(3, gamepad.rgb_static.rgb_groups>0); // RGB

        let triggerEnable = 
        (gamepad.analog_static.axis_lt | gamepad.analog_static.axis_rt | 
         gamepad.device_static.joybus_supported) ? true : false;
        window.configApp.enableIcon(4, triggerEnable); // Triggers

        let imuEnable = (gamepad.imu_static.axis_gyro_a) ? true : false;
        window.configApp.enableIcon(5, imuEnable); // IMU

        let hapticEnable = (gamepad.haptic_static.haptic_hd | gamepad.haptic_static.haptic_sd) ? true : false;
        window.configApp.enableIcon(6, hapticEnable); // Haptic

        window.configApp.enableIcon(7, true); // User

        let batteryEnable = (gamepad.battery_static.capacity_mah > 0) ? true : false;
        window.configApp.enableIcon(8, batteryEnable); // Battery

        // Enable Save
        saveButton.enableButton(true);
    }

    function disconnectHandle() {
        // Disable Save
        saveButton.enableButton(false);

        connectButton.setState('off');

        window.configApp.closemoduleView();
        for(let i = 0; i < 9; i++)
        {
            window.configApp.enableIcon(i, false);
        }

        return true;
    }

    gamepad.setConnectHook(connectHandle);
    gamepad.setDisconnectHook(disconnectHandle);

    

    // Optional async handlers for connection/disconnection
    connectButton.setOnHandler(async () => {
        return await gamepad.connect();
    });

    connectButton.setOffHandler(async () => {
        return await gamepad.disconnect();
    });
});