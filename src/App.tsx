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
  increment,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signInWithGoogle, signInWithApple, logout } from './firebase';
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
  X,
  AlertCircle
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
  Legend,
  LabelList
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) message = `Database Error: ${parsed.error}`;
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="min-h-screen bg-[#0f1115] flex items-center justify-center p-4">
          <div className="bg-[#1a1d23] border border-red-500/20 p-8 rounded-2xl max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Application Error</h2>
            <p className="text-[#e6e8eb]/60 mb-6">{message}</p>
            <Button onClick={() => window.location.reload()} className="w-full">Reload Application</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteCollection, setDeleteCollection] = useState<string>('');
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // Form States
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedTransactionType, setSelectedTransactionType] = useState('expense');
  const [selectedAccountId, setSelectedAccountId] = useState('');

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
  const totalAssets = totalCash + totalInvestments + totalDebt;
  
  const assetAllocationData = [
    { name: 'Cash', value: totalCash, color: '#00e5c2' },
    { name: 'Investments', value: totalInvestments, color: '#8b5cf6' },
    { name: 'Debt', value: totalDebt, color: '#f87171' },
  ].map(item => ({
    ...item,
    percent: totalAssets > 0 ? (item.value / totalAssets) * 100 : 0
  }));

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
    
    const type = selectedTransactionType;
    const accountId = selectedAccountId;
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const notes = formData.get('notes') as string;
    const date = editingItem ? (editingItem as Transaction).date : new Date().toISOString();

    if (!accountId) {
      alert('Please select a target account. If the list is empty, add an account first.');
      return;
    }

    // Determine account type
    const isAccount = accounts.some(a => a.id === accountId);
    const isInvestment = investments.some(i => i.id === accountId);
    const isLiability = liabilities.some(l => l.id === accountId);
    const accountType = isAccount ? 'cash' : isInvestment ? 'investment' : 'liability';

    try {
      if (editingItem) {
        const oldTx = editingItem as Transaction;
        const path = `users/${user.uid}/transactions/${oldTx.id}`;
        
        // Reverse old balance impact
        await updateAccountBalance(oldTx.accountId, oldTx.type, oldTx.amount, true);
        
        // Apply new balance impact
        await updateAccountBalance(accountId, type, amount, false);

        try {
          await updateDoc(doc(db, `users/${user.uid}/transactions`, oldTx.id), {
            amount,
            type,
            accountId,
            accountType,
            notes,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        // Apply balance impact
        await updateAccountBalance(accountId, type, amount, false);

        const transPath = `users/${user.uid}/transactions`;
        try {
          await addDoc(collection(db, transPath), {
            userId: user.uid,
            date,
            amount,
            type,
            accountId,
            accountType,
            notes,
            category: 'Manual'
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, transPath);
        }
      }

      setIsTransactionModalOpen(false);
      setEditingItem(null);
      setSelectedAccountId('');
    } catch (error) {
      console.error("Error saving transaction:", error);
    }
  };

  const updateAccountBalance = async (accountId: string, type: string, amount: number, isReverse: boolean = false) => {
    if (!user) return;
    
    const account = accounts.find(a => a.id === accountId);
    const investment = investments.find(i => i.id === accountId);
    const liability = liabilities.find(l => l.id === accountId);

    let multiplier = isReverse ? -1 : 1;

    try {
      if (account) {
        let balanceChange = 0;
        if (type === 'income') balanceChange = amount * multiplier;
        if (type === 'expense') balanceChange = -amount * multiplier;
        
        if (balanceChange !== 0) {
          await updateDoc(doc(db, `users/${user.uid}/accounts`, accountId), { 
            balance: increment(balanceChange),
            updatedAt: new Date().toISOString()
          });
        }
      } else if (investment) {
        let valueChange = 0;
        if (type === 'investment_deposit') valueChange = amount * multiplier;
        if (type === 'investment_withdrawal') valueChange = -amount * multiplier;

        if (valueChange !== 0) {
          await updateDoc(doc(db, `users/${user.uid}/investments`, accountId), { 
            value: increment(valueChange),
            updatedAt: new Date().toISOString()
          });
        }
      } else if (liability) {
        let amountChange = 0;
        if (type === 'debt_payment') amountChange = -amount * multiplier;
        if (type === 'debt_expense') amountChange = amount * multiplier;

        if (amountChange !== 0) {
          await updateDoc(doc(db, `users/${user.uid}/liabilities`, accountId), { 
            amount: increment(amountChange),
            updatedAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error("Error updating balance:", err);
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    if (!user) return;
    setItemToDelete(transaction);
    setDeleteCollection('transactions');
    setIsDeleteConfirmOpen(true);
  };

  const deleteItem = async (collectionName: string, id: string) => {
    if (!user) return;
    setItemToDelete({ id });
    setDeleteCollection(collectionName);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!user || !itemToDelete) return;

    try {
      if (deleteCollection === 'transactions') {
        const tx = itemToDelete as Transaction;
        // Reverse balance impact
        await updateAccountBalance(tx.accountId, tx.type, tx.amount, true);
        // Delete transaction
        await deleteDoc(doc(db, `users/${user.uid}/transactions`, tx.id));
      } else {
        await deleteDoc(doc(db, `users/${user.uid}/${deleteCollection}`, itemToDelete.id));
      }
      
      setIsDeleteConfirmOpen(false);
      setItemToDelete(null);
      setDeleteCollection('');
    } catch (err) {
      console.error("Error deleting item:", err);
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/${deleteCollection}/${itemToDelete.id}`);
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

  const handleAppleLogin = async () => {
    try {
      await signInWithApple();
    } catch (error: any) {
      console.error("Apple Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("Domain ini belum terdaftar di Firebase Console. Silakan tambahkan domain Netlify Anda ke 'Authorized Domains' di Firebase.");
      } else if (error.code === 'auth/popup-blocked') {
        alert("Popup login diblokir oleh browser. Silakan izinkan popup untuk situs ini.");
      } else {
        alert("Gagal login Apple: " + error.message);
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
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Luxury Background Animation */}
        <div className="absolute inset-0 z-0">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-[#00e5c2]/20 to-transparent rounded-full blur-[120px]"
          />
          <motion.div 
            animate={{ 
              scale: [1.2, 1, 1.2],
              rotate: [90, 0, 90],
              opacity: [0.1, 0.15, 0.1]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/20 to-transparent rounded-full blur-[120px]"
          />
          
          {/* Floating Particles */}
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: Math.random() * window.innerHeight,
                opacity: Math.random() * 0.5
              }}
              animate={{ 
                y: [null, Math.random() * -100 - 50],
                opacity: [null, 0]
              }}
              transition={{ 
                duration: Math.random() * 5 + 5, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="absolute w-1 h-1 bg-white rounded-full"
            />
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="w-full max-w-md text-center relative z-10"
        >
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-24 h-24 bg-gradient-to-br from-[#00e5c2] to-[#00c9ab] rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-[#00e5c2]/30"
          >
            <TrendingUp size={48} className="text-[#0f1115]" />
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-5xl font-black text-[#e6e8eb] mb-4 tracking-tighter"
          >
            LuxWealth
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-[#e6e8eb]/50 mb-12 text-xl font-light tracking-wide"
          >
            The pinnacle of personal finance.
          </motion.p>

          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Button onClick={handleLogin} className="w-full py-5 text-lg rounded-2xl bg-white text-black hover:bg-gray-100 shadow-xl transition-all duration-300">
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5 mr-2" alt="Google" />
                Continue with Google
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Button onClick={handleAppleLogin} className="w-full py-5 text-lg rounded-2xl bg-black text-white border border-white/10 hover:bg-zinc-900 shadow-xl transition-all duration-300">
                <svg className="w-5 h-5 mr-2 fill-current" viewBox="0 0 384 512">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                Continue with Apple
              </Button>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 1.2 }}
            className="mt-16 text-xs uppercase tracking-[0.3em] text-[#e6e8eb]"
          >
            Secured by Firebase Elite
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity text-[#00e5c2]">
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
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity text-purple-400">
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
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity text-red-400">
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
          <Card className="lg:col-span-2 bg-[#1a1d23]/50 backdrop-blur-xl border-[#2a2e36] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-right from-transparent via-[#00e5c2]/50 to-transparent" />
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#00e5c2]/10 rounded-lg">
                  <BarChart3 size={20} className="text-[#00e5c2]" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#e6e8eb]">Asset Overview</h3>
                  <p className="text-xs text-[#e6e8eb]/40">Distribution of your liquid and growth assets</p>
                </div>
              </div>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={[
                    { name: 'Cash', value: totalCash, color: '#00e5c2', secondaryColor: '#00b398' },
                    { name: 'Investments', value: totalInvestments, color: '#8b5cf6', secondaryColor: '#6d28d9' },
                    { name: 'Debt', value: totalDebt, color: '#f87171', secondaryColor: '#dc2626' },
                  ]}
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="barGradientCash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00e5c2" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#00e5c2" stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="barGradientInv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="barGradientDebt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    stroke="#e6e8eb" 
                    opacity={0.3} 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 12 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#1a1d23] border border-[#2a2e36] p-4 rounded-2xl shadow-2xl backdrop-blur-xl">
                            <p className="text-xs font-bold text-[#e6e8eb]/40 uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
                            <p className="text-lg font-black text-[#e6e8eb]">{formatCurrency(payload[0].value as number)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[12, 12, 4, 4]} 
                    barSize={60}
                    animationDuration={1500}
                  >
                    <LabelList 
                      dataKey="value" 
                      position="top" 
                      formatter={(val: number) => formatCurrency(val)}
                      style={{ fill: '#e6e8eb', fontSize: 10, fontWeight: 'bold', opacity: 0.6 }}
                    />
                    {
                      [
                        { name: 'Cash', gradient: 'url(#barGradientCash)' },
                        { name: 'Investments', gradient: 'url(#barGradientInv)' },
                        { name: 'Debt', gradient: 'url(#barGradientDebt)' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.gradient} />
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="bg-[#1a1d23]/50 backdrop-blur-xl border-[#2a2e36] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-right from-transparent via-purple-500/50 to-transparent" />
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <PieChartIcon size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#e6e8eb]">Allocation</h3>
                <p className="text-xs text-[#e6e8eb]/40">Portfolio diversification</p>
              </div>
            </div>
            <div className="h-[280px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {assetAllocationData.map((entry, index) => (
                      <linearGradient key={`grad-${index}`} id={`pieGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={1}/>
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.6}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={assetAllocationData}
                    innerRadius={75}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                    animationBegin={0}
                    animationDuration={1800}
                  >
                    {assetAllocationData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#pieGrad-${index})`}
                        style={{ filter: `drop-shadow(0 0 8px ${entry.color}44)` }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#1a1d23] border border-[#2a2e36] p-3 rounded-xl shadow-2xl backdrop-blur-xl">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
                              <p className="text-[10px] font-bold text-[#e6e8eb]/40 uppercase tracking-widest">{payload[0].name}</p>
                            </div>
                            <p className="text-sm font-black text-[#e6e8eb]">{formatCurrency(payload[0].value as number)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-auto pt-4 grid grid-cols-2 gap-2">
              {assetAllocationData.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-medium text-[#e6e8eb]/60 truncate">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#e6e8eb]">{item.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Data Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Cash Accounts */}
          <Card className="xl:col-span-1">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Wallet size={18} className="text-[#00e5c2]" /> Cash Accounts
              </h3>
              <Button 
                onClick={() => { setEditingItem(null); setIsAccountModalOpen(true); }} 
                className="py-1.5 px-3 text-xs rounded-lg"
              >
                <Plus size={14} /> Add
              </Button>
            </div>
            <div className="space-y-4">
              {accounts.map(account => (
                <div key={account.id} className="group flex items-center justify-between p-4 bg-[#0f1115] rounded-xl border border-[#2a2e36] hover:border-[#00e5c2]/50 transition-all">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-lg font-bold text-[#00e5c2]">{formatCurrency(account.balance)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setEditingItem(account); setIsAccountModalOpen(true); }}
                      className="p-2 bg-[#2a2e36] hover:bg-[#353a44] rounded-lg text-[#e6e8eb]/60 hover:text-[#00e5c2] transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteItem('accounts', account.id)}
                      className="p-2 bg-[#2a2e36] hover:bg-[#353a44] rounded-lg text-[#e6e8eb]/60 hover:text-red-400 transition-colors"
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
              <Button 
                onClick={() => { setEditingItem(null); setIsInvestmentModalOpen(true); }} 
                variant="secondary"
                className="py-1.5 px-3 text-xs rounded-lg"
              >
                <Plus size={14} /> Add
              </Button>
            </div>
            <div className="space-y-4">
              {investments.map(inv => (
                <div key={inv.id} className="group flex items-center justify-between p-4 bg-[#0f1115] rounded-xl border border-[#2a2e36] hover:border-purple-400/50 transition-all">
                  <div>
                    <p className="font-medium">{inv.name}</p>
                    <p className="text-xs text-[#e6e8eb]/40">{inv.category}</p>
                    <p className="text-lg font-bold text-purple-400">{formatCurrency(inv.value)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setEditingItem(inv); setIsInvestmentModalOpen(true); }}
                      className="p-2 bg-[#2a2e36] hover:bg-[#353a44] rounded-lg text-[#e6e8eb]/60 hover:text-purple-400 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteItem('investments', inv.id)}
                      className="p-2 bg-[#2a2e36] hover:bg-[#353a44] rounded-lg text-[#e6e8eb]/60 hover:text-red-400 transition-colors"
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
              <Button 
                onClick={() => { setEditingItem(null); setIsLiabilityModalOpen(true); }} 
                variant="secondary"
                className="py-1.5 px-3 text-xs rounded-lg"
              >
                <Plus size={14} /> Add
              </Button>
            </div>
            <div className="space-y-4">
              {liabilities.map(debt => (
                <div key={debt.id} className="group flex items-center justify-between p-4 bg-[#0f1115] rounded-xl border border-[#2a2e36] hover:border-red-400/50 transition-all">
                  <div>
                    <p className="font-medium">{debt.name}</p>
                    <p className="text-lg font-bold text-red-400">{formatCurrency(debt.amount)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setEditingItem(debt); setIsLiabilityModalOpen(true); }}
                      className="p-2 bg-[#2a2e36] hover:bg-[#353a44] rounded-lg text-[#e6e8eb]/60 hover:text-red-400 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteItem('liabilities', debt.id)}
                      className="p-2 bg-[#2a2e36] hover:bg-[#353a44] rounded-lg text-[#e6e8eb]/60 hover:text-red-400 transition-colors"
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
            <div className="flex items-center gap-3">
              {accounts.length === 0 && (
                <Button onClick={seedData} variant="ghost" className="text-xs opacity-50">
                  Load Sample Data
                </Button>
              )}
              <Button 
                onClick={() => { setIsTransactionModalOpen(true); setSelectedTransactionType('expense'); }} 
                variant="primary" 
                className="bg-white text-black hover:bg-gray-200 py-1.5 px-3 text-xs rounded-lg"
              >
                <History size={14} /> New Transaction
              </Button>
            </div>
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
                  <th className="pb-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2e36]">
                {transactions.map(t => (
                  <tr key={t.id} className="text-sm group">
                    <td className="py-4 text-[#e6e8eb]/60">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                        t.type === 'income' ? "bg-green-500/10 text-green-500" :
                        t.type === 'expense' ? "bg-red-500/10 text-red-500" :
                        t.type === 'investment_deposit' ? "bg-purple-500/10 text-purple-500" :
                        t.type === 'investment_withdrawal' ? "bg-orange-500/10 text-orange-500" :
                        t.type === 'debt_payment' ? "bg-blue-500/10 text-blue-500" :
                        t.type === 'debt_expense' ? "bg-red-500/10 text-red-500" :
                        "bg-gray-500/10 text-gray-500"
                      )}>
                        {t.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 font-medium">
                      {accounts.find(a => a.id === t.accountId)?.name || 
                       investments.find(i => i.id === t.accountId)?.name || 
                       liabilities.find(l => l.id === t.accountId)?.name || 'Unknown'}
                    </td>
                    <td className={cn(
                      "py-4 font-bold", 
                      (t.type === 'income' || t.type === 'investment_deposit' || t.type === 'debt_payment') ? "text-green-500" : "text-red-500"
                    )}>
                      {(t.type === 'income' || t.type === 'investment_deposit' || t.type === 'debt_expense') ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td className="py-4 text-[#e6e8eb]/40">{t.notes}</td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { 
                            setEditingItem(t); 
                            setSelectedTransactionType(t.type);
                            setSelectedAccountId(t.accountId);
                            setIsTransactionModalOpen(true); 
                          }}
                          className="p-2 bg-[#2a2e36] hover:bg-[#353a44] rounded-lg text-[#e6e8eb]/60 hover:text-[#00e5c2] transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => deleteTransaction(t)}
                          className="p-2 bg-[#2a2e36] hover:bg-[#353a44] rounded-lg text-[#e6e8eb]/60 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
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
        onClose={() => { 
          setIsTransactionModalOpen(false); 
          setEditingItem(null);
          setSelectedAccountId('');
        }} 
        title={editingItem ? "Edit Transaction" : "New Transaction"}
      >
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Transaction Type</label>
            <select 
              name="type" 
              value={selectedTransactionType}
              onChange={(e) => {
                setSelectedTransactionType(e.target.value);
                setSelectedAccountId(''); // Reset account when type changes
              }}
              className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]"
            >
              <option value="income">Income (Add to Cash)</option>
              <option value="expense">Expense (Spend from Cash)</option>
              <option value="investment_deposit">Investment Deposit</option>
              <option value="investment_withdrawal">Investment Withdrawal</option>
              <option value="debt_payment">Debt Payment (Reduce Debt)</option>
              <option value="debt_expense">Debt Expense (Increase Debt)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Target Account</label>
            <select 
              name="accountId" 
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              required
              className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]"
            >
              <option value="" disabled>Select an account</option>
              {(selectedTransactionType === 'income' || selectedTransactionType === 'expense') && (
                <optgroup label="Cash Accounts">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              )}
              {(selectedTransactionType === 'investment_deposit' || selectedTransactionType === 'investment_withdrawal') && (
                <optgroup label="Investments">
                  {investments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </optgroup>
              )}
              {(selectedTransactionType === 'debt_payment' || selectedTransactionType === 'debt_expense') && (
                <optgroup label="Liabilities">
                  {liabilities.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </optgroup>
              )}
            </select>
            {((selectedTransactionType === 'income' || selectedTransactionType === 'expense') && accounts.length === 0) && (
              <p className="text-xs text-red-400 mt-1">No cash accounts found. Please add one first.</p>
            )}
            {((selectedTransactionType === 'investment_deposit' || selectedTransactionType === 'investment_withdrawal') && investments.length === 0) && (
              <p className="text-xs text-red-400 mt-1">No investments found. Please add one first.</p>
            )}
            {((selectedTransactionType === 'debt_payment' || selectedTransactionType === 'debt_expense') && liabilities.length === 0) && (
              <p className="text-xs text-red-400 mt-1">No liabilities found. Please add one first.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Amount (IDR)</label>
            <input name="amount" type="number" defaultValue={editingItem?.amount} required placeholder="0" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Notes</label>
            <input name="notes" defaultValue={editingItem?.notes} placeholder="Optional notes" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00e5c2]" />
          </div>
          <Button className="w-full py-4 mt-4">{editingItem ? "Update Transaction" : "Record Transaction"}</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isDeleteConfirmOpen} 
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setItemToDelete(null);
          setDeleteCollection('');
        }} 
        title="Confirm Deletion"
      >
        <div className="space-y-6">
          <p className="text-[#e6e8eb]/60">
            {deleteCollection === 'transactions' 
              ? "Are you sure you want to delete this transaction? This action will also automatically reverse the balance change on the associated account."
              : "Are you sure you want to delete this item? This action cannot be undone."}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => setIsDeleteConfirmOpen(false)} variant="secondary" className="flex-1">
              Cancel
            </Button>
            <Button onClick={confirmDelete} variant="danger" className="flex-1">
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-[#e6e8eb]/20 text-sm">
        <p>&copy; 2026 LuxWealth Tracker. All rights reserved.</p>
      </footer>
    </div>
    </ErrorBoundary>
  );
}
