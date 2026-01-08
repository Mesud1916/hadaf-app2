
import React, { useState, useEffect, useMemo } from 'react';
import { Account, AccountType, AccountSummary, AppSettings, Currency } from '../types';
import { CURRENCY_SYMBOLS } from '../constants';

interface Props {
  accounts: AccountSummary[];
  settings: AppSettings;
  onAddAccount: (name: string, type: AccountType, initialBalance: number, currency: Currency) => void;
  onUpdateAccount: (account: Account) => void;
  onDeleteAccount: (id: string) => void;
  onSelectAccount: (acc: AccountSummary) => void;
}

const AccountManager: React.FC<Props> = ({ accounts, settings, onAddAccount, onUpdateAccount, onDeleteAccount, onSelectAccount }) => {
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [nature, setNature] = useState<'debit' | 'credit'>('debit'); 
  const [type, setType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState<Currency>('TL');
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name);
      setInitialBalance(Math.abs(editingAccount.initialBalance).toString());
      setNature(editingAccount.initialBalance >= 0 ? 'debit' : 'credit');
      setType(editingAccount.type);
      setCurrency(editingAccount.currency);
      setIsAdding(true);
    } else {
      setCurrency(settings.currency);
    }
  }, [editingAccount, settings.currency]);

  // مرتب‌سازی حساب‌ها بر اساس نوع
  const sortedAccounts = useMemo(() => {
    const typePriority: Record<AccountType, number> = {
      bank: 1,
      cash: 2,
      person: 3
    };

    return [...accounts].sort((a, b) => {
      // ابتدا بر اساس اولویت نوع
      if (typePriority[a.type] !== typePriority[b.type]) {
        return typePriority[a.type] - typePriority[b.type];
      }
      // سپس بر اساس نام (الفبایی)
      return a.name.localeCompare(b.name, 'fa');
    });
  }, [accounts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const amount = (Number(initialBalance) || 0) * (nature === 'debit' ? 1 : -1);
    if (editingAccount) {
      onUpdateAccount({ ...editingAccount, name, type, initialBalance: amount, currency });
    } else {
      onAddAccount(name, type, amount, currency);
    }
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setInitialBalance('');
    setNature('debit');
    setIsAdding(false);
    setEditingAccount(null);
  };

  const getIcon = (type: AccountType) => {
    switch (type) {
      case 'bank': return '💳';
      case 'cash': return '💵';
      case 'person': return '👤';
      default: return '💰';
    }
  };

  const getTypeName = (type: AccountType) => {
    switch (type) {
      case 'bank': return 'بانکی';
      case 'cash': return 'نقدی';
      case 'person': return 'شخص / طرف حساب';
    }
  };

  const currencies: Currency[] = ['TL', 'USD', 'EUR', 'TOMAN'];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-xl font-black text-gray-800 dark:text-slate-100">حساب‌ها و اشخاص</h3>
        <button 
          onClick={() => isAdding ? resetForm() : setIsAdding(true)}
          className={`font-bold text-sm px-4 py-2 rounded-full transition-all ${isAdding ? 'bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none'}`}
        >
          {isAdding ? 'انصراف' : '+ تعریف جدید'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-blue-100 dark:border-slate-800 shadow-xl space-y-4 animate-slide-up">
          <h4 className="font-black text-gray-700 dark:text-slate-200">{editingAccount ? 'ویرایش حساب' : 'تعریف حساب یا شخص جدید'}</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 text-right">
              <label className="block text-xs text-gray-400 mb-1 mr-1">نوع حساب</label>
              <div className="flex gap-2">
                {(['bank', 'cash', 'person'] as AccountType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setType(t);
                      if (t !== 'person') setNature('debit'); 
                    }}
                    className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all border ${type === t ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-100 dark:border-slate-700'}`}
                  >
                    {getTypeName(t)}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2 text-right">
              <label className="block text-xs text-gray-400 mb-1 mr-1">نام</label>
              <input 
                type="text" 
                className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: بانک زراعت، آیدین و..."
                required
              />
            </div>
            
            <div className="col-span-2 text-right">
              <label className="block text-xs text-gray-400 mb-1 mr-1">واحد پول</label>
              <div className="grid grid-cols-4 gap-2">
                {currencies.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${currency === c ? 'bg-gray-800 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2 text-right">
              <label className="block text-xs text-gray-400 mb-1 mr-1">مانده اول دوره ({CURRENCY_SYMBOLS[currency]})</label>
              <div className="flex gap-2">
                {type === 'person' ? (
                  <button
                    type="button"
                    onClick={() => setNature(nature === 'debit' ? 'credit' : 'debit')}
                    className={`px-4 rounded-xl font-bold text-xs border transition-colors ${nature === 'debit' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}
                  >
                    {nature === 'debit' ? 'بدهکار (طلب ما)' : 'بستانکار (بدهی ما)'}
                  </button>
                ) : (
                  <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl font-bold text-xs flex items-center">
                    بدهکار (موجودی)
                  </div>
                )}
                <input 
                  type="number" 
                  inputMode="decimal"
                  className="flex-1 p-3 bg-gray-50 dark:bg-slate-800 border dark:text-white border-gray-100 dark:border-slate-700 rounded-xl font-mono text-lg font-bold"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="0"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2 mr-1">
                {type === 'person' 
                  ? 'بدهکار یعنی شخص به شما بدهی دارد. بستانکار یعنی شما به شخص بدهکارید.' 
                  : 'موجودی فعلی بانک یا صندوق خود را وارد کنید.'}
              </p>
            </div>
          </div>

          <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-black shadow-lg active:scale-95 transition-transform mt-2">
            {editingAccount ? 'بروزرسانی حساب' : 'ذخیره حساب'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3">
        {sortedAccounts.map((acc, index) => (
          <div 
            key={acc.id} 
            style={{ animationDelay: `${index * 0.05}s` }}
            className="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm flex items-stretch overflow-hidden group animate-slide-up"
          >
            <div onClick={() => onSelectAccount(acc)} className="flex-1 p-5 flex items-center justify-between active:bg-gray-50 dark:active:bg-slate-800/50 cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="text-2xl bg-gray-50 dark:bg-slate-800 w-12 h-12 flex items-center justify-center rounded-xl">{getIcon(acc.type)}</div>
                <div className="text-right">
                  <div className="font-black text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    {acc.name}
                    <button onClick={(e) => { e.stopPropagation(); setEditingAccount(acc); }} className="text-[10px] text-blue-400 font-bold">ویرایش</button>
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">
                    {getTypeName(acc.type)} • {acc.currency}
                    {acc.type === 'person' && (
                      <span className={`mr-2 font-black ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ({acc.balance >= 0 ? 'بدهکار/طلب' : 'بستانکار/بدهی'})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-left">
                <div className={`font-mono font-black text-lg ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(acc.balance).toLocaleString()} {CURRENCY_SYMBOLS[acc.currency]}
                </div>
              </div>
            </div>
            <div 
              className={`flex items-center px-4 border-r border-gray-100 dark:border-slate-800 cursor-pointer ${confirmDeleteId === acc.id ? 'bg-red-500' : 'bg-gray-50/50 dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (confirmDeleteId === acc.id) { onDeleteAccount(acc.id); setConfirmDeleteId(null); }
                else { setConfirmDeleteId(acc.id); setTimeout(() => setConfirmDeleteId(null), 3000); }
              }}
            >
              <span className={`text-lg ${confirmDeleteId === acc.id ? 'text-white' : 'text-red-400'}`}>{confirmDeleteId === acc.id ? '✅' : '🗑️'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountManager;
