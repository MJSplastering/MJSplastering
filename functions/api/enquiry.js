// Cloudflare Pages Function: POST /api/enquiry
//
// Receives the contact-page enquiry form, checks it for spam (honeypot + Turnstile),
// and emails it with any photos attached to ENQUIRY_TO through the Resend API.
// Nothing is stored.
//
// Required environment (Cloudflare Pages > Settings > Variables and Secrets):
//   RESEND_API_KEY        secret
//   TURNSTILE_SECRET_KEY  secret
//   ENQUIRY_TO            e.g. info@mjs-plastering.com.au
//   ENQUIRY_FROM          e.g. MJS Website <enquiries@mjs-plastering.com.au>

const MAX_PHOTOS = 5;
const MAX_EACH = 10 * 1024 * 1024;
const MAX_TOTAL = 20 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];

const LIMITS = { name: 100, phone: 40, email: 200, suburb: 100, job: 300, details: 3000 };

export async function onRequestPost({ request, env }) {
  try {
    if (!env.RESEND_API_KEY || !env.TURNSTILE_SECRET_KEY || !env.ENQUIRY_TO || !env.ENQUIRY_FROM) {
      console.error('enquiry: missing environment configuration');
      return reply(false, 500);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) return reply(false, 400);

    const form = await request.formData();

    // Honeypot: real people never fill this in. Pretend it worked.
    if (text(form, 'company', 200)) return reply(true);

    const verified = await verifyTurnstile(
      form.get('cf-turnstile-response'),
      env.TURNSTILE_SECRET_KEY,
      request.headers.get('CF-Connecting-IP')
    );
    if (!verified) return reply(false, 400);

    const fields = {};
    for (const key of Object.keys(LIMITS)) fields[key] = text(form, key, LIMITS[key]);

    if (!fields.name || !fields.phone || !fields.job) return reply(false, 400);
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return reply(false, 400);

    const files = form.getAll('photos').filter((f) => f && typeof f === 'object' && f.size > 0);
    if (files.length > MAX_PHOTOS) return reply(false, 400);

    let total = 0;
    const attachments = [];
    for (const [i, file] of files.entries()) {
      if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_EACH) return reply(false, 400);
      total += file.size;
      if (total > MAX_TOTAL) return reply(false, 400);
      attachments.push({
        filename: safeFilename(file.name, i, file.type),
        content: toBase64(await file.arrayBuffer())
      });
    }

    const subject = oneLine(
      'Website enquiry: ' + fields.name + (fields.suburb ? ' (' + fields.suburb + ')' : '')
    );

    const body = [
      'New enquiry from the MJS website.',
      '',
      'Name: ' + fields.name,
      'Phone: ' + fields.phone,
      'Email: ' + (fields.email || '(not given)'),
      'Suburb/postcode: ' + (fields.suburb || '(not given)'),
      '',
      'What they need help with:',
      fields.job,
      '',
      'Additional details:',
      fields.details || '(none)',
      '',
      'Photos attached: ' + attachments.length
    ].join('\n');

    const payload = {
      from: env.ENQUIRY_FROM,
      to: [env.ENQUIRY_TO],
      subject,
      text: body
    };
    if (fields.email) payload.reply_to = fields.email;
    if (attachments.length) payload.attachments = attachments;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('enquiry: Resend responded with status ' + res.status);
      return reply(false, 502);
    }

    return reply(true);
  } catch (err) {
    console.error('enquiry: unexpected error', err && err.message);
    return reply(false, 500);
  }
}

function reply(ok, status = 200) {
  return new Response(JSON.stringify({ ok }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function text(form, key, max) {
  const value = form.get(key);
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function oneLine(value) {
  return value.replace(/[\r\n]+/g, ' ').slice(0, 200);
}

function safeFilename(name, index, type) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif' }[type] || 'jpg';
  const base = String(name || '')
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return (base || 'photo-' + (index + 1)) + '.' + ext;
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function verifyTurnstile(token, secret, ip) {
  if (typeof token !== 'string' || !token) return false;
  const params = new FormData();
  params.append('secret', secret);
  params.append('response', token);
  if (ip) params.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('enquiry: Turnstile verification failed', err && err.message);
    return false;
  }
}
