'use client';
/* oxlint-disable next/no-img-element -- Canvas editing uses original image pixels and data URLs. */
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ArrowLeft, Download, Palette, Undo2 } from 'lucide-react';
import {
  coloringDetails,
  fillRegion,
  photoOutline,
} from '@/lib/creative/coloring';
import type { ColoringPage } from '@/lib/creative/coloring';
import type { Artifact, Project } from '@/lib/creative/types';
const palette = [
  '#e76868',
  '#e99449',
  '#f1ce5b',
  '#91b879',
  '#3b7454',
  '#69bcbc',
  '#6195cb',
  '#8c7ac0',
  '#d691b8',
  '#996b4c',
  '#343941',
  '#ffffff',
];
function layer() {
  const c = document.createElement('canvas');
  c.width = c.height = 768;
  return c;
}
async function image(src: string) {
  const i = new Image();
  i.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    i.onload = () => resolve();
    i.onerror = () =>
      reject(
        new Error(
          'That image could not be opened. Try another image or upload a photo.',
        ),
      );
    i.src = src;
  });
  return i;
}
async function request(body?: unknown) {
  const r = await fetch('/api/coloring', {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Your page could not be saved.');
  return d;
}
export default function Coloring({
  projects,
  available,
  onBack,
  initial,
}: {
  projects: Project[];
  available: boolean;
  onBack: () => void;
  initial?: Artifact;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    outline = useRef<HTMLCanvasElement | null>(null),
    colors = useRef<HTMLCanvasElement | null>(null),
    undo = useRef<ImageData[]>([]),
    drawing = useRef(false),
    last = useRef<{ x: number; y: number } | null>(null);
  const [page, setPage] = useState<ColoringPage | null>(null),
    [saved, setSaved] = useState<ColoringPage[]>([]),
    [color, setColor] = useState(palette[0]),
    [tool, setTool] = useState<'fill' | 'brush'>('fill'),
    [size, setSize] = useState(18),
    [prompt, setPrompt] = useState(
      initial?.selections.find((selection) => selection.stepId === 'subject')
        ?.label || '',
    ),
    [detail, setDetail] = useState(
      initial?.selections.find((selection) => selection.stepId === 'detail')
        ?.value || 'balanced',
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [dirty, setDirty] = useState(0),
    [undoCount, setUndoCount] = useState(0);
  const revision = useRef(0),
    saving = useRef(false);
  function render() {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !colors.current || !outline.current) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(colors.current, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(outline.current, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!page || !outline.current || !colors.current || saving.current)
      return false;
    saving.current = true;
    const version = revision.current;
    setStatus('Saving…');
    try {
      const d = await request({
        action: 'save',
        page: {
          ...page,
          outline: outline.current.toDataURL(),
          colors: colors.current.toDataURL(),
        },
      });
      setSaved((p) => [d.page, ...p.filter((x) => x.id !== d.page.id)]);
      if (revision.current === version) {
        setDirty(0);
        setStatus('Saved to your account');
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      setStatus('Not saved — please try Save progress');
      return false;
    } finally {
      saving.current = false;
    }
  }
  async function load(
    src: string,
    title: string,
    lineArt = false,
    resume?: ColoringPage,
  ) {
    if (dirty && !(await save())) return;
    await task(async () => {
      const img = await image(src),
        o = layer(),
        c = layer(),
        ctx = o.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 768, 768);
      const scale = Math.min(768 / img.width, 768 / img.height),
        w = img.width * scale,
        h = img.height * scale;
      ctx.drawImage(img, (768 - w) / 2, (768 - h) / 2, w, h);
      const data = ctx.getImageData(0, 0, 768, 768);
      if (!resume) {
        if (lineArt) {
          for (let i = 0; i < data.data.length; i += 4) {
            const v =
              data.data[i] + data.data[i + 1] + data.data[i + 2] < 540
                ? 0
                : 255;
            data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
            data.data[i + 3] = 255;
          }
        } else data.data.set(photoOutline(data.data, 768, 768));
        ctx.putImageData(data, 0, 0);
      }
      const paint = c.getContext('2d')!;
      paint.fillStyle = 'white';
      paint.fillRect(0, 0, 768, 768);
      if (resume) paint.drawImage(await image(resume.colors), 0, 0);
      outline.current = o;
      colors.current = c;
      undo.current = [];
      setUndoCount(0);
      setPage(
        resume || {
          id: crypto.randomUUID(),
          title,
          outline: '',
          colors: '',
          updatedAt: '',
        },
      );
      revision.current++;
      setDirty(resume ? 0 : revision.current);
      setStatus(resume ? 'Saved to your account' : 'Ready to make it yours');
    });
  }
  async function loadArtwork(art: Artifact) {
    const detailChoice = art.selections.find(
      (selection) => selection.stepId === 'detail',
    );
    if (detailChoice) {
      const subject = art.selections.find(
        (selection) => selection.stepId === 'subject',
      );
      if (subject) setPrompt(subject.label);
      if (coloringDetails.some((option) => option.id === detailChoice.value))
        setDetail(detailChoice.value);
    }
    await load(art.media || art.image!, art.title, !!detailChoice);
  }
  useEffect(() => {
    void request()
      .then((d) => setSaved(d.pages))
      .catch((e) => setError(e.message));
    if (initial)
      void load(
        initial.media || initial.image!,
        initial.title,
        initial.selections.some((selection) => selection.stepId === 'detail'),
      );
    // Load the initial source once when this workspace opens.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    render();
  }, [page]);
  const autosave = useEffectEvent(() => {
    void save();
  });
  useEffect(() => {
    if (!dirty || !page) return;
    const t = setInterval(() => {
      if (!drawing.current) autosave();
    }, 1600);
    return () => clearInterval(t);
  }, [dirty, page]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change() {
    revision.current++;
    setDirty(revision.current);
    setStatus('Changes waiting to save');
    render();
  }
  function point(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(
        767,
        Math.max(0, Math.floor(((e.clientX - rect.left) * 768) / rect.width)),
      ),
      y: Math.min(
        767,
        Math.max(0, Math.floor(((e.clientY - rect.top) * 768) / rect.height)),
      ),
    };
  }
  function brush(p: { x: number; y: number }) {
    const ctx = colors.current!.getContext('2d')!;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current?.x ?? p.x, last.current?.y ?? p.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    last.current = p;
    render();
  }
  function down(e: PointerEvent<HTMLCanvasElement>) {
    if (!colors.current || !outline.current || busy) return;
    const ctx = colors.current.getContext('2d')!,
      p = point(e);
    undo.current.push(ctx.getImageData(0, 0, 768, 768));
    if (undo.current.length > 15) undo.current.shift();
    setUndoCount(undo.current.length);
    if (tool === 'fill') {
      const data = ctx.getImageData(0, 0, 768, 768);
      fillRegion(
        outline.current.getContext('2d')!.getImageData(0, 0, 768, 768).data,
        data.data,
        768,
        768,
        p.x,
        p.y,
        color,
      );
      ctx.putImageData(data, 0, 0);
      change();
    } else {
      drawing.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      brush(p);
    }
  }
  function finish() {
    if (drawing.current) {
      drawing.current = false;
      last.current = null;
      change();
    }
  }
  async function leave() {
    if (dirty && !(await save())) return;
    onBack();
  }
  return (
    <section className="coloring-workspace">
      <div className="guide-topline">
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void leave()}
        >
          <ArrowLeft /> The studio
        </button>
        <span className="eyebrow">YOUR COLORS. YOUR WAY.</span>
      </div>
      <div className="review-heading">
        <h1 id="screen-heading" tabIndex={-1}>
          A little color, all your own.
        </h1>
        <p>
          Imagine something you’d love to color. Make it as simple or intricate
          as you like, and choose every color yourself.
        </p>
      </div>
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
      <div className="coloring-imagine">
        <h2>Imagine a coloring page</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void task(async () => {
              const d = await request({ action: 'generate', prompt, detail });
              await load(d.image, prompt.slice(0, 100), true);
            });
          }}
        >
          <label htmlFor="coloring-prompt">What would you like to color?</label>
          <textarea
            id="coloring-prompt"
            value={prompt}
            maxLength={600}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A cozy cottage surrounded by wildflowers"
          />
          <fieldset className="coloring-detail">
            <legend>How much detail would you like?</legend>
            <div className="coloring-detail-options">
              {coloringDetails.map((option) => (
                <label
                  key={option.id}
                  aria-label={option.label}
                  className={detail === option.id ? 'selected' : ''}
                >
                  <input
                    type="radio"
                    name="coloring-detail"
                    value={option.id}
                    checked={detail === option.id}
                    disabled={busy}
                    onChange={() => setDetail(option.id)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="setting-note">
            Try another detail level with the same idea to create a new version.
            Your saved coloring pages stay in your collection.
          </p>
          <button
            className="button"
            disabled={busy || !available || !prompt.trim()}
          >
            Create with AI
          </button>
        </form>
        {!available && (
          <p className="setting-note">
            AI coloring pages will be available when artwork creation is
            connected.
          </p>
        )}
      </div>
      <details className="coloring-other-source">
        <summary>Or use a personal photo</summary>
        <label className="coloring-upload">
          Choose a photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > 12000000) {
                setError('Choose a photo smaller than 12 MB.');
                return;
              }
              const url = URL.createObjectURL(file);
              void load(
                url,
                file.name.replace(/\.[^.]+$/, '').slice(0, 100),
              ).finally(() => URL.revokeObjectURL(url));
            }}
          />
        </label>
        <p className="setting-note">
          Your photo becomes a black and white outline. The original stays on
          your device.
        </p>
      </details>
      {projects.some((p) => p.artifacts.some((a) => a.kind === 'image')) && (
        <section className="continue-section">
          <h2>Color something you’ve made</h2>
          <div className="coloring-presets">
            {projects
              .flatMap((p) =>
                p.artifacts.filter(
                  (a) => a.kind === 'image' && (a.media || a.image),
                ),
              )
              .map((a) => (
                <button
                  key={a.id}
                  disabled={busy}
                  onClick={() => void loadArtwork(a)}
                >
                  <img src={a.media || a.image} alt="" />
                  <span>{a.title}</span>
                </button>
              ))}
          </div>
        </section>
      )}
      {busy && (
        <output className="loading-note">Preparing your coloring page…</output>
      )}
      {page && (
        <div className="coloring-editor">
          <div>
            <h2>{page.title}</h2>
            <p className="setting-note">
              Tap an enclosed space to fill it. Use the brush for open areas.
            </p>
            <canvas
              ref={canvas}
              width={768}
              height={768}
              aria-label={`Coloring canvas: ${page.title}. Choose a color and tap a region or draw with the brush.`}
              onPointerDown={down}
              onPointerMove={(e) => {
                if (drawing.current) brush(point(e));
              }}
              onPointerUp={finish}
              onPointerCancel={finish}
            />
          </div>
          <aside>
            <h2>
              <Palette /> Your palette
            </h2>
            <div className="coloring-palette">
              {palette.map((c) => (
                <button
                  key={c}
                  style={{ background: c }}
                  aria-label={`Choose ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <label className="custom-color">
              Your own color
              <input
                aria-label="Custom color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            <div className="inline-actions">
              <button
                className="button secondary"
                aria-pressed={tool === 'fill'}
                onClick={() => setTool('fill')}
              >
                Fill
              </button>
              <button
                className="button secondary"
                aria-pressed={tool === 'brush'}
                onClick={() => setTool('brush')}
              >
                Brush
              </button>
            </div>
            {tool === 'brush' && (
              <label>
                Brush size
                <input
                  type="range"
                  min="3"
                  max="60"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                />
              </label>
            )}
            <button
              className="button secondary"
              disabled={!undoCount || busy}
              onClick={() => {
                const previous = undo.current.pop();
                if (previous) {
                  colors
                    .current!.getContext('2d')!
                    .putImageData(previous, 0, 0);
                  setUndoCount(undo.current.length);
                  change();
                }
              }}
            >
              <Undo2 /> Undo
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => void save()}
            >
              Save progress
            </button>
            <output aria-live="polite">{status}</output>
            <button
              className="button secondary"
              onClick={() => {
                const a = document.createElement('a');
                a.download = 'my-coloring-page.png';
                a.href = canvas.current!.toDataURL();
                a.click();
              }}
            >
              <Download /> Download picture
            </button>
          </aside>
        </div>
      )}
      {!!saved.length && (
        <section className="continue-section">
          <h2>Your coloring pages</h2>
          <p>Pick up right where you left off.</p>
          <div className="coloring-presets">
            {saved.map((p) => (
              <button
                disabled={busy}
                key={p.id}
                onClick={() => void load(p.outline, p.title, true, p)}
              >
                <div className="coloring-preview">
                  <img src={p.colors} alt="" />
                  <img src={p.outline} alt="" />
                </div>
                <span>{p.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
