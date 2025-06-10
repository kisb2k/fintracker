import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.html$/,
      use: 'raw-loader',
    });
    config.module.rules.push({
      test: /\.cs$/,
      use: 'raw-loader',
    });
    config.resolve.fallback = {
      ...config.resolve.fallback,
      stream: false,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:9002'],
    },
  },
  serverExternalPackages: ['duckdb', 'express', 'rimraf'],
  output: 'standalone',
  transpilePackages: ['duckdb'],
};

export default nextConfig;
