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
  ...(validOutput ? { output: validOutput } : {}),
  experimental: {
    ...(useTracingRoot ? { outputFileTracingRoot: path.join(__dirname, '../') } : {}),
    serverComponentsExternalPackages: ['pdf-parse'],
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
