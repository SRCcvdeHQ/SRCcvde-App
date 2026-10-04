if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      let reloading = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return
        reloading = true
        window.location.reload()
      })

      const registration = await navigator.serviceWorker.register('/sw.js')
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
