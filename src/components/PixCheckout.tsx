import { useEffect, useRef, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { CheckCircle2, Copy } from 'lucide-react'
import { api, isDemo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { brl, type Plan } from '../lib/plans'
import type { PaymentInfo } from '../lib/types'
import { ErrorNote, errMsg, Field, Modal } from './ui'

/** Máscara de CPF (11 dígitos) ou CNPJ (14) enquanto digita. */
function maskDoc(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function dateBR(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''
}

/**
 * Pagamento da mensalidade por Pix: pede nome e CPF/CNPJ, mostra o QR Code e o copia-e-cola,
 * e confere sozinho a cada poucos segundos até o pagamento ser confirmado.
 */
export function PixCheckout({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const { refresh } = useAuth()
  const [name, setName] = useState('')
  const [doc, setDoc] = useState('')
  const [pay, setPay] = useState<PaymentInfo | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const checking = useRef(false)

  // novo plano escolhido: começa do zero
  useEffect(() => {
    setPay(null)
    setQr(null)
    setError(null)
    setCopied(false)
  }, [plan?.id])

  useEffect(() => {
    if (!pay?.pixCode) return
    QRCode.toDataURL(pay.pixCode, { margin: 1, width: 360, color: { dark: '#140B16', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [pay?.pixCode])

  async function check(manual = false) {
    if (!pay || checking.current) return
    checking.current = true
    if (manual) setBusy(true)
    try {
      const next = await api.checkPayment(pay.paymentId)
      setPay(next)
      if (next.status === 'paid') await refresh()
      else if (manual) setError(next.status === 'pending' ? 'Ainda não recebemos. Se já pagou, espere alguns segundos.' : null)
    } catch (err) {
      if (manual) setError(errMsg(err))
    } finally {
      checking.current = false
      if (manual) setBusy(false)
    }
  }

  // confere sozinho enquanto o Pix está aberto (na demonstração não: lá o botão simula o pagamento)
  useEffect(() => {
    if (isDemo || pay?.status !== 'pending') return
    const t = window.setInterval(() => void check(), 5000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pay?.paymentId, pay?.status])

  async function start(e: FormEvent) {
    e.preventDefault()
    if (!plan) return
    setBusy(true)
    setError(null)
    try {
      setPay(await api.startPayment(plan.id, { name, doc }))
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!pay?.pixCode) return
    try {
      await navigator.clipboard.writeText(pay.pixCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Não deu para copiar. Toque e segure no código para copiar.')
    }
  }

  const docDigits = doc.replace(/\D/g, '').length

  return (
    <Modal open={!!plan} onClose={onClose} title={plan ? `Plano ${plan.name}` : ''}>
      {plan && !pay && (
        <form onSubmit={start} className="space-y-4">
          <p className="text-sm text-haze">
            <span className="font-display text-2xl text-bone">{brl(plan.price)}</span> por 30 dias, pago por Pix. O plano é liberado na hora em que o
            pagamento cai.
          </p>
          <Field label="Nome completo do pagador">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={3} maxLength={80} />
          </Field>
          <Field label="CPF ou CNPJ do pagador" hint="Exigido pelo Banco Central para emitir o Pix.">
            <input
              className="field"
              value={doc}
              onChange={(e) => setDoc(maskDoc(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </Field>
          <ErrorNote error={error} />
          <button className="btn-primary w-full" disabled={busy || name.trim().length < 3 || (docDigits !== 11 && docDigits !== 14)}>
            {busy ? 'Gerando Pix…' : 'Gerar Pix'}
          </button>
        </form>
      )}

      {pay && pay.status === 'paid' && (
        <div className="space-y-4 text-center">
          <CheckCircle2 size={56} className="mx-auto text-emerald-400" />
          <p className="font-display text-3xl">Pagamento confirmado</p>
          <p className="text-sm text-haze">Plano {plan?.name} ativo até {dateBR(pay.periodEnd)}.</p>
          <button className="btn-primary w-full" onClick={onClose}>
            Pronto
          </button>
        </div>
      )}

      {pay && pay.status !== 'paid' && (
        <div className="space-y-4">
          {pay.status === 'pending' ? (
            <>
              <p className="text-sm text-haze">
                Abra o app do seu banco, escolha <b className="text-bone">Pix › Pagar com QR Code</b> ou <b className="text-bone">Pix Copia e Cola</b>.
                Valor: <b className="text-bone">{brl(pay.amount)}</b>.
              </p>
              {qr && <img src={qr} alt="QR Code do Pix" className="mx-auto w-56 rounded-xl bg-white p-2" />}
              <div className="rounded-lg border border-seam bg-ink/60 p-3 font-mono text-[11px] leading-snug break-all text-haze" aria-label="Código Pix copia e cola">
                {pay.pixCode}
              </div>
              <button className="btn-primary w-full" onClick={copy}>
                <Copy size={16} /> {copied ? 'Código copiado' : 'Copiar código Pix'}
              </button>
              <p className="text-center text-xs text-haze">
                {isDemo
                  ? 'Demonstração: nenhum valor é cobrado.'
                  : `Este Pix vale até ${new Date(pay.expiresAt ?? '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Esta tela confere sozinha e avisa quando o pagamento cair.`}
              </p>
              <ErrorNote error={error} />
              <button className="btn-ghost w-full" onClick={() => void check(true)} disabled={busy}>
                {busy ? 'Conferindo…' : isDemo ? 'Simular pagamento (demonstração)' : 'Já paguei'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-haze">
                {pay.status === 'expired' ? 'Este Pix venceu sem pagamento.' : 'Este Pix não pôde ser concluído.'} Gere um novo para continuar.
              </p>
              <button className="btn-primary w-full" onClick={() => setPay(null)}>
                Gerar novo Pix
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
