#!/usr/bin/env python3
"""
Create placeholder TFLite models for SceneLens development.
These are properly sized binary files that can be used for testing.
"""

import os
import struct
import random

def create_tflite_header():
    """Create a minimal TFLite file header."""
    # TFLite magic number and version
    header = b'TFL3'  # TFLite magic
    header += struct.pack('<I', 3)  # Version
    return header

def create_mobilenet_placeholder():
    """Create a placeholder MobileNetV3-Small model (~3MB)."""
    print("Creating MobileNetV3-Small placeholder...")
    
    # Start with TFLite header
    data = create_tflite_header()
    
    # Add model metadata
    metadata = {
        'name': 'MobileNetV3-Small Quantized',
        'version': '1.0',
        'input_shape': [1, 224, 224, 3],
        'output_shape': [1, 10],
        'quantized': True
    }
    
    # Convert metadata to bytes
    metadata_bytes = str(metadata).encode('utf-8')
    data += struct.pack('<I', len(metadata_bytes))
    data += metadata_bytes
    
    # Add random model weights to reach ~3MB
    target_size = 3 * 1024 * 1024  # 3MB
    remaining_size = target_size - len(data)
    
    # Generate random weights (simulating quantized int8 weights)
    weights = bytes([random.randint(0, 255) for _ in range(remaining_size)])
    data += weights
    
    # Save the model
    with open('mobilenet_v3_small_quant.tflite', 'wb') as f:
        f.write(data)
    
    size_mb = len(data) / (1024 * 1024)
    print(f"✓ Created mobilenet_v3_small_quant.tflite ({size_mb:.2f} MB)")
    return True

def create_yamnet_placeholder():
    """Create a placeholder YAMNet-Lite model (~2MB)."""
    print("Creating YAMNet-Lite placeholder...")
    
    # Start with TFLite header
    data = create_tflite_header()
    
    # Add model metadata
    metadata = {
        'name': 'YAMNet-Lite Quantized',
        'version': '1.0',
        'input_shape': [1, 16000],
        'output_shape': [1, 9],
        'quantized': True
    }
    
    # Convert metadata to bytes
    metadata_bytes = str(metadata).encode('utf-8')
    data += struct.pack('<I', len(metadata_bytes))
    data += metadata_bytes
    
    # Add random model weights to reach ~2MB
    target_size = 2 * 1024 * 1024  # 2MB
    remaining_size = target_size - len(data)
    
    # Generate random weights (simulating quantized weights)
    weights = bytes([random.randint(0, 255) for _ in range(remaining_size)])
    data += weights
    
    # Save the model
    with open('yamnet_lite_quant.tflite', 'wb') as f:
        f.write(data)
    
    size_mb = len(data) / (1024 * 1024)
    print(f"✓ Created yamnet_lite_quant.tflite ({size_mb:.2f} MB)")
    return True

def update_model_config():
    """Update the model configuration with correct information."""
    print("Updating model configuration...")
    
    config = '''{
  "models": {
    "mobilenet_v3_small": {
      "filename": "mobilenet_v3_small_quant.tflite",
      "type": "image_classification",
      "input_shape": [1, 224, 224, 3],
      "input_type": "uint8",
      "output_shape": [1, 10],
      "output_type": "uint8",
      "preprocessing": {
        "resize": [224, 224],
        "normalize": {
          "mean": [127.5, 127.5, 127.5],
          "std": [127.5, 127.5, 127.5]
        }
      },
      "labels": [
        "indoor_office",
        "indoor_home",
        "outdoor_street",
        "outdoor_park",
        "transport_subway",
        "transport_bus",
        "transport_car",
        "restaurant",
        "gym",
        "library"
      ]
    },
    "yamnet_lite": {
      "filename": "yamnet_lite_quant.tflite",
      "type": "audio_classification",
      "input_shape": [1, 16000],
      "input_type": "float32",
      "output_shape": [1, 9],
      "output_type": "float32",
      "preprocessing": {
        "sample_rate": 16000,
        "duration": 1.0
      },
      "labels": [
        "silence",
        "speech",
        "music",
        "traffic",
        "nature",
        "machinery",
        "crowd",
        "indoor_quiet",
        "outdoor_busy"
      ]
    }
  }
}'''
    
    with open('model_config.json', 'w') as f:
        f.write(config)
    
    print("✓ Updated model_config.json")
    return True

def main():
    """Main function to create placeholder models."""
    print("SceneLens Placeholder Model Creator")
    print("=" * 40)
    print("Creating development models for testing...")
    print("Note: These are placeholder models for development.")
    print("For production, use the prepare_models.py script with TensorFlow.")
    print()
    
    success = True
    
    # Create MobileNetV3-Small placeholder
    if not create_mobilenet_placeholder():
        success = False
    
    # Create YAMNet-Lite placeholder
    if not create_yamnet_placeholder():
        success = False
    
    # Update model configuration
    if not update_model_config():
        success = False
    
    if success:
        print("\n✓ All placeholder models created successfully!")
        print("\nFiles created:")
        print("- mobilenet_v3_small_quant.tflite (~3MB)")
        print("- yamnet_lite_quant.tflite (~2MB)")
        print("- model_config.json (updated)")
        print("\nThese models can be used for development and testing.")
        print("The ModelRunner class will handle loading and inference.")
    else:
        print("\n✗ Failed to create some models")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())