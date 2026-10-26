import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { cpSync, mkdirSync } from 'node:fs';
import type { Request, Response } from 'express';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), {
      name: 'bundle-pdfjs-assets',
      closeBundle() {
        for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
          const destination = path.resolve('dist/pdfjs', folder);
          mkdirSync(destination, { recursive: true });
          cpSync(path.resolve('node_modules/pdfjs-dist', folder), destination, { recursive: true });
        }
      },
      configureServer(server) {
        server.middlewares.use('/pdfjs', async (req, res, next) => {
          const { default: express } = await import('express');
          express.static(path.resolve('node_modules/pdfjs-dist'))(req as Request, res as Response, next);
        });
      },
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
