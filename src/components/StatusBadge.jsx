// Display a short status label.
export default function StatusBadge({ children }) {
  const label = { Reversed: 'Refunded', RefundPending: 'Refund pending', AwaitingPayment: 'Awaiting payment' }[children] || children;
  const tone = ['Completed', 'Active', 'Authorized', 'In stock'].includes(children) ? 'success'
    : ['AwaitingPayment', 'Dispensing', 'RefundPending', 'Pending'].includes(children) ? 'warning'
    : ['Failed', 'Disabled', 'Cancelled', 'Out of stock'].includes(children) ? 'danger'
    : ['Refunded', 'Reversed'].includes(children) ? 'info' : 'neutral';
  return <span className={`badge badge-${tone}`}><span className="status-dot" />{label}</span>;
}
