import { AnalogConfig } from "./config/analog_cfg.js";

class HojaGamepad {

// Static instance for singleton pattern
  static #instance = null;

  // Private fields for device and connection state
  #device = null;
  #isConnected = false;
  #polling = null;

  #deviceItf = 1;
  #deviceEp = 2;

  analog_cfg = new AnalogConfig();

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
          this.#parseReport(result.data);
          this.#pollDevice();
        })
        .catch(error => {
          console.error('Polling error:', error);
          setTimeout(() => this.#pollDevice(), 100); // Retry after a delay
        });
  }

  #blockType = -1;
  #tmpData = new Uint8Array(1024);

  #blockParser(data) {
    const blockThisTime = data.getUint8(1);
    const chunkSize = data.getUint8(2);
    const writeIdx = data.getUint8(3);
    const chunkData = new Uint8Array(data.buffer, data.byteOffset+4, chunkSize);

    // Check the block type
    if(this.#blockType != blockThisTime)
    {
      this.#tmpData = new Uint8Array(1024);
      this.#blockType = blockThisTime;
    }

    if(writeIdx == 0xFF)
    {
      // Received full block chunk
      console.log("Full chunk completed: " + this.#blockType);
      
      switch(this.#blockType)
      {
        // CFG_BLOCK_GAMEPAD
        case 0:
          
          break;

        // CFG_BLOCK_REMAP
        case 1:
          break;

        // CFG_BLOCK_ANALOG
        case 2:
          console.log("GOT analog config chunk");
          this.analog_cfg.setConfigurationBlock(this.#tmpData);
          this.analog_cfg.debugPrint();
          break;
        
        // CFG_BLOCK_RGB
        case 3:
          break;

        // CFG_BLOCK_TRIGGER
        case 4:
          break;

        // CFG_BLOCK_IMU
        case 5:
          break;

        // CFG_BLOCK_HAPTIC
        case 6: 
          break;

        // CFG_BLOCK_USER
        case 7:
          break;

      }
      this.#blockType = -1;
    }
    else 
    {
      this.#tmpData.set(chunkData, writeIdx*32);
    }

  }

  // Parse incoming USB report
  #parseReport(data) {
    switch(data.getUint8(0))
    {
      // WEBUSB_ID_READ_CONFIG_BLOCK
      case 1:
        this.#blockParser(data);
        break;

      // WEBUSB_ID_WRITE_CONFIG_BLOCK
      case 2:
        break;
    }
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
      const payload = new Uint8Array([command, ...data]);
      console.log("Sending...");
      this.#device.transferOut(2, payload);

    } catch (error) {
      console.error('Failed to send command.', error);
    }
  }
}

export default HojaGamepad;