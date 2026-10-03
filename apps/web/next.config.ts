import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  transpilePackages: [
    '@turf-and-taste/api-client',
    '@turf-and-taste/design-tokens',
    '@turf-and-taste/schemas',
    '@turf-and-taste/types',
    '@turf-and-taste/ui-web',
  ],
};

export default nextConfig;
