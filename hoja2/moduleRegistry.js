export async function registerSettingsModules() {
    // List of available settings modules
    const moduleConfigs = [
        {
            name: 'Gamepad',
            path: './modules/gamepad-cp.js',
            icon: '🎮', // Represents gaming controllers
            color: '#2980b9' // Deep blue for a tech/gaming vibe
        },
        {
            name: 'Remap',
            path: './modules/remap-cp.js',
            icon: '♻️', // Suggests reconfiguration or recycling
            color: '#27ae60' // Green for customization and change
        },
        {
            name: 'Joysticks',
            path: './modules/analog-cp.js',
            icon: '🕹️', // Classic joystick symbol
            color: '#c0392b' // Bright red for action and controls
        },
        {
            name: 'RGB',
            path: './modules/rgb-cp.js',
            icon: '🌈', // Represents colorful lighting
            color: '#8e44ad' // Vibrant purple to reflect RGB lighting aesthetics
        },
        {
            name: 'Triggers',
            path: './modules/trigger-cp.js',
            icon: '🔘', // Button or trigger-like appearance
            color: '#f39c12' // Orange to denote interaction
        },
        {
            name: 'Motion',
            path: './modules/imu-cp.js',
            icon: '🔄', // Suggests movement and orientation
            color: '#1abc9c' // Teal for a fresh and dynamic feel
        },
        {
            name: 'Haptics',
            path: './modules/haptic-cp.js',
            icon: '💥', // Represents tactile feedback
            color: '#e67e22' // Orange for energy and vibration
        },
        {
            name: 'User',
            path: './modules/user-cp.js',
            icon: '👤', // Universal user symbol
            color: '#34495e' // Neutral grey/blue for a profile
        },
        {
            name: 'Battery',
            path: './modules/battery-cp.js',
            icon: '🔋', // Battery symbol
            color: '#2ecc71' // Green for energy and charge
        },
    ];
    

    return moduleConfigs;
}