# SceneLens Test Suite

## Overview

This directory contains integration and unit tests for the SceneLens Android AI application.

## Test Structure

```
src/__tests__/
├── integration/
│   └── commute-scene.test.ts    # Week 1 E2E integration tests
└── README.md                     # This file
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- --testPathPattern=commute-scene
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests with Verbose Output
```bash
npm test -- --verbose
```

## Test Configuration

- **Framework**: Jest 29.x with ts-jest
- **Configuration**: `jest.config.js`
- **Setup**: `jest.setup.js`
- **Environment**: Node.js (for unit/integration tests)

## Current Test Coverage

### Integration Tests

#### Week 1: Commute Scene E2E (`commute-scene.test.ts`)
- ✅ Scene recognition test
- ✅ Rule matching and notification test
- ✅ Action execution test
- ✅ Complete E2E flow test
- ✅ Performance test: App launch
- ✅ Performance test: Scene inference

**Status**: 6/6 tests passing

## Writing New Tests

### Test File Naming Convention
- Integration tests: `*.test.ts` in `integration/` folder
- Unit tests: `*.test.ts` next to source files or in `__tests__/` folder

### Example Test Structure

```typescript
import { SilentContextEngine } from '../../sensors/SilentContextEngine';

describe('Feature Name', () => {
  let engine: SilentContextEngine;

  beforeEach(() => {
    engine = new SilentContextEngine();
  });

  test('should do something', async () => {
    // Arrange
    const input = { /* test data */ };

    // Act
    const result = await engine.someMethod(input);

    // Assert
    expect(result).toBeDefined();
    expect(result.value).toBe('expected');
  });
});
```

### Mocking Native Modules

```typescript
jest.mock('../../core/SceneBridge', () => ({
  __esModule: true,
  default: {
    getCurrentLocation: jest.fn(),
    getMotionState: jest.fn(),
    // ... other methods
  },
}));
```

## Test Reports

After running tests, detailed reports are available:
- `TASK_6_INTEGRATION_TEST_SUMMARY.md` - Task-specific summary
- `WEEK1_INTEGRATION_TEST_REPORT.md` - Comprehensive Week 1 report

## Troubleshooting

### Tests Not Running
1. Ensure dependencies are installed: `npm install`
2. Check Jest configuration in `jest.config.js`
3. Verify TypeScript compilation: `npx tsc --noEmit`

### Mock Issues
1. Clear Jest cache: `npx jest --clearCache`
2. Check mock paths match actual file structure
3. Ensure `__esModule: true` for ES module mocks

### Performance Issues
1. Run tests with `--maxWorkers=1` for sequential execution
2. Use `--testPathPattern` to run specific tests
3. Check for memory leaks in test setup/teardown

## Next Steps

### Week 2 Tests (Planned)
- User-triggered scene recognition tests
- Predictive trigger tests
- Model inference tests
- Data persistence tests

### Future Enhancements
- Add property-based tests
- Increase code coverage to > 80%
- Add E2E tests for all 6 scenes
- Add performance benchmarks

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [React Native Testing](https://reactnative.dev/docs/testing-overview)

---

**Last Updated**: December 8, 2024  
**Test Framework**: Jest 29.x + ts-jest  
**Current Coverage**: Week 1 Commute Scene (6/6 tests passing)
