
import React, { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary to catch uncaught errors in the component tree.
 */
// Fix: Correctly extend the Component class with generic types to ensure setState and props are inherited properly in this environment
class GlobalErrorBoundary extends Component<Props, State> {
  // Fix: Initialize state property with proper typing as a class member
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
    this.handleReset = this.handleReset.bind(this);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by GlobalErrorBoundary:", error, errorInfo);
  }

  // Fix: setState is now correctly recognized as inherited from the React Component class
  public handleReset() {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  public render(): ReactNode {
    // Fix: state and props are now correctly recognized as inherited members of the component
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 text-center" dir="rtl">
          <div className="w-24 h-24 bg-red-100 rounded-[2.5rem] flex items-center justify-center text-5xl mb-8 animate-bounce">
            ⚠️
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-4 tracking-tighter">
            یک خطای غیرمنتظره رخ داد
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-xs font-bold">
            متأسفانه مشکلی در اجرای برنامه پیش آمد. لطفاً فعالیت خود را مجدداً از ابتدا آغاز کنید.
          </p>
          
          <div className="w-full max-w-xs space-y-3">
            <button 
              onClick={this.handleReset}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 active:scale-95 transition-all"
            >
              تلاش مجدد و بارگذاری
            </button>
            <button 
              onClick={() => window.history.back()}
              className="w-full py-4 bg-white text-gray-400 border border-gray-100 rounded-2xl font-black active:scale-95 transition-all text-xs"
            >
              بازگشت به صفحه قبلی
            </button>
          </div>
          
          <div className="mt-12 opacity-20 text-[10px] font-mono text-left w-full overflow-hidden truncate">
            {error?.message}
          </div>
        </div>
      );
    }

    return children;
  }
}

export default GlobalErrorBoundary;
