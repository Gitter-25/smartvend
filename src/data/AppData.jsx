import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, demoMode } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { sampleStudents, sampleTransactions } from './samples';
const DataContext = createContext(null);
const initialProduct = { name: 'Bottled water', price: 25, stock: 12 };

// Load admin data and provide small functions for allowed database changes.
export function DataProvider({ children }) {
  const { session, admin } = useAuth();
  const [students, setStudents] = useState(demoMode ? sampleStudents : []);
  const [product, setProduct] = useState(demoMode ? initialProduct : null);
  const [transactions, setTransactions] = useState(demoMode ? sampleTransactions : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  // Fetch students, wallets, cards, product, and transaction history together.
  async function loadData() {
    const current = ++requestId.current;
    setLoading(true); setError('');
    try {
      const results = await Promise.all([
        supabase.from('students').select('id,name,number,wallets(balance),cards(id,active)').order('created_at'),
        supabase.from('products').select('name,price,stock').eq('id', 1).single(),
        supabase.from('transactions').select('id,type,amount,status,created_at,note,students(name)').order('created_at', { ascending: false }).limit(100),
      ]);
      if (current !== requestId.current) return;
      const failure = results.find((result) => result.error);
      if (failure) throw failure.error;
      setStudents(results[0].data.map((row) => ({ ...row, balance: Number(row.wallets?.balance ?? 0), cardId: row.cards?.id, active: row.cards?.active ?? false })));
      setProduct({ ...results[1].data, price: Number(results[1].data.price) });
      setTransactions(results[2].data.map((row) => ({ ...row, student: row.students?.name ?? 'Unknown', amount: Number(row.amount), date: row.created_at })));
    } catch (failure) { if (current === requestId.current) setError(failure.message || 'Could not load data.'); }
    finally { if (current === requestId.current) setLoading(false); }
  }

  // Load after authorization and clear private data after logout.
  useEffect(() => {
    if (demoMode) return;
    if (session && admin) loadData();
    else { ++requestId.current; setStudents([]); setProduct(null); setTransactions([]); setLoading(false); setError(''); }
    return () => { ++requestId.current; };
  }, [session?.user.id, admin]);

  // Create a student and zero-balance wallet atomically on the backend.
  async function addStudent(student) {
    if (demoMode) { setStudents((rows) => [...rows, { ...student, id: crypto.randomUUID(), balance: 0, active: true }]); return; }
    const { error } = await supabase.rpc('register_student', { student_name: student.name, student_number: student.number });
    if (error) throw error;
    await loadData();
  }

  // Change only the card's enabled state; balances are never edited here.
  async function toggleCard(student) {
    if (demoMode) { setStudents((rows) => rows.map((row) => row.id === student.id ? { ...row, active: !row.active } : row)); return; }
    const { error } = await supabase.from('cards').update({ active: !student.active }).eq('id', student.cardId).select('id').single();
    if (error) throw error;
    await loadData();
  }

  // Save the single product with database constraints as a second validation layer.
  async function saveProduct(next) {
    if (demoMode) { setProduct(next); return; }
    const { error } = await supabase.from('products').update(next).eq('id', 1).select('id').single();
    if (error) throw error;
    await loadData();
  }
  return <DataContext.Provider value={{ students, product, transactions, loading, error, loadData, addStudent, toggleCard, saveProduct }}>{children}</DataContext.Provider>;
}

// Read shared admin data from a page.
export function useData() { return useContext(DataContext); }
