import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import AuthGate from './AuthGate.tsx'
import Activity from './routes/Activity.tsx'
import Dashboard from './routes/Dashboard.tsx'
import Debug from './routes/Debug.tsx'
import FairValues from './routes/FairValues.tsx'
import Import from './routes/Import.tsx'
import Settings from './routes/Settings.tsx'
import StockDetail from './routes/StockDetail.tsx'

const navLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/stocks/:ticker', label: 'Stock detail' },
  { to: '/fair-values', label: 'Fair values' },
  { to: '/activity', label: 'Activity' },
  { to: '/import', label: 'Import' },
  { to: '/settings', label: 'Settings' },
  // Temporary, task 06 only. Goes away with src/routes/Debug.tsx.
  { to: '/debug', label: 'Debug' },
]

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <div className="min-h-screen bg-white">
          <nav className="flex flex-wrap gap-3 border-b border-gray-200 p-3 text-sm">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="text-blue-600 hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
          <main className="p-4">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stocks/:ticker" element={<StockDetail />} />
              <Route path="/fair-values" element={<FairValues />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/import" element={<Import />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/debug" element={<Debug />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthGate>
  )
}
