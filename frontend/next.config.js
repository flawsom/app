const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    'hiring-engine-dev.cluster-12.preview.emergentcf.cloud',
    'hiring-engine-dev.preview.emergentagent.com',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ensure API proxy works in dev
  async rewrites() {
    return process.env.NEXT_PUBLIC_API_URL ? [] : [
      { source: '/api/:path*', destination: 'http://localhost:8001/api/:path*' },
    ];
  },
}

module.exports = nextConfig
