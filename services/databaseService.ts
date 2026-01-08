
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Transaction, Account, RecurringTransaction, RecurrenceFrequency } from '../types';

const DB_NAME = 'hadaf_finance_v5_db';

class DatabaseService {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;

  async init() {
    if (this.db) return;
    try {
      if (Capacitor.getPlatform() === 'web') return;
      this.db = await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
      await this.db.open();
      await this.createTables();
      await this.ensureDefaultAccount();
    } catch (err) {
      console.error('DB Init Error:', err);
    }
  }

  private async createTables() {
    if (!this.db) return;
    const schema = `
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        initialBalance REAL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'TL'
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        amount REAL NOT NULL,
        targetAmount REAL,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        accountId TEXT NOT NULL,
        toAccountId TEXT,
        date TEXT NOT NULL,
        note TEXT,
        isRecurring INTEGER DEFAULT 0,
        FOREIGN KEY (accountId) REFERENCES accounts (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        accountId TEXT NOT NULL,
        frequency TEXT NOT NULL,
        startDate TEXT NOT NULL,
        nextDueDate TEXT NOT NULL,
        note TEXT,
        isActive INTEGER DEFAULT 1,
        FOREIGN KEY (accountId) REFERENCES accounts (id) ON DELETE CASCADE
      );
    `;
    await this.db.execute(schema);
  }

  private async ensureDefaultAccount() {
    if (!this.db) return;
    const res = await this.db.query('SELECT id FROM accounts LIMIT 1');
    if (!res.values || res.values.length === 0) {
      const defaultAcc: Account = { 
        id: 'default_cash', 
        name: 'صندوق نقدی', 
        type: 'cash', 
        initialBalance: 0, 
        currency: 'TL' 
      };
      await this.addAccount(defaultAcc);
    }
  }

  // Transaction Methods
  async getTransactions(): Promise<Transaction[]> {
    await this.init();
    if (!this.db) {
      const saved = localStorage.getItem('hadaf_transactions');
      return saved ? JSON.parse(saved) : [];
    }
    const res = await this.db.query('SELECT * FROM transactions ORDER BY date DESC, id DESC');
    return res.values || [];
  }

  async addTransaction(t: Transaction) {
    await this.init();
    if (!this.db) {
      const current = await this.getTransactions();
      localStorage.setItem('hadaf_transactions', JSON.stringify([t, ...current]));
      return;
    }
    const sql = 'INSERT INTO transactions (id, amount, targetAmount, category, type, accountId, toAccountId, date, note, isRecurring) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    await this.db.run(sql, [t.id, t.amount, t.targetAmount || null, t.category, t.type, t.accountId, t.toAccountId || null, t.date, t.note || '', t.isRecurring ? 1 : 0]);
  }

  // Recurring Transaction Methods
  async getRecurringTransactions(): Promise<RecurringTransaction[]> {
    await this.init();
    if (!this.db) {
      const saved = localStorage.getItem('hadaf_recurring');
      return saved ? JSON.parse(saved) : [];
    }
    const res = await this.db.query('SELECT * FROM recurring_transactions');
    return res.values || [];
  }

  async addRecurringTransaction(r: RecurringTransaction) {
    await this.init();
    if (!this.db) {
      const current = await this.getRecurringTransactions();
      localStorage.setItem('hadaf_recurring', JSON.stringify([...current, r]));
      return;
    }
    const sql = 'INSERT INTO recurring_transactions (id, amount, category, type, accountId, frequency, startDate, nextDueDate, note, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    await this.db.run(sql, [r.id, r.amount, r.category, r.type, r.accountId, r.frequency, r.startDate, r.nextDueDate, r.note || '', r.isActive ? 1 : 0]);
  }

  async deleteRecurringTransaction(id: string) {
    await this.init();
    if (!this.db) {
      const current = await this.getRecurringTransactions();
      localStorage.setItem('hadaf_recurring', JSON.stringify(current.filter(r => r.id !== id)));
      return;
    }
    await this.db.run('DELETE FROM recurring_transactions WHERE id = ?', [id]);
  }

  // Automation Engine: Process due recurring transactions
  async processRecurringTasks() {
    await this.init();
    const recurring = await this.getRecurringTransactions();
    const today = new Date().toISOString().split('T')[0];
    
    for (const rule of recurring) {
      if (!rule.isActive) continue;
      
      let nextDue = new Date(rule.nextDueDate);
      let todayDate = new Date(today);
      
      while (nextDue <= todayDate) {
        // Create actual transaction
        const newTx: Transaction = {
          id: `rec_${rule.id}_${nextDue.getTime()}`,
          amount: rule.amount,
          category: rule.category,
          type: rule.type,
          accountId: rule.accountId,
          date: nextDue.toISOString().split('T')[0],
          note: rule.note ? `${rule.note} (تکرار خودکار)` : 'تراکنش دوره‌ای خودکار',
          isRecurring: true
        };
        
        await this.addTransaction(newTx);
        
        // Calculate next period
        if (rule.frequency === 'daily') nextDue.setDate(nextDue.getDate() + 1);
        else if (rule.frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
        else if (rule.frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
        else if (rule.frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);
        
        // Update the rule in DB
        const updatedNextDueDate = nextDue.toISOString().split('T')[0];
        if (this.db) {
          await this.db.run('UPDATE recurring_transactions SET nextDueDate = ? WHERE id = ?', [updatedNextDueDate, rule.id]);
        } else {
          const allRules = await this.getRecurringTransactions();
          const updatedRules = allRules.map(r => r.id === rule.id ? { ...r, nextDueDate: updatedNextDueDate } : r);
          localStorage.setItem('hadaf_recurring', JSON.stringify(updatedRules));
        }
      }
    }
  }

  // Account Methods
  async getAccounts(): Promise<Account[]> {
    await this.init();
    if (!this.db) {
      const saved = localStorage.getItem('hadaf_accounts');
      return saved ? JSON.parse(saved) : [{ id: 'default_cash', name: 'صندوق نقدی', type: 'cash', initialBalance: 0, currency: 'TL' }];
    }
    const res = await this.db.query('SELECT * FROM accounts');
    return res.values || [];
  }

  async addAccount(a: Account) {
    await this.init();
    if (!this.db) {
      const current = await this.getAccounts();
      localStorage.setItem('hadaf_accounts', JSON.stringify([...current, a]));
      return;
    }
    await this.db.run('INSERT INTO accounts (id, name, type, initialBalance, currency) VALUES (?, ?, ?, ?, ?)', [a.id, a.name, a.type, a.initialBalance, a.currency]);
  }

  async updateTransaction(t: Transaction) {
    await this.init();
    if (!this.db) {
      const current = await this.getTransactions();
      localStorage.setItem('hadaf_transactions', JSON.stringify(current.map(item => item.id === t.id ? t : item)));
      return;
    }
    const sql = 'UPDATE transactions SET amount=?, targetAmount=?, category=?, type=?, accountId=?, toAccountId=?, note=?, date=? WHERE id=?';
    await this.db.run(sql, [t.amount, t.targetAmount || null, t.category, t.type, t.accountId, t.toAccountId || null, t.note || '', t.date, t.id]);
  }

  async deleteTransaction(id: string) {
    await this.init();
    if (!this.db) {
      const current = await this.getTransactions();
      localStorage.setItem('hadaf_transactions', JSON.stringify(current.filter(t => t.id !== id)));
      return;
    }
    await this.db.run('DELETE FROM transactions WHERE id = ?', [id]);
  }

  async updateAccount(a: Account) {
    await this.init();
    if (!this.db) {
      const current = await this.getAccounts();
      localStorage.setItem('hadaf_accounts', JSON.stringify(current.map(item => item.id === a.id ? a : item)));
      return;
    }
    await this.db.run('UPDATE accounts SET name=?, type=?, initialBalance=?, currency=? WHERE id=?', [a.name, a.type, a.initialBalance, a.currency, a.id]);
  }

  async deleteAccount(id: string) {
    await this.init();
    if (!this.db) {
      const current = await this.getAccounts();
      localStorage.setItem('hadaf_accounts', JSON.stringify(current.filter(a => a.id !== id)));
      return;
    }
    await this.db.run('DELETE FROM accounts WHERE id = ?', [id]);
  }

  async exportAllData(): Promise<string> {
    const transactions = await this.getTransactions();
    const accounts = await this.getAccounts();
    const recurring = await this.getRecurringTransactions();
    const settings = localStorage.getItem('hadaf_settings');
    return JSON.stringify({ 
      transactions, 
      accounts, 
      recurring,
      settings: settings ? JSON.parse(settings) : null,
      version: '2.0' 
    });
  }

  async importAllData(jsonStr: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || !Array.isArray(data.accounts)) return false;

      if (Capacitor.isNativePlatform()) await this.init();

      if (data.settings) localStorage.setItem('hadaf_settings', JSON.stringify(data.settings));

      if (!this.db) {
        localStorage.setItem('hadaf_accounts', JSON.stringify(data.accounts));
        localStorage.setItem('hadaf_transactions', JSON.stringify(data.transactions || []));
        localStorage.setItem('hadaf_recurring', JSON.stringify(data.recurring || []));
        return true;
      } else {
        await this.db.execute('DELETE FROM transactions');
        await this.db.execute('DELETE FROM accounts');
        await this.db.execute('DELETE FROM recurring_transactions');
        
        for (const acc of data.accounts) {
          await this.db.run('INSERT INTO accounts (id, name, type, initialBalance, currency) VALUES (?, ?, ?, ?, ?)', [acc.id, acc.name, acc.type, acc.initialBalance, acc.currency]);
        }
        
        if (Array.isArray(data.transactions)) {
          for (const t of data.transactions) {
            await this.db.run('INSERT INTO transactions (id, amount, targetAmount, category, type, accountId, toAccountId, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [t.id, t.amount, t.targetAmount || null, t.category, t.type, t.accountId, t.toAccountId || null, t.date, t.note || '']);
          }
        }

        if (Array.isArray(data.recurring)) {
          for (const r of data.recurring) {
            await this.db.run('INSERT INTO recurring_transactions (id, amount, category, type, accountId, frequency, startDate, nextDueDate, note, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [r.id, r.amount, r.category, r.type, r.accountId, r.frequency, r.startDate, r.nextDueDate, r.note || '', r.isActive ? 1 : 0]);
          }
        }
        return true;
      }
    } catch (e) {
      console.error("Import error:", e);
      return false;
    }
  }
}

export const dbService = new DatabaseService();
