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
import { Account, Investment, Liability, Transaction, UserProfile, Information } from './types';
import { formatCurrency, cn } from './utils';
import { 
  LayoutDashboard,
  Info,
  ChevronLeft,
  ChevronRight,
  Search,
  Home,
  Activity,
  User as UserIcon,
  Settings,
  Bell,
  Play,
  TrendingUp,
  Wallet,
  CreditCard,
  Plus,
  LogOut,
  Trash2,
  Edit2,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  X,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
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

const Card = ({ children, className, onClick, hover = true }: { children: React.ReactNode; className?: string; onClick?: () => void; hover?: boolean }) => (
  <motion.div 
    whileHover={hover ? { scale: 1.02, zIndex: 10 } : {}}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    onClick={onClick}
    className={cn(
      "bg-[#1a1d23]/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl", 
      hover && "hover:border-white/30 hover:shadow-[#0072d2]/10 cursor-pointer",
      className
    )}
  >
    {children}
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
    primary: "bg-[#0072d2] text-white hover:bg-[#005bb5] shadow-lg shadow-[#0072d2]/20",
    secondary: "bg-white/10 text-[#e6e8eb] hover:bg-white/20 backdrop-blur-md border border-white/10",
    danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20",
    ghost: "bg-transparent text-[#e6e8eb] hover:bg-white/5"
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

const Toast = ({ message, type = 'info', onClose }: { message: string; type?: 'info' | 'error' | 'success'; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 50, x: '-50%' }}
    animate={{ opacity: 1, y: 0, x: '-50%' }}
    exit={{ opacity: 0, y: 50, x: '-50%' }}
    className={cn(
      "fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] backdrop-blur-xl border",
      type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-500" : 
      type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
      "bg-[#0072d2]/10 border-[#0072d2]/20 text-[#0072d2]"
    )}
  >
    {type === 'error' ? <AlertCircle size={20} /> : type === 'success' ? <Check size={20} /> : <Info size={20} />}
    <span className="flex-1 font-medium">{message}</span>
    <button onClick={onClose} className="hover:opacity-70 transition-opacity">
      <X size={18} />
    </button>
  </motion.div>
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
          className="absolute inset-0 bg-[#030b17]/80 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[#1a1d23] border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-[#e6e8eb]">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
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
      className="p-2 hover:bg-white/5 rounded-lg text-[#e6e8eb]/40 hover:text-[#0072d2] transition-all"
      title="Copy to clipboard"
    >
      {copied ? <Check size={16} className="text-[#0072d2]" /> : <Copy size={16} />}
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
        "fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-2xl",
        type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500"
      )}
    >
      {type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
      <span className="font-medium">{message}</span>
    </motion.div>
  );
};

// --- Disney+ Hotstar Style Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }: { icon: any; label: string; active?: boolean; onClick: () => void; collapsed: boolean }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-4 w-full p-3 rounded-xl transition-all duration-300 group relative",
      active ? "text-white" : "text-gray-400 hover:text-white"
    )}
  >
    <div className={cn(
      "transition-transform duration-300 group-hover:scale-110",
      active ? "text-[#0072d2]" : ""
    )}>
      <Icon size={24} />
    </div>
    {!collapsed && (
      <motion.span
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-medium text-sm"
      >
        {label}
      </motion.span>
    )}
    {active && (
      <motion.div
        layoutId="active-nav"
        className="absolute left-0 w-1 h-6 bg-[#0072d2] rounded-r-full"
      />
    )}
  </button>
);

const HeroBanner = ({ netWorth, user }: { netWorth: number; user: User }) => (
  <section className="relative h-[60vh] min-h-[400px] w-full rounded-3xl overflow-hidden mb-8 group">
    <div className="absolute inset-0">
      <img 
        src="https://picsum.photos/seed/finance-luxury/1920/1080?blur=2" 
        alt="Hero Background" 
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#030b17] via-[#030b17]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#030b17] via-[#030b17]/20 to-transparent" />
    </div>
    
    <div className="absolute bottom-0 left-0 p-8 md:p-16 w-full max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest text-[#0072d2] mb-4 inline-block border border-white/10">
          Portofolio Unggulan
        </span>
        <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter">
          Selamat datang kembali, {user.displayName?.split(' ')[0]}
        </h1>
        <p className="text-lg text-gray-300 mb-8 line-clamp-2 max-w-lg">
          Kerajaan finansial Anda sedang berkembang. Saat ini mengelola total kekayaan bersih sebesar {formatCurrency(netWorth)}. Pertahankan kerja bagus Anda!
        </p>
        
        <div className="flex items-center gap-4">
          <Button className="bg-white text-black hover:bg-gray-200 px-8 py-3 rounded-lg font-bold flex items-center gap-2">
            <Play size={20} fill="currentColor" /> Lihat Laporan
          </Button>
          <Button variant="secondary" className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 px-8 py-3 rounded-lg font-bold">
            <Plus size={20} /> Tambah Aset
          </Button>
        </div>
      </motion.div>
    </div>
  </section>
);

const ContentRow = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-4 mb-12">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
        <div className="flex gap-2">
          <button onClick={() => scroll('left')} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => scroll('right')} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-4 pb-4 snap-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </div>
  );
};

const ContentCard = ({ 
  title, 
  subtitle, 
  value, 
  color, 
  icon: Icon, 
  onClick, 
  onEdit, 
  onDelete,
  imageUrl 
}: { 
  title: string; 
  subtitle?: string; 
  value: string; 
  color: string; 
  icon: any; 
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  imageUrl?: string;
}) => (
  <motion.div
    whileHover={{ scale: 1.05, zIndex: 10 }}
    className="flex-shrink-0 w-64 h-40 relative rounded-xl overflow-hidden cursor-pointer group snap-start bg-[#1a1d23] border border-white/5 shadow-2xl"
    onClick={onClick}
  >
    <div className="absolute inset-0">
      <img 
        src={imageUrl || `https://picsum.photos/seed/${title}/400/250`} 
        alt={title} 
        className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-300"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1115] via-[#0f1115]/60 to-transparent" />
      <div className="absolute inset-0 group-hover:ring-2 group-hover:ring-[#0072d2]/50 transition-all duration-300 rounded-xl" />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
          <Play size={24} className="text-white ml-1" fill="currentColor" />
        </div>
      </div>
    </div>
    <div className="absolute inset-0 p-4 flex flex-col justify-end">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-md bg-white/10 backdrop-blur-md" style={{ color }}>
          <Icon size={14} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{subtitle || 'Aset'}</p>
      </div>
      <h3 className="font-bold text-white truncate">{title}</h3>
      <p className="text-lg font-black" style={{ color }}>{value}</p>
    </div>

    {/* Hover Actions */}
    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {onEdit && (
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white hover:text-[#0072d2] transition-colors"
        >
          <Edit2 size={12} />
        </button>
      )}
      {onDelete && (
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  </motion.div>
);

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [deleteCollection, setDeleteCollection] = useState<string>('');
  const [selectedInfoId, setSelectedInfoId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
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

    const unsubInformation = onSnapshot(collection(db, `users/${user.uid}/information`), (s) => {
      setInformation(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Information)));
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

  const handleAddAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const balance = Number(formData.get('balance'));

    if (editingItem) {
      await updateDoc(doc(db, `users/${user.uid}/accounts`, editingItem.id), { name, balance, updatedAt: new Date().toISOString() });
      setNotification({ message: 'Akun berhasil diperbarui', type: 'success' });
    } else {
      await addDoc(collection(db, `users/${user.uid}/accounts`), {
        userId: user.uid,
        name,
        balance,
        updatedAt: new Date().toISOString()
      });
      setNotification({ message: 'Akun berhasil ditambahkan', type: 'success' });
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
      setNotification({ message: 'Investasi berhasil diperbarui', type: 'success' });
    } else {
      await addDoc(collection(db, `users/${user.uid}/investments`), {
        userId: user.uid,
        name,
        value,
        category,
        updatedAt: new Date().toISOString()
      });
      setNotification({ message: 'Investasi berhasil ditambahkan', type: 'success' });
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
      setNotification({ message: 'Liabilitas berhasil diperbarui', type: 'success' });
    } else {
      await addDoc(collection(db, `users/${user.uid}/liabilities`), {
        userId: user.uid,
        name,
        amount,
        updatedAt: new Date().toISOString()
      });
      setNotification({ message: 'Liabilitas berhasil ditambahkan', type: 'success' });
    }
    setIsLiabilityModalOpen(false);
    setEditingItem(null);
  };

  const handleAddInformation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as 'bank' | 'ewallet';
    const provider = formData.get('provider') as string;
    const accountNumber = formData.get('accountNumber') as string;
    const accountName = formData.get('accountName') as string;

    if (editingItem) {
      await updateDoc(doc(db, `users/${user.uid}/information`, editingItem.id), { 
        type, 
        provider, 
        accountNumber, 
        accountName, 
        updatedAt: new Date().toISOString() 
      });
      setNotification({ message: 'Informasi berhasil diperbarui', type: 'success' });
    } else {
      await addDoc(collection(db, `users/${user.uid}/information`), {
        userId: user.uid,
        type,
        provider,
        accountNumber,
        accountName,
        updatedAt: new Date().toISOString()
      });
      setNotification({ message: 'Informasi berhasil ditambahkan', type: 'success' });
    }
    setIsInformationModalOpen(false);
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
      showToast('Silakan pilih akun target. Jika daftar kosong, tambahkan akun terlebih dahulu.', 'error');
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
      setNotification({ message: editingItem ? 'Transaksi diperbarui' : 'Transaksi tercatat', type: 'success' });
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
      { name: 'Superbank', value: 1000000, category: 'Bank Interest' }
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
        showToast("Domain ini tidak diizinkan di Firebase Console. Silakan tambahkan domain Anda ke 'Authorized Domains' di pengaturan Firebase Authentication.", 'error');
      } else if (error.code === 'auth/popup-blocked') {
        showToast("Popup login diblokir oleh browser Anda. Silakan izinkan popup untuk situs ini.", 'error');
      } else {
        showToast("Login gagal: " + error.message, 'error');
      }
    }
  };

  const handleAppleLogin = async () => {
    try {
      await signInWithApple();
    } catch (error: any) {
      console.error("Apple Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        showToast("Domain ini tidak diizinkan di Firebase Console. Silakan tambahkan domain Anda ke 'Authorized Domains' di pengaturan Firebase Authentication.", 'error');
      } else if (error.code === 'auth/popup-blocked') {
        showToast("Popup login diblokir oleh browser Anda. Silakan izinkan popup untuk situs ini.", 'error');
      } else {
        showToast("Login Apple gagal: " + error.message, 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030b17] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#0072d2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#030b17] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Luxury Background Animation */}
        <div className="absolute inset-0 z-0">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-[#0072d2]/20 to-transparent rounded-full blur-[120px]"
          />
          <motion.div 
            animate={{ 
              scale: [1.2, 1, 1.2],
              rotate: [90, 0, 90],
              opacity: [0.1, 0.15, 0.1]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-[#0072d2]/20 to-transparent rounded-full blur-[120px]"
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
            className="w-24 h-24 bg-gradient-to-br from-[#0072d2] to-[#0072d2]/60 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-[#0072d2]/30"
          >
            <TrendingUp size={48} className="text-white" />
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
            Puncak dari keuangan pribadi.
          </motion.p>

          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Button onClick={handleLogin} className="w-full py-5 text-lg rounded-2xl bg-white text-black hover:bg-gray-100 shadow-xl transition-all duration-300">
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5 mr-2" alt="Google" />
                Lanjutkan dengan Google
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
                Lanjutkan dengan Apple
              </Button>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 1.2 }}
            className="mt-16 text-xs uppercase tracking-[0.3em] text-[#e6e8eb]"
          >
            Diamankan oleh Firebase Elite
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#030b17] text-[#e1e6f0] font-sans selection:bg-[#0072d2]/30 overflow-hidden">
        {/* Disney+ Style Sidebar */}
        <aside 
          onMouseEnter={() => setIsSidebarCollapsed(false)}
          onMouseLeave={() => setIsSidebarCollapsed(true)}
          className={cn(
            "fixed left-0 top-0 h-full bg-[#030b17] border-r border-white/5 z-50 transition-all duration-300 flex flex-col items-center py-8",
            isSidebarCollapsed ? "w-20" : "w-64 px-4"
          )}
        >
          <div className="mb-12 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#0072d2] to-[#0072d2]/60 rounded-xl flex items-center justify-center shadow-lg shadow-[#0072d2]/20 shrink-0">
              <TrendingUp size={24} className="text-white" />
            </div>
            {!isSidebarCollapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xl font-black tracking-tighter"
              >
                LuxWealth
              </motion.span>
            )}
          </div>

          <div className="flex-1 w-full space-y-2">
            <SidebarItem 
              icon={Home} 
              label="Beranda" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              collapsed={isSidebarCollapsed} 
            />
            <SidebarItem 
              icon={Search} 
              label="Cari" 
              onClick={() => {
                const searchInput = document.querySelector('input[placeholder*="Cari"]') as HTMLInputElement;
                if (searchInput) searchInput.focus();
              }} 
              collapsed={isSidebarCollapsed} 
            />
            <SidebarItem 
              icon={Activity} 
              label="Aktivitas" 
              onClick={() => {}} 
              collapsed={isSidebarCollapsed} 
            />
            <SidebarItem 
              icon={Info} 
              label="Informasi" 
              active={activeTab === 'information'} 
              onClick={() => setActiveTab('information')} 
              collapsed={isSidebarCollapsed} 
            />
          </div>

          <div className="w-full space-y-2">
            <SidebarItem 
              icon={Settings} 
              label="Pengaturan" 
              onClick={() => {}} 
              collapsed={isSidebarCollapsed} 
            />
            <SidebarItem 
              icon={LogOut} 
              label="Keluar" 
              onClick={logout} 
              collapsed={isSidebarCollapsed} 
            />
          </div>
        </aside>

        <div className={cn("flex-1 transition-all duration-300", isSidebarCollapsed ? "ml-20" : "ml-64")}>
          {/* Top Header */}
          <header className="sticky top-0 z-40 bg-[#030b17]/80 backdrop-blur-md h-20 flex items-center justify-between px-8 gap-6 border-b border-white/5">
            <div className="flex-1 max-w-md relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#0072d2] transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Cari aset, transaksi..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-12 pr-4 focus:outline-none focus:border-[#0072d2]/50 focus:bg-white/10 transition-all text-sm"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 text-gray-400 hover:text-white transition-colors relative">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#0072d2] rounded-full border-2 border-[#030b17]" />
              </button>
              <div className="flex items-center gap-3 bg-white/5 hover:bg-white/10 p-1.5 pr-4 rounded-full border border-white/5 transition-all cursor-pointer">
                <img src={user.photoURL || ''} alt="Profile" className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                <span className="text-sm font-medium hidden sm:inline">{user.displayName?.split(' ')[0]}</span>
              </div>
            </div>
          </header>

          <main className="pb-20">
            {activeTab === 'dashboard' ? (
              <div className="animate-in fade-in duration-700">
                <div className="px-4 md:px-8">
                  <HeroBanner netWorth={netWorth} user={user} />
                </div>

                {/* Rows */}
                {accounts.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 && (
                  <ContentRow title="Aset Likuid">
                    {accounts.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase())).map(account => (
                      <ContentCard 
                        key={account.id}
                        title={account.name}
                        subtitle="Akun Kas"
                        value={formatCurrency(account.balance)}
                        color="#0072d2"
                        icon={Wallet}
                        onEdit={() => { setEditingItem(account); setIsAccountModalOpen(true); }}
                        onDelete={() => deleteItem('accounts', account.id)}
                        imageUrl={`https://picsum.photos/seed/bank-${account.name}/400/250`}
                      />
                    ))}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      onClick={() => { setEditingItem(null); setIsAccountModalOpen(true); }}
                      className="flex-shrink-0 w-64 h-40 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-white/20 hover:text-[#0072d2] hover:border-[#0072d2]/30 transition-all cursor-pointer group"
                    >
                      <Plus size={32} className="group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold uppercase tracking-widest">Tambah Akun</span>
                    </motion.div>
                  </ContentRow>
                )}

                {investments.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 && (
                  <ContentRow title="Aset Pertumbuhan">
                    {investments.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(inv => (
                      <ContentCard 
                        key={inv.id}
                        title={inv.name}
                        subtitle={inv.category}
                        value={formatCurrency(inv.value)}
                        color="#0072d2"
                        icon={TrendingUp}
                        onEdit={() => { setEditingItem(inv); setIsInvestmentModalOpen(true); }}
                        onDelete={() => deleteItem('investments', inv.id)}
                        imageUrl={`https://picsum.photos/seed/invest-${inv.name}/400/250`}
                      />
                    ))}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      onClick={() => { setEditingItem(null); setIsInvestmentModalOpen(true); }}
                      className="flex-shrink-0 w-64 h-40 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-white/20 hover:text-[#0072d2] hover:border-[#0072d2]/30 transition-all cursor-pointer group"
                    >
                      <Plus size={32} className="group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold uppercase tracking-widest">Tambah Investasi</span>
                    </motion.div>
                  </ContentRow>
                )}

                {liabilities.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 && (
                  <ContentRow title="Liabilitas">
                    {liabilities.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase())).map(debt => (
                      <ContentCard 
                        key={debt.id}
                        title={debt.name}
                        subtitle="Hutang"
                        value={formatCurrency(debt.amount)}
                        color="#f87171"
                        icon={CreditCard}
                        onEdit={() => { setEditingItem(debt); setIsLiabilityModalOpen(true); }}
                        onDelete={() => deleteItem('liabilities', debt.id)}
                        imageUrl={`https://picsum.photos/seed/debt-${debt.name}/400/250`}
                      />
                    ))}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      onClick={() => { setEditingItem(null); setIsLiabilityModalOpen(true); }}
                      className="flex-shrink-0 w-64 h-40 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-white/20 hover:text-red-400 hover:border-red-400/30 transition-all cursor-pointer group"
                    >
                      <Plus size={32} className="group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold uppercase tracking-widest">Tambah Liabilitas</span>
                    </motion.div>
                  </ContentRow>
                )}

                <ContentRow title="Aktivitas Terakhir">
                  {transactions
                    .filter(t => 
                      (t.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                      t.type.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(t => (
                      <ContentCard 
                        key={t.id}
                        title={t.notes || t.type.replace('_', ' ')}
                        subtitle={new Date(t.date).toLocaleDateString()}
                        value={`${(t.type === 'income' || t.type === 'investment_deposit' || t.type === 'debt_payment') ? '+' : '-'}${formatCurrency(t.amount)}`}
                        color={(t.type === 'income' || t.type === 'investment_deposit' || t.type === 'debt_payment') ? '#10b981' : '#f87171'}
                        icon={(t.type === 'income' || t.type === 'investment_deposit' || t.type === 'debt_payment') ? ArrowUpRight : ArrowDownLeft}
                        onEdit={() => { 
                          setEditingItem(t); 
                          setSelectedTransactionType(t.type);
                          setSelectedAccountId(t.accountId);
                          setIsTransactionModalOpen(true); 
                        }}
                        onDelete={() => deleteTransaction(t)}
                        imageUrl={`https://picsum.photos/seed/trans-${t.id}/400/250`}
                      />
                    ))}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    onClick={() => { setIsTransactionModalOpen(true); setSelectedTransactionType('expense'); }}
                    className="flex-shrink-0 w-64 h-40 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-white/20 hover:text-[#0072d2] hover:border-[#0072d2]/30 transition-all cursor-pointer group"
                  >
                    <Plus size={32} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-widest">Transaksi Baru</span>
                  </motion.div>
                </ContentRow>

                <ContentRow title="Wawasan Tren">
                  {[
                    { title: 'Lonjakan Pasar Bullish', desc: 'Pasar kripto sedang melonjak', color: '#0072d2', icon: TrendingUp, seed: 'crypto' },
                    { title: 'Emas vs Saham', desc: 'Mana yang lebih baik untuk 2026?', color: '#fbbf24', icon: TrendingUp, seed: 'gold' },
                    { title: 'Manajemen Hutang', desc: 'Tips melunasi kartu kredit Anda', color: '#f87171', icon: CreditCard, seed: 'debt' },
                    { title: 'Gaya Hidup Mewah', desc: 'Merencanakan pembelian besar Anda berikutnya', color: '#0072d2', icon: Wallet, seed: 'luxury' }
                  ]
                  .filter(insight => 
                    insight.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    insight.desc.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((insight, idx) => (
                    <ContentCard 
                      key={idx}
                      title={insight.title}
                      subtitle="Market Insight"
                      value={insight.desc}
                      color={insight.color}
                      icon={insight.icon}
                      imageUrl={`https://picsum.photos/seed/insight-${insight.seed}/400/250`}
                    />
                  ))}
                </ContentRow>
              </div>
            ) : (
              <div className="animate-in slide-in-from-right duration-500">
                <div className="px-8 mb-8 flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter">Pusat Informasi</h2>
                    <p className="text-gray-500">Akses cepat ke detail akun Anda</p>
                  </div>
                  <Button onClick={() => { setEditingItem(null); setIsInformationModalOpen(true); }} className="bg-[#0072d2] text-white font-bold">
                    <Plus size={20} /> Tambah Informasi
                  </Button>
                </div>

                {['bank', 'ewallet', 'crypto', 'rdn'].map(type => {
                  const items = information.filter(info => 
                    info.type === type && 
                    (info.provider.toLowerCase().includes(searchTerm.toLowerCase()) || 
                     info.accountName?.toLowerCase().includes(searchTerm.toLowerCase()))
                  );
                  if (items.length === 0) return null;
                  
                  return (
                    <ContentRow key={type} title={type === 'bank' ? 'Akun Bank' : type === 'ewallet' ? 'E-Wallet' : type === 'crypto' ? 'Dompet Kripto' : 'Akun RDN'}>
                      {items.map(info => (
                        <ContentCard 
                          key={info.id}
                          title={info.provider}
                          subtitle={info.accountName || 'Akun'}
                          value={info.accountNumber}
                          color="#0072d2"
                          icon={type === 'bank' ? Wallet : type === 'ewallet' ? TrendingUp : CreditCard}
                          onEdit={() => { setEditingItem(info); setIsInformationModalOpen(true); }}
                          onDelete={() => deleteDoc(doc(db, `users/${user.uid}/information`, info.id))}
                          imageUrl={`https://picsum.photos/seed/info-${info.provider}/400/250`}
                        />
                      ))}
                    </ContentRow>
                  );
                })}

                {information.length === 0 && (
                  <div className="text-center py-20">
                    <Info size={64} className="mx-auto mb-4 text-white/10" />
                    <p className="text-gray-500">Tidak ada catatan informasi ditemukan</p>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

      {/* Modals */}
      <Modal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
        title={editingItem ? "Edit Aset" : "Tambah Aset"}
      >
        <form onSubmit={handleAddAccount} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Nama Akun</label>
            <input 
              name="name" 
              defaultValue={editingItem?.name}
              required 
              placeholder="misal: BCA, BRI, Tunai"
              className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Saldo (IDR)</label>
            <input 
              name="balance" 
              type="number" 
              defaultValue={editingItem?.balance}
              required 
              placeholder="0"
              className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2] transition-colors"
            />
          </div>
          <Button className="w-full py-4 mt-4">Simpan Akun</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isInvestmentModalOpen} 
        onClose={() => setIsInvestmentModalOpen(false)} 
        title={editingItem ? "Edit Investasi" : "Tambah Investasi"}
      >
        <form onSubmit={handleAddInvestment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Nama Investasi</label>
            <input name="name" defaultValue={editingItem?.name} required placeholder="misal: Emas, SBN" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Kategori</label>
            <select name="category" defaultValue={editingItem?.category || 'Saham'} className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]">
              <option>Emas</option>
              <option>Saham</option>
              <option>Reksa Dana</option>
              <option>Bunga Bank</option>
              <option>Deposito</option>
              <option>Kripto</option>
              <option>Valas</option>
              <option>Lainnya</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Nilai (IDR)</label>
            <input name="value" type="number" defaultValue={editingItem?.value} required placeholder="0" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]" />
          </div>
          <Button className="w-full py-4 mt-4">Simpan Investasi</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isLiabilityModalOpen} 
        onClose={() => setIsLiabilityModalOpen(false)} 
        title={editingItem ? "Edit Liabilitas" : "Tambah Liabilitas"}
      >
        <form onSubmit={handleAddLiability} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Nama Hutang</label>
            <input name="name" defaultValue={editingItem?.name} required placeholder="misal: Kartu Kredit" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Jumlah Hutang (IDR)</label>
            <input name="amount" type="number" defaultValue={editingItem?.amount} required placeholder="0" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]" />
          </div>
          <Button className="w-full py-4 mt-4">Simpan Liabilitas</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isTransactionModalOpen} 
        onClose={() => { 
          setIsTransactionModalOpen(false); 
          setEditingItem(null);
          setSelectedAccountId('');
        }} 
        title={editingItem ? "Edit Transaksi" : "Transaksi Baru"}
      >
        <form onSubmit={handleAddTransaction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Tipe Transaksi</label>
            <select 
              name="type" 
              value={selectedTransactionType}
              onChange={(e) => {
                setSelectedTransactionType(e.target.value);
                setSelectedAccountId(''); // Reset account when type changes
              }}
              className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]"
            >
              <option value="income">Pemasukan (Tambah ke Kas)</option>
              <option value="expense">Pengeluaran (Ambil dari Kas)</option>
              <option value="investment_deposit">Setoran Investasi</option>
              <option value="investment_withdrawal">Penarikan Investasi</option>
              <option value="debt_payment">Pembayaran Hutang (Kurangi Hutang)</option>
              <option value="debt_expense">Beban Hutang (Tambah Hutang)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Akun Target</label>
            <select 
              name="accountId" 
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              required
              className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]"
            >
              <option value="" disabled>Pilih akun</option>
              {(selectedTransactionType === 'income' || selectedTransactionType === 'expense') && (
                <optgroup label="Akun Kas">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              )}
              {(selectedTransactionType === 'investment_deposit' || selectedTransactionType === 'investment_withdrawal') && (
                <optgroup label="Investasi">
                  {investments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </optgroup>
              )}
              {(selectedTransactionType === 'debt_payment' || selectedTransactionType === 'debt_expense') && (
                <optgroup label="Liabilitas">
                  {liabilities.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </optgroup>
              )}
            </select>
            {((selectedTransactionType === 'income' || selectedTransactionType === 'expense') && accounts.length === 0) && (
              <p className="text-xs text-red-400 mt-1">Akun kas tidak ditemukan. Silakan tambahkan terlebih dahulu.</p>
            )}
            {((selectedTransactionType === 'investment_deposit' || selectedTransactionType === 'investment_withdrawal') && investments.length === 0) && (
              <p className="text-xs text-red-400 mt-1">Investasi tidak ditemukan. Silakan tambahkan terlebih dahulu.</p>
            )}
            {((selectedTransactionType === 'debt_payment' || selectedTransactionType === 'debt_expense') && liabilities.length === 0) && (
              <p className="text-xs text-red-400 mt-1">Liabilitas tidak ditemukan. Silakan tambahkan terlebih dahulu.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Jumlah (IDR)</label>
            <input name="amount" type="number" defaultValue={editingItem?.amount} required placeholder="0" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Catatan</label>
            <input name="notes" defaultValue={editingItem?.notes} placeholder="Catatan opsional" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]" />
          </div>
          <Button className="w-full py-4 mt-4">{editingItem ? "Perbarui Transaksi" : "Catat Transaksi"}</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isInformationModalOpen} 
        onClose={() => { 
          setIsInformationModalOpen(false); 
          setEditingItem(null);
        }} 
        title={editingItem ? "Edit Informasi" : "Tambah Informasi"}
      >
        <form onSubmit={handleAddInformation} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Tipe</label>
            <select name="type" defaultValue={editingItem?.type || 'bank'} className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]">
              <option value="bank">Akun Bank</option>
              <option value="ewallet">E-Wallet</option>
              <option value="crypto">Dompet Kripto</option>
              <option value="rdn">Akun RDN</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Nama Penyedia</label>
            <input name="provider" defaultValue={editingItem?.provider} required placeholder="misal: BCA, Mandiri, GoPay, OVO" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Nomor Akun / Telepon</label>
            <input name="accountNumber" defaultValue={editingItem?.accountNumber} required placeholder="e.g. 1234567890" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#e6e8eb]/60 mb-2">Nama Akun</label>
            <input name="accountName" defaultValue={editingItem?.accountName} placeholder="misal: John Doe" className="w-full bg-[#0f1115] border border-[#2a2e36] rounded-xl px-4 py-3 focus:outline-none focus:border-[#0072d2]" />
          </div>
          <Button className="w-full py-4 mt-4">Simpan Informasi</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isDeleteConfirmOpen} 
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setItemToDelete(null);
          setDeleteCollection('');
        }} 
        title="Konfirmasi Penghapusan"
      >
        <div className="space-y-6">
          <p className="text-[#e6e8eb]/60">
            {deleteCollection === 'transactions' 
              ? "Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini juga akan secara otomatis membatalkan perubahan saldo pada akun terkait."
              : "Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan."}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => setIsDeleteConfirmOpen(false)} variant="secondary" className="flex-1">
              Batal
            </Button>
            <Button onClick={confirmDelete} variant="danger" className="flex-1">
              Hapus
            </Button>
          </div>
        </div>
      </Modal>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-[#e6e8eb]/20 text-sm">
        <p>&copy; 2026 LuxWealth Tracker. Hak cipta dilindungi undang-undang.</p>
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
