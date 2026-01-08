
import React from 'react';
import { App } from '@capacitor/app';

interface Props {
  onClose: () => void;
}

const ExitConfirmationOverlay: React.FC<Props> = ({ onClose }) => {
  const handleExit = async () => {
    try {
      await App.exitApp();
    } catch (e) {
      window.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in" dir="rtl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl animate-slide-up border border-white/20 dark:border-slate-800">
        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] flex items-center justify-center text-4xl mb-6 mx-auto">
          👋
        </div>
        
        <h3 className="text-xl font-black text-gray-900 dark:text-white text-center mb-3">خروج از برنامه</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 text-center leading-relaxed mb-8 font-bold px-2">
          آیا از خروج کامل از اپلیکیشن هدف مطمئن هستید؟ تراکنش‌های شما محفوظ هستند.
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={handleExit}
            className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-red-100 dark:shadow-none active:scale-95 transition-all"
          >
            بله، خارج می‌شوم
          </button>
          <button 
            onClick={onClose}
            className="w-full py-4 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-2xl font-black text-sm active:scale-95 transition-all"
          >
            خیر، بمانم
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExitConfirmationOverlay;
