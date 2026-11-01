import { Download, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert, Button, Input, Modal } from '../components/ui'

const VARIANTS = ['primary', 'secondary', 'danger', 'outline']
const SIZES = ['sm', 'md', 'lg']

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Label({ children }) {
  return (
    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
      {children}
    </p>
  )
}

function fakeRequest(shouldSucceed) {
  return new Promise((resolve, reject) =>
    setTimeout(() => (shouldSucceed ? resolve() : reject(new Error('Network error'))), 1200),
  )
}

export default function Preview() {
  const [infoOpen, setInfoOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [name, setName] = useState('')

  function handleDelete() {
    setDeleting(true)
    setTimeout(() => {
      setDeleting(false)
      setConfirmOpen(false)
      toast.success('Project deleted')
    }, 1200)
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">UI Components</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Every reusable component in <code className="font-mono text-xs">src/components/ui</code>, in all
        variants. Toggle the theme to check dark mode.
      </p>

      <div className="mt-8 space-y-8">
        <Section
          title="Button"
          description="Import from components/ui. Supports variant, size, icon, loading, fullWidth, and all native button props."
        >
          <div className="space-y-6">
            <div>
              <Label>Variants</Label>
              <div className="flex flex-wrap gap-3">
                {VARIANTS.map((variant) => (
                  <Button key={variant} variant={variant}>
                    {variant[0].toUpperCase() + variant.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Sizes</Label>
              <div className="flex flex-wrap items-center gap-3">
                {SIZES.map((size) => (
                  <Button key={size} size={size}>
                    Size {size}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>With icons</Label>
              <div className="flex flex-wrap gap-3">
                <Button icon={Plus}>New project</Button>
                <Button variant="secondary" icon={Download}>
                  Export
                </Button>
                <Button variant="danger" icon={Trash2}>
                  Delete
                </Button>
              </div>
            </div>
            <div>
              <Label>States</Label>
              <div className="flex flex-wrap gap-3">
                <Button loading loadingText="Saving…">
                  Save
                </Button>
                <Button variant="outline" loading>
                  Loading
                </Button>
                {VARIANTS.map((variant) => (
                  <Button key={variant} variant={variant} disabled>
                    Disabled
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Input" description="Label, hint, error, required, and disabled states with accessible wiring.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Project name"
              placeholder="My awesome app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint={`${name.length}/40 characters`}
              maxLength={40}
            />
            <Input label="Email" type="email" placeholder="you@example.com" required />
            <Input label="Username" defaultValue="taken_name" error="That username is already taken." />
            <Input label="Organization" defaultValue="Acme Inc." disabled hint="Managed by your admin." />
          </div>
        </Section>

        <Section title="Alert" description="success, error, and warning variants, with optional title and dismiss button.">
          <div className="space-y-3">
            <Alert variant="success">Your changes have been saved.</Alert>
            <Alert variant="error">Incorrect email or password.</Alert>
            <Alert variant="warning">Your session expires in 5 minutes.</Alert>
            <Alert variant="success" title="Deployment complete">
              Version 1.4.0 is now live in production.
            </Alert>
            <Alert variant="error" title="Payment failed">
              Your card was declined. Update your billing details to continue.
            </Alert>
            {dismissed ? (
              <Button variant="outline" size="sm" onClick={() => setDismissed(false)}>
                Restore dismissible alert
              </Button>
            ) : (
              <Alert variant="warning" title="Dismissible" onDismiss={() => setDismissed(true)}>
                Click the × to hide this alert.
              </Alert>
            )}
          </div>
        </Section>

        <Section
          title="Modal"
          description="Rendered in a portal. Closes on backdrop click, the × button, or Escape. Traps focus and restores it on close."
        >
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setInfoOpen(true)}>
              Open basic modal
            </Button>
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
              Open confirm modal
            </Button>
          </div>
        </Section>

        <Section
          title="Toast"
          description="Global notifications via sonner. Import { toast } from 'sonner' anywhere; the Toaster follows the app theme."
        >
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast.success('Changes saved')}>
              Success
            </Button>
            <Button variant="outline" onClick={() => toast.error('Something went wrong')}>
              Error
            </Button>
            <Button variant="outline" onClick={() => toast.warning('Your trial ends in 3 days')}>
              Warning
            </Button>
            <Button variant="outline" onClick={() => toast.info('A new version is available')}>
              Info
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast('File moved to trash', {
                  action: { label: 'Undo', onClick: () => toast.success('Restored') },
                })
              }
            >
              With action
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.promise(fakeRequest(Math.random() > 0.3), {
                  loading: 'Uploading…',
                  success: 'Upload complete',
                  error: 'Upload failed',
                })
              }
            >
              Promise
            </Button>
          </div>
        </Section>
      </div>

      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Welcome to Zero-to-Launch"
        footer={<Button onClick={() => setInfoOpen(false)}>Got it</Button>}
      >
        This boilerplate ships with FastAPI, SQLAlchemy, React, and Tailwind wired together, plus a
        small UI kit you can extend.
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        title="Delete project?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} loadingText="Deleting…">
              Delete
            </Button>
          </>
        }
      >
        This action cannot be undone. All data associated with this project will be permanently
        removed.
      </Modal>
    </>
  )
}
