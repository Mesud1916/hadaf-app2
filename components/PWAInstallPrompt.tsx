
import React, { useState, useEffect } from 'react';

const PWAInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // تشخیص اینکه آیا کاربر روی iOS است و اپ هنوز نصب نشده (Standalone نیست)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (isIOS && !isStandalone) {
      // بعد از ۳ ثانیه نمایش بده تا کاربر اول محیط اپ را ببیند
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[300] p-4 animate-slide-up">
      <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] border border-blue-50 relative overflow-hidden">
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-400 text-xs"
        >
          ✕
        </button>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] shadow-xl flex items-center justify-center text-3xl">🎯</div>
          <div className="text-right">
            <h3 className="font-black text-gray-900">نصب اپلیکیشن هدف</h3>
            <p className="text-[10px] text-gray-500 font-bold">نسخه سریع و بدون نیاز به اپ‌استور</p>
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4 space-y-4 text-right">
          <p className="text-xs font-bold text-blue-900 leading-relaxed">
            برای تجربه بهتر و استفاده آفلاین، این اپلیکیشن را به صفحه اصلی خود اضافه کنید:
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[11px] font-black text-gray-700">
              <span className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm">۱</span>
              <span>در نوار پایین مرورگر دکمه <span className="inline-block px-1 bg-white rounded border border-gray-100">⎋</span> (Share) را بزنید.</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-black text-gray-700">
              <span className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm">۲</span>
              <span>گزینه <span className="text-blue-600">Add to Home Screen</span> را انتخاب کنید.</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex justify-center ios-prompt-bounce">
            <span className="text-2xl opacity-20">↓</span>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
