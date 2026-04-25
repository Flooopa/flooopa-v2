/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable if needed for streaming
    // serverComponentsExternalPackages: ['node-fetch'],
  },
  async rewrites() {
    return [
      // Optional: proxy AI gateway if running locally
      {
        source: '/api/ai-gateway/:path*',
        destination: `${process.env.AI_GATEWAY_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
