const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // next-pwa v5 predates App Router and incorrectly adds server-internal
  // manifest files to the precache list. These files live in .next/ but are
  // never served over HTTP, so Workbox fails with bad-precaching-response
  // and the SW never installs. Exclude them explicitly.
  buildExcludes: [
    /app-build-manifest\.json$/,
    /build-manifest\.json$/,
    /react-loadable-manifest\.json$/,
    /middleware-build-manifest\.js$/,
    /middleware-manifest\.json$/,
    /middleware-react-loadable-manifest\.js$/,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: `next build` writes plain HTML/JS to out/, which the nginx
  // gateway serves directly. No Node server at runtime (fits a 512 MB VPS).
  output: 'export',
  images: { unoptimized: true },
};

module.exports = withPWA(nextConfig);
