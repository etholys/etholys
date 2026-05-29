const path = require('path');

/** Só definir em produção quando for mesmo necessário; valores estranhos no .env partem o dev (404 em /_next). */
const outputMode = process.env.NEXT_OUTPUT_MODE;
const validOutput =
  outputMode === 'export' || outputMode === 'standalone' ? outputMode : undefined;

/** Em `next dev`, outputFileTracingRoot no monorepo pode deixar a compilação de cada rota extremamente lenta (página “a carregar” para sempre). Só ativar em produção ou com NEXT_USE_TRACING_ROOT=1. */
const useTracingRoot =
  process.env.NEXT_USE_TRACING_ROOT === '1' || process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  env: {
    ETHOLYS_WEB_ROOT: __dirname,
  },
  ...(validOutput ? { output: validOutput } : {}),
  experimental: {
    ...(useTracingRoot ? { outputFileTracingRoot: path.join(__dirname, '../') } : {}),
    // Prisma deve carregar do node_modules em runtime — bundling quebra delegates (ex. forgeCourse).
    serverComponentsExternalPackages: ['@prisma/client', 'pdf-parse'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = config.externals ?? [];
      config.externals = [
        ...externals,
        '@prisma/client',
        '.prisma/client',
        '.prisma/client/default',
      ];
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
};

module.exports = nextConfig;
