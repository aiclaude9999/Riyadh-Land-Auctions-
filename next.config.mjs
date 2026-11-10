/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['playwright', 'bullmq', 'ioredis', 'pino', '@prisma/client'],
  images: { unoptimized: true },
};
export default nextConfig;
