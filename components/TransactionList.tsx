
import React, { useState, useMemo } from 'react';
import { Transaction, Account, AppSettings, TransactionType } from '../types';
import { CURRENCY_SYMBOLS } from '../constants';

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  settings: AppSettings;
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
  hideFilters?: boolean;
  onCategoryReportRequested?: (category: string) => void;
}

type SortField = 'date' | 'amount' | 'category';
type SortOrder = 'asc' | 'desc';

const TransactionList: React.FC<Props> = ({ transactions, accounts, settings, onDelete, onEdit, hideFilters = false, onCategoryReportRequested }) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [selectedType, setSelectedType] = useState<TransactionType | 'all'>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  const getAccount = (id: string) => accounts.find(a => a.id === id);
  
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat(settings.dateFormat === 'jalali' ? 'fa-IR' : 'en-US', { month: 'short', day: 'numeric' }).format(date);
    } catch { return dateStr; }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(null);
  };

  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(id);
    setDeletingId(null);
  };

  const allCategories = useMemo(() => {
    return Array.from(new Set([
      ...settings.categories.expense,
      ...settings.categories.income,
      'انتقال وجه'
    ]));
  }, [settings.categories]);

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...transactions];
    if (!hideFilters) {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(t => {
          const acc = getAccount(t.accountId);
          const toAcc = t.toAccountId ? getAccount(t.toAccountId) : null;
          return t.category.toLowerCase().includes(q) || 
                 t.note.toLowerCase().includes(q) ||
                 acc?.name.toLowerCase().includes(q) ||
                 toAcc?.name.toLowerCase().includes(q);
        });
      }
      if (selectedCategory) result = result.filter(t => t.category === selectedCategory);
      if (minAmount !== '') result = result.filter(t => t.amount >= Number(minAmount));
      if (maxAmount !== '') result = result.filter(t => t.amount <= Number(maxAmount));
      if (selectedType !== 'all') result = result.filter(t => t.type === selectedType);
      if (selectedAccountId !== 'all') result = result.filter(t => t.accountId === selectedAccountId || t.toAccountId === selectedAccountId);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortBy === 'amount') comparison = a.amount - b.amount;
      else if (sortBy === 'category') comparison = a.category.localeCompare(b.category, 'fa');
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [transactions, searchQuery, selectedCategory, minAmount, maxAmount, selectedType, selectedAccountId, sortBy, sortOrder, accounts, hideFilters]);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('desc'); }
  };

  const hasActiveAdvancedFilters = minAmount !== '' || maxAmount !== '' || selectedType !== 'all' || selectedAccountId !== 'all';
  const resetFilters = () => { setMinAmount(''); setMaxAmount(''); setSelectedType('all'); setSelectedAccountId('all'); setSearchQuery(''); setSelectedCategory(null); };

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      {!hideFilters && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative group flex-1">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-600 transition-colors">🔍</span>
              <input 
                type="text"
                placeholder="جستجو در شرح، حساب یا یادداشت..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-4 pr-11 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all shadow-sm dark:text-white"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
              )}
            </div>
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all relative ${showAdvanced || hasActiveAdvancedFilters ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-500'}`}
            >
              {hasActiveAdvancedFilters && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>}
              <span className="text-xl">⚙️</span>
            </button>
          </div>

          {showAdvanced && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border border-blue-100 dark:border-slate-800 shadow-xl space-y-5 animate-slide-up">
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">جستجوی پیشرفته</h4>
                <button onClick={resetFilters} className="text-[10px] text-blue-600 font-black">پاک کردن همه</button>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-600 dark:text-gray-400 font-black mr-1 uppercase">بازه مبلغ</label>
                <div className="flex gap-2">
                  <input type="number" placeholder="حداقل" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="flex-1 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-xs font-bold outline-none dark:text-white border border-transparent focus:border-blue-100" />
                  <input type="number" placeholder="حداکثر" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="flex-1 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-xs font-bold outline-none dark:text-white border border-transparent focus:border-blue-100" />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
            <button 
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${!selectedCategory ? 'bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white shadow-lg' : 'bg-white dark:bg-slate-900 text-gray-500 border border-gray-200 dark:border-slate-800'}`}
            >
              همه دسته‌ها
            </button>
            {allCategories.map(cat => (
              <button 
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all shrink-0 ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-500 border border-gray-200 dark:border-slate-800'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center px-1 mb-2 mt-4">
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">{hideFilters ? 'تراکنش‌های اخیر' : 'لیست اسناد'}</h3>
        {!hideFilters && <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{filteredAndSortedTransactions.length} items</span>}
      </div>

      <div className="space-y-3">
        {filteredAndSortedTransactions.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800 text-gray-500 font-bold">موردی یافت نشد</div>
        ) : (
          filteredAndSortedTransactions.map((t, index) => {
            const acc = getAccount(t.accountId);
            const isConfirming = deletingId === t.id;
            return (
              <div 
                key={t.id} 
                style={{ animationDelay: `${index * 0.05}s` }}
                className={`bg-white dark:bg-slate-900 p-4 rounded-[2rem] shadow-sm border animate-slide-up transition-all ${isConfirming ? 'border-red-500 ring-4 ring-red-50 dark:ring-red-900/10' : 'border-gray-100 dark:border-slate-800'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${t.type === 'income' ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : t.type === 'expense' ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>
                      {t.type === 'income' ? '↓' : t.type === 'expense' ? '↑' : '⇄'}
                    </div>
                    <div className="truncate text-right">
                      <div className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1">
                        {!!t.isRecurring && <span className="text-[10px] text-blue-500">🔄</span>}
                        {t.type === 'transfer' ? `انتقال وجه` : t.category}
                      </div>
                      <div className="text-[10px] text-gray-600 dark:text-gray-500 font-black mt-0.5">
                        {formatDate(t.date)} • <span className="text-slate-500 dark:text-slate-400">{acc?.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={`font-mono font-black text-base ${t.type === 'income' ? 'text-green-600' : t.type === 'expense' ? 'text-red-600' : 'text-blue-600'}`}>
                      {t.amount.toLocaleString()} <span className="text-[10px] opacity-70">{CURRENCY_SYMBOLS[acc?.currency || 'TL']}</span>
                    </div>
                  </div>
                </div>
                <div className="h-[1px] bg-gray-50 dark:bg-slate-800 w-full mb-3"></div>
                <div className="flex justify-between items-center">
                  {!isConfirming ? (
                    <>
                      <div className="text-[10px] text-gray-600 dark:text-gray-500 font-bold italic truncate max-w-[50%]">{t.note || 'بدون یادداشت'}</div>
                      <div className="flex gap-2">
                        <button onClick={() => onEdit(t)} className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black border border-gray-100 dark:border-slate-700">✏️</button>
                        <button onClick={() => setDeletingId(t.id)} className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl text-[10px] font-black border border-red-100 dark:border-red-900/30">🗑️</button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-between bg-red-50 dark:bg-red-900/20 p-2 rounded-xl">
                      <span className="text-[10px] text-red-700 dark:text-red-400 font-black mr-2 animate-pulse">حذف شود؟</span>
                      <div className="flex gap-2">
                        <button onClick={() => { onDelete(t.id); setDeletingId(null); }} className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black">بله</button>
                        <button onClick={() => setDeletingId(null)} className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-500 rounded-xl text-[10px] font-black">خیر</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TransactionList;
