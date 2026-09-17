/* oxlint-disable typescript/no-require-imports -- Matches the Node CommonJS test runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const coloring = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('lib/creative/coloring.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: coloring },
);
function route(owner = 'alice') {
  const generated = [];
  const db = {
    prepare: () => ({
      bind: () => ({ first: async () => ({ n: 0 }), run: async () => ({}) }),
    }),
    batch: async () => [],
  };
  const data = new Map(),
    exports = {};
  class PublicError extends Error {
    constructor(message, status = 400) {
      super(message);
      this.status = status;
    }
  }
  const store = {
    setJSON: async (key, value) => data.set(key, value),
    get: async (key) => data.get(key),
    list: async function* ({ prefix }) {
      yield {
        blobs: [...data.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((key) => ({ key })),
      };
    },
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync('app/api/coloring/route.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports,
      Response,
      Request,
      Date,
      Buffer,
      crypto,
      require: (name) => {
        if (name === '@netlify/blobs') return { getStore: () => store };
        if (name === '@/lib/creative/coloring') return coloring;
        if (name === '@/lib/creative/journeys')
          return { journeys: [{ capability: 'generate_image' }] };
        if (name === '@/lib/creative/providers')
          return {
            generate: async (project) => {
              generated.push(project);
              return { bytes: Buffer.from('image') };
            },
          };
        if (name === '@/lib/creative/server')
          return {
            db: () => db,
            putMedia: async () => {},
            user: async () => {
              if (!owner) throw new PublicError('Sign in', 401);
              return { userId: owner };
            },
            protectMutation: () => {},
            PublicError,
            json: (v) => Response.json(v),
            failure: (e) =>
              Response.json({ error: e.message }, { status: e.status || 500 }),
          };
        return {};
      },
    },
  );
  return { app: exports, data, generated };
}
const page = {
  id: '12345678-1234-1234-1234-123456789abc',
  title: 'My cat',
  outline: 'data:image/png;base64,AAAA',
  colors: 'data:image/png;base64,BBBB',
};
const save = (p) =>
  new Request('https://studio.test/api/coloring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save', page: p }),
  });
test('coloring saves layers under the authenticated account and reloads them', async () => {
  const { app, data } = route();
  assert.equal((await app.POST(save(page))).status, 200);
  assert.ok(data.has(`users/alice/${page.id}`));
  data.set('users/bob/private', { ...page, title: 'Someone else' });
  const response = await (await app.GET()).json();
  assert.equal(response.pages.length, 1);
  assert.equal(response.pages[0].colors, page.colors);
  assert.equal(response.pages[0].outline, page.outline);
  assert.ok(response.pages[0].updatedAt);
});
test('coloring rejects unauthenticated saves and invalid image payloads', async () => {
  assert.equal((await route(null).app.POST(save(page))).status, 401);
  assert.equal(
    (
      await route().app.POST(
        save({ ...page, colors: 'https://example.com/image.png' }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await route().app.POST(save({ ...page, id: '../bob' }))).status,
    400,
  );
});

const generateRequest = (detail) =>
  new Request('https://studio.test/api/coloring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate',
      prompt: 'A cottage with flowers',
      ...(detail === undefined ? {} : { detail }),
    }),
  });
test('AI generation applies each detail level and preserves the subject', async () => {
  for (const detail of ['simple', 'balanced', 'intricate']) {
    const { app, generated } = route();
    assert.equal((await app.POST(generateRequest(detail))).status, 200);
    assert.equal(generated.length, 1);
    const project = generated[0];
    assert.equal(
      project.session.history.find((s) => s.stepId === 'detail').value,
      detail,
    );
    assert.equal(
      project.session.history.find((s) => s.stepId === 'subject').label,
      'A cottage with flowers',
    );
    assert.match(project.journey.instruction, /closed shapes/);
    assert.match(
      project.journey.instruction,
      detail === 'simple'
        ? /few large/
        : detail === 'intricate'
          ? /many smaller/
          : /moderate detail/,
    );
  }
});
test('AI generation defaults to balanced detail and rejects unsupported choices', async () => {
  const { app, generated } = route();
  assert.equal((await app.POST(generateRequest(undefined))).status, 200);
  assert.equal(
    generated[0].session.history.find((s) => s.stepId === 'detail').value,
    'balanced',
  );
  assert.equal((await app.POST(generateRequest('extreme'))).status, 400);
  assert.equal(generated.length, 1);
});
