import { Bell, Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../ctx'
import { applyFont, applyTheme, FONTS, getFont, getTheme } from '../lib/appearance'
import { db } from '../db'
import { exportBackup, importBackup } from '../lib/backup'
import { enableNotifications, testNotification } from '../lib/reminder'
import type { Settings } from '../types'
import { MonthChips } from './PlantForm'

export function SettingsView() {
  const { settings, plants, logs, journal, toast } = useApp()
  const save = (patch: Partial<Settings>) => db.settings.put({ ...settings, ...patch })
  const supported = 'Notification' in window
  const [theme, setTheme] = useState(getTheme)
  const [font, setFont] = useState(getFont)

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
      <p className="hint">
        {supported
          ? '指定時刻以降、アプリを開いているとき (バックグラウンド含む) に通知します。Android の Chrome でホーム画面に追加している場合は、アプリを閉じていても届くことがあります。'
          : 'このブラウザでは通知を使えません。iPhone / iPad は共有メニューから「ホーム画面に追加」すると使えるようになります。'}
      </p>

      <h3 className="sec">休眠期の初期設定</h3>
      <p className="hint">新しく追加する植物の休眠期の初期値です。植物ごとに変更できます。</p>
      <MonthChips value={settings.dormantMonths} onChange={(dormantMonths) => save({ dormantMonths })} />

      <h3 className="sec">バックアップ</h3>
      <p className="hint">
        データはこの端末の中だけに保存されています。機種変更やブラウザのデータ削除に備えて、ときどき書き出しておくと安心です。
      </p>
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

      <p className="hint center">
        植物 {plants.length}株 ・ ケア記録 {logs.length}件 ・ 生長記録 {journal.length}件
      </p>
    </>
  )
}
