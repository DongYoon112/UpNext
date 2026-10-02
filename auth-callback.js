'use strict';

(() => {
  const config = window.UNBND_AUTH;

  const query = new URLSearchParams(window.location.search);
  const tokenHash = query.get('token_hash');
  const type = query.get('type');

  const title = document.getElementById('result-title');
  const body = document.getElementById('result-body');

  const form = document.getElementById('resend-form');
  const verifyButton = document.getElementById('retry');

  const resend = document.getElementById('resend');
  const resendStatus = document.getElementById('resend-status');

  const openApp = document.getElementById('open-app');
  const openHelp = document.getElementById('open-help');

  const invalidMessage =
    'This verification link is invalid or has expired. Request another email below.';

  // Remove the token from the visible browser URL after we read it.
  history.replaceState(null, '', location.pathname);

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      return await fetch(`${config.url}/auth/v1/${path}`, {
        ...options,
        headers: {
          apikey: config.key,
          ...options.headers,
        },
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  function showReady() {
    title.textContent = 'Verify your email';
    body.textContent =
      'Press the button below to finish creating your UNBND account.';

    form.hidden = true;

    verifyButton.hidden = false;
    verifyButton.disabled = false;
    verifyButton.textContent = 'Verify email';

    openApp.hidden = true;
    openHelp.hidden = true;
  }

  function showSuccess() {
    title.textContent = 'Email verified';
    body.textContent = 'Your UNBND account is ready.';

    form.hidden = true;
    verifyButton.hidden = true;

    openApp.hidden = false;
    openHelp.hidden = false;

    document.title = 'Email verified — UNBND';
  }

  function showInvalid(message = invalidMessage) {
    title.textContent = 'Unable to verify email';
    body.textContent = message;

    form.hidden = false;
    verifyButton.hidden = true;

    openApp.hidden = true;
    openHelp.hidden = true;

    document.title = 'Unable to verify email — UNBND';
  }

  function showRetry() {
    title.textContent = 'Could not verify email';
    body.textContent =
      'Check your connection and try again.';

    form.hidden = false;

    verifyButton.hidden = false;
    verifyButton.disabled = false;
    verifyButton.textContent = 'Try again';

    openApp.hidden = true;
    openHelp.hidden = true;
  }

  async function verifyEmail() {
    verifyButton.disabled = true;
    verifyButton.hidden = true;

    title.textContent = 'Verifying…';
    body.textContent = 'Please wait while we verify your email.';

    try {
      const response = await request('verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token_hash: tokenHash,
          type: 'email',
        }),
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error('temporarily unavailable');
      }

      if (!response.ok) {
        showInvalid();
        return;
      }

      showSuccess();
    } catch {
      showRetry();
    }
  }

  verifyButton.addEventListener('click', verifyEmail);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (resend.disabled || !form.reportValidity()) {
      return;
    }

    resend.disabled = true;
    resendStatus.textContent = 'Sending…';

    try {
      const email = document
        .getElementById('email')
        .value
        .trim()
        .toLowerCase();

      const response = await request(
        `resend?redirect_to=${encodeURIComponent(config.redirect)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'signup',
            email,
          }),
        }
      );

      if (response.status === 429) {
        resendStatus.textContent =
          'Too many requests. Wait a minute before trying again.';
      } else if (!response.ok) {
        throw new Error('Unable to send');
      } else {
        resendStatus.textContent =
          'If this address has an unverified UNBND account, a new verification email is on its way.';
      }

      resend.textContent = 'Wait a minute before resending';

      setTimeout(() => {
        resend.disabled = false;
        resend.textContent = 'Send another verification email';
      }, 60000);
    } catch {
      resendStatus.textContent =
        'We could not send your email. Check your connection and try again.';

      resend.disabled = false;
    }
  });

  if (!tokenHash || type !== 'email') {
    showInvalid('This verification link is invalid.');
    return;
  }

  showReady();
})();
