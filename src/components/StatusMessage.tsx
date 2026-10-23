interface StatusMessageProps {
  title: string
  detail?: string
  variant?: 'info' | 'error' | 'empty'
}

export function StatusMessage({ title, detail, variant = 'info' }: StatusMessageProps) {
  return (
    <div className={`status-message status-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <h2>{title}</h2>
      {detail ? <p>{detail}</p> : null}
    </div>
  )
}
