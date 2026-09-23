// Worker entry: routes /api/enquiry to the existing enquiry handler.
// Every other request is served from static assets (wrangler.jsonc only runs this script for /api/*).
import { onRequestPost } from '../functions/api/enquiry.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/enquiry') {
      if (request.method === 'POST') return onRequestPost({ request, env });
      return new Response(JSON.stringify({ ok: false }), {
        status: 405,
        headers: { 'Allow': 'POST', 'Content-Type': 'application/json' }
      });
    }

    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });

    return env.ASSETS.fetch(request);
  }
};
