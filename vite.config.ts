import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
	preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
	ssr: { noExternal: ['three', '@threlte/core', '@threlte/extras'] },
	build: { chunkSizeWarningLimit: 900 },
	test: {
		include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
		environment: 'node',
		testTimeout: 20000,
		hookTimeout: 30000,
		fileParallelism: false
	}
});
