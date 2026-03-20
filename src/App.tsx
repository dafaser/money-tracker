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
  limit,
  writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signInWithGoogle, signInWithApple, logout } from './firebase';
import { Account, Investment, Liability, Transaction, UserProfile, Information } from './types';
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
  AlertCircle,
  Copy,
  Check,
  LayoutDashboard,
  Info,
  Database,
  RefreshCcw
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
  LabelList,
  CartesianGrid
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

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <motion.div 
    whileHover={onClick ? { scale: 1.01, y: -2 } : {}}
    onClick={onClick}
    className={cn("bg-luxury-card border border-luxury-border rounded-3xl p-6 shadow-2xl relative overflow-hidden group", className)}
  >
    {/* Subtle inner glow */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    <div className="relative z-10">{children}</div>
  </motion.div>
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
    primary: "bg-luxury-accent text-black hover:brightness-110 shadow-lg shadow-luxury-accent/20",
    secondary: "bg-white/5 text-white hover:bg-white/10 border border-white/10",
    danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20",
    ghost: "bg-transparent text-white/60 hover:text-white hover:bg-white/5"
  };

  return (
    <motion.button 
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick} 
      disabled={disabled}
      className={cn(
        "px-6 py-3 rounded-2xl font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2", 
        variants[variant], 
        className
      )}
    >
      {children}
    </motion.button>
  );
};

const Background = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-luxury-accent/10 rounded-full blur-[120px] animate-pulse" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
    <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '4s' }} />
    
    {/* Noise Texture */}
    <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
  </div>
);

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

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={handleCopy}
      className="p-2 hover:bg-[#2a2e36] rounded-lg text-[#e6e8eb]/40 hover:text-[#00e5c2] transition-all"
      title="Copy to clipboard"
    >
      {copied ? <Check size={16} className="text-[#00e5c2]" /> : <Copy size={16} />}
    </button>
  );
};

const Notification = ({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 50, x: '-50%' }}
      className={cn(
        "fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl",
        type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500"
      )}
    >
      {type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
      <span className="font-medium">{message}</span>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [information, setInformation] = useState<Information[]>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'information'>('dashboard');

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [isLiabilityModalOpen, setIsLiabilityModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isInformationModalOpen, setIsInformationModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteCollection, setDeleteCollection] = useState<string>('');
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
  const [selectedInfoId, setSelectedInfoId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setNotification({ message: 'Copied to clipboard', type: 'success' });
  };

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
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}/accounts`);
    });

    const unsubInvestments = onSnapshot(qInvestments, (s) => {
      setInvestments(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investment)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}/investments`);
    });

    const unsubLiabilities = onSnapshot(qLiabilities, (s) => {
      setLiabilities(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Liability)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}/liabilities`);
    });

    const unsubTransactions = onSnapshot(qTransactions, (s) => {
      setTransactions(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}/transactions`);
    });

    const unsubInformation = onSnapshot(collection(db, `users/${user.uid}/information`), (s) => {
      setInformation(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Information)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}/information`);
    });

    return () => {
      unsubAccounts();
      unsubInvestments();
      unsubLiabilities();
      unsubTransactions();
      unsubInformation();
    };
  }, [user]);

  // Calculations
  const totalCash = accounts.reduce((acc, curr) => acc + curr.balance, 0);
  const totalInvestments = investments.reduce((acc, curr) => acc + curr.value, 0);
  const totalDebt = liabilities.reduce((acc, curr) => acc + curr.amount, 0);
  const netWorth = totalCash + totalInvestments - totalDebt;
  const netCash = totalCash - totalDebt;

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

    try {
      if (editingItem) {
        await updateDoc(doc(db, `users/${user.uid}/accounts`, editingItem.id), { name, balance, updatedAt: new Date().toISOString() });
        setNotification({ message: 'Account updated successfully', type: 'success' });
      } else {
        await addDoc(collection(db, `users/${user.uid}/accounts`), {
          userId: user.uid,
          name,
          balance,
          updatedAt: new Date().toISOString()
        });
        setNotification({ message: 'Account added successfully', type: 'success' });
      }
      setIsAccountModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/accounts`);
    }
  };

  const handleAddInvestment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const value = Number(formData.get('value'));
    const category = formData.get('category') as string;

    try {
      if (editingItem) {
        await updateDoc(doc(db, `users/${user.uid}/investments`, editingItem.id), { name, value, category, updatedAt: new Date().toISOString() });
        setNotification({ message: 'Investment updated successfully', type: 'success' });
      } else {
        await addDoc(collection(db, `users/${user.uid}/investments`), {
          userId: user.uid,
          name,
          value,
          category,
          updatedAt: new Date().toISOString()
        });
        setNotification({ message: 'Investment added successfully', type: 'success' });
      }
      setIsInvestmentModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/investments`);
    }
  };

  const handleAddLiability = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const amount = Number(formData.get('amount'));

    try {
      if (editingItem) {
        await updateDoc(doc(db, `users/${user.uid}/liabilities`, editingItem.id), { name, amount, updatedAt: new Date().toISOString() });
        setNotification({ message: 'Liability updated successfully', type: 'success' });
      } else {
        await addDoc(collection(db, `users/${user.uid}/liabilities`), {
          userId: user.uid,
          name,
          amount,
          updatedAt: new Date().toISOString()
        });
        setNotification({ message: 'Liability added successfully', type: 'success' });
      }
      setIsLiabilityModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/liabilities`);
    }
  };

  const handleAddInformation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as Information['type'];
    const provider = formData.get('provider') as string;
    const accountNumber = formData.get('accountNumber') as string;
    const accountName = formData.get('accountName') as string;

    try {
      if (editingItem) {
        await updateDoc(doc(db, `users/${user.uid}/information`, editingItem.id), { 
          type, 
          provider, 
          accountNumber, 
          accountName, 
          updatedAt: new Date().toISOString() 
        });
        setNotification({ message: 'Information updated successfully', type: 'success' });
      } else {
        await addDoc(collection(db, `users/${user.uid}/information`), {
          userId: user.uid,
          type,
          provider,
          accountNumber,
          accountName,
          updatedAt: new Date().toISOString()
        });
        setNotification({ message: 'Information added successfully', type: 'success' });
      }
      setIsInformationModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/information`);
    }
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
      setNotification({ message: 'Please select a target account. If the list is empty, add an account first.', type: 'error' });
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
      setNotification({ message: editingItem ? 'Transaction updated' : 'Transaction recorded', type: 'success' });
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
          const path = `users/${user.uid}/accounts/${accountId}`;
          try {
            await updateDoc(doc(db, path), { 
              balance: increment(balanceChange),
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, path);
          }
        }
      } else if (investment) {
        let valueChange = 0;
        if (type === 'investment_deposit') valueChange = amount * multiplier;
        if (type === 'investment_withdrawal') valueChange = -amount * multiplier;

        if (valueChange !== 0) {
          const path = `users/${user.uid}/investments/${accountId}`;
          try {
            await updateDoc(doc(db, path), { 
              value: increment(valueChange),
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, path);
          }
        }
      } else if (liability) {
        let amountChange = 0;
        if (type === 'debt_payment') amountChange = -amount * multiplier;
        if (type === 'debt_expense') amountChange = amount * multiplier;

        if (amountChange !== 0) {
          const path = `users/${user.uid}/liabilities/${accountId}`;
          try {
            await updateDoc(doc(db, path), { 
              amount: increment(amountChange),
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, path);
          }
        }
      }
    } catch (err) {
      console.error("Error in updateAccountBalance:", err);
      // We don't necessarily want to crash the whole app if balance update fails, 
      // but we should log it. handleFirestoreError will throw, which triggers ErrorBoundary.
      // If we want to be more graceful, we could just setNotification.
      // But the guidelines say we MUST throw.
      throw err;
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

  const clearAllData = async () => {
    if (!user) return;
    
    try {
      const batch = writeBatch(db);
      
      // Add all items to batch
      accounts.forEach(item => batch.delete(doc(db, `users/${user.uid}/accounts`, item.id)));
      investments.forEach(item => batch.delete(doc(db, `users/${user.uid}/investments`, item.id)));
      liabilities.forEach(item => batch.delete(doc(db, `users/${user.uid}/liabilities`, item.id)));
      transactions.forEach(item => batch.delete(doc(db, `users/${user.uid}/transactions`, item.id)));
      information.forEach(item => batch.delete(doc(db, `users/${user.uid}/information`, item.id)));
      
      await batch.commit();
      
      setIsClearAllConfirmOpen(false);
      setNotification({ message: 'All data cleared successfully', type: 'success' });
    } catch (err) {
      console.error("Error clearing data:", err);
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setNotification({ message: "This domain is not authorized in Firebase Console. Please add it to 'Authorized Domains'.", type: 'error' });
      } else if (error.code === 'auth/popup-blocked') {
        setNotification({ message: "Login popup was blocked by your browser. Please allow popups for this site.", type: 'error' });
      } else {
        setNotification({ message: "Login failed: " + error.message, type: 'error' });
      }
    }
  };

  const handleAppleLogin = async () => {
    try {
      await signInWithApple();
    } catch (error: any) {
      console.error("Apple Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setNotification({ message: "This domain is not authorized in Firebase Console. Please add it to 'Authorized Domains'.", type: 'error' });
      } else if (error.code === 'auth/popup-blocked') {
        setNotification({ message: "Login popup was blocked by your browser. Please allow popups for this site.", type: 'error' });
      } else {
        setNotification({ message: "Apple login failed: " + error.message, type: 'error' });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-luxury-bg flex items-center justify-center relative overflow-hidden">
        <Background />
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-2 border-luxury-accent/20 border-t-luxury-accent rounded-full"
          />
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-luxury-accent rounded-full blur-xl"
          />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-luxury-bg flex items-center justify-center p-4 relative overflow-hidden">
        <Background />
        
        {/* Hero Image Background (Subtle) */}
        <div className="absolute inset-0 z-0 opacity-20">
          <img 
            src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop" 
            className="w-full h-full object-cover grayscale"
            alt="Background"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-luxury-bg via-luxury-bg/80 to-transparent" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="w-full max-w-md text-center relative z-10"
        >
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-24 h-24 bg-gradient-to-br from-luxury-accent to-[#00c9ab] rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-luxury-accent/30"
          >
            <TrendingUp size={48} className="text-black" />
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-6xl font-display font-black text-white mb-4 tracking-tighter"
          >
            LuxWealth
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/50 mb-12 text-xl font-light tracking-wide max-w-[280px] mx-auto"
          >
            The pinnacle of personal finance for the modern era.
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
            Secure • Private • Elegant
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-luxury-bg text-white font-sans selection:bg-luxury-accent/30">
        <Background />
        
        {/* Navigation */}
        <nav className="sticky top-0 z-40 glass-dark border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-20 items-center">
              <div className="flex items-center gap-3 group cursor-pointer">
                <div className="w-10 h-10 bg-luxury-accent rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg shadow-luxury-accent/20">
                  <TrendingUp size={24} className="text-black" />
                </div>
                <span className="text-2xl font-display font-bold tracking-tighter">LuxWealth</span>
              </div>
              
              <div className="hidden md:flex items-center gap-8">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={cn(
                    "text-sm font-semibold tracking-wider uppercase transition-all hover:text-luxury-accent",
                    activeTab === 'dashboard' ? "text-luxury-accent" : "text-white/40"
                  )}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => setActiveTab('information')}
                  className={cn(
                    "text-sm font-semibold tracking-wider uppercase transition-all hover:text-luxury-accent",
                    activeTab === 'information' ? "text-luxury-accent" : "text-white/40"
                  )}
                >
                  Accounts
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-sm font-bold">{user.displayName}</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">Premium Member</span>
                </div>
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=00e5c2&color=000`} 
                  className="w-10 h-10 rounded-xl border border-white/10"
                  alt="Avatar"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setIsClearAllConfirmOpen(true)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-orange-400"
                  title="Clear All Data"
                >
                  <RefreshCcw size={20} />
                </button>
                <button 
                  onClick={() => logout()}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-red-400"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {activeTab === 'dashboard' ? (
          <>
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
                  Welcome back, <span className="text-luxury-accent">{user.displayName?.split(' ')[0]}</span>
                </h1>
                <p className="text-white/40 text-lg font-medium">Here's your financial overview for today.</p>
              </motion.div>
              
              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => setIsTransactionModalOpen(true)}
                  className="px-8"
                >
                  <Plus size={18} className="mr-2" />
                  New Transaction
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
              <Card className="relative overflow-hidden group border-white/5">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                      <Wallet size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Liquidity</span>
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-1 tracking-tight">{formatCurrency(totalCash)}</h3>
                  <p className="text-[10px] text-emerald-400/60 font-medium">Available Cash</p>
                </div>
              </Card>

              <Card className="relative overflow-hidden group border-white/5">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                      <TrendingUp size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Growth</span>
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-1 tracking-tight">{formatCurrency(totalInvestments)}</h3>
                  <p className="text-[10px] text-indigo-400/60 font-medium">Total Investments</p>
                </div>
              </Card>

              <Card className="relative overflow-hidden group border-white/5">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all duration-500" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
                      <CreditCard size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Liabilities</span>
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-1 tracking-tight">{formatCurrency(totalDebt)}</h3>
                  <p className="text-[10px] text-rose-400/60 font-medium">Outstanding Debt</p>
                </div>
              </Card>

              <Card className="relative overflow-hidden group border-white/5">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-luxury-accent/10 rounded-full blur-2xl group-hover:bg-luxury-accent/20 transition-all duration-500" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-luxury-accent/10 rounded-lg text-luxury-accent">
                      <PieChartIcon size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Net Cash</span>
                  </div>
                  <h3 className={cn("text-2xl font-display font-bold mb-1 tracking-tight", netCash >= 0 ? "text-luxury-accent" : "text-rose-400")}>
                    {formatCurrency(netCash)}
                  </h3>
                  <p className="text-[10px] text-white/20 font-medium">Cash - Debt</p>
                </div>
              </Card>

              <Card className="relative overflow-hidden group bg-luxury-accent border-none text-black">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-2xl group-hover:bg-white/30 transition-all duration-500" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-black/10 rounded-lg text-black">
                      <TrendingUp size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">Net Worth</span>
                  </div>
                  <h3 className="text-3xl font-display font-bold mb-1 tracking-tight">{formatCurrency(netWorth)}</h3>
                  <p className="text-[10px] text-black/40 font-bold">Total Portfolio Value</p>
                </div>
              </Card>
            </section>

        {/* Charts Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <Card className="lg:col-span-2 bg-[#1a1d23]/50 backdrop-blur-xl border-[#2a2e36] relative overflow-hidden p-10">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-right from-transparent via-[#00e5c2]/50 to-transparent" />
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-luxury-accent/10 rounded-xl text-luxury-accent">
                  <BarChart3 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold tracking-tight">Asset Allocation</h3>
                  <p className="text-[11px] text-white/40 uppercase tracking-widest">Portfolio Distribution</p>
                </div>
              </div>
            </div>
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetAllocationData} margin={{ top: 30, right: 40, left: 40, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 'bold' }}
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 'bold' }}
                    tickFormatter={(value) => formatCurrency(value).replace('Rp', '')}
                    width={90}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ 
                      backgroundColor: '#0f1115', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      padding: '12px'
                    }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => [formatCurrency(value), 'Value']}
                  />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={70}>
                    {assetAllocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12">
              {assetAllocationData.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">{item.name}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-[#1a1d23]/50 backdrop-blur-xl border-[#2a2e36] flex flex-col relative overflow-hidden p-10">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-right from-transparent via-purple-500/50 to-transparent" />
            <div className="flex items-center gap-4 mb-12">
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <PieChartIcon size={24} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-[#e6e8eb]">Allocation</h3>
                <p className="text-xs text-[#e6e8eb]/40">Portfolio diversification</p>
              </div>
            </div>
            <div className="h-[260px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
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
                    innerRadius={70}
                    outerRadius={95}
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
            <div className="mt-auto pt-12 flex flex-col gap-4">
              {assetAllocationData.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-[#e6e8eb]/60 uppercase tracking-wider">{item.name}</span>
                  </div>
                  <span className="text-sm font-black text-[#e6e8eb]">{item.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Data Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 mb-16">
          {/* Cash Accounts */}
          <Card className="relative overflow-hidden border-white/5 p-10">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400">
                  <Wallet size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-display font-bold tracking-tight">Accounts</h3>
                  <p className="text-xs text-white/40 uppercase tracking-[0.2em]">Liquid Assets</p>
                </div>
              </div>
              <Button 
                onClick={() => { setEditingItem(null); setIsAccountModalOpen(true); }} 
                variant="secondary"
                className="p-3 rounded-2xl"
              >
                <Plus size={20} />
              </Button>
            </div>
            <div className="space-y-6">
              {accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/10">
                  <Wallet size={64} className="mb-6 opacity-10" />
                  <p className="text-base font-medium">No accounts added</p>
                </div>
              ) : (
                accounts.map(account => (
                  <motion.div 
                    key={account.id}
                    whileHover={{ x: 4 }}
                    className="group flex items-center justify-between p-6 bg-white/5 rounded-[2rem] border border-white/5 hover:border-emerald-500/30 transition-all"
                  >
                    <div>
                      <p className="text-sm font-bold tracking-tight">{account.name}</p>
                      <p className="text-lg font-display font-bold text-emerald-400">{formatCurrency(account.balance)}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingItem(account); setIsAccountModalOpen(true); }}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-emerald-400 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => deleteItem('accounts', account.id)}
                        className="p-2 bg-white/5 hover:bg-rose-500/20 rounded-lg text-white/40 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>

          {/* Investments */}
          <Card className="relative overflow-hidden border-white/5 p-10">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400">
                  <TrendingUp size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-display font-bold tracking-tight">Investments</h3>
                  <p className="text-xs text-white/40 uppercase tracking-[0.2em]">Growth Portfolio</p>
                </div>
              </div>
              <Button 
                onClick={() => { setEditingItem(null); setIsInvestmentModalOpen(true); }} 
                variant="secondary"
                className="p-3 rounded-2xl"
              >
                <Plus size={20} />
              </Button>
            </div>
            <div className="space-y-6">
              {investments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/10">
                  <TrendingUp size={64} className="mb-6 opacity-10" />
                  <p className="text-base font-medium">No investments added</p>
                </div>
              ) : (
                investments.map(inv => (
                  <motion.div 
                    key={inv.id}
                    whileHover={{ x: 4 }}
                    className="group flex items-center justify-between p-6 bg-white/5 rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all"
                  >
                    <div>
                      <p className="text-sm font-bold tracking-tight">{inv.name}</p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">{inv.category}</span>
                      </div>
                      <p className="text-lg font-display font-bold text-indigo-400">{formatCurrency(inv.value)}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingItem(inv); setIsInvestmentModalOpen(true); }}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-indigo-400 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => deleteItem('investments', inv.id)}
                        className="p-2 bg-white/5 hover:bg-rose-500/20 rounded-lg text-white/40 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>

          {/* Liabilities */}
          <Card className="relative overflow-hidden border-white/5 p-10">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-400">
                  <CreditCard size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-display font-bold tracking-tight">Liabilities</h3>
                  <p className="text-xs text-white/40 uppercase tracking-[0.2em]">Outstanding Debt</p>
                </div>
              </div>
              <Button 
                onClick={() => { setEditingItem(null); setIsLiabilityModalOpen(true); }} 
                variant="secondary"
                className="p-3 rounded-2xl"
              >
                <Plus size={20} />
              </Button>
            </div>
            <div className="space-y-6">
              {liabilities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/10">
                  <CreditCard size={64} className="mb-6 opacity-10" />
                  <p className="text-base font-medium">No liabilities added</p>
                </div>
              ) : (
                liabilities.map(debt => (
                  <motion.div 
                    key={debt.id}
                    whileHover={{ x: 4 }}
                    className="group flex items-center justify-between p-6 bg-white/5 rounded-[2rem] border border-white/5 hover:border-rose-500/30 transition-all"
                  >
                    <div>
                      <p className="text-sm font-bold tracking-tight">{debt.name}</p>
                      <p className="text-lg font-display font-bold text-rose-400">{formatCurrency(debt.amount)}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingItem(debt); setIsLiabilityModalOpen(true); }}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-rose-400 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => deleteItem('liabilities', debt.id)}
                        className="p-2 bg-white/5 hover:bg-rose-500/20 rounded-lg text-white/40 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Transactions History */}
        <Card className="relative overflow-hidden border-white/5">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-lg text-white/60">
                <History size={20} />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold tracking-tight">Recent Transactions</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Complete Ledger</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => { setIsTransactionModalOpen(true); setSelectedTransactionType('expense'); }} 
                variant="primary" 
                className="bg-white text-black hover:bg-gray-200 py-2 px-4 text-xs rounded-xl font-bold tracking-tight transition-all active:scale-95"
              >
                <Plus size={14} className="mr-2" /> New Transaction
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-white/20">Date</th>
                  <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-white/20">Type</th>
                  <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-white/20">Account</th>
                  <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-white/20">Amount</th>
                  <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-white/20">Notes</th>
                  <th className="pb-4 text-right text-[10px] font-bold uppercase tracking-widest text-white/20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-white/10">
                      <div className="flex flex-col items-center">
                        <History size={48} className="mb-4 opacity-10" />
                        <p className="text-sm font-medium">No transactions found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map(t => (
                    <motion.tr 
                      key={t.id}
                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                      className="group transition-colors"
                    >
                      <td className="py-4 text-sm text-white/60 font-mono">
                        {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest",
                          t.type === 'income' ? "bg-emerald-500/10 text-emerald-400" :
                          t.type === 'expense' ? "bg-rose-500/10 text-rose-400" :
                          t.type === 'investment_deposit' ? "bg-indigo-500/10 text-indigo-400" :
                          t.type === 'investment_withdrawal' ? "bg-amber-500/10 text-amber-400" :
                          t.type === 'debt_payment' ? "bg-sky-500/10 text-sky-400" :
                          t.type === 'debt_expense' ? "bg-rose-500/10 text-rose-400" :
                          "bg-white/5 text-white/40"
                        )}>
                          {t.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className="text-sm font-bold tracking-tight">
                          {accounts.find(a => a.id === t.accountId)?.name || 
                           investments.find(i => i.id === t.accountId)?.name || 
                           liabilities.find(l => l.id === t.accountId)?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className={cn(
                        "py-4 font-display font-bold",
                        t.type === 'income' || t.type === 'investment_withdrawal' || t.type === 'debt_expense' ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {t.type === 'income' || t.type === 'investment_withdrawal' || t.type === 'debt_expense' ? '+' : '-'}{formatCurrency(t.amount)}
                      </td>
                      <td className="py-4">
                        <p className="text-xs text-white/40 max-w-[200px] truncate">{t.notes || '-'}</p>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => { 
                              setEditingItem(t); 
                              setSelectedTransactionType(t.type);
                              setSelectedAccountId(t.accountId);
                              setIsTransactionModalOpen(true); 
                            }}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-emerald-400 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => deleteTransaction(t)}
                            className="p-2 bg-white/5 hover:bg-rose-500/20 rounded-lg text-white/40 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {transactions.length === 0 && <p className="text-center text-white/10 py-12">No transactions yet</p>}
        </Card>
      </>
    ) : (
      <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-display font-bold tracking-tight mb-2">Banking & E-Wallet</h2>
                <p className="text-white/40 max-w-md">Securely manage your account numbers and digital wallet credentials for quick reference.</p>
              </div>
              <Button 
                onClick={() => { setEditingItem(null); setIsInformationModalOpen(true); }}
                className="bg-emerald-500 text-black hover:bg-emerald-400 py-3 px-6 rounded-2xl font-bold tracking-tight transition-all active:scale-95 flex items-center gap-2"
              >
                <Plus size={18} /> Add New Info
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {information.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white/5 rounded-[2rem] border border-dashed border-white/10">
                  <div className="p-4 bg-white/5 rounded-full mb-4">
                    <CreditCard size={32} className="text-white/20" />
                  </div>
                  <p className="text-white/40 font-medium">No banking information added yet</p>
                </div>
              ) : (
                information.map((info) => (
                  <motion.div
                    key={info.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -4 }}
                    className={cn(
                      "group relative p-6 bg-white/5 rounded-[2rem] border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer",
                      selectedInfoId === info.id && "border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                    )}
                    onClick={() => setSelectedInfoId(selectedInfoId === info.id ? null : info.id)}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-3 rounded-2xl text-white/60 group-hover:text-emerald-400 transition-colors",
                          info.type === 'bank' ? "bg-blue-500/10" : 
                          info.type === 'ewallet' ? "bg-emerald-500/10" :
                          info.type === 'crypto' ? "bg-orange-500/10" :
                          "bg-purple-500/10"
                        )}>
                          {info.type === 'bank' ? <Wallet size={24} /> : 
                           info.type === 'ewallet' ? <CreditCard size={24} /> :
                           info.type === 'crypto' ? <TrendingUp size={24} /> :
                           <LayoutDashboard size={24} />}
                        </div>
                        <div>
                          <h3 className="font-bold tracking-tight">{info.provider}</h3>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">{info.type}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingItem(info); setIsInformationModalOpen(true); }}
                          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-emerald-400 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteItem('information', info.id); }}
                          className="p-2 bg-white/5 hover:bg-rose-500/20 rounded-lg text-white/40 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                        <p className="text-[10px] text-white/20 uppercase tracking-widest mb-1">Account Number / Phone</p>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-mono font-medium tracking-wider text-white/80">
                            {selectedInfoId === info.id ? info.accountNumber : info.accountNumber.replace(/.(?=.{4})/g, '•')}
                          </p>
                          <button 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(info.accountNumber); }}
                            className="p-2 hover:bg-white/5 rounded-lg text-white/20 hover:text-emerald-400 transition-colors"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {info.accountName && (
                        <div>
                          <p className="text-[10px] text-white/20 uppercase tracking-widest mb-1">Account Name</p>
                          <p className="font-bold tracking-tight text-white/60 uppercase">{info.accountName}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
        title={editingItem ? "Edit Asset" : "Add Asset"}
      >
        <form onSubmit={handleAddAccount} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Account Name</label>
              <input 
                name="name" 
                defaultValue={editingItem?.name}
                required 
                placeholder="e.g. BCA, BRI, Cash"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Balance (IDR)</label>
              <input 
                name="balance" 
                type="number" 
                defaultValue={editingItem?.balance}
                required 
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>
          <Button className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-bold tracking-tight hover:bg-emerald-400 transition-all active:scale-[0.98]">
            {editingItem ? "Update Asset" : "Create Asset"}
          </Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isInvestmentModalOpen} 
        onClose={() => setIsInvestmentModalOpen(false)} 
        title={editingItem ? "Edit Investment" : "Add Investment"}
      >
        <form onSubmit={handleAddInvestment} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Investment Name</label>
              <input 
                name="name" 
                defaultValue={editingItem?.name}
                required 
                placeholder="e.g. Gold, SBN"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Category</label>
              <select 
                name="category" 
                defaultValue={editingItem?.category || 'Stocks'}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all appearance-none"
              >
                <option value="Gold" className="bg-[#0a0a0a]">Gold</option>
                <option value="Stocks" className="bg-[#0a0a0a]">Stocks</option>
                <option value="Mutual Funds" className="bg-[#0a0a0a]">Mutual Funds</option>
                <option value="Bank Interest" className="bg-[#0a0a0a]">Bank Interest</option>
                <option value="Deposito" className="bg-[#0a0a0a]">Deposito</option>
                <option value="Crypto" className="bg-[#0a0a0a]">Crypto</option>
                <option value="Valas" className="bg-[#0a0a0a]">Valas</option>
                <option value="Others" className="bg-[#0a0a0a]">Others</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Value (IDR)</label>
              <input 
                name="value" 
                type="number" 
                defaultValue={editingItem?.value}
                required 
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>
          <Button className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-bold tracking-tight hover:bg-emerald-400 transition-all active:scale-[0.98]">
            {editingItem ? "Update Investment" : "Create Investment"}
          </Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isLiabilityModalOpen} 
        onClose={() => setIsLiabilityModalOpen(false)} 
        title={editingItem ? "Edit Liability" : "Add Liability"}
      >
        <form onSubmit={handleAddLiability} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Liability Name</label>
              <input 
                name="name" 
                defaultValue={editingItem?.name}
                required 
                placeholder="e.g. Credit Card, Loan"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Amount (IDR)</label>
              <input 
                name="amount" 
                type="number" 
                defaultValue={editingItem?.amount}
                required 
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>
          <Button className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-bold tracking-tight hover:bg-emerald-400 transition-all active:scale-[0.98]">
            {editingItem ? "Update Liability" : "Create Liability"}
          </Button>
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
            <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Transaction Type</label>
            <select 
              name="type" 
              value={selectedTransactionType}
              onChange={(e) => {
                setSelectedTransactionType(e.target.value);
                setSelectedAccountId(''); // Reset account when type changes
              }}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all appearance-none"
            >
              <option value="income" className="bg-[#0a0a0a]">Income (Add to Cash)</option>
              <option value="expense" className="bg-[#0a0a0a]">Expense (Spend from Cash)</option>
              <option value="investment_deposit" className="bg-[#0a0a0a]">Investment Deposit</option>
              <option value="investment_withdrawal" className="bg-[#0a0a0a]">Investment Withdrawal</option>
              <option value="debt_payment" className="bg-[#0a0a0a]">Debt Payment (Reduce Debt)</option>
              <option value="debt_expense" className="bg-[#0a0a0a]">Debt Expense (Increase Debt)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Target Account</label>
            <select 
              name="accountId" 
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all appearance-none"
            >
              <option value="" disabled className="bg-[#0a0a0a]">Select an account</option>
              {(selectedTransactionType === 'income' || selectedTransactionType === 'expense') && (
                <optgroup label="Cash Accounts" className="bg-[#0a0a0a]">
                  {accounts.map(a => <option key={a.id} value={a.id} className="bg-[#0a0a0a]">{a.name}</option>)}
                </optgroup>
              )}
              {(selectedTransactionType === 'investment_deposit' || selectedTransactionType === 'investment_withdrawal') && (
                <optgroup label="Investments" className="bg-[#0a0a0a]">
                  {investments.map(i => <option key={i.id} value={i.id} className="bg-[#0a0a0a]">{i.name}</option>)}
                </optgroup>
              )}
              {(selectedTransactionType === 'debt_payment' || selectedTransactionType === 'debt_expense') && (
                <optgroup label="Liabilities" className="bg-[#0a0a0a]">
                  {liabilities.map(l => <option key={l.id} value={l.id} className="bg-[#0a0a0a]">{l.name}</option>)}
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
            <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Amount (IDR)</label>
            <input 
              name="amount" 
              type="number" 
              defaultValue={editingItem?.amount}
              required 
              placeholder="0"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Notes</label>
            <input 
              name="notes" 
              defaultValue={editingItem?.notes}
              placeholder="Optional notes"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
          <Button className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-bold tracking-tight hover:bg-emerald-400 transition-all active:scale-[0.98]">
            {editingItem ? "Update Transaction" : "Record Transaction"}
          </Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isInformationModalOpen} 
        onClose={() => { 
          setIsInformationModalOpen(false); 
          setEditingItem(null);
        }} 
        title={editingItem ? "Edit Information" : "Add Information"}
      >
        <form onSubmit={handleAddInformation} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Type</label>
            <select 
              name="type" 
              defaultValue={editingItem?.type || 'bank'} 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all appearance-none"
            >
              <option value="bank" className="bg-[#0a0a0a]">Bank Account</option>
              <option value="ewallet" className="bg-[#0a0a0a]">E-Wallet</option>
              <option value="crypto" className="bg-[#0a0a0a]">Crypto Wallet</option>
              <option value="rdn" className="bg-[#0a0a0a]">RDN Account</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Provider Name</label>
            <input 
              name="provider" 
              defaultValue={editingItem?.provider} 
              required 
              placeholder="e.g. BCA, Mandiri, GoPay, OVO" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Account Number / Phone</label>
            <input 
              name="accountNumber" 
              defaultValue={editingItem?.accountNumber} 
              required 
              placeholder="e.g. 1234567890" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Account Name</label>
            <input 
              name="accountName" 
              defaultValue={editingItem?.accountName} 
              placeholder="e.g. John Doe" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
          <Button className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-bold tracking-tight hover:bg-emerald-400 transition-all active:scale-[0.98]">
            Save Information
          </Button>
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
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <p className="text-white/80 text-center leading-relaxed">
              {deleteCollection === 'transactions' 
                ? "Are you sure you want to delete this transaction? This action will also automatically reverse the balance change on the associated account."
                : "Are you sure you want to delete this item? This action cannot be undone."}
            </p>
          </div>
          <div className="flex gap-4">
            <Button 
              onClick={() => setIsDeleteConfirmOpen(false)} 
              className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmDelete} 
              className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-400 transition-all active:scale-[0.98]"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isClearAllConfirmOpen} 
        onClose={() => setIsClearAllConfirmOpen(false)} 
        title="Clear All Data"
      >
        <div className="space-y-6">
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <p className="text-white/80 text-center leading-relaxed font-bold">
              WARNING: This will permanently delete ALL your accounts, investments, liabilities, and transactions.
            </p>
            <p className="text-white/60 text-center text-xs mt-2">
              This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-4">
            <Button 
              onClick={() => setIsClearAllConfirmOpen(false)} 
              className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
            >
              Cancel
            </Button>
            <Button 
              onClick={clearAllData} 
              className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-400 transition-all active:scale-[0.98]"
            >
              Clear Everything
            </Button>
          </div>
        </div>
      </Modal>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-[#e6e8eb]/20 text-sm">
        <p>&copy; 2026 LuxWealth Tracker. All rights reserved.</p>
      </footer>

      <AnimatePresence>
        {notification && (
          <Notification 
            message={notification.message} 
            type={notification.type} 
            onClose={() => setNotification(null)} 
          />
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
