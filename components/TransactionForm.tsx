
import React, { useState, useEffect, useMemo } from 'react';
import { CURRENCY_SYMBOLS } from '../constants';
import { Transaction, TransactionType, Account, AppSettings, RecurrenceFrequency, RecurringTransaction } from '../types';
import { dbService } from '../services/databaseService';

interface Props {
  onAdd: (transaction: Transaction) => void;
  accounts: Account[];
  settings: AppSettings;
  editingTransaction?: Transaction | null;
}

const TransactionForm: React.FC<Props> = ({ onAdd, accounts, settings, editingTransaction }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Recurring States
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');

  const sourceAccount = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);
  const targetAccount = useMemo(() => accounts.find(a => a.id === toAccountId), [accounts, toAccountId]);
  
  const isMultiCurrencyTransfer = useMemo(() => {
    return type === 'transfer' && 
           sourceAccount && 
           targetAccount && 
           sourceAccount.currency !== targetAccount.currency;
  }, [type, sourceAccount, targetAccount]);

  const currentCategories = useMemo(() => {
    if (type === 'transfer') return ['انتقال وجه'];
    return settings.categories[type as 'expense' | 'income'] || [];
  }, [type, settings.categories]);

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(editingTransaction.amount.toString());
      setTargetAmount(editingTransaction.targetAmount?.toString() || '');
      setCategory(editingTransaction.category);
      setAccountId(editingTransaction.accountId);
      if (editingTransaction.toAccountId) setToAccountId(editingTransaction.toAccountId);
      setNote(editingTransaction.note);
      setDate(editingTransaction.date);
    } else {
      setCategory(currentCategories[0] || '');
    }
  }, [editingTransaction, currentCategories]);

  useEffect(() => {
    if (type === 'transfer') {
      if (!toAccountId || toAccountId === accountId) {
        const diffCurrencyAcc = accounts.find(a => a.id !== accountId && a.currency !== sourceAccount?.currency);
        const otherAcc = diffCurrencyAcc || accounts.find(a => a.id !== accountId);
        if (otherAcc) setToAccountId(otherAcc.id);
      }
    }
  }, [type, accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !accountId) return;
    
    if (type === 'transfer') {
      if (!toAccountId || accountId === toAccountId) {
        alert('لطفاً حساب مقصد متفاوتی انتخاب کنید');
        return;
      }
    }

    const transaction: Transaction = {
      id: editingTransaction ? editingTransaction.id : Date.now().toString(),
      amount: Number(amount),
      targetAmount: isMultiCurrencyTransfer ? Number(targetAmount) : Number(amount),
      category: type === 'transfer' ? 'انتقال وجه' : category,
      type,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      note,
      date: date,
      isRecurring: isRecurring
    };

    // If recurring is enabled, create a rule in the background
    if (isRecurring && !editingTransaction && type !== 'transfer') {
      const nextDue = new Date(date);
      if (frequency === 'daily') nextDue.setDate(nextDue.getDate() + 1);
      else if (frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
      else if (frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
      else if (frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);

      const recurringRule: RecurringTransaction = {
        id: `rule_${Date.now()}`,
        amount: Number(amount),
        category: category,
        type: type,
        accountId: accountId,
        frequency: frequency,
        startDate: date,
        nextDueDate: nextDue.toISOString().split('T')[0],
        note: note,
        isActive: true
      };
      await dbService.addRecurringTransaction(recurringRule);
    }

    onAdd(transaction);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800 mb-6 animate-slide-up">
      <h3 className="text-lg font-bold mb-4 dark:text-white">{editingTransaction ? 'ویرایش سند' : 'ثبت سند جدید'}</h3>
      
      <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
        {(['expense', 'income', 'transfer'] as TransactionType[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { 
              setType(t); 
              if (t !== 'transfer') {
                const cats = settings.categories[t as 'expense' | 'income'];
                setCategory(cats[0] || '');
              }
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${type === t ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-500'}`}
          >
            {t === 'expense' ? 'هزینه' : t === 'income' ? 'درآمد' : 'انتقال'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {type === 'transfer' ? (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] text-gray-400 mb-1 mr-1">از حساب (مبدأ)</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-1 mr-1">به حساب (مقصد)</label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id} disabled={acc.id === accountId}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] text-gray-400 mb-1 mr-1">حساب / شخص</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-1 mr-1">دسته‌بندی</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-white">
                {currentCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 mr-1">
              مبلغ {type === 'transfer' ? 'پرداختی از مبدأ' : 'تراکنش'} ({CURRENCY_SYMBOLS[sourceAccount?.currency || 'TL']})
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xl dark:text-white"
              placeholder="0"
              required
            />
          </div>

          {isMultiCurrencyTransfer && (
            <div className="bg-blue-600 dark:bg-indigo-900 p-5 rounded-3xl text-white shadow-xl shadow-blue-100 dark:shadow-none animate-slide-up">
              <label className="block text-[10px] opacity-80 mb-2 font-bold">
                🔄 مبلغ معادل دریافتی در مقصد ({CURRENCY_SYMBOLS[targetAccount?.currency || 'TL']})
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full p-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-white outline-none font-bold text-xl text-white placeholder-white/30"
                placeholder="مبلغ دریافتی..."
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1">
             <div>
              <label className="block text-[10px] text-gray-400 mb-1 mr-1">تاریخ</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 mb-1 mr-1">یادداشت</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white"
              placeholder="توضیحات اختیاری..."
            />
          </div>

          {/* New Recurring UI */}
          {!editingTransaction && type !== 'transfer' && (
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔄</span>
                  <span className="text-xs font-black text-gray-700 dark:text-slate-300">تکرار خودکار این سند</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`w-10 h-5 rounded-full transition-all relative ${isRecurring ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isRecurring ? 'left-0.5' : 'left-5.5'}`}></div>
                </button>
              </div>
              
              {isRecurring && (
                <div className="animate-slide-up">
                  <label className="block text-[10px] text-gray-400 mb-1 mr-1 font-bold">بازه زمانی تکرار</label>
                  <select 
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg outline-none text-[10px] font-black dark:text-white"
                  >
                    <option value="daily">روزانه</option>
                    <option value="weekly">هفتگی</option>
                    <option value="monthly">ماهانه</option>
                    <option value="yearly">سالانه</option>
                  </select>
                  <p className="text-[9px] text-blue-500 mt-2 font-bold italic">سیستم به صورت خودکار در این بازه، مبلغ را ثبت خواهد کرد.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <button type="submit" className={`w-full py-4 mt-4 rounded-2xl font-black text-white shadow-xl active:scale-95 transition-all ${type === 'expense' ? 'bg-red-500 shadow-red-100 dark:shadow-none' : type === 'income' ? 'bg-green-500 shadow-green-100 dark:shadow-none' : 'bg-blue-600 shadow-blue-100 dark:shadow-none'}`}>
          {editingTransaction ? 'بروزرسانی سند' : 'ثبت نهایی سند'}
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;
