import '@testing-library/jest-dom';

// Mock lucide-react for all tests
vi.mock('lucide-react', () => {
  return new Proxy({}, {
    get: () => () => null,
  });
}); 