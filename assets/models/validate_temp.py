import tensorflow as tf
import numpy as np


def validate(model_path, shape):
    interp = tf.lite.Interpreter(model_path=model_path, experimental_delegates=[])
    interp.allocate_tensors()
    inp = interp.get_input_details()[0]
    out = interp.get_output_details()[0]
    data = np.random.random(shape).astype(np.float32)
    interp.set_tensor(inp['index'], data)
    interp.invoke()
    out_data = interp.get_tensor(out['index'])
    print(f"OK: {model_path}, input {inp['shape']}, output {out_data.shape}")


def main():
    validate('mobilenet_v3_small_quant.tflite', (1, 224, 224, 3))
    validate('yamnet_lite_quant.tflite', (1, 16000))


if __name__ == '__main__':
    main()
