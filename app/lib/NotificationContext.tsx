import React, { createContext, useContext, useState } from 'react'

export type Notice = {
  id: string
  title: string
  body: string
  at: Date
}

type Ctx = { notices: Notice[]; add: (t: string, b: string) => void }

const NotificationCtx = createContext<Ctx>({
  notices: [],
  add: () => {},
})

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notices, setNotices] = useState<Notice[]>([])

  const add = (title: string, body: string) =>
    setNotices((prev) => [
      ...prev,
      { id: Date.now().toString(), title, body, at: new Date() },
    ])

  return (
    <NotificationCtx.Provider value={{ notices, add }}>
      {children}
    </NotificationCtx.Provider>
  )
}

export const useNotifications = () => useContext(NotificationCtx)
