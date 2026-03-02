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
    <section className="grid gap-3 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur animate-[revealUp_620ms_cubic-bezier(0.22,1,0.36,1)]">
      <h1 className="bg-gradient-to-r from-slate-900 via-fuchsia-700 to-sky-600 bg-[length:200%_100%] bg-clip-text text-2xl font-semibold text-transparent animate-[shimmer_8s_linear_infinite]">
        {t('player.title')}
      </h1>
      <p className="text-sm text-slate-600">{t('player.subtitle')}</p>

      <form onSubmit={handleSave} className="grid gap-3">
        <label>
          {t('player.name')}
          <input
            className="mt-1"
            value={player.name}
            onChange={(event) => setPlayer((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>

        <label>
          {t('player.attributes')}
          <textarea
            className="mt-1"
            rows={4}
            value={player.attributes}
            onChange={(event) => setPlayer((prev) => ({ ...prev, attributes: event.target.value }))}
          />
        </label>

        <label>
          {t('player.skills')}
          <textarea
            className="mt-1"
            rows={4}
            value={player.skills}
            onChange={(event) => setPlayer((prev) => ({ ...prev, skills: event.target.value }))}
          />
        </label>

        <label>
          {t('player.status')}
          <textarea
            className="mt-1"
            rows={3}
            value={player.status}
            onChange={(event) => setPlayer((prev) => ({ ...prev, status: event.target.value }))}
          />
        </label>

        <label>
          {t('player.equipment')}
          <textarea
            className="mt-1"
            rows={3}
            value={player.equipment}
            onChange={(event) => setPlayer((prev) => ({ ...prev, equipment: event.target.value }))}
          />
        </label>

        <label>
          {t('player.items')}
          <textarea
            className="mt-1"
            rows={3}
            value={player.items}
            onChange={(event) => setPlayer((prev) => ({ ...prev, items: event.target.value }))}
          />
        </label>

        <button
          className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/20"
          type="submit"
        >
          {t('player.save')}
        </button>
      </form>

      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
    </section>
  )
}
