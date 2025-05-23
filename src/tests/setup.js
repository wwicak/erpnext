// Vitest Global Setup File (src/tests/setup.js)
import { vi } from 'vitest';

// Optional: Mock global browser features if not fully supported by happy-dom or for specific needs
// For example, localStorage or fetch, though happy-dom provides good coverage for these.

// Example: Mocking localStorage (if needed, though happy-dom usually handles it)
/*
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: function(key) {
      return store[key] || null;
    },
    setItem: function(key, value) {
      store[key] = value.toString();
    },
    removeItem: function(key) {
        delete store[key];
    },
    clear: function() {
      store = {};
    }
  };
})();
vi.stubGlobal('localStorage', localStorageMock);
*/

// Example: If you need to mock 'fetch' globally for some reason (though usually done per test/module)
/*
vi.mock('node-fetch', () => ({ // Or just 'fetch' if using a polyfill that Vitest picks up
  default: vi.fn(),
}));
*/

// If using Pinia, you might want to ensure a new Pinia instance is created for each test
// This is often handled by using `createPinia()` and `setActivePinia()` within test files
// or a test-specific setup utility, rather than globally here, to ensure test isolation.
// See Pinia testing documentation: https://pinia.vuejs.org/cookbook/testing.html

console.log('Vitest global setup file loaded.');

// You can also add global mocks for composables if that makes sense for your project
// vi.mock('../composables/myComposable', () => ({
//   useMyComposable: () => ({
//     // mock implementation
//   })
// }));

// Clean up mocks after each test if necessary (though Vitest often does this)
// afterEach(() => {
//   vi.clearAllMocks();
// });
