// Dynamic module loader and settings management
import { registerSettingsModules } from './moduleRegistry.js';
import { enableTooltips } from './tooltips.js';
import TristateButton from './components/tristate-button.js';
import SingleShotButton from './components/single-shot-button.js';


export var globalState = {
    gamepadMode: 2,

};

class ConfigApp {
    constructor() {
        this.settingsGrid = document.getElementById('settings-grid');
        this.settingsOverlay = document.getElementById('settings-overlay');
        this.settingsView = document.getElementById('settings-view');
        this.settingsContent = document.getElementById('settings-content');
        this.backButton = document.getElementById('back-button');

        this.registerKeyboardEvents();
        this.loadSettingsModules();
    }

    registerKeyboardEvents() {
        this.backButton.addEventListener('click', () => this.closeSettingsView());
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSettingsView();
            }
        });
    }

    async loadSettingsModules() {
        const modules = await registerSettingsModules();
        modules.forEach(module => this.createSettingsIcon(module));
    }

    createSettingsIcon(module) {
        const iconContainer = document.createElement('div');
        iconContainer.className = 'settings-icon';
        
        const icon = document.createElement('div');
        icon.className = 'icon';
        icon.style.backgroundColor = module.color || this.getRandomColor();
        icon.textContent = module.icon || module.name.charAt(0).toUpperCase();
        
        const label = document.createElement('span');
        label.textContent = module.name;
        
        iconContainer.appendChild(icon);
        iconContainer.appendChild(label);
        
        iconContainer.addEventListener('click', () => this.openSettingsView(module));
        
        this.settingsGrid.appendChild(iconContainer);
    }

    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    async openSettingsView(module) {
        // Dynamically import the module
        const settingsModule = await import(module.path);
        
        // Clear previous content
        this.settingsContent.innerHTML = '';
        
        // Render module content
        if (settingsModule.render) {
            settingsModule.render(this.settingsContent);
        }
        
        // Animate overlay
        this.settingsOverlay.classList.remove('hidden');
        this.settingsView.classList.add('slide-in');
    }

    closeSettingsView() {
        this.settingsOverlay.classList.add('hidden');
        this.settingsView.classList.remove('slide-in');
    }
}

var debug = false;
// Initialize the app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.configApp = new ConfigApp();

        if(debug)
        {
            // Debug module
            const debugModule = [
            {
                name: 'Debug',
                path: './modules/component-test.js',
                icon: '🌐',
                color: '#3498db'
            }];

            globalState.gamepadMode = 1;

            window.configApp.openSettingsView(debugModule[0]);
        }

        enableTooltips();
});