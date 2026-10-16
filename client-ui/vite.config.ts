import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: '/client/',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.VITE_APP_BUILD_DATE': JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'target/classes/META-INF/resources',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    testTimeout: 30000,
    server: { deps: { inline: [/antd/, /@ant-design/, /@rc-component/] } },
  },
});
