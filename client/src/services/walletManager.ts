import { Address } from '@/types/blockchain';
import { addressAPI } from './api';

/**
 * 钱包管理服务
 */
export class WalletManagerService {
  private wallets: Map<string, Address> = new Map();
  private selectedWallet: string | null = null;
  private storageKey = 'my-blockchain-wallets';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 从本地存储加载钱包
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.wallets = new Map(data.wallets || []);
        this.selectedWallet = data.selectedWallet || null;
        console.log(`从本地存储加载了 ${this.wallets.size} 个钱包`);
      }
    } catch (error) {
      console.error('加载钱包数据失败:', error);
      this.wallets.clear();
      this.selectedWallet = null;
    }
  }

  /**
   * 保存到本地存储
   */
  private saveToStorage(): void {
    try {
      const data = {
        wallets: Array.from(this.wallets.entries()),
        selectedWallet: this.selectedWallet,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('保存钱包数据失败:', error);
    }
  }

  /**
   * 生成新钱包
   */
  async generateWallet(name?: string): Promise<Address> {
    try {
      const response = await addressAPI.generateAddress();
      if (!response.success) {
        throw new Error(response.error || '生成钱包失败');
      }

      const wallet: Address = {
        address: response.data.address,
        publicKey: response.data.publicKey,
        privateKey: response.data.privateKey,
        balance: 0,
        mnemonic: response.data.mnemonic,
      };

      const walletName = name || `钱包-${this.wallets.size + 1}`;
      this.wallets.set(walletName, wallet);
      
      // 如果是第一个钱包，设为默认选中
      if (this.wallets.size === 1) {
        this.selectedWallet = walletName;
      }

      this.saveToStorage();
      console.log(`新钱包创建成功: ${walletName}`);
      
      return wallet;
    } catch (error) {
      console.error('生成钱包失败:', error);
      throw error;
    }
  }

  /**
   * 从私钥导入钱包
   */
  async importWallet(privateKey: string, name?: string): Promise<Address> {
    try {
      const response = await addressAPI.importAddress(privateKey);
      if (!response.success) {
        throw new Error(response.error || '导入钱包失败');
      }

      const wallet: Address = {
        address: response.data.address,
        publicKey: response.data.publicKey,
        privateKey: privateKey,
        balance: response.data.balance,
        mnemonic: response.data.mnemonic,
      };

      const walletName = name || `导入-${wallet.address.slice(-6)}`;
      
      // 检查是否已存在
      const existingWallet = Array.from(this.wallets.entries()).find(
        ([, w]) => w.address === wallet.address
      );
      
      if (existingWallet) {
        throw new Error('该钱包已存在');
      }

      this.wallets.set(walletName, wallet);
      
      if (this.wallets.size === 1) {
        this.selectedWallet = walletName;
      }

      this.saveToStorage();
      console.log(`钱包导入成功: ${walletName}`);
      
      return wallet;
    } catch (error) {
      console.error('导入钱包失败:', error);
      throw error;
    }
  }

  /**
   * 选择钱包
   */
  selectWallet(name: string): boolean {
    if (this.wallets.has(name)) {
      this.selectedWallet = name;
      this.saveToStorage();
      console.log(`已选择钱包: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * 删除钱包
   */
  removeWallet(name: string): boolean {
    if (this.wallets.has(name)) {
      this.wallets.delete(name);
      
      // 如果删除的是当前选中的钱包
      if (this.selectedWallet === name) {
        const remainingWallets = Array.from(this.wallets.keys());
        this.selectedWallet = remainingWallets.length > 0 ? remainingWallets[0] : null;
      }
      
      this.saveToStorage();
      console.log(`钱包已删除: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * 获取所有钱包
   */
  getAllWallets(): Map<string, Address> {
    return new Map(this.wallets);
  }

  /**
   * 获取钱包列表
   */
  getWalletList(): Array<{ name: string; wallet: Address }> {
    return Array.from(this.wallets.entries()).map(([name, wallet]) => ({
      name,
      wallet,
    }));
  }

  /**
   * 获取指定钱包
   */
  getWallet(name: string): Address | null {
    return this.wallets.get(name) || null;
  }

  /**
   * 获取当前选中的钱包
   */
  getSelectedWallet(): { name: string; wallet: Address } | null {
    if (!this.selectedWallet) {
      return null;
    }
    
    const wallet = this.wallets.get(this.selectedWallet);
    if (!wallet) {
      return null;
    }
    
    return {
      name: this.selectedWallet,
      wallet,
    };
  }

  /**
   * 获取当前选中钱包的地址
   */
  getSelectedAddress(): string | null {
    const selected = this.getSelectedWallet();
    return selected ? selected.wallet.address : null;
  }

  /**
   * 更新钱包余额
   */
  async updateWalletBalance(name: string): Promise<void> {
    const wallet = this.wallets.get(name);
    if (!wallet) {
      throw new Error('钱包不存在');
    }

    try {
      const response = await addressAPI.getBalance(wallet.address);
      if (response.success) {
        wallet.balance = response.data.balance;
        wallet.utxos = response.data.utxos;
        this.saveToStorage();
      }
    } catch (error) {
      console.error(`更新钱包余额失败 (${name}):`, error);
      throw error;
    }
  }

  /**
   * 更新所有钱包余额
   */
  async updateAllBalances(): Promise<void> {
    const promises = Array.from(this.wallets.keys()).map(name => 
      this.updateWalletBalance(name).catch(error => {
        console.error(`更新钱包 ${name} 余额失败:`, error);
      })
    );
    
    await Promise.all(promises);
    console.log('所有钱包余额更新完成');
  }

  /**
   * 检查地址是否属于当前管理的钱包
   */
  isOwnAddress(address: string): boolean {
    return Array.from(this.wallets.values()).some(wallet => wallet.address === address);
  }

  /**
   * 根据地址查找钱包名称
   */
  getWalletNameByAddress(address: string): string | null {
    for (const [name, wallet] of this.wallets.entries()) {
      if (wallet.address === address) {
        return name;
      }
    }
    return null;
  }

  /**
   * 获取钱包统计信息
   */
  getWalletStatistics(): {
    totalWallets: number;
    totalBalance: number;
    selectedWallet: string | null;
    hasWallets: boolean;
  } {
    const totalBalance = Array.from(this.wallets.values())
      .reduce((sum, wallet) => sum + wallet.balance, 0);

    return {
      totalWallets: this.wallets.size,
      totalBalance,
      selectedWallet: this.selectedWallet,
      hasWallets: this.wallets.size > 0,
    };
  }

  /**
   * 清空所有钱包
   */
  clearAllWallets(): void {
    this.wallets.clear();
    this.selectedWallet = null;
    this.saveToStorage();
    console.log('所有钱包已清空');
  }

  /**
   * 导出钱包数据
   */
  exportWallets(): string {
    const data = {
      wallets: Array.from(this.wallets.entries()),
      selectedWallet: this.selectedWallet,
      exportTime: new Date().toISOString(),
      version: '1.0.0',
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入钱包数据
   */
  importWallets(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      
      if (!parsed.wallets || !Array.isArray(parsed.wallets)) {
        throw new Error('无效的钱包数据格式');
      }

      this.wallets = new Map(parsed.wallets);
      this.selectedWallet = parsed.selectedWallet || null;
      this.saveToStorage();
      
      console.log(`成功导入 ${this.wallets.size} 个钱包`);
      return true;
    } catch (error) {
      console.error('导入钱包数据失败:', error);
      return false;
    }
  }
}

// 单例实例
export const walletManager = new WalletManagerService();