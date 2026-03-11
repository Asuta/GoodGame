import { useMemo, useState } from 'react'

import type { ConfigSetter } from './helpers'
import { updateConfigText } from './helpers'
import { Field } from './shared'
import { canUseAiStory, generateReskinnedConfig } from '@/lib/aiStory'
import type { GameConfig } from '@/lib/gameCore'

type PromptConfigShape = {
  title?: string
  ai?: {
    apiKey?: string
    apiBaseUrl?: string
    model?: string
  }
}

function buildReskinPrompt(configText: string, brief: string) {
  let sanitizedConfigText = configText
  let currentTitle = '当前模板'

  try {
    const parsed = JSON.parse(configText) as PromptConfigShape & Record<string, unknown>
    currentTitle = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : '当前模板'
    if (parsed.ai && typeof parsed.ai === 'object') {
      parsed.ai = {
        ...parsed.ai,
        apiKey: '',
      }
    }
    sanitizedConfigText = JSON.stringify(parsed, null, 2)
  } catch {
    currentTitle = '当前模板'
  }

  const trimmedBrief = brief.trim() || '请把它改成一个新的题材，但保留当前玩法结构。'

  return [
    '你是这个项目的内容策划兼 JSON 配置生成器。',
    '请根据下面的换皮方向，生成一份全新的 GameConfig。',
    '这个项目的运行时机制已经固定，你要改的是题材、角色、文案、事件和分支内容。',
    `当前参考模板标题：${currentTitle}`,
    `新的换皮方向：${trimmedBrief}`,
    '',
    '输出要求：',
    '1. 只返回完整 JSON，不要返回 Markdown、解释、代码块或额外说明。',
    '2. JSON 顶层结构必须与参考模板完全兼容，字段名不要改。',
    '3. 你可以重写 title、subtitle、prologue、scenes、stats、dailyActions、events，以及 ai.characterName / ai.characterProfile / ai.worldSetting / ai.promptNotes。',
    '4. 保留运行所需字段；defaultSceneId 必须指向 scenes 中真实存在的 id。',
    '5. dailyActions 和 events 中引用到的 statId、sceneId、availableTimeSlotIds 都必须能在配置里找到。',
    '6. 所有 id 使用稳定的英文或 kebab-case，避免中文 id。',
    '7. narrative.lines、choices、successLines、failLines 要与新的题材一致，不能沿用旧题材文本。',
    '8. ai.apiKey 保持空字符串；不要编造密钥。',
    '9. 如果没有必要，不要改动 apiMode、apiBaseUrl、model、reasoningEffort 这些接入字段。',
    '10. 输出结果要能直接被导入这个项目作为新的 GameConfig。',
    '',
    '下面是当前参考 JSON 模板：',
    sanitizedConfigText,
  ].join('\n')
}

type DataTabProps = {
  config: GameConfig
  configText: string
  importError: string
  importText: string
  onImportTextChange: (value: string) => void
  setConfig: ConfigSetter
  setImportError: (value: string) => void
}

export function DataTab({ config, configText, importError, importText, onImportTextChange, setConfig, setImportError }: DataTabProps) {
  const [reskinBrief, setReskinBrief] = useState('把它改成一个以女仆咖啡馆为舞台的日常养成游戏，主角是新来的店长，女主是沉默寡言但慢慢打开心扉的见习店员。')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [reskinStatus, setReskinStatus] = useState('')
  const [isReskinning, setIsReskinning] = useState(false)
  const reskinPrompt = useMemo(() => buildReskinPrompt(configText, reskinBrief), [configText, reskinBrief])
  const canRunReskin = canUseAiStory(config)

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(reskinPrompt)
      setCopyFeedback('换皮提示词已复制。')
    } catch {
      setCopyFeedback('复制失败了，可以直接手动复制下面的文本。')
    }
  }

  async function handleStartReskin() {
    if (!canRunReskin || isReskinning) return

    setReskinStatus('正在调用当前配置的 AI 模型生成新的 GameConfig...')
    setImportError('')
    setIsReskinning(true)

    try {
      const result = await generateReskinnedConfig({
        config,
        brief: reskinBrief,
      })
      onImportTextChange(result.rawText)
      updateConfigText(result.rawText, setConfig, setImportError)
      setReskinStatus('换皮完成，新的 GameConfig 已经写入下方导入区并自动应用。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '换皮失败，请稍后重试。'
      setReskinStatus(message)
    } finally {
      setIsReskinning(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm text-cyan-950">
        <p className="font-medium">这个项目本质上已经接近“配置驱动换皮”了</p>
        <p className="mt-1 text-cyan-900/80">
          下面这个提示词会把当前 JSON 结构和你的新题材要求一起打包出去。你可以把它丢给另一个模型生成新的 GameConfig，再直接粘贴回这里导入。
        </p>
      </div>

      <Field label="导出 JSON">
        <textarea readOnly rows={10} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2" value={configText} />
      </Field>

      <Field label="换皮需求 / 新题材说明">
        <textarea
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          value={reskinBrief}
          onChange={(e) => setReskinBrief(e.target.value)}
        />
      </Field>

      <Field label="生成新的 GameConfig 用提示词">
        <textarea readOnly rows={16} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2" value={reskinPrompt} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-lg bg-cyan-700 px-3 py-1.5 text-sm text-white" onClick={handleCopyPrompt} type="button">
          复制换皮提示词
        </button>
        <button
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={!canRunReskin || isReskinning}
          onClick={handleStartReskin}
          type="button"
        >
          {isReskinning ? '换皮生成中...' : '开始换皮'}
        </button>
        {copyFeedback && <p className="text-sm text-slate-600">{copyFeedback}</p>}
        {reskinStatus && <p className="text-sm text-slate-600">{reskinStatus}</p>}
      </div>
      {!canRunReskin && <p className="text-sm text-amber-700">当前 AI 配置不可用。请先在 `AI 配置` 页填好开关、Base URL、API Key 和模型名。</p>}

      <Field label="导入 JSON">
        <textarea rows={8} className="w-full rounded-lg border border-slate-300 px-3 py-2" value={importText} onChange={(e) => onImportTextChange(e.target.value)} />
      </Field>
      <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white" onClick={() => updateConfigText(importText, setConfig, setImportError)}>
        应用导入
      </button>
      {importError && <p className="text-sm text-rose-700">{importError}</p>}
    </div>
  )
}
