// Display a short status label.
export default function StatusBadge({ children }) {
  return <span className="badge">{children === 'Reversed' ? 'Refunded' : children === 'RefundPending' ? 'Refund pending' : children}</span>;
}
