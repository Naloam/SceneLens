/**
 * Demo script to test SilentContextEngine
 * 
 * This demonstrates the basic functionality of the Silent Context Engine
 */

import { silentContextEngine } from './SilentContextEngine';

/**
 * Run a demo of the Silent Context Engine
 */
export async function runDemo() {
  console.log('=== SilentContextEngine Demo ===\n');

  // Test 1: Get time signal
  console.log('Test 1: Getting time signal...');
  const timeSignal = silentContextEngine.getTimeSignal();
  console.log('Time Signal:', {
    type: timeSignal.type,
    value: timeSignal.value,
    weight: timeSignal.weight,
    timestamp: new Date(timeSignal.timestamp).toISOString(),
  });
  console.log('');

  // Test 2: Get full context
  console.log('Test 2: Getting full context...');
  const startTime = Date.now();
  const context = await silentContextEngine.getContext();
  const duration = Date.now() - startTime;
  
  console.log('Context:', {
    scene: context.context,
    confidence: context.confidence.toFixed(2),
    signalCount: context.signals.length,
    inferenceTime: `${duration}ms`,
  });
  
  console.log('\nSignals collected:');
  context.signals.forEach((signal, index) => {
    console.log(`  ${index + 1}. ${signal.type}: ${signal.value} (weight: ${signal.weight})`);
  });
  console.log('');

  // Test 3: Performance check
  console.log('Test 3: Performance check (5 iterations)...');
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await silentContextEngine.getContext();
    times.push(Date.now() - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  
  console.log('Performance results:');
  console.log(`  Average: ${avgTime.toFixed(2)}ms`);
  console.log(`  Min: ${minTime}ms`);
  console.log(`  Max: ${maxTime}ms`);
  console.log(`  Target: <50ms (requirement)`);
  console.log(`  Status: ${maxTime < 50 ? '✓ PASS' : '✗ FAIL (but acceptable for initial implementation)'}`);
  console.log('');

  console.log('=== Demo Complete ===');
}

// Export for use in App.tsx or other components
export default runDemo;

