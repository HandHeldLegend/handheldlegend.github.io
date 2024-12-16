import Gamepadconfig from "../factory/parsers/gamepadConfig.js";
import Remapconfig from "../factory/parsers/remapConfig.js";
import Analogconfig from "../factory/parsers/analogConfig.js";
import Rgbconfig from "../factory/parsers/rgbConfig.js";
import Triggerconfig from "../factory/parsers/triggerConfig.js";
import Imuconfig from "../factory/parsers/imuConfig.js";
import Hapticconfig from "../factory/parsers/hapticConfig.js";
import Userconfig from "../factory/parsers/userConfig.js";
import Batteryconfig from "../factory/parsers/batteryConfig.js";

class HojaGamepad {

  // Static instance for singleton pattern
  static #instance = null;

  // Private fields for device and connection state
  #device = null;
  #isConnected = false;
  #polling = null;

  #deviceItf = 1;
  #deviceEp = 2;
  #chunkSizeMax = 32;

  // State for managing block reading
  #blockMemoryState = {
    reading: false, 
    writing: false, 
    currentBlock: 0, 
    totalBlocks: 9, // Total number of blocks to read
    isDoneReading: false, 
    isDoneWriting: false, 
    currentWriteBlock: 0, 
    currentWriteIdx: 0,
  };

  gamepad_cfg = new Gamepadconfig();
  remap_cfg = new Remapconfig();
  analog_cfg = new Analogconfig();
  rgb_cfg = new Rgbconfig();
  trigger_cfg = new Triggerconfig();
  imu_cfg = new Imuconfig();
  haptic_cfg = new Hapticconfig();
  user_cfg = new Userconfig();
  battery_cfg = new Batteryconfig();

  #configBlocks = [this.gamepad_cfg, this.remap_cfg, this.analog_cfg, this.rgb_cfg, this.trigger_cfg, this.imu_cfg, this.haptic_cfg, this.user_cfg, this.battery_cfg];
  #configBlockNames = ["gamepad", "remap", "analog", "rgb", "trigger", "imu", "haptic", "user", "battery"];

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

      await this.getAllBlocks();

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
    if (!this.#isConnected) {
      console.log("Device not connected to poll.");
      return;
    }

    this.#device.transferIn(2, 64)
      .then(result => {
        if (result.data) {
          this.#parseReport(result.data); // Process data if available
        } else {
          console.warn("No data received from device.");
        }

        this.#pollDevice();
      });
  }

  #blockParser(data) {
    let blockThisTime = data.getUint8(1);
    let chunkSize = data.getUint8(2);
    let writeIdx = data.getUint8(3);
    let done = writeIdx === 0xFF;
    let write = (chunkSize > 0) ? true : false;

    let chunkData = null;
    if (write) chunkData = new Uint8Array(data.buffer, data.byteOffset + 4, chunkSize);

    const idxOffset = 32; // Adjust based on your specific use case

    if (write) this.#configBlocks[blockThisTime].buffer.set(chunkData, writeIdx * idxOffset);
    if (done) console.log("Received " + this.#configBlockNames[blockThisTime] + " config chunk");

    if (done) {
      this.#blockMemoryState.isDoneReading = true; // Mark block reading as done
    }
  }

  // Parse incoming USB report
  #parseReport(data) {
    switch (data.getUint8(0)) {

      // WEBUSB_ID_READ_CONFIG_BLOCK
      case 1:
        this.#blockParser(data);
        break;

      // WEBUSB_ID_WRITE_CONFIG_BLOCK
      case 2:
        // Confirm write done
        let wr_block = data.getUint8(1);
        let wr_idx = data.getUint8(2);

        if( (this.#blockMemoryState.currentWriteBlock == wr_block) && 
            (this.#blockMemoryState.currentWriteIdx == wr_idx) )
        {
          console.log("Done writing " + wr_block + " " + wr_idx);
          this.#blockMemoryState.isDoneWriting = true;
        }
        break;

      default:
        console.warn(`Unhandled report ID: ${data.getUint8(0)}`);
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

  async getAllBlocks() {
    console.log("Starting block read...");
    for (let blockIndex = 0; blockIndex < this.#blockMemoryState.totalBlocks; blockIndex++) {
      try {
        await this.requestBlock(blockIndex);
      } catch (error) {
        console.error(`Error reading block ${blockIndex}:`, error);
        break;
      }
    }
    console.log("Completed reading all blocks.");

    await this.sendAllBlocks();
    console.log("Completed sending all blocks.");
  }

  async requestBlock(blockIndex) {
    this.#blockMemoryState.isDoneReading = false; // Reset done state for this block

    // Send request for the block
    await this.sendCommand(0x01, new Uint8Array([blockIndex]));

    // Wait for block parsing to finish (using a confirmation signal)
    await this.waitForReadConfirmation();
  }

  async sendAllBlocks() {
    for (let i = 0; i < this.#blockMemoryState.totalBlocks; i++) {
      await this.sendBlock(i);
    }
  }

  async sendBlock(blockIndex) {
    
    this.#blockMemoryState.currentWriteBlock = blockIndex;

    const chunkMax = this.#chunkSizeMax;

    try {
      /** @type {Uint8Array} */
      let targetBuffer = this.#configBlocks[blockIndex].buffer;

      let bufferSize = targetBuffer.length;

      if (bufferSize <= chunkMax) {
        this.#blockMemoryState.isDoneWriting = false;
        this.#blockMemoryState.currentWriteIdx = 0;

        // ReportID, BlockID, WriteSize, WriteIndex, Data
        let outBuffer = new Uint8Array([0x02, blockIndex, bufferSize, 0, ...targetBuffer]);
        
        await this.#device.transferOut(this.#deviceEp, outBuffer);
        //await this.waitForWriteConfirmation();

        //console.log(this.#configBlockNames[blockIndex] + " single chunk sent");
      }
      else {
        let remaining = bufferSize;
        let idx = 0;
        while (remaining > 0) {
          // Reset write state for promise
          this.#blockMemoryState.isDoneWriting = false;
          this.#blockMemoryState.currentWriteIdx = idx;

          let writeSize = remaining <= chunkMax ? remaining : chunkMax;
          
          let outChunk = targetBuffer.slice((chunkMax * idx), (chunkMax * idx) + writeSize);
          // ReportID, BlockID, WriteSize, WriteIndex, Data
          let outBuffer = new Uint8Array([0x02, blockIndex, writeSize, idx, ...outChunk]);

          await this.#device.transferOut(this.#deviceEp, outBuffer);
          //await this.waitForWriteConfirmation();

          //console.log(this.#configBlockNames[blockIndex] + " chunk part " + idx + " sent");
          idx += 1;
          remaining -= writeSize;
        }
      }

      this.#blockMemoryState.isDoneWriting = false;
      this.#blockMemoryState.currentWriteIdx = 0xFF;

      // ReportID, BlockID, WriteSize, WriteIndex, Data
      let completeBuffer = new Uint8Array([0x02, blockIndex, 0, 0xFF]);
      
      await this.#device.transferOut(this.#deviceEp, completeBuffer);
      //await this.waitForWriteConfirmation();
      console.log("Sent " + this.#configBlockNames[blockIndex] + " block");
    }
    catch (error) {
      console.log("Invalid block trying to send");
    }
  }

  async waitForReadConfirmation(timeout = 5000) {
    const pollInterval = 50; // Poll every 50ms
    let elapsedTime = 0;

    // Poll until confirmation or timeout
    while (!this.#blockMemoryState.isDoneReading) {
      if (elapsedTime >= timeout) {
        throw new Error("Timeout waiting for block confirmation.");
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsedTime += pollInterval;
    }
  }

  async waitForWriteConfirmation(timeout = 5000) {
    const pollInterval = 50; // Poll every 50ms
    let elapsedTime = 0;

    // Poll until confirmation or timeout
    while (!this.#blockMemoryState.isDoneWriting) {
      if (elapsedTime >= timeout) {
        throw new Error("Timeout waiting for block confirmation.");
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsedTime += pollInterval;
    }
  }

  async sendCommand(command, data) {
    try {
      if (!this.#isConnected) {
        throw new Error("Can't send command, device not connected!");
      }

      // Create a Uint8Array with the first byte as the command and the rest as data
      const payload = new Uint8Array([command, ...data]);
      console.log("Sending command...");
      this.#device.transferOut(this.#deviceEp, payload);

    } catch (error) {
      console.error('Failed to send command.', error);
    }
  }
}

export default HojaGamepad;