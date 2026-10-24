import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-ink-900)]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--color-ink-500)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-[var(--color-crimson-600)] text-white hover:bg-[var(--color-crimson-500)]",
    secondary: "border border-[var(--color-border)] bg-white text-[var(--color-ink-900)] hover:bg-[var(--color-surface)]",
    ghost: "text-[var(--color-ink-700)] hover:bg-[var(--color-surface)]",
    danger: "bg-[var(--color-danger-600)] text-white hover:opacity-90",
  };
  return <button className={clsx(base, variants[variant], className)} disabled={disabled} {...props} />;
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "navy";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-[var(--color-border)] text-[var(--color-ink-700)]",
    success: "bg-[var(--color-success-100)] text-[var(--color-success-600)]",
    warning: "bg-[var(--color-warning-100)] text-[var(--color-warning-600)]",
    danger: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
    navy: "bg-[var(--color-navy-800)] text-white",
  };
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--color-ink-700)]">{title}</p>
      {description && <p className="max-w-sm text-xs text-[var(--color-ink-500)]">{description}</p>}
    </div>
  );
}

export function StatTile({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: BadgeTone }) {
  const toneText: Record<BadgeTone, string> = {
    neutral: "text-[var(--color-ink-900)]",
    success: "text-[var(--color-success-600)]",
    warning: "text-[var(--color-warning-600)]",
    danger: "text-[var(--color-danger-600)]",
    navy: "text-[var(--color-navy-800)]",
  };
  return (
    <Card className="px-5 py-4">
      <div className="text-xs font-medium text-[var(--color-ink-500)]">{label}</div>
      <div className={clsx("mt-1 text-2xl font-semibold", toneText[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--color-ink-500)]">{hint}</div>}
    </Card>
  );
}

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={clsx("flex max-h-[85vh] w-full flex-col rounded-xl bg-white shadow-xl", wide ? "max-w-2xl" : "max-w-md")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
            ✕
          </button>
        </div>
        <div className="scroll-region flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-ink-700)]">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[var(--color-danger-600)]">{error}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-navy-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy-600)]/20",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-navy-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy-600)]/20",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-navy-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy-600)]/20",
        props.className,
      )}
    />
  );
}

export function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "danger" }) {
  return (
    <div
      role="status"
      className={clsx(
        "fixed bottom-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
        tone === "success" ? "bg-[var(--color-navy-950)] text-white" : "bg-[var(--color-danger-600)] text-white",
      )}
    >
      {message}
    </div>
  );
}
