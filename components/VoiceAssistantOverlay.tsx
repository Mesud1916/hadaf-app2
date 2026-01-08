
import React from 'react';
import { Transaction } from '../types';

interface Props {
  status: string;
  pendingData: Transaction | null;
  onConfirm: () => void;
  onClose: () => void;
  errorMessage?: string;
}

const VoiceAssistantOverlay: React.FC<Props> = ({ status, pendingData, onConfirm, onClose, errorMessage }) => {
  const handleOpenKeyPicker = async () => {
    if (typeof (window as any).aistudio !== 'undefined') {
      await (window as any).aistudio.openSelectKey();
      // After selecting, we assume success as per instructions and reload the assistant
      window.location.reload();
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'listening': return 'در حال شنیدن... بگویید مثلا: "۵۰ لیر بابت ناهار"';
      case 'permission_denied': return 'دسترسی به میکروفون مسدود است. لطفاً تنظیمات اندروید را چک کنید.';
      case 'needs_key_selection': return 'برای فعال‌سازی بخش صوتی در اندروید، تاییدیه گوگل الزامی است.';
      case 'error': return errorMessage || 'اختلال در شبکه. لطفاً VPN خود را بررسی کنید.';
      case 'closed': return 'ارتباط قطع شد. لطفاً دوباره تلاش کنید.';
      case 'preparing': return 'در حال ایجاد تونل امن صوتی...';
      default: return 'در حال آماده‌سازی...';
    }
  };

  const isError = status === 'error' || status === 'closed' || status === 'permission_denied';
  const needsKey = status === 'needs_key_selection';

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-white animate-fade-in text-center" dir="rtl">
      {!pendingData ? (
        <div className="w-full max-w-sm">
          <div className="relative mb-12 flex justify-center">
            <div className={`w-32 h-32 bg-blue-500 rounded-full animate-ping absolute opacity-20 ${status !== 'listening' ? 'hidden' : ''}`}></div>
            <div className={`w-32 h-32 rounded-[3rem] flex items-center justify-center relative shadow-2xl transition-all duration-700 ${isError ? 'bg-red-500' : needsKey ? 'bg-indigo-600' : 'bg-gradient-to-tr from-blue-600 to-indigo-500'}`}>
              <span className="text-6xl">{isError ? '🛑' : needsKey ? '🔑' : '🎙️'}</span>
            </div>
          </div>

          <h2 className="text-3xl font-black mb-6 tracking-tighter">
            {needsKey ? 'تاییدیه امنیتی گوگل' : status === 'listening' ? 'می‌شنوم...' : 'دستیار هوشمند'}
          </h2>
          
          <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 shadow-inner mb-12">
            <p className="text-blue-100 text-sm leading-relaxed font-bold">
              {getStatusMessage()}
            </p>
            {needsKey && (
              <p className="text-[10px] text-indigo-300 mt-4 font-black">
                نکته: شما باید یک پروژه با قابلیت Billing فعال در کنسول گوگل داشته باشید.
                <br/>
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline mt-2 inline-block">مشاهده مستندات Billing</a>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {needsKey && (
              <button 
                onClick={handleOpenKeyPicker}
                className="w-full py-5 bg-white text-indigo-900 rounded-2xl font-black shadow-2xl active:scale-95 transition-all text-sm"
              >
                🗝️ انتخاب کلید و فعال‌سازی
              </button>
            )}
            
            {isError && (
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black shadow-2xl active:scale-95 transition-all text-sm"
              >
                🔄 تلاش مجدد
              </button>
            )}

            <button 
              onClick={onClose}
              className="w-full py-4 bg-white/10 border border-white/20 rounded-2xl font-black text-xs active:scale-95 transition-all"
            >
              انصراف و بازگشت
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xs animate-slide-up">
          <div className="bg-white rounded-[3.5rem] p-10 text-gray-800 shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
            <div className="text-6xl mb-8">🎯</div>
            <h3 className="font-black text-2xl mb-8 text-blue-900 tracking-tighter">تأیید نهایی</h3>
            
            <div className="space-y-4 mb-10">
              <div className="bg-blue-50 p-8 rounded-[2.5rem] border border-blue-100 shadow-inner">
                <div className="text-[10px] text-blue-400 font-black mb-2 uppercase tracking-widest">مبلغ تراکنش</div>
                <div className="text-4xl font-black font-mono text-blue-700 tracking-tighter">
                  {pendingData.amount.toLocaleString()}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <div className="text-[9px] text-gray-400 font-bold mb-1">دسته</div>
                  <div className="text-xs font-black truncate text-gray-700">{pendingData.category}</div>
                </div>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <div className="text-[9px] text-gray-400 font-bold mb-1">نوع</div>
                  <div className={`text-xs font-black truncate ${pendingData.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                    {pendingData.type === 'expense' ? 'هزینه' : 'درآمد'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={onConfirm}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 active:scale-95 transition-all text-sm"
              >
                ✅ بله، ثبت کن
              </button>
              <button 
                onClick={() => onClose()}
                className="w-full py-4 bg-gray-100 text-gray-400 rounded-2xl font-black active:scale-95 transition-all text-xs"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceAssistantOverlay;
