import adapterAuto from '@sveltejs/adapter-auto';
import adapterVercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Gunakan adapter-vercel (region Singapura) saat build di server Vercel (Linux),
		// dan adapter-auto saat build lokal di Windows (menghindari EPERM symlink di Windows)
		adapter: process.env.VERCEL ? adapterVercel({ regions: ['sin1'] }) : adapterAuto()
	}
};

export default config;
