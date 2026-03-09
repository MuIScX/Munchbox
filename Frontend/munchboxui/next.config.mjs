/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
    output: "standalone",  // ← add this line

  reactCompiler: true,
};

export default nextConfig;
