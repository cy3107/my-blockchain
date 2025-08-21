import { SigningStargateClient, StargateClient } from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { stringToPath } from '@cosmjs/crypto';
import { Bech32 } from '@cosmjs/encoding';

/**
 * Cosmos客户端服务
 * 用于与Cosmos SDK兼容的区块链进行交互
 */
export class CosmosClientService {
  private client: StargateClient | null = null;
  private signingClient: SigningStargateClient | null = null;
  private wallet: DirectSecp256k1HdWallet | null = null;
  
  // 默认配置
  private readonly defaultConfig = {
    rpcEndpoint: 'http://localhost:1317',
    chainId: 'my-blockchain',
    addressPrefix: 'cosmos',
    coinDenom: 'atom',
    coinMinimalDenom: 'uatom',
    coinDecimals: 6,
    gasPrice: '0.025uatom',
  };

  constructor(config?: Partial<typeof CosmosClientService.prototype.defaultConfig>) {
    if (config) {
      Object.assign(this.defaultConfig, config);
    }
  }

  /**
   * 连接到区块链节点
   */
  async connect(): Promise<void> {
    try {
      this.client = await StargateClient.connect(this.defaultConfig.rpcEndpoint);
      console.log('已连接到Cosmos节点:', this.defaultConfig.rpcEndpoint);
    } catch (error) {
      console.error('连接Cosmos节点失败:', error);
      throw new Error('无法连接到区块链节点');
    }
  }

  /**
   * 从助记词创建钱包
   */
  async createWalletFromMnemonic(mnemonic: string): Promise<{
    address: string;
    publicKey: Uint8Array;
  }> {
    try {
      this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: this.defaultConfig.addressPrefix,
        hdPaths: [stringToPath("m/44'/118'/0'/0/0")],
      });

      const accounts = await this.wallet.getAccounts();
      if (accounts.length === 0) {
        throw new Error('无法从助记词创建账户');
      }

      const account = accounts[0];
      console.log('钱包创建成功:', account.address);

      return {
        address: account.address,
        publicKey: account.pubkey,
      };
    } catch (error) {
      console.error('创建钱包失败:', error);
      throw new Error('从助记词创建钱包失败');
    }
  }

  /**
   * 生成新的钱包
   */
  async generateWallet(): Promise<{
    mnemonic: string;
    address: string;
    publicKey: Uint8Array;
  }> {
    try {
      this.wallet = await DirectSecp256k1HdWallet.generate(12, {
        prefix: this.defaultConfig.addressPrefix,
        hdPaths: [stringToPath("m/44'/118'/0'/0/0")],
      });

      const mnemonic = this.wallet.mnemonic;
      const accounts = await this.wallet.getAccounts();
      const account = accounts[0];

      console.log('新钱包生成成功:', account.address);

      return {
        mnemonic,
        address: account.address,
        publicKey: account.pubkey,
      };
    } catch (error) {
      console.error('生成钱包失败:', error);
      throw new Error('生成新钱包失败');
    }
  }

  /**
   * 创建签名客户端
   */
  async createSigningClient(): Promise<void> {
    if (!this.wallet) {
      throw new Error('请先创建或导入钱包');
    }

    try {
      this.signingClient = await SigningStargateClient.connectWithSigner(
        this.defaultConfig.rpcEndpoint,
        this.wallet,
        {
          gasPrice: this.defaultConfig.gasPrice,
        }
      );
      console.log('签名客户端创建成功');
    } catch (error) {
      console.error('创建签名客户端失败:', error);
      throw new Error('创建签名客户端失败');
    }
  }

  /**
   * 获取账户余额
   */
  async getBalance(address: string): Promise<{
    amount: string;
    denom: string;
  }[]> {
    if (!this.client) {
      await this.connect();
    }

    try {
      const balances = await this.client!.getAllBalances(address);
      return balances.map(balance => ({
        amount: balance.amount,
        denom: balance.denom,
      }));
    } catch (error) {
      console.error('获取余额失败:', error);
      throw new Error('获取账户余额失败');
    }
  }

  /**
   * 发送代币
   */
  async sendTokens(
    fromAddress: string,
    toAddress: string,
    amount: string,
    memo = ''
  ): Promise<{
    transactionHash: string;
    gasUsed: number;
    gasWanted: number;
  }> {
    if (!this.signingClient) {
      throw new Error('请先创建签名客户端');
    }

    try {
      const fee = {
        amount: [{
          denom: this.defaultConfig.coinMinimalDenom,
          amount: '5000',
        }],
        gas: '200000',
      };

      const result = await this.signingClient.sendTokens(
        fromAddress,
        toAddress,
        [{
          denom: this.defaultConfig.coinMinimalDenom,
          amount,
        }],
        fee,
        memo
      );

      console.log('转账成功:', result.transactionHash);

      return {
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed,
        gasWanted: result.gasWanted,
      };
    } catch (error) {
      console.error('转账失败:', error);
      throw new Error('发送代币失败');
    }
  }

  /**
   * 获取交易详情
   */
  async getTransaction(txHash: string): Promise<any> {
    if (!this.client) {
      await this.connect();
    }

    try {
      const tx = await this.client!.getTx(txHash);
      return tx;
    } catch (error) {
      console.error('获取交易详情失败:', error);
      throw new Error('获取交易详情失败');
    }
  }

  /**
   * 验证地址格式
   */
  validateAddress(address: string): boolean {
    try {
      const decoded = Bech32.decode(address);
      return decoded.prefix === this.defaultConfig.addressPrefix;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前连接状态
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * 获取当前钱包地址
   */
  async getCurrentAddress(): Promise<string | null> {
    if (!this.wallet) {
      return null;
    }

    const accounts = await this.wallet.getAccounts();
    return accounts.length > 0 ? accounts[0].address : null;
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.client = null;
    this.signingClient = null;
    this.wallet = null;
    console.log('已断开与Cosmos节点的连接');
  }

  /**
   * 获取配置信息
   */
  getConfig() {
    return { ...this.defaultConfig };
  }
}

// 单例实例
export const cosmosClient = new CosmosClientService();