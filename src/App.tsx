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
import { db, auth, signInWithGoogle, signInWithApple, logout, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, updateEmail, updatePassword } from './firebase';
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
  History,
  X,
  AlertCircle,
  Copy,
  Check,
  LayoutDashboard,
  Info,
  Database,
  RefreshCcw,
  Mail,
  Lock,
  User as UserIcon,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
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
  disabled,
  type = 'button'
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
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
      type={type}
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

const ProfileView = ({ 
  user, 
  onBack, 
  setNotification,
  onClearAll,
  setUser
}: { 
  user: User; 
  onBack: () => void; 
  setNotification: (n: { message: string; type: 'success' | 'error' } | null) => void;
  onClearAll: () => void;
  setUser: (u: User | null) => void;
}) => {
  const [newUsername, setNewUsername] = useState(user.displayName || '');
  const [newEmail, setNewEmail] = useState(user.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (newUsername !== user.displayName) {
        await updateProfile(user, { displayName: newUsername });
      }
      if (newEmail !== user.email) {
        await updateEmail(user, newEmail);
      }
      if (newPassword) {
        await updatePassword(user, newPassword);
      }
      
      // Force refresh user state in App
      if (auth.currentUser) {
        // Create a new object with the updated properties to ensure React detects the change
        setUser({ 
          ...auth.currentUser,
          displayName: newUsername,
          email: newEmail
        } as User);
      }
      
      setNotification({ message: 'Profile updated successfully', type: 'success' });
      onBack();
    } catch (error: any) {
      setNotification({ message: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto space-y-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-display font-bold tracking-tight">Profile Settings</h2>
      </div>

      <Card className="p-6">
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-luxury-accent/50 transition-all"
                placeholder="Username"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-luxury-accent/50 transition-all"
                placeholder="Email"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">New Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-luxury-accent/50 transition-all"
                placeholder="New Password"
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full py-3 text-base mt-2">
            {loading ? <RefreshCcw className="animate-spin w-4 h-4" /> : "Save Changes"}
          </Button>
        </form>
      </Card>

      <Card className="p-6 border-red-500/20 bg-red-500/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-red-500 mb-0.5">Danger Zone</h3>
            <p className="text-white/40 text-[10px]">Once you clear all data, there is no going back.</p>
          </div>
          <Button variant="danger" onClick={onClearAll} className="whitespace-nowrap py-2 px-4 text-xs">
            <Trash2 size={16} />
            Clear Data
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};


const BottomNav = ({ activeTab, setActiveTab, onPlusClick }: { 
  activeTab: string; 
  setActiveTab: (tab: any) => void;
  onPlusClick: () => void;
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 glass-dark border-t border-white/5 px-6 py-3 pb-8 sm:pb-4 flex justify-between items-center">
      <div className="max-w-md mx-auto w-full flex justify-between items-center">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'dashboard' ? "text-luxury-accent scale-110" : "text-white/40 hover:text-white/60")}
        >
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('stats')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'stats' ? "text-luxury-accent scale-110" : "text-white/40 hover:text-white/60")}
        >
          <PieChartIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Stats</span>
        </button>

        <div className="relative -top-6">
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onPlusClick}
            className="w-16 h-16 bg-luxury-accent rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,229,194,0.4)] text-black"
          >
            <Plus size={32} strokeWidth={3} />
          </motion.button>
        </div>

        <button 
          onClick={() => setActiveTab('transactions')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'transactions' ? "text-luxury-accent scale-110" : "text-white/40 hover:text-white/60")}
        >
          <History size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'profile' ? "text-luxury-accent scale-110" : "text-white/40 hover:text-white/60")}
        >
          <UserIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Profile</span>
        </button>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isProfileView, setIsProfileView] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [information, setInformation] = useState<Information[]>([]);


  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [isLiabilityModalOpen, setIsLiabilityModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isInformationModalOpen, setIsInformationModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stats' | 'transactions' | 'profile'>('dashboard');
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
      const docId = typeof itemToDelete === 'string' ? itemToDelete : itemToDelete.id;
      
      if (deleteCollection === 'transactions') {
        const tx = itemToDelete as Transaction;
        // Reverse balance impact
        await updateAccountBalance(tx.accountId, tx.type, tx.amount, true);
        // Delete transaction
        await deleteDoc(doc(db, `users/${user.uid}/transactions`, docId));
      } else {
        await deleteDoc(doc(db, `users/${user.uid}/${deleteCollection}`, docId));
      }
      
      setIsDeleteConfirmOpen(false);
      setItemToDelete(null);
      setDeleteCollection('');
    } catch (err) {
      console.error("Error deleting item:", err);
      const docId = typeof itemToDelete === 'string' ? itemToDelete : itemToDelete.id;
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/${deleteCollection}/${docId}`);
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setNotification({ message: "Please fill in all fields", type: 'error' });
      return;
    }
    setAuthLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!username) {
          setNotification({ message: "Please enter a username", type: 'error' });
          setAuthLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        // Force refresh user state to get displayName immediately
        setUser({ ...userCredential.user, displayName: username } as User);
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      let message = error.message;
      if (error.code === 'auth/user-not-found') message = "User not found.";
      if (error.code === 'auth/wrong-password') message = "Incorrect password.";
      if (error.code === 'auth/email-already-in-use') message = "Email already in use.";
      if (error.code === 'auth/weak-password') message = "Password should be at least 6 characters.";
      setNotification({ message, type: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setNotification({ message: "Please enter your email", type: 'error' });
      return;
    }
    setAuthLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setNotification({ message: "Password reset email sent!", type: 'success' });
      setIsResetMode(false);
    } catch (error: any) {
      console.error("Reset Error:", error);
      setNotification({ message: error.message, type: 'error' });
    } finally {
      setAuthLoading(false);
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

          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {isResetMode ? (
                <motion.form
                  key="reset"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleResetPassword}
                  className="space-y-4"
                >
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-5 h-5" />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-luxury-accent/50 transition-all"
                      required
                    />
                  </div>
                  <Button disabled={authLoading} className="w-full py-4 text-lg">
                    {authLoading ? <RefreshCcw className="animate-spin w-5 h-5" /> : "Send Reset Link"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsResetMode(false)}
                    className="text-luxury-accent/60 hover:text-luxury-accent text-sm font-medium flex items-center justify-center gap-2 mx-auto"
                  >
                    <ArrowLeft size={16} /> Back to Login
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="auth"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleEmailAuth}
                  className="space-y-4"
                >
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-5 h-5" />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-luxury-accent/50 transition-all"
                      required
                    />
                  </div>
                  {!isLoginMode && (
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-luxury-accent/50 transition-all"
                        required
                      />
                    </div>
                  )}
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-5 h-5" />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-luxury-accent/50 transition-all"
                      required
                    />
                  </div>
                  
                  {isLoginMode && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setIsResetMode(true)}
                        className="text-white/30 hover:text-white/60 text-xs font-medium transition-all"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  <Button disabled={authLoading} className="w-full py-4 text-lg">
                    {authLoading ? <RefreshCcw className="animate-spin w-5 h-5" /> : (isLoginMode ? "Sign In" : "Create Account")}
                  </Button>

                  <div className="flex items-center gap-4 py-2">
                    <div className="h-px bg-white/5 flex-1" />
                    <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold">Or continue with</span>
                    <div className="h-px bg-white/5 flex-1" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={handleLogin}
                      className="flex items-center justify-center gap-3 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
                    >
                      <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                      <span className="text-sm font-semibold">Google</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAppleLogin}
                      className="flex items-center justify-center gap-3 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 384 512">
                        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                      </svg>
                      <span className="text-sm font-semibold">Apple</span>
                    </button>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => setIsLoginMode(!isLoginMode)}
                      className="text-white/40 hover:text-white text-sm font-medium transition-all"
                    >
                      {isLoginMode ? "Don't have an account? " : "Already have an account? "}
                      <span className="text-luxury-accent">
                        {isLoginMode ? "Sign Up" : "Sign In"}
                      </span>
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
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

  const userDisplayName = user.displayName || user.email?.split('@')[0] || 'User';
  const userPhotoURL = user.photoURL || `https://ui-avatars.com/api/?name=${userDisplayName}&background=00e5c2&color=000`;

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
              

              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-sm font-bold">{userDisplayName}</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">Premium Member</span>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('profile')}
                  className="w-10 h-10 rounded-xl border border-white/10 overflow-hidden relative group"
                >
                  <img 
                    src={userPhotoURL} 
                    className="w-full h-full object-cover"
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Edit2 size={12} className="text-white" />
                  </div>
                </motion.button>
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

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-32">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              <ProfileView 
                user={user} 
                onBack={() => setActiveTab('dashboard')} 
                setNotification={setNotification}
                onClearAll={() => setIsClearAllConfirmOpen(true)}
                setUser={setUser}
              />

              <div className="pt-8 border-t border-white/5 space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-display font-bold tracking-tight mb-1">Banking & E-Wallet</h2>
                    <p className="text-white/40 text-xs max-w-md">Securely manage your account numbers and digital wallet credentials.</p>
                  </div>
                  <Button 
                    onClick={() => { setEditingItem(null); setIsInformationModalOpen(true); }}
                    className="bg-emerald-500 text-black hover:bg-emerald-400 py-2 px-4 rounded-xl text-sm font-bold tracking-tight transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Plus size={16} /> Add New Info
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {information.length === 0 ? (
                    <div className="col-span-full py-10 flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                      <div className="p-3 bg-white/5 rounded-full mb-3">
                        <CreditCard size={24} className="text-white/20" />
                      </div>
                      <p className="text-xs text-white/40 font-medium">No banking information added yet</p>
                    </div>
                  ) : (
                    information.map((info) => (
                      <motion.div
                        key={info.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -2 }}
                        className={cn(
                          "group relative p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer",
                          selectedInfoId === info.id && "border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                        )}
                        onClick={() => setSelectedInfoId(selectedInfoId === info.id ? null : info.id)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-xl text-white/60 group-hover:text-emerald-400 transition-colors",
                              info.type === 'bank' ? "bg-blue-500/10" : 
                              info.type === 'ewallet' ? "bg-emerald-500/10" :
                              info.type === 'crypto' ? "bg-orange-500/10" :
                              "bg-purple-500/10"
                            )}>
                              {info.type === 'bank' ? <Wallet size={20} /> : 
                               info.type === 'ewallet' ? <CreditCard size={20} /> :
                               info.type === 'crypto' ? <TrendingUp size={20} /> :
                               <LayoutDashboard size={20} />}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold tracking-tight">{info.provider}</h3>
                              <p className="text-[9px] text-white/40 uppercase tracking-widest">{info.type}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingItem(info); setIsInformationModalOpen(true); }}
                              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-emerald-400 transition-colors"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteItem('information', info.id); }}
                              className="p-1.5 bg-white/5 hover:bg-rose-500/20 rounded-lg text-white/40 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                            <p className="text-[9px] text-white/20 uppercase tracking-widest mb-1">Account Number / Phone</p>
                            <div className="flex items-center justify-between">
                              <p className="text-base font-mono font-medium tracking-wider text-white/80">
                                {selectedInfoId === info.id ? info.accountNumber : info.accountNumber.replace(/.(?=.{4})/g, '•')}
                              </p>
                              <button 
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(info.accountNumber); }}
                                className="p-1.5 hover:bg-white/5 rounded-lg text-white/20 hover:text-emerald-400 transition-colors"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                          
                          {info.accountName && (
                            <div>
                              <p className="text-[9px] text-white/20 uppercase tracking-widest mb-0.5">Account Name</p>
                              <p className="text-xs font-bold tracking-tight text-white/60 uppercase">{info.accountName}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'stats' ? (
            <div className="space-y-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-display font-bold tracking-tight">Portfolio Analytics</h1>
                <p className="text-white/40 text-sm font-medium">Detailed breakdown of your assets.</p>
              </div>
              {/* Allocation Chart Section */}
              <section className="mb-8">
                <Card className="bg-[#1a1d23]/50 backdrop-blur-xl border-[#2a2e36] flex flex-col md:flex-row relative overflow-hidden p-6 gap-6">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-right from-transparent via-purple-500/50 to-transparent" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-purple-500/10 rounded-xl">
                        <PieChartIcon size={24} className="text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-[#e6e8eb]">Allocation</h3>
                        <p className="text-xs text-[#e6e8eb]/40">Portfolio diversification</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {assetAllocationData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-bold text-[#e6e8eb]/60 uppercase tracking-wider">{item.name}</span>
                          </div>
                          <span className="text-sm font-black text-[#e6e8eb]">{item.percent.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 flex items-center justify-center min-h-[200px]">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={assetAllocationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={8}
                          dataKey="value"
                          onMouseEnter={(_, index) => setActivePieIndex(index)}
                          onMouseLeave={() => setActivePieIndex(null)}
                        >
                          {assetAllocationData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.color} 
                              stroke="none"
                              style={{
                                filter: activePieIndex === index ? `drop-shadow(0 0 12px ${entry.color}44)` : 'none',
                                opacity: activePieIndex === null || activePieIndex === index ? 1 : 0.6,
                                transition: 'all 0.3s ease'
                              }}
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="glass-dark p-4 rounded-2xl border border-white/10 shadow-2xl">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">{payload[0].name}</p>
                                  <p className="text-lg font-display font-bold text-white">{formatCurrency(payload[0].value as number)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </section>

              {/* Asset Portfolio - Moved to Stats for better mobile UX */}
              <section className="space-y-6 mb-8">
                <div>
                  <h2 className="text-2xl font-display font-bold tracking-tight mb-1">Asset Portfolio</h2>
                  <p className="text-white/40 text-xs max-w-md">Detailed view of your wealth distribution.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Liquid Assets Column */}
                  <Card className="lg:col-span-5 flex flex-col border-white/5 p-6 h-full">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                          <Wallet size={24} />
                        </div>
                        <div>
                          <h3 className="text-xl font-display font-bold tracking-tight">Liquid Assets</h3>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Cash & E-Wallets</p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => { setEditingItem(null); setIsAccountModalOpen(true); }} 
                        variant="secondary"
                        className="p-2 rounded-xl"
                      >
                        <Plus size={18} />
                      </Button>
                    </div>

                    <div className="flex-1 space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {accounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-white/10">
                          <Wallet size={48} className="mb-4 opacity-10" />
                          <p className="text-sm font-medium">No accounts added</p>
                        </div>
                      ) : (
                        accounts.map(account => (
                          <motion.div 
                            key={account.id}
                            whileHover={{ x: 4 }}
                            className="group flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-1 h-8 bg-emerald-500/20 rounded-full group-hover:bg-emerald-500 transition-colors" />
                              <div>
                                <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-0.5">{account.name}</p>
                                <p className="text-xl font-display font-bold text-white tracking-tight">{formatCurrency(account.balance)}</p>
                              </div>
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
                    
                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs font-bold text-white/20 uppercase tracking-widest">Total Liquidity</span>
                      <span className="text-lg font-display font-bold text-emerald-400">{formatCurrency(totalCash)}</span>
                    </div>
                  </Card>

                  {/* Investments & Liabilities Column */}
                  <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Investments Bento */}
                    <Card className="flex flex-col border-white/5 p-6 h-full">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                            <TrendingUp size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-display font-bold tracking-tight">Growth</h3>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">Investments</p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => { setEditingItem(null); setIsInvestmentModalOpen(true); }} 
                          variant="secondary"
                          className="p-2 rounded-xl"
                        >
                          <Plus size={18} />
                        </Button>
                      </div>

                      <div className="flex-1 space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {investments.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-white/10">
                            <TrendingUp size={48} className="mb-4 opacity-10" />
                            <p className="text-sm font-medium">No investments</p>
                          </div>
                        ) : (
                          investments.map(inv => (
                            <motion.div 
                              key={inv.id}
                              whileHover={{ x: 4 }}
                              className="group flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-0.5 truncate">{inv.name}</p>
                                <p className="text-base font-display font-bold text-white truncate">{formatCurrency(inv.value)}</p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <button 
                                  onClick={() => { setEditingItem(inv); setIsInvestmentModalOpen(true); }}
                                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-indigo-400 transition-colors"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  onClick={() => deleteItem('investments', inv.id)}
                                  className="p-1.5 bg-white/5 hover:bg-red-500/20 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                      
                      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                        <span className="text-xs font-bold text-white/20 uppercase tracking-widest">Total Growth</span>
                        <span className="text-lg font-display font-bold text-indigo-400">{formatCurrency(totalInvestments)}</span>
                      </div>
                    </Card>

                    {/* Liabilities Bento */}
                    <Card className="flex flex-col border-white/5 p-6 h-full">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
                            <CreditCard size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-display font-bold tracking-tight">Liabilities</h3>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">Outstanding Debt</p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => { setEditingItem(null); setIsLiabilityModalOpen(true); }} 
                          variant="secondary"
                          className="p-2 rounded-xl"
                        >
                          <Plus size={18} />
                        </Button>
                      </div>

                      <div className="flex-1 space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {liabilities.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-white/10">
                            <CreditCard size={48} className="mb-4 opacity-10" />
                            <p className="text-sm font-medium">No liabilities</p>
                          </div>
                        ) : (
                          liabilities.map(debt => (
                            <motion.div 
                              key={debt.id}
                              whileHover={{ x: 4 }}
                              className="group flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-rose-500/30 transition-all"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-0.5 truncate">{debt.name}</p>
                                <p className="text-base font-display font-bold text-rose-400 truncate">{formatCurrency(debt.amount)}</p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <button 
                                  onClick={() => { setEditingItem(debt); setIsLiabilityModalOpen(true); }}
                                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-rose-400 transition-colors"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  onClick={() => deleteItem('liabilities', debt.id)}
                                  className="p-1.5 bg-white/5 hover:bg-red-500/20 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                      
                      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                        <span className="text-xs font-bold text-white/20 uppercase tracking-widest">Total Debt</span>
                        <span className="text-lg font-display font-bold text-rose-400">{formatCurrency(totalDebt)}</span>
                      </div>
                    </Card>
                  </div>
                </div>
              </section>
            </div>
          ) : activeTab === 'transactions' ? (
            <div className="space-y-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-display font-bold tracking-tight">Transaction History</h1>
                <p className="text-white/40 text-sm font-medium">Your complete financial ledger.</p>
              </div>
              <section className="glass-dark rounded-[2rem] p-4 border border-white/5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-lg text-white/60">
                      <History size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-display font-bold tracking-tight">Recent Transactions</h3>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">Complete Ledger</p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-white/20">Date</th>
                        <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-white/20">Type</th>
                        <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-white/20">Account</th>
                        <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-white/20">Amount</th>
                        <th className="pb-2 text-[10px] font-bold uppercase tracking-widest text-white/20">Notes</th>
                        <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-widest text-white/20">Actions</th>
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
                            <td className="py-2 text-xs text-white/60 font-mono">
                              {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest",
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
                            <td className="py-2">
                              <span className="text-xs font-bold tracking-tight">
                                {accounts.find(a => a.id === t.accountId)?.name || 
                                 investments.find(i => i.id === t.accountId)?.name || 
                                 liabilities.find(l => l.id === t.accountId)?.name || 'Unknown'}
                              </span>
                            </td>
                            <td className={cn(
                              "py-2 font-display font-bold text-sm",
                              t.type === 'income' || t.type === 'investment_withdrawal' || t.type === 'debt_expense' ? "text-emerald-400" : "text-rose-400"
                            )}>
                              {t.type === 'income' || t.type === 'investment_withdrawal' || t.type === 'debt_expense' ? '+' : '-'}{formatCurrency(t.amount)}
                            </td>
                            <td className="py-2">
                              <p className="text-[10px] text-white/40 max-w-[150px] truncate">{t.notes || '-'}</p>
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => { setEditingItem(t); setSelectedTransactionType(t.type); setSelectedAccountId(t.accountId); setIsTransactionModalOpen(true); }}
                                  className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-luxury-accent transition-colors"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => deleteTransaction(t)}
                                  className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-rose-400 transition-colors"
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
              </section>
            </div>
          ) : (
            <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">
                  Welcome back, <span className="text-luxury-accent">{userDisplayName.split(' ')[0]}</span>
                </h1>
                <p className="text-white/40 text-xs font-medium">Here's your financial overview for today.</p>
              </motion.div>
            </div>

          {/* Stats Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="relative overflow-hidden group border-white/5 p-4">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-luxury-accent/10 rounded-full blur-2xl group-hover:bg-luxury-accent/20 transition-all duration-500" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-luxury-accent/10 rounded-lg text-luxury-accent">
                    <PieChartIcon size={16} />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Net Cash</span>
                </div>
                <h3 className={cn("text-lg font-display font-bold mb-0.5 tracking-tight", netCash >= 0 ? "text-luxury-accent" : "text-rose-400")}>
                  {formatCurrency(netCash)}
                </h3>
                <p className="text-[9px] text-white/20 font-medium">Cash - Debt</p>
              </div>
            </Card>

            <Card className="relative overflow-hidden group bg-luxury-accent border-none text-black p-4">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-2xl group-hover:bg-white/30 transition-all duration-500" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-black/10 rounded-lg text-black">
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/40">Net Worth</span>
                </div>
                <h3 className="text-xl font-display font-bold mb-0.5 tracking-tight">{formatCurrency(netWorth)}</h3>
                <p className="text-[9px] text-black/40 font-bold">Total Portfolio Value</p>
              </div>
            </Card>
          </section>

          {/* Small Info Grid */}
          <section className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 mb-1">Liquid Asset</p>
              <p className="text-xs font-display font-bold text-white">{formatCurrency(totalCash)}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 mb-1">Investment</p>
              <p className="text-xs font-display font-bold text-indigo-400">{formatCurrency(totalInvestments)}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 mb-1">Debt</p>
              <p className="text-xs font-display font-bold text-rose-400">{formatCurrency(totalDebt)}</p>
            </div>
          </section>
        </div>
      )}
    </main>

    <BottomNav 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onPlusClick={() => {
        setEditingItem(null);
        setSelectedTransactionType('expense');
        setIsTransactionModalOpen(true);
      }} 
    />

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
          <Button type="submit" className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-bold tracking-tight hover:bg-emerald-400 transition-all active:scale-[0.98]">
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
          <Button type="submit" className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-bold tracking-tight hover:bg-emerald-400 transition-all active:scale-[0.98]">
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
          <Button type="submit" className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-bold tracking-tight hover:bg-emerald-400 transition-all active:scale-[0.98]">
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
          <Button type="submit" className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-bold tracking-tight hover:bg-emerald-400 transition-all active:scale-[0.98]">
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
          <Button type="submit" className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-bold tracking-tight hover:bg-emerald-400 transition-all active:scale-[0.98]">
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
