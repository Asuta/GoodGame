import { nextId } from '@/lib/gameCore'

import type { EditorTabProps } from './helpers'
import { Field } from './shared'

export function MediaTab({ config, setConfig }: EditorTabProps) {
  return (
    <div className="space-y-3">
      {config.scenes.map((scene) => (
        <div key={scene.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-2">
          <Field label={`场景名 (${scene.id})`}>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={scene.name}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, scenes: prev.scenes.map((item) => (item.id === scene.id ? { ...item, name: e.target.value } : item)) }))
              }
            />
          </Field>
          <Field label="背景图 URL">
            <div className="space-y-1">
              <input
                placeholder={`留空时自动读取 /images/scenes/${scene.id}/background.png`}
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={scene.backgroundUrl}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    scenes: prev.scenes.map((item) => (item.id === scene.id ? { ...item, backgroundUrl: e.target.value } : item)),
                  }))
                }
              />
              <p className="text-xs text-slate-500">可填完整 URL，或留空并把图片放到 `public/images/scenes/{scene.id}/background.png`。</p>
            </div>
          </Field>
          <Field label="角色立绘 URL">
            <div className="space-y-1">
              <input
                placeholder={`留空时自动读取 /images/scenes/${scene.id}/character.png`}
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={scene.characterUrl}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    scenes: prev.scenes.map((item) => (item.id === scene.id ? { ...item, characterUrl: e.target.value } : item)),
                  }))
                }
              />
              <p className="text-xs text-slate-500">可填完整 URL，或留空并把图片放到 `public/images/scenes/{scene.id}/character.png`。</p>
            </div>
          </Field>
          <Field label="头像 URL（预留）">
            <div className="space-y-1">
              <input
                placeholder={`留空时自动读取 /images/scenes/${scene.id}/portrait.png`}
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={scene.portraitUrl}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    scenes: prev.scenes.map((item) => (item.id === scene.id ? { ...item, portraitUrl: e.target.value } : item)),
                  }))
                }
              />
              <p className="text-xs text-slate-500">可填完整 URL，或留空并把图片放到 `public/images/scenes/{scene.id}/portrait.png`。</p>
            </div>
          </Field>
          <button
            className="h-fit rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700"
            onClick={() => setConfig((prev) => ({ ...prev, scenes: prev.scenes.filter((item) => item.id !== scene.id) }))}
          >
            删除场景
          </button>
        </div>
      ))}
      <button
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
        onClick={() =>
          setConfig((prev) => ({
            ...prev,
            scenes: [...prev.scenes, { id: nextId('scene'), name: '新场景', backgroundUrl: '', characterUrl: '', portraitUrl: '' }],
          }))
        }
      >
        新增场景
      </button>
    </div>
  )
}
