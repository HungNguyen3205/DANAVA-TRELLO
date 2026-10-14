import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setNeedRefresh(false)
  }

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-card border border-border shadow-lg rounded-lg p-4 max-w-sm">
      <div className="mb-3 text-sm">
        <strong className="block mb-1 text-foreground">Đã có phiên bản mới!</strong>
        <span className="text-muted-foreground">Vui lòng tải lại trang để cập nhật giao diện mới nhất.</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Tải lại ngay
        </button>
        <button
          onClick={close}
          className="bg-accent text-accent-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-accent/80"
        >
          Bỏ qua
        </button>
      </div>
    </div>
  )
}
