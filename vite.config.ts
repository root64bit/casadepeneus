import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'build' && env.VITE_USE_MOCK_DATA === 'true') {
    throw new Error('VITE_USE_MOCK_DATA não pode ser ativado numa compilação de produção.')
  }
  return {
  build: {
    outDir: 'dist/client',
  },
  plugins: [
    tailwindcss(),
    react(),
  ],
  }
})
