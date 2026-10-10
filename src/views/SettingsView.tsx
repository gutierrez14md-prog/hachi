import { Archive, Bell, ChevronDown, ChevronRight, CloudSun, Download, FlaskConical, Plus, Upload } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../ctx'
import { applyFont, applyNameFont, applyTheme, FONTS, getFont, getNameFont, getTheme, NAME_FONTS } from '../lib/appearance'
import { db } from '../db'
import { GUIDE } from '../guide'
import { VERSION } from '../releases'
import { exportBackup, importBackup } from '../lib/backup'
import { enableNotifications, testNotification } from '../lib/reminder'
import type { Settings } from '../types'
import { today } from '../lib/date'
import { heads, intervalOn } from '../lib/schedule'
import { clearPlace, getPlace, locate } from '../lib/weather'
import { careLabel, METHODS } from '../method'
import { DateInput } from '../parts'
import { MonthChips } from './CareEditor'

export function SettingsView() {
  const { settings, plants, allPlants, groups, logs, journal, toast, open } = useApp()
  const [guideOpen, setGuideOpen] = useState(false)
  const [fontOpen, setFontOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const spent = allPlants.reduce((sum, p) => sum + (p.purchasePrice ?? 0), 0)
  const showSpent = settings.showSpent ?? true
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

      {/* フォントと分類は場所を取るので、押すまで閉じておく。閉じている間は、いまの選択を右に出す */}
      <button className="fold" aria-expanded={fontOpen} onClick={() => setFontOpen((o) => !o)}>
        フォント
        <span className="fold-side">
          {FONTS.find((f) => f.id === font)?.label} / {NAME_FONTS.find((f) => f.id === nameFont)?.label}
          <ChevronDown size={18} className={fontOpen ? 'flip' : ''} />
        </span>
      </button>
      {fontOpen && (
        <>
      <h3 className="sec first">メインフォント</h3>
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

        </>
      )}

      <h3 className="sec">肥料と活力剤</h3>
      <section className="card">
        <label className="line">
          <span className="care-ic">
            <FlaskConical size={18} />
          </span>
          <span className="line-main">
            <span>
              <b>水に混ぜてあげる</b>
              <small>水やりを兼ねる。間隔を「水やり何回に1回」で選べます</small>
            </span>
          </span>
          <input type="checkbox" className="switch" checked={!!settings.careWithWater} onChange={(e) => save({ careWithWater: e.target.checked })} />
        </label>
      </section>

      <h3 className="sec">ホームの表示</h3>
      <section className="card">
        <label className="line">
          <span className="care-ic">
            <Archive size={18} />
          </span>
          <span className="line-main">
            <span>
              <b>アーカイブの株数を出す</b>
              <small>上のカードの、育てている株の下</small>
            </span>
          </span>
          <input type="checkbox" className="switch" checked={settings.showArchived ?? true} onChange={(e) => save({ showArchived: e.target.checked })} />
        </label>
      </section>

      <h3 className="sec">天気</h3>
      <section className="card">
        <label className="line">
          <span className="care-ic">
            <CloudSun size={18} />
          </span>
          <span className="line-main">
            <span>
              <b>ホームに今日の天気を出す</b>
              <small>現在地の天気・気温・湿度</small>
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
            {/* 時刻は空にできない。空にされたら、欄は前の時刻に戻る */}
            <DateInput type="time" value={settings.remindTime} onChange={(v) => v && save({ remindTime: v })} aria-label="通知する時刻" />
            <button className="btn ghost sm" onClick={testNotification}>
              テスト
            </button>
          </div>
        )}
      </section>
      {!supported && (
        <p className="hint">このブラウザでは通知を使えません。iPhone / iPad は共有メニューから「ホーム画面に追加」すると使えるようになります。</p>
      )}

      <button className="fold" aria-expanded={groupsOpen} onClick={() => setGroupsOpen((o) => !o)}>
        分類
        <span className="fold-side">
          {groups.length}件
          <ChevronDown size={18} className={groupsOpen ? 'flip' : ''} />
        </span>
      </button>
      {groupsOpen && (
      <section className="card under-fold">
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
      )}

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

      <button className="fold tight" onClick={() => open({ k: 'releases' })}>
        リリースノート
        <span className="fold-side">
          {VERSION}
          <ChevronRight size={18} />
        </span>
      </button>

      {/* 株数はホームと同じ数え方 (まとめた登録は中身を 1 株ずつ)。登録の数と違うときだけ、登録の数も添える */}
      <h3 className="sec">これまでの記録</h3>
      <section className="card">
        <div className="line stat">
          <b>植物</b>
          <span>
            {heads(plants)}株{heads(plants) !== plants.length && `（登録 ${plants.length}件）`}
          </span>
        </div>
        <div className="line stat">
          <b>ケア記録</b>
          <span>{logs.length}件</span>
        </div>
        <div className="line stat">
          <b>生長記録</b>
          <span>{journal.length}件</span>
        </div>
        <label className="line stat">
          <b>購入金額の合計</b>
          <span>{showSpent ? `¥${spent.toLocaleString('ja-JP')}` : '非表示'}</span>
          <input type="checkbox" className="switch" checked={showSpent} onChange={(e) => save({ showSpent: e.target.checked })} aria-label="購入金額の合計を表示" />
        </label>
      </section>
    </>
  )
}
