# Architecture

## Runtime flow

```text
Studio interface
  -> Guide Engine
  -> Journey definition and session
  -> Generation API
  -> Capability/provider adapter
  -> OpenAI, Suno, ElevenLabs, or local practice provider
  -> D1 project/event records and R2 artifacts
```

The user interface never asks the creator to select a model or write a prompt. A journey records small, understandable choices. The generation layer turns those choices into the provider instruction.

## Main modules

- `components/studio/`: studio shell, guided-choice interface, artifact player, and administrator interface
- `lib/creative/journeys.ts`: built-in journey definitions
- `lib/creative/engine.ts`: choice validation and deterministic journey transitions
- `lib/creative/providers.ts`: capability-to-provider routing and prepared/practice generation
- `lib/creative/server.ts`: authentication, authorization, storage access, errors, encryption, and shared persistence helpers
- `app/api/studio/route.ts`: projects, guide choices, saving, revisions, and related journeys
- `app/api/generate/route.ts`: idempotent, rate-limited generation and artifact persistence
- `app/api/admin/route.ts`: protected provider and journey management
- `db/schema.ts`: D1 schema expressed with Drizzle

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
| `generate_music` | Suno adapter pending | Locally composed WAV sketch |
| `generate_text` | OpenAI Responses API | Prepared text example |
| `generate_image` | OpenAI Images API | Prepared artwork |
| `create_printable` | OpenAI Responses API | Prepared printable example |

ElevenLabs credentials can be stored now, but no V1 journey invokes its capability yet.

## Data and storage

D1 stores users' project ownership references, project sessions, artifact metadata, generation requests, interaction events, versioned journeys, journey visibility settings, encrypted provider settings, and accessibility preferences. R2 stores generated binary media. API queries always scope projects to the authenticated user ID.

Generation requests use client-generated idempotency keys, optimistic project versions, and a daily per-user limit. Raw provider failures are converted to short, recoverable messages.

## Authentication and administration

OpenAI Sites injects the authenticated ChatGPT account headers. `/admin` additionally compares the authenticated email to `ADMIN_EMAIL`. Provider keys submitted there are encrypted with AES-GCM using `APP_ENCRYPTION_KEY` before storage.

Do not expose the app directly without an equivalent trusted authentication layer. Client-supplied identity headers must never be accepted from the public internet.

## Adding a journey

For a built-in journey, add a validated `Journey` definition to `lib/creative/journeys.ts`. For content-managed journeys, create and publish a version through `/admin`. Reuse an existing capability or implement the provider behavior before publishing a journey that depends on a new one.

## Completing Suno

Implement the official account-specific REST contract in `lib/creative/providers.ts`:

1. Build an original song request from the journey instruction and selections.
2. Submit it directly to the official Suno Platform endpoint.
3. Handle asynchronous job polling or a signed callback, depending on the official contract.
4. Fetch or reference the completed audio within the provider's documented retention and access rules.
5. Persist the audio in R2 so projects do not depend on an expiring provider URL.
6. Convert provider states and errors to the existing accessible status and retry flow.
7. Record the provider model and generation result without logging the API key.

The current adapter fails closed because the official Suno Platform documentation is available inside the signed-in developer dashboard and should be implemented from that source.
