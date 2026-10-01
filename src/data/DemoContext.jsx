import { createContext, useContext, useState } from 'react';
const DemoContext = createContext(null);
const sampleStudents = [
  { id: 'demo-1', name: 'Ana Demo', number: 'DEMO-001', card: 'TEST-001', balance: 75, active: true },
  { id: 'demo-2', name: 'Ben Demo', number: 'DEMO-002', card: 'TEST-002', balance: 50, active: true },
];
export const sampleTransactions = [
  { id: 'DEMO-T03', student: 'Ben Demo', type: 'Purchase', amount: 25, status: 'Failed', date: '2026-10-01T09:15:00Z', note: 'Example: no dispense detected; charge reversed.' },
  { id: 'DEMO-T02', student: 'Ana Demo', type: 'Purchase', amount: 25, status: 'Completed', date: '2026-10-01T09:10:00Z', note: 'Example: product dispensed successfully.' },
  { id: 'DEMO-T01', student: 'Ana Demo', type: 'Top-up', amount: 100, status: 'Completed', date: '2026-10-01T09:00:00Z', note: 'Sample data only; no Maya payment was made.' },
];

// Share temporary sample data across the admin pages; refreshing resets it.
export function DemoProvider({ children }) {
  const [students, setStudents] = useState(sampleStudents);
  const [product, setProduct] = useState({ name: 'Bottled water', price: 25, stock: 12 });
  return <DemoContext.Provider value={{ students, setStudents, product, setProduct }}>{children}</DemoContext.Provider>;
}

// Access the shared sample data from a page.
export function useDemo() {
  return useContext(DemoContext);
}
