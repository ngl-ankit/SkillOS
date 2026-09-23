import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({ out: 'build', precompress: true }),
		alias: {
			$server: 'src/lib/server',
			$engine: 'src/lib/engine',
			$components: 'src/lib/components'
		}
	}
};

export default config;
