
import React, { useRef, useState, useMemo } from 'react';
import { AppSettings, Currency, DateFormat, AppTheme, Transaction, Account } from '../types';
import { dbService } from '../services/databaseService';
import { CURRENCY_NAMES } from '../constants';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import RecurringManager from './RecurringManager';

interface Props {
  settings: AppSettings;
  transactions: Transaction[]; 
  accounts: Account[];
  onSave: (settings: AppSettings) => void;
  onDataImported?: () => void;
}

const SettingsView: React.FC<Props> = ({ settings, transactions, accounts, onSave, onDataImported }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [newCatName, setNewCatName] = useState('');
  
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [tempPin, setTempPin] = useState('');
  
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  const usedCategories = useMemo(() => {
    const usage = new Set<string>();
    transactions.forEach(t => usage.add(t.category));
    return usage;
  }, [transactions]);

  const handleToggleSecurity = (enabled: boolean) => {
    if (enabled && !settings.security.pin) {
      setShowPinDialog(true);
    } else {
      onSave({ ...settings, security: { ...settings.security, enabled } });
    }
  };

  const handleSetPin = () => {
    if (tempPin.length !== 4) {
      alert("رمز باید ۴ رقم باشد.");
      return;
    }
    onSave({ ...settings, security: { ...settings.security, enabled: true, pin: tempPin } });
    setTempPin('');
    setShowPinDialog(false);
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const currentCats = [...settings.categories[catType]];
    if (currentCats.includes(newCatName.trim())) {
      alert("این دسته‌بندی قبلاً تعریف شده است.");
      return;
    }
    const updatedCats = { ...settings.categories, [catType]: [...currentCats, newCatName.trim()] };
    onSave({ ...settings, categories: updatedCats });
    setNewCatName('');
  };

  const handleDeleteCategory = (index: number) => {
    const currentCats = [...settings.categories[catType]];
    const updatedCatsList = currentCats.filter((_, i) => i !== index);
    const updatedCats = { ...settings.categories, [catType]: updatedCatsList };
    onSave({ ...settings, categories: updatedCats });
    setConfirmDeleteIdx(null);
  };

  const handleStartEdit = (index: number, value: string) => {
    setEditingIndex(index);
    setEditingValue(value);
    setConfirmDeleteIdx(null);
  };

  const handleSaveEdit = (index: number) => {
    if (!editingValue.trim()) return;
    const currentCats = [...settings.categories[catType]];
    if (currentCats.some((c, i) => c === editingValue.trim() && i !== index)) {
      alert("این نام تکراری است.");
      return;
    }
    currentCats[index] = editingValue.trim();
    const updatedCats = { ...settings.categories, [catType]: currentCats };
    onSave({ ...settings, categories: updatedCats });
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await dbService.exportAllData();
      
      // ایجاد نام فایل با تاریخ و زمان خوانا
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}_${hours}-${mins}`;
      const fileName = `hadaf_backup_${dateString}.json`;

      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        
        await Filesystem.writeFile({
          path: fileName, 
          data: data, 
          directory: Directory.Cache, 
          encoding: Encoding.UTF8,
        });

        const fileUri = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fileName,
        });

        await Share.share({
          title: 'فایل پشتیبان هدف',
          url: fileUri.uri,
          files: [fileUri.uri], 
          dialogTitle: 'ارسال فایل پشتیبان',
        });
      } else {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = fileName; link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) { alert("خطا در پشتیبان‌گیری."); } finally { setExporting(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const success = await dbService.importAllData(text);
      if (success) setImportSuccess(true);
      else alert("فایل نامعتبر است.");
    } catch (err) { alert("خطا در بازیابی."); } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRestartApp = async () => {
    if (Capacitor.isNativePlatform()) {
      try { await App.exitApp(); } catch (e) { window.location.reload(); }
    } else { window.location.reload(); }
  };

  if (importSuccess) {
    return (
      <div className="fixed inset-0 z-[1000] bg-blue-700 flex flex-col items-center justify-center p-8 text-white text-center animate-fade-in" dir="rtl">
        <div className="w-24 h-24 bg-white/20 rounded-[2rem] flex items-center justify-center text-5xl mb-8 animate-bounce">✅</div>
        <h2 className="text-2xl font-black mb-4">بازیابی موفق</h2>
        <p className="text-blue-100 text-sm font-bold mb-12">لطفاً برنامه را ببندید و دوباره باز کنید.</p>
        <button onClick={handleRestartApp} className="w-full py-5 bg-white text-blue-700 rounded-2xl font-black shadow-2xl active:scale-95 text-sm">خروج از برنامه</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 text-right" dir="rtl">
      <h3 className="text-2xl font-black text-gray-800 dark:text-white px-2">تنظیمات</h3>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
        <h4 className="font-black text-sm text-gray-800 dark:text-slate-200 mb-2">🎨 ظاهر برنامه</h4>
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl">
          {(['light', 'dark'] as AppTheme[]).map((t) => (
            <button
              key={t}
              onClick={() => onSave({ ...settings, theme: t })}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${settings.theme === t ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-gray-400 dark:text-slate-500'}`}
            >
              {t === 'light' ? '🌙 حالت روشن' : '🌞 حالت تاریک'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
        <h4 className="font-black text-sm text-gray-800 dark:text-slate-200 mb-2">🔒 امنیت</h4>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl">
          <div>
            <div className="text-xs font-black text-gray-700 dark:text-slate-300">قفل اپلیکیشن</div>
            <div className="text-[10px] text-gray-400 font-bold">هنگام ورود</div>
          </div>
          <button onClick={() => handleToggleSecurity(!settings.security.enabled)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.security.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.security.enabled ? 'left-1' : 'left-7'}`}></div>
          </button>
        </div>
        {settings.security.enabled && (
          <button onClick={() => setShowPinDialog(true)} className="w-full py-3 text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl">تغییر رمز ۴ رقمی</button>
        )}
      </div>

      {showPinDialog && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-[2.5rem] p-8 animate-slide-up">
            <h5 className="font-black text-center mb-6 dark:text-white">تنظیم رمز ورود</h5>
            <input type="password" inputMode="numeric" maxLength={4} value={tempPin} onChange={(e) => setTempPin(e.target.value.replace(/\D/g, ''))} placeholder="ـ ـ ـ ـ" className="w-full text-center text-3xl font-black tracking-[1rem] p-4 bg-gray-50 dark:bg-slate-800 dark:text-white rounded-2xl outline-none mb-6" />
            <div className="flex gap-2">
              <button onClick={handleSetPin} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black text-xs shadow-lg shadow-blue-100">تایید</button>
              <button onClick={() => { setShowPinDialog(false); setTempPin(''); }} className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-gray-400 rounded-xl font-black text-xs">انصراف</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-black mb-3 dark:text-slate-300">🏷️ نام نمایشی برنامه</label>
          <input type="text" value={settings.appName} onChange={(e) => onSave({ ...settings, appName: e.target.value })} className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl outline-none font-black text-gray-700 dark:text-slate-200" />
        </div>
        <div>
          <label className="block text-xs font-black text-gray-400 mb-3 mr-1">💰 ارز پیش‌فرض گزارش‌ها</label>
          <div className="grid grid-cols-2 gap-2">
            {(['TL', 'TOMAN', 'USD', 'EUR'] as Currency[]).map((cur) => (
              <button key={cur} onClick={() => onSave({ ...settings, currency: cur })} className={`py-3 rounded-xl text-[10px] font-black transition-all border ${settings.currency === cur ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-gray-50 dark:bg-slate-800 text-gray-500'}`}>
                {CURRENCY_NAMES[cur]} ({cur})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm">
        <label className="block text-sm font-black mb-4 dark:text-slate-300">📁 مدیریت دسته‌بندی‌ها</label>
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl mb-4">
          <button onClick={() => { setCatType('expense'); setEditingIndex(null); }} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${catType === 'expense' ? 'bg-white dark:bg-slate-700 text-red-600 shadow-sm' : 'text-gray-400'}`}>هزینه‌ها</button>
          <button onClick={() => { setCatType('income'); setEditingIndex(null); }} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${catType === 'income' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-gray-400'}`}>درآمدها</button>
        </div>
        <div className="flex gap-2 mb-6">
          <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="افزودن..." className="flex-1 bg-gray-50 dark:bg-slate-800 p-3 rounded-xl text-xs font-bold outline-none dark:text-white" />
          <button onClick={handleAddCategory} className="bg-blue-600 text-white px-4 rounded-xl font-black shadow-lg">+</button>
        </div>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {settings.categories[catType].map((cat, idx) => (
            <div key={`${catType}-${idx}`} className="group flex items-center justify-between bg-gray-50 dark:bg-slate-800/50 p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all">
              {editingIndex === idx ? (
                <div className="flex-1 flex gap-2">
                  <input autoFocus type="text" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="flex-1 bg-white dark:bg-slate-700 rounded-lg px-2 py-1 text-xs font-bold dark:text-white" />
                  <button onClick={() => handleSaveEdit(idx)} className="text-green-500 text-xs font-black">ذخیره</button>
                  <button onClick={() => setEditingIndex(null)} className="text-gray-400 text-xs">لغو</button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-bold text-gray-700 dark:text-slate-300">{cat}</span>
                  <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleStartEdit(idx, cat)} className="text-[10px] text-blue-500 font-bold">ویرایش</button>
                    {!usedCategories.has(cat) && (
                      confirmDeleteIdx === idx ? (
                        <div className="flex gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg px-2 py-1">
                          <button onClick={() => handleDeleteCategory(idx)} className="text-[10px] text-red-600 font-black">حذف</button>
                          <button onClick={() => setConfirmDeleteIdx(null)} className="text-[10px] text-gray-400">لغو</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteIdx(idx)} className="text-[10px] text-red-400 font-bold">حذف</button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
        <h4 className="font-black text-lg mb-4 text-gray-800 dark:text-white">🔄 مدیریت تراکنش‌های دوره‌ای</h4>
        <p className="text-[10px] text-gray-400 font-bold mb-4">
          تراکنش‌های دوره‌ای کارهایی هستند که سیستم به صورت خودکار در زمان‌های مشخص ثبت می‌کند.
        </p>
        <RecurringManager settings={settings} accounts={accounts} onUpdate={onDataImported || (() => {})} />
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
        <h4 className="font-black text-lg mb-6 text-gray-800 dark:text-white">پشتیبان‌گیری</h4>
        <button onClick={handleExport} disabled={exporting || importing} className={`w-full p-5 bg-blue-600 text-white rounded-2xl font-black text-sm mb-4 shadow-xl active:scale-95 transition-all ${exporting ? 'opacity-50' : ''}`}>📤 ایجاد فایل پشتیبان</button>
        <button onClick={() => fileInputRef.current?.click()} disabled={exporting || importing} className={`w-full bg-gray-50 dark:bg-slate-800 p-5 rounded-2xl font-black text-sm text-gray-600 dark:text-slate-400 active:scale-95 transition-all ${importing ? 'opacity-50' : ''}`}>📥 بازیابی از فایل</button>
        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
      </div>
      
      <div className="text-center p-8 opacity-90">
        <p className="text-[11px] text-gray-500 font-bold">طراحی و توسعه: مسعود آل‌طه</p>
        <a href="https://t.me/Masoud1916" className="text-[10px] text-blue-600 font-black">Telegram: @Masoud1916</a>
      </div>
    </div>
  );
};

export default SettingsView;
