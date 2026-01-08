
import React, { useState, useMemo } from 'react';
import { Summary, AppSettings, Currency, Transaction, Account } from '../types';
import { CURRENCY_SYMBOLS, COLORS } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  summary: Summary;
  settings: AppSettings;
  transactions: Transaction[];
  accounts: Account[];
  onCategoryClick?: (category: string, currency: Currency) => void;
}

type TimePeriod = 'month' | 'year' | 'all';

const Dashboard: React.FC<Props> = ({ summary, settings, transactions, accounts, onCategoryClick }) => {
  const [chartType, setChartType] = useState<'expense' | 'income'>('expense');
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(settings.currency);
  const [showLiquidOnly, setShowLiquidOnly] = useState(false);
  
  const currencies: Currency[] = ['TL', 'USD', 'EUR', 'TOMAN'];

  const displayedBalances = useMemo(() => {
    if (!showLiquidOnly) return summary.balancesByCurrency;
    const liquidBalances: Record<Currency, number> = { TL: 0, USD: 0, EUR: 0, TOMAN: 0 };
    accounts.forEach(acc => {
      if (acc.type === 'bank' || acc.type === 'cash') {
        let balance = acc.initialBalance;
        transactions.forEach(t => {
          if (t.accountId === acc.id) {
            if (t.type === 'expense' || t.type === 'transfer') balance -= t.amount;
            else if (t.type === 'income') balance += t.amount;
          } else if (t.toAccountId === acc.id) balance += (t.targetAmount || t.amount);
        });
        liquidBalances[acc.currency] += balance;
      }
    });
    return liquidBalances;
  }, [summary.balancesByCurrency, showLiquidOnly, accounts, transactions]);

  const activeBalances = currencies.filter(c => displayedBalances[c] && displayedBalances[c] !== 0);
  const availableCurrencies = useMemo(() => {
    const used = new Set<string>();
    transactions.forEach(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      if (acc) used.add(acc.currency);
    });
    accounts.forEach(a => { if (a.initialBalance !== 0) used.add(a.currency); });
    return currencies.filter(c => used.has(c));
  }, [transactions, accounts]);

  const filteredCategoryData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const filtered = transactions.filter(t => {
      if (t.type !== chartType) return false;
      const acc = accounts.find(a => a.id === t.accountId);
      if (!acc || acc.currency !== selectedCurrency) return false;
      const tDate = new Date(t.date);
      if (period === 'month') return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
      else if (period === 'year') return tDate.getFullYear() === currentYear;
      return true;
    });
    const data: Record<string, number> = {};
    filtered.forEach(t => { data[t.category] = (data[t.category] || 0) + t.amount; });
    return Object.entries(data).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions, accounts, chartType, period, selectedCurrency]);

  const totalFilteredValue = useMemo(() => filteredCategoryData.reduce((sum, item) => sum + item.value, 0), [filteredCategoryData]);
  const hasData = filteredCategoryData.length > 0;

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 text-right" dir="rtl">
          <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">{payload[0].name}</p>
          <p className="text-sm font-black text-blue-600 dark:text-blue-400">
            {payload[0].value.toLocaleString()} {CURRENCY_SYMBOLS[selectedCurrency]}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mb-8 space-y-4">
      <div className="flex justify-between items-center px-1 mb-2">
        <h2 className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">مرور وضعیت مالی</h2>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
          <p className="text-[9px] text-gray-500 dark:text-slate-500 font-black tracking-tighter">هسته فعال هدف ۲.۱</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 dark:from-slate-800 dark:to-slate-950 p-7 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
            {showLiquidOnly ? 'دارایی‌های نقد' : 'مجموع کل موجودی'}
          </div>
          <button 
            onClick={() => setShowLiquidOnly(!showLiquidOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black transition-all border ${
              showLiquidOnly ? 'bg-white text-slate-900 border-white shadow-lg' : 'bg-white/10 text-white border-white/20'
            }`}
          >
            {showLiquidOnly ? '👀 مشاهده همه' : '💧 فقط نقد'}
          </button>
        </div>
        <div className="space-y-4 relative z-10">
          {activeBalances.length > 0 ? activeBalances.map(c => (
            <div key={c} className="flex justify-between items-end border-b border-white/10 pb-3 animate-fade-in">
              <span className="text-xs font-black opacity-50 tracking-widest">{c}</span>
              <span className="text-3xl font-black font-mono tracking-tighter">
                {displayedBalances[c].toLocaleString()} <span className="text-xs font-medium opacity-60 ml-1">{CURRENCY_SYMBOLS[c]}</span>
              </span>
            </div>
          )) : (
            <div className="text-2xl font-black py-4 opacity-30 tracking-widest">حسابی یافت نشد</div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm animate-fade-in">
        <div className="flex flex-col gap-5 mb-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">📊 تحلیل مخارج و درآمد</h3>
            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
              <button onClick={() => setChartType('expense')} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${chartType === 'expense' ? 'bg-white dark:bg-slate-700 text-red-600 shadow-sm' : 'text-gray-500'}`}>هزینه‌ها</button>
              <button onClick={() => setChartType('income')} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${chartType === 'income' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-gray-500'}`}>درآمدها</button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
            {availableCurrencies.map(cur => (
              <button key={cur} onClick={() => setSelectedCurrency(cur)} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all border shrink-0 ${selectedCurrency === cur ? 'bg-slate-800 border-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-gray-50 dark:bg-slate-800 text-gray-500'}`}>{cur}</button>
            ))}
          </div>
        </div>

        {hasData ? (
          <div className="flex flex-col items-center">
            <div className="w-full h-56 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Pie data={filteredCategoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={6} dataKey="value" nameKey="name">
                    {filteredCategoryData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className={`text-xl font-black font-mono tracking-tighter ${chartType === 'expense' ? 'text-red-600' : 'text-green-600'}`}>{totalFilteredValue.toLocaleString()}</span>
                <span className="text-[8px] font-black text-gray-400 mt-1 uppercase tracking-widest">مجموع {chartType === 'expense' ? 'هزینه' : 'درآمد'}</span>
              </div>
            </div>
            <div className="w-full grid grid-cols-2 gap-3 mt-6">
              {filteredCategoryData.map((item, index) => (
                <div key={item.name} onClick={() => onCategoryClick?.(item.name, selectedCurrency)} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800/40 rounded-[1.5rem] cursor-pointer active:scale-95 transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30 group">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight">{item.name}</p>
                    <p className="text-[10px] font-black text-gray-500 dark:text-slate-500 font-mono">{item.value.toLocaleString()} <span className="text-[8px] font-normal opacity-70">{CURRENCY_SYMBOLS[selectedCurrency]}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="text-4xl mb-4 grayscale opacity-20">📊</div>
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">تراکنشی برای نمایش وجود ندارد</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
