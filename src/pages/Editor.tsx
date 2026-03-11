import { Link } from 'react-router-dom'
import { useState } from 'react'

import { ActionsTab } from '@/components/editor/ActionsTab'
import { AiTab } from '@/components/editor/AiTab'
import { BaseTab } from '@/components/editor/BaseTab'
import { DataTab } from '@/components/editor/DataTab'
import { EventsTab } from '@/components/editor/EventsTab'
import { MediaTab } from '@/components/editor/MediaTab'
import { StatsTab } from '@/components/editor/StatsTab'
import { useGameConfig } from '@/hooks/useGameConfig'
import { DEFAULT_CONFIG } from '@/lib/gameCore'

export default function Editor() {
  const { config, setConfig, resetConfig } = useGameConfig()
  const [tab, setTab] = useState<'base' | 'ai' | 'media' | 'stats' | 'actions' | 'events' | 'data'>('base')
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [openActions, setOpenActions] = useState<Record<string, boolean>>({})
  const [openActionChoices, setOpenActionChoices] = useState<Record<string, boolean>>({})
  const [openEvents, setOpenEvents] = useState<Record<string, boolean>>({})
  const [openEventChoices, setOpenEventChoices] = useState<Record<string, boolean>>({})

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-3 py-4 md:px-6 md:py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-300/40 bg-white/70 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Editor Window</p>
          <h1 className="text-xl font-semibold text-slate-800">剧情与养成编辑器</h1>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-lg bg-slate-900 px-3 py-1.5 text-white" to="/">
            回到游戏
          </Link>
          <button className="rounded-lg bg-amber-700 px-3 py-1.5 text-white" onClick={() => setConfig(DEFAULT_CONFIG)} type="button">
            载入模板
          </button>
          <button className="rounded-lg bg-slate-200 px-3 py-1.5 text-slate-800" onClick={resetConfig} type="button">
            重置配置
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-300/40 bg-white/85 p-4 shadow-xl shadow-slate-300/30 backdrop-blur md:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['base', '基础'],
            ['ai', 'AI 配置'],
            ['media', '图片场景'],
            ['stats', '属性'],
            ['actions', '日常选项'],
            ['events', '事件'],
            ['data', '数据'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`rounded-full px-3 py-1.5 text-sm ${tab === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => setTab(key as typeof tab)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'base' && <BaseTab config={config} setConfig={setConfig} />}
        {tab === 'ai' && <AiTab config={config} setConfig={setConfig} />}
        {tab === 'media' && <MediaTab config={config} setConfig={setConfig} />}
        {tab === 'stats' && <StatsTab config={config} setConfig={setConfig} />}
        {tab === 'actions' && (
          <ActionsTab
            config={config}
            setConfig={setConfig}
            openActions={openActions}
            setOpenActions={setOpenActions}
            openActionChoices={openActionChoices}
            setOpenActionChoices={setOpenActionChoices}
          />
        )}
        {tab === 'events' && (
          <EventsTab
            config={config}
            setConfig={setConfig}
            openEvents={openEvents}
            setOpenEvents={setOpenEvents}
            openEventChoices={openEventChoices}
            setOpenEventChoices={setOpenEventChoices}
          />
        )}
        {tab === 'data' && (
          <DataTab
            config={config}
            configText={JSON.stringify(config, null, 2)}
            importError={importError}
            importText={importText}
            onImportTextChange={setImportText}
            setConfig={setConfig}
            setImportError={setImportError}
          />
        )}
      </section>
    </main>
  )
}
