import Gamepadconfig from "../factory/parsers/gamepadConfig.js";
import Remapconfig from "../factory/parsers/remapConfig.js";
import Analogconfig from "../factory/parsers/analogConfig.js";
import Rgbconfig from "../factory/parsers/rgbConfig.js";
import Triggerconfig from "../factory/parsers/triggerConfig.js";
import Imuconfig from "../factory/parsers/imuConfig.js";
import Hapticconfig from "../factory/parsers/hapticConfig.js";
import Userconfig from "../factory/parsers/userConfig.js";
import Batteryconfig from "../factory/parsers/batteryConfig.js";

import Analoginfostatic from "../factory/parsers/analogInfoStatic.js";
import Batteryinfostatic from "../factory/parsers/batteryInfoStatic.js";
import Bluetoothinfostatic from "../factory/parsers/bluetoothInfoStatic.js";
import Deviceinfostatic from "../factory/parsers/deviceInfoStatic.js";
import Rgbinfostatic from "../factory/parsers/rgbInfoStatic.js";
import Imuinfostatic from "../factory/parsers/imuInfoStatic.js";
import Buttoninfostatic from "../factory/parsers/buttonInfoStatic.js";
import Hapticinfostatic from "../factory/parsers/hapticInfoStatic.js";

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

  gamepad_cfg = new Gamepadconfig();
  remap_cfg = new Remapconfig();
  analog_cfg = new Analogconfig();
  rgb_cfg = new Rgbconfig();
  trigger_cfg = new Triggerconfig();
  imu_cfg = new Imuconfig();
  haptic_cfg = new Hapticconfig();
  user_cfg = new Userconfig();
  battery_cfg = new Batteryconfig();

  #configBlocks = [this.gamepad_cfg, this.remap_cfg,
  this.analog_cfg, this.rgb_cfg, this.trigger_cfg,
  this.imu_cfg, this.haptic_cfg, this.user_cfg,
  this.battery_cfg];
  #configBlockNames = ["gamepad", "remap", "analog", "rgb", "trigger", "imu", "haptic", "user", "battery"];

  device_static = new Deviceinfostatic();
  button_static = new Buttoninfostatic();
  analog_static = new Analoginfostatic();
  imu_static = new Imuinfostatic();
  battery_static = new Batteryinfostatic();
  haptic_static = new Hapticinfostatic();
  bluetooth_static = new Bluetoothinfostatic();
  rgb_static = new Rgbinfostatic();

  #staticBlocks = [this.device_static, this.button_static,
  this.analog_static, this.haptic_static, this.imu_static,
  this.battery_static, this.bluetooth_static, this.rgb_static];
  #staticBlockNames = ["device", "button", "analog", "haptic", "imu", "battery", "bluetooth", "rgb"];

  // State for managing block reading
  #blockMemoryState = {
    reading: false,
    writing: false,
    currentBlock: 0,
    totalBlocks: this.#configBlocks.length, // Total number of blocks to read
    totalStatics: this.#staticBlocks.length,
    isDoneReading: false,
    isDoneWriting: false,
    currentWriteBlock: 0,
    currentWriteIdx: 0,
  };

  #cfgCommandState = {
    cfgBlockUsed: -1,       // Which command block we sent to
    cfbCmdSent: -1,         // Which command we sent to the block
    cfgReturnData: null,    // Data that we can return
    cfgSentSuccess: false,  // If we have received our command confirmation yet
    cfgReturnStatus: false, // Value we return which is the status of our sent command
  };

  // Event hooks
  #_connectHook = null;
  #_disconnectHook = null;
  #_inputReportHook = null;

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

      // Set disconnect handle
      navigator.usb.addEventListener("disconnect", (event) => {
        this.#isConnected = false;
        this.#device = null;
          if (this.#_disconnectHook) this.#_disconnectHook();
      });

      this.#isConnected = true;

      this.#pollDevice();
      await this.getAllBlocks();
      await this.getAllStatics();

      if (this.#_connectHook) this.#_connectHook();

      return true;
    } catch (error) {
      console.error('Connection failed:', error);

      return false;
    }
  }

  // Disconnect the device
  async disconnect() {
    if (this.#device) {
      try {
        this.#isConnected = false;

        // Close the device
        await this.#device.close();
        this.#device = null;
        if (this.#_disconnectHook) this.#_disconnectHook();

        return true;

      } catch (error) {
        console.error('Disconnection failed:', error);
        return false;
      }
    }
  }

  // Commit settings blocks on the gamepad
  async save() {
    // CFG_BLOCK_GAMEPAD(0) GAMEPAD_CMD_SAVE_ALL(255)
    console.log("Attempting save...");
    let {status, data} = await this.sendConfigCommand(0, 0xFF);
    if(status) console.log("Save success.");
    else console.log("Save failed.");
    return status;
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

  #staticParser(data) {
    let blockThisTime = data.getUint8(1);
    let chunkSize = data.getUint8(2);
    let writeIdx = data.getUint8(3);
    let done = writeIdx === 0xFF;
    let write = (chunkSize > 0) ? true : false;

    let chunkData = null;
    if (write) chunkData = new Uint8Array(data.buffer, data.byteOffset + 4, chunkSize);

    const idxOffset = 32; // Adjust based on your specific use case
    if (write) this.#staticBlocks[blockThisTime].buffer.set(chunkData, writeIdx * idxOffset);

    if (done) console.log("Received " + this.#staticBlockNames[blockThisTime] + " static mem chunk");
    if (done) {
      this.#staticBlocks[blockThisTime].updateBuffer(this.#staticBlocks[blockThisTime].buffer);
      this.#blockMemoryState.isDoneReading = true; // Mark block reading as done
    }
  }

  #blockParser(data) {
    let blockThisTime = data.getUint8(1);
    let chunkSize = data.getUint8(2);
    let writeIdx = data.getUint8(3);
    let done = writeIdx === 0xFF;
    let write = (chunkSize > 0) ? true : false;

    let chunkData = null;
    if (write) chunkData = new Uint8Array(data.buffer, data.byteOffset + 4, chunkSize);

    const idxOffset = 32; 

    if (write) this.#configBlocks[blockThisTime].buffer.set(chunkData, writeIdx * idxOffset);
    if (done) console.log("Received " + this.#configBlockNames[blockThisTime] + " config block");

    if (done) {
      this.#configBlocks[blockThisTime].updateBuffer(this.#configBlocks[blockThisTime].buffer);
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

        if ((this.#blockMemoryState.currentWriteBlock == wr_block) &&
          (this.#blockMemoryState.currentWriteIdx == wr_idx)) {
          console.log("Done writing " + wr_block + " " + wr_idx);
          this.#blockMemoryState.isDoneWriting = true;
        }
        break;

      // WEBUSB_ID_READ_STATIC_BLOCK
      case 3:
        this.#staticParser(data);
        break;

      // WEBUSB_ID_CONFIG_COMMAND
      case 4:
        {
          let block = data.getUint8(1);
          let command = data.getUint8(2);
          let success = data.getUint8(3);
          let gotData = (data.byteLength > 4) ? true : false;

          if(
            block   == this.#cfgCommandState.cfgBlockUsed &&
            command == this.#cfgCommandState.cfbCmdSent
          ) {

            this.#cfgCommandState.cfgReturnStatus = success;

            if(success && gotData) {
              let newData = new Uint8Array(data.buffer.slice(4));
              this.#cfgCommandState.cfgReturnData = newData; // Set returnable data
            }

            this.#cfgCommandState.cfgSentSuccess = true;
          }
        }
        break;
      
      // WEBUSB_INPUT_RAW
      case 255:
        if(this.#_inputReportHook)
          try {
            this.#_inputReportHook(data);
          } catch (error) { 
            console.error("Input report hook missing or unassigned:", error); 
            this.#_inputReportHook = null;
          }
        break;
      
      // WEBUSB_ID_ANALOG_DUMP
      case 250:
        let out = [];

        for(let i = 0; i < 31; i++) {
          let distance = ((data.getUint8((i*2) + 2) << 8) | data.getUint8((i*2) + 3)) & 0x7FF;
          let direction = (data.getUint8((i*2) + 2) & 0x80) ? -1 : 1;
          distance = direction * distance;

          out.push(distance);
        }

        console.log(out);
        break;

      default:
        console.warn(`Unhandled report ID: ${data.getUint8(0)}`);
    }
  }

  // Update internal state based on parsed report
  #updateInternalState(parsedData) {

  }

  setConnectHook(callback) {
    this.#_connectHook = callback;
  }

  setDisconnectHook(callback) {
    this.#_disconnectHook = callback;
  }

  setReportHook(callback) {
    this.#_inputReportHook = callback;
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
    console.log("Completed reading all cfg blocks.");
  }

  async requestBlock(blockIndex) {
    this.#blockMemoryState.isDoneReading = false; // Reset done state for this block

    // Send request for the block
    await this.sendReport(0x01, new Uint8Array([blockIndex]));

    // Wait for block parsing to finish (using a confirmation signal)
    await this.waitForReadConfirmation();
  }

  async sendAllBlocks() {
    for (let i = 0; i < this.#blockMemoryState.totalBlocks; i++) {
      await this.sendBlock(i);
    }
  }

  async getAllStatics() {
    console.log("Starting static mem read...");
    for (let blockIndex = 0; blockIndex < this.#blockMemoryState.totalStatics; blockIndex++) {
      try {
        await this.requestStatic(blockIndex);
      } catch (error) {
        console.error(`Error reading static ${blockIndex}:`, error);
        break;
      }
    }
    console.log("Completed reading all statics.");
  }

  async requestStatic(blockIndex) {
    this.#blockMemoryState.isDoneReading = false; // Reset done state for this block

    // Send request for the block
    await this.sendReport(0x03, new Uint8Array([blockIndex]));

    // Wait for block parsing to finish (using a confirmation signal)
    await this.waitForReadConfirmation();
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
      console.log("Error trying to send block.");
    }
  }

  async waitForReadConfirmation(timeout = 5000) {
    const pollInterval = 50; // Poll every 50ms
    let elapsedTime = 0;

    // Poll until confirmation or timeout
    while (!this.#blockMemoryState.isDoneReading) {
      if (elapsedTime >= timeout) {
        throw new Error("Timeout waiting for confirmation.");
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

  async sendReport(reportId, data) {
    try {
      if (!this.#isConnected) {
        throw new Error("Can't send report, device not connected!");
      }

      // Create a Uint8Array with the first byte as the command and the rest as data
      const payload = new Uint8Array([reportId, ...data]);

      this.#device.transferOut(this.#deviceEp, payload);
    } catch (error) {
      console.error('Failed to send report.', error);
      return false;
    }
  }  

  async waitForCommandConfirmation(timeout = 5000) {
    const pollInterval = 50; // Poll every 50ms
    let elapsedTime = 0;

    // Poll until confirmation or timeout
    while (!this.#cfgCommandState.cfgSentSuccess) {
      if (elapsedTime >= timeout) {
        // Set config command state
        this.#cfgCommandState.cfgBlockUsed    = -1;
        this.#cfgCommandState.cfbCmdSent      = -1;
        this.#cfgCommandState.cfgReturnData   = null;
        this.#cfgCommandState.cfgReturnStatus = false;
        this.#cfgCommandState.cfgSentSuccess  = false;
        return {
          status: false,
          data:   null
        };
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsedTime += pollInterval;
    }

    // Return the status and data for our command confirmation
    return {
      status: this.#cfgCommandState.cfgReturnStatus,
      data:   this.#cfgCommandState.cfgReturnData
    };
  }

  async sendConfigCommand(block, command) {
    try {
      if (!this.#isConnected) {
        throw new Error("Can't send command, device not connected!");
      }

      // Set config command state
      this.#cfgCommandState.cfgBlockUsed    = block;
      this.#cfgCommandState.cfbCmdSent      = command;
      this.#cfgCommandState.cfgReturnStatus = false;
      this.#cfgCommandState.cfgSentSuccess  = false;

      // Create a Uint8Array with the first byte as the command and the rest as data
      
      let payload = new Uint8Array([block, command]);
      // WEBUSB_ID_CONFIG_COMMAND = 4
      await this.sendReport(4, payload);

      return await this.waitForCommandConfirmation();

    } catch (error) {
      console.error('Failed to send command.', error);
      return false;
    }
  }
}

export default HojaGamepad;