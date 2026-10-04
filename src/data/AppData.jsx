import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, apiResult, demoMode } from '../lib/api';
import { useAuth } from './AuthContext';
import { sampleStudents, sampleTransactions } from './samples';
const DataContext = createContext(null);
const initialProducts = [{ id: 1, name: 'Bottled water', price: 25, stock: 12 }, { id: 2, name: 'Biscuits', price: 15, stock: 0 }];

// Load admin data and provide small functions for allowed database changes.
export function DataProvider({ children }) {
  const { session, admin } = useAuth();
  const [students, setStudents] = useState(demoMode ? sampleStudents : []);
  const [products, setProducts] = useState(demoMode ? initialProducts : []);
  const [transactions, setTransactions] = useState(demoMode ? sampleTransactions : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  // Fetch students, wallets, cards, product, and transaction history together.
  async function loadData() {
    const current = ++requestId.current;
    setLoading(true); setError('');
    try {
      const result = await api('/data');
      if (current !== requestId.current) return;
      setStudents(result.students); setProducts(result.products); setTransactions(result.transactions);
    } catch (failure) { if (current === requestId.current) setError(failure.message || 'Could not load data.'); }
    finally { if (current === requestId.current) setLoading(false); }
  }

  // Load after authorization and clear private data after logout.
  useEffect(() => {
    if (demoMode) return;
    if (session && admin) loadData();
    else { ++requestId.current; setStudents([]); setProducts([]); setTransactions([]); setLoading(false); setError(''); }
    return () => { ++requestId.current; };
  }, [session?.user.id, admin]);

  // Create a student and zero-balance wallet atomically on the backend.
  async function addStudent(student) {
    if (demoMode) { setStudents((rows) => [...rows, { ...student, id: crypto.randomUUID(), balance: 0, active: true }]); return; }
    const { error } = await apiResult('/students', student);
    if (error) throw error;
    await loadData();
  }

  // Change only the card's enabled state; balances are never edited here.
  async function toggleCard(student) {
    if (demoMode) { setStudents((rows) => rows.map((row) => row.id === student.id ? { ...row, active: !row.active } : row)); return; }
    const { error } = await apiResult(`/cards/${student.cardId}`, { active: !student.active });
    if (error) throw error;
    await loadData();
  }

  // Save one fixed slot without changing its number.
  async function saveProduct(id, next) {
    if (demoMode) { setProducts((rows) => rows.map((row) => row.id === id ? { ...row, ...next } : row)); return; }
    const { error } = await apiResult(`/products/${id}`, next);
    if (error) throw error;
    await loadData();
  }
  // Use the backend transaction function; never write wallet balances directly.
  async function topupWallet(input) {
    if (demoMode) {
      const student = students.find((row) => row.id === input.student);
      setStudents((rows) => rows.map((row) => row.id === input.student ? { ...row, balance: Math.round((row.balance + input.amount) * 100) / 100 } : row));
      setTransactions((rows) => [{ id: input.request_id, student: student.name, type: 'Top-up', amount: input.amount, status: 'Completed', date: new Date().toISOString(), note: 'Demo admin credit only' }, ...rows]);
      return;
    }
    const { error } = await apiResult('/topups', input);
    if (error) throw error;
    await loadData();
  }
  // Send card identifiers only to the authenticated backend encryption function.
  async function manageCard(input) {
    if (demoMode) throw new Error('Start the local server to use encrypted enrollment.');
    const data = await api('/card-management', input);
    if (['enroll', 'purchase'].includes(input.action)) await loadData();
    return data;
  }
  return <DataContext.Provider value={{ students, products, transactions, loading, error, loadData, addStudent, toggleCard, saveProduct, manageCard, topupWallet }}>{children}</DataContext.Provider>;
}

// Read shared admin data from a page.
export function useData() { return useContext(DataContext); }
