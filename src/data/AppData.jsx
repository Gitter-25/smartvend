import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, demoMode } from '../lib/supabase';
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
      const results = await Promise.all([
        supabase.from('students').select('id,name,number,wallets(balance),cards(id,active)').order('created_at'),
        supabase.from('products').select('id,name,price,stock').order('id'),
        supabase.from('transactions').select('id,type,amount,status,created_at,note,slot_id,product_name,students(name)').order('created_at', { ascending: false }).limit(100),
      ]);
      if (current !== requestId.current) return;
      const failure = results.find((result) => result.error);
      if (failure) throw failure.error;
      setStudents(results[0].data.map((row) => ({ ...row, balance: Number(row.wallets?.balance ?? 0), cardId: row.cards?.id, active: row.cards?.active ?? false })));
      if (results[1].data.length !== 2) throw new Error('Run the two-slot migration (002_two_slots.sql), then click Retry.');
      setProducts(results[1].data.map((row) => ({ ...row, price: Number(row.price) })));
      setTransactions(results[2].data.map((row) => ({ ...row, student: row.students?.name ?? 'Unknown', amount: Number(row.amount), date: row.created_at, note: row.slot_id ? `Slot ${row.slot_id} · ${row.product_name} · ${row.note}` : row.note })));
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

  // Save one fixed slot without changing its number.
  async function saveProduct(id, next) {
    if (demoMode) { setProducts((rows) => rows.map((row) => row.id === id ? { ...row, ...next } : row)); return; }
    const { error } = await supabase.from('products').update({ name: next.name, price: next.price, stock: next.stock }).eq('id', id).select('id').single();
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
    const { error } = await supabase.rpc('admin_topup', input);
    if (error) throw error;
    await loadData();
  }
  // Send card identifiers only to the authenticated backend encryption function.
  async function manageCard(input) {
    if (demoMode) throw new Error('Connect Supabase to use encrypted enrollment.');
    const { data, error } = await supabase.functions.invoke('card-management', { body: input });
    if (error) {
      let message = error.message;
      if (error.context?.json) {
        try { message = (await error.context.json()).error || message; } catch { /* Keep the network error if no JSON was returned. */ }
      }
      throw new Error(message);
    }
    if (['enroll', 'purchase'].includes(input.action)) await loadData();
    return data;
  }
  return <DataContext.Provider value={{ students, products, transactions, loading, error, loadData, addStudent, toggleCard, saveProduct, manageCard, topupWallet }}>{children}</DataContext.Provider>;
}

// Read shared admin data from a page.
export function useData() { return useContext(DataContext); }
