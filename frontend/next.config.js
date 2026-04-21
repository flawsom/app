const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    'hiring-engine-dev.cluster-12.preview.emergentcf.cloud',
    'hiring-engine-dev.preview.emergentagent.com',
    'd05df258-794d-40a2-aa7d-572976d7c22f.preview.emergentagent.com',
    'd05df258-794d-40a2-aa7d-572976d7c22f.cluster-0.preview.emergentcf.cloud',
    'unify-complete.cluster-0.preview.emergentcf.cloud',
    '*.preview.emergentagent.com',
    '*.preview.emergentcf.cloud',
    '*.cluster-0.preview.emergentcf.cloud',
    'localhost:3000',
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
