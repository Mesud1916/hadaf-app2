
import React, { useMemo, useState, useRef } from 'react';
import { Transaction, Account, AppSettings, Currency } from '../types';
import { CURRENCY_SYMBOLS } from '../constants';
import { Capacitor } from '@capacitor/core';
import html2pdf from 'html2pdf.js';

interface Props {
  category: string;
  currency: Currency;
  transactions: Transaction[];
  accounts: Account[];
  settings: AppSettings;
  onClose: () => void;
}

const CategoryReport: React.FC<Props> = ({ category, currency, transactions, accounts, settings, onClose }) => {
  const reportContentRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [showFilters, setShowFilters] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const getAccount = (id: string) => accounts.find(a => a.id === id);

  const filteredHistory = useMemo(() => {
    return transactions
      .filter(t => {
        const acc = getAccount(t.accountId);
        return t.category === category && 
               acc?.currency === currency && 
               t.date >= startDate && 
               t.date <= endDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, category, currency, startDate, endDate, accounts]);

  const stats = useMemo(() => {
    return filteredHistory.reduce((acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else if (t.type === 'expense') acc.expense += t.amount;
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
      const headers = ["ردیف", "تاریخ", "حساب", "نوع", "مبلغ", "توضیحات"];
      const rows = filteredHistory.map((t, idx) => [
        filteredHistory.length - idx,
        formatDate(t.date),
        getAccount(t.accountId)?.name || '-',
        t.type === 'income' ? 'درآمد' : 'هزینه',
        t.amount,
        t.note || ''
      ]);
      const csvString = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\r\n");
      const fileName = `Cat_${category.replace(/\s+/g, '_')}_${Date.now()}.csv`;

      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        // Fix: Removed Encoding from imports and omitted encoding property from writeFile.
        // Capacitor Filesystem's Encoding does not contain 'Base64'. 
        // Omitting encoding when writing a base64 string is the correct approach.
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        
        const base64Data = btoa(unescape(encodeURIComponent(csvString)));

        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        const fileUri = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fileName,
        });

        await Share.share({ 
          title: `گزارش اکسل ${category}`,
          files: [fileUri.uri] 
        });
      } else {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = fileName; link.click();
        URL.revokeObjectURL(url);
      }
    } catch { alert("خطا در تولید اکسل"); }
  };

  const handleExportPDF = async () => {
    if (!reportContentRef.current) return;
    setIsGenerating(true);
    try {
      const html2pdfFunc = (html2pdf as any).default || html2pdf;
      if (typeof html2pdfFunc !== 'function') {
        throw new Error("کتابخانه PDF بارگذاری نشد.");
      }

      const fileName = `Cat_${category.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const opt = {
        margin: 0.5, 
        filename: fileName,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 1.5, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
      };

      if (Capacitor.isNativePlatform()) {
        let base64data = await html2pdfFunc().from(reportContentRef.current).set(opt).outputPdf('base64');

        // Clean Base64 for Android storage
        const cleanBase64 = base64data.includes('base64,') 
          ? base64data.split('base64,')[1] 
          : base64data;

        const { Share } = await import('@capacitor/share');
        // Fix: Removed Encoding from imports and omitted encoding property from writeFile.
        // Capacitor Filesystem's Encoding does not contain 'Base64'. 
        // Omitting encoding when writing a base64 string is the correct approach.
        const { Filesystem, Directory } = await import('@capacitor/filesystem');

        await Filesystem.writeFile({ 
          path: fileName, 
          data: cleanBase64, 
          directory: Directory.Cache
        });

        const fileUri = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fileName,
        });

        await Share.share({ 
          title: `گزارش PDF ${category}`,
          files: [fileUri.uri] 
        });
      } else {
        await html2pdfFunc().from(reportContentRef.current).set(opt).save();
      }
    } catch (e) {
      console.error("PDF Error:", e);
      alert("خطا در تولید PDF");
    } finally { setIsGenerating(false); }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-white flex flex-col overflow-hidden animate-fade-in" dir="rtl">
      <header className="p-4 flex justify-between items-center border-b border-gray-100 bg-white shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-xl active:scale-90 transition-all">✕</button>
          <div>
            <h2 className="text-sm font-black text-gray-800">گزارش دسته: {category}</h2>
            <p className="text-[10px] text-gray-400 font-bold">واحد پول: {currency}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${showFilters ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-100 text-gray-400'}`}>📅</button>
          <button onClick={handleExportCSV} className="bg-green-600 text-white px-3 rounded-xl text-[10px] font-black shadow-lg shadow-green-100">EXCEL</button>
          <button onClick={handleExportPDF} disabled={isGenerating} className="bg-blue-600 text-white px-3 rounded-xl text-[10px] font-black shadow-lg shadow-blue-100">
            {isGenerating ? '...' : 'PDF'}
          </button>
        </div>
      </header>

      {showFilters && (
        <div className="bg-gray-50 p-4 border-b border-gray-100 grid grid-cols-2 gap-3 animate-slide-up">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 mr-1 font-bold">از تاریخ</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 mr-1 font-bold">تا تاریخ</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
        <div ref={reportContentRef} className="bg-white p-6 shadow-sm min-h-full rounded-3xl" dir="rtl">
          <div className="text-center mb-8 border-b-2 border-gray-900 pb-6">
            <h1 className="text-2xl font-black text-gray-900 mb-1">{settings.appName}</h1>
            <p className="text-xs font-bold text-gray-400">گزارش اختصاصی دسته‌بندی: {category} ({currency})</p>
            <p className="text-[9px] text-gray-400 font-mono mt-2">بازه: {formatDate(startDate)} تا {formatDate(endDate)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
              <p className="text-[10px] text-green-600 font-black mb-1">مجموع درآمد</p>
              <p className="text-lg font-black text-green-700">{stats.income.toLocaleString()} <span className="text-[10px]">{CURRENCY_SYMBOLS[currency]}</span></p>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
              <p className="text-[10px] text-red-600 font-black mb-1">مجموع هزینه</p>
              <p className="text-lg font-black text-red-700">{stats.expense.toLocaleString()} <span className="text-[10px]">{CURRENCY_SYMBOLS[currency]}</span></p>
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-[10px] font-black">
                <th className="border border-gray-800 p-2 text-center w-12">ردیف</th>
                <th className="border border-gray-800 p-2 text-center w-24">تاریخ</th>
                <th className="border border-gray-800 p-2 text-right">شرح / حساب</th>
                <th className="border border-gray-800 p-2 text-left w-32">مبلغ</th>
              </tr>
            </thead>
            <tbody className="text-[11px]">
              {filteredHistory.map((t, idx) => (
                <tr key={t.id}>
                  <td className="border border-gray-300 p-2 text-center font-mono text-gray-400">{filteredHistory.length - idx}</td>
                  <td className="border border-gray-300 p-2 text-center font-mono whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="border border-gray-300 p-2 text-right">
                    <div className="font-bold text-gray-800">{getAccount(t.accountId)?.name}</div>
                    {t.note && <div className="text-[9px] text-gray-400 italic">{t.note}</div>}
                  </td>
                  <td className={`border border-gray-300 p-2 text-left font-mono font-black ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={4} className="border border-gray-300 p-8 text-center text-gray-400 font-bold">تراکنشی در این واحد پولی و بازه یافت نشد</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-12 text-center pt-10 border-t border-gray-100">
            <p className="text-[9px] text-gray-300 font-black tracking-widest uppercase">Generated by Hadaf Finance App</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryReport;
