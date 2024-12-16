import Analogpackeddistances from './analogPackedDistances.js';
import Anglemap from './angleMap.js';


export default class Analogconfig {
  	#l_packed_distancesVal;
	#r_packed_distancesVal;
	#l_angle_mapsVal = [];
	#r_angle_mapsVal = [];


  constructor(buffer) {
    this.buffer = buffer || new Uint8Array(1024);

    	let l_packed_distancesBuf = this.#_getUint8Array(5, 130);
	this.#l_packed_distancesVal = new Analogpackeddistances(l_packed_distancesBuf);

	let r_packed_distancesBuf = this.#_getUint8Array(135, 130);
	this.#r_packed_distancesVal = new Analogpackeddistances(r_packed_distancesBuf);

	for(let i = 0; i < 16; i++) {
		let buf = this.#_getUint8Array(265+(12*i), 12);
		this.#l_angle_mapsVal.push(new Anglemap(buf));
	}

	for(let i = 0; i < 16; i++) {
		let buf = this.#_getUint8Array(457+(12*i), 12);
		this.#r_angle_mapsVal.push(new Anglemap(buf));
	}


  }

  	/** @type {Uint8} */
	get analog_config_version() {
		return this.#_getUint8(0);
	}

	/** @type {Uint16} */
	get lx_invert() {
		return this.#_getBitfield(1, 2, 1, 0);
	}

	/** @type {Uint16} */
	get lx_center() {
		return this.#_getBitfield(1, 2, 15, 1);
	}

	/** @type {Uint16} */
	get ly_invert() {
		return this.#_getBitfield(2, 2, 1, 0);
	}

	/** @type {Uint16} */
	get ly_center() {
		return this.#_getBitfield(2, 2, 15, 1);
	}

	/** @type {Uint16} */
	get rx_invert() {
		return this.#_getBitfield(3, 2, 1, 0);
	}

	/** @type {Uint16} */
	get rx_center() {
		return this.#_getBitfield(3, 2, 15, 1);
	}

	/** @type {Uint16} */
	get ry_invert() {
		return this.#_getBitfield(4, 2, 1, 0);
	}

	/** @type {Uint16} */
	get ry_center() {
		return this.#_getBitfield(4, 2, 15, 1);
	}

	/** @type {Analogpackeddistances} */
	get l_packed_distances() {
		return this.#l_packed_distancesVal;
	}

	/** @type {Analogpackeddistances} */
	get r_packed_distances() {
		return this.#r_packed_distancesVal;
	}

	/** @type {Anglemap[]} */
	get l_angle_maps() {
		return this.#l_angle_mapsVal;
	}

	/** @type {Anglemap[]} */
	get r_angle_maps() {
		return this.#r_angle_mapsVal;
	}

	/** @type {Uint8} */
	get l_scaler_type() {
		return this.#_getUint8(649);
	}

	/** @type {Uint8} */
	get r_scaler_type() {
		return this.#_getUint8(650);
	}

	/** @type {Uint8Array} */
	get reserved() {
		return this.#_getUint8Array(651, 369);
	}



  	/** @param {Uint8} value */
	set analog_config_version(value) {
		this.#_setUint8(0, value);
	}

	/** @param {Uint16} value */
	set lx_invert(value) {
		this.#_setBitfield(1, 2, 1, 0, value);
	}

	/** @param {Uint16} value */
	set lx_center(value) {
		this.#_setBitfield(1, 2, 15, 1, value);
	}

	/** @param {Uint16} value */
	set ly_invert(value) {
		this.#_setBitfield(2, 2, 1, 0, value);
	}

	/** @param {Uint16} value */
	set ly_center(value) {
		this.#_setBitfield(2, 2, 15, 1, value);
	}

	/** @param {Uint16} value */
	set rx_invert(value) {
		this.#_setBitfield(3, 2, 1, 0, value);
	}

	/** @param {Uint16} value */
	set rx_center(value) {
		this.#_setBitfield(3, 2, 15, 1, value);
	}

	/** @param {Uint16} value */
	set ry_invert(value) {
		this.#_setBitfield(4, 2, 1, 0, value);
	}

	/** @param {Uint16} value */
	set ry_center(value) {
		this.#_setBitfield(4, 2, 15, 1, value);
	}

	/** @param {Uint8} value */
	set l_scaler_type(value) {
		this.#_setUint8(649, value);
	}

	/** @param {Uint8} value */
	set r_scaler_type(value) {
		this.#_setUint8(650, value);
	}

	/** @param {Uint8Array} value */
	set reserved(value) {
		this.#_setUint8Array(651, 369, value);
	}



  updateBuffer(buffer) {
    	this.#l_angle_mapsVal.length = 0;
	this.#r_angle_mapsVal.length = 0;
 

    this.buffer = buffer;

    	let l_packed_distancesBuf = this.#_getUint8Array(5, 130);
	this.#l_packed_distancesVal = new Analogpackeddistances(l_packed_distancesBuf);

	let r_packed_distancesBuf = this.#_getUint8Array(135, 130);
	this.#r_packed_distancesVal = new Analogpackeddistances(r_packed_distancesBuf);

	for(let i = 0; i < 16; i++) {
		let buf = this.#_getUint8Array(265+(12*i), 12);
		this.#l_angle_mapsVal.push(new Anglemap(buf));
	}

	for(let i = 0; i < 16; i++) {
		let buf = this.#_getUint8Array(457+(12*i), 12);
		this.#r_angle_mapsVal.push(new Anglemap(buf));
	}


  }

  // Helper to get a value from a bitfield (given an offset and bitfield size)
  // Helper to get a value from a bitfield (given an offset, bitfield size, and byte size)
  #_getBitfield(byteOffset, byteSize, bitfieldSize, bitOffset) {
    if (byteSize <= 0 || bitfieldSize <= 0) {
      throw new Error('Invalid byteSize or bitfieldSize. Both must be greater than zero.');
    }

    // Validate bounds
    const byteEndOffset = byteOffset + byteSize;
    if (byteEndOffset > this.buffer.length) {
      throw new Error('Byte range exceeds buffer size.');
    }

    // Read bytes within the specified range, ensuring little-endian encoding
    let value = 0;
    for (let i = 0; i < byteSize; i++) {
      value |= this.buffer[byteOffset + i] << (8 * i);
    }

    // Mask and shift to extract the bitfield
    const mask = (1 << bitfieldSize) - 1; // Create a mask for the bitfield size
    return (value >> bitOffset) & mask;
  }

  // Helper to set a value into a bitfield with byte size and endianess support
  #_setBitfield(byteOffset, byteSize, bitfieldSize, bitOffset, bitfieldValue) {
    if (byteSize <= 0 || bitfieldSize <= 0) {
      throw new Error('Invalid byteSize or bitfieldSize. Both must be greater than zero.');
    }

    // Validate bounds
    const byteEndOffset = byteOffset + byteSize;
    if (byteEndOffset > this.buffer.length) {
      throw new Error('Byte range exceeds buffer size.');
    }

    // Validate bitfieldValue
    const maxBitfieldValue = (1 << bitfieldSize) - 1;
    if (bitfieldValue < 0 || bitfieldValue > maxBitfieldValue) {
      throw new Error('Bitfield value is out of range.');
    }

    // Read bytes within the specified range, ensuring little-endian encoding
    let value = 0;
    for (let i = 0; i < byteSize; i++) {
      value |= this.buffer[byteOffset + i] << (8 * i);
    }

    // Mask and shift to update the bitfield
    const mask = ((1 << bitfieldSize) - 1) << bitOffset; // Create a mask for the bitfield size
    value = (value & ~mask) | ((bitfieldValue << bitOffset) & mask);

    // Write the updated value back to the buffer in little-endian order
    for (let i = 0; i < byteSize; i++) {
      this.buffer[byteOffset + i] = (value >> (8 * i)) & 0xFF;
    }
  }

  // Uint8 functions
  #_getUint8(offset) {
    if (offset < 0 || offset >= this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    return this.buffer[offset];
  }

  #_setUint8(offset, value) {
    if (offset < 0 || offset >= this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    this.buffer[offset] = value;
  }

  #_getUint8Array(offset, size) {
    if (offset < 0 || offset + size > this.buffer.length) {
      throw new Error("Offset and size exceed the bounds of the Uint8Array.");
    }

    const uint8Array = new Uint8Array(size);

    for (let i = 0; i < size; i++) {
      // Directly copy each byte from the buffer to the Uint8Array
      uint8Array[i] = this.buffer[offset + i];
    }

    return uint8Array;
  }

  #_setUint8Array(offset, uint8Array) {
    if (offset < 0 || offset + uint8Array.length > this.buffer.length) {
      throw new Error("Offset and array length exceed the bounds of the Uint8Array.");
    }

    for (let i = 0; i < uint8Array.length; i++) {
      this.buffer[offset + i] = uint8Array[i];
    }
  }
  // ------
  // ------

  // Int8 functions
  #_getInt8(offset) {
    if (offset < 0 || offset >= this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    return this.buffer[offset];
  }

  #_setInt8(offset, value) {
    if (offset < 0 || offset >= this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    this.buffer[offset] = value;
  }

  #_getInt8Array(offset, size) {
    if (offset < 0 || offset + size > this.buffer.length) {
      throw new Error("Offset and size exceed the bounds of the Uint8Array.");
    }

    const int8Array = new Int8Array(size);

    for (let i = 0; i < size; i++) {
      // Directly copy each byte from the buffer to the Uint8Array
      int8Array[i] = this.buffer[offset + i];
    }

    return int8Array;
  }

  #_setInt8Array(offset, int8Array) {
    if (offset < 0 || offset + int8Array.length > this.buffer.length) {
      throw new Error("Offset and array length exceed the bounds of the int8Array.");
    }

    for (let i = 0; i < int8Array.length; i++) {
      this.buffer[offset + i] = int8Array[i];
    }
  }
  // ------
  // ------

  // Uint16 functions
  // OK
  #_getUint16(offset) {
    if (offset < 0 || offset + 2 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    // Combine bytes in little-endian order
    return (this.buffer[offset + 1] << 8) | this.buffer[offset];
  }


  // OK
  #_setUint16(offset, value) {
    if (offset < 0 || offset + 2 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    // Ensure the value fits into a uint16_t (0 to 65535)
    value &= 0xFFFF;  // Mask to ensure it's within the 16-bit range

    // Set the two bytes for the 16-bit value (little-endian)
    this.buffer[offset] = value & 0xFF;            // Least significant byte
    this.buffer[offset + 1] = (value >> 8) & 0xFF;  // Most significant byte
  }

  // OK
  #_getUint16Array(offset, size) {
    if (offset < 0 || offset + size * 2 > this.buffer.length) {
      throw new Error("Offset and size exceed the bounds of the Uint8Array.");
    }

    const uint16Array = new Uint16Array(size);

    for (let i = 0; i < size; i++) {
      // Read two consecutive bytes from the Uint8Array and combine them into a Uint16 value (little-endian)
      uint16Array[i] = this.buffer[offset + i * 2] | (this.buffer[offset + i * 2 + 1] << 8);
    }

    return uint16Array;
  }

  // OK
  #_setUint16Array(offset, uint16Array) {
    if (offset < 0 || offset + uint16Array.length * 2 > this.buffer.length) {
      throw new Error("Offset and array length exceed the bounds of the Uint8Array.");
    }

    for (let i = 0; i < uint16Array.length; i++) {
      const value = uint16Array[i];

      // Split the Uint16 value into two bytes (little-endian)
      this.buffer[offset + i * 2] = value & 0xFF;           // Low byte
      this.buffer[offset + i * 2 + 1] = value >> 8;         // High byte
    }
  }
  // ------
  // ------

  // Uint32 functions
  // OK
  #_getUint32(offset) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    return this.buffer[offset] |
      (this.buffer[offset + 1] << 8) |
      (this.buffer[offset + 2] << 16) |
      (this.buffer[offset + 3] << 24);
  }

  // OK
  #_setUint32(offset, value) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    // Ensure the value fits into a uint32_t (0 to 4294967295)
    value >>>= 0;  // Unsigned 32-bit value (ensures no negative numbers)

    // Set the four bytes for the 32-bit value
    this.buffer[offset] = (value >> 24) & 0xFF;       // Most significant byte (MSB)
    this.buffer[offset + 1] = (value >> 16) & 0xFF;    // 2nd byte
    this.buffer[offset + 2] = (value >> 8) & 0xFF;     // 3rd byte
    this.buffer[offset + 3] = value & 0xFF;            // Least significant byte (LSB)
  }

  // OK
  #_getUint32Array(offset, size) {
    if (offset < 0 || offset + size * 4 > this.buffer.length) {
      throw new Error("Offset and size exceed the bounds of the Uint8Array.");
    }

    const uint32Array = new Uint32Array(size);

    for (let i = 0; i < size; i++) {
      // Little-endian conversion (least significant byte first)
      uint32Array[i] =
        (this.buffer[offset + i * 4]) |
        (this.buffer[offset + i * 4 + 1] << 8) |
        (this.buffer[offset + i * 4 + 2] << 16) |
        (this.buffer[offset + i * 4 + 3] << 24);
    }

    return uint32Array;
  }

  #_setUint32Array(offset, uint32Array) {
    if (offset < 0 || offset + uint32Array.length * 4 > this.buffer.length) {
      throw new Error("Offset and array length exceed the bounds of the Uint8Array.");
    }

    for (let i = 0; i < uint32Array.length; i++) {
      const value = uint32Array[i];

      // Little-endian: least significant byte first
      this.buffer[offset + i * 4] = value & 0xFF;                 // Least significant byte
      this.buffer[offset + i * 4 + 1] = (value >>> 8) & 0xFF;     // Second byte
      this.buffer[offset + i * 4 + 2] = (value >>> 16) & 0xFF;    // Third byte
      this.buffer[offset + i * 4 + 3] = (value >>> 24) & 0xFF;    // Most significant byte
    }
  }
  // ------
  // ------

  // Float32 functions
  // OK
  #_getFloat32(offset) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    const dataView = new DataView(this.buffer.buffer, this.buffer.byteOffset);
    return dataView.getFloat32(offset, true);  // true for little-endian
  }

  // OK
  #_setFloat32(offset, value) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    // Create a DataView to access and set the float32 value
    const dataView = new DataView(this.buffer.buffer, this.buffer.byteOffset);

    // Set the float32 value at the given offset, using little-endian byte order
    dataView.setFloat32(offset, value, true);  // true for little-endian
  }

  // OK
  #_getFloat32Array(offset, size) {
    if (offset < 0 || offset + size * 4 > this.buffer.length) {
      throw new Error("Offset and size exceed the bounds of the Uint8Array.");
    }

    const float32Array = new Float32Array(size);
    const dataView = new DataView(this.buffer.buffer, this.buffer.byteOffset);

    for (let i = 0; i < size; i++) {
      // Read 4 bytes starting from the offset and convert them to a Float32
      float32Array[i] = dataView.getFloat32(offset + i * 4, true); // true for little-endian
    }

    return float32Array;
  }

  // OK
  #_setFloat32Array(offset, float32Array) {
    if (offset < 0 || offset + float32Array.length * 4 > this.buffer.length) {
      throw new Error("Offset and array length exceed the bounds of the Uint8Array.");
    }

    const dataView = new DataView(this.buffer.buffer, this.buffer.byteOffset);

    for (let i = 0; i < float32Array.length; i++) {
      // Convert each Float32 value to 4 bytes and write to the buffer
      dataView.setFloat32(offset + i * 4, float32Array[i], true); // true for little-endian
    }
  }
  // ------
  // ------

  // Int16 functions
  // OK
  #_getInt16(offset) {
    if (offset < 0 || offset + 2 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    // Combine two bytes in little-endian order into a signed 16-bit value
    const value = this.buffer[offset] | (this.buffer[offset + 1] << 8);
    // Convert to signed 16-bit if necessary
    return value > 0x7FFF ? value - 0x10000 : value;
  }

  // OK
  #_setInt16(offset, value) {
    if (offset < 0 || offset + 2 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    // Ensure the value fits into a signed 16-bit range (-32768 to 32767)
    value = Math.max(Math.min(value, 0x7FFF), -0x8000); // Clamp to signed 16-bit range

    // If the value is negative, convert to 2's complement
    if (value < 0) {
      value += 0x10000;
    }

    // Split the signed 16-bit value into two bytes (little-endian)
    this.buffer[offset] = value & 0xFF;            // Least significant byte
    this.buffer[offset + 1] = (value >> 8) & 0xFF; // Most significant byte
  }

  // OK
  #_getInt16Array(offset, size) {
    if (offset < 0 || offset + size * 2 > this.buffer.length) {
      throw new Error("Offset and size exceed the bounds of the Uint8Array.");
    }

    const int16Array = new Int16Array(size);

    for (let i = 0; i < size; i++) {
      // Read two consecutive bytes in little-endian order and combine them into an Int16 value
      const value = this.buffer[offset + i * 2] | (this.buffer[offset + i * 2 + 1] << 8);
      // Convert to signed 16-bit if necessary
      int16Array[i] = value > 0x7FFF ? value - 0x10000 : value;
    }

    return int16Array;
  }

  // OK
  #_setInt16Array(offset, int16Array) {
    if (offset < 0 || offset + int16Array.length * 2 > this.buffer.length) {
      throw new Error("Offset and array length exceed the bounds of the Uint8Array.");
    }

    for (let i = 0; i < int16Array.length; i++) {
      let value = int16Array[i];

      // Convert negative values to 2's complement if necessary
      if (value < 0) {
        value += 0x10000;
      }

      // Split the signed 16-bit value into two bytes (little-endian)
      this.buffer[offset + i * 2] = value & 0xFF;         // Low byte (least significant)
      this.buffer[offset + i * 2 + 1] = (value >> 8) & 0xFF; // High byte (most significant)
    }
  }

  // Int32 functions
  // Tested OK
  #_getInt32(offset) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    return (this.buffer[offset] |
      (this.buffer[offset + 1] << 8) |
      (this.buffer[offset + 2] << 16) |
      this.buffer[offset + 3] << 24);
  }

  // Tested OK
  #_setInt32(offset, value) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    // Ensure the value fits within a 32-bit signed integer (clamp if necessary)
    value = Math.max(Math.min(value, 0x7FFFFFFF), -0x80000000);  // Clamp between INT32_MIN and INT32_MAX

    // Split the 32-bit integer into 4 bytes
    this.buffer[offset] = value & 0xFF;
    this.buffer[offset + 1] = (value >> 8) & 0xFF;
    this.buffer[offset + 2] = (value >> 16) & 0xFF;
    this.buffer[offset + 3] = (value >> 24) & 0xFF;
  }

  // OK
  #_getInt32Array(offset, size) {
    if (offset < 0 || offset + size * 4 > this.buffer.length) {
      throw new Error("Offset and size exceed the bounds of the Uint8Array.");
    }

    const int32Array = new Int32Array(size);

    for (let i = 0; i < size; i++) {
      // Read four consecutive bytes from the Uint8Array and combine them into a 32-bit signed integer
      int32Array[i] = this.buffer[offset + i * 4] |
        (this.buffer[offset + i * 4 + 1] << 8) |
        (this.buffer[offset + i * 4 + 2] << 16) |
        (this.buffer[offset + i * 4 + 3] << 24);
    }

    return int32Array;
  }

  // OK
  #_setInt32Array(offset, int32Array) {
    if (offset < 0 || offset + int32Array.length * 4 > this.buffer.length) {
      throw new Error("Offset and array length exceed the bounds of the Uint8Array.");
    }

    for (let i = 0; i < int32Array.length; i++) {
      const value = int32Array[i];

      // Split the Int32 value into four bytes (little-endian)
      this.buffer[offset + i * 4] = value & 0xFF;             // First byte (least significant)
      this.buffer[offset + i * 4 + 1] = (value >> 8) & 0xFF;  // Second byte
      this.buffer[offset + i * 4 + 2] = (value >> 16) & 0xFF; // Third byte
      this.buffer[offset + i * 4 + 3] = (value >> 24) & 0xFF; // Fourth byte (most significant)
    }
  }
  // ------
  // ------

}