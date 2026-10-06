import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

// ホームに出す今日の天気。データは Open-Meteo (無料・登録不要。CC BY 4.0 なので出典を「使い方」に書いている)。
// 場所は、設定でオンにしたときに 1 回だけ端末から取り、約 1km に丸めて端末の中に覚えておく
export type Place = { lat: number; lon: number }
export type Weather = { at: number; day: string; temp: number; humidity: number; code: number; max: number; min: number; rain: number | null }

const PLACE = 'weatherPlace'
const CACHE = 'weatherCache'
const FRESH = 30 * 60 * 1000 // 30 分は取り直さない

const read = <T>(key: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

export const getPlace = () => read<Place>(PLACE)

export function clearPlace() {
  localStorage.removeItem(PLACE)
  localStorage.removeItem(CACHE)
}

/** 現在地を取って覚える。許可されなかったときなどは理由つきで失敗する */
export function locate(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('この端末では位置情報を使えません'))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const place = { lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 }
        localStorage.setItem(PLACE, JSON.stringify(place))
        localStorage.removeItem(CACHE)
        resolve(place)
      },
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? '位置情報が許可されませんでした。端末の設定を確認してください' : '現在地を取得できませんでした')),
      { maximumAge: 600_000, timeout: 15_000 },
    )
  })
}

async function fetchWeather(place: Place): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    '&current=temperature_2m,relative_humidity_2m,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`weather ${res.status}`)
  const d = await res.json()
  return {
    at: Date.now(),
    day: d.daily.time[0],
    temp: d.current.temperature_2m,
    humidity: d.current.relative_humidity_2m,
    code: d.current.weather_code,
    max: d.daily.temperature_2m_max[0],
    min: d.daily.temperature_2m_min[0],
    rain: d.daily.precipitation_probability_max[0] ?? null,
  }
}

/**
 * 今日の天気。場所を決めていなければ null。
 * 取れるまでは前回の値 (今日のものに限る) を出し、通信できないときもそれで済ませる
 */
export function useWeather(today: string): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(() => {
    const cached = read<Weather>(CACHE)
    return cached?.day === today ? cached : null
  })
  useEffect(() => {
    const place = getPlace()
    if (!place) return setWeather(null)
    let dead = false
    const refresh = () => {
      const cached = read<Weather>(CACHE)
      if (cached?.day === today && Date.now() - cached.at < FRESH) return
      fetchWeather(place).then(
        (w) => {
          localStorage.setItem(CACHE, JSON.stringify(w))
          if (!dead) setWeather(w)
        },
        () => {}, // 圏外など。前回の値のまま
      )
    }
    refresh()
    // アプリに戻ってきたときにも、古ければ取り直す
    const onShow = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onShow)
    return () => {
      dead = true
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [today])
  return weather
}

/** WMO の天気コード → 表示 */
export function describe(code: number): { label: string; Icon: LucideIcon } {
  if (code === 0) return { label: '快晴', Icon: Sun }
  if (code <= 2) return { label: '晴れ', Icon: CloudSun }
  if (code === 3) return { label: 'くもり', Icon: Cloud }
  if (code <= 48) return { label: '霧', Icon: CloudFog }
  if (code <= 57) return { label: '霧雨', Icon: CloudDrizzle }
  if (code <= 67) return { label: '雨', Icon: CloudRain }
  if (code <= 77) return { label: '雪', Icon: CloudSnow }
  if (code <= 82) return { label: 'にわか雨', Icon: CloudRain }
  if (code <= 86) return { label: 'にわか雪', Icon: CloudSnow }
  return { label: '雷雨', Icon: CloudLightning }
}
