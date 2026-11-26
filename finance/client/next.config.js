const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/**
 * Production: static export to out/, served by the nginx gateway, which also
 * proxies /api to the finance API. No Node server at runtime (fits a 512 MB VPS).
 * Development: `next dev` proxies /api to API_ORIGIN instead.
 */
module.exports = (phase) => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const apiOrigin = process.env.API_ORIGIN || 'http://localhost:4000';
    return {
      async rewrites() {
        return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
      },
    };
  }
  return { output: 'export', images: { unoptimized: true } };
};
