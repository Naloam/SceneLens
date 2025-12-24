# 模型准备指南（中文）

以下步骤教你在指定磁盘用 uv 创建虚拟环境，并准备 MobileNetV3-Small 与 YAMNet-Lite 的量化 TFLite 模型。

## 0. 环境准备

- 操作系统：Windows（PowerShell）
- 需要 Git 与 Python（可由 uv 管理，无需系统全局装 TensorFlow）
- 网络可访问 TensorFlow Hub

### 使用 uv 创建隔离环境到自定义路径

1. 安装 uv（如已安装可跳过）：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"
   ```

2. 新建虚拟环境到你希望的磁盘，例如 D 盘：

   ```powershell
   uv venv D:\venvs\scenelens-ml
   ```

3. 激活环境：

   ```powershell
   D:\venvs\scenelens-ml\Scripts\Activate.ps1
   ```

4. 在项目根目录安装依赖（会安装到上述 venv，而非 C 盘全局）：

   ```powershell
   cd D:\myProjects\SceneLens\scenelens
   uv pip install tensorflow tensorflow-hub numpy
   ```

## 1. 准备 MobileNetV3-Small（图像分类）

在 assets/models 目录创建 prepare_mobilenet.py：

```python
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
```

运行：

```powershell
cd D:\myProjects\SceneLens\scenelens\assets\models
python prepare_mobilenet.py
```

## 2. 准备 YAMNet-Lite（音频分类）

在 assets/models 目录创建 prepare_yamnet.py：

```python
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
```

运行：

```powershell
cd D:\myProjects\SceneLens\scenelens\assets\models
python prepare_yamnet.py
```

## 3. 模型校验（务必执行）

在 assets/models 运行：

```python
import tensorflow as tf
import numpy as np

def validate_model(model_path, input_shape):
    interpreter = tf.lite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    if len(input_shape) == 4:
        test_input = np.random.random(input_shape).astype(np.float32)
    else:
        test_input = np.random.random(input_shape).astype(np.float32)

    interpreter.set_tensor(input_details[0]['index'], test_input)
    interpreter.invoke()
    output_data = interpreter.get_tensor(output_details[0]['index'])

    print(f"OK: {model_path}, input {input_details[0]['shape']}, output {output_data.shape}")

validate_model("mobilenet_v3_small_quant.tflite", (1, 224, 224, 3))
validate_model("yamnet_lite_quant.tflite", (1, 16000))
```

## 4. React Native 集成提示

- 确保模型位于 scenelens/assets/models，并保持 model_config.json 与输入输出规格一致。
- ModelRunner 已使用 react-native-fast-tflite 加载。更换成真模型后，务必在真机上重新验证加载与推理。

## 5. 常见问题

- 下载到哪里？依赖会安装到你用 uv 创建的虚拟环境目录（如 D:\venvs\scenelens-ml），不会装到 C 盘全局。
- 模型过大：确认已启用 int8 量化，或改用更小基模（如 MobileNetV3-Micro）。
- 转换失败：更新 TensorFlow/TF Hub，检查网络是否能访问 Hub。
- 推理失败：确保输入尺寸、数据类型与 model_config.json 匹配。
