import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Component tests run under jsdom via the `// @vitest-environment jsdom` docblock.
// Cleanup is loaded lazily so node-env unit tests never import the DOM layer.
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});
