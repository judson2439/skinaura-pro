import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_API_BASE_URL || 'https://localhost:3443';

  return {
    server: {
      host: "::",
      port: 8080,
      allowedHosts: ["dev.skinaura.pro"],
      // Proxy API requests to backend in development
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: mode === 'production', // Verify SSL in production
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.error('Proxy error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log(`[Proxy] ${req.method} ${req.url} -> ${apiBaseUrl}`);
            });
          },
        },
        '/health': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: mode === 'production',
        },
      },
    },
    plugins: [
      react()
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Build optimizations
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});
