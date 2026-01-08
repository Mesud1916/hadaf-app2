
import React, { useState, useEffect } from 'react';
import { SecuritySettings } from '../types';

interface Props {
  security: SecuritySettings;
  onUnlock: () => void;
}

const SecurityLock: React.FC<Props> = ({ security, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [canBiometric, setCanBiometric] = useState(false);

  useEffect(() => {
    // بررسی قابلیت بیومتریک در مرورگر
    if (window.PublicKeyCredential && security.useBiometrics) {
      setCanBiometric(true);
      // نکته: دیگر به صورت خودکار در useEffect تابع handleBiometric را صدا نمی‌زنیم 
      // تا از باز شدن خودکار در رفرش جلوگیری شود.
    }
  }, [security.useBiometrics]);

  const handleBiometric = async () => {
    try {
      if (security.useBiometrics) {
        // در اپلیکیشن‌های خروجی Capacitor این بخش با پلاگین بومی جایگزین می‌شود
        // اینجا چون محیط وب است، بلافاصله باز می‌شود، اما فقط با کلیک کاربر روی آیکون
        onUnlock();
      }
    } catch (e) {
      console.error("Biometric failed", e);
    }
  };

  const handleNumber = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError(false);
      
      if (newPin.length === 4) {
        if (newPin === security.pin) {
          // کمی تاخیر برای نمایش نقطه چهارم
          setTimeout(onUnlock, 150);
        } else {
          setTimeout(() => {
            setError(true);
            setPin('');
          }, 400);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-white flex flex-col items-center justify-center p-8 animate-fade-in" dir="rtl">
      <div className="mb-12 flex flex-col items-center">
        <div className="w-20 h-20 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-3xl mb-6 shadow-sm">
          🔒
        </div>
        <h2 className="text-xl font-black text-gray-800">برنامه قفل است</h2>
        <p className="text-xs text-gray-400 mt-2 font-bold">لطفاً رمز ۴ رقمی خود را وارد کنید</p>
      </div>

      <div className="flex gap-4 mb-16">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i} 
            className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
              error ? 'bg-red-500 border-red-500 scale-110 animate-shake' :
              i < pin.length ? 'bg-blue-600 border-blue-600 scale-110 shadow-lg shadow-blue-100' : 'border-gray-200'
            }`}
          ></div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 w-full max-w-[280px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
          <button 
            key={n} 
            onClick={() => handleNumber(n)}
            className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center text-xl font-black text-gray-700 active:bg-blue-600 active:text-white transition-all transform active:scale-90"
          >
            {n}
          </button>
        ))}
        <button 
          onClick={handleBiometric}
          className={`h-16 w-16 rounded-full flex items-center justify-center text-xl transition-all active:scale-90 ${canBiometric ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'opacity-0 pointer-events-none'}`}
        >
          🧬
        </button>
        <button 
          onClick={() => handleNumber('0')}
          className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center text-xl font-black text-gray-700 active:bg-blue-600 active:text-white transition-all transform active:scale-90"
        >
          0
        </button>
        <button 
          onClick={handleDelete}
          className="h-16 w-16 rounded-full flex items-center justify-center text-xl text-gray-300 active:text-red-500 transition-all active:scale-90"
        >
          ⌫
        </button>
      </div>

      {error && (
        <p className="mt-8 text-red-500 text-xs font-black animate-pulse">رمز اشتباه است، دوباره تلاش کنید</p>
      )}
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default SecurityLock;
