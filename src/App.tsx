import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  getDoc,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signInWithGoogle, logout } from './firebase';
import { Account, Investment, Liability, Transaction, UserProfile } from './types';
import { formatCurrency, cn } from './utils';
import { 
  Wallet, 
  TrendingUp, 
  CreditCard, 
  Plus, 
  LogOut, 
  Trash2, 
  Edit2, 
  ArrowUpRight, 
  ArrowDownLeft,
  PieChart as PieChartIcon,
  BarChart3,
  History,
  X
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-[#1a1d23] border border-[#2a2e36] rounded-2xl p-6 shadow-xl", className)}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  disabled
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
}) => {
  const variants = {
    primary: "bg-[#00e5c2] text-[#0f1115] hover:bg-[#00c9ab]",
    secondary: "bg-[#2a2e36] text-[#e6e8eb] hover:bg-[#353a44]",
    danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20",
    ghost: "bg-transparent text-[#e6e8eb] hover:bg-[#2a2e36]"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={cn(
        "px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2", 
        variants[variant], 
        className
      )}
    >
      {children}
    </button>
  );
};

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[#1a1d23] border border-[#2a2e36] rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-[#e6e8eb]">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-[#2a2e36] rounded-full transition-colors">
              <X size={20} className="text-[#e6e8eb]" />
            </button>
          </div>
          {children}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [isLiabilityModalOpen, setIsLiabilityModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  // Form States
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const qAccounts = query(collection(db, `users/${user.uid}/accounts`));
    const qInvestments = query(collection(db, `users/${user.uid}/investments`));
    const qLiabilities = query(collection(db, `users/${user.uid}/liabilities`));
    const qTransactions = query(
      collection(db, `users/${user.uid}/transactions`),
      orderBy('date', 'desc'),
      limit(10)
    );

    const unsubAccounts = onSnapshot(qAccounts, (s) => {
      const data = s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      setAccounts(data);
      // Initialize sample data if empty
      if (data.length === 0 && s.metadata.fromCache === false) {
        // This is a bit tricky to handle perfectly without multiple renders, 
        // but for a demo/starter app it works.
      }
    });

    const unsubInvestments = onSnapshot(qInvestments, (s) => {
      setInvestments(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investment)));
    });

    const unsubLiabilities = onSnapshot(qLiabilities, (s) => {
      setLiabilities(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Liability)));
    });

    const unsubTransactions = onSnapshot(qTransactions, (s) => {
      setTransactions(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });

    return () => {
      unsubAccounts();
      unsubInvestments();
      unsubLiabilities();
      unsubTransactions();
    };
  }, [user]);

  // Calculations
  const totalCash = accounts.reduce((acc, curr) => acc + curr.balance, 0);
  const totalInvestments = investments.reduce((acc, curr) => acc + curr.value, 0);
  const totalDebt = liabilities.reduce((acc, curr) => acc + curr.amount, 0);
  const netWorth = totalCash + totalInvestments - totalDebt;

  // Chart Data
  const assetAllocationData = [
    { name: 'Cash', value: totalCash, color: '#00e5c2' },
    { name: 'Investments', value: totalInvestments, color: '#8b5cf6' },
  ];

  const debtData = liabilities.map(l => ({ name: l.name, value: l.amount }));

  const handleAddAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const balance = Number(formData.get('balance'));

    if (editingItem) {
      await updateDoc(doc(db, `users/${user.uid}/accounts`, editingItem.id), { name, balance, updatedAt: new Date().toISOString() });
    } else {
      await addDoc(collection(db, `users/${user.uid}/accounts`), {
        userId: user.uid,
        name,
        balance,
        updatedAt: new Date().toISOString()
      });
    }
    setIsAccountModalOpen(false);
    setEditingItem(null);
  };

  const handleAddInvestment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const value = Number(formData.get('value'));
    const category = formData.get('category') as string;

    if (editingItem) {
      await updateDoc(doc(db, `users/${user.uid}/investments`, editingItem.id), { name, value, category, updatedAt: new Date().toISOString() });
    } else {
      await addDoc(collection(db, `users/${user.uid}/investments`), {
        userId: user.uid,
        name,
        value,
        category,
        updatedAt: new Date().toISOString()
      });
    }
    setIsInvestmentModalOpen(false);
    setEditingItem(null);
  };

  const handleAddLiability = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const amount = Number(formData.get('amount'));

    if (editingItem) {
      await updateDoc(doc(db, `users/${user.uid}/liabilities`, editingItem.id), { name, amount, updatedAt: new Date().toISOString() });
    } else {
      await addDoc(collection(db, `users/${user.uid}/liabilities`), {
        userId: user.uid,
        name,
        amount,
        updatedAt: new Date().toISOString()
      });
    }
    setIsLiabilityModalOpen(false);
    setEditingItem(null);
  };

  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as any;
    const amount = Number(formData.get('amount'));
    const accountId = formData.get('accountId') as string;
    const notes = formData.get('notes') as string;
    const date = new Date().toISOString();

    // Find account to update
    const account = accounts.find(a => a.id === accountId) || 
                    investments.find(i => i.id === accountId) || 
                    liabilities.find(l => l.id === accountId);

    if (!account) return;

    // Update balances
    if (type === 'income') {
      await updateDoc(doc(db, `users/${user.uid}/accounts`, accountId), { balance: (account as Account).balance + amount });
    } else if (type === 'expense') {
      await updateDoc(doc(db, `users/${user.uid}/accounts`, accountId), { balance: (account as Account).balance - amount });
    } else if (type === 'investment_deposit') {
      // Decrease cash, increase investment
      // For simplicity, we'll just update the investment value here
      await updateDoc(doc(db, `users/${user.uid}/investments`, accountId), { value: (account as Investment).value + amount });
    } else if (type === 'debt_payment') {
      await updateDoc(doc(db, `users/${user.uid}/liabilities`, accountId), { amount: (account as Liability).amount - amount });
    }

    await addDoc(collection(db, `users/${user.uid}/transactions`), {
      userId: user.uid,
      date,
      amount,
      type,
      accountId,
      notes,
      category: 'Manual'
    });

    setIsTransactionModalOpen(false);
  };

  const deleteItem = async (collectionName: string, id: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteDoc(doc(db, `users/${user.uid}/${collectionName}`, id));
    }
  };

  const seedData = async () => {
    if (!user) return;
    
    const sampleAccounts = [
      { name: 'BRI', balance: 650000 },
      { name: 'BCA', balance: 40000 },
      { name: 'Mandiri', balance: 100000 },
      { name: 'Cash', balance: 1300000 }
    ];

    const sampleInvestments = [
      { name: 'Gold', value: 500000, category: 'Gold' },
      { name: 'Mutual Funds', value: 500000, category: 'Mutual Funds' },
      { name: 'Superbank', value: 1000000, category: 'Digital Bank' }
    ];

    const sampleLiabilities = [
      { name: 'Credit Card BRI', amount: 1205237 },
      { name: 'Credit Card Yup', amount: 2525610 }
    ];

    for (const a of sampleAccounts) {
      await addDoc(collection(db, `users/${user.uid}/accounts`), { ...a, userId: user.uid, updatedAt: new Date().toISOString() });
    }
    for (const i of sampleInvestments) {
      await addDoc(collection(db, `users/${user.uid}/investments`), { ...i, userId: user.uid, updatedAt: new Date().toISOString() });
    }
    for (const l of sampleLiabilities) {
      await addDoc(collection(db, `users/${user.uid}/liabilities`), { ...l, userId: user.uid, updatedAt: new Date().toISOString() });
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("Domain ini belum terdaftar di Firebase Console. Silakan tambahkan domain Netlify Anda ke 'Authorized Domains' di Firebase.");
      } else if (error.code === 'auth/popup-blocked') {
        alert("Popup login diblokir oleh browser. Silakan izinkan popup untuk situs ini.");
      } else {
        alert("Gagal login: " + error.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#00e5c2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-20 h-20 bg-[#00e5c2]/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <TrendingUp size={40} className="text-[#00e5c2]" />
          </div>
          <h1 className="text-4xl font-black text-[#e6e8eb] mb-4 tracking-tight">LuxWealth</h1>
          <p className="text-[#e6e8eb]/60 mb-12 text-lg">Your elite personal finance dashboard.</p>
          <Button onClick={handleLogin} className="w-full py-4 text-lg rounded-2xl shadow-lg shadow-[#00e5c2]/20">
            Sign in with Google
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-[#e6e8eb] font-sans selection:bg-[#00e5c2]/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0f1115]/80 backdrop-blur-xl border-b border-[#2a2e36]">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00e5c2] rounded-xl flex items-center justify-center shadow-lg shadow-[#00e5c2]/20">
              <TrendingUp size={24} className="text-[#0f1115]" />
            </div>
            <span className="text-xl font-bold tracking-tight">LuxWealth</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-medium">{user.displayName}</span>
              <span className="text-xs text-[#e6e8eb]/40">{user.email}</span>
            </div>
            <img src={user.photoURL || ''} alt="Profile" className="w-10 h-10 rounded-full border border-[#2a2e36]" referrerPolicy="no-referrer" />
            <button onClick={logout} className="p-2 hover:bg-[#2a2e36] rounded-xl transition-colors text-[#e6e8eb]/60 hover:text-red-400">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Summary Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Wallet size={48} />
            </div>
            <p className="text-sm font-medium text-[#e6e8eb]/40 uppercase tracking-wider mb-1">Total Cash</p>
            <h3 className="text-2xl font-bold">{formatCurrency(totalCash)}</h3>
            <div className="mt-4 flex items-center gap-2 text-[#00e5c2] text-xs font-medium">
              <ArrowUpRight size={14} />
              <span>Liquid Assets</span>
            </div>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={48} />
            </div>
            <p className="text-sm font-medium text-[#e6e8eb]/40 uppercase tracking-wider mb-1">Investments</p>
            <h3 className="text-2xl font-bold">{formatCurrency(totalInvestments)}</h3>
            <div className="mt-4 flex items-center gap-2 text-purple-400 text-xs font-medium">
              <TrendingUp size={14} />
              <span>Growth Assets</span>
            </div>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <CreditCard size={48} />
            </div>
            <p className="text-sm font-medium text-[#e6e8eb]/40 uppercase tracking-wider mb-1">Total Debt</p>
            <h3 className="text-2xl font-bold">{formatCurrency(totalDebt)}</h3>
            <div className="mt-4 flex items-center gap-2 text-red-400 text-xs font-medium">
              <ArrowDownLeft size={14} />
              <span>Liabilities</span>
            </div>
          </Card>

          <Card className="bg-[#00e5c2] text-[#0f1115] border-none shadow-2xl shadow-[#00e5c2]/20">
            <p className="text-sm font-bold uppercase tracking-wider mb-1 opacity-60">Net Worth</p>
            <h3 className="text-3xl font-black">{formatCurrency(netWorth)}</h3>
            <div className="mt-4 flex items-center gap-2 text-[#0f1115]/60 text-xs font-bold">
              <TrendingUp size={14} />
              <span>Financial Health</span>
            </div>
          </Card>
        </section>

        {/* Charts Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <BarChart3 size={20} className="text-[#00e5c2]" />
                <h3 className="font-bold text-lg">Asset Overview</h3>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Cash', value: totalCash },
                  { name: 'Investments', value: totalInvestments },
                  { name: 'Debt', value: totalDebt },
                ]}>
                  <XAxis dataKey="name" stroke="#e6e8eb" opacity={0.4} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1d23', border: '1px solid #2a2e36', borderRadius: '12px' }}
                    itemStyle={{ color: '#00e5c2' }}
                  />
                  <Bar dataKey="value" fill="#00e5c2" radius={[8, 8, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-8">
              <PieChartIcon size={20} className="text-[#00e5c2]" />
              <h3 className="font-bold text-lg">Allocation</h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetAllocationData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {assetAllocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1d23', border: '1px solid #2a2e36', borderRadius: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        {/* Action Bar */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => { setEditingItem(null); setIsAccountModalOpen(true); }}>
            <Plus size={18} /> Add Asset
          </Button>
          <Button onClick={() => { setEditingItem(null); setIsInvestmentModalOpen(true); }} variant="secondary">
            <Plus size={18} /> Add Investment
          </Button>
          <Button onClick={() => { setEditingItem(null); setIsLiabilityModalOpen(true); }} variant="secondary">
            <Plus size={18} /> Add Debt
          </Button>
          <Button onClick={() => setIsTransactionModalOpen(true)} variant="primary" className="ml-auto bg-white text-black hover:bg-gray-200">
            <History size={18} /> New Transaction
          </Button>
          {accounts.length === 0 && (
            <Button onClick={seedData} variant="ghost" className="text-xs opacity-50">
              Load Sample Data
            </Button>
          )}
        </div>

        {/* Data Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Cash Accounts */}
          <Card className="xl:col-span-1">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Wallet size={18} className="text-[#00e5c2]" /> Cash Accounts
              </h3>
            </div>
            <div className="space-y-4">
              {accounts.map(account => (
                <div key={account.id} className="group flex items-center justify-between p-4 bg-[#0f1115] rounded-xl border border-[#2a2e36] hover:border-[#00e5c2]/50 transition-all">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-lg font-bold text-[#00e5c2]">{formatCurrency(account.balance)}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setEditingItem(account); setIsAccountModalOpen(true); }}
                      className="p-2 hover:bg-[#2a2e36] rounded-lg text-[#e6e8eb]/40 hover:text-[#00e5c2]"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteItem('accounts', account.id)}
                      className="p-2 hover:bg-[#2a2e36] rounded-lg text-[#e6e8eb]/40 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {accounts.length === 0 && <p className="text-center text-[#e6e8eb]/20 py-8">No accounts added</p>}
            </div>
          </Card>

          {/* Investments */}
          <Card className="xl:col-span-1">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <TrendingUp size={18} className="text-purple-400" /> Investments
              </h3>
            </div>
            <div className="space-y-4">
              {investments.map(inv => (
                <div key={inv.id} className="group flex items-center justify-between p-4 bg-[#0f1115] rounded-xl border border-[#2a2e36] hover:border-purple-400/50 transition-all">
                  <div>
                    <p className="font-medium">{inv.name}</p>
                    <p className="text-xs text-[#e6e8eb]/40">{inv.category}</p>
                    <p className="text-lg font-bold text-purple-400">{formatCurrency(inv.value)}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setEditingItem(inv); setIsInvestmentModalOpen(true); }}
                      className="p-2 hover:bg-[#2a2e36] rounded-lg text-[#e6e8eb]/40 hover:text-purple-400"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteItem('investments', inv.id)}
                      className="p-2 hover:bg-[#2a2e36] rounded-lg text-[#e6e8eb]/40 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {investments.length === 0 && <p className="text-center text-[#e6e8eb]/20 py-8">No investments added</p>}
            </div>
          </Card>

          {/* Liabilities */}
          <Card className="xl:col-span-1">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <CreditCard size={18} className="text-red-400" /> Liabilities
              </h3>
            </div>
            <div className="space-y-4">
              {liabilities.map(debt => (
                <div key={debt.id} className="group flex items-center justify-between p-4 bg-[#0f1115] rounded-xl border border-[#2a2e36] hover:border-red-400/50 transition-all">
                  <div>
                    <p className="font-medium">{debt.name}</p>
                    <p className="text-lg font-bold text-red-400">{formatCurrency(debt.amount)}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setEditingItem(debt); setIsLiabilityModalOpen(true); }}
                      className="p-2 hover:bg-[#2a2e36] rounded-lg text-[#e6e8eb]/40 hover:text-red-400"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteItem('liabilities', debt.id)}
                      className="p-2 hover:bg-[#2a2e36] rounded-lg text-[#e6e8eb]/40 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {liabilities.length === 0 && <p className="text-center text-[#e6e8eb]/20 py-8">No liabilities added</p>}
            </div>
          </Card>
        </div>

        {/* Transactions History */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <History size={18} className="text-[#00e5c2]" /> Recent Transactions
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[#e6e8eb]/40 text-sm border-b border-[#2a2e36]">
                  <th className="pb-4 font-medium">Date</th>
                  <th className="pb-4 font-medium">Type</th>
                  <th className="pb-4 font-medium">Account</th>
                  <th className="pb-4 font-medium">Amount</th>
                  <th className="pb-4 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2e36]">
                {transactions.map(t => (
                  <tr key={t.id} className="text-sm">
                    <td className="py-4 text-[#e6e8eb]/60">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                        t.type === 'income' ? "bg-green-500/10 text-green-500" :
                        t.type === 'expense' ? "bg-red-500/10 text-red-500" :
                        t.type === 'debt_payment' ? "bg-blue-500/10 text-blue-500" :
                        "bg-purple-500/10 text-purple-500"
                      )}>
                        {t.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 font-medium">
                      {accounts.find(a => a.id === t.accountId)?.name || 
                       investments.find(i => i.id === t.accountId)?.name || 
                       liabilities.find(l => l.id === t.accountId)?.name || 'Unknown'}
                    </td>
                    <td className={cn("py-4 font-bold", t.type === 'income' ? "text-green-500" : "text-[#e6e8eb]")}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td className="py-4 text-[#e6e8eb]/40">{t.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && <p className="text-center text-[#e6e8eb]/20 py-8">No transactions yet</p>}
          </div>
        </Card>
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
        title={editingItem ? "Edit Asset" : "Add Asset"}
      >
        <form onSubmit={handleAddAccount} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Account Name</label>
            <input 
              name="name" 
              defaultValue={editingItem?.name}
              required 
              placeholder="e.g. BCA, BRI, Cash"
              className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Balance (IDR)</label>
            <input 
              name="balance" 
              type="number" 
              defaultValue={editingItem?.balance}
              required 
              placeholder="0"
              className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2] transition-colors"
            />
          </div>
          <Button className="w-full py-4 mt-4">Save Account</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isInvestmentModalOpen} 
        onClose={() => setIsInvestmentModalOpen(false)} 
        title={editingItem ? "Edit Investment" : "Add Investment"}
      >
        <form onSubmit={handleAddInvestment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Investment Name</label>
            <input name="name" defaultValue={editingItem?.name} required placeholder="e.g. Gold, SBN" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Category</label>
            <select name="category" defaultValue={editingItem?.category || 'Stocks'} className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]">
              <option>Gold</option>
              <option>Stocks</option>
              <option>Mutual Funds</option>
              <option>Digital Bank</option>
              <option>Others</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Value (IDR)</label>
            <input name="value" type="number" defaultValue={editingItem?.value} required placeholder="0" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]" />
          </div>
          <Button className="w-full py-4 mt-4">Save Investment</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isLiabilityModalOpen} 
        onClose={() => setIsLiabilityModalOpen(false)} 
        title={editingItem ? "Edit Liability" : "Add Liability"}
      >
        <form onSubmit={handleAddLiability} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Debt Name</label>
            <input name="name" defaultValue={editingItem?.name} required placeholder="e.g. Credit Card" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Amount Owed (IDR)</label>
            <input name="amount" type="number" defaultValue={editingItem?.amount} required placeholder="0" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]" />
          </div>
          <Button className="w-full py-4 mt-4">Save Liability</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isTransactionModalOpen} 
        onClose={() => setIsTransactionModalOpen(false)} 
        title="New Transaction"
      >
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Transaction Type</label>
            <select name="type" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]">
              <option value="income">Income (Add to Cash)</option>
              <option value="expense">Expense (Spend from Cash)</option>
              <option value="investment_deposit">Investment Deposit</option>
              <option value="debt_payment">Debt Payment</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Target Account</label>
            <select name="accountId" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]">
              <optgroup label="Cash Accounts">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </optgroup>
              <optgroup label="Investments">
                {investments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </optgroup>
              <optgroup label="Liabilities">
                {liabilities.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Amount (IDR)</label>
            <input name="amount" type="number" required placeholder="0" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Notes</label>
            <input name="notes" placeholder="Optional notes" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]" />
          </div>
          <Button className="w-full py-4 mt-4">Record Transaction</Button>
        </form>
      </Modal>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-[#e6e8eb]/20 text-sm">
        <p>&copy; 2026 LuxWealth Tracker. All rights reserved.</p>
      </footer>
    </div>
  );
}
