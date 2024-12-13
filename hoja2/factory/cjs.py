from cfields import Field

class CJS:

    type_table = {
        "uint8_t"   : "Uint8",
        "uint16_t"  : "Uint16",
        "uint32_t"  : "Uint32",
        "int"       : "Int32",
        "float"     : "Float32",
    }

    def __init__(self, struct_name, fields):
        """
        Initializes the CJS (C to JavaScript) class.

        :param struct_name: Name of the struct (str).
        :param fields: List of Field objects (list).
        """
        self.struct_name = struct_name
        self.fields = fields

    def get_type_value(self, value):
        return self.type_table.get(value, "Null")

    # OK
    def calculate_total_size(self):
        total_bits = 0
        total_bytes = 0
        current_bitfield = 0  # Tracks the bits in the current byte

        for field in self.fields:
            if field.bitfield_size:
                total_bits += field.bitfield_size
                while total_bits >= 8:
                    total_bytes += 1
                    total_bits -= 8
                continue

            if field.array_size:
                total_bytes += field.array_size * field.byte_size
                continue 
            
            if field.byte_size:
                total_bytes += field.byte_size
                continue 

        return total_bytes

    def generate_get_functions(self):
        fn = ""

        for field in self.fields:

            get_type = self.get_type_value(field.data_type)
            array_present = ""

            if field.array_size > 1:
                array_present = "Array"

            if field.struct_name:
                if field.array_size > 1:
                    array_present = "[]"
                fn += "\t/** @type {{{}}} */\n".format(field.struct_name.capitalize()+array_present)
            else:
                fn += "\t/** @type {{{}}} */\n".format(get_type+array_present)

            # Generate header
            fn += "\tget {}() {{\n".format(field.name)

            if field.bitfield_size:
                fn += "\t\treturn this.#_getBitfield({}, {}, {}, {});\n".format(field.byte_offset, field.byte_size, field.bitfield_size, field.bitfield_offset)

                # Complete this function
                fn += "\t}\n\n"
                continue

            # Check for custom struct, return the custom class item if so
            if field.struct_name:
                if field.array_size > 1:
                    fn += "\t\treturn this.#{};\n".format(field.name+"Val")
                else:
                    fn += "\t\treturn this.#{};\n".format(field.name+"Val")
                # Complete this function
                fn += "\t}\n\n"
                continue

            if field.array_size>1:
                fn += "\t\treturn this.#_get{}Array({}, {});\n".format(get_type, field.byte_offset, field.array_size)

                # Complete this function
                fn += "\t}\n\n"
                continue 
            
            if field.byte_size:
                fn += "\t\treturn this.#_get{}({});\n".format(get_type, field.byte_offset)

                # Complete this function
                fn += "\t}\n\n"
                continue 

        return fn

    def generate_set_functions(self):
        fn = ""

        for field in self.fields:

            # We do not create set functions for structs
            # They should have their members accessed direct
            if field.struct_name:
                continue 

            get_type = self.get_type_value(field.data_type)
            array_present = ""

            if field.array_size > 1:
                array_present = "Array"


            fn += "\t/** @param {{{}}} value */\n".format(get_type+array_present)

            # Generate header
            fn += "\tset {}(value) {{\n".format(field.name)

            if field.bitfield_size:
                fn += "\t\tthis.#_setBitfield({}, {}, {}, {}, value);\n".format(field.byte_offset, field.byte_size, field.bitfield_size, field.bitfield_offset)

                # Complete this function
                fn += "\t}\n\n"
                continue

            if field.array_size>1:
                fn += "\t\tthis.#_set{}Array({}, {}, value);\n".format(get_type, field.byte_offset, field.array_size)

                # Complete this function
                fn += "\t}\n\n"
                continue 

            if field.byte_size:
                fn += "\t\tthis.#_set{}({}, value);\n".format(get_type, field.byte_offset)

                # Complete this function
                fn += "\t}\n\n"
                continue 
        return fn

    def generate_class_header(self):
        """
        Generates the header of the JavaScript class, including imports and class name.
        """
        imports = ""
        setups = ""
        declares = ""
        classes_imported = []
        offset = 0

        for field in self.fields:
            if field.struct_name:
                if not field.struct_name in classes_imported:
                    # Set up class import (Only once for a class import)
                    imports += "import {} from './{}.js';\n".format(field.struct_name.capitalize(), field.struct_name.lower())
                    classes_imported.append(field.struct_name)
                
                array = ""

                if field.array_size>1:
                    array = "[]"
                    setups += "\tfor(let i = 0; i < {}; i++) {{\n".format(field.array_size)
                    setups += "\t\tlet buf = this.#_getUint8Array({}*i, {});\n".format(field.byte_offset, field.byte_size)
                    setups += "\t\tthis.#{}Val.push(new {}(buf));\n".format(field.name, field.struct_name.capitalize())
                    setups += "\t}\n\n"
                else:
                    setups += "\tlet {}Buf = this.#_getUint8Array({}*i, {});\n".format(field.name, field.byte_offset, field.byte_size)
                    setups += "\tthis.#{}Val = new {}({}Buf);\n\n".format(field.name, field.struct_name.capitalize(), field.name)

                # Set up our class with its appropriate buffer
                declares += "\t#{}Val{};\n".format(field.name, array)



        return setups

    def export_to_js(self, filename):
        """
        Generates the full JavaScript class and exports it to a file.

        :param filename: The filename to save the JavaScript class (str).
        """
        pass