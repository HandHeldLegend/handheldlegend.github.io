class HojaGamepad {

// Static instance for singleton pattern
  static #instance = null;

  // Private fields for device and connection state
  #device = null;
  #isConnected = false;
  #polling = null;

  #deviceItf = 1;
  #deviceEp = 2;

  // Internal memory for parameters
  #parameters = {
    name: "gamepad",
  };

  // Event handlers
  #eventListeners = {
    connect: [],
    disconnect: [],
    report: []
  };

  // Private constructor to enforce singleton
  constructor() {
    if (HojaGamepad.#instance) {
      return HojaGamepad.#instance;
    }
    HojaGamepad.#instance = this;
  }

  // Singleton access method
  static getInstance() {
    if (!this.#instance) {
      this.#instance = new HojaGamepad();
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
          { vendorId: 0x057E, productId: 0x2009 }
        ]
      });

      // Open the device
      await this.#device.open();
      
      // Configure the device (example configuration)
      await this.#device.selectConfiguration(1);
      await this.#device.claimInterface(1);

      this.#isConnected = true;
      this.#triggerEvent('connect');
      this.#pollDevice();
    } catch (error) {
      console.error('Connection failed:', error);
      this.#triggerEvent('disconnect');
    }
  }

  // Disconnect the device
  async disconnect() {
    if (this.#device) {
      try {

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
  #pollDevice() {
      if (!this.#isConnected)
      {
        console.log("Device not connected to poll.");
      }

      this.#device.transferIn(2, 64)
        .then(result => {
          console.log("Received...");
          console.log(result.data);
          this.#pollDevice();
        })
        .catch(error => {
          console.error('Polling error:', error);
          setTimeout(() => this.#pollDevice(), 100); // Retry after a delay
        });
  }

  // Parse incoming USB report
  #parseReport(data) {
    console.log(data);
    // Trigger any necessary internal state updates
    //this.#updateInternalState(parsedData);
  }

  // Update internal state based on parsed report
  #updateInternalState(parsedData) {

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

  async sendCommand(command, data) {
    try {
      if(!this.#isConnected)
      {
        throw new Error("Can't send command, device not connected!");
      }
      
      // Create a Uint8Array with the first byte as the command and the rest as data
      const payload = new Uint8Array([1, ...data]);
      console.log("Sending...");
      console.log(payload);
      this.#device.transferOut(2, payload);

    } catch (error) {
      console.error('Failed to send command.', error);
    }
  }
}

export default HojaGamepad;