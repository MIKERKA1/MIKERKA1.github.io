import { defineConfig, loadEnv } from 'vite';

// При сборке вшиваем текущий список проектов в HTML: карточки видны сразу,
// даже если у посетителя Supabase отвечает медленно. В браузере список потом обновляется.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [{
      name: 'projects-snapshot',
      async transformIndexHtml() {
        try {
          const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/projects?select=*&order=sort_order.asc,created_at.desc`, {
            headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = JSON.stringify(await res.json()).replace(/</g, '\\u003c');
          return [{ tag: 'script', attrs: { type: 'application/json', id: 'projects-data' }, children: json, injectTo: 'body' }];
        } catch (err) {
          console.warn(`projects snapshot skipped: ${err.message}`);
        }
      },
    }],
  };
});
