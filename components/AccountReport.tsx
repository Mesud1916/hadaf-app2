
import React, { useMemo, useState, useRef } from 'react';
import { Transaction, AccountSummary, AppSettings } from '../types';
import { CURRENCY_SYMBOLS } from '../constants';
import { Capacitor } from '@capacitor/core';
import html2pdf from 'html2pdf.js';

interface Props {
  account: AccountSummary;
  transactions: Transaction[];
  settings: AppSettings;
  onClose: () => void;
  getAccountName: (id: string) => string;
}

const AccountReport: React.FC<Props> = ({ account, transactions, settings, onClose, getAccountName }) => {
  const reportContentRef = useRef<HTMLDivElement>(null);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [showFilters, setShowFilters] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const setPresetDate = (days: number | 'currentMonth') => {
    const end = new Date();
    const start = new Date();
    if (days === 'currentMonth') {
      start.setDate(1);
    } else {
      start.setDate(end.getDate() - days);
    }
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const { filteredHistory, openingBalance } = useMemo(() => {
    // مرتب‌سازی اولیه صعودی برای محاسبه صحیح مانده ردیفی
    const allRelated = transactions
      .filter(t => t.accountId === account.id || t.toAccountId === account.id)
      .sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id); // پایداری سورت برای تراکنش‌های هم‌زمان
      });

    let runningBalance = account.initialBalance;
    const historyWithBalance = allRelated.map(t => {
      let change = 0;
      if (t.accountId === account.id) {
        if (t.type === 'expense' || t.type === 'transfer') change = -t.amount;
        else if (t.type === 'income') change = t.amount;
      } else if (t.toAccountId === account.id) {
        change = (t.targetAmount || t.amount);
      }
      runningBalance += change;
      return { ...t, currentBalance: runningBalance, change };
    });

    // محاسبه مانده قبل از بازه انتخابی
    const beforePeriod = historyWithBalance.filter(t => t.date < startDate);
    const opBal = beforePeriod.length > 0
      ? beforePeriod[beforePeriod.length - 1].currentBalance
      : account.initialBalance;

    // نمایش تراکنش‌های بازه به صورت صعودی (بدون reverse)
    const filtered = historyWithBalance
      .filter(t => t.date >= startDate && t.date <= endDate);

    return { filteredHistory: filtered, openingBalance: opBal };
  }, [transactions, account.id, startDate, endDate, account.initialBalance]);

  const stats = useMemo(() => {
    return filteredHistory.reduce((acc, t) => {
      if (t.change > 0) acc.income += t.change;
      else acc.expense += Math.abs(t.change);
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredHistory]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const locale = settings.dateFormat === 'jalali' ? 'fa-IR' : 'en-GB';
      return new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch { return dateStr; }
  };

  const handleExportCSV = async () => {
    try {
      const headers = ["ردیف", "تاریخ", "شرح", "ورودی (+)", "خروجی (-)", "مانده نهایی"];
      const rows = filteredHistory.map((t, idx) => {
        const desc = t.type === 'transfer'
          ? (t.accountId === account.id ? `انتقال به ${getAccountName(t.toAccountId!)}` : `دریافت از ${getAccountName(t.accountId)}`)
          : t.category;

        return [
          idx + 1,
          formatDate(t.date),
          `"${desc}${t.note ? ' - ' + t.note : ''}"`,
          t.change > 0 ? t.change : 0,
          t.change < 0 ? Math.abs(t.change) : 0,
          t.currentBalance
        ];
      });

      rows.unshift(["-", formatDate(startDate), "مانده از قبل", "-", "-", openingBalance]);

      const csvString = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\r\n");
      const fileName = `Report_${account.name.replace(/\s+/g, '_')}_${Date.now()}.csv`;

      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const base64Data = btoa(unescape(encodeURIComponent(csvString)));
        await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Cache });
        const fileUri = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
        await Share.share({ title: `گزارش اکسل ${account.name}`, files: [fileUri.uri] });
      } else {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = fileName; link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert("خطا در تولید اکسل");
    }
  };

  const handleExportPDF = async () => {
    if (!reportContentRef.current) return;
    setIsGenerating(true);

    try {
      const html2pdfFunc = (html2pdf as any).default || (html2pdf as any);
      if (typeof html2pdfFunc !== 'function') {
        throw new Error("کتابخانه PDF به درستی بارگذاری نشده است.");
      }

      try { await (document as any).fonts?.ready; } catch {}
      await new Promise(res => setTimeout(res, 120));

      const element = reportContentRef.current;
      const safeName = (account.name || 'Account').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
      const fileName = `Report_${safeName}_${Date.now()}.pdf`;

      const opt = {
        filename: fileName,
        margin: [8, 8, 8, 8],
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] },
      };

      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const dataUri: string = await html2pdfFunc().from(element).set(opt).output('datauristring');
        const cleanBase64 = dataUri.includes('base64,') ? dataUri.split('base64,')[1] : dataUri;

        await Filesystem.writeFile({ path: fileName, data: cleanBase64, directory: Directory.Cache });
        const fileUri = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
        await Share.share({ title: `گزارش PDF ${account.name}`, files: [fileUri.uri] });
      } else {
        await html2pdfFunc().from(element).set(opt).save();
      }
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("خطا در تولید PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden text-slate-900">
      <header className="p-4 flex justify-between items-center border-b border-gray-100 bg-white shrink-0 shadow-sm no-print">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-xl active:scale-90">✕</button>
          <div>
            <h2 className="text-sm font-black text-slate-800">گزارش {account.name}</h2>
            <p className="text-[8px] text-gray-500 font-bold uppercase">Account Balance Sheet</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${showFilters ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-100 text-gray-400'}`}
          >
            📅
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 bg-green-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-green-100"
          >
            EXCEL
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isGenerating}
            className="px-3 bg-blue-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-blue-100"
          >
            {isGenerating ? '...' : 'PDF'}
          </button>
        </div>
      </header>

      {showFilters && (
        <div className="p-4 bg-gray-50 border-b border-gray-200 animate-slide-up no-print">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 mr-1 font-bold">از تاریخ</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 mr-1 font-bold">تا تاریخ</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none text-slate-900"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {['۷ روز اخیر', '۳۰ روز اخیر', 'ماه جاری'].map((p, i) => (
              <button
                key={p}
                onClick={() => setPresetDate(i === 0 ? 7 : i === 1 ? 30 : 'currentMonth')}
                className="shrink-0 px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-slate-700 shadow-sm active:bg-gray-100"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 bg-gray-100/50">
        <div ref={reportContentRef} className="bg-white p-8 shadow-sm min-h-full rounded-[2.5rem] border border-gray-200" dir="rtl">
          <div className="text-center mb-10 border-b-2 border-slate-900 pb-8">
            <h1 className="text-3xl font-black text-slate-900 mb-2">{settings.appName}</h1>
            <p className="text-sm font-bold text-slate-500">گزارش اختصاصی تراکنش‌های: {account.name}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-2 tracking-widest">
              PERIOD: {formatDate(startDate)} TO {formatDate(endDate)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
              <p className="text-[10px] text-slate-400 font-black mb-1">مانده از قبل</p>
              <p className="text-sm font-black text-slate-800">
                {openingBalance.toLocaleString()} <span className="text-[10px]">{CURRENCY_SYMBOLS[account.currency]}</span>
              </p>
            </div>
            <div className="bg-green-50 p-5 rounded-3xl border border-green-100">
              <p className="text-[10px] text-green-600 font-black mb-1">مجموع ورودی</p>
              <p className="text-sm font-black text-green-800">
                {stats.income.toLocaleString()} <span className="text-[10px] font-normal">{CURRENCY_SYMBOLS[account.currency]}</span>
              </p>
            </div>
            <div className="bg-red-50 p-5 rounded-3xl border border-red-100">
              <p className="text-[10px] text-red-600 font-black mb-1">مجموع خروجی</p>
              <p className="text-sm font-black text-red-800">
                {stats.expense.toLocaleString()} <span className="text-[10px] font-normal">{CURRENCY_SYMBOLS[account.currency]}</span>
              </p>
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 text-[10px] font-black text-slate-900">
                <th className="border border-slate-900 p-3 text-center w-12">ردیف</th>
                <th className="border border-slate-900 p-3 text-center w-24">تاریخ</th>
                <th className="border border-slate-900 p-3 text-right">شرح تراکنش</th>
                <th className="border border-slate-900 p-3 text-center w-20">ورودی</th>
                <th className="border border-slate-900 p-3 text-center w-20">خروجی</th>
                <th className="border border-slate-900 p-3 text-left w-24">مانده</th>
              </tr>
            </thead>
            <tbody className="text-[11px] text-slate-900">
              <tr className="bg-slate-50 italic">
                <td className="border border-slate-300 p-3 text-center text-slate-400">-</td>
                <td className="border border-slate-300 p-3 text-center font-mono">{formatDate(startDate)}</td>
                <td className="border border-slate-300 p-3 text-right font-black">مانده از قبل</td>
                <td className="border border-slate-300 p-3 text-center">-</td>
                <td className="border border-slate-300 p-3 text-center">-</td>
                <td className="border border-slate-300 p-3 text-left font-mono font-bold">{openingBalance.toLocaleString()}</td>
              </tr>

              {filteredHistory.map((t, idx) => (
                <tr key={t.id}>
                  <td className="border border-slate-300 p-3 text-center font-mono text-slate-500">{idx + 1}</td>
                  <td className="border border-slate-300 p-3 text-center font-mono whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="border border-slate-300 p-3 text-right">
                    <div className="font-black text-slate-900">
                      {t.type === 'transfer'
                        ? (t.accountId === account.id ? `انتقال به ${getAccountName(t.toAccountId!)}` : `دریافت از ${getAccountName(t.accountId)}`)
                        : t.category}
                    </div>
                    {t.note && <div className="text-[9px] text-slate-500 italic mt-1">{t.note}</div>}
                  </td>
                  <td className="border border-slate-300 p-3 text-center font-mono text-green-700 font-bold">{t.change > 0 ? t.change.toLocaleString() : '-'}</td>
                  <td className="border border-slate-300 p-3 text-center font-mono text-red-700 font-bold">{t.change < 0 ? Math.abs(t.change).toLocaleString() : '-'}</td>
                  <td className="border border-slate-300 p-3 text-left font-mono font-black">{t.currentBalance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-10 flex justify-between items-center border-t-2 border-slate-900 pt-6">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-black mb-1">FINAL BALANCE</p>
              <p className="text-2xl font-black text-slate-900">
                {account.balance.toLocaleString()} <span className="text-xs font-normal">{CURRENCY_SYMBOLS[account.currency]}</span>
              </p>
            </div>
            <div className="text-left">
              <p className="text-[9px] text-slate-300 font-black tracking-[0.2em] uppercase">Hadaf Financial Report v2.1</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountReport;
