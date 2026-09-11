# Architecture

## Runtime flow

```text
Studio interface
  -> Guide Engine
  -> Journey definition and session
  -> Generation API
  -> Capability/provider adapter
  -> OpenAI, ElevenLabs, or local practice provider
  -> PostgreSQL project/event records and Netlify Blobs artifacts
```

The user interface never asks the creator to select a model or write a prompt. A journey records small, understandable choices. The generation layer turns those choices into the provider instruction.

## Main modules

- `components/studio/`: studio shell, guided-choice interface, artifact player, and administrator interface
- `lib/creative/journeys.ts`: built-in journey definitions
- `lib/creative/engine.ts`: choice validation and deterministic journey transitions
- `lib/creative/providers.ts`: capability-to-provider routing and prepared/practice generation
- `lib/creative/server.ts`: authorization, storage access, provider environment, errors, and shared persistence helpers
- `app/api/studio/route.ts`: projects, guide choices, saving, revisions, and related journeys
- `app/api/generate/route.ts`: idempotent, rate-limited generation and artifact persistence
- `app/api/admin/route.ts`: protected connection status and journey management
- `db/schema.ts`: PostgreSQL schema expressed with Drizzle

## Journey Engine

A `Journey` contains a start node, ordered guide steps, choices, capability, provider instruction, refinements, and related journeys. The application saves a copy of the journey definition with every project so future journey changes do not alter an existing creation.

Published database-backed journey versions can replace built-in definitions. An administrator can hide a journey without deleting its project history.

## Guide Engine

The guide session contains a current node, answer history, deterministic surprise seed, and optional inherited context. `choose` validates that an answer belongs to the current step; `goBack` removes the previous choice and returns to that step. The interface presents only the decision for the current node.

## Capability and provider layer

Journeys request capabilities such as `generate_music`, `generate_text`, `generate_image`, or `create_printable`. The provider adapter decides how to fulfill the request.

Current mappings:

| Capability | Live provider | Offline/practice behavior |
| --- | --- | --- |
| `generate_music` | Eleven Music v2 | Locally composed WAV sketch |
| `generate_text` | OpenAI Responses API | Prepared text example |
| `generate_image` | OpenAI Images API | Prepared artwork |
| `create_printable` | OpenAI Responses API | Prepared printable example |

The song journey invokes Eleven Music. ElevenLabs narration is reserved for a future spoken-word capability.

## Data and storage

Netlify Database stores users' project ownership references, project sessions, artifact metadata, generation requests, interaction events, versioned journeys, journey visibility settings, and accessibility preferences. Netlify Blobs stores generated binary media. API queries always scope projects to the authenticated user ID.

Generation requests use client-generated idempotency keys, optimistic project versions, and a daily per-user limit. Raw provider failures are converted to short, recoverable messages.

## Authentication and administration

Netlify Identity verifies the account from its signed session cookie. `/admin` additionally compares the authenticated email to `ADMIN_EMAIL`. Provider keys exist only in Netlify's server-side environment and are never accepted by the application's browser interface.

## Adding a journey

For a built-in journey, add a validated `Journey` definition to `lib/creative/journeys.ts`. For content-managed journeys, create and publish a version through `/admin`. Reuse an existing capability or implement the provider behavior before publishing a journey that depends on a new one.

## Eleven Music flow

For vocal songs, the provider creates a Music v2 composition plan from the guided selections. The returned plan supplies structured lyrics for the review screen and is then submitted to the composition endpoint. Instrumental songs use direct prompt composition with vocals forced off. Finished MP3 bytes are copied into Netlify Blobs so projects do not depend on a temporary provider URL. Provider errors are converted into the existing accessible retry flow, and API keys are never logged.
