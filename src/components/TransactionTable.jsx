import { pesos } from '../lib/format';
import StatusBadge from './StatusBadge';

// Display transaction rows or a helpful empty message.
export default function TransactionTable({ rows, onSelect }) {
  if (!rows.length) return <div className="empty-state"><h4>No transactions to show</h4><p>Activity will appear here after a top-up or purchase. Try changing the filters if you expected a record.</p></div>;
  return <div className="table-wrap"><table><thead><tr><th>Reference / date</th><th>Student</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}>
      <td><span className="reference" title={row.id}>{onSelect ? <button className="text-button" aria-label={`View transaction ${row.id}`} onClick={() => onSelect(row)}>{row.id.length > 16 ? `${row.id.slice(0, 8)}…${row.id.slice(-4)}` : row.id}</button> : row.id.length > 16 ? `${row.id.slice(0, 8)}…${row.id.slice(-4)}` : row.id}</span><small className="table-subtext">{new Date(row.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></td>
      <td>{row.student || 'QR customer'}</td><td>{row.type}<small className="table-subtext">{row.payment_method || (row.type === 'Top-up' ? 'Admin credit' : 'Card wallet')}</small></td><td className="money">{pesos(row.amount)}</td><td><StatusBadge>{row.status}</StatusBadge></td>
    </tr>)}</tbody></table></div>;
}
