import tensorflow as tf
import tensorflow_hub as hub
import numpy as np

def prepare_yamnet_lite():
    print("Loading YAMNet from TensorFlow Hub...")
    yamnet_model = hub.load('https://tfhub.dev/google/yamnet/1')

    class YAMNetWrapper(tf.Module):
        def __init__(self, yamnet_model):
            self.yamnet_model = yamnet_model

        @tf.function(input_signature=[tf.TensorSpec(shape=[None], dtype=tf.float32)])
        def __call__(self, waveform):
            scores, embeddings, spectrogram = self.yamnet_model(waveform)
            return scores

    wrapped_model = YAMNetWrapper(yamnet_model)

    converter = tf.lite.TFLiteConverter.from_concrete_functions([
        wrapped_model.__call__.get_concrete_function()
    ])
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.int8]

    def representative_dataset():
        for _ in range(100):
            data = np.random.random(16000).astype(np.float32)
            yield [data]

    converter.representative_dataset = representative_dataset
    converter.inference_input_type = tf.float32
    converter.inference_output_type = tf.float32

    tflite_model = converter.convert()
    output_path = "yamnet_lite_quant.tflite"
    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    print(f"Saved to {output_path}, size: {len(tflite_model)/1024/1024:.2f} MB")
    return output_path

if __name__ == "__main__":
    prepare_yamnet_lite()
