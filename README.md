# Creative Companion

Creative Companion is an accessible creative studio that helps a person make a song, write a story, create art, design a card, or make a printable through one clear choice at a time. It keeps prompts, models, and provider details backstage.

The current build is centered on Terry, a non-speaking touchscreen and stylus user with cerebral palsy. The interaction model favors large targets, simple language, forgiving navigation, optional typing, and visible ways to go back or ask for a surprise.

## What works now

- Guided song, story, art, card, and printable journeys
- A practice song composer that produces playable WAV files without an API key
- Prepared examples for the other journeys, so the complete interaction can be tested immediately
- OpenAI text and image generation when an OpenAI API key is configured
- Project history, revisions, saving, related-journey discovery, and a “My creations” area
- PostgreSQL project persistence and Netlify Blobs artifact storage
- An administrator area for journey visibility, journey versions, connection status, and generation logs
- Netlify Identity accounts with private creations for each user
- Server-only OpenAI and ElevenLabs environment variables

Live songs use the official Eleven Music API. The application creates a structured composition plan, generates an MP3 with Music v2, stores the finished audio in the project's media bucket, and displays the generated lyrics. ElevenLabs narration remains available as a separate future capability.

## Stack

- React 19, Next.js, and TypeScript
- Netlify’s OpenNext runtime
- Netlify Database (PostgreSQL)
- Netlify Blobs for generated media
- Netlify Identity for authentication

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

Run `npx netlify dev` and open the URL it prints. Netlify CLI supplies the local Identity, Database, and Blobs context. Choose **Use a practice creation** when no provider credentials are configured.

To open the administrative area, set `ADMIN_EMAIL` in `.env.local`, then visit `/admin` using the matching Identity account.

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
- `OPENAI_API_KEY`: enables live stories, artwork, cards, and printables
- `OPENAI_TEXT_MODEL` and `OPENAI_IMAGE_MODEL`: optional model overrides
- `ELEVENLABS_API_KEY`: enables complete songs and is reserved for future narration
- `ELEVENLABS_MUSIC_MODEL`: optional music model override; defaults to `music_v2`

Provider credentials are read only from server-side environment variables. `/admin` reports connection status without accepting or exposing secrets.

## Deployment

This repository is configured for Netlify. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the complete GitHub import, Identity, database, and environment-variable setup.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the application structure, data flow, security boundaries, and extension points.

## Product status

This is a private-preview-quality V1 for hands-on testing with Terry. It is ready to put in GitHub and run locally. Before a wider public launch, verify the Eleven Music integration with the account, carry out the Terry acceptance test, add automated browser coverage for the main journeys, and perform an accessibility audit with assistive technology.

### Personalized coloring

The studio’s **Make a coloring page** workspace offers an Unsplash photo collection,
local JPEG/PNG/WebP uploads, AI coloring-page prompts using the existing artwork
provider, and reuse of earlier image creations. Photo conversion runs in the
browser; only the resulting outlines and coloring layers are saved. Clear photos
with simple backgrounds work best. Fill uses the original outline as its boundary,
so users can recolor spaces; a brush handles open shapes. The palette supports
custom colors, undo, PNG download, and automatic or manual progress saves.

Coloring pages are private JSON objects in the `creative-companion-coloring`
Netlify Blobs store, scoped to the authenticated user. Reopening a page restores
its outline and separate color layer. AI pages also appear in My creations and
share the existing daily generation limit. No database migration or additional
provider key is required. The preset photo collection needs an internet connection.
