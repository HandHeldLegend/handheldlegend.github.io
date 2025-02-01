export async function registerSettingsModules() {
    // List of available settings modules
    const moduleConfigs = [
        {
            name: 'Gamepad',
            path: '../modules/gamepad-md.js',
            icon: 'gamepad.svg', 
            color: '#eb4034' // Deep blue for a tech/gaming vibe
        },
        {
            name: 'Remap',
            path: '../modules/remap-md.js',
            icon: 'remap.svg',
            color: '#1cb87e' // Green for customization and change
        },
        {
            name: 'Joysticks',
            path: '../modules/analog-md.js',
            icon: 'analog.svg', 
            color: '#eb8334' // Bright red for action and controls
        },
        {
            name: 'RGB',
            path: '../modules/rgb-md.js',
            icon: 'rgb.svg',
            color: '#34c0eb' // Vibrant purple to reflect RGB lighting aesthetics
        },
        {
            name: 'Triggers',
            path: '../modules/trigger-md.js',
            icon: 'triggers.svg', 
            color: '#ebb134' // Orange to denote interaction
        },
        {
            name: 'Motion',
            path: '../modules/motion-md.js',
            icon: 'motion.svg', 
            color: '#5334eb' // Teal for a fresh and dynamic feel
        },
        {
            name: 'Haptics',
            path: '../modules/haptic-md.js',
            icon: 'haptics.svg', 
            color: '#b5b81c' // Orange for energy and vibration
        },
        {
            name: 'User',
            path: '../modules/user-md.js',
            icon: 'user.svg', 
            color: '#ab34eb' // Neutral grey/blue for a profile
        },
        {
            name: 'Battery',
            path: '../modules/battery-md.js',
            icon: 'battery.svg', 
            color: '#1cb845' 
        },
        {
            name: 'Wireless',
            path: '../modules/wireless-md.js',
            icon: 'wireless.svg', 
            color: '#eb34b4'
        },
    ];
    

    return moduleConfigs;
}