if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
      const checkForUpdate = () => registration.update().catch(() => undefined)
      await checkForUpdate()
      window.addEventListener('focus', checkForUpdate)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.setInterval(checkForUpdate, 15 * 60 * 1000)
    } catch (error) {
      console.warn('SRCcvde service worker registration failed', error)
    }
  })
}
