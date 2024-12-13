$imports

export class $className {
  $classImportDeclares

  constructor(buffer) {
    this.buffer = buffer || new Uint8Array($bufferByteSize);
    $classImportSetup
  }

  $setFunctions

  $getFunctions

  $importsFunctions

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

    for(let i = 0; i < uint8Array.length; i++) {
      this.buffer[offset+i] = uint8Array[i];
    }
  }
  // ------
  // ------

  // Uint16 functions
  #_getUint16(offset) {
    if (offset < 0 || offset + 2 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    return (this.buffer[offset] << 8) | this.buffer[offset + 1];
  }

  #_setUint16(offset, value) {
    if (offset < 0 || offset + 2 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    // Ensure the value fits into a uint16_t (0 to 65535)
    value &= 0xFFFF;  // Mask to ensure it's within the 16-bit range

    // Set the two bytes for the 16-bit value
    this.buffer[offset] = (value >> 8) & 0xFF;     // Most significant byte
    this.buffer[offset + 1] = value & 0xFF;         // Least significant byte
  }

  #_getUint16Array(offset, size) {
    if (offset < 0 || offset + size * 2 > this.buffer.length) {
      throw new Error("Offset and size exceed the bounds of the Uint8Array.");
    }

    const uint16Array = new Uint16Array(size);

    for (let i = 0; i < size; i++) {
      // Read two consecutive bytes from the Uint8Array and combine them into a Uint16 value
      uint16Array[i] = (this.buffer[offset + i * 2] << 8) | this.buffer[offset + i * 2 + 1];
    }

    return uint16Array;
  }

  #_setUint16Array(offset, uint16Array) {
    if (offset < 0 || offset + uint16Array.length * 2 > this.buffer.length) {
      throw new Error("Offset and array length exceed the bounds of the Uint8Array.");
    }
  
    for (let i = 0; i < uint16Array.length; i++) {
      const value = uint16Array[i];
      
      // Split the Uint16 value into two bytes
      this.buffer[offset + i * 2] = value >> 8; // High byte
      this.buffer[offset + i * 2 + 1] = value & 0xFF; // Low byte
    }
  }
  // ------
  // ------

  // Uint32 functions
  #_getUint32(offset) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    return (this.buffer[offset] << 24) |
      (this.buffer[offset + 1] << 16) |
      (this.buffer[offset + 2] << 8) |
      this.buffer[offset + 3];
  }

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

  #_getUint32Array(offset, size) {
    if (offset < 0 || offset + size * 4 > this.buffer.length) {
      throw new Error("Offset and size exceed the bounds of the Uint8Array.");
    }

    const uint32Array = new Uint32Array(size);

    for (let i = 0; i < size; i++) {
      // Read four consecutive bytes from the Uint8Array and combine them into a Uint32 value
      uint32Array[i] = (this.buffer[offset + i * 4] << 24) |
        (this.buffer[offset + i * 4 + 1] << 16) |
        (this.buffer[offset + i * 4 + 2] << 8) |
        this.buffer[offset + i * 4 + 3];
    }

    return uint32Array;
  }

  #_setUint32Array(offset, uint32Array) {
    if (offset < 0 || offset + uint32Array.length * 4 > this.buffer.length) {
      throw new Error("Offset and array length exceed the bounds of the Uint8Array.");
    }
  
    for (let i = 0; i < uint32Array.length; i++) {
      const value = uint32Array[i];
  
      // Split the Uint32 value into four bytes
      this.buffer[offset + i * 4] = value >>> 24;         // First byte (most significant)
      this.buffer[offset + i * 4 + 1] = (value >>> 16) & 0xFF; // Second byte
      this.buffer[offset + i * 4 + 2] = (value >>> 8) & 0xFF;  // Third byte
      this.buffer[offset + i * 4 + 3] = value & 0xFF;         // Fourth byte (least significant)
    }
  }
  // ------
  // ------

  // Float32 functions
  #_getFloat32(offset) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    const dataView = new DataView(this.buffer.buffer, this.buffer.byteOffset);
    return dataView.getFloat32(offset, true);  // true for little-endian
  }

  #_setFloat32(offset, value) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    // Create a DataView to access and set the float32 value
    const dataView = new DataView(this.buffer.buffer, this.buffer.byteOffset);

    // Set the float32 value at the given offset, using little-endian byte order
    dataView.setFloat32(offset, value, true);  // true for little-endian
  }

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

  // Int32 functions
  #_getInt32(offset) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    return (this.buffer[offset] << 24) |
      (this.buffer[offset + 1] << 16) |
      (this.buffer[offset + 2] << 8) |
      this.buffer[offset + 3];
  }

  #_setInt32(offset, value) {
    if (offset < 0 || offset + 4 > this.buffer.length) {
      throw new Error("Offset exceeds the bounds of the Uint8Array.");
    }

    // Ensure the value fits within a 32-bit signed integer (clamp if necessary)
    value = Math.max(Math.min(value, 0x7FFFFFFF), -0x80000000);  // Clamp between INT32_MIN and INT32_MAX

    // Split the 32-bit integer into 4 bytes
    this.buffer[offset] = (value >> 24) & 0xFF;
    this.buffer[offset + 1] = (value >> 16) & 0xFF;
    this.buffer[offset + 2] = (value >> 8) & 0xFF;
    this.buffer[offset + 3] = value & 0xFF;
  }

  #_getInt32Array(offset, size) {
    if (offset < 0 || offset + size * 4 > this.buffer.length) {
      throw new Error("Offset and size exceed the bounds of the Uint8Array.");
    }

    const int32Array = new Int32Array(size);

    for (let i = 0; i < size; i++) {
      // Read four consecutive bytes from the Uint8Array and combine them into a 32-bit signed integer
      int32Array[i] = (this.buffer[offset + i * 4] << 24) |
        (this.buffer[offset + i * 4 + 1] << 16) |
        (this.buffer[offset + i * 4 + 2] << 8) |
        this.buffer[offset + i * 4 + 3];
    }

    return int32Array;
  }

  #_setInt32Array(offset, int32Array) {
    if (offset < 0 || offset + int32Array.length * 4 > this.buffer.length) {
      throw new Error("Offset and array length exceed the bounds of the Uint8Array.");
    }
  
    for (let i = 0; i < int32Array.length; i++) {
      const value = int32Array[i];
  
      // Split the Int32 value into four bytes
      this.buffer[offset + i * 4] = value >> 24;           // First byte (most significant)
      this.buffer[offset + i * 4 + 1] = (value >> 16) & 0xFF; // Second byte
      this.buffer[offset + i * 4 + 2] = (value >> 8) & 0xFF;  // Third byte
      this.buffer[offset + i * 4 + 3] = value & 0xFF;         // Fourth byte (least significant)
    }
  }
  // ------
  // ------
  
}