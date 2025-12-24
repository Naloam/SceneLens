import tensorflow as tf
import tensorflow_hub as hub
import numpy as np

def prepare_mobilenet_v3_small():
    print("Loading MobileNetV3-Small from TensorFlow Hub...")
    model_url = "https://tfhub.dev/google/imagenet/mobilenet_v3_small_100_224/classification/5"
    model = hub.load(model_url)

    concrete_func = model.signatures['serving_default']

    converter = tf.lite.TFLiteConverter.from_concrete_functions([concrete_func])
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.int8]

    def representative_dataset():
        for _ in range(100):
            data = np.random.random((1, 224, 224, 3)).astype(np.float32)
            yield [data]

    converter.representative_dataset = representative_dataset
    converter.inference_input_type = tf.uint8
    converter.inference_output_type = tf.uint8

    tflite_model = converter.convert()
    output_path = "mobilenet_v3_small_quant.tflite"
    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    print(f"Saved to {output_path}, size: {len(tflite_model)/1024/1024:.2f} MB")
    return output_path

if __name__ == "__main__":
    prepare_mobilenet_v3_small()
