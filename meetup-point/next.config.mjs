/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // data/*.json(geojson) are read at run time; make sure hosting includes them
  outputFileTracingIncludes: { '/**': ['./data/**'] },
};
export default nextConfig;
