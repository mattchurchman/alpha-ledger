import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AuthGate from './AuthGate.tsx'
import Activity from './routes/Activity.tsx'
import Dashboard from './routes/Dashboard.tsx'
import Debug from './routes/Debug.tsx'
import FairValues from './routes/FairValues.tsx'
import Import from './routes/Import.tsx'
import Kit from './routes/Kit.tsx'
import Settings from './routes/Settings.tsx'
import StockDetail from './routes/StockDetail.tsx'
import { AppShell, ToastProvider } from './ui'

/**
 * `/kit` sits **outside** the auth gate on purpose: it is the design-system demo, fed only by
 * `src/kit/synthetic.ts`, and it has to be openable by a headless browser for task 07's
 * screenshot check. SPEC section 10 already accepts a public shell - no data route is reachable
 * without a session, and this page makes no API call at all.
 *
 * Task 14's audit should decide whether it stays in the production bundle.
 */
const KIT_PRICES = {
  date: '2026-10-02',
  updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route
            path="/kit"
            element={
              <AppShell pricesAsOf={KIT_PRICES}>
                <Kit />
              </AppShell>
            }
          />
          <Route path="*" element={<GatedApp />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}

function GatedApp() {
  return (
    <AuthGate>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stocks/:ticker" element={<StockDetail />} />
          <Route path="/fair-values" element={<FairValues />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/import" element={<Import />} />
          <Route path="/settings" element={<Settings />} />
          {/* Temporary, task 06 only. Goes away with src/routes/Debug.tsx. */}
          <Route path="/debug" element={<Debug />} />
        </Routes>
      </AppShell>
    </AuthGate>
  )
}
