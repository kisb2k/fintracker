require('@testing-library/jest-dom');

// Mock the DuckDB database
jest.mock('duckdb', () => {
  return {
    Database: jest.fn().mockImplementation(() => ({
      run: jest.fn().mockResolvedValue(undefined),
      all: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

// Extend expect matchers
expect.extend({
  toBeInTheDocument(received) {
    const pass = received !== null;
    if (pass) {
      return {
        message: () => `expected ${received} not to be in the document`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be in the document`,
        pass: false,
      };
    }
  },
}); 