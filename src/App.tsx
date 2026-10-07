import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Camera, Droplet, History, House, Images, Plus, Settings as SettingsIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CARE } from './care'
import { Ctx, type AppCtx, type Overlay } from './ctx'
import { db, DEFAULT_SETTINGS, newId } from './db'
import { today } from './lib/date'
import { checkNotify, syncReminder } from './lib/reminder'
import { careLabel } from './method'
import { PotIcon } from './parts'
import type { CareLog } from './types'
import { Archive, Snooze } from './views/Archive'
import { CalendarView } from './views/CalendarView'
import { Feedback } from './views/Feedback'
import { GroupForm } from './views/GroupForm'
import { Home } from './views/Home'
import { PastPhotos } from './views/PastPhotos'
import { JournalForm } from './views/JournalForm'
import { Lightbox } from './views/Lightbox'
import { LogForm } from './views/LogForm'
import { PlantDetail } from './views/PlantDetail'
import { PlantForm } from './views/PlantForm'
import { ReleaseNotes } from './views/ReleaseNotes'
import { SettingsView } from './views/SettingsView'
import { ShareCard } from './views/ShareCard'
import { Timeline } from './views/Timeline'

type Tab = 'home' | 'cal' | 'tl' | 'set'
const NO_LOGS: CareLog[] = []

export default function App() {
  const allPlants = useLiveQuery(() => db.plants.toArray())
  const plants = useMemo(() => allPlants?.filter((p) => !p.archivedDay), [allPlants])
  const logs = useLiveQuery(() => db.logs.toArray())
  const journal = useLiveQuery(() => db.journal.toArray())
  const groups = useLiveQuery(() => db.groups.toArray().then((g) => g.sort((a, b) => a.name.localeCompare(b.name, 'ja'))))
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

  // シートを開いている間は、うしろの画面をスクロールさせない
  useEffect(() => {
    document.body.style.overflow = stack.length ? 'hidden' : ''
  }, [stack.length])

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
      const types = Array.isArray(type) ? type : [type]
      const rows = types.flatMap((ty) => plantIds.map((plantId) => ({ id: newId(), plantId, type: ty, date, note, at: Date.now() })))
      await db.logs.bulkAdd(rows)
      // 呼び名は栽培方法に合わせる (水替え など)。呼び名の違う株が混ざるときは、ふつうの呼び名にする
      const label = types
        .map((ty) => {
          const names = new Set(plantIds.map((id) => careLabel(ty, allPlants?.find((p) => p.id === id))))
          return names.size === 1 ? [...names][0] : CARE[ty].label
        })
        .join('・')
      const what = plantIds.length > 1 ? `${plantIds.length}株の${label}` : label
      showToast(`${what}を記録しました`, () => db.logs.bulkDelete(rows.map((r) => r.id)))
    },
    [showToast, allPlants],
  )

  useEffect(() => {
    if (plants && logs && settings) syncReminder(plants, logsOf, settings)
  }, [plants, logs, settings, logsOf])
  useEffect(() => {
    const id = setInterval(checkNotify, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!allPlants || !plants || !logs || !journal || !groups || !settings) return null

  const ctx: AppCtx = { plants, allPlants, groups, logs, journal, settings, logsOf, open, replace, close, record, toast: showToast }
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
        <span className="brand">Hachi</span>
        {tab === 'home' && <Home />}
        {tab === 'cal' && <CalendarView />}
        {tab === 'tl' && <Timeline />}
        {tab === 'set' && <SettingsView />}
      </main>

      <nav className="nav">
        <div className="nav-in">
          {tabs.map(tabBtn)}
          <button className="nav-add" onClick={() => open({ k: 'menu' })}>
            <Plus size={16} strokeWidth={2.5} />
            Log
          </button>
        </div>
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
                  <button onClick={() => replace({ k: 'past' })}>
                    <History /> 過去の写真をまとめて追加
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
          case 'past':
            return <PastPhotos key={i} plantId={o.plantId} />
          case 'group':
            return <GroupForm key={i} id={o.id} />
          case 'snooze':
            return <Snooze key={i} plantId={o.plantId} />
          case 'archive':
            return <Archive key={i} />
          case 'feedback':
            return <Feedback key={i} />
          case 'releases':
            return <ReleaseNotes key={i} />
          case 'photo':
            return <Lightbox key={i} ids={o.ids} index={o.index} />
          case 'share':
            return <ShareCard key={i} plantId={o.plantId} photoId={o.photoId} />
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
