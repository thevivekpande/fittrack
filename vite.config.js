import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { networkInterfaces } from 'node:os';
import { getNetworkAccess } from './src/mobileAccess.js';

function mobileNetworkDiscovery() {
  const install = (server, options) => {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/__fittrack/network') return next();
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end();
        return;
      }
      const address = server.httpServer?.address();
      const info = getNetworkAccess({
        interfaces: networkInterfaces(),
        boundAddress: typeof address === 'object' && address ? address.address : null,
        port: typeof address === 'object' && address ? address.port : null,
        protocol: options.https ? 'https:' : 'http:',
      });
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify(info));
    });
  };
  return {
    name: 'fittrack-mobile-network',
    configureServer(server) { install(server, server.config.server); },
    configurePreviewServer(server) { install(server, server.config.preview); },
  };
}

export default defineConfig({
  plugins: [react(), mobileNetworkDiscovery()],
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
