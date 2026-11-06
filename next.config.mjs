const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{source: '/api/:path*',headers:[{key:'Cache-Control',value:'no-store'}]}];
  },
};
export default nextConfig;
