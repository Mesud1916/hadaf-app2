
import { GoogleGenAI, Modality, Type, FunctionDeclaration, LiveServerMessage } from "@google/genai";
import { Account, AppSettings } from "../types";

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const createTransactionTool: FunctionDeclaration = {
  name: 'create_transaction',
  parameters: {
    type: Type.OBJECT,
    description: 'ثبت یک تراکنش مالی جدید پس از تأیید نهایی کاربر',
    properties: {
      amount: { type: Type.NUMBER, description: 'مبلغ تراکنش' },
      type: { type: Type.STRING, description: 'نوع: expense, income, transfer' },
      category: { type: Type.STRING, description: 'نام دقیق دسته‌بندی' },
      accountName: { type: Type.STRING, description: 'نام حساب' },
      note: { type: Type.STRING, description: 'یادداشت یا توضیحات تراکنش' },
      date: { type: Type.STRING, description: 'تاریخ YYYY-MM-DD' }
    },
    required: ['amount', 'type', 'category', 'accountName', 'date', 'note']
  }
};

export class VoiceFinancialAssistant {
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isConnected: boolean = false;

  constructor(
    private accounts: Account[],
    private settings: AppSettings,
    private onTransactionDetected: (data: any) => void,
    private onStatusChange: (status: string, extra?: string) => void
  ) {}

  async start() {
    this.stop();
    this.isConnected = false;

    // Check if key selection is required (standard for high-security environments)
    if (typeof (window as any).aistudio !== 'undefined') {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        this.onStatusChange('needs_key_selection');
        return;
      }
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      this.onStatusChange('permission_denied');
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioContext = new AudioCtx({ sampleRate: 16000 });
      this.outputAudioContext = new AudioCtx({ sampleRate: 24000 });

      // CRITICAL: Always create a fresh instance right before connection
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const accountList = this.accounts.map(a => `${a.name} (${a.currency})`).join('، ');
      const today = new Date().toISOString().split('T')[0];

      // Fix: Updated model name to 'gemini-2.5-flash-native-audio-preview-12-2025' per guidelines for audio conversation tasks
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `شما "هدف" هستید. دستیار مالی. امروز: ${today}. حساب‌ها: ${accountList}. فقط تراکنش ثبت کنید. فارسی و بسیار کوتاه پاسخ دهید.`,
          tools: [{ functionDeclarations: [createTransactionTool] }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
        },
        callbacks: {
          onopen: () => {
            this.isConnected = true;
            this.onStatusChange('listening');
            this.streamMicrophone(stream, sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'create_transaction') {
                  this.onTransactionDetected(fc.args);
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: 'ok' } }
                  }));
                }
              }
            }
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) this.playResponse(audioData);
          },
          onclose: (e: any) => {
            this.isConnected = false;
            this.onStatusChange('closed');
          },
          onerror: (e: any) => {
            console.error("Live AI Error:", e);
            if (e.message?.includes("entity was not found")) {
              this.onStatusChange('needs_key_selection', 'اعتبار سنجی ناموفق بود. لطفاً دوباره کلید را انتخاب کنید.');
            } else {
              this.onStatusChange('error', 'خطا در شبکه صوتی. لطفاً VPN خود را بررسی کنید.');
            }
          }
        }
      });

      this.session = await sessionPromise;
    } catch (err: any) {
      this.onStatusChange('error', "عدم پاسخگویی سرور. اینترنت را بررسی کنید.");
    }
  }

  private streamMicrophone(stream: MediaStream, sessionPromise: Promise<any>) {
    if (!this.inputAudioContext) return;
    this.source = this.inputAudioContext.createMediaStreamSource(stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      const base64Data = encode(new Uint8Array(int16.buffer));
      sessionPromise.then(s => {
        if (this.isConnected) {
          s.sendRealtimeInput({ media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
        }
      });
    };
    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async playResponse(base64: string) {
    if (!this.outputAudioContext) return;
    try {
      const audioBuffer = await decodeAudioData(decode(base64), this.outputAudioContext, 24000, 1);
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioContext.destination);
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
    } catch (e) {}
  }

  stop() {
    this.isConnected = false;
    if (this.processor) { try { this.processor.disconnect(); } catch(e) {} this.processor = null; }
    if (this.source) { try { this.source.mediaStream.getTracks().forEach(track => track.stop()); this.source.disconnect(); } catch(e) {} this.source = null; }
    if (this.session) { try { this.session.close(); } catch(e) {} this.session = null; }
    if (this.inputAudioContext) { try { this.inputAudioContext.close(); } catch(e) {} this.inputAudioContext = null; }
    if (this.outputAudioContext) { try { this.outputAudioContext.close(); } catch(e) {} this.outputAudioContext = null; }
  }
}
