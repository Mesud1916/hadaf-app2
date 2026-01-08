
export const CATEGORIES = {
  expense: [
    'خوراک',
    'اجاره و مسکن',
    'حمل و نقل',
    'تفریح و سرگرمی',
    'بهداشت و درمان',
    'آموزش',
    'خرید لباس',
    'سایر'
  ],
  income: [
    'حقوق و دستمزد',
    'پاداش',
    'سود بانکی',
    'فروش دارایی',
    'هدیه',
    'سایر'
  ]
};

export const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  TL: '₺',
  USD: '$',
  EUR: '€',
  TOMAN: 'تومان'
};

export const CURRENCY_NAMES: Record<string, string> = {
  TL: 'لیر ترکیه',
  USD: 'دلار آمریکا',
  EUR: 'یورو',
  TOMAN: 'تومان ایران'
};

export const DEFAULT_SETTINGS = {
  appName: 'هدف',
  currency: 'TL' as const,
  dateFormat: 'jalali' as const,
  theme: 'light' as const,
  categories: CATEGORIES,
  security: {
    enabled: false,
    pin: null,
    useBiometrics: false
  }
};
