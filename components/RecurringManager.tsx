
import React, { useState, useEffect } from 'react';
import { RecurringTransaction, Account, AppSettings } from '../types';
import { dbService } from '../services/databaseService';
import { CURRENCY_SYMBOLS } from '../constants';

interface Props {
  settings: AppSettings;
  accounts: Account[];
  onUpdate: () => void;
}

const RecurringManager: React.FC<Props> = ({ settings, accounts, onUpdate }) => {
  const [rules, setRules] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const data = await dbService.getRecurringTransactions();
    setRules(data);
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('آیا از حذف این برنامه تکرار خودکار مطمئن هستید؟ تراکنش‌های قبلی حذف نخواهند شد.')) {
      await dbService.deleteRecurringTransaction(id);
      loadRules();
      onUpdate();
    }
  };

  const getFreqName = (f: string) => {
    switch(f) {
      case 'daily': return 'روزانه';
      case 'weekly': return 'هفتگی';
      case 'monthly': return 'ماهانه';
      case 'yearly': return 'سالانه';
      default: return f;
    }
  };

  if (isLoading) return <div className="p-10 text-center text-gray-400 font-bold">در حال بارگذاری...</div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="px-1 flex justify-between items-center">
        <h3 className="text-xl font-black text-gray-800 dark:text-white">برنامه‌های تکرار خودکار</h3>
        <span className="text-[10px] text-gray-400 font-bold bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-full">{rules.length} مورد فعال</span>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-slate-800 text-gray-400 text-sm font-bold shadow-sm">
          <div className="text-4xl mb-4">🔄</div>
          هنوز برنامه تکراری ثبت نشده است.<br/>
          <span className="text-[10px] opacity-70 mt-2 block">هنگام ثبت تراکنش جدید، گزینه "تکرار خودکار" را فعال کنید.</span>
        </div>
      ) : (
        rules.map((rule, index) => {
          const acc = accounts.find(a => a.id === rule.accountId);
          return (
            <div 
              key={rule.id} 
              style={{ animationDelay: `${index * 0.05}s` }}
              className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between animate-slide-up"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold ${rule.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  🔄
                </div>
                <div className="text-right">
                  <div className="font-black text-sm text-gray-800 dark:text-slate-200">{rule.category}</div>
                  <div className="text-[10px] text-gray-400 font-bold">
                    {getFreqName(rule.frequency)} • {acc?.name}
                  </div>
                  <div className="text-[9px] text-blue-500 font-black mt-1">سررسید بعدی: {rule.nextDueDate}</div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className={`font-mono font-black text-sm ${rule.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {rule.amount.toLocaleString()} <span className="text-[9px]">{CURRENCY_SYMBOLS[acc?.currency || 'TL']}</span>
                </div>
                <button 
                  onClick={() => handleDelete(rule.id)}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default RecurringManager;
