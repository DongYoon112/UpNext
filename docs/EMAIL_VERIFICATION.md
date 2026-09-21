# UNBND email verification

`https://dongyoon112.github.io/UpNext/auth-callback.html` is the public signup
verification result. Its official logo is the existing
`https://dongyoon112.github.io/UpNext/unbnd-icon-1024.png`, identical to the approved
mobile asset. Typography uses self-hosted Inter with its included OFL license.

The page validates the returned signup/email access token against Supabase's
`GET /auth/v1/user` and requires `email_confirmed_at`. It does not trust URL success
flags, decode-and-trust a JWT, or read an existing browser session. Missing,
expired, rejected, and wrong-flow links show an error and signup-email resend;
network failures also offer retry. Resend always targets this same HTTPS callback.

The callback clears credentials from browser history, never writes auth storage,
never refreshes or installs the session, and opens the app with `unbnd:///` without
credentials. This preserves the existing manual sign-in flow and existing app
sessions. Refreshing a cleared callback cannot redisplay success without evidence;
the page offers sign-in or a new email instead.

Deploy by pushing `main`; GitHub Pages publishes the static root. The npm package
contains development-only tests, and no build step or runtime dependency is needed.

Test with `npm ci`, `npx playwright install chromium webkit`, and `npm test` on a
host with Playwright browser dependencies installed. Tests cover actual browser
rendering, invalid/missing/forged links, server validation, unconfirmed users,
network retry, resend errors/throttling, preserved storage, mobile width, and blocked
images. Supabase responses are mocked in these regression tests; the release check
also verifies a real disposable account against the live service without sending
email, and deletes the fixture afterward.

On this Linux Flatpak host, Chromium is available but WebKit's system libraries
are missing. `UNBND_SKIP_WEBKIT=1 npm test` runs the six Chromium suites with the
WebKit suite explicitly skipped; it does not certify Safari or physical devices.

Supabase must retain `{{ .ConfirmationURL }}` in the confirmation email and use this
callback as Site URL/default redirect and an allowed redirect. The full branded
email template and mobile deployment notes are in `~/Career/supabase/templates/confirmation.html`
and `~/Career/docs/EMAIL_VERIFICATION.md`. Never deploy a service-role/secret key to
this website; `auth-config.js` contains only the public project URL and publishable key.

Both old and new mobile builds can use the browser result and `unbnd:///` button.
The new in-app result/resend screens require new Android/iOS builds because OTA
updates are not enabled. Verify native handoff on real phones before mobile release.
