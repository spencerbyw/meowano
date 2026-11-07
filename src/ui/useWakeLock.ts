import { useEffect } from 'react'

/**
 * Keeps the screen awake while `active` (e.g. during a round on the music stand).
 * Browsers drop the lock when the tab is hidden, so it's re-requested on return.
 * Quietly does nothing where the Screen Wake Lock API isn't available.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    const state: { lock: WakeLockSentinel | null; cancelled: boolean } = {
      lock: null,
      cancelled: false,
    }

    const request = async () => {
      if (document.visibilityState !== 'visible' || state.lock) return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (state.cancelled) return void lock.release()
        state.lock = lock
        lock.addEventListener('release', () => (state.lock = null))
      } catch {
        // Denied (e.g. low battery mode); not worth bothering anyone about.
      }
    }

    void request()
    document.addEventListener('visibilitychange', request)
    return () => {
      state.cancelled = true
      document.removeEventListener('visibilitychange', request)
      void state.lock?.release()
    }
  }, [active])
}
