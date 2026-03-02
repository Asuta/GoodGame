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
import type { SessionData, WorldData } from '@/types/game'

export default function ContextPage() {
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
    setMessage('World context saved')
  }

  return (
    <section className="panel">
      <h1>World & Context</h1>
      <p>Configure base lore and how many recent turns are added to each model request.</p>

      <form onSubmit={handleSave} className="form-grid">
        <label>
          Session name
          <input
            value={session.name}
            onChange={(event) => setSession((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>

        <label>
          Recent turns in context
          <input
            type="number"
            min={1}
            max={30}
            value={session.recentTurns}
            onChange={(event) => setSession((prev) => ({ ...prev, recentTurns: Number(event.target.value) }))}
          />
        </label>

        <label>
          World title
          <input
            value={world.name}
            onChange={(event) => setWorld((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>

        <label>
          World lore
          <textarea
            rows={14}
            value={world.content}
            onChange={(event) => setWorld((prev) => ({ ...prev, content: event.target.value }))}
          />
        </label>

        <button type="submit">Save context</button>
      </form>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  )
}
