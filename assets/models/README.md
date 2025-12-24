# SceneLens ML Models

This directory contains the machine learning models used for on-device scene recognition.

## Model Files

### 1. MobileNetV3-Small (Image Classification)

- **File**: `mobilenet_v3_small_quant.tflite`
- **Purpose**: Visual scene classification from camera snapshots
- **Input**: 224x224 RGB images (uint8)
- **Output**: 10 scene class probabilities (uint8)
- **Size**: ~3MB (quantized)
- **Classes**: indoor_office, indoor_home, outdoor_street, outdoor_park, transport_subway, transport_bus, transport_car, restaurant, gym, library

### 2. YAMNet-Lite (Audio Classification)

- **File**: `yamnet_lite_quant.tflite`
- **Purpose**: Audio scene classification from microphone samples
- **Input**: 1-second audio waveform at 16kHz (float32)
- **Output**: 9 audio environment probabilities (float32)
- **Size**: ~2MB (quantized)
- **Classes**: silence, speech, music, traffic, nature, machinery, crowd, indoor_quiet, outdoor_busy

## How to Obtain Real Models

### MobileNetV3-Small
```python
import tensorflow as tf
import tensorflow_hub as hub

# Load pre-trained model
model_url = "https://tfhub.dev/google/imagenet/mobilenet_v3_small_100_224/classification/5"
model = hub.load(model_url)

# Convert to TFLite with quantization
converter = tf.lite.TFLiteConverter.from_saved_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.int8]
tflite_model = converter.convert()

# Save the model
with open('mobilenet_v3_small_quant.tflite', 'wb') as f:
    f.write(tflite_model)
```

### YAMNet-Lite
```python
import tensorflow as tf
import tensorflow_hub as hub

# Load YAMNet model
yamnet_model = hub.load('https://tfhub.dev/google/yamnet/1')

# Create a lite version (you may need to retrain or fine-tune)
# This is a simplified example - actual implementation may vary
converter = tf.lite.TFLiteConverter.from_concrete_functions([yamnet_model.signatures['serving_default']])
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.int8]
tflite_model = converter.convert()

# Save the model
with open('yamnet_lite_quant.tflite', 'wb') as f:
    f.write(tflite_model)
```

## Model Configuration

The `model_config.json` file contains metadata about each model including:
- Input/output shapes and types
- Preprocessing requirements
- Label mappings
- Model-specific parameters

## Integration

Models are loaded and used by the `ModelRunner` class in `src/ml/ModelRunner.ts`.

## Performance Considerations

- Models are quantized to int8 to reduce size and improve inference speed
- GPU acceleration is enabled when available
- Models are loaded lazily to reduce app startup time
- Inference results are cached to avoid redundant computations

## Privacy

- All model inference happens on-device
- No data is sent to external servers
- Audio and image data is processed locally and discarded after inference