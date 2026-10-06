import { Bell, ChevronDown, ChevronRight, CloudSun, Download, Plus, Upload } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../ctx'
import { applyFont, applyNameFont, applyTheme, FONTS, getFont, getNameFont, getTheme, NAME_FONTS } from '../lib/appearance'
import { db } from '../db'
import { GUIDE } from '../guide'
import { exportBackup, importBackup } from '../lib/backup'
import { enableNotifications, testNotification } from '../lib/reminder'
import type { Settings } from '../types'
import { today } from '../lib/date'
import { intervalOn } from '../lib/schedule'
import { clearPlace, getPlace, locate } from '../lib/weather'
import { careLabel, METHODS } from '../method'
import { MonthChips } from './CareEditor'

export function SettingsView() {
  const { settings, plants, allPlants, groups, logs, journal, toast, open } = useApp()
  const [guideOpen, setGuideOpen] = useState(false)
  const spent = allPlants.reduce((sum, p) => sum + (p.purchasePrice ?? 0), 0)
  const save = (patch: Partial<Settings>) => db.settings.put({ ...settings, ...patch })
  const supported = 'Notification' in window
  const [theme, setTheme] = useState(getTheme)
  const [font, setFont] = useState(getFont)
  const [nameFont, setNameFont] = useState(getNameFont)

  // 天気: オンにしたとき (と「現在地に更新」) にだけ位置情報を取り、以後はその場所を使い続ける
  const [weatherOn, setWeatherOn] = useState(() => !!getPlace())
  const [locating, setLocating] = useState(false)
  const toggleWeather = async (on: boolean) => {
    if (!on) {
      clearPlace()
      return setWeatherOn(false)
    }
    setLocating(true)
    try {
      await locate()
      setWeatherOn(true)
      toast('ホームに今日の天気を出します')
    } catch (e) {
      toast((e as Error).message)
    }
    setLocating(false)
  }

  const toggleNotify = async (on: boolean) => {
    if (!on) return save({ notify: false })
    if (await enableNotifications()) await save({ notify: true })
    else toast('通知が許可されませんでした。ブラウザの設定を確認してください')
  }

  return (
    <>
      <header className="top">
        <h1>設定</h1>
      </header>

      <h3 className="sec">テーマ</h3>
      <div className="seg">
        {(['light', 'dark'] as const).map((v) => (
          <button
            key={v}
            className={theme === v ? 'on' : ''}
            onClick={() => {
              applyTheme(v)
              setTheme(v)
            }}
          >
            {v === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </div>

      <h3 className="sec">フォント</h3>
      <div className="fonts">
        {FONTS.map((f) => (
          <button
            key={f.id}
            className={font === f.id ? 'on' : ''}
            onClick={() => {
              applyFont(f.id)
              setFont(f.id)
            }}
          >
            <b>{f.label}</b>
            <small>{f.desc}</small>
          </button>
        ))}
      </div>

      <h3 className="sec">植物名のフォント</h3>
      <div className="fonts">
        {NAME_FONTS.map((f) => (
          <button
            key={f.id}
            className={nameFont === f.id ? 'on' : ''}
            onClick={() => {
              applyNameFont(f.id)
              setNameFont(f.id)
            }}
          >
            <b>{f.label}</b>
            <small>{f.desc}</small>
          </button>
        ))}
      </div>

      <h3 className="sec">天気</h3>
      <section className="card">
        <label className="line">
          <span className="care-ic">
            <CloudSun size={18} />
          </span>
          <span className="line-main">
            <span>
              <b>ホームに今日の天気を出す</b>
              <small>現在地の気温・湿度・降水確率</small>
            </span>
          </span>
          <input type="checkbox" className="switch" checked={weatherOn} disabled={locating} onChange={(e) => toggleWeather(e.target.checked)} />
        </label>
        {weatherOn && (
          <div className="line">
            <span className="line-main">
              <b>場所</b>
            </span>
            <button className="btn ghost sm" disabled={locating} onClick={() => toggleWeather(true)}>
              {locating ? '取得中…' : '現在地に更新'}
            </button>
          </div>
        )}
      </section>

      <h3 className="sec">リマインド</h3>
      <section className="card">
        <label className="line">
          <span className="care-ic">
            <Bell size={18} />
          </span>
          <span className="line-main">
            <span>
              <b>ケアの通知</b>
              <small>ケアが必要な日に 1 日 1 回お知らせ</small>
            </span>
          </span>
          <input
            type="checkbox"
            className="switch"
            disabled={!supported}
            checked={settings.notify && supported}
            onChange={(e) => toggleNotify(e.target.checked)}
          />
        </label>
        {settings.notify && supported && (
          <div className="line">
            <span className="line-main">
              <b>通知する時刻</b>
            </span>
            <input type="time" value={settings.remindTime} onChange={(e) => e.target.value && save({ remindTime: e.target.value })} />
            <button className="btn ghost sm" onClick={testNotification}>
              テスト
            </button>
          </div>
        )}
      </section>
      {!supported && (
        <p className="hint">このブラウザでは通知を使えません。iPhone / iPad は共有メニューから「ホーム画面に追加」すると使えるようになります。</p>
      )}

      <h3 className="sec">分類</h3>
      <section className="card">
        {groups.map((g) => {
          const every = intervalOn(g, g.care.water, today())
          return (
            <button className="line" key={g.id} onClick={() => open({ k: 'group', id: g.id })}>
              <span className="line-main">
                <span>
                  <b>{g.name}</b>
                  <small>{[g.method && METHODS[g.method].label, !g.care.water.enabled ? `${careLabel('water', g)}の予定なし` : every ? `${careLabel('water', g)} 今月は${every}日ごと` : `${careLabel('water', g)} 今月はお休み`].filter(Boolean).join(' ・ ')}</small>
                </span>
              </span>
              <ChevronRight size={18} className="soft" />
            </button>
          )
        })}
        <button className="line add" onClick={() => open({ k: 'group' })}>
          <Plus size={16} /> 分類を追加
        </button>
      </section>

      <h3 className="sec">休眠期の月（新しい植物の初期値）</h3>
      <MonthChips value={settings.dormantMonths} onChange={(dormantMonths) => save({ dormantMonths })} />

      <h3 className="sec">バックアップ</h3>
      <div className="row gap">
        <button className="btn ghost" onClick={exportBackup}>
          <Download size={16} /> 書き出す
        </button>
        <label className="btn ghost">
          <Upload size={16} /> 読み込む
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                toast(`${await importBackup(file)}株のデータを読み込みました`)
              } catch (err) {
                toast(err instanceof Error ? err.message : '読み込みに失敗しました')
              }
            }}
          />
        </label>
      </div>

      <button className="fold" onClick={() => open({ k: 'feedback' })}>
        リクエストを送る
        <ChevronRight size={18} />
      </button>

      {/* 説明は画面に置かず、ここにまとめる。長いので、押すまで閉じておく */}
      <button className="fold tight" aria-expanded={guideOpen} onClick={() => setGuideOpen((o) => !o)}>
        使い方
        <ChevronDown size={18} className={guideOpen ? 'flip' : ''} />
      </button>
      {guideOpen && (
        <div className="guide">
          {GUIDE.map((sec) => (
            <section key={sec.title}>
              <h4>{sec.title}</h4>
              <ul>
                {sec.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="hint center">
        植物 {plants.length}株 ・ ケア記録 {logs.length}件 ・ 生長記録 {journal.length}件
        {spent > 0 && (
          <>
            <br />
            購入金額の合計 ¥{spent.toLocaleString('ja-JP')}
          </>
        )}
      </p>
    </>
  )
}
