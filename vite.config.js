import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                search: resolve(__dirname, 'search.html'),
                aisearch: resolve(__dirname, 'ai-search.html'),
                v2engine: resolve(__dirname, 'v2-engine.html'),
            },
        },
    },
});
