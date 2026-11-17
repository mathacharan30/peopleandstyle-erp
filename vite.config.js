import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In production Vercel runs /api/*.js as serverless functions. This makes `npm run dev`
// serve the same handlers so features like "add product from link" work locally too.
function devApiFunctions() {
  return {
    name: 'dev-api-functions',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/product')) return next();
        try {
          const mod = await server.ssrLoadModule('/api/product.js');
          await mod.default(req, res);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApiFunctions()],
  server: { port: 3000 },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
