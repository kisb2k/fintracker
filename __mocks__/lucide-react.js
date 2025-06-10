module.exports = new Proxy({}, {
  get: (target, prop) => {
    // Return a dummy React component for any icon
    return () => null;
  },
}); 