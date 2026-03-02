import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import {
  DEFAULT_PLAYER,
  ensureDefaults,
  getPlayer,
  getSession,
  upsertPlayer,
} from '@/features/storage/repository'
import type { PlayerData } from '@/types/game'

export default function PlayerPage() {
  const [player, setPlayer] = useState<PlayerData>(DEFAULT_PLAYER)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void (async () => {
      await ensureDefaults()
      const session = await getSession()
      const current = await getPlayer(session.playerId)
      if (current) {
        setPlayer(current)
      }
    })()
  }, [])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await upsertPlayer(player)
    setMessage('Player profile saved')
  }

  return (
    <section className="panel">
      <h1>Player Character</h1>
      <p>Maintain structured player state to feed every model request.</p>

      <form onSubmit={handleSave} className="form-grid">
        <label>
          Name
          <input
            value={player.name}
            onChange={(event) => setPlayer((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>

        <label>
          Attributes
          <textarea
            rows={4}
            value={player.attributes}
            onChange={(event) => setPlayer((prev) => ({ ...prev, attributes: event.target.value }))}
          />
        </label>

        <label>
          Skills
          <textarea
            rows={4}
            value={player.skills}
            onChange={(event) => setPlayer((prev) => ({ ...prev, skills: event.target.value }))}
          />
        </label>

        <label>
          Status
          <textarea
            rows={3}
            value={player.status}
            onChange={(event) => setPlayer((prev) => ({ ...prev, status: event.target.value }))}
          />
        </label>

        <label>
          Equipment
          <textarea
            rows={3}
            value={player.equipment}
            onChange={(event) => setPlayer((prev) => ({ ...prev, equipment: event.target.value }))}
          />
        </label>

        <label>
          Items
          <textarea
            rows={3}
            value={player.items}
            onChange={(event) => setPlayer((prev) => ({ ...prev, items: event.target.value }))}
          />
        </label>

        <button type="submit">Save player</button>
      </form>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  )
}
