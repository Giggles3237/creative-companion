# Deployment

## OpenAI Sites

The project includes `.openai/hosting.json` with managed D1 and R2 bindings. The current project ID points to the private Creative Companion preview created for this build.

Before publishing a version:

1. Run `npm ci`.
2. Run `npm run check`.
3. Configure `ADMIN_EMAIL` as a runtime environment value.
4. Configure `APP_ENCRYPTION_KEY` as a secret.
5. Optionally configure `OPENAI_API_KEY` as a secret, or add it through `/admin` after deployment.
6. Keep access private while Terry tests the application.
7. Build, save, and deploy the committed source version through OpenAI Sites.

The local practice and prepared-example modes remain available without provider credentials.

## GitHub

GitHub is the source repository and collaboration layer. Pushing to GitHub does not publish this application by itself. The included workflow validates each change; hosting still requires OpenAI Sites or an environment that supplies compatible ChatGPT authentication, D1, and R2 bindings.

## Environment contract

Runtime bindings:

- `DB`: D1 database
- `FILES`: R2 bucket

Environment and secret values:

- `ADMIN_EMAIL`
- `APP_ENCRYPTION_KEY`
- `OPENAI_API_KEY`
- `OPENAI_TEXT_MODEL`
- `OPENAI_IMAGE_MODEL`
- `SUNO_API_KEY`
- `SUNO_MUSIC_MODEL`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_MODEL`

## Readiness gates for a public release

- Complete and verify the official Suno API adapter.
- Test the complete song-to-story path with Terry using her normal touchscreen and stylus.
- Check focus order, screen-reader names, zoom, reduced motion, contrast, error recovery, and touch target size against WCAG 2.2 AA.
- Add browser tests for starting, generating, refining, saving, reopening, and moving to a related journey.
- Add production monitoring and provider budget alerts.
- Review retention, deletion, privacy, and consent behavior for generated media and interaction events.
