import { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_TYPING_DELAY = 32

type TypingState = {
  text: string
  visibleCount: number
}

function syncTypingState(current: TypingState, nextText: string) {
  if (current.text === nextText) return current
  if (nextText.startsWith(current.text)) {
    return {
      text: nextText,
      visibleCount: Math.min(current.visibleCount, Array.from(nextText).length),
    }
  }

  return {
    text: nextText,
    visibleCount: 0,
  }
}

export function useTypewriterText(text: string, typingDelay = DEFAULT_TYPING_DELAY) {
  const characters = useMemo(() => Array.from(text), [text])
  const [typingState, setTypingState] = useState<TypingState>(() => ({
    text,
    visibleCount: 0,
  }))
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)

    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (!characters.length || prefersReducedMotion) return

    timerRef.current = window.setInterval(() => {
      setTypingState((current) => {
        const synced = syncTypingState(current, text)

        if (synced.visibleCount >= characters.length) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current)
            timerRef.current = null
          }
          return { text, visibleCount: characters.length }
        }

        return { text, visibleCount: synced.visibleCount + 1 }
      })
    }, typingDelay)

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [characters.length, prefersReducedMotion, text, typingDelay])

  const visibleCount = prefersReducedMotion
    ? characters.length
    : syncTypingState(typingState, text).text === text
      ? Math.min(syncTypingState(typingState, text).visibleCount, characters.length)
      : 0

  const finishTyping = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTypingState({ text, visibleCount: characters.length })
  }

  return {
    displayedText: characters.slice(0, visibleCount).join(''),
    isTyping: visibleCount < characters.length,
    finishTyping,
  }
}
