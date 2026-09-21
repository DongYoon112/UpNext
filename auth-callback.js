'use strict';

(() => {
  const config = window.UNBND_AUTH;
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const param = (key) => fragment.get(key) || query.get(key);
  // Keep only the access token in this page's memory. Never persist a session or hand tokens to the app.
  const token = param('access_token');
  const type = param('type');
  const hasError = ['error', 'error_code', 'error_description'].some((key) => query.has(key) || fragment.has(key));
  history.replaceState(null, '', location.pathname);

  const title = document.getElementById('result-title');
  const body = document.getElementById('result-body');
  const form = document.getElementById('resend-form');
  const retry = document.getElementById('retry');
  const resend = document.getElementById('resend');
  const resendStatus = document.getElementById('resend-status');
  const invalid = 'This verification link is invalid or has expired. Request another email below. If you already verified your email, open UNBND and sign in.';

  function showResult(success, message, canRetry = false) {
    title.textContent = success ? 'Email verified' : canRetry ? 'Could not check verification' : 'Unable to verify email';
    body.textContent = message;
    document.title = `${title.textContent} — UNBND`;
    form.hidden = success;
    retry.hidden = !canRetry;
    document.getElementById('open-app').hidden = false;
    document.getElementById('open-help').hidden = false;
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch(`${config.url}/auth/v1/${path}`, {
        ...options,
        headers: { apikey: config.key, ...options.headers },
        signal: controller.signal,
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      });
    } finally { clearTimeout(timeout); }
  }

  async function check() {
    retry.hidden = true;
    if (hasError || !token || !['signup', 'email'].includes(type)) {
      showResult(false, invalid);
      return;
    }
    title.textContent = 'Checking verification…';
    body.textContent = 'Please wait while we check your email verification.';
    try {
      const response = await request('user', { headers: { Authorization: `Bearer ${token}` } });
      if (response.status >= 500 || response.status === 429) throw new Error('Unavailable');
      if (!response.ok) { showResult(false, invalid); return; }
      const user = await response.json();
      // URL flags, decoded JWTs, and an existing browser session are never evidence of verification.
      if (!user.id || !user.email || !user.email_confirmed_at) { showResult(false, invalid); return; }
      showResult(true, 'Your UNBND account is ready.');
    } catch {
      showResult(false, 'Check your connection and try again, or request another verification email below.', true);
    }
  }

  retry.addEventListener('click', check);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (resend.disabled || !form.reportValidity()) return;
    resend.disabled = true;
    resendStatus.textContent = 'Sending…';
    try {
      const email = document.getElementById('email').value.trim().toLowerCase();
      const response = await request(`resend?redirect_to=${encodeURIComponent(config.redirect)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'signup', email }),
      });
      if (response.status === 429) {
        resendStatus.textContent = 'Too many requests. Wait a minute before trying again.';
      } else if (!response.ok) {
        throw new Error('Unable to send');
      } else {
        resendStatus.textContent = 'If this address has an unverified UNBND account, a new verification email is on its way. Check your inbox and spam folder.';
      }
      resend.textContent = 'Wait a minute before resending';
      setTimeout(() => { resend.disabled = false; resend.textContent = 'Send another verification email'; }, 60000);
    } catch {
      resendStatus.textContent = 'We could not send your email. Check your connection and try again.';
      resend.disabled = false;
    }
  });
  void check();
})();
