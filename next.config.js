/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('duckdb');
    }
    return config;
  }
};

module.exports = nextConfig; 