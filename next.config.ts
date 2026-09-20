import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Use postgres's Cloudflare/workerd entrypoint instead of bundling the Node.js entrypoint.
  serverExternalPackages: ['postgres'],
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
