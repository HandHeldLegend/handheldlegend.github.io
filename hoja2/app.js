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

        icon.addEventListener('click', () => this.openmoduleView(module));

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
        }
        else {
            this.moduleContainer.setAttribute("visible", "true");
            this.appGridContainer.setAttribute("visible", "false");
        }
    }

    async openmoduleView(module) {
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


// Initialize the app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.configApp = new ConfigApp();

    const connectButton = document.getElementById('connect-button');
    const saveButton = document.getElementById('save-button');

    if (debug) {
        // Debug module
        const debugModule = [
            {
                name: 'Debug',
                path: './modules/rgb-cp.js',
                icon: '🌐',
                color: '#3498db'
            }];

        window.configApp.openmoduleView(debugModule[0]);
    }

    enableTooltips();

    function connectHandle() {
        // Enable Icons
        window.configApp.enableIcon(3, gamepad.rgb_static.rgb_groups>0);

        // Enable Save
        saveButton.enableButton(true);
    }

    function disconnectHandle() {
        // Disable Save
        saveButton.enableButton(false);

        window.configApp.closemoduleView();
        for(let i = 0; i < 9; i++)
        {
            window.configApp.enableIcon(i, false);
        }
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