import { ArchiveRestore, CalendarClock, Camera, History, MapPin, Pencil, Share2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ALL_TYPES, CARE, careVar, SCHED } from '../care'
import { useApp } from '../ctx'
import { db } from '../db'
import { fmtDay, fmtFull, today } from '../lib/date'
import { byWater, intervalOn, isSnoozed, lastDone, nextDue } from '../lib/schedule'
import { careIcon, careLabel, METHODS } from '../method'
import { DueTag, Photo, SciName, Sheet } from '../parts'
import { archiveText } from './Archive'
import { PlantCalendar } from './PlantCalendar'
import { JournalCard, sortJournal } from './Timeline'

export function PlantDetail({ id }: { id: string }) {
  const { allPlants, groups, journal, logsOf, open, record, toast } = useApp()
  const [showAll, setShowAll] = useState(false)
  const p = allPlants.find((x) => x.id === id)
  if (!p) return null
  const archived = !!p.archivedDay
  const restore = async () => {
    await db.plants.update(id, { archivedDay: undefined, archive: undefined })
    toast(`${p.name}を元に戻しました`)
  }

  const t = today()
  const logs = [...logsOf(id)].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)
  const entries = sortJournal(journal.filter((j) => j.plantId === id))
  const sched = SCHED.filter((s) => p.care[s].enabled)
  const facts = [
    ['分類', groups.find((g) => g.id === p.groupId)?.name],
    ['栽培方法', p.method && METHODS[p.method].label],
    ['入手日', p.purchaseDate && fmtFull(p.purchaseDate)],
    ['入手', p.gift && (p.giftFrom ? `${p.giftFrom}から譲り受けた` : '譲り受けた')],
    ['購入場所', p.purchasePlace],
    ['購入金額', p.purchasePrice != null && `¥${p.purchasePrice.toLocaleString('ja-JP')}`],
  ].filter((f): f is [string, string] => !!f[1])

  return (
    <Sheet
      title=""
      action={
        <>
          {archived && (
            <button className="btn ghost" onClick={restore}>
              <ArchiveRestore size={16} /> 元に戻す
            </button>
          )}
          <button className="btn ghost" onClick={() => open({ k: 'share', plantId: id })}>
            <Share2 size={16} /> 投稿用の画像
          </button>
          <button className="btn ghost" onClick={() => open({ k: 'plantForm', id })}>
            <Pencil size={16} /> 編集
          </button>
        </>
      }
    >
      <Photo id={p.photoId} className="hero" onClick={() => p.photoId && open({ k: 'photo', ids: [p.photoId], index: 0 })} />
      {archived && (
        <button className="banner" onClick={() => open({ k: 'archiveInfo', plantId: id })} aria-label="アーカイブの情報を編集">
          <span>
            {fmtFull(p.archivedDay!)} にアーカイブ{archiveText(p.archive) && ` ・ ${archiveText(p.archive)}`}
            {p.archive?.note && <small>{p.archive.note}</small>}
          </span>
          <Pencil size={14} />
        </button>
      )}
      <div className="detail-h">
        <h1>{p.name}</h1>
        {!p.members?.length && <SciName plant={p} />}
        {p.location && (
          <small>
            <MapPin size={12} /> {p.location}
          </small>
        )}
      </div>
      {p.members && p.members.length > 0 && (
        <section className="card members">
          <h3 className="card-t">植物 {p.members.length}株</h3>
          {p.members.map((m, i) => (
            <div className="line" key={i}>
              <span className="line-main">
                <span>
                  <b>{m.name || m.scientificName}</b>
                  {m.name && <SciName plant={m} />}
                  {!m.name && m.cultivar && <SciName plant={{ scientificName: '', cultivar: m.cultivar }} />}
                </span>
              </span>
            </div>
          ))}
        </section>
      )}
      {p.profile && <p className="profile">{p.profile}</p>}
      {facts.length > 0 && (
        <dl className="facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {!archived && sched.length > 0 && (
        <section className="card">
          <h3 className="card-t">次のケア</h3>
          {sched.map((s) => {
            const Icon = careIcon(s, p)
            const label = careLabel(s, p)
            const due = nextDue(p, s, logs)
            const last = lastDone(logs, s)
            const every = intervalOn(p, p.care[s], t)
            return (
              <div className="line" key={s}>
                <span className="care-ic" style={careVar(s)}>
                  <Icon size={18} />
                </span>
                <span className="line-main">
                  <span>
                    <b>
                      {label} <span className="soft">{due ? <DueTag due={due} /> : '予定なし'}</span>
                    </b>
                    <small>
                      {byWater(p, s)
                        ? `${careLabel('water', p)}${p.care[s].everyWater === 1 ? 'のたび' : `${p.care[s].everyWater}回に1回`}`
                        : every
                          ? `今月は${every}日ごと`
                          : '今月はお休み'}
                      {' ・ '}{last ? `前回 ${fmtDay(last)}` : '記録なし'}
                      {isSnoozed(p, s, due) && ' ・ 延期中'}
                    </small>
                  </span>
                </span>
                {due && due <= t && (
                  <button className="icon-btn muted" onClick={() => open({ k: 'snooze', plantId: id })} aria-label={`${label}を延期`}>
                    <CalendarClock size={18} />
                  </button>
                )}
                <button className="pill" style={careVar(s)} onClick={() => record([id], s)}>
                  記録
                </button>
              </div>
            )
          })}
        </section>
      )}

      <PlantCalendar plant={p} logs={logs} />

      {!archived && (
        <>
          <h3 className="sec">ケアを記録</h3>
          <div className="type-grid">
            {ALL_TYPES.map((ty) => {
              const Icon = careIcon(ty, p)
              const label = careLabel(ty, p)
              return (
                <button key={ty} style={careVar(ty)} onClick={() => open({ k: 'log', plantId: id, type: ty })}>
                  <span className="care-ic">
                    <Icon size={18} />
                  </span>
                  {label}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="list-head">
        <h3 className="sec">生長記録</h3>
        <span className="row">
          <button className="btn ghost sm" onClick={() => open({ k: 'past', plantId: id })}>
            <History size={15} /> 過去の写真
          </button>
          <button className="btn ghost sm" onClick={() => open({ k: 'journal', plantId: id })}>
            <Camera size={15} /> 追加
          </button>
        </span>
      </div>
      {entries.length ? (
        <div className="tl">
          {entries.map((j) => (
            <JournalCard key={j.id} entry={j} />
          ))}
        </div>
      ) : (
        <p className="none">まだ記録がありません</p>
      )}

      <h3 className="sec">ケア履歴</h3>
      {logs.length ? (
        <section className="card">
          {(showAll ? logs : logs.slice(0, 10)).map((l) => {
            const Icon = careIcon(l.type, p)
            const label = careLabel(l.type, p)
            return (
              <div className="line" key={l.id}>
                <span className="care-ic" style={careVar(l.type)}>
                  <Icon size={16} />
                </span>
                <span className="line-main">
                  <span>
                    <b>{label}</b>
                    <small>
                      {fmtDay(l.date)}
                      {l.note && ` ・ ${l.note}`}
                    </small>
                  </span>
                </span>
                <button className="icon-btn muted" onClick={() => db.logs.delete(l.id)} aria-label="記録を削除">
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
          {!showAll && logs.length > 10 && (
            <button className="btn ghost full" onClick={() => setShowAll(true)}>
              すべて表示 ({logs.length}件)
            </button>
          )}
        </section>
      ) : (
        <p className="none">まだ記録がありません</p>
      )}
    </Sheet>
  )
}
