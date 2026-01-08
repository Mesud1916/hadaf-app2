
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, Summary, Account, AccountSummary, AppSettings, Currency } from './types';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import AccountManager from './components/AccountManager';
import AccountReport from './components/AccountReport';
import CategoryReport from './components/CategoryReport';
import Dashboard from './components/Dashboard';
import SettingsView from './components/SettingsView';
import SecurityLock from './components/SecurityLock';
import ExitConfirmationOverlay from './components/ExitConfirmationOverlay';
import { dbService } from './services/databaseService';
import { DEFAULT_SETTINGS } from './constants';
import { App as CapacitorApp } from '@capacitor/app';

type ViewMode = 'dashboard' | 'transactions' | 'accounts' | 'settings';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>('dashboard');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedAccountForReport, setSelectedAccountForReport] = useState<AccountSummary | null>(null);
  const [selectedCategoryData, setSelectedCategoryData] = useState<{name: string, currency: Currency} | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const lastBackPressTime = useRef<number>(0);

  // Apply Theme Class
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Handle Hardware Back Button for Mobile
  useEffect(() => {
    const backListener = CapacitorApp.addListener('backButton', () => {
      if (showExitConfirm) {
        setShowExitConfirm(false);
        return;
      }
      if (showForm) {
        setShowForm(false);
        setEditingTransaction(null);
        return;
      }
      if (selectedAccountForReport) {
        setSelectedAccountForReport(null);
        return;
      }
      if (selectedCategoryData) {
        setSelectedCategoryData(null);
        return;
      }

      if (activeView === 'dashboard') {
        const now = Date.now();
        if (now - lastBackPressTime.current < 2000) {
          setShowExitConfirm(true);
        } else {
          lastBackPressTime.current = now;
        }
      } else {
        setActiveView('dashboard');
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [showForm, selectedAccountForReport, selectedCategoryData, activeView, showExitConfirm]);

  const accountSummaries = useMemo<AccountSummary[]>(() => {
    return accounts.map(acc => {
      let balance = acc.initialBalance;
      transactions.forEach(t => {
        if (t.accountId === acc.id) {
          if (t.type === 'expense' || t.type === 'transfer') balance -= t.amount;
          else if (t.type === 'income') balance += t.amount;
        } else if (t.toAccountId === acc.id) {
          balance += (t.targetAmount || t.amount);
        }
      });
      return { ...acc, balance };
    });
  }, [accounts, transactions]);

  const summary = useMemo<Summary>(() => {
    const balancesByCurrency: Record<Currency, number> = { 
      TL: 0, USD: 0, EUR: 0, TOMAN: 0
    };
    accounts.forEach(acc => { balancesByCurrency[acc.currency] += acc.initialBalance; });
    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      const toAcc = t.toAccountId ? accounts.find(a => a.id === t.toAccountId) : null;
      if (t.type === 'income') {
        const cur = acc?.currency || settings.currency;
        balancesByCurrency[cur] += t.amount;
        if (cur === settings.currency) totalIncome += t.amount;
      } else if (t.type === 'expense') {
        const cur = acc?.currency || settings.currency;
        balancesByCurrency[cur] -= t.amount;
        if (cur === settings.currency) totalExpense += t.amount;
      } else if (t.type === 'transfer') {
        if (acc) balancesByCurrency[acc.currency] -= t.amount;
        if (toAcc) balancesByCurrency[toAcc.currency] += (t.targetAmount || t.amount);
      }
    });
    return { totalIncome, totalExpense, balance: balancesByCurrency[settings.currency] || 0, balancesByCurrency };
  }, [accounts, transactions, settings.currency]);

  useEffect(() => {
    const initApp = async () => {
      try {
        await dbService.init();
        const savedSettings = localStorage.getItem('hadaf_settings');
        let currentSettings = DEFAULT_SETTINGS;
        
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          currentSettings = { 
            ...DEFAULT_SETTINGS, 
            ...parsed,
            security: { ...DEFAULT_SETTINGS.security, ...(parsed.security || {}) },
            categories: { ...DEFAULT_SETTINGS.categories, ...(parsed.categories || {}) }
          };
          setSettings(currentSettings);
        }

        await dbService.processRecurringTasks();
        await loadData();

        if (currentSettings.security.enabled && currentSettings.security.pin) {
          setIsLocked(true);
        }
      } catch (e) {
        console.error("Initialization failed", e);
      } finally {
        setIsInitializing(false);
      }
    };
    initApp();
  }, []);

  const loadData = async () => {
    try {
      const [tData, aData] = await Promise.all([dbService.getTransactions(), dbService.getAccounts()]);
      setTransactions(Array.isArray(tData) ? tData : []);
      setAccounts(Array.isArray(aData) ? aData : []);
    } catch (e) {
      console.error("Error loading data:", e);
    }
  };

  const handleSaveTransaction = async (tr: Transaction) => {
    try {
      if (editingTransaction) await dbService.updateTransaction(tr);
      else await dbService.addTransaction(tr);
      await loadData();
      setShowForm(false);
      setEditingTransaction(null);
    } catch (err) { alert("خطا در ذخیره."); }
  };

  if (isInitializing) return <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 font-bold">در حال بارگذاری...</div>;

  if (isLocked) return <SecurityLock security={settings.security} onUnlock={() => setIsLocked(false)} />;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-950 pb-32 px-4 pt-10 text-right transition-colors duration-300" dir="rtl">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{settings.appName}</h1>
      </header>

      {activeView === 'dashboard' && (
        <div className="animate-fade-in">
          <Dashboard 
            summary={summary} 
            settings={settings} 
            transactions={transactions}
            accounts={accounts}
            onCategoryClick={(name, currency) => setSelectedCategoryData({name, currency})}
          />
          <TransactionList 
            transactions={transactions.slice(0, 8)} 
            accounts={accounts} 
            settings={settings} 
            onDelete={(id) => dbService.deleteTransaction(id).then(loadData)} 
            onEdit={(tr) => { setEditingTransaction(tr); setShowForm(true); }}
            hideFilters={true}
          />
        </div>
      )}

      {activeView === 'transactions' && (
        <TransactionList 
          transactions={transactions} 
          accounts={accounts} 
          settings={settings} 
          onDelete={(id) => dbService.deleteTransaction(id).then(loadData)} 
          onEdit={(tr) => { setEditingTransaction(tr); setShowForm(true); }} 
          hideFilters={false}
          onCategoryReportRequested={(name) => setSelectedCategoryData({name, currency: settings.currency})}
        />
      )}
      
      {activeView === 'accounts' && (
        <AccountManager 
          accounts={accountSummaries} 
          settings={settings} 
          onAddAccount={async (n, ty, i, c) => { await dbService.addAccount({ id: Date.now().toString(), name: n, type: ty, initialBalance: i, currency: c }); await loadData(); }} 
          onUpdateAccount={async (a) => { await dbService.updateAccount(a); await loadData(); }} 
          onDeleteAccount={async (id) => { 
            const hasTransactions = transactions.some(t => t.accountId === id || t.toAccountId === id);
            if (hasTransactions) { alert("خطا: برای این حساب سند صادر شده است."); return; }
            if (id === 'default_cash') { alert("حساب پیش‌فرض قابل حذف نیست."); return; }
            await dbService.deleteAccount(id); 
            await loadData(); 
          }} 
          onSelectAccount={setSelectedAccountForReport} 
        />
      )}
      
      {activeView === 'settings' && (
        <SettingsView 
          settings={settings} 
          transactions={transactions}
          accounts={accounts}
          onSave={(s) => { setSettings(s); localStorage.setItem('hadaf_settings', JSON.stringify(s)); }} 
          onDataImported={loadData} 
        />
      )}

      {selectedAccountForReport && (
        <AccountReport 
          account={selectedAccountForReport} 
          transactions={transactions} 
          settings={settings} 
          onClose={() => setSelectedAccountForReport(null)} 
          getAccountName={(id) => accounts.find(a => a.id === id)?.name || ''} 
        />
      )}

      {selectedCategoryData && (
        <CategoryReport
          category={selectedCategoryData.name}
          currency={selectedCategoryData.currency}
          transactions={transactions}
          accounts={accounts}
          settings={settings}
          onClose={() => setSelectedCategoryData(null)}
        />
      )}
      
      {showForm && (
        <div className="fixed inset-0 z-[110] bg-gray-50 dark:bg-slate-950 p-6 overflow-y-auto">
          <TransactionForm onAdd={handleSaveTransaction} accounts={accounts} settings={settings} editingTransaction={editingTransaction} />
          <button onClick={() => { setShowForm(false); setEditingTransaction(null); }} className="w-full py-4 text-gray-400 dark:text-slate-500 font-bold">بستن</button>
        </div>
      )}

      {showExitConfirm && (
        <ExitConfirmationOverlay onClose={() => setShowExitConfirm(false)} />
      )}

      <nav className="fixed bottom-6 left-6 right-6 h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-gray-100 dark:border-slate-800 shadow-2xl rounded-[2.5rem] flex items-center justify-around z-40">
        <button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center gap-1 ${activeView === 'dashboard' ? 'text-blue-600' : 'text-gray-300 dark:text-slate-600'}`}>
          🏠<span className="text-[8px] font-black">خانه</span>
        </button>
        <button onClick={() => setActiveView('transactions')} className={`flex flex-col items-center gap-1 ${activeView === 'transactions' ? 'text-blue-600' : 'text-gray-300 dark:text-slate-600'}`}>
          📋<span className="text-[8px] font-black">اسناد</span>
        </button>
        
        <div className="relative">
          <button 
            onClick={() => setShowForm(true)} 
            className="bg-blue-600 text-white w-16 h-16 rounded-[2rem] shadow-xl flex items-center justify-center text-4xl -translate-y-8 border-4 border-white dark:border-slate-900 active:scale-95 transition-all"
          >
            +
          </button>
        </div>

        <button onClick={() => setActiveView('accounts')} className={`flex flex-col items-center gap-1 ${activeView === 'accounts' ? 'text-blue-600' : 'text-gray-300 dark:text-slate-600'}`}>
          💳<span className="text-[8px] font-black">حساب‌ها</span>
        </button>
        <button onClick={() => setActiveView('settings')} className={`flex flex-col items-center gap-1 ${activeView === 'settings' ? 'text-blue-600' : 'text-gray-300 dark:text-slate-600'}`}>
          ⚙️<span className="text-[8px] font-black">تنظیمات</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
