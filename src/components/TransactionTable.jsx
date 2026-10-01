import { pesos } from '../lib/format';
import StatusBadge from './StatusBadge';

// Display transaction rows or a helpful empty message.
export default function TransactionTable({ rows, onSelect }) {
  if (!rows.length) return <p>No matching transactions.</p>;
  return <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Student</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}>
      <td>{onSelect ? <button className="text-button" onClick={() => onSelect(row)}>{row.id}</button> : row.id}</td>
      <td>{row.student}</td><td>{row.type}</td><td>{pesos(row.amount)}</td><td><StatusBadge>{row.status}</StatusBadge></td>
    </tr>)}</tbody></table></div>;
}
