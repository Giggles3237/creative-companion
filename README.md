# Creative Companion

Creative Companion is an accessible creative studio that helps a person make a song, write a story, create art, design a card, or make a printable through one clear choice at a time. It keeps prompts, models, and provider details backstage.

The current build is centered on Terry, a non-speaking touchscreen and stylus user with cerebral palsy. The interaction model favors large targets, simple language, forgiving navigation, optional typing, and visible ways to go back or ask for a surprise.

## What works now

- Guided song, story, art, card, and printable journeys
- A practice song composer that produces playable WAV files without an API key
- Prepared examples for the other journeys, so the complete interaction can be tested immediately
- OpenAI text and image generation when an OpenAI API key is configured
- Project history, revisions, saving, related-journey discovery, and a “My creations” area
- D1 database persistence and R2 artifact storage
- An administrator area for journey visibility, journey versions, provider credentials, and generation logs
- Encrypted provider keys when `APP_ENCRYPTION_KEY` is configured
- ChatGPT account authentication when hosted with OpenAI Sites

Suno is selected as the music provider, but live Suno generation deliberately remains disabled until the official Suno Platform API contract for the account is implemented. The application does not send credentials or creative choices to an unofficial proxy. ElevenLabs is prepared in the provider configuration for future narration and voice journeys.

## Stack

- React 19, TypeScript, and vinext
- Vite and Cloudflare Workers
- Cloudflare D1 through Drizzle ORM
- Cloudflare R2 for generated media
- OpenAI Sites for authentication and managed hosting

## Run locally

Requirements:

- Node.js 22.13 or newer
- npm

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd creative-companion
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The local Sites development plugin supplies the hosting runtime used by the project. Choose **Use a practice creation** when no provider credentials are configured.

To open the administrative area, set `ADMIN_EMAIL` in `.env.local`, configure `APP_ENCRYPTION_KEY`, then visit `http://localhost:3000/admin` using the matching account.

## Verify the project

```bash
npm run check
```

This runs TypeScript validation and the production build. `npm run lint` is also available as an advisory full-source scan; it currently includes framework-style findings in the generated `components/ui` library.

## Connect it to GitHub

The directory is already initialized as a Git repository on the `main` branch. Create an empty repository on GitHub without adding a README, license, or `.gitignore`, then run:

```bash
git remote add origin https://github.com/YOUR_ACCOUNT/creative-companion.git
git push -u origin main
```

If an `origin` remote already exists, replace it with:

```bash
git remote set-url origin https://github.com/YOUR_ACCOUNT/creative-companion.git
git push -u origin main
```

GitHub Actions will run the same validation on pushes and pull requests.

## Configure providers

Copy `.env.example` to `.env.local` for local development. Never commit the populated environment file. In a deployed environment, add values through the host's secret and environment settings.

- `ADMIN_EMAIL`: account that can access `/admin`
- `APP_ENCRYPTION_KEY`: 64 lowercase hexadecimal characters used to encrypt provider keys stored through the admin UI
- `OPENAI_API_KEY`: enables live stories, artwork, cards, and printables
- `OPENAI_TEXT_MODEL` and `OPENAI_IMAGE_MODEL`: optional model overrides
- `SUNO_API_KEY`: reserved for the official Suno Platform connection
- `ELEVENLABS_API_KEY`: reserved for future narration and voice journeys

You can also add provider credentials in `/admin`; those keys are encrypted before being stored in D1.

## Deployment

This repository is configured for OpenAI Sites in `.openai/hosting.json`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the managed-hosting path and the exact remaining Suno work.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the application structure, data flow, security boundaries, and extension points.

## Product status

This is a private-preview-quality V1 for hands-on testing with Terry. It is ready to put in GitHub and run locally. Before a wider public launch, complete the official Suno integration, carry out the Terry acceptance test, add automated browser coverage for the main journeys, and perform an accessibility audit with assistive technology.
