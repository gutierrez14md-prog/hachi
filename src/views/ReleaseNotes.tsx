import { fmtFull } from '../lib/date'
import { Sheet } from '../parts'
import { RELEASES } from '../releases'

/** 版ごとの変更の記録 (新しい順) */
export function ReleaseNotes() {
  return (
    <Sheet title="リリースノート">
      <div className="releases">
        {RELEASES.map((r) => (
          <section key={r.version}>
            <header>
              <h3>{r.version}</h3>
              <time>{fmtFull(r.date)}</time>
            </header>
            <ul>
              {r.items.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  )
}
