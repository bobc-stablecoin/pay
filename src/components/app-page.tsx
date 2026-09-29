import { useActiveWallet } from '@privy-io/react-auth'
import { Link } from '@tanstack/react-router'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import { type Address } from 'viem'
import { formatExact, formatToken, parseBobcAmount } from '../lib/amount'
import {
  createPaymentUri,
  parsePaymentUri,
  type PaymentRequest,
} from '../lib/qr'
import { useAppState } from '../lib/use-app-state'
import { useBobcTransaction } from '../lib/use-bobc-transaction'
import { useTransactions } from './transaction-provider'
import { ScanPanel } from './scan-panel'

type View = 'home' | 'pay' | 'receive' | 'redeem'
type AppState = ReturnType<typeof useAppState>
type TransactionActions = ReturnType<typeof useBobcTransaction>

const routes: {
  view: View
  to: '/' | '/pay' | '/receive' | '/redeem'
  label: string
}[] = [
  { view: 'home', to: '/', label: 'Home' },
  { view: 'pay', to: '/pay', label: 'Pay' },
  { view: 'receive', to: '/receive', label: 'Receive' },
  { view: 'redeem', to: '/redeem', label: 'Redeem' },
]

function Icon({ name }: { name: View }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (name === 'home')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="M9 21v-7h6v7" />
      </svg>
    )
  if (name === 'pay')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
        <path d="M8 12h8M12 8l4 4-4 4" />
      </svg>
    )
  if (name === 'receive')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM21 14v3M17 21h4M14 21v-2" />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
      <path d="M4 7h15M15 3l4 4-4 4M20 17H5M9 13l-4 4 4 4" />
    </svg>
  )
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function PageLead({
  number,
  title,
  description,
}: {
  number: string
  title: ReactNode
  description: string
}) {
  return (
    <div className="pay-page-lead">
      <p className="eyebrow">{number} / BOBC PAY</p>
      <h1 className="display">{title}</h1>
      <p className="lede">{description}</p>
    </div>
  )
}

function DeploymentNotice({ state }: { state: AppState }) {
  if (state.engineConfig.status === 'missing')
    return (
      <div className="pay-notice" role="status">
        <strong>BOBC is coming online</strong>
        <span>
          Add VITE_VAULT_ENGINE_ADDRESS to show live balances and enable
          transactions.
        </span>
      </div>
    )
  if (state.engineConfig.status === 'invalid')
    return (
      <div className="pay-notice" role="alert">
        <strong>Invalid contract address</strong>
        <span>VITE_VAULT_ENGINE_ADDRESS must be an EVM address.</span>
      </div>
    )
  if (state.deployment.isError)
    return (
      <div className="pay-notice" role="alert">
        <strong>Could not verify BOBC</strong>
        <span>
          {state.deployment.error instanceof Error
            ? state.deployment.error.message
            : 'Check the configured deployment and Arbitrum RPC.'}
        </span>
        <button
          type="button"
          className="link"
          onClick={() => void state.deployment.refetch()}
        >
          Retry
        </button>
      </div>
    )
  if (state.deployment.isPending)
    return (
      <div className="pay-notice" role="status">
        <strong>Checking BOBC deployment</strong>
        <span>
          Verifying the VaultEngine, token, and oracle on Arbitrum One.
        </span>
      </div>
    )
  return null
}

function TransactionNotice({ account }: { account?: Address }) {
  const { transactions, dismiss } = useTransactions()
  const latest = transactions.find(
    (tx) => account && tx.account.toLowerCase() === account.toLowerCase(),
  )
  if (!latest) return null
  return (
    <div className="pay-transaction" role="status" data-status={latest.status}>
      <span className="pay-tx-mark" aria-hidden="true">
        {latest.status === 'confirmed'
          ? '✓'
          : latest.status === 'reverted'
            ? '!'
            : '↗'}
      </span>
      <div>
        <strong>
          {latest.label}{' '}
          {latest.status === 'confirming' ? 'is confirming' : latest.status}
        </strong>
        <a
          href={`https://arbiscan.io/tx/${latest.hash}`}
          target="_blank"
          rel="noreferrer"
        >
          View on Arbiscan ↗
        </a>
      </div>
      <button
        type="button"
        aria-label="Dismiss transaction notice"
        onClick={() => dismiss(latest.hash)}
      >
        ×
      </button>
    </div>
  )
}

function LoginPrompt({ state, title }: { state: AppState; title: string }) {
  return (
    <div className="pay-login-panel">
      <div className="pay-login-token">
        <img src="/bobc.svg" alt="" />
      </div>
      <p className="eyebrow">YOUR BOBC WALLET</p>
      <h2>{title}</h2>
      <p>
        Sign in with email or an existing wallet to get started on Arbitrum One.
      </p>
      <button
        type="button"
        className="btn"
        onClick={() => state.privy.login()}
        disabled={!state.privy.ready}
      >
        Sign in <span aria-hidden="true">↗</span>
      </button>
    </div>
  )
}

function AppHeader({ state }: { state: AppState }) {
  const { setActiveWallet } = useActiveWallet()
  return (
    <header className="pay-header wrap">
      <Link to="/" className="pay-brand" aria-label="BOBC Pay home">
        <img src="/bobc.svg" alt="" />
        <span>
          BOBC <em>PAY</em>
        </span>
      </Link>
      <div className="pay-header-right">
        <span className="pay-chain">
          <span aria-hidden="true" /> Arbitrum One
        </span>
        {state.account ? (
          <div className="pay-account">
            <span className="pay-account-dot" aria-hidden="true" />
            <span>{shortAddress(state.account)}</span>
            {state.wallets.length > 1 ? (
              <select
                aria-label="Active wallet"
                value={state.wallet?.address ?? ''}
                onChange={(event) => {
                  const wallet = state.wallets.find(
                    (item) => item.address === event.target.value,
                  )
                  if (wallet) setActiveWallet(wallet)
                }}
              >
                {state.wallets.map((wallet) => (
                  <option key={wallet.address} value={wallet.address}>
                    {shortAddress(wallet.address)} · {wallet.meta.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={() => void state.privy.logout()}
              aria-label="Sign out"
            >
              ↗
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="pay-signin"
            onClick={() => state.privy.login()}
            disabled={!state.privy.ready}
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  )
}

function HomeView({ state }: { state: AppState }) {
  const hasAccount = Boolean(state.account)
  return (
    <>
      <PageLead
        number="01"
        title={
          <>
            Your money, <em>moving.</em>
          </>
        }
        description="BOBC in your pocket. Pay, receive, or redeem in a few taps."
      />
      <DeploymentNotice state={state} />
      {hasAccount ? (
        <>
          <section className="pay-balance-card" aria-label="Wallet balance">
            <div className="pay-balance-top">
              <span className="eyebrow">YOUR BALANCE</span>
              <img src="/bobc.svg" alt="" />
            </div>
            <div className="pay-balance-number">
              {state.balance.isLoading
                ? '—'
                : state.balance.isError
                  ? 'Unavailable'
                  : state.balance.data !== undefined
                    ? formatToken(state.balance.data)
                    : '—'}
              <small>BOBC</small>
            </div>
            <div className="pay-balance-foot">
              <span>
                {state.emailWallet
                  ? 'Email wallet · gas covered'
                  : 'External wallet · ETH for gas'}
              </span>
              <span>{state.account ? shortAddress(state.account) : ''}</span>
            </div>
          </section>
          {state.balance.isError ? (
            <p className="pay-error" role="alert">
              Balance could not load.{' '}
              <button
                className="link"
                type="button"
                onClick={() => void state.balance.refetch()}
              >
                Retry
              </button>
            </p>
          ) : null}
          <div className="pay-action-grid">
            <Link to="/pay" className="pay-action">
              <Icon name="pay" />
              <span>
                <strong>Pay BOBC</strong>
                <small>Scan a code</small>
              </span>
              <b aria-hidden="true">↗</b>
            </Link>
            <Link to="/receive" className="pay-action">
              <Icon name="receive" />
              <span>
                <strong>Receive</strong>
                <small>Show your code</small>
              </span>
              <b aria-hidden="true">↗</b>
            </Link>
            <Link to="/redeem" className="pay-action">
              <Icon name="redeem" />
              <span>
                <strong>Redeem</strong>
                <small>Get crvUSD back</small>
              </span>
              <b aria-hidden="true">↗</b>
            </Link>
          </div>
        </>
      ) : (
        <LoginPrompt state={state} title="A simpler way to use BOBC." />
      )}
    </>
  )
}

function PayView({
  state,
  actions,
}: {
  state: AppState
  actions: TransactionActions
}) {
  const [code, setCode] = useState('')
  const [payment, setPayment] = useState<PaymentRequest | null>(null)
  const [amountText, setAmountText] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [review, setReview] = useState(false)
  const amount = parseBobcAmount(amountText)
  const token = state.deployment.data?.bobc
  const onCode = useCallback(
    (value: string) => {
      setCode(value)
      setReview(false)
      if (!token) {
        setFormError('BOBC is not configured yet.')
        return
      }
      try {
        const parsed = parsePaymentUri(value, token)
        setPayment(parsed)
        setAmountText(parsed.amount ? formatExact(parsed.amount) : '')
        setFormError(null)
      } catch (error) {
        setPayment(null)
        setFormError(
          error instanceof Error ? error.message : 'Invalid payment code.',
        )
      }
    },
    [token],
  )

  const reviewPayment = (event: FormEvent) => {
    event.preventDefault()
    if (!payment) {
      setFormError('Scan or paste a payment code first.')
      return
    }
    if (!amount) {
      setFormError('Enter a valid BOBC amount.')
      return
    }
    if (state.balance.data !== undefined && amount > state.balance.data) {
      setFormError('This payment exceeds your BOBC balance.')
      return
    }
    if (payment.recipient.toLowerCase() === state.account?.toLowerCase()) {
      setFormError('Choose a recipient other than your own wallet.')
      return
    }
    setFormError(null)
    setReview(true)
  }
  const confirm = async () => {
    if (
      payment &&
      amount &&
      (await actions.sendPayment(payment.recipient, amount))
    ) {
      setReview(false)
      setPayment(null)
      setCode('')
      setAmountText('')
    }
  }
  return (
    <>
      <PageLead
        number="02"
        title={
          <>
            Pay in <em>BOBC.</em>
          </>
        }
        description="Scan a code, check the details, then send."
      />
      <DeploymentNotice state={state} />
      {!state.account ? (
        <LoginPrompt state={state} title="Sign in to make a payment." />
      ) : (
        <div className="pay-flow-grid">
          <section className="pay-panel">
            <ScanPanel onResult={onCode} />
            <div className="pay-divider">
              <span>OR PASTE A CODE</span>
            </div>
            <label className="pay-label" htmlFor="payment-code">
              Payment code or Arbitrum address
            </label>
            <div className="pay-inline">
              <input
                id="payment-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value)
                  setPayment(null)
                  setReview(false)
                  setFormError(null)
                }}
                placeholder="ethereum:… or 0x…"
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => onCode(code)}
              >
                Use code
              </button>
            </div>
          </section>
          <section className="pay-panel pay-details">
            <div className="pay-panel-head">
              <span className="eyebrow">PAYMENT DETAILS</span>
              <img src="/bobc.svg" alt="" />
            </div>
            {payment ? (
              <form onSubmit={reviewPayment}>
                <div className="pay-destination">
                  <span>TO</span>
                  <strong>{payment.recipient}</strong>
                </div>
                <label className="pay-label" htmlFor="pay-amount">
                  Amount in BOBC
                </label>
                <div className="pay-amount-input">
                  <input
                    id="pay-amount"
                    type="text"
                    inputMode="decimal"
                    value={amountText}
                    onChange={(event) => {
                      setAmountText(event.target.value)
                      setReview(false)
                      setFormError(null)
                    }}
                    placeholder="0.00"
                    aria-invalid={Boolean(formError)}
                    aria-describedby={formError ? 'pay-form-error' : undefined}
                  />
                  <span>BOBC</span>
                </div>
                <p className="pay-field-help">
                  Available:{' '}
                  {state.balance.data !== undefined
                    ? formatToken(state.balance.data)
                    : '—'}{' '}
                  BOBC
                </p>
                {formError ? (
                  <p id="pay-form-error" className="pay-error" role="alert">
                    {formError}
                  </p>
                ) : null}
                {review && amount ? (
                  <div className="pay-review">
                    <span>REVIEW PAYMENT</span>
                    <strong>{formatToken(amount, 6)} BOBC</strong>
                    <small>To {payment.recipient}</small>
                    <small>
                      Arbitrum One ·{' '}
                      {state.emailWallet
                        ? 'Gas covered'
                        : 'ETH gas paid by your wallet'}
                    </small>
                  </div>
                ) : null}
                {actions.error ? (
                  <p className="pay-error" role="alert">
                    {actions.error}
                  </p>
                ) : null}
                {review ? (
                  <button
                    className="btn pay-full"
                    type="button"
                    disabled={actions.busy || !state.deployment.data}
                    onClick={() => void confirm()}
                  >
                    {actions.busy ? 'Preparing payment…' : 'Confirm payment'}{' '}
                    <span aria-hidden="true">↗</span>
                  </button>
                ) : (
                  <button
                    className="btn pay-full"
                    type="submit"
                    disabled={!state.deployment.data}
                  >
                    Review payment <span aria-hidden="true">↗</span>
                  </button>
                )}
              </form>
            ) : (
              <div className="pay-empty-details">
                <span>01</span>
                <p>
                  Your payment details will appear here after scanning or
                  pasting a code.
                </p>
                {formError ? (
                  <p className="pay-error" role="alert">
                    {formError}
                  </p>
                ) : null}
              </div>
            )}
            {!state.emailWallet ? (
              <p className="pay-gas-note">
                Arbitrum ETH for gas:{' '}
                {state.ethBalance.data !== undefined
                  ? formatToken(state.ethBalance.data, 5)
                  : '—'}{' '}
                ETH
                {state.ethBalance.data === 0n
                  ? ' · Add ETH before paying.'
                  : ''}
              </p>
            ) : (
              <p className="pay-gas-note">
                Network fees are covered for your email wallet.
              </p>
            )}
          </section>
        </div>
      )}
    </>
  )
}

function ReceiveView({ state }: { state: AppState }) {
  const [amountText, setAmountText] = useState('')
  const [copied, setCopied] = useState(false)
  const amount = amountText.trim() ? parseBobcAmount(amountText) : undefined
  const invalid = Boolean(amountText.trim() && !amount)
  const uri =
    state.account && state.deployment.data && !invalid
      ? createPaymentUri(state.deployment.data.bobc, {
          recipient: state.account,
          amount,
        })
      : undefined
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <>
      <PageLead
        number="03"
        title={
          <>
            Receive <em>BOBC.</em>
          </>
        }
        description="Show your code or share your wallet address. The sender confirms every payment."
      />
      <DeploymentNotice state={state} />
      {!state.account ? (
        <LoginPrompt state={state} title="Sign in to receive BOBC." />
      ) : (
        <div className="pay-flow-grid pay-receive-grid">
          <section className="pay-panel pay-receive-panel">
            <span className="eyebrow">YOUR PAYMENT QR</span>
            {uri ? (
              <div className="pay-qr">
                <QRCodeSVG
                  value={uri}
                  size={244}
                  marginSize={1}
                  bgColor="#ffffff"
                  fgColor="#1f1f1f"
                  imageSettings={{
                    src: '/bobc.svg',
                    height: 36,
                    width: 36,
                    excavate: true,
                  }}
                />
              </div>
            ) : (
              <div className="pay-qr pay-qr-empty">
                BOBC QR available after deployment
              </div>
            )}
            <p>BOBC · Arbitrum One</p>
          </section>
          <section className="pay-panel pay-receive-details">
            <span className="eyebrow">REQUEST DETAILS</span>
            <h2>Ready when they are.</h2>
            <p>
              Set an amount if you want to request a specific payment. Leave it
              blank to let the sender choose.
            </p>
            <label className="pay-label" htmlFor="receive-amount">
              Request amount <span>(optional)</span>
            </label>
            <div className="pay-amount-input">
              <input
                id="receive-amount"
                type="text"
                inputMode="decimal"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                placeholder="0.00"
                aria-invalid={invalid}
                aria-describedby={invalid ? 'receive-error' : undefined}
              />
              <span>BOBC</span>
            </div>
            {invalid ? (
              <p id="receive-error" className="pay-error">
                Enter a valid BOBC amount with up to 18 decimals.
              </p>
            ) : null}
            <div className="pay-address-box">
              <span>YOUR WALLET ADDRESS</span>
              <strong>{state.account}</strong>
            </div>
            <div className="pay-copy-actions">
              <button
                type="button"
                className="btn"
                data-variant="ghost"
                onClick={() => void copy(state.account!)}
              >
                {copied ? 'Copied' : 'Copy address'}
              </button>
              {uri ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void copy(uri)}
                >
                  Copy payment link
                </button>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function RedeemView({
  state,
  actions,
}: {
  state: AppState
  actions: TransactionActions
}) {
  const [amountText, setAmountText] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [review, setReview] = useState(false)
  const amount = parseBobcAmount(amountText)
  const oracle = state.oracle.data
  const estimated =
    amount && oracle?.fresh ? (amount * 10n ** 18n) / oracle.rate : undefined
  const reviewRedemption = (event: FormEvent) => {
    event.preventDefault()
    if (!amount) {
      setFormError('Enter a valid BOBC amount.')
      return
    }
    if (state.balance.data !== undefined && amount > state.balance.data) {
      setFormError('This exceeds your BOBC balance.')
      return
    }
    if (!oracle?.fresh) {
      setFormError('The oracle rate is unavailable or stale.')
      return
    }
    setFormError(null)
    setReview(true)
  }
  const confirm = async () => {
    if (amount && (await actions.sendRedemption(amount))) {
      setReview(false)
      setAmountText('')
    }
  }
  return (
    <>
      <PageLead
        number="04"
        title={
          <>
            Back to <em>crvUSD.</em>
          </>
        }
        description="Redeem BOBC at the protocol's current oracle rate."
      />
      <DeploymentNotice state={state} />
      {!state.account ? (
        <LoginPrompt state={state} title="Sign in to redeem BOBC." />
      ) : (
        <div className="pay-flow-grid">
          <section className="pay-panel pay-redeem-form">
            <div className="pay-panel-head">
              <span className="eyebrow">YOU SEND</span>
              <img src="/bobc.svg" alt="" />
            </div>
            <form onSubmit={reviewRedemption}>
              <label className="pay-label" htmlFor="redeem-amount">
                BOBC to redeem
              </label>
              <div className="pay-amount-input">
                <input
                  id="redeem-amount"
                  type="text"
                  inputMode="decimal"
                  value={amountText}
                  onChange={(event) => {
                    setAmountText(event.target.value)
                    setReview(false)
                    setFormError(null)
                  }}
                  placeholder="0.00"
                  aria-invalid={Boolean(formError)}
                  aria-describedby={formError ? 'redeem-error' : undefined}
                />
                <span>BOBC</span>
              </div>
              <div className="pay-field-row">
                <span>
                  Available:{' '}
                  {state.balance.data !== undefined
                    ? formatToken(state.balance.data)
                    : '—'}{' '}
                  BOBC
                </span>
                <button
                  className="link"
                  type="button"
                  onClick={() => {
                    setAmountText(formatExact(state.balance.data ?? 0n))
                    setReview(false)
                  }}
                >
                  Use max
                </button>
              </div>
              {formError ? (
                <p id="redeem-error" className="pay-error" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="pay-convert-arrow" aria-hidden="true">
                ↓
              </div>
              <div className="pay-output">
                <div>
                  <span className="eyebrow">YOU RECEIVE ABOUT</span>
                  <strong>
                    {estimated !== undefined ? formatToken(estimated, 4) : '—'}
                  </strong>
                </div>
                <span className="pay-output-token">
                  <img src="/crvusd.svg" alt="" /> crvUSD
                </span>
              </div>
              <div className="pay-rate-row">
                <span>Oracle rate</span>
                <strong>
                  {oracle?.fresh
                    ? `${formatToken(oracle.rate, 4)} BOB / USD`
                    : 'Unavailable'}
                </strong>
              </div>
              <p className="pay-caveat">
                Redemption walks up to 32 positions. It can use less BOBC than
                requested, and the contract has no minimum crvUSD output.
              </p>
              {review && amount ? (
                <div className="pay-review">
                  <span>REVIEW REDEMPTION</span>
                  <strong>{formatToken(amount, 6)} BOBC</strong>
                  <small>
                    Estimated{' '}
                    {estimated !== undefined ? formatToken(estimated, 6) : '—'}{' '}
                    crvUSD
                  </small>
                  <small>
                    Arbitrum One ·{' '}
                    {state.emailWallet
                      ? 'Gas covered'
                      : 'ETH gas paid by your wallet'}
                  </small>
                </div>
              ) : null}
              {actions.error ? (
                <p className="pay-error" role="alert">
                  {actions.error}
                </p>
              ) : null}
              {review ? (
                <button
                  className="btn pay-full"
                  type="button"
                  disabled={actions.busy || !state.deployment.data}
                  onClick={() => void confirm()}
                >
                  {actions.busy
                    ? 'Preparing redemption…'
                    : 'Confirm redemption'}{' '}
                  <span aria-hidden="true">↗</span>
                </button>
              ) : (
                <button
                  className="btn pay-full"
                  type="submit"
                  disabled={!state.deployment.data}
                >
                  Review redemption <span aria-hidden="true">↗</span>
                </button>
              )}
            </form>
          </section>
          <aside className="pay-panel pay-redeem-aside">
            <span className="eyebrow">HOW IT WORKS</span>
            <div className="pay-step">
              <b>01</b>
              <span>Choose how much BOBC you want to redeem.</span>
            </div>
            <div className="pay-step">
              <b>02</b>
              <span>
                Check the current oracle estimate and review the request.
              </span>
            </div>
            <div className="pay-step">
              <b>03</b>
              <span>
                Confirm in your wallet. crvUSD arrives after the transaction
                confirms.
              </span>
            </div>
            {!state.emailWallet ? (
              <p className="pay-gas-note">
                Arbitrum ETH for gas:{' '}
                {state.ethBalance.data !== undefined
                  ? formatToken(state.ethBalance.data, 5)
                  : '—'}{' '}
                ETH
                {state.ethBalance.data === 0n
                  ? ' · Add ETH before redeeming.'
                  : ''}
              </p>
            ) : (
              <p className="pay-gas-note">
                Network fees are covered for your email wallet.
              </p>
            )}
          </aside>
        </div>
      )}
    </>
  )
}

export function AppPage({ view }: { view: View }) {
  const state = useAppState()
  const actions = useBobcTransaction(state)
  return (
    <div className="pay-shell">
      <AppHeader state={state} />
      <div className="pay-desktop-nav wrap">
        <nav aria-label="Primary navigation">
          {routes.map((route) => (
            <Link
              key={route.view}
              to={route.to}
              className={view === route.view ? 'is-active' : ''}
              aria-current={view === route.view ? 'page' : undefined}
            >
              {route.label}
            </Link>
          ))}
        </nav>
      </div>
      <main className="pay-main wrap" id="main">
        <TransactionNotice account={state.account} />
        {view === 'home' ? (
          <HomeView state={state} />
        ) : view === 'pay' ? (
          <PayView state={state} actions={actions} />
        ) : view === 'receive' ? (
          <ReceiveView state={state} />
        ) : (
          <RedeemView state={state} actions={actions} />
        )}
      </main>
      <footer className="pay-footer wrap">
        <span>BOBC PAY · ARBITRUM ONE</span>
        <span>Move with confidence.</span>
      </footer>
      <nav className="pay-mobile-nav" aria-label="Primary navigation">
        {routes.map((route) => (
          <Link
            key={route.view}
            to={route.to}
            className={view === route.view ? 'is-active' : ''}
            aria-current={view === route.view ? 'page' : undefined}
          >
            <Icon name={route.view} />
            <span>{route.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
