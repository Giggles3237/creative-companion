# Deploy Creative Companion on Netlify

The application is ready for Netlify’s current Next.js runtime. Netlify supplies the server functions, PostgreSQL database, media storage, and private user accounts. Provider credentials stay in Netlify environment variables and are never committed to GitHub or sent to the browser.

## 1. Import the GitHub repository

1. Sign in at [app.netlify.com](https://app.netlify.com/).
2. Choose **Add new project** → **Import an existing project**.
3. Choose GitHub and select `stanleylaskoopsbot-eng/creative-companion`.
4. Select the `main` branch.
5. Netlify should detect Next.js. Use `npm run build` as the build command and `.next` as the publish directory if those fields are not filled automatically.
6. Choose **Deploy**.

The committed `@netlify/database` dependency asks Netlify to provision a managed PostgreSQL database. The migration in `netlify/database/migrations` creates the project, artifact, journey, generation, and event tables during deployment.

## 2. Enable private accounts

After the first deploy, open **Project configuration** → **Identity** and enable Netlify Identity.

For Terry’s testing period, set registration to **Invite only**. Invite Terry and the administrator from the Identity user screen. The application includes its own large, touch-friendly sign-in page.

## 3. Add private environment variables

Open **Project configuration** → **Environment variables** and add:

- `ADMIN_EMAIL`: the email address of the administrator’s invited Identity account.
- `OPENAI_API_KEY`: enables stories, artwork, cards, and printables.
- `ELEVENLABS_API_KEY`: enables complete songs.
- `OPENAI_TEXT_MODEL`: optional; defaults to `gpt-6-astra`.
- `OPENAI_IMAGE_MODEL`: optional; defaults to `gpt-image-1`.
- `ELEVENLABS_MUSIC_MODEL`: optional; defaults to `music_v2`.
- `ELEVENLABS_VOICE_MODEL`: optional; defaults to `eleven_multilingual_v2`.

Apply the variables to **Functions** and to the production and deploy-preview contexts where you want live generation. Netlify creates `NETLIFY_DB_URL`; do not paste an API key into that variable.

Trigger a new deploy after changing environment variables. `/admin` then shows whether each creative capability can see its required key, without displaying the key itself.

## 4. Verify before sharing

Sign in with an invited account and complete this sequence:

1. Make a practice song and save it.
2. Make a live song and download it.
3. Turn the song idea into a story.
4. Reopen both items from **My creations**.
5. Open `/admin` with the administrator account and check the generation log.

Keep Identity invite-only until Terry has completed the end-to-end test with her normal touchscreen and stylus. Nothing created in the application is public by default.

## Local development

Use Netlify CLI so local functions receive Identity, Database, and Blobs context:

```bash
npx netlify dev
```

Copy `.env.example` to `.env.local` for local provider configuration. Never commit `.env.local`.
