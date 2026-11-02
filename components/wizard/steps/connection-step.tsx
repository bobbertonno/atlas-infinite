'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { HelpCallout, SelectField, TextField } from '@/components/lab/fields'
import { AWS_REGIONS } from '@/lib/catalog'
import type { NetworkMode } from '@/lib/types'
import type { StepProps } from '../wizard'

interface CredState {
  stored: boolean
  clientId: string
  projectId: string
  orgId: string
  dbUsername: string
  dbPasswordSet: boolean
  persistentKey: boolean
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const CHECKS = [
  { action: 'test-connection', label: 'Test API connection' },
  { action: 'validate-credentials', label: 'Validate credentials' },
  { action: 'validate-permissions', label: 'Validate project permissions' },
  { action: 'list-clusters', label: 'Retrieve existing clusters' },
  { action: 'validate-region', label: 'Validate region support' },
  { action: 'rate-limits', label: 'Check API rate limits' },
  { action: 'quotas', label: 'Check resource quotas' },
] as const

type CheckResult = { ok: boolean; message: string; clusters?: { name: string; stateName: string; tier?: string }[] }

export function ConnectionStep({ cfg, update }: StepProps) {
  const { data: creds, mutate } = useSWR<CredState>('/api/atlas/credentials', fetcher)
  const [form, setForm] = useState({ clientId: '', clientSecret: '', dbPassword: '' })
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, CheckResult>>({})
  const c = cfg.connection
  const set = <K extends keyof typeof c>(k: K, v: (typeof c)[K]) => update('connection', (p) => ({ ...p, [k]: v }))

  if (cfg.mode === 'simulation') {
    return (
      <HelpCallout title="No connection needed in Simulation Mode">
        Simulation Mode runs entirely without Atlas credentials. You can still choose the AWS region used by the cluster previews on the
        next step. Switch to Live Atlas Mode in Step 1 to configure a real Atlas project.
      </HelpCallout>
    )
  }

  const saveCreds = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/atlas/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, projectId: c.projectId, orgId: c.orgId, dbUsername: c.dbUsername }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setForm({ clientId: '', clientSecret: '', dbPassword: '' })
      await mutate()
      toast.success('Credentials stored server-side')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const run = async (action: string, extra: Record<string, string> = {}) => {
    setRunning(action)
    try {
      const res = await fetch('/api/atlas/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, region: cfg.core.region, tier: cfg.core.tier, ...extra }),
      })
      const json = (await res.json()) as CheckResult
      setResults((r) => ({ ...r, [action]: json }))
    } catch {
      setResults((r) => ({ ...r, [action]: { ok: false, message: 'Request failed.' } }))
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2">
        <h2 className="text-sm font-semibold md:col-span-2">Project</h2>
        <TextField label="Atlas Organization ID (optional)" value={c.orgId} onChange={(v) => set('orgId', v.trim())} mono placeholder="5f1b2c…" />
        <TextField
          label="Atlas Project ID"
          value={c.projectId}
          onChange={(v) => set('projectId', v.trim())}
          mono
          placeholder="24-character hex ID"
          help="Atlas UI → Project Settings → Project ID."
        />
        <SelectField label="Cloud provider" value="AWS" onChange={() => undefined} options={[{ value: 'AWS', label: 'Amazon Web Services' }]} />
        <SelectField
          label="AWS region"
          value={c.region}
          onChange={(v) => {
            set('region', v)
            update('core', (p) => ({ ...p, region: v }))
            update('infinite', (p) => ({ ...p, region: v }))
          }}
          options={AWS_REGIONS.map((r) => ({ value: r.id, label: r.label, note: r.infinite ? 'Core + Infinite' : 'Core only' }))}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
            Atlas Admin API service account
          </h2>
          {creds?.stored ? (
            <span className="flex items-center gap-2 text-xs text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Stored server-side · {creds.clientId}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not stored</span>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Client ID"
            value={form.clientId}
            onChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
            mono
            placeholder={creds?.stored ? 'Leave blank to keep current' : 'mdb_sa_id_…'}
          />
          <TextField
            label="Client secret"
            type="password"
            value={form.clientSecret}
            onChange={(v) => setForm((f) => ({ ...f, clientSecret: v }))}
            mono
            autoComplete="new-password"
            placeholder={creds?.stored ? '••••••••  (unchanged)' : 'mdb_sa_sk_…'}
          />
          <TextField
            label="Database username"
            value={c.dbUsername}
            onChange={(v) => set('dbUsername', v.trim())}
            mono
            help="Used by the lab to connect with the MongoDB Node.js driver (SCRAM-SHA-256)."
          />
          <TextField
            label="Database password (optional)"
            type="password"
            value={form.dbPassword}
            onChange={(v) => setForm((f) => ({ ...f, dbPassword: v }))}
            autoComplete="new-password"
            placeholder={creds?.dbPasswordSet ? '••••••••  (set)' : 'Leave blank to auto-generate'}
            help="If the user does not exist yet, use “Create database user” below; a strong password is generated server-side."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={saveCreds} disabled={saving || !c.projectId}>
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}
            Store credentials securely
          </Button>
          {creds?.stored ? (
            <Button
              variant="outline"
              onClick={async () => {
                await fetch('/api/atlas/credentials', { method: 'DELETE' })
                await mutate()
                setResults({})
              }}
            >
              <Trash2 data-icon="inline-start" />
              Forget credentials
            </Button>
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Credentials are encrypted with AES-256-GCM and kept in an HTTP-only, same-site cookie readable only by this app&apos;s server routes.
          They never appear in client JavaScript, API responses, logs or exported profiles.
          {creds && !creds.persistentKey
            ? ' No LAB_ENCRYPTION_KEY is configured, so an ephemeral key is used and credentials last until the server restarts.'
            : ''}
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Validation</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHECKS.map((ch) => {
            const r = results[ch.action]
            return (
              <div key={ch.action} className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{ch.label}</span>
                  <Button size="sm" variant="outline" disabled={!creds?.stored || running !== null} onClick={() => run(ch.action)}>
                    {running === ch.action ? <Loader2 className="animate-spin" /> : 'Run'}
                  </Button>
                </div>
                {r ? (
                  <p className={`flex items-start gap-1.5 text-xs ${r.ok ? 'text-primary' : 'text-destructive'}`} aria-live="polite">
                    {r.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" /> : <XCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />}
                    {r.message}
                  </p>
                ) : null}
                {r?.clusters?.length ? (
                  <ul className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
                    {r.clusters.map((cl) => (
                      <li key={cl.name}>
                        {cl.name} · {cl.stateName}
                        {cl.tier ? ` · ${cl.tier}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Network connectivity</h2>
        <SelectField<NetworkMode>
          label="Connectivity"
          value={c.networkMode}
          onChange={(v) => set('networkMode', v)}
          options={[
            { value: 'ip-access-list', label: 'IP access list' },
            { value: 'private-endpoint', label: 'AWS PrivateLink private endpoint' },
            { value: 'vpc-peering', label: 'VPC peering' },
          ]}
        />
        {c.networkMode === 'ip-access-list' ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <TextField
                label="CIDR block to allow"
                value={c.ipAccessList}
                onChange={(v) => set('ipAccessList', v.trim())}
                mono
                placeholder="203.0.113.10/32"
              />
            </div>
            <Button variant="outline" disabled={!creds?.stored || running !== null} onClick={() => run('apply-access-list', { cidr: c.ipAccessList })}>
              Add to access list
            </Button>
            <Button variant="outline" disabled={!creds?.stored || running !== null} onClick={() => run('create-db-user')}>
              Create database user
            </Button>
          </div>
        ) : null}
        {results['apply-access-list'] || results['create-db-user'] ? (
          <div className="flex flex-col gap-1 text-xs" aria-live="polite">
            {(['apply-access-list', 'create-db-user'] as const).map((k) =>
              results[k] ? (
                <p key={k} className={results[k].ok ? 'text-primary' : 'text-destructive'}>
                  {results[k].message}
                </p>
              ) : null,
            )}
          </div>
        ) : null}
        <HelpCallout title="Connectivity prerequisites for Vercel-hosted apps">
          Vercel Functions egress from a shared, dynamic IP pool, so a narrow IP access list will not match them reliably. For production
          demos use Vercel Secure Compute, which provides dedicated static egress IPs and can peer with your AWS VPC or reach an Atlas
          PrivateLink endpoint. For short-lived demos you can temporarily allow 0.0.0.0/0 on a disposable project, relying on TLS and SCRAM
          authentication. Private endpoints and VPC peering require the app to run inside a network that can route to them.
        </HelpCallout>
      </section>
    </div>
  )
}
