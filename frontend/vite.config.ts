import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:3000';

  return {
    server: {
      host: "::",
      port: 8000,
      allowedHosts: ["skinaura.pro", "www.skinaura.pro"],
      // Proxy API requests to backend in production
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: mode === 'production', // Verify SSL in production
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.error('Proxy error:', err);
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
    preview: {
      allowedHosts: ["skinaura.pro", "www.skinaura.pro"],
    },
    plugins: [
      react()
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Exclude native modules from dependency optimization
    optimizeDeps: {
      exclude: [
        '@swc/core',
        '@swc/wasm',
        '@swc/core-linux-x64-gnu',
        '@swc/core-linux-x64-musl',
      ],
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
