import '@fontsource/huninn/400.css';
import '@fontsource/caveat/600.css';
import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './App';
import './index.css';

// Prototype switch (proto branch only): ?proto=<id> renders seeded local prototypes, no auth.
const protoId = new URLSearchParams(window.location.search).get('proto');
const ProtoRoot = protoId != null ? lazy(() => import('./proto/ProtoRoot.jsx')) : null;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {ProtoRoot ? (
      <Suspense fallback={null}>
        <ProtoRoot id={protoId} />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
);
