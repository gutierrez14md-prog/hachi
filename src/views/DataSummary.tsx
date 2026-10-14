import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../ctx'
import { dataSummary } from '../lib/summary'
import { Sheet } from '../parts'
import { VERSION } from '../releases'

/**
 * データの内訳: 登録してあるものの件数と、照合コード。
 * バックアップを読み込んだあとに、元のアプリのものと見比べて、ちゃんと戻ったかを確かめる
 */
export function DataSummary() {
  const { toast } = useApp()
  const [sum, setSum] = useState<Awaited<ReturnType<typeof dataSummary>>>()
  useEffect(() => {
    dataSummary().then(setSum)
  }, [])

  const copy = async () => {
    if (!sum) return
    try {
      await navigator.clipboard.writeText([`Hachi ${VERSION} データの内訳`, ...sum.lines].join('\n'))
      toast('内訳をコピーしました')
    } catch {
      toast('コピーできませんでした')
    }
  }

  return (
    <Sheet
      title="データの内訳"
      action={
        <button className="btn ghost" disabled={!sum} onClick={copy}>
          <Copy size={16} /> 内訳をコピー
        </button>
      }
    >
      <p className="hint lead">
        バックアップを読み込んだあとに、元のアプリとこの画面を見比べてください。照合コードが同じなら、植物・記録・写真・設定が中身までぜんぶ同じです。
      </p>
      {sum ? (
        <>
          <p className="sum-code" aria-label={`照合コード ${sum.code}`}>
            {sum.code}
          </p>
          <pre className="sum">{sum.lines.slice(2).join('\n')}</pre>
        </>
      ) : (
        <p className="none">数えています…</p>
      )}
    </Sheet>
  )
}
