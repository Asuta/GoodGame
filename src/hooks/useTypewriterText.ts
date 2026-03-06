import { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_TYPING_DELAY = 32

export function useTypewriterText(text: string, typingDelay = DEFAULT_TYPING_DELAY) {
  const characters = useMemo(() => Array.from(text), [text])
  const [visibleCount, setVisibleCount] = useState(characters.length)
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

    if (!characters.length || prefersReducedMotion) {
      setVisibleCount(characters.length)
      return
    }

    setVisibleCount(0)

    timerRef.current = window.setInterval(() => {
      setVisibleCount((current) => {
        if (current >= characters.length) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current)
            timerRef.current = null
          }
          return current
        }

        return current + 1
      })
    }, typingDelay)

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [characters, prefersReducedMotion, typingDelay])

  const finishTyping = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setVisibleCount(characters.length)
  }

  return {
    displayedText: characters.slice(0, visibleCount).join(''),
    isTyping: visibleCount < characters.length,
    finishTyping,
  }
}
