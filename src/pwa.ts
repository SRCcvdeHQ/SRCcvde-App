if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const checkForUpdate = () => registration.update().catch(() => undefined)
      const checkForNewBuild = async () => {
        try {
          const current = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src')
          if (!current || current.startsWith('/src/')) return
          const response = await fetch('/index.html', { cache: 'no-store', headers: { 'x-srccvde-update-check': '1' } })
          if (!response.ok) return
          const html = await response.text()
          const next = new DOMParser().parseFromString(html, 'text/html').querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src')
          if (next && next !== current) window.dispatchEvent(new CustomEvent('srccvde:update-available'))
        } catch {
          // Update checks are best-effort; offline state is handled by the workspace shell.
        }
      }
      const checkEverything = () => {
        void checkForUpdate()
        void checkForNewBuild()
      }

      await checkForUpdate()
      await checkForNewBuild()
      window.addEventListener('focus', checkEverything)
      window.addEventListener('online', checkEverything)
      window.addEventListener('pageshow', event => {
        if (event.persisted) checkEverything()
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkEverything()
      })
      window.setInterval(checkEverything, 15 * 60 * 1000)
    } catch (error) {
      console.warn('SRCcvde service worker registration failed', error)
    }
  })
}
