import { Link, useLocation } from 'react-router-dom'

export default function NotFound() {
  const location = useLocation()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-5xl font-bold text-slate-800">404</h1>
      <p className="text-slate-600">
        No route matches <code>{location.pathname}</code>
      </p>
      <Link className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white" to="/">
        Back home
      </Link>
    </main>
  )
}
