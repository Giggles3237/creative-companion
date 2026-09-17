import { getStore } from '@netlify/blobs';
import {
  db,
  failure,
  json,
  protectMutation,
  PublicError,
  putMedia,
  user,
} from '@/lib/creative/server';
import { generate } from '@/lib/creative/providers';
import { journeys } from '@/lib/creative/journeys';
import type { Project } from '@/lib/creative/types';
import { coloringDetails, coloringInstruction } from '@/lib/creative/coloring';
import type { ColoringPage } from '@/lib/creative/coloring';
export const dynamic = 'force-dynamic';
const store = () =>
  getStore({ name: 'creative-companion-coloring', consistency: 'strong' });
const ownerKey = (owner: string) => `users/${encodeURIComponent(owner)}/`;
export async function GET() {
  try {
    const u = await user();
    const pages: ColoringPage[] = [];
    for await (const batch of store().list({
      prefix: ownerKey(u.userId),
      paginate: true,
    }))
      for (const blob of batch.blobs) {
        const page = (await store().get(blob.key, {
          type: 'json',
        })) as ColoringPage | null;
        if (page) pages.push(page);
      }
    return json({
      pages: pages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    protectMutation(request);
    const u = await user();
    if (Number(request.headers.get('content-length') || 0) > 6000000)
      throw new PublicError('This page is too large to save.');
    const raw = await request.text();
    if (raw.length > 6000000)
      throw new PublicError('This page is too large to save.');
    let b;
    try {
      b = JSON.parse(raw);
    } catch {
      throw new PublicError('This page could not be read.');
    }
    if (b.action === 'generate') {
      if (
        typeof b.prompt !== 'string' ||
        !b.prompt.trim() ||
        b.prompt.length > 600
      )
        throw new PublicError(
          'Describe your coloring page in up to 600 characters.',
        );
      const detail = b.detail === undefined ? 'balanced' : b.detail;
      if (
        typeof detail !== 'string' ||
        !coloringDetails.some((option) => option.id === detail)
      )
        throw new PublicError('Please choose one of the detail levels shown.');
      const count = await db()
        .prepare(
          'SELECT COUNT(*) AS n FROM generations WHERE owner=? AND created_at>?',
        )
        .bind(u.userId, new Date(Date.now() - 86400000).toISOString())
        .first<{ n: number }>();
      if ((count?.n || 0) >= 30)
        throw new PublicError(
          'Please come back tomorrow for more AI creations.',
          429,
        );
      const j = {
        ...journeys.find((j) => j.capability === 'generate_image')!,
        instruction: coloringInstruction(detail),
      };
      const now = new Date().toISOString(),
        id = crypto.randomUUID();
      const p: Project = {
        id,
        title: 'My coloring page',
        journey: j,
        session: {
          node: 'create',
          history: [
            { stepId: 'subject', value: 'custom', label: b.prompt.trim() },
            {
              stepId: 'detail',
              value: detail,
              label: coloringDetails.find((option) => option.id === detail)!
                .label,
            },
          ],
          seed: 1,
        },
        status: 'ready',
        kept: false,
        artifacts: [],
        createdAt: now,
        updatedAt: now,
        version: 0,
      };
      await db()
        .prepare(
          'INSERT INTO projects (id,owner,title,journey,session,status,kept,version,created_at,updated_at) VALUES (?,?,?,?,?,?,0,0,?,?)',
        )
        .bind(
          id,
          u.userId,
          p.title,
          JSON.stringify(j),
          JSON.stringify(p.session),
          'ready',
          now,
          now,
        )
        .run();
      await db()
        .prepare(
          'INSERT INTO generations (id,project_id,owner,request_key,status,capability,provider,input,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          id,
          id,
          u.userId,
          id,
          'running',
          'generate_image',
          'configured',
          JSON.stringify({ coloring: true, detail }),
          now,
          now,
        )
        .run();
      try {
        const output = await generate(p, false, '');
        if (!output.bytes)
          throw new PublicError('The coloring page could not be opened.');
        const artifactId = crypto.randomUUID(),
          createdAt = new Date().toISOString(),
          storageKey = `artifacts/${id}/${artifactId}`;
        await putMedia(storageKey, output.bytes, 'image/png');
        const artifact = {
          id: artifactId,
          projectId: id,
          title: p.title,
          text: 'A coloring page made from your imagination.',
          kind: 'image',
          sample: false,
          revision: 1,
          createdAt,
          selections: p.session.history,
          media: `/api/media?id=${artifactId}`,
          mime: 'image/png',
        };
        await db().batch([
          db()
            .prepare(
              'INSERT INTO artifacts (id,project_id,payload,storage_key,created_at) VALUES (?,?,?,?,?)',
            )
            .bind(
              artifactId,
              id,
              JSON.stringify(artifact),
              storageKey,
              createdAt,
            ),
          db()
            .prepare(
              'UPDATE projects SET status=?,active_artifact_id=?,updated_at=? WHERE id=?',
            )
            .bind('review', artifactId, createdAt, id),
          db()
            .prepare(
              'UPDATE generations SET status=?,artifact_id=?,updated_at=? WHERE id=?',
            )
            .bind('succeeded', artifactId, createdAt, id),
        ]);
        return json({
          image: `data:image/png;base64,${Buffer.from(output.bytes).toString('base64')}`,
        });
      } catch (e) {
        await db()
          .prepare('UPDATE generations SET status=?,updated_at=? WHERE id=?')
          .bind('failed', new Date().toISOString(), id)
          .run();
        throw e;
      }
    }
    if (
      b.action !== 'save' ||
      !/^[a-f0-9-]{36}$/.test(b.page?.id) ||
      typeof b.page.title !== 'string' ||
      b.page.title.length > 100
    )
      throw new PublicError('Please save from the coloring workspace.');
    for (const key of ['outline', 'colors'])
      if (
        typeof b.page[key] !== 'string' ||
        !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(b.page[key]) ||
        b.page[key].length > 2800000
      )
        throw new PublicError('This page could not be saved.');
    const page: ColoringPage = {
      id: b.page.id,
      title: b.page.title,
      outline: b.page.outline,
      colors: b.page.colors,
      updatedAt: new Date().toISOString(),
    };
    await store().setJSON(`${ownerKey(u.userId)}${page.id}`, page);
    return json({ page });
  } catch (e) {
    return failure(e);
  }
}
