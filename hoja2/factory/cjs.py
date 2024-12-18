from cfields import Field

class CJS:
    type_table = {
        "uint8_t"   : "Uint8",
        "int8_t"    : "Int8", 
        "int16_t"   : "Int16", 
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
                while total_bits >= (8*field.byte_size):
                    total_bytes += field.byte_size
                    total_bits = 0
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
                    # let tmpArr = [];
                    # for(int i = 0; i < arrayLen; i ++) {
                    #   const tmp = this.#_getUint8Array(offset+(size*i), size);
                    #   tmpArr.push(new Class(tmp));
                    # }
                    # return tmpArr;
                    fn += "\t\tlet tmpArr = [];\n"
                    fn += "\t\tfor(let i = 0; i < {}; i++) {{\n".format(field.array_size)
                    fn += "\t\t\tconst tmp = this.#_getUint8Array({}+({}*i), {});\n".format(field.byte_offset, field.byte_size, field.byte_size)
                    fn += "\t\t\ttmpArr.push(new {}(tmp));\n".format(field.struct_name.capitalize())
                    fn += "\t\t}\n"
                    fn += "\t\treturn tmpArr;\n"
                else:
                    # const tmp = this.#_getUint8Array(offset, size); 
                    # return new Class(tmp);
                    fn += "\t\tconst tmp = this.#_getUint8Array({}, {});\n".format(field.byte_offset, field.byte_size)
                    fn += "\t\treturn new {}(tmp);\n".format(field.struct_name.capitalize())
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

            array_present = ""
            get_type = ""

            if field.array_size > 1:
                if field.struct_name:
                    array_present = "[]"
                else :
                    array_present = "Array"

            # We DO generate set functions for structs
            if field.struct_name:
                
                get_type = field.struct_name.capitalize()
                fn += "\t/** @param {{{}}} value */\n".format(get_type+array_present)
                # Generate header
                fn += "\tset {}(value) {{\n".format(field.name)

                if field.array_size>1:
                    # We take the single value, verify its type, and put its buffer into the correct offset location
                    # for (const [index, obj] of value.entries()) {
                    #   this.#setUint8Array(offset+(size*index), obj.buffer); 
                    # }
                    fn += "\t\tfor (const [index, obj] of value.entries()) {\n"
                    fn += "\t\t\tthis.#_setUint8Array({}+({}*index), obj.buffer)\n".format(field.byte_offset, field.byte_size)
                    fn += "\t\t}\n"
                    fn += "\t}\n\n"

                else:
                    # We take the single value, verify its type, and put its buffer into the correct offset location
                    # if(value instanceof Type) {
                    #   this.#setUint8Array(offset, value.buffer);
                    # } 
                    # else { 
                    #   console.error("Must be type of Type");  
                    # }
                    fn += "\t\tif (value instanceof {}) {{\n".format(get_type)
                    fn += "\t\t\tthis.#_setUint8Array({}, value.buffer);\n".format(field.byte_offset)
                    fn += "\t\t}\n"
                    fn += "\t\telse {\n"
                    fn += "\t\t\tconsole.error('Must be type of {}');\n".format(get_type)
                    fn += "\t\t}\n"
                    fn += "\t}\n\n"

                continue 
            
            get_type = self.get_type_value(field.data_type)
            fn += "\t/** @param {{{}}} value */\n".format(get_type+array_present)
            # Generate header
            fn += "\tset {}(value) {{\n".format(field.name)

            if field.bitfield_size:
                fn += "\t\tthis.#_setBitfield({}, {}, {}, {}, value);\n".format(field.byte_offset, field.byte_size, field.bitfield_size, field.bitfield_offset)

                # Complete this function
                fn += "\t}\n\n"
                continue

            if field.array_size>1:
                fn += "\t\tthis.#_set{}Array({}, value);\n".format(get_type, field.byte_offset)

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
        classes_imported = []
        offset = 0

        for field in self.fields:
            if field.struct_name:
                if not field.struct_name in classes_imported:
                    # Set up class import (Only once for a class import)
                    imports += "import {} from './{}.js';\n".format(field.struct_name.capitalize(), field.struct_name)
                    classes_imported.append(field.struct_name)
                
                array = ""

        return imports

    def export_to_js(self, filename):
        """
        Generates the full JavaScript class and exports it to a file.

        :param filename: The filename to save the JavaScript class (str).
        """
        template_file = "./template.js"
        # Read the template file content
        try:
            with open(template_file, 'r') as template:
                js_body = template.read()
        except FileNotFoundError:
            print(f"Error: Template file '{template_file}' not found.")
            return

        imports = self.generate_class_header()
        get_fns = self.generate_get_functions()
        set_fns = self.generate_set_functions()

        js_body = js_body.replace("$imports",   imports)

        js_body = js_body.replace("$setFunctions",  get_fns)
        js_body = js_body.replace("$getFunctions",  set_fns)

        self.struct_name = self.struct_name.replace("_s", "").capitalize()
        js_body = js_body.replace("$className", self.struct_name)

        totalSize = self.calculate_total_size()
        js_body = js_body.replace("$bufferByteSize", str(totalSize))

        # Write the modified content to the output file
        with open("./parsers/"+filename, 'w') as file:
            file.write(js_body)

        print(f"JavaScript class exported to {filename}")
        pass