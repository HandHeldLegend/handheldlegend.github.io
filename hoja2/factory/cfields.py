class Field:
    def __init__(self, name, data_type, byte_size, byte_offset, array_size=None, bitfield_size=None, bitfield_offset=None, struct_name=None):
        """
        Represents a field in a struct.

        :param name: Name of the field (str).
        :param data_type: Data type (str, e.g., uint8_t, int16_t).
        :param byte_size: Size of the field in bytes (int).
        :param array_size: Size of the array (if applicable).
        :param bitfield_size: If the field is a bitfield, specify bit length (int, optional).
        :param struct_name: If the field is a nested struct, specify the nested struct name (str, optional).
        """
        self.name = name
        self.data_type = data_type
        self.byte_size = byte_size
        self.byte_offset = byte_offset
        self.array_size = array_size
        self.bitfield_offset = bitfield_offset
        self.bitfield_size = bitfield_size
        self.struct_name = struct_name

    def __repr__(self):
        return (f"Field(name={self.name}, type={self.data_type}, size={self.byte_size}, offset={self.byte_offset} "
                f"array_size={self.array_size}, bitfield_size={self.bitfield_size}, bitfield_offset={self.bitfield_offset}, struct_name={self.struct_name})\n")