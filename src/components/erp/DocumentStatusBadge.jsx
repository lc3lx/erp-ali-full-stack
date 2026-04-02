const LABELS = {
  DRAFT: { text: 'مسودة', className: 'erp-badge erp-badge--draft' },
  SUBMITTED: { text: 'معلّق للموافقة', className: 'erp-badge erp-badge--pending' },
  APPROVED: { text: 'معتمد', className: 'erp-badge erp-badge--approved' },
  POSTED: { text: 'مرحّل', className: 'erp-badge erp-badge--posted' },
  PAID: { text: 'مسدد', className: 'erp-badge erp-badge--paid' },
  CANCELLED: { text: 'ملغى', className: 'erp-badge erp-badge--cancelled' },
}

export function DocumentStatusBadge({ status }) {
  const s = status && LABELS[status] ? LABELS[status] : { text: status || '—', className: 'erp-badge' }
  return (
    <span className={s.className} title={`documentStatus: ${status ?? ''}`}>
      {s.text}
    </span>
  )
}
