/** @type {import('next').NextConfig} */
const nextConfig = {
  // Netlify builds with its own Next.js adapter; Docker uses the standalone server.
  output: process.env.NETLIFY ? undefined : 'standalone',
  serverExternalPackages: ['playwright', 'bullmq', 'ioredis', 'pino', '@prisma/client'],
  images: { unoptimized: true },
};
export default nextConfig;
