import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/huninn/400.css';
import '@fontsource/caveat/600.css';
import '@fontsource/caveat/700.css';
import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';

const searchParams = new URLSearchParams(window.location.search);
// Prototype switch (proto branch only): ?proto=<id> renders seeded local prototypes, no auth.
const protoId = searchParams.get('proto');
const ProtoRoot = protoId != null ? lazy(() => import('./proto/ProtoRoot.jsx')) : null;
// DEV-only visual harness around pure MagazineCoverView (no App/AuthProvider/Supabase client).
const DevAuthHarness =
  import.meta.env.DEV && searchParams.get('devAuth') === '1'
    ? lazy(() => import('./components/auth/AuthDevHarness.jsx'))
    : null;
const App = !ProtoRoot && !DevAuthHarness ? lazy(() => import('./App')) : null;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={null}>
      {DevAuthHarness ? (
        <DevAuthHarness />
      ) : ProtoRoot ? (
        <ProtoRoot id={protoId} />
      ) : (
        <App />
      )}
    </Suspense>
  </StrictMode>
);
