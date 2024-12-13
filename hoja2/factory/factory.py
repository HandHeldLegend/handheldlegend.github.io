import re
import os

from cfields import Field
from cjs import CJS

# OK
def extract_struct_contents(struct_definition):
    """
    Extracts the contents between the outer-most { } braces from a struct definition.
    
    :param struct_definition: The struct definition string.
    :return: The contents between the outer-most braces (str).
    """
    # Match the contents inside the outermost braces
    match = re.search(r'{(.*)}', struct_definition, re.DOTALL)

    if match:
        return match.group(1).strip()  # Return the content between braces, removing extra spaces
    else:
        raise ValueError("Invalid struct definition or no braces found.")

# OK
def read_file(file_path):
    """Open a text file and return its contents as a string."""
    try:
        with open(file_path, 'r') as file:
            return file.read()
    except FileNotFoundError:
        raise FileNotFoundError(f"File not found: {file_path}")
    except IOError as e:
        raise IOError(f"Error reading file: {e}")

# OK
def extract_struct_name(struct_definition):
    """Extract the struct name from a struct definition string."""
    match = re.search(r'\b(\w+_s);$', struct_definition.strip())
    if match:
        return match.group(1)
    else:
        raise ValueError("Struct name not found or invalid format.")

# OK
def get_data_type(line):
    """
    Extracts and returns the data type from a line of struct definition.
    Recognizes basic types and structs (types with '_s').

    :param line: A single line of struct field definition.
    :return: The data type as a string (e.g., 'uint8_t', 'struct', etc.).
    """
    # Strip extra spaces and match the type
    line = line.strip()

    # Check if the type contains '_s', indicating a struct type
    if '_s ' in line:
        return 'struct'

    # Define the recognized basic types
    basic_types = ['uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t', 'int', 'float']

    # Check if the line contains any of the basic types
    for basic_type in basic_types:
        if basic_type in line:
            return basic_type

    # If no recognized type is found, return None (or raise an exception if needed)
    return None

# OK
def extract_array_size(line):
    """
    Extracts the array size from a struct field definition. 
    If the field is not an array, it returns 1.

    :param line: A single line of struct field definition.
    :return: The array size (int), or 1 if the field is not an array.
    """
    # Look for array notation in the format [size]
    match = re.search(r'\[(\d+)\]', line)
    
    if match:
        # If an array is found, return the size (as integer)
        return int(match.group(1))
    
    # If no array, return 1
    return 1

# OK
def get_byte_size(data_type):
    """
    Returns the byte size for a given data type.
    
    :param data_type: The data type (str), e.g., 'uint8_t', 'int32_t', etc.
    :return: The byte size of the data type (int).
    """
    type_sizes = {
        'uint8_t': 1,
        'uint16_t': 2,
        'uint32_t': 4,
        'int8_t': 1,
        'int16_t': 2,
        'int32_t': 4,
        'int': 4,
        'float': 4
    }
    
    # Return the byte size from the dictionary, defaulting to None if not recognized
    return type_sizes.get(data_type, None)

# OK
def extract_struct_byte_size(line):
    """
    Extracts the struct byte size from a comment in the format // SIZE=24.
    
    :param line: A line containing the comment with the struct size.
    :return: The struct byte size (int), or None if no size comment is found.
    """
    # Look for a comment in the format // SIZE=24
    match = re.search(r'//\s*SIZE=(\d+)', line)
    
    if match:
        # Return the size as an integer
        return int(match.group(1))
    
    # If no SIZE comment is found, return None
    return None

# OK
def extract_sub_struct_name(struct_definition):
    """
    Extracts the struct name from a struct definition, removing the trailing '_s'.
    
    :param struct_definition: The struct definition string.
    :return: The struct name without the trailing '_s'.
    """
    # Match for struct name followed by '_s'
    match = re.search(r'\b(\w+)_s\b', struct_definition.strip())
    
    if match:
        # Return the struct name without the trailing '_s'
        return match.group(1)
    
    # If no struct name is found, raise an error
    raise ValueError("Sub-struct name not found or invalid format.")

# OK
def extract_bitfield_size(line):
    """
    Extracts the bitfield size from a field definition line (e.g., uint8_t remapConfigVersion : 4).
    If the field is not a bitfield, it returns None.

    :param line: The line containing the field definition.
    :return: The bitfield size (int), or None if there's no bitfield.
    """
    # Match for a bitfield (e.g., uint8_t remapConfigVersion : 4)
    match = re.match(r'\s*(\w+)\s+(\w+)\s*:\s*(\d+)\s*;', line)

    if match:
        # Extract the bitfield size (third group in the match)
        return int(match.group(3))
    
    # If no bitfield is found, return None
    return None

# OK
def extract_parameter_name(line):
    """
    Extracts the parameter name from a field definition line (e.g., uint8_t remapConfigVersion;)
    or from a bitfield (e.g., uint8_t remapConfigVersion : 4;).
    
    :param line: The line containing the field definition.
    :return: The parameter name (str), or None if no name is found.
    """
    # Match for both regular fields and bitfields
    match = re.match(r'\s*(\w+)\s+(\w+)\s*(?::\s*\d*)?\s*(\[\d*\])?\s*;', line)

    if match:
        # Return the parameter name (second group in the match)
        return match.group(2)
    
    # If no name is found, return None
    return None

# OK
def parse_struct_fields(struct_definition):
    fields = []
    lines = struct_definition.splitlines()

    byte_counter = 0
    bit_counter = 0
    referencingBitOffset = 0
    bitFieldProcessing = False

    for line in lines:
        fieldType = get_data_type(line)
        totalSize = 0
        fieldSize = 0
        structName = None
        bitfieldSize = None
        fieldName = None

        if(fieldType == 'struct'):
            structName = extract_sub_struct_name(line)
            fieldSize = extract_struct_byte_size(line)
            
        elif(fieldType != None):
            fieldSize = get_byte_size(fieldType)
            bitfieldSize = extract_bitfield_size(line)
        
        if(fieldType != None):
            fieldName = extract_parameter_name(line)
            array_size = extract_array_size(line)
            
            totalSize = fieldSize * array_size

            if bitFieldProcessing:
                outputCounter = referencingBitOffset
            else:
                outputCounter = byte_counter

            nField = Field(name=fieldName, data_type=fieldType, byte_size=fieldSize, byte_offset=outputCounter, array_size=array_size, bitfield_size=bitfieldSize, bitfield_offset=bit_counter, struct_name=structName)
            fields.append(nField)

            if bitfieldSize:
                if not bitFieldProcessing:
                    referencingBitOffset = byte_counter
                    bitFieldProcessing = True

                bit_counter += bitfieldSize

                if bit_counter >= 8:
                    byte_counter += 1

                if bit_counter >= (8*fieldSize):
                    bit_counter = 0
                    referencingBitOffset += 1
                    bitFieldProcessing = False
                    
            else:
                byte_counter += totalSize
    
    return fields

folder_path = "./structs"  # Replace with your folder path

for filename in os.listdir(folder_path):
        # Check if the file has a .sde (Struct def export) extension
        if filename.endswith(".sde"):
            # Construct the full path of the file
            file_path = os.path.join(folder_path, filename)

            definition = read_file(file_path)
            
            contents = extract_struct_contents(definition)
            struct_name = extract_struct_name(definition)

            fields = parse_struct_fields(contents)

            cjs = CJS(struct_name, fields)

            struct_clean_name = struct_name.replace("_s" , "")

            cjs.export_to_js("./"+struct_clean_name+".js")
