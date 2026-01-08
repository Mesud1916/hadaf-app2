
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

export const getFinancialAdvice = async (transactions: Transaction[]): Promise<string> => {
  // Use the pre-configured system key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  if (!transactions || transactions.length === 0) {
    return "هنوز تراکنشی برای تحلیل ثبت نشده است.";
  }

  const historyString = transactions
    .slice(0, 30)
    .map(tr => `${tr.date}: ${tr.type === 'income' ? '+' : '-'}${tr.amount} (${tr.category})`)
    .join('\n');

  const prompt = `
    Analyze these transactions:
    ${historyString}
    
    Provide 3 very short sentences in Persian:
    1. Overall spending status.
    2. A saving tip.
    3. A motivational note.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "شما یک مشاور مالی هستید. همیشه به زبان فارسی و کوتاه پاسخ دهید.",
        temperature: 0.7,
      },
    });

    return response.text || "پاسخی دریافت نشد.";
  } catch (error: any) {
    console.error("Advisor AI Error:", error);
    // On Android/WebView, network blocks often return 401/403. 
    // We strictly tell the user it's a regional restriction.
    return "سرویس هوشمند در منطقه شما با محدودیت مواجه است. لطفاً اتصال اینترنت خود (VPN) را بررسی کنید.";
  }
};
