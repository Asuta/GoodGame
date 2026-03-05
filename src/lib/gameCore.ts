export type Operator = '>=' | '<=' | '>' | '<' | '='

export type StatDef = {
  id: string
  name: string
  min: number
  max: number
  defaultValue: number
  description: string
}

export type Effect = {
  statId: string
  delta: number
}

export type NarrativeChoice = {
  id: string
  label: string
  statId: string
  operator: Operator
  value: number
  successLines: string[]
  failLines: string[]
  successEffects: Effect[]
  failEffects: Effect[]
}

export type Narrative = {
  lines: string[]
  choices: NarrativeChoice[]
}

export type DailyAction = {
  id: string
  name: string
  description: string
  cost: number
  flavor: string
  sceneId?: string
  effects: Effect[]
  narrative?: Narrative
}

export type EventCondition = {
  statId: string
  operator: Operator
  value: number
}

export type StoryEvent = {
  id: string
  title: string
  description: string
  repeatable: boolean
  sceneId?: string
  conditions: EventCondition[]
  effects: Effect[]
  narrative?: Narrative
}

export type SceneDef = {
  id: string
  name: string
  backgroundUrl: string
  characterUrl: string
  portraitUrl: string
}

export type GameConfig = {
  title: string
  subtitle: string
  prologue: string[]
  maxEnergy: number
  defaultSceneId: string
  scenes: SceneDef[]
  stats: StatDef[]
  dailyActions: DailyAction[]
  events: StoryEvent[]
}

export type GameState = {
  day: number
  energy: number
  prologueIndex: number
  stats: Record<string, number>
  unlockedEventIds: string[]
  dailyTriggeredEventIds: string[]
  currentSceneId: string
  currentMessage: string
  log: string[]
}

export const CONFIG_STORAGE_KEY = 'daily-raising-editor-config-v2'

export const DEFAULT_CONFIG: GameConfig = {
  title: '寄宿日常',
  subtitle: '养成文字冒险编辑器 Demo',
  prologue: [
    '雨夜里，一名少女被送到你的门前。她沉默不语，只把手藏进袖口。',
    '你把热汤推到她面前，说这里至少不会有人催她做决定。',
    '她没有立刻回答，但坐下了。这是你们共同生活的第一晚。',
  ],
  maxEnergy: 3,
  defaultSceneId: 'room-night',
  scenes: [
    {
      id: 'room-night',
      name: '卧室夜晚',
      backgroundUrl: '',
      characterUrl: '',
      portraitUrl: '',
    },
    {
      id: 'street-dawn',
      name: '清晨街道',
      backgroundUrl: '',
      characterUrl: '',
      portraitUrl: '',
    },
  ],
  stats: [
    { id: 'trust', name: '信赖', min: 0, max: 100, defaultValue: 20, description: '对玩家的安全感与依赖感' },
    { id: 'health', name: '健康', min: 0, max: 100, defaultValue: 55, description: '身体状态与体力恢复能力' },
    { id: 'mood', name: '心情', min: 0, max: 100, defaultValue: 40, description: '当天情绪与积极程度' },
    { id: 'culture', name: '学识', min: 0, max: 100, defaultValue: 10, description: '识字、理解能力与见识' },
  ],
  dailyActions: [
    {
      id: 'feed',
      name: '准备晚餐',
      description: '认真准备一顿暖和的饭菜。',
      cost: 1,
      flavor: '她吃得很慢，但眼神没有一开始那样冷。',
      sceneId: 'room-night',
      effects: [
        { statId: 'health', delta: 8 },
        { statId: 'trust', delta: 4 },
        { statId: 'mood', delta: 3 },
      ],
      narrative: {
        lines: [
          '你把汤端到桌上，她先是犹豫，最后还是轻声道谢。',
          '她低头捧着碗，蒸汽遮住了她一瞬间的表情。',
          '你注意到她今天吃得比昨天多了一点。',
        ],
        choices: [
          {
            id: 'feed-talk',
            label: '问她今天的心情',
            statId: 'trust',
            operator: '>=',
            value: 35,
            successLines: ['她停顿了一下，说“今天还好”。语气比平时柔和。', '她还主动问你明天会不会下雨。'],
            failLines: ['她只是点点头，眼神又躲开了。', '房间里一下子安静下来。'],
            successEffects: [{ statId: 'trust', delta: 2 }],
            failEffects: [{ statId: 'mood', delta: -1 }],
          },
          {
            id: 'feed-praise',
            label: '夸她今天吃得很好',
            statId: 'mood',
            operator: '>=',
            value: 30,
            successLines: ['她愣了一下，小声说“我会努力把身体养好”。'],
            failLines: ['她似乎不习惯被夸奖，只抿了抿嘴。'],
            successEffects: [{ statId: 'mood', delta: 2 }],
            failEffects: [],
          },
        ],
      },
    },
    {
      id: 'talk',
      name: '聊天散步',
      description: '陪她走一段路，聊聊今天发生的事情。',
      cost: 1,
      flavor: '你听她说了很多小时候的片段。',
      sceneId: 'street-dawn',
      effects: [
        { statId: 'trust', delta: 7 },
        { statId: 'mood', delta: 5 },
      ],
      narrative: {
        lines: [
          '你们沿着街道慢慢走，她开始提起一些旧日片段。',
          '说到一半时，她突然停住，像是在确认你是否还在听。',
          '你没有打断，只安静地等她把话说完。',
        ],
        choices: [
          {
            id: 'talk-respond',
            label: '安慰她“你已经很努力了”',
            statId: 'mood',
            operator: '>=',
            value: 40,
            successLines: ['她小声笑了笑，说“那我明天也试试”。'],
            failLines: ['她没有回应，脚步反而慢了下来。'],
            successEffects: [{ statId: 'mood', delta: 2 }],
            failEffects: [{ statId: 'trust', delta: -1 }],
          },
          {
            id: 'talk-promise',
            label: '告诉她“以后我会提前回来陪你”',
            statId: 'trust',
            operator: '>=',
            value: 45,
            successLines: ['她看着你，点头说“那我会等你”。'],
            failLines: ['她低声说“嗯”，但眼神依旧戒备。'],
            successEffects: [{ statId: 'trust', delta: 3 }],
            failEffects: [{ statId: 'mood', delta: -1 }],
          },
        ],
      },
    },
    {
      id: 'study',
      name: '教她识字',
      description: '从最简单的字开始，一点点练习。',
      cost: 1,
      flavor: '她把新学到的词写在纸角，反复读了几遍。',
      sceneId: 'room-night',
      effects: [
        { statId: 'culture', delta: 8 },
        { statId: 'mood', delta: -2 },
      ],
      narrative: {
        lines: ['你把笔递给她，从最简单的词开始。', '她写得很慢，但每一笔都很认真。', '纸张很快写满了歪歪扭扭的字。'],
        choices: [
          {
            id: 'study-break',
            label: '让她休息五分钟',
            statId: 'health',
            operator: '>=',
            value: 45,
            successLines: ['她揉了揉手腕，回来后反而写得更稳了。'],
            failLines: ['她摇头说“我还能继续”，但后半段明显有些吃力。'],
            successEffects: [{ statId: 'mood', delta: 2 }],
            failEffects: [{ statId: 'health', delta: -1 }],
          },
        ],
      },
    },
    {
      id: 'care',
      name: '处理伤口',
      description: '替她更换纱布，检查今天的恢复状况。',
      cost: 1,
      flavor: '她一开始缩了缩手，后来慢慢放松下来。',
      sceneId: 'room-night',
      effects: [
        { statId: 'health', delta: 6 },
        { statId: 'trust', delta: 3 },
      ],
      narrative: {
        lines: ['你把药箱放到桌边，她明显有些紧张。', '纱布揭开时，她皱了皱眉，但没有把手抽回去。', '你轻声提醒她，疼的话就说出来。'],
        choices: [
          {
            id: 'care-gentle',
            label: '放慢动作，先安抚她',
            statId: 'trust',
            operator: '>=',
            value: 30,
            successLines: ['她点点头，小声说“这样就好”。'],
            failLines: ['她还是有些僵硬，直到包扎结束才松开拳头。'],
            successEffects: [{ statId: 'trust', delta: 2 }],
            failEffects: [],
          },
          {
            id: 'care-encourage',
            label: '鼓励她自己学会换药',
            statId: 'culture',
            operator: '>=',
            value: 20,
            successLines: ['她试着重复你的步骤，虽然笨拙但做得不错。'],
            failLines: ['她看着纱布发呆，最后还是把手递给你。'],
            successEffects: [{ statId: 'culture', delta: 2 }],
            failEffects: [{ statId: 'mood', delta: -1 }],
          },
        ],
      },
    },
  ],
  events: [
    {
      id: 'first-smile',
      title: '第一次笑容',
      description: '某个清晨，她主动向你点头并露出微笑。',
      repeatable: false,
      sceneId: 'street-dawn',
      conditions: [{ statId: 'trust', operator: '>=', value: 45 }],
      effects: [{ statId: 'mood', delta: 10 }],
      narrative: {
        lines: ['清晨的窗边，她先开口叫住你。', '“早安。”她露出你第一次见到的笑容。', '那笑容很短，却像把屋里的空气都变暖了。'],
        choices: [
          {
            id: 'first-smile-reply',
            label: '回应她“早安”',
            statId: 'trust',
            operator: '>=',
            value: 45,
            successLines: ['她轻轻点头，像是终于确认了这里是可以停留的地方。'],
            failLines: ['她笑意很快收起，只是安静地看向窗外。'],
            successEffects: [{ statId: 'trust', delta: 2 }],
            failEffects: [],
          },
          {
            id: 'first-smile-invite',
            label: '提议今天一起出门买书',
            statId: 'culture',
            operator: '>=',
            value: 18,
            successLines: ['她有点意外，但还是答应了，语气里带着期待。'],
            failLines: ['她轻轻摇头，说“今天我想先待在家里”。'],
            successEffects: [{ statId: 'mood', delta: 3 }],
            failEffects: [{ statId: 'mood', delta: -1 }],
          },
        ],
      },
    },
    {
      id: 'night-reading',
      title: '夜读邀请',
      description: '她抱着书走到你身边，问你可不可以再教她一会儿。',
      repeatable: true,
      sceneId: 'room-night',
      conditions: [
        { statId: 'culture', operator: '>=', value: 28 },
        { statId: 'trust', operator: '>=', value: 35 },
      ],
      effects: [{ statId: 'culture', delta: 4 }],
      narrative: {
        lines: ['夜深后你正准备收拾桌面，她抱着书站在门边。', '“如果不麻烦的话，能不能再教我一点？”她问。'],
        choices: [
          {
            id: 'night-reading-accept',
            label: '答应，再讲十分钟',
            statId: 'health',
            operator: '>=',
            value: 40,
            successLines: ['你们把最后一页读完，她把书抱在胸前，眼睛亮亮的。'],
            failLines: ['你虽然答应了，但她很快发现你有些疲惫，主动说今天先到这里。'],
            successEffects: [{ statId: 'trust', delta: 2 }, { statId: 'mood', delta: 2 }],
            failEffects: [{ statId: 'mood', delta: -1 }],
          },
          {
            id: 'night-reading-delay',
            label: '让她先休息，明天继续',
            statId: 'trust',
            operator: '>=',
            value: 50,
            successLines: ['她点点头，说“那明天约好了”。'],
            failLines: ['她轻声“嗯”了一下，看起来有些失落。'],
            successEffects: [{ statId: 'health', delta: 2 }],
            failEffects: [{ statId: 'mood', delta: -2 }],
          },
        ],
      },
    },
  ],
}

export function cloneConfig(config: GameConfig): GameConfig {
  return JSON.parse(JSON.stringify(config)) as GameConfig
}

export function loadConfig(): GameConfig {
  const saved = localStorage.getItem(CONFIG_STORAGE_KEY)
  if (!saved) return cloneConfig(DEFAULT_CONFIG)

  try {
    const parsed = JSON.parse(saved) as Partial<GameConfig>
    const merged: GameConfig = {
      ...cloneConfig(DEFAULT_CONFIG),
      ...parsed,
      prologue: Array.isArray(parsed.prologue) ? parsed.prologue.filter((line): line is string => typeof line === 'string') : cloneConfig(DEFAULT_CONFIG).prologue,
      scenes: Array.isArray(parsed.scenes) && parsed.scenes.length > 0 ? parsed.scenes : cloneConfig(DEFAULT_CONFIG).scenes,
      stats: Array.isArray(parsed.stats) && parsed.stats.length > 0 ? parsed.stats : cloneConfig(DEFAULT_CONFIG).stats,
      dailyActions: Array.isArray(parsed.dailyActions)
        ? parsed.dailyActions.map((action) => ({ ...action, narrative: normalizeNarrative(action.narrative) }))
        : cloneConfig(DEFAULT_CONFIG).dailyActions,
      events: Array.isArray(parsed.events)
        ? parsed.events.map((event) => ({ ...event, narrative: normalizeNarrative(event.narrative) }))
        : cloneConfig(DEFAULT_CONFIG).events,
      maxEnergy: typeof parsed.maxEnergy === 'number' ? Math.max(1, parsed.maxEnergy) : cloneConfig(DEFAULT_CONFIG).maxEnergy,
      defaultSceneId:
        typeof parsed.defaultSceneId === 'string' && parsed.defaultSceneId.length > 0
          ? parsed.defaultSceneId
          : parsed.scenes?.[0]?.id || cloneConfig(DEFAULT_CONFIG).defaultSceneId,
    }
    return merged
  } catch {
    return cloneConfig(DEFAULT_CONFIG)
  }
}

export function saveConfig(config: GameConfig) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`
}

export function buildInitialStats(config: GameConfig): Record<string, number> {
  return config.stats.reduce<Record<string, number>>((acc, stat) => {
    acc[stat.id] = clamp(stat.defaultValue, stat.min, stat.max)
    return acc
  }, {})
}

export function createInitialGameState(config: GameConfig): GameState {
  return {
    day: 1,
    energy: config.maxEnergy,
    prologueIndex: 0,
    stats: buildInitialStats(config),
    unlockedEventIds: [],
    dailyTriggeredEventIds: [],
    currentSceneId: config.defaultSceneId || config.scenes[0]?.id || '',
    currentMessage: config.prologue[0] ?? '游戏开始。',
    log: ['游戏开始。完成序章后将进入每日循环。'],
  }
}

export function applyEffects(stats: Record<string, number>, config: GameConfig, effects: Effect[]) {
  const next = { ...stats }
  effects.forEach((effect) => {
    const stat = config.stats.find((item) => item.id === effect.statId)
    if (!stat) return
    const current = next[effect.statId] ?? stat.defaultValue
    next[effect.statId] = clamp(current + effect.delta, stat.min, stat.max)
  })
  return next
}

export function evalCondition(current: number, condition: EventCondition) {
  if (condition.operator === '>=') return current >= condition.value
  if (condition.operator === '<=') return current <= condition.value
  if (condition.operator === '>') return current > condition.value
  if (condition.operator === '<') return current < condition.value
  return current === condition.value
}

export function evalChoiceCondition(stats: Record<string, number>, choice: NarrativeChoice) {
  return evalCondition(stats[choice.statId] ?? 0, {
    statId: choice.statId,
    operator: choice.operator,
    value: choice.value,
  })
}

export function normalizeNarrative(raw: Narrative | undefined): Narrative {
  return {
    lines: Array.isArray(raw?.lines) ? raw.lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0) : [],
    choices: Array.isArray(raw?.choices)
      ? raw.choices.map((choice) => ({
          id: choice.id || nextId('choice'),
          label: choice.label || '继续对话',
          statId: choice.statId || '',
          operator: choice.operator || '>=',
          value: Number(choice.value) || 0,
          successLines: Array.isArray(choice.successLines) ? choice.successLines.filter((line) => typeof line === 'string') : [],
          failLines: Array.isArray(choice.failLines) ? choice.failLines.filter((line) => typeof line === 'string') : [],
          successEffects: Array.isArray(choice.successEffects) ? choice.successEffects : [],
          failEffects: Array.isArray(choice.failEffects) ? choice.failEffects : [],
        }))
      : [],
  }
}

export function resolveTriggeredEvents(draft: GameState, config: GameConfig) {
  let stats = draft.stats
  const log = [...draft.log]
  const unlocked = [...draft.unlockedEventIds]
  const dailyTriggered = [...draft.dailyTriggeredEventIds]
  let currentSceneId = draft.currentSceneId
  let currentMessage = draft.currentMessage
  const triggeredEvents: StoryEvent[] = []

  config.events.forEach((event) => {
    const alreadyUnlocked = unlocked.includes(event.id)
    const triggeredToday = dailyTriggered.includes(event.id)
    if ((!event.repeatable && alreadyUnlocked) || (event.repeatable && triggeredToday)) return

    const matched = event.conditions.every((condition) => {
      const current = stats[condition.statId] ?? 0
      return evalCondition(current, condition)
    })

    if (!matched) return

    stats = applyEffects(stats, config, event.effects)
    log.push(`触发事件: ${event.title} - ${event.description}`)
    currentMessage = event.description
    if (event.sceneId) currentSceneId = event.sceneId
    dailyTriggered.push(event.id)
    if (!event.repeatable) unlocked.push(event.id)
    triggeredEvents.push(event)
  })

  return {
    state: {
      ...draft,
      stats,
      log,
      currentSceneId,
      currentMessage,
      unlockedEventIds: unlocked,
      dailyTriggeredEventIds: dailyTriggered,
    },
    triggeredEvents,
  }
}

export function runEventCheck(draft: GameState, config: GameConfig): GameState {
  return resolveTriggeredEvents(draft, config).state
}

export function reconcileGameState(prev: GameState, config: GameConfig): GameState {
  const nextStats = buildInitialStats(config)
  config.stats.forEach((stat) => {
    const current = prev.stats[stat.id] ?? stat.defaultValue
    nextStats[stat.id] = clamp(current, stat.min, stat.max)
  })

  const sceneExists = config.scenes.some((scene) => scene.id === prev.currentSceneId)

  return {
    ...prev,
    energy: clamp(prev.energy, 0, config.maxEnergy),
    prologueIndex: Math.min(prev.prologueIndex, config.prologue.length),
    stats: nextStats,
    currentSceneId: sceneExists ? prev.currentSceneId : config.defaultSceneId || config.scenes[0]?.id || '',
    unlockedEventIds: prev.unlockedEventIds.filter((id) => config.events.some((event) => event.id === id)),
    dailyTriggeredEventIds: prev.dailyTriggeredEventIds.filter((id) => config.events.some((event) => event.id === id)),
  }
}
