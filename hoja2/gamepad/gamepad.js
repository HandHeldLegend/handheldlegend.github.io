class HojaGamepad {

// Static instance for singleton pattern
  static #instance = null;

  // Private fields for device and connection state
  #device = null;
  #isConnected = false;
  #pollingInterval = null;

  // Internal memory for parameters
  #parameters = {
    rgbColor: { r: 0, g: 0, b: 0 },
    rumbleIntensity: 0,
    deadzone: 0.1,
    buttonMappings: {}
  };

  // Event handlers
  #eventListeners = {
    connect: [],
    disconnect: [],
    report: []
  };

  // Private constructor to enforce singleton
  constructor() {
    if (GamepadController.#instance) {
      return GamepadController.#instance;
    }
    GamepadController.#instance = this;
  }

  // Singleton access method
  static getInstance() {
    if (!this.#instance) {
      this.#instance = new GamepadController();
    }
    return this.#instance;
  }

  // Connect to the USB device
  async connect() {
    try {
      // Request the USB device (WebUSB)
      this.#device = await navigator.usb.requestDevice({
        filters: [
          // Replace with your specific USB device vendor and product IDs
          { vendorId: 0x1234, productId: 0x5678 }
        ]
      });

      // Open the device
      await this.#device.open();
      
      // Configure the device (example configuration)
      await this.#device.selectConfiguration(1);
      await this.#device.claimInterface(1);

      this.#isConnected = true;
      this.#triggerEvent('connect');
      this.#startPolling();
    } catch (error) {
      console.error('Connection failed:', error);
      this.#triggerEvent('disconnect');
    }
  }

  // Disconnect the device
  async disconnect() {
    if (this.#device) {
      try {
        // Stop polling
        this.#stopPolling();

        // Close the device
        await this.#device.close();
        
        this.#isConnected = false;
        this.#device = null;
        this.#triggerEvent('disconnect');
      } catch (error) {
        console.error('Disconnection failed:', error);
      }
    }
  }

  // Internal polling method
  #startPolling() {
    this.#pollingInterval = setInterval(async () => {
      if (!this.#isConnected) return;

      try {
        // Example of reading input report
        const report = await this.#device.transferIn(1, 64);
        
        if (report.data) {
          // Parse the report and update internal state
          this.#parseReport(report.data);
          
          // Trigger report listeners
          this.#triggerEvent('report', report.data);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 16); // Approximately 60 FPS
  }

  // Stop polling
  #stopPolling() {
    if (this.#pollingInterval) {
      clearInterval(this.#pollingInterval);
      this.#pollingInterval = null;
    }
  }

  // Parse incoming USB report
  #parseReport(data) {
    // Implement specific parsing logic for your gamepad
    // This is a placeholder implementation
    const parsedData = {
      buttons: [],
      axes: []
    };

    // Trigger any necessary internal state updates
    this.#updateInternalState(parsedData);
  }

  // Update internal state based on parsed report
  #updateInternalState(parsedData) {
    // Example: Update RGB based on some condition
    if (parsedData.buttons.length > 0) {
      this.#parameters.rgbColor = this.#calculateRGBFromInput(parsedData);
    }
  }

  // Method to set RGB color
  setRGBColor(r, g, b) {
    if (!this.#isConnected) {
      throw new Error('Device not connected');
    }

    this.#parameters.rgbColor = { r, g, b };
    this.#sendRGBToDevice(r, g, b);
  }

  // Send RGB color to device (placeholder)
  async #sendRGBToDevice(r, g, b) {
    try {
      // Implement USB transfer to set RGB
      await this.#device.transferOut(1, new Uint8Array([r, g, b]));
    } catch (error) {
      console.error('Failed to set RGB:', error);
    }
  }

  // Event listener management
  on(event, callback) {
    if (this.#eventListeners[event]) {
      this.#eventListeners[event].push(callback);
    }
  }

  // Trigger events
  #triggerEvent(eventName, data) {
    const listeners = this.#eventListeners[eventName] || [];
    listeners.forEach(callback => callback(data));
  }

  // Getter for current parameters
  getParameters() {
    return { ...this.#parameters };
  }

  // Utility method for RGB calculation (example)
  #calculateRGBFromInput(parsedData) {
    // Implement your own logic to derive RGB from input
    return { 
      r: Math.min(255, parsedData.buttons[0] * 255),
      g: Math.min(255, parsedData.buttons[1] * 255),
      b: Math.min(255, parsedData.buttons[2] * 255)
    };
  }
}

export default HojaGamepad;