import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { visualizer } from 'rollup-plugin-visualizer'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    visualizer({
      filename: 'dist/client/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  environments: {
    client: {
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (
                  id.includes('better-auth') ||
                  id.includes('@better-auth')
                ) {
                  return 'vendor-auth'
                }
                if (id.includes('@dnd-kit')) {
                  return 'vendor-dnd'
                }
                if (id.includes('browser-image-compression')) {
                  return 'vendor-image-compression'
                }
              }
            },
          },
        },
      },
    },
  },
})

export default config
