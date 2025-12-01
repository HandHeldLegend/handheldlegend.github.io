import os
import json

# Configuration
ROOT_DIR = "../"  # Change this to your project root directory
OUTPUT_FILE = "folder_structure.js"

# Blacklist configuration
BLACKLISTED_FOLDERS = {
    'factory',
}

BLACKLISTED_FILES = {
    '.gitignore',
    'app_sw.js',  # Don't include the service worker file
    'folder_structure.js',  # Don't include the output file itself
    'asset_crawler.py',  # Don't include this script
    'asset_crawler.bat'  # Don't include the bat file
}

BLACKLISTED_EXTENSIONS = {
    '.pyc',
    '.pyo',
    '.pyd',
    '.so',
    '.dll'
}

def should_include_file(filename):
    """Check if a file should be included based on blacklist rules"""
    if filename in BLACKLISTED_FILES:
        return False
    
    _, ext = os.path.splitext(filename)
    if ext in BLACKLISTED_EXTENSIONS:
        return False
    
    return True

def should_include_folder(foldername):
    """Check if a folder should be included based on blacklist rules"""
    return foldername not in BLACKLISTED_FOLDERS

def generate_folder_structure(root_dir):
    """Generate a dictionary of folders and their files"""
    folder_structure = {}
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Filter out blacklisted directories
        dirnames[:] = [d for d in dirnames if should_include_folder(d)]
        
        # Calculate relative path
        rel_path = os.path.relpath(dirpath, root_dir)
        
        # Convert to forward slashes and format
        if rel_path == '.':
            folder_key = '/'
        else:
            folder_key = '/' + rel_path.replace('\\', '/') + '/'
        
        # Filter files based on blacklist
        included_files = [f for f in filenames if should_include_file(f)]
        
        # Only add folders that have files
        if included_files:
            folder_structure[folder_key] = sorted(included_files)
    
    return folder_structure

def format_as_javascript(folder_structure):
    """Format the folder structure as JavaScript object notation"""
    lines = ["folders: {"]
    
    items = list(folder_structure.items())
    for i, (folder, files) in enumerate(items):
        # Format the files array
        files_str = ", ".join(f"'{f}'" for f in files)
        
        # Add comma except for last item
        comma = "," if i < len(items) - 1 else ""
        
        lines.append(f"    '{folder}': [{files_str}]{comma}")
    
    lines.append("  }")
    
    return "\n".join(lines)

def main():
    print(f"Scanning directory: {os.path.abspath(ROOT_DIR)}")
    print(f"Blacklisted folders: {BLACKLISTED_FOLDERS}")
    print(f"Blacklisted files: {BLACKLISTED_FILES}")
    print(f"Blacklisted extensions: {BLACKLISTED_EXTENSIONS}")
    print()
    
    folder_structure = generate_folder_structure(ROOT_DIR)
    
    if not folder_structure:
        print("Warning: No files found to include!")
        return
    
    javascript_output = format_as_javascript(folder_structure)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(javascript_output)
    
    print(f"✓ Generated {OUTPUT_FILE}")
    print(f"  Found {len(folder_structure)} folders")
    print(f"  Total files: {sum(len(files) for files in folder_structure.values())}")
    print()
    print("Preview:")
    print(javascript_output[:500] + "..." if len(javascript_output) > 500 else javascript_output)

if __name__ == "__main__":
    main()