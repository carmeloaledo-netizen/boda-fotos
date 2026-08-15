/** @type {import('next').NextConfig} */
const nextConfig = {
  // Salida standalone para imágenes Docker pequeñas (Cloud Run).
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Permite Server Actions y route handlers con cuerpos grandes en streaming.
    serverComponentsExternalPackages: ["googleapis", "file-type"],
  },
};

export default nextConfig;
