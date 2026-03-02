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
import type { NpcData } from '@/types/game'

export default function NpcsPage() {
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
    setMessage('NPC changes saved')
  }

  function updateItem(index: number, next: NpcData) {
    setItems((prev) => prev.map((entry, itemIndex) => (itemIndex === index ? next : entry)))
  }

  return (
    <section className="panel">
      <h1>NPC State</h1>
      <p>Define NPC records and select which NPCs are active in context.</p>

      <div className="inline-controls">
        <button type="button" onClick={handleCreate}>
          Add NPC
        </button>
      </div>

      <form onSubmit={handleSave}>
        <div className="stacked-list">
          {items.map((npc, index) => (
            <article className="panel sub-panel" key={npc.id}>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={activeIds.includes(npc.id)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setActiveIds((prev) =>
                      checked ? [...new Set([...prev, npc.id])] : prev.filter((entry) => entry !== npc.id),
                    )
                  }}
                />
                Active in context
              </label>

              <div className="form-grid compact-grid">
                <label>
                  Name
                  <input
                    value={npc.name}
                    onChange={(event) => updateItem(index, { ...npc, name: event.target.value })}
                  />
                </label>

                <label>
                  Affinity
                  <input
                    type="number"
                    value={npc.affinity}
                    onChange={(event) => updateItem(index, { ...npc, affinity: Number(event.target.value) })}
                  />
                </label>

                <label>
                  History
                  <textarea
                    rows={3}
                    value={npc.history}
                    onChange={(event) => updateItem(index, { ...npc, history: event.target.value })}
                  />
                </label>

                <label>
                  Attributes
                  <textarea
                    rows={3}
                    value={npc.attributes}
                    onChange={(event) => updateItem(index, { ...npc, attributes: event.target.value })}
                  />
                </label>

                <label>
                  Skills
                  <textarea
                    rows={3}
                    value={npc.skills}
                    onChange={(event) => updateItem(index, { ...npc, skills: event.target.value })}
                  />
                </label>

                <label>
                  Status
                  <textarea
                    rows={2}
                    value={npc.status}
                    onChange={(event) => updateItem(index, { ...npc, status: event.target.value })}
                  />
                </label>

                <label>
                  Items
                  <textarea
                    rows={2}
                    value={npc.items}
                    onChange={(event) => updateItem(index, { ...npc, items: event.target.value })}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <button type="submit">Save NPC list</button>
      </form>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  )
}
