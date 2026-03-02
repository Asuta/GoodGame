import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import {
  DEFAULT_PLAYER,
  ensureDefaults,
  getPlayer,
  getSession,
  upsertPlayer,
} from '@/features/storage/repository'
import { useI18n } from '@/i18n/useI18n'
import type { PlayerData } from '@/types/game'

export default function PlayerPage() {
  const { t } = useI18n()
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
    setMessage(t('player.saved'))
  }

  return (
    <section className="panel">
      <h1>{t('player.title')}</h1>
      <p>{t('player.subtitle')}</p>

      <form onSubmit={handleSave} className="form-grid">
        <label>
          {t('player.name')}
          <input
            value={player.name}
            onChange={(event) => setPlayer((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>

        <label>
          {t('player.attributes')}
          <textarea
            rows={4}
            value={player.attributes}
            onChange={(event) => setPlayer((prev) => ({ ...prev, attributes: event.target.value }))}
          />
        </label>

        <label>
          {t('player.skills')}
          <textarea
            rows={4}
            value={player.skills}
            onChange={(event) => setPlayer((prev) => ({ ...prev, skills: event.target.value }))}
          />
        </label>

        <label>
          {t('player.status')}
          <textarea
            rows={3}
            value={player.status}
            onChange={(event) => setPlayer((prev) => ({ ...prev, status: event.target.value }))}
          />
        </label>

        <label>
          {t('player.equipment')}
          <textarea
            rows={3}
            value={player.equipment}
            onChange={(event) => setPlayer((prev) => ({ ...prev, equipment: event.target.value }))}
          />
        </label>

        <label>
          {t('player.items')}
          <textarea
            rows={3}
            value={player.items}
            onChange={(event) => setPlayer((prev) => ({ ...prev, items: event.target.value }))}
          />
        </label>

        <button type="submit">{t('player.save')}</button>
      </form>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  )
}
