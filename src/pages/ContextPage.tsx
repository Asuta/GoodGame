import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import {
  DEFAULT_SESSION,
  DEFAULT_WORLD,
  ensureDefaults,
  getSession,
  getWorld,
  saveSession,
  upsertWorld,
} from '@/features/storage/repository'
import { useI18n } from '@/i18n/useI18n'
import type { SessionData, WorldData } from '@/types/game'

export default function ContextPage() {
  const { t } = useI18n()
  const [world, setWorld] = useState<WorldData>(DEFAULT_WORLD)
  const [session, setSession] = useState<SessionData>(DEFAULT_SESSION)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void (async () => {
      await ensureDefaults()
      const currentSession = await getSession()
      const currentWorld = await getWorld(currentSession.worldId)
      setSession(currentSession)
      if (currentWorld) {
        setWorld(currentWorld)
      }
    })()
  }, [])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await upsertWorld(world)
    const saved = await saveSession({
      ...session,
      worldId: world.id,
      recentTurns: Math.max(1, session.recentTurns),
    })
    setSession(saved)
    setMessage(t('context.saved'))
  }

  return (
    <section className="grid gap-3 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur animate-[revealUp_620ms_cubic-bezier(0.22,1,0.36,1)]">
      <h1 className="bg-gradient-to-r from-slate-900 via-teal-700 to-sky-600 bg-[length:200%_100%] bg-clip-text text-2xl font-semibold text-transparent animate-[shimmer_8s_linear_infinite]">
        {t('context.title')}
      </h1>
      <p className="text-sm text-slate-600">{t('context.subtitle')}</p>

      <form onSubmit={handleSave} className="grid gap-3">
        <label>
          {t('context.sessionName')}
          <input
            className="mt-1"
            value={session.name}
            onChange={(event) => setSession((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>

        <label>
          {t('context.recentTurns')}
          <input
            className="mt-1"
            type="number"
            min={1}
            max={30}
            value={session.recentTurns}
            onChange={(event) => setSession((prev) => ({ ...prev, recentTurns: Number(event.target.value) }))}
          />
        </label>

        <label>
          {t('context.worldTitle')}
          <input
            className="mt-1"
            value={world.name}
            onChange={(event) => setWorld((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>

        <label>
          {t('context.worldLore')}
          <textarea
            className="mt-1"
            rows={14}
            value={world.content}
            onChange={(event) => setWorld((prev) => ({ ...prev, content: event.target.value }))}
          />
        </label>

        <button
          className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/20"
          type="submit"
        >
          {t('context.save')}
        </button>
      </form>

      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
    </section>
  )
}
