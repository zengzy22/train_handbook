import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{source:'/oauth/:path*',headers:[
      {key:'Cache-Control',value:'no-store'},
      // Native form POSTs need their Origin for CSRF checks; omit referrers off-site.
      {key:'Referrer-Policy',value:'same-origin'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Content-Security-Policy',value:"frame-ancestors 'none'; form-action 'self'; base-uri 'self'"},
    ]}];
  },
};

export default nextConfig;
