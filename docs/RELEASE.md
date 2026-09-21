# UNBND website release

## Deployment

This repository is the public static website, not the mobile app. Keep the repository
name and `/UpNext/` base path: store links depend on them.

- Publish with a normal push to `origin/main`.
- The existing GitHub-managed `pages build and deployment` workflow deploys the
  root of `main`; `.nojekyll` is preserved. No custom build or dependencies are needed.
- Check the workflow for the pushed commit, then fetch all three public URLs and
  compare the returned content with the local files. A push alone is not deployment proof.
- Public routes: `/UpNext/`, `/UpNext/privacy.html`, `/UpNext/delete-account.html`, `/UpNext/auth-callback.html`.

Email verification deployment and testing are documented in [EMAIL_VERIFICATION.md](EMAIL_VERIFICATION.md).

## Sources and checks — 20 September 2026

Read `~/Career/docs/PRIVACY.md` and `~/Career/docs/RELEASE.md` before editing.
The five supplied UNBND assets match the approved mobile brand assets byte-for-byte.
The prior local commit `9464254` was one commit ahead of origin and is preserved.
There were no tracked local edits or applicable AGENTS.md instructions.

The informational pages use system fonts and local assets. The verification callback
uses local Inter fonts and a script that talks only to Supabase Auth; there is no
tracking or store download badge. The release handoff reports TestFlight testing and no
public store release; no public download URL was supplied or verified.

Browser verification uses Chromium at 320, 390, 768, and 1440 pixels: all pages,
horizontal overflow, local links and anchors, keyboard skip links, FAQ toggles, and
axe WCAG A/AA checks including text contrast. Screenshots and temporary QA tooling
are kept in ignored `.qa/`, outside the published commit.

## Mobile/backend follow-ups (not changed in this repository)

These remain with the mobile/backend owner; see the mobile privacy audit for details.

- Decide whether to purge auth audit entries, which retain deleted users' email addresses.
- Retry or otherwise recover failed avatar removal during account deletion. Today the
  failure is logged, but account deletion continues without an automatic retry.
- Decide whether to replace public headshot links with authenticated/signed access.
- Disclose student email/name/photo/major sharing on the booth join screen.
- Confirm actual backup configuration, backup retention, hosting-log retention,
  and downstream notification-provider retention. No invented deadlines on the site.
- Review iOS ATS settings, release dev-client inclusion and inherited permissions.
- Remove Google Fonts from the mobile recruiter print sheet if desired; it is still
  disclosed on the policy page. This website makes no font-service requests.
- Remove production demo accounts/test tickets before public app launch.
- Rotate the previously exposed email-service credential identified in the mobile
  release handoff. No credentials are copied into this repository.
- Verify public store availability and URLs before replacing the beta message.

The 90-day commitment on the deletion page is the existing commitment for confirmed
email requests only. It is not a data-retention period or an in-app waiting period.
