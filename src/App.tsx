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
import { formatCurrency, cn, formatDate } from './utils';
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
  ArrowLeft,
  Calendar
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
    whileHover={onClick ? { scale: 1.02, y: -4 } : { y: -2 }}
    onClick={onClick}
    className={cn("card-3d relative overflow-hidden group/card", className)}
  >
    {/* Soft inner lighting */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/[0.02] rounded-full group-hover/card:scale-125 transition-all duration-500" />
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
  const variantClasses = {
    primary: "btn-3d-mint",
    secondary: "btn-3d-purple",
    danger: "btn-3d-rose",
    ghost: "btn-3d-slate"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      type={type}
      className={cn(
        "px-6 py-4 rounded-2xl font-bold font-display tracking-tight transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm", 
        variantClasses[variant], 
        className
      )}
    >
      {children}
    </button>
  );
};

const Background = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-gradient-to-b from-[#0e1124] via-[#090b17] to-[#04050a]">
    {/* Toy 3D Spheres Floating */}
    <div className="absolute top-[8%] left-[5%] w-72 h-72 rounded-full bg-gradient-to-br from-[#8a2be2]/15 to-[#00ffcc]/10 blur-3xl animate-float-cute" />
    <div className="absolute bottom-[10%] right-[5%] w-96 h-96 rounded-full bg-gradient-to-br from-[#ff007f]/10 to-[#8a2be2]/15 blur-3xl animate-float-cute-opposite" />
    <div className="absolute top-[40%] right-[15%] w-60 h-60 rounded-full bg-gradient-to-br from-[#00ffcc]/5 to-blue-500/10 blur-2xl animate-float-cute-fast" style={{ animationDelay: '2s' }} />

    {/* Sparkles / Cute Icons Floating */}
    <div className="absolute top-[15%] left-[25%] opacity-35 text-[#00ffcc] animate-bounce text-xl" style={{ animationDuration: '4s' }}>✨</div>
    <div className="absolute top-[20%] right-[30%] opacity-20 text-[#8a2be2] text-2xl animate-float-cute-fast">🪙</div>
    <div className="absolute bottom-[25%] left-[12%] opacity-35 text-[#ff007f] text-2xl animate-float-cute-opposite">✨</div>
    <div className="absolute bottom-[18%] right-[25%] opacity-25 text-yellow-300 text-3xl animate-bounce" style={{ animationDuration: '6s' }}>⭐</div>
    <div className="absolute top-[55%] left-[8%] opacity-15 text-purple-400 text-lg animate-pulse">🐷</div>

    {/* Retro Cute Perspective grid Overlay */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:3rem_3rem]" />
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
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.85, y: 50 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.85, y: 50 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-gradient-to-b from-[#1b204c] to-[#0f1129] border-4 border-black rounded-[2.5rem] p-8 shadow-[12px_12px_0px_rgba(0,0,0,1)] text-[#e6e8eb]"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-display font-black tracking-tight text-[#00ffcc]">{title}</h3>
            <button onClick={onClose} className="p-2.5 bg-black/40 hover:bg-[#8a2be2]/20 border-2 border-black rounded-xl transition-all hover:scale-105 active:scale-95 text-white cursor-pointer">
              <X size={18} />
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
      transition={{ type: "spring", damping: 15 }}
      className={cn(
        "fixed bottom-24 left-1/2 z-[100] px-6 py-4 rounded-2xl shadow-[6px_6px_0px_rgba(0,0,0,1)] flex items-center gap-3 border-4 border-black font-black font-display tracking-tight text-sm",
        type === 'success' ? "bg-gradient-to-r from-[#00ffcc] to-teal-400 text-black" : "bg-gradient-to-r from-[#ff007f] to-rose-600 text-white"
      )}
    >
      {type === 'success' ? <Check size={18} className="stroke-[3px]" /> : <AlertCircle size={18} className="stroke-[3px]" />}
      <span>{message}</span>
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
        setUser({ 
          ...auth.currentUser,
          displayName: newUsername,
          email: newEmail
        } as User);
      }
      
      setNotification({ message: 'Profile updated successfully!', type: 'success' });
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
      <div className="flex items-center gap-4 mb-2">
        <button onClick={onBack} className="p-3 bg-black/40 hover:bg-[#8a2be2]/20 border-2 border-black rounded-xl text-white cursor-pointer active:scale-90 transition-all">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-3xl font-display font-black tracking-tight text-white">Settings</h2>
      </div>

      <Card className="p-6">
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#00ffcc] uppercase tracking-[0.2em]">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-black/40 border-2 border-black rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-[#00ffcc] transition-all font-semibold"
                placeholder="Username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#00ffcc] uppercase tracking-[0.2em]">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-black/40 border-2 border-black rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-[#00ffcc] transition-all font-semibold"
                placeholder="Email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#00ffcc] uppercase tracking-[0.2em]">New Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-black/40 border-2 border-black rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-[#00ffcc] transition-all font-semibold"
                placeholder="New Password"
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full py-4 text-base mt-2">
            {loading ? <RefreshCcw className="animate-spin w-4 h-4 mx-auto" /> : "Save Changes 📁"}
          </Button>
        </form>
      </Card>

      <div className="bg-gradient-to-r from-red-600 to-rose-700 border-4 border-black p-6 rounded-[2.2rem] shadow-[6px_6px_0px_rgba(0,0,0,1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <h3 className="text-xl font-display font-black text-white mb-1">Danger Sandbox ⚠️</h3>
            <p className="text-white/80 text-xs">Once you wipe out your data, it's gone into space.</p>
          </div>
          <Button variant="danger" onClick={onClearAll} className="whitespace-nowrap py-3.5 px-5 text-xs font-black">
            <Trash2 size={14} className="stroke-[2.5px]" />
            Wipe Everything
          </Button>
        </div>
      </div>
    </motion.div>
  );
};


const BottomNav = ({ activeTab, setActiveTab, onPlusClick }: { 
  activeTab: string; 
  setActiveTab: (tab: any) => void;
  onPlusClick: () => void;
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#161933] border-4 border-black px-6 py-3 rounded-[2.5rem] shadow-[8px_8px_0px_rgba(0,0,0,1)] w-[92%] max-w-md flex justify-between items-center">
      <div className="w-full flex justify-between items-center relative">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300 cursor-pointer", activeTab === 'dashboard' ? "text-[#00ffcc] scale-110 font-bold" : "text-white/40 hover:text-white/70")}
        >
          <LayoutDashboard size={20} className={activeTab === 'dashboard' ? "stroke-[2.5px]" : "stroke-[2px]"} />
          <span className="text-[8px] font-black uppercase tracking-wider">Home</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('stats')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300 cursor-pointer", activeTab === 'stats' ? "text-[#00ffcc] scale-110 font-bold" : "text-white/40 hover:text-white/70")}
        >
          <PieChartIcon size={20} className={activeTab === 'stats' ? "stroke-[2.5px]" : "stroke-[2px]"} />
          <span className="text-[8px] font-black uppercase tracking-wider">Stats</span>
        </button>

        <div className="relative -top-7">
          <motion.button 
            whileHover={{ scale: 1.15, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onPlusClick}
            className="w-14 h-14 bg-[#00ffcc] border-4 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,1)] text-black cursor-pointer active:translate-y-1"
          >
            <Plus size={28} strokeWidth={4} />
          </motion.button>
        </div>

        <button 
          onClick={() => setActiveTab('transactions')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300 cursor-pointer", activeTab === 'transactions' ? "text-[#00ffcc] scale-110 font-bold" : "text-white/40 hover:text-white/70")}
        >
          <History size={20} className={activeTab === 'transactions' ? "stroke-[2.5px]" : "stroke-[2px]"} />
          <span className="text-[8px] font-black uppercase tracking-wider">Ledger</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300 cursor-pointer", activeTab === 'profile' ? "text-[#00ffcc] scale-110 font-bold" : "text-white/40 hover:text-white/70")}
        >
          <UserIcon size={20} className={activeTab === 'profile' ? "stroke-[2.5px]" : "stroke-[2px]"} />
          <span className="text-[8px] font-black uppercase tracking-wider">Config</span>
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
    const dueDate = formData.get('dueDate') as string;

    try {
      if (editingItem) {
        await updateDoc(doc(db, `users/${user.uid}/liabilities`, editingItem.id), { 
          name, 
          amount, 
          dueDate,
          updatedAt: new Date().toISOString() 
        });
        setNotification({ message: 'Liability updated successfully', type: 'success' });
      } else {
        await addDoc(collection(db, `users/${user.uid}/liabilities`), {
          userId: user.uid,
          name,
          amount,
          dueDate,
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
        
        {/* Playful Floating Background Shapes */}
        <div className="absolute top-[10%] left-[8%] w-16 h-16 bg-gradient-to-br from-pink-500 to-yellow-400 rounded-3xl rotate-12 opacity-30 animate-float-cute" />
        <div className="absolute bottom-[15%] right-[10%] w-20 h-20 bg-gradient-to-br from-[#00ffcc] to-blue-500 rounded-full opacity-20 animate-float-cute-opposite" />
        <div className="absolute top-[60%] left-[5%] text-4xl animate-bounce" style={{ animationDuration: '3.5s' }}>🪙</div>
        <div className="absolute top-[25%] right-[8%] text-4xl animate-bounce" style={{ animationDuration: '4s' }}>✨</div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Logo Mascot Block */}
          <div className="text-center mb-6">
            <motion.div 
              whileHover={{ scale: 1.15, rotate: [0, -12, 12, -8, 8, 0] }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
              className="w-24 h-24 bg-gradient-to-br from-[#8a2be2] via-purple-600 to-[#00ffcc] border-4 border-black rounded-[2.2rem] flex items-center justify-center mx-auto mb-4 shadow-[8px_8px_0px_rgba(0,0,0,1)] text-white relative cursor-pointer"
            >
              <TrendingUp size={44} className="text-white stroke-[3px]" />
              <span className="absolute -top-3 -right-3 text-2xl animate-spin-slow">⭐</span>
              <div className="absolute inset-2 border-2 border-white/20 rounded-[1.6rem] pointer-events-none" />
            </motion.div>
            
            <h1 className="text-5xl font-display font-black tracking-tighter text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              Lux<span className="text-[#00ffcc] underline decoration-[#8a2be2] decoration-4 underline-offset-4">Wealth</span>
            </h1>
            <p className="text-white/60 mt-2 text-sm font-medium tracking-wide">
              Your super cute, 3D financial companion 🐷💸
            </p>
          </div>

          {/* Form Card in 3D */}
          <div className="bg-gradient-to-b from-[#1b1e3d] to-[#12142b] border-4 border-black rounded-[3rem] p-8 shadow-[12px_12px_0px_rgba(0,0,0,1)] relative overflow-hidden">
            {/* Top Gloss edge */}
            <div className="absolute top-0 inset-x-0 h-1 bg-white/20" />
            
            <AnimatePresence mode="wait">
              {isResetMode ? (
                <motion.form
                  key="reset"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  onSubmit={handleResetPassword}
                  className="space-y-5"
                >
                  <h2 className="text-xl font-display font-extrabold text-[#00ffcc] text-center mb-2">Reset Password</h2>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/40 border-2 border-black rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-2 focus:ring-[#00ffcc]/10 transition-all font-medium"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={authLoading} className="w-full py-4 text-md">
                    {authLoading ? <RefreshCcw className="animate-spin w-5 h-5" /> : "Send Magic Reset Link ✨"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsResetMode(false)}
                    className="text-[#00ffcc] hover:underline text-xs font-semibold flex items-center justify-center gap-2 mx-auto mt-4 cursor-pointer"
                  >
                    <ArrowLeft size={14} /> Back to Sign In
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="auth"
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  onSubmit={handleEmailAuth}
                  className="space-y-4"
                >
                  <h2 className="text-xl font-display font-extrabold text-white text-center mb-1">
                    {isLoginMode ? "Good to see you! 👋" : "Join the squad! 🎉"}
                  </h2>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/40 border-2 border-black rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-2 focus:ring-[#00ffcc]/10 transition-all font-medium"
                      required
                    />
                  </div>
                  {!isLoginMode && (
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Choose a cool username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-black/40 border-2 border-black rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-2 focus:ring-[#00ffcc]/10 transition-all font-medium"
                        required
                      />
                    </div>
                  )}
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/40 border-2 border-black rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-2 focus:ring-[#00ffcc]/10 transition-all font-medium"
                      required
                    />
                  </div>
                  
                  {isLoginMode && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setIsResetMode(true)}
                        className="text-white/40 hover:text-[#00ffcc] text-xs font-semibold transition-all cursor-pointer"
                      >
                        Help, forgot password?
                      </button>
                    </div>
                  )}

                  <Button type="submit" disabled={authLoading} className="w-full py-4 text-md">
                    {authLoading ? <RefreshCcw className="animate-spin w-5 h-5 mx-auto" /> : (isLoginMode ? "Let me in! 🚀" : "Let's Go! 🎮")}
                  </Button>

                  <div className="flex items-center gap-3 py-2">
                    <div className="h-0.5 bg-black/60 flex-1" />
                    <span className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Or use 3D sign-in</span>
                    <div className="h-0.5 bg-black/60 flex-1" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={handleLogin}
                      className="flex items-center justify-center gap-3 py-3 px-4 bg-[#2a2d4a] hover:bg-[#34385c] border-2 border-black border-b-[5px] border-r-[3px] rounded-2xl text-sm font-bold active:border-b-2 active:border-r-2 active:translate-y-[3px] active:translate-x-[1px] transition-all cursor-pointer"
                    >
                      <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                      <span className="text-xs font-black">Google 📦</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAppleLogin}
                      className="flex items-center justify-center gap-3 py-3 px-4 bg-[#2a2d4a] hover:bg-[#34385c] border-2 border-black border-b-[5px] border-r-[3px] rounded-2xl text-sm font-bold active:border-b-2 active:border-r-2 active:translate-y-[3px] active:translate-x-[1px] transition-all cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 384 512">
                        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                      </svg>
                      <span className="text-xs font-black">Apple 🍎</span>
                    </button>
                  </div>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setIsLoginMode(!isLoginMode)}
                      className="text-white/50 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      {isLoginMode ? "New around here? " : "Already one of us? "}
                      <span className="text-[#00ffcc] underline font-bold">
                        {isLoginMode ? "Make Account" : "Sign In"}
                      </span>
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 0.8 }}
            className="mt-8 text-center text-[10px] font-black uppercase tracking-[0.25em] text-[#e6e8eb]"
          >
            🕹️ SECURE • PRIVACY ENCRYPTED • CUTE BUILD
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const userDisplayName = user.displayName || user.email?.split('@')[0] || 'User';
  const userPhotoURL = user.photoURL || `https://ui-avatars.com/api/?name=${userDisplayName}&background=00ffcc&color=000`;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0b0d19] text-white font-sans selection:bg-[#8a2be2]/30 pb-20">
        <Background />
        
        {/* Navigation */}
        <nav className="sticky top-0 z-40 bg-gradient-to-r from-[#171a35] via-[#101326] to-[#0c0e1b] border-b-4 border-black shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-20 items-center">
              <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                <div className="w-11 h-11 bg-gradient-to-br from-[#00ffcc] to-[#8a2be2] border-2 border-black rounded-2xl flex items-center justify-center group-hover:rotate-12 group-hover:scale-110 transition-all shadow-[3px_3px_0px_rgba(0,0,0,1)]">
                  <TrendingUp size={22} className="text-black stroke-[3px]" />
                </div>
                <span className="text-2xl font-display font-black tracking-tighter text-white">
                  Lux<span className="text-[#00ffcc] underline decoration-[#8a2be2] decoration-2 underline-offset-4">Wealth</span> <span className="text-sm">🐷</span>
                </span>
              </div>
              

              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-sm font-black tracking-tight text-white">{userDisplayName}</span>
                  <span className="text-[8px] mt-1 bg-[#8a2be2] text-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest shadow-[2px_2px_0px_rgba(0,0,0,1)] border border-black">Companion ⭐</span>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('profile')}
                  className="w-11 h-11 rounded-xl border-2 border-black overflow-hidden relative group shadow-[3px_3px_0px_rgba(0,0,0,1)] cursor-pointer bg-white"
                >
                  <img 
                    src={userPhotoURL} 
                    className="w-full h-full object-cover"
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Edit2 size={12} className="text-[#00ffcc]" />
                  </div>
                </motion.button>
                <button 
                  onClick={() => logout()}
                  className="p-2.5 bg-red-500/10 hover:bg-gradient-to-br from-[#ff007f] to-red-600 hover:text-white border-2 border-black rounded-xl transition-all active:scale-95 text-red-400 active:translate-y-0.5 shadow-[2px_2px_0px_rgba(0,0,0,1)] cursor-pointer"
                  title="Logout"
                >
                  <LogOut size={16} className="stroke-[2.5px]" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              <ProfileView 
                user={user} 
                onBack={() => setActiveTab('dashboard')} 
                setNotification={setNotification}
                onClearAll={() => setIsClearAllConfirmOpen(true)}
                setUser={setUser}
              />

              <div className="pt-8 border-t-4 border-black/40 space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-display font-black tracking-tight mb-1 text-white">Digital Vault 🔑</h2>
                    <p className="text-white/50 text-xs max-w-md font-medium">Manage your target banking account details and wallets securely.</p>
                  </div>
                  <Button 
                    onClick={() => { setEditingItem(null); setIsInformationModalOpen(true); }}
                    className="bg-[#00ffcc] text-black hover:bg-emerald-400 py-3 px-5 rounded-2xl text-xs font-black tracking-tight transition-all flex items-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] border-2 border-black active:translate-y-0.5"
                  >
                    <Plus size={16} className="stroke-[3px]" /> Add Credential
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {information.length === 0 ? (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center bg-[#151830] rounded-3xl border-4 border-dashed border-black">
                      <div className="p-4 bg-black/30 rounded-full mb-3 border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] animate-bounce">
                        <CreditCard size={28} className="text-[#00ffcc]" />
                      </div>
                      <p className="text-xs text-white/50 font-black">No bank credentials added yet!</p>
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
                          "group relative p-5 bg-[#171a35] rounded-3xl border-4 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-all cursor-pointer",
                          selectedInfoId === info.id ? "bg-[#1f2347] border-[#00ffcc] shadow-[0_0_20px_rgba(0,255,204,0.15)]" : ""
                        )}
                        onClick={() => setSelectedInfoId(selectedInfoId === info.id ? null : info.id)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] text-black",
                              info.type === 'bank' ? "bg-blue-400" : 
                              info.type === 'ewallet' ? "bg-[#00ffcc]" :
                              info.type === 'crypto' ? "bg-amber-400" :
                              "bg-purple-400"
                            )}>
                              {info.type === 'bank' ? <Wallet size={16} className="stroke-[2.5px]" /> : 
                               info.type === 'ewallet' ? <CreditCard size={16} className="stroke-[2.5px]" /> :
                               info.type === 'crypto' ? <TrendingUp size={16} className="stroke-[2.5px]" /> :
                               <LayoutDashboard size={16} className="stroke-[2.5px]" />}
                            </div>
                            <div>
                              <h3 className="text-sm font-black tracking-tight text-white mb-0.5">{info.provider}</h3>
                              <span className="text-[7.5px] bg-black/35 text-[#00ffcc] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-black">{info.type}</span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingItem(info); setIsInformationModalOpen(true); }}
                              className="p-1.5 bg-black/40 hover:bg-[#00ffcc] hover:text-black border-2 border-black rounded-lg text-white transition-all active:scale-95 cursor-pointer shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                            >
                              <Edit2 size={12} className="stroke-[2.5px]" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteItem('information', info.id); }}
                              className="p-1.5 bg-red-500 hover:bg-red-650 border-2 border-black rounded-lg text-white transition-all active:scale-95 cursor-pointer shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                            >
                              <Trash2 size={12} className="stroke-[2.5px]" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="p-3 bg-black/45 rounded-2xl border-2 border-black shadow-[inner_2px_2px_5px_rgba(0,0,0,0.5)]">
                            <p className="text-[9px] text-white/50 uppercase tracking-[0.15em] font-black mb-1.5">Account / Phone Details</p>
                            <div className="flex items-center justify-between">
                              <p className="text-base font-mono font-black tracking-wider text-[#00ffcc]">
                                {selectedInfoId === info.id ? info.accountNumber : info.accountNumber.replace(/.(?=.{4})/g, '•')}
                              </p>
                              <button 
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(info.accountNumber); }}
                                className="p-1.5 bg-black/30 hover:bg-[#8a2be2] hover:text-white border-2 border-black rounded-lg text-white/50 transition-colors cursor-pointer"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          </div>
                          
                          {info.accountName && (
                            <div className="px-1 text-left">
                              <p className="text-[8px] text-white/40 uppercase tracking-widest font-black">Account Owner</p>
                              <p className="text-xs font-black text-white/80 tracking-tight uppercase mt-0.5">{info.accountName}</p>
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
                <h1 className="text-3xl font-display font-black tracking-tight text-white mb-1">Vault Analytics 📈</h1>
                <p className="text-white/50 text-xs font-semibold">Breakdown of your digital stash portfolio distribution.</p>
              </div>
              {/* Allocation Chart Section */}
              <section className="mb-8">
                <Card className="bg-[#171a35] border-4 border-black flex flex-col md:flex-row relative overflow-hidden p-6 gap-6 rounded-[2.5rem] shadow-[6px_6px_0px_rgba(0,0,0,1)]">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ffcc]/50 to-transparent" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-purple-500 border-2 border-black text-white rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                        <PieChartIcon size={20} className="stroke-[2.5px]" />
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-white">Stash Ratios</h3>
                        <p className="text-xs text-white/50">Piggy bank asset allocation</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {assetAllocationData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-black/45 border-2 border-black hover:bg-black/60 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full border border-black shadow-[1px_1px_0px_rgba(0,0,0,0.4)]" style={{ backgroundColor: item.color }} />
                            <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">{item.name}</span>
                          </div>
                          <span className="text-xs font-black text-[#00ffcc] bg-black/50 px-2.5 py-1 rounded-full border border-black/40">{item.percent.toFixed(1)}%</span>
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
                              stroke="#000"
                              strokeWidth={3}
                              style={{
                                filter: activePieIndex === index ? `drop-shadow(0 0 12px ${entry.color}44)` : 'none',
                                opacity: activePieIndex === null || activePieIndex === index ? 1 : 0.6,
                                transition: 'all 0.3s ease',
                                cursor: 'pointer'
                              }}
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-[#12142c] p-4 rounded-2xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-[#00ffcc] mb-1">{payload[0].name}</p>
                                  <p className="text-base font-display font-black text-white">{formatCurrency(payload[0].value as number)}</p>
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
                  <h2 className="text-2xl font-display font-black tracking-tight mb-1 text-white">Asset Inventory 🏦</h2>
                  <p className="text-white/50 text-xs font-semibold">Live detailed overview of your wealth components.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Liquid Assets Column */}
                  <Card className="lg:col-span-5 flex flex-col bg-[#171a35] border-4 border-black p-6 rounded-[2.5rem] shadow-[6px_6px_0px_rgba(0,0,0,1)] h-full">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500 border-2 border-black text-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                          <Wallet size={20} className="stroke-[2.5px]" />
                        </div>
                        <div>
                          <h3 className="text-lg font-display font-black tracking-tight text-white">Liquid Cash</h3>
                          <p className="text-[9px] text-white/50 uppercase tracking-widest font-bold">BCA, Cash, E-Wallets</p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => { setEditingItem(null); setIsAccountModalOpen(true); }} 
                        className="p-2.5 bg-[#00ffcc] hover:bg-emerald-400 border-2 border-black text-black rounded-lg cursor-pointer transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
                      >
                        <Plus size={16} className="stroke-[3px]" />
                      </Button>
                    </div>

                    <div className="flex-1 space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {accounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-white/20">
                          <Wallet size={40} className="mb-3 opacity-10 animate-pulse" />
                          <p className="text-xs font-bold">No bank accounts added yet</p>
                        </div>
                      ) : (
                        accounts.map(account => (
                          <motion.div 
                            key={account.id}
                            whileHover={{ x: 2 }}
                            className="group flex items-center justify-between p-4 bg-black/45 rounded-2xl border-2 border-black hover:border-[#00ffcc] transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-1.5 h-8 bg-emerald-400 border border-black rounded-full" />
                              <div>
                                <p className="text-[10px] font-black text-[#00ffcc] uppercase tracking-wider mb-0.5">{account.name}</p>
                                <p className="text-lg font-display font-black text-white tracking-tight">{formatCurrency(account.balance)}</p>
                              </div>
                            </div>
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setEditingItem(account); setIsAccountModalOpen(true); }}
                                className="p-1.5 bg-black/40 hover:bg-[#00ffcc] hover:text-black border-2 border-black rounded-lg text-white transition-all cursor-pointer active:scale-90 shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                              >
                                <Edit2 size={12} className="stroke-[2.5px]" />
                              </button>
                              <button 
                                onClick={() => deleteItem('accounts', account.id)}
                                className="p-1.5 bg-red-500 hover:bg-red-650 border-2 border-black rounded-lg text-white transition-all cursor-pointer active:scale-90 shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                              >
                                <Trash2 size={12} className="stroke-[2.5px]" />
                              </button>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                    
                    <div className="mt-8 pt-6 border-t-4 border-black/40 flex items-center justify-between">
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Aggregate Cash</span>
                      <span className="text-xl font-display font-black text-emerald-400">{formatCurrency(totalCash)}</span>
                    </div>
                  </Card>

                  {/* Investments & Liabilities Column */}
                  <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Investments Bento */}
                    <Card className="flex flex-col bg-[#171a35] border-4 border-black p-6 rounded-[2.5rem] shadow-[6px_6px_0px_rgba(0,0,0,1)] h-full">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-500 border-2 border-black text-white rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                            <TrendingUp size={20} className="stroke-[2.5px]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-display font-black tracking-tight text-white">Investments</h3>
                            <p className="text-[9px] text-white/50 uppercase tracking-widest font-bold">Compound wealth</p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => { setEditingItem(null); setIsInvestmentModalOpen(true); }} 
                          className="p-2.5 bg-[#8a2be2] hover:bg-purple-650 border-2 border-black text-white rounded-lg cursor-pointer transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
                        >
                          <Plus size={16} className="stroke-[3px]" />
                        </Button>
                      </div>

                      <div className="flex-1 space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {investments.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-white/20">
                            <TrendingUp size={40} className="mb-3 opacity-10 animate-pulse" />
                            <p className="text-xs font-bold">No investments added</p>
                          </div>
                        ) : (
                          investments.map(inv => (
                            <motion.div 
                              key={inv.id}
                              whileHover={{ x: 2 }}
                              className="group flex items-center justify-between p-4 bg-black/45 rounded-2xl border-2 border-black hover:border-indigo-400 transition-all"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-0.5 truncate">{inv.name}</p>
                                <p className="text-base font-display font-black text-white truncate">{formatCurrency(inv.value)}</p>
                              </div>
                              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <button 
                                  onClick={() => { setEditingItem(inv); setIsInvestmentModalOpen(true); }}
                                  className="p-1.5 bg-black/40 hover:bg-[#8a2be2] hover:text-white border-2 border-black rounded-lg text-white transition-all cursor-pointer active:scale-90 shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                                >
                                  <Edit2 size={12} className="stroke-[2.5px]" />
                                </button>
                                <button 
                                  onClick={() => deleteItem('investments', inv.id)}
                                  className="p-1.5 bg-red-500 hover:bg-red-650 border-2 border-black rounded-lg text-white transition-all cursor-pointer active:scale-90 shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                                >
                                  <Trash2 size={12} className="stroke-[2.5px]" />
                                </button>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                      
                      <div className="mt-8 pt-6 border-t-4 border-black/40 flex items-center justify-between">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Growth Stash</span>
                        <span className="text-xl font-display font-black text-indigo-400">{formatCurrency(totalInvestments)}</span>
                      </div>
                    </Card>

                    {/* Liabilities Bento */}
                    <Card className="flex flex-col bg-[#171a35] border-4 border-black p-6 rounded-[2.5rem] shadow-[6px_6px_0px_rgba(0,0,0,1)] h-full">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-rose-500 border-2 border-black text-white rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                            <CreditCard size={20} className="stroke-[2.5px]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-display font-black tracking-tight text-white">Liabilities</h3>
                            <p className="text-[9px] text-white/50 uppercase tracking-widest font-bold">Outstanding Debt</p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => { setEditingItem(null); setIsLiabilityModalOpen(true); }} 
                          className="p-2.5 bg-[#ff007f] hover:bg-rose-650 border-2 border-black text-white rounded-lg cursor-pointer transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
                        >
                          <Plus size={16} className="stroke-[3px]" />
                        </Button>
                      </div>

                      <div className="flex-1 space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {liabilities.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-white/20">
                            <CreditCard size={40} className="mb-3 opacity-10 animate-pulse" />
                            <p className="text-xs font-bold">No outstanding liabilities</p>
                          </div>
                        ) : (
                          liabilities.map(debt => (
                            <motion.div 
                              key={debt.id}
                              whileHover={{ x: 2 }}
                              className="group flex items-center justify-between p-4 bg-black/45 rounded-2xl border-2 border-black hover:border-rose-400 transition-all"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-white/45 uppercase tracking-widest mb-0.5 truncate">{debt.name}</p>
                                <p className="text-base font-display font-black text-rose-400 truncate">{formatCurrency(debt.amount)}</p>
                                {debt.dueDate && (
                                  <div className="flex items-center gap-1.5 mt-2 p-1.5 bg-rose-500/15 border border-rose-500/30 rounded-lg w-fit">
                                    <Calendar size={10} className="text-[#ff007f] stroke-[2.5px]" />
                                    <span className="text-[8px] font-black text-rose-300 uppercase tracking-wider">Due: {formatDate(debt.dueDate)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <button 
                                  onClick={() => { setEditingItem(debt); setIsLiabilityModalOpen(true); }}
                                  className="p-1.5 bg-black/40 hover:bg-[#ff007f] hover:text-white border-2 border-black rounded-lg text-white transition-all cursor-pointer active:scale-90 shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                                >
                                  <Edit2 size={12} className="stroke-[2.5px]" />
                                </button>
                                <button 
                                  onClick={() => deleteItem('liabilities', debt.id)}
                                  className="p-1.5 bg-red-500 hover:bg-red-650 border-2 border-black rounded-lg text-white transition-all cursor-pointer active:scale-90 shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                                >
                                  <Trash2 size={12} className="stroke-[2.5px]" />
                                </button>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                      
                      <div className="mt-8 pt-6 border-t-4 border-black/40 flex items-center justify-between">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Aggregate Debt</span>
                        <span className="text-xl font-display font-black text-rose-400">{formatCurrency(totalDebt)}</span>
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
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5"
                >
                  <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-white">
                    Hi companion, <span className="text-[#00ffcc] underline decoration-[#8a2be2] decoration-4 underline-offset-4">{userDisplayName.split(' ')[0]}</span> 🏝️
                  </h1>
                  <p className="text-white/60 text-xs font-semibold">Ready to breed your digital piggy wealth bank today?</p>
                </motion.div>
              </div>

              {/* Stats Grid */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <Card className="relative overflow-hidden group border-4 border-black bg-gradient-to-br from-[#1b1f3b] to-[#252a50] p-5 shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_rgba(0,0,0,1)] transition-all rounded-[2rem]">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#00ffcc]/10 rounded-full blur-2xl group-hover:bg-[#00ffcc]/20 transition-all duration-500" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 bg-[#00ffcc] border-2 border-black text-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                        <PieChartIcon size={16} className="stroke-[2.5px]" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#00ffcc]">Net Liquid Cash</span>
                    </div>
                    <h3 className={cn("text-2xl md:text-3xl font-display font-black mb-1 tracking-tight drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)]", netCash >= 0 ? "text-[#00ffcc]" : "text-rose-400")}>
                      {formatCurrency(netCash)}
                    </h3>
                    <p className="text-[9px] text-white/50 font-bold uppercase tracking-wider">Available Cash minus unpaid liabilities</p>
                  </div>
                </Card>

                <Card className="relative overflow-hidden group bg-gradient-to-br from-[#8a2be2] to-[#fd007f] border-4 border-black text-white p-5 shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_rgba(0,0,0,1)] transition-all rounded-[2rem]">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-2xl group-hover:bg-white/30 transition-all duration-500" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 bg-yellow-300 border-2 border-black text-black rounded-xl shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                        <TrendingUp size={16} className="stroke-[3px]" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#00ffcc]">Core Net Worth</span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-display font-black mb-1 tracking-tight drop-shadow-[2px_2px_0px_rgba(0,0,0,0.3)] text-white">{formatCurrency(netWorth)}</h3>
                    <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider">Total cumulative digital portfolio worth</p>
                  </div>
                </Card>
              </section>

              {/* Small Info Grid */}
              <section className="grid grid-cols-3 gap-4">
                <div className="bg-[#171a35] rounded-2xl p-4 border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] text-left hover:translate-y-[-2px] transition-transform">
                  <p className="text-[8px] font-black uppercase tracking-wider text-emerald-400 mb-1">Liquid Cash</p>
                  <p className="text-sm font-display font-black text-white">{formatCurrency(totalCash)}</p>
                </div>
                <div className="bg-[#171a35] rounded-2xl p-4 border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] text-left hover:translate-y-[-2px] transition-transform">
                  <p className="text-[8px] font-black uppercase tracking-wider text-[#00ffcc] mb-1">Invested</p>
                  <p className="text-sm font-display font-black text-[#00ffcc]">{formatCurrency(totalInvestments)}</p>
                </div>
                <div className="bg-[#171a35] rounded-2xl p-4 border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] text-left hover:translate-y-[-2px] transition-transform">
                  <p className="text-[8px] font-black uppercase tracking-wider text-rose-400 mb-1">Due Debts</p>
                  <p className="text-sm font-display font-black text-rose-400">{formatCurrency(totalDebt)}</p>
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
        title={editingItem ? "✏️ Edit Cash Stash" : "💰 Add Cash Stash"}
      >
        <form onSubmit={handleAddAccount} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Account Name</label>
              <input 
                name="name" 
                defaultValue={editingItem?.name}
                required 
                placeholder="e.g. BCA, OVO, Cash"
                className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Balance (IDR)</label>
              <input 
                name="balance" 
                type="number" 
                defaultValue={editingItem?.balance}
                required 
                placeholder="0"
                className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
              />
            </div>
          </div>
          <Button type="submit" className="w-full py-4 rounded-xl bg-[#00ffcc] border-2 border-black text-black font-black tracking-wider uppercase text-xs shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-[0px_0px_0px_rgba(0,0,0,1)] cursor-pointer">
            {editingItem ? "Update Asset" : "Create Asset"}
          </Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isInvestmentModalOpen} 
        onClose={() => setIsInvestmentModalOpen(false)} 
        title={editingItem ? "✏️ Edit Growth Asset" : "📈 Add Growth Asset"}
      >
        <form onSubmit={handleAddInvestment} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Investment Name</label>
              <input 
                name="name" 
                defaultValue={editingItem?.name}
                required 
                placeholder="e.g. Gold, SBN"
                className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Category</label>
              <select 
                name="category" 
                defaultValue={editingItem?.category || 'Stocks'}
                className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-[#00ffcc] transition-all appearance-none font-semibold [color-scheme:dark]"
              >
                <option value="Gold" className="bg-[#12142c]">Gold</option>
                <option value="Stocks" className="bg-[#12142c]">Stocks</option>
                <option value="Mutual Funds" className="bg-[#12142c]">Mutual Funds</option>
                <option value="Bank Interest" className="bg-[#12142c]">Bank Interest</option>
                <option value="Deposito" className="bg-[#12142c]">Deposito</option>
                <option value="Crypto" className="bg-[#12142c]">Crypto</option>
                <option value="Valas" className="bg-[#12142c]">Valas</option>
                <option value="Others" className="bg-[#12142c]">Others</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Value (IDR)</label>
              <input 
                name="value" 
                type="number" 
                defaultValue={editingItem?.value}
                required 
                placeholder="0"
                className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
              />
            </div>
          </div>
          <Button type="submit" className="w-full py-4 rounded-xl bg-[#8a2be2] border-2 border-black text-white font-black tracking-wider uppercase text-xs shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-[0px_0px_0px_rgba(0,0,0,1)] cursor-pointer">
            {editingItem ? "Update Investment" : "Create Investment"}
          </Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isLiabilityModalOpen} 
        onClose={() => setIsLiabilityModalOpen(false)} 
        title={editingItem ? "✏️ Edit Liability" : "🚨 Add Liability"}
      >
        <form onSubmit={handleAddLiability} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Liability Name</label>
              <input 
                name="name" 
                defaultValue={editingItem?.name}
                required 
                placeholder="e.g. Credit Card, Loan"
                className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Amount (IDR)</label>
              <input 
                name="amount" 
                type="number" 
                defaultValue={editingItem?.amount}
                required 
                placeholder="0"
                className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Due Date (Optional)</label>
              <input 
                name="dueDate" 
                type="date" 
                defaultValue={editingItem?.dueDate}
                className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all [color-scheme:dark] font-semibold"
              />
            </div>
          </div>
          <Button type="submit" className="w-full py-4 rounded-xl bg-[#ff007f] border-2 border-black text-white font-black tracking-wider uppercase text-xs shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-[0px_0px_0px_rgba(0,0,0,1)] cursor-pointer">
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
        title={editingItem ? "✏️ Edit Transaction" : "💸 Record Transaction"}
      >
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Transaction Type</label>
            <select 
              name="type" 
              value={selectedTransactionType}
              onChange={(e) => {
                setSelectedTransactionType(e.target.value);
                setSelectedAccountId(''); // Reset account when type changes
              }}
              className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-[#00ffcc] transition-all appearance-none font-semibold [color-scheme:dark]"
            >
              <option value="income" className="bg-[#12142c]">Income (Add to Cash)</option>
              <option value="expense" className="bg-[#12142c]">Expense (Spend from Cash)</option>
              <option value="investment_deposit" className="bg-[#12142c]">Investment Deposit</option>
              <option value="investment_withdrawal" className="bg-[#12142c]">Investment Withdrawal</option>
              <option value="debt_payment" className="bg-[#12142c]">Debt Payment (Reduce Debt)</option>
              <option value="debt_expense" className="bg-[#12142c]">Debt Expense (Increase Debt)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Target Account</label>
            <select 
              name="accountId" 
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              required
              className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-[#00ffcc] transition-all appearance-none font-semibold [color-scheme:dark]"
            >
              <option value="" disabled className="bg-[#12142c]">Select target stash</option>
              {(selectedTransactionType === 'income' || selectedTransactionType === 'expense') && (
                <optgroup label="Cash Accounts" className="bg-[#12142c]">
                  {accounts.map(a => <option key={a.id} value={a.id} className="bg-[#12142c]">{a.name}</option>)}
                </optgroup>
              )}
              {(selectedTransactionType === 'investment_deposit' || selectedTransactionType === 'investment_withdrawal') && (
                <optgroup label="Investments" className="bg-[#12142c]">
                  {investments.map(i => <option key={i.id} value={i.id} className="bg-[#12142c]">{i.name}</option>)}
                </optgroup>
              )}
              {(selectedTransactionType === 'debt_payment' || selectedTransactionType === 'debt_expense') && (
                <optgroup label="Liabilities" className="bg-[#12142c]">
                  {liabilities.map(l => <option key={l.id} value={l.id} className="bg-[#12142c]">{l.name}</option>)}
                </optgroup>
              )}
            </select>
            {((selectedTransactionType === 'income' || selectedTransactionType === 'expense') && accounts.length === 0) && (
              <p className="text-xs text-rose-400 mt-2 font-black">No cash accounts found. Please add one first.</p>
            )}
            {((selectedTransactionType === 'investment_deposit' || selectedTransactionType === 'investment_withdrawal') && investments.length === 0) && (
              <p className="text-xs text-rose-400 mt-2 font-black">No investments found. Please add one first.</p>
            )}
            {((selectedTransactionType === 'debt_payment' || selectedTransactionType === 'debt_expense') && liabilities.length === 0) && (
              <p className="text-xs text-rose-400 mt-2 font-black">No liabilities found. Please add one first.</p>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Amount (IDR)</label>
            <input 
              name="amount" 
              type="number" 
              defaultValue={editingItem?.amount}
              required 
              placeholder="0"
              className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Notes</label>
            <input 
              name="notes" 
              defaultValue={editingItem?.notes}
              placeholder="Optional notes"
              className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
            />
          </div>
          <Button type="submit" className="w-full py-4 rounded-xl bg-[#00ffcc] border-2 border-black text-black font-black tracking-wider uppercase text-xs shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-[0px_0px_0px_rgba(0,0,0,1)] cursor-pointer">
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
        title={editingItem ? "✏️ Edit Card Info" : "💳 Add Card Info"}
      >
        <form onSubmit={handleAddInformation} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Type</label>
            <select 
              name="type" 
              defaultValue={editingItem?.type || 'bank'} 
              className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-[#00ffcc] transition-all appearance-none font-semibold [color-scheme:dark]"
            >
              <option value="bank" className="bg-[#12142c]">Bank Account</option>
              <option value="ewallet" className="bg-[#12142c]">E-Wallet</option>
              <option value="crypto" className="bg-[#12142c]">Crypto Wallet</option>
              <option value="rdn" className="bg-[#12142c]">RDN Account</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Provider Name</label>
            <input 
              name="provider" 
              defaultValue={editingItem?.provider} 
              required 
              placeholder="e.g. BCA, Mandiri, GoPay, OVO" 
              className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Account Number / Phone</label>
            <input 
              name="accountNumber" 
              defaultValue={editingItem?.accountNumber} 
              required 
              placeholder="e.g. 1234567890" 
              className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Account Name</label>
            <input 
              name="accountName" 
              defaultValue={editingItem?.accountName} 
              placeholder="e.g. John Doe" 
              className="w-full bg-black/40 border-2 border-black rounded-xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc] transition-all font-semibold"
            />
          </div>
          <Button type="submit" className="w-full py-4 rounded-xl bg-[#00ffcc] border-2 border-black text-black font-black tracking-wider uppercase text-xs shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[4px] active:shadow-[0px_0px_0px_rgba(0,0,0,1)] cursor-pointer">
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
        title="⚠️ Confirm Deletion"
      >
        <div className="space-y-6">
          <div className="p-6 bg-red-500/15 border-2 border-black rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <p className="text-white text-center leading-relaxed font-semibold">
              {deleteCollection === 'transactions' 
                ? "Are you sure you want to delete this transaction? This action will also automatically reverse the balance change on the associated account."
                : "Are you sure you want to delete this item? This action cannot be undone."}
            </p>
          </div>
          <div className="flex gap-4">
            <Button 
              onClick={() => setIsDeleteConfirmOpen(false)} 
              className="flex-1 py-3.5 rounded-xl bg-[#171a35] border-2 border-black text-white font-black uppercase text-xs shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 transition-all"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmDelete} 
              className="flex-1 py-3.5 rounded-xl bg-red-500 border-2 border-black text-white font-black uppercase text-xs shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 transition-all"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isClearAllConfirmOpen} 
        onClose={() => setIsClearAllConfirmOpen(false)} 
        title="🚨 Clear All Data"
      >
        <div className="space-y-6">
          <div className="p-6 bg-red-500/15 border-2 border-black rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <p className="text-white text-center leading-relaxed font-black mb-2 text-sm uppercase tracking-wider text-rose-400">
              WARNING: Extreme Action!
            </p>
            <p className="text-white/80 text-center text-xs font-semibold leading-relaxed">
              This will permanently delete ALL your accounts, investments, liabilities, and transactions. This cannot be undone.
            </p>
          </div>
          <div className="flex gap-4">
            <Button 
              onClick={() => setIsClearAllConfirmOpen(false)} 
              className="flex-1 py-3.5 rounded-xl bg-[#171a35] border-2 border-black text-white font-black uppercase text-sm shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 transition-all"
            >
              Cancel
            </Button>
            <Button 
              onClick={clearAllData} 
              className="flex-1 py-3.5 rounded-xl bg-red-500 border-2 border-black text-white font-black uppercase text-xs shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 transition-all"
            >
              Clear Everything
            </Button>
          </div>
        </div>
      </Modal>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-white/35 text-xs font-bold uppercase tracking-widest">
        <p>&copy; 2026 PiggyVault 3D. Keep breeding that stash! 🐷🚀</p>
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
