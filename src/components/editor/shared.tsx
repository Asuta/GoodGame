import type { ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

export function EditorBadge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{children}</span>
}

type CollapsiblePanelProps = {
  title: string
  subtitle?: string
  meta?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
  nested?: boolean
}

export function CollapsiblePanel({ title, subtitle, meta, open, onToggle, children, nested = false }: CollapsiblePanelProps) {
  return (
    <section className={`rounded-xl border ${nested ? 'border-slate-200 bg-slate-50/80' : 'border-slate-200 bg-white'} p-3 shadow-sm`}>
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={onToggle} type="button">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">{open ? '收起' : '展开'}</span>
          </div>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
        </div>
        {meta ? <div className="flex shrink-0 flex-wrap justify-end gap-2">{meta}</div> : null}
      </button>

      {open ? <div className={`mt-4 border-l border-slate-200 ${nested ? 'pl-3' : 'pl-4'}`}>{children}</div> : null}
    </section>
  )
}
