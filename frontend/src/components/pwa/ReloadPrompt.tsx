import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function ReloadPrompt() {
  const {
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        window.setInterval(() => registration.update(), 15 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  useEffect(() => {
    void updateServiceWorker(false)
  }, [updateServiceWorker])

  return null
}
