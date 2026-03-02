import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import {
  createNpc,
  ensureDefaults,
  listNpcs,
  saveSession,
  upsertNpc,
} from '@/features/storage/repository'
import { getSession } from '@/features/storage/repository'
import { useI18n } from '@/i18n/useI18n'
import type { NpcData } from '@/types/game'

export default function NpcsPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<NpcData[]>([])
  const [message, setMessage] = useState('')
  const [activeIds, setActiveIds] = useState<string[]>([])

  async function reload() {
    const [npcs, session] = await Promise.all([listNpcs(), getSession()])
    setItems(npcs)
    setActiveIds(session.activeNpcIds)
  }

  useEffect(() => {
    void (async () => {
      await ensureDefaults()
      await reload()
    })()
  }, [])

  async function handleCreate() {
    await createNpc()
    await reload()
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    await Promise.all(items.map((entry) => upsertNpc(entry)))
    await saveSession({ activeNpcIds: activeIds })
    setMessage(t('npcs.saved'))
  }

  function updateItem(index: number, next: NpcData) {
    setItems((prev) => prev.map((entry, itemIndex) => (itemIndex === index ? next : entry)))
  }

  return (
    <section className="grid gap-3 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur animate-[revealUp_620ms_cubic-bezier(0.22,1,0.36,1)]">
      <h1 className="bg-gradient-to-r from-slate-900 via-emerald-700 to-cyan-600 bg-[length:200%_100%] bg-clip-text text-2xl font-semibold text-transparent animate-[shimmer_8s_linear_infinite]">
        {t('npcs.title')}
      </h1>
      <p className="text-sm text-slate-600">{t('npcs.subtitle')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white hover:shadow"
          type="button"
          onClick={handleCreate}
        >
          {t('npcs.add')}
        </button>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid gap-3">
          {items.map((npc, index) => (
            <article className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10" key={npc.id}>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  className="size-4"
                  type="checkbox"
                  checked={activeIds.includes(npc.id)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setActiveIds((prev) =>
                      checked ? [...new Set([...prev, npc.id])] : prev.filter((entry) => entry !== npc.id),
                    )
                  }}
                />
                {t('npcs.active')}
              </label>

              <div className="grid items-start gap-2.5 md:grid-cols-2">
                <label>
                  {t('player.name')}
                  <input
                    className="mt-1"
                    value={npc.name}
                    onChange={(event) => updateItem(index, { ...npc, name: event.target.value })}
                  />
                </label>

                <label>
                  {t('npcs.affinity')}
                  <input
                    className="mt-1"
                    type="number"
                    value={npc.affinity}
                    onChange={(event) => updateItem(index, { ...npc, affinity: Number(event.target.value) })}
                  />
                </label>

                <label>
                  {t('npcs.history')}
                  <textarea
                    className="mt-1"
                    rows={3}
                    value={npc.history}
                    onChange={(event) => updateItem(index, { ...npc, history: event.target.value })}
                  />
                </label>

                <label>
                  {t('player.attributes')}
                  <textarea
                    className="mt-1"
                    rows={3}
                    value={npc.attributes}
                    onChange={(event) => updateItem(index, { ...npc, attributes: event.target.value })}
                  />
                </label>

                <label>
                  {t('player.skills')}
                  <textarea
                    className="mt-1"
                    rows={3}
                    value={npc.skills}
                    onChange={(event) => updateItem(index, { ...npc, skills: event.target.value })}
                  />
                </label>

                <label>
                  {t('player.status')}
                  <textarea
                    className="mt-1"
                    rows={2}
                    value={npc.status}
                    onChange={(event) => updateItem(index, { ...npc, status: event.target.value })}
                  />
                </label>

                <label>
                  {t('player.items')}
                  <textarea
                    className="mt-1"
                    rows={2}
                    value={npc.items}
                    onChange={(event) => updateItem(index, { ...npc, items: event.target.value })}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <button
          className="mt-3 w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/20"
          type="submit"
        >
          {t('npcs.save')}
        </button>
      </form>

      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
    </section>
  )
}
