import { sites } from '@openai/sites-vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative assets allow the same build to work at / and /repository-name/.
  base: './',
  plugins: [react(), sites()],
});
