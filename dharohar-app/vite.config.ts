import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { handleGeminiAnalysis } from './server/geminiBackend.ts';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env file into process.env
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }
  if (env.GOOGLE_API_KEY) {
    process.env.GOOGLE_API_KEY = env.GOOGLE_API_KEY;
  }

  return {
    plugins: [
      react(),
      {
        name: 'gemini-ai-backend-middleware',
        configureServer(server) {
          server.middlewares.use('/api/analyze-cultural-record', (req, res) => {
            handleGeminiAnalysis(req, res);
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use('/api/analyze-cultural-record', (req, res) => {
            handleGeminiAnalysis(req, res);
          });
        }
      }
    ]
  };
});
