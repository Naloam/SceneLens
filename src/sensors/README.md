# Silent Context Engine

The Silent Context Engine is the core scene detection component of SceneLens. It continuously collects signals from various sensors and uses a weighted voting algorithm to infer the user's current scene.

## Architecture

### Signal Collection
The engine collects signals from multiple sources:
- **Time Signal**: Always available, identifies time periods (morning rush, evening, night, etc.)
- **Location Signal**: Uses GPS for coarse location (~100m accuracy)
- **Wi-Fi Signal**: Detects connected Wi-Fi network for home/office detection
- **Motion Signal**: Uses Activity Recognition API to detect STILL/WALKING/VEHICLE
- **Foreground App Signal**: Identifies currently active application

### Scene Inference
Uses a weighted voting algorithm:
1. Each signal contributes to multiple possible scenes with different weights
2. Scores are accumulated across all signals
3. The scene with the highest score is selected
4. Confidence is calculated as normalized score (0-1)

### Supported Scenes
- **COMMUTE** (通勤): Morning/evening rush + walking/vehicle motion
- **OFFICE** (办公): Work hours + office location/Wi-Fi + still motion
- **HOME** (在家): Evening/night + home Wi-Fi + still motion
- **STUDY** (学习): Evening + study apps + still motion
- **SLEEP** (睡前): Night time + home + charging
- **TRAVEL** (出行): Airport/train station location
- **UNKNOWN** (未知): Low confidence or no clear scene

## Usage

### Basic Usage

```typescript
import { silentContextEngine } from './src/sensors';

// Get current scene context
const context = await silentContextEngine.getContext();

console.log('Current scene:', context.context);
console.log('Confidence:', context.confidence);
console.log('Signals:', context.signals);
```

### Get Time Signal Only

```typescript
import { silentContextEngine } from './src/sensors';

// Get just the time signal (no async needed)
const timeSignal = silentContextEngine.getTimeSignal();

console.log('Time period:', timeSignal.value);
console.log('Weight:', timeSignal.weight);
```

### Clear Cache

```typescript
import { silentContextEngine } from './src/sensors';

// Clear cached signals (useful for testing)
silentContextEngine.clearCache();
```

## Configuration

### Sampling Intervals
Configured in `SilentContextEngine` class:

```typescript
private samplingIntervals = {
  location: 5 * 60 * 1000,      // 5 minutes
  motion: 30 * 1000,            // 30 seconds
  wifi: 2 * 60 * 1000,          // 2 minutes
  foregroundApp: 10 * 1000,     // 10 seconds
};
```

These intervals control how often the engine accesses each sensor to save battery.

## Permissions Required

### Android Permissions
The following permissions must be granted for full functionality:

- `ACCESS_COARSE_LOCATION`: For location-based scene detection
- `ACCESS_FINE_LOCATION`: For more accurate location (optional)
- `ACCESS_WIFI_STATE`: For Wi-Fi network detection
- `ACCESS_NETWORK_STATE`: For network connectivity
- `ACTIVITY_RECOGNITION`: For motion state detection (Android 10+)

### Permission Handling
The engine gracefully degrades when permissions are not granted:
- Missing location permission: Uses time + Wi-Fi + motion only
- Missing Wi-Fi permission: Uses time + location + motion only
- Missing motion permission: Uses time + location + Wi-Fi only

## Performance

### Target Performance
- Scene inference: <50ms (requirement from 需求 1.2)
- Battery impact: <3% over 24 hours (requirement from 需求 1.6)

### Optimization Strategies
1. **Signal Caching**: Reuses recent signals within sampling interval
2. **Coarse Location**: Uses ~100m accuracy instead of fine GPS
3. **Configurable Intervals**: Reduces sensor access frequency
4. **Lazy Loading**: Only accesses sensors when needed

## Error Handling

The engine handles errors gracefully:
- Permission denied: Skips that signal, continues with others
- Sensor unavailable: Returns null for that signal
- API failure: Logs warning, uses cached data if available

## Testing

### Unit Tests
Located in `__tests__/SilentContextEngine.test.ts`

Run tests:
```bash
npm test -- SilentContextEngine.test.ts
```

### Demo Script
Located in `demo.ts`

```typescript
import { runDemo } from './src/sensors/demo';

// Run the demo
await runDemo();
```

### Manual Testing
Use the App.tsx integration:
1. Launch the app
2. Tap "Detect Current Scene"
3. View detected scene and signals

## Integration Example

```typescript
import { silentContextEngine } from './src/sensors';
import type { SilentContext, SceneType } from './src/types';

// Scene detection with error handling
async function detectCurrentScene(): Promise<SceneType> {
  try {
    const context = await silentContextEngine.getContext();
    
    if (context.confidence > 0.7) {
      console.log(`High confidence scene: ${context.context}`);
      return context.context;
    } else {
      console.log(`Low confidence (${context.confidence}), scene: ${context.context}`);
      return 'UNKNOWN';
    }
  } catch (error) {
    console.error('Scene detection failed:', error);
    return 'UNKNOWN';
  }
}

// Periodic scene detection
setInterval(async () => {
  const scene = await detectCurrentScene();
  // Update UI or trigger actions based on scene
}, 5 * 60 * 1000); // Every 5 minutes
```

## Future Enhancements

### Planned Features
1. **User Configuration**: Allow users to configure Wi-Fi and location mappings
2. **GeoFence Integration**: Match location against user-defined geofences
3. **Machine Learning**: Use ML model for improved scene inference
4. **Historical Patterns**: Learn from user behavior over time
5. **Battery Optimization**: Adjust sampling based on battery level

### Extensibility
To add a new signal type:

1. Add signal type to `SignalType` in `types/index.ts`
2. Create a new `get[SignalName]Signal()` method
3. Add signal collection in `getContext()`
4. Implement `map[SignalName]ToScenes()` mapping
5. Update `signalToScenes()` switch statement

## Troubleshooting

### Scene Detection Not Working
1. Check permissions are granted
2. Verify native module is connected
3. Check console for error messages
4. Clear cache and try again

### Low Confidence Scores
- Normal with limited signals
- Grant more permissions for better accuracy
- Configure Wi-Fi and location mappings
- Wait for more signals to be collected

### High Battery Usage
- Check sampling intervals are not too frequent
- Verify location is using coarse accuracy
- Ensure caching is working properly
- Monitor sensor access frequency

## API Reference

### SilentContextEngine

#### Methods

##### `getContext(): Promise<SilentContext>`
Gets the current scene context with all available signals.

**Returns:** Promise resolving to SilentContext object

**Example:**
```typescript
const context = await silentContextEngine.getContext();
```

##### `getTimeSignal(): ContextSignal`
Gets the current time signal (synchronous).

**Returns:** ContextSignal object with time period

**Example:**
```typescript
const timeSignal = silentContextEngine.getTimeSignal();
```

##### `clearCache(): void`
Clears all cached signals and sampling timestamps.

**Example:**
```typescript
silentContextEngine.clearCache();
```

### Types

#### SilentContext
```typescript
interface SilentContext {
  timestamp: number;        // When the context was generated
  context: SceneType;       // Detected scene
  confidence: number;       // Confidence score (0-1)
  signals: ContextSignal[]; // All collected signals
}
```

#### ContextSignal
```typescript
interface ContextSignal {
  type: SignalType;    // Signal type (TIME, LOCATION, etc.)
  value: string;       // Signal value
  weight: number;      // Signal weight (0-1)
  timestamp: number;   // When signal was collected
}
```

## Contributing

When modifying the Silent Context Engine:
1. Maintain backward compatibility
2. Add tests for new features
3. Update this README
4. Follow TypeScript best practices
5. Handle errors gracefully

## License

Part of SceneLens Android AI project.

