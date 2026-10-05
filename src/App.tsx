import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Camera, Droplet, House, Images, Plus, Settings as SettingsIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CARE } from './care'
import { Ctx, type AppCtx, type Overlay } from './ctx'
import { db, DEFAULT_SETTINGS, newId } from './db'
import { today } from './lib/date'
import { checkNotify, syncReminder } from './lib/reminder'
import { PotIcon } from './parts'
import type { CareLog } from './types'
import { CalendarView } from './views/CalendarView'
import { Home } from './views/Home'
import { JournalForm } from './views/JournalForm'
import { LogForm } from './views/LogForm'
import { PlantDetail } from './views/PlantDetail'
import { PlantForm } from './views/PlantForm'
import { SettingsView } from './views/SettingsView'
import { Timeline } from './views/Timeline'

type Tab = 'home' | 'cal' | 'tl' | 'set'
const NO_LOGS: CareLog[] = []

export default function App() {
  const plants = useLiveQuery(() => db.plants.toArray())
  const logs = useLiveQuery(() => db.logs.toArray())
  const journal = useLiveQuery(() => db.journal.toArray())
  const settings = useLiveQuery(() => db.settings.get('app').then((s) => s ?? DEFAULT_SETTINGS))

  const [tab, setTab] = useState<Tab>('home')
  const [stack, setStack] = useState<Overlay[]>([])
  const depth = useRef(0)
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; n: number } | null>(null)

  // 重ねた画面はブラウザ履歴と対応させ、端末の「戻る」で 1 枚ずつ閉じられるようにする
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      depth.current = Math.min(depth.current, e.state?.depth ?? 0)
      setStack((s) => s.slice(0, depth.current))
    }
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  const open = useCallback((o: Overlay) => {
    depth.current += 1
    history.pushState({ depth: depth.current }, '')
    setStack((s) => [...s, o])
  }, [])
  const replace = useCallback((o: Overlay) => setStack((s) => [...s.slice(0, -1), o]), [])
  const close = useCallback((n = 1) => {
    if (depth.current > 0) history.go(-Math.min(n, depth.current))
  }, [])

  const showToast = useCallback((msg: string, undo?: () => void) => setToast({ msg, undo, n: Date.now() }), [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(id)
  }, [toast])

  const byPlant = useMemo(() => {
    const m = new Map<string, CareLog[]>()
    for (const l of logs ?? []) {
      const list = m.get(l.plantId)
      if (list) list.push(l)
      else m.set(l.plantId, [l])
    }
    return m
  }, [logs])
  const logsOf = useCallback((id: string) => byPlant.get(id) ?? NO_LOGS, [byPlant])

  const record = useCallback<AppCtx['record']>(
    async (plantIds, type, date = today(), note = '') => {
      const rows = plantIds.map((plantId) => ({ id: newId(), plantId, type, date, note, at: Date.now() }))
      await db.logs.bulkAdd(rows)
      const what = plantIds.length > 1 ? `${plantIds.length}株の${CARE[type].label}` : CARE[type].label
      showToast(`${what}を記録しました`, () => db.logs.bulkDelete(rows.map((r) => r.id)))
    },
    [showToast],
  )

  useEffect(() => {
    if (plants && logs && settings) syncReminder(plants, logsOf, settings)
  }, [plants, logs, settings, logsOf])
  useEffect(() => {
    const id = setInterval(checkNotify, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!plants || !logs || !journal || !settings) return null

  const ctx: AppCtx = { plants, logs, journal, settings, logsOf, open, replace, close, record, toast: showToast }
  const tabs: [Tab, string, typeof House][] = [
    ['home', 'HOME', House],
    ['cal', 'カレンダー', CalendarDays],
    ['tl', 'タイムライン', Images],
    ['set', '設定', SettingsIcon],
  ]
  const tabBtn = ([id, label, Icon]: (typeof tabs)[number]) => (
    <button key={id} className={`nav-b ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
      <Icon size={22} />
      <span>{label}</span>
    </button>
  )

  return (
    <Ctx.Provider value={ctx}>
      <main className="page">
        {tab === 'home' && <Home />}
        {tab === 'cal' && <CalendarView />}
        {tab === 'tl' && <Timeline />}
        {tab === 'set' && <SettingsView />}
      </main>

      <nav className="nav">
        {tabs.slice(0, 2).map(tabBtn)}
        <button className="nav-add" onClick={() => open({ k: 'menu' })} aria-label="追加">
          <Plus size={26} />
        </button>
        {tabs.slice(2).map(tabBtn)}
      </nav>

      {stack.map((o, i) => {
        switch (o.k) {
          case 'menu':
            return (
              <div key={i} className="backdrop" onClick={() => close()}>
                <div className="menu" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => replace({ k: 'plantForm' })}>
                    <PotIcon /> 植物を追加
                  </button>
                  <button onClick={() => replace({ k: 'log' })}>
                    <Droplet /> ケアを記録
                  </button>
                  <button onClick={() => replace({ k: 'journal' })}>
                    <Camera /> 生長記録を書く
                  </button>
                </div>
              </div>
            )
          case 'plantForm':
            return <PlantForm key={i} id={o.id} />
          case 'plant':
            return <PlantDetail key={i} id={o.id} />
          case 'log':
            return <LogForm key={i} plantId={o.plantId} type={o.type} date={o.date} />
          case 'journal':
            return <JournalForm key={i} plantId={o.plantId} id={o.id} />
        }
      })}

      {toast && (
        <div className="toast" key={toast.n}>
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo!()
                setToast(null)
              }}
            >
              取り消す
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}
