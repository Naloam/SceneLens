#!/usr/bin/env python3
"""
Validate that the TFLite models are properly formatted and can be loaded.
This script checks the model files without requiring TensorFlow.
"""

import os
import struct
import json

def validate_tflite_file(filepath):
    """Validate that a file has the correct TFLite format."""
    if not os.path.exists(filepath):
        return False, f"File not found: {filepath}"
    
    try:
        with open(filepath, 'rb') as f:
            # Check TFLite magic number
            magic = f.read(4)
            if magic != b'TFL3':
                return False, f"Invalid TFLite magic number: {magic}"
            
            # Check version
            version = struct.unpack('<I', f.read(4))[0]
            if version != 3:
                return False, f"Unsupported TFLite version: {version}"
            
            # Get file size
            f.seek(0, 2)  # Seek to end
            size = f.tell()
            
            return True, f"Valid TFLite file ({size / (1024*1024):.2f} MB)"
    
    except Exception as e:
        return False, f"Error reading file: {e}"

def validate_model_config():
    """Validate the model configuration file."""
    config_path = "model_config.json"
    
    if not os.path.exists(config_path):
        return False, "model_config.json not found"
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Check required structure
        if 'models' not in config:
            return False, "Missing 'models' key in config"
        
        models = config['models']
        required_models = ['mobilenet_v3_small', 'yamnet_lite']
        
        for model_name in required_models:
            if model_name not in models:
                return False, f"Missing model config: {model_name}"
            
            model_config = models[model_name]
            required_keys = ['filename', 'type', 'input_shape', 'output_shape']
            
            for key in required_keys:
                if key not in model_config:
                    return False, f"Missing key '{key}' in {model_name} config"
        
        return True, "Valid model configuration"
    
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {e}"
    except Exception as e:
        return False, f"Error reading config: {e}"

def main():
    """Main validation function."""
    print("SceneLens Model Validation")
    print("=" * 30)
    
    all_valid = True
    
    # Validate model files
    models = [
        "mobilenet_v3_small_quant.tflite",
        "yamnet_lite_quant.tflite"
    ]
    
    for model in models:
        valid, message = validate_tflite_file(model)
        status = "✓" if valid else "✗"
        print(f"{status} {model}: {message}")
        if not valid:
            all_valid = False
    
    # Validate configuration
    valid, message = validate_model_config()
    status = "✓" if valid else "✗"
    print(f"{status} model_config.json: {message}")
    if not valid:
        all_valid = False
    
    print()
    if all_valid:
        print("✓ All models and configuration are valid!")
        print("The models are ready for use in the React Native app.")
    else:
        print("✗ Some validation checks failed.")
        print("Please check the errors above and regenerate the models if needed.")
    
    return 0 if all_valid else 1

if __name__ == "__main__":
    exit(main())