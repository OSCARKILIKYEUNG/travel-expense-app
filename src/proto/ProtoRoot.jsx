import { lazy, Suspense } from 'react';

/**
 * Prototype switch. Only loaded when the URL has ?proto=<id>.
 * Each option lives in its own folder and is built by a different model.
 */
const OPTIONS = {
  ref: {
    label: 'Ref build — executor takeover (gemini-4-argon-high region-blocked)',
    load: lazy(() => import('./ref/index.jsx')),
  },
  notebook: {
    label: 'Notebook — integrate preview mock (gemini-4-argon-high)',
    load: lazy(() => import('../notebook/NotebookApp.jsx')),
  },
  grok: {
    label: 'Option G — executor takeover (grok-4.7-high stalled ×3)',
    load: lazy(() => import('./option-g-grok/index.jsx')),
  },
  argon: {
    label: 'Option A — gemini-4-argon-high',
    load: lazy(() => import('./option-a-argon/index.jsx')),
  },
};

export default function ProtoRoot({ id }) {
  const option = OPTIONS[id];
  if (!option) {
    return (
      <div className="min-h-screen bg-cream p-6 text-ink">
        <p className="font-display text-xl">Prototypes</p>
        <ul className="mt-4 space-y-2">
          {Object.entries(OPTIONS).map(([key, o]) => (
            <li key={key}>
              <a className="text-teal-strong underline" href={`?proto=${key}`}>{o.label}</a>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const Option = option.load;
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream" />}>
      <Option />
    </Suspense>
  );
}
