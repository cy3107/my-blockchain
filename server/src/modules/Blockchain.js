const { Block } = require('./Block');
const { Transaction } = require('./Transaction');
const { UTXOSet } = require('./UTXOSet');
const { MinerWallet } = require('./MinerWallet');
const fs = require('fs').promises;
const path = require('path');

class Blockchain {
  constructor() {
    this.chain = [];
    this.difficulty = 2; // 初始挖矿难度
    this.pendingTransactions = [];
    this.miningReward = 50;
    this.utxoSet = new UTXOSet();
    this.minerWallet = new MinerWallet();
    this.blockTime = 10000; // 目标出块时间（毫秒）
    this.difficultyAdjustmentInterval = 10; // 每10个区块调整一次难度
    this.dataDir = path.join(process.cwd(), 'blockchain-data');
  }

  /**
   * 初始化区块链
   */
  async initialize() {
    try {
      // 创建数据目录
      await this.ensureDataDirectory();
      
      // 尝试从文件加载区块链
      await this.loadFromFile();
      
      // 如果没有加载到数据，创建创世区块
      if (this.chain.length === 0) {
        this.createGenesisBlock();
      }
      
      // 重建UTXO集合
      await this.rebuildUTXOSet();
      
      console.log(`区块链初始化完成，当前高度: ${this.getLatestBlock().index}`);
      console.log(`总供应量: ${this.utxoSet.getTotalSupply()}`);
      
    } catch (error) {
      console.error('区块链初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保数据目录存在
   */
  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log(`创建数据目录: ${this.dataDir}`);
    }
  }

  /**
   * 创建创世区块
   */
  createGenesisBlock() {
    const genesisBlock = Block.createGenesisBlock();
    
    // 为矿工钱包添加初始余额
    const initialReward = Transaction.createCoinbaseTransaction(
      this.minerWallet.getAddress(),
      this.miningReward * 10 // 创世区块给更多奖励
    );
    
    genesisBlock.transactions = [initialReward];
    genesisBlock.hash = genesisBlock.calculateHash();
    
    this.chain.push(genesisBlock);
    this.utxoSet.processTransaction(initialReward);
    
    console.log('创世区块已创建，矿工初始余额:', this.utxoSet.getBalance(this.minerWallet.getAddress()));
  }

  /**
   * 获取最新区块
   */
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * 添加交易到待处理队列
   */
  addTransaction(transaction) {
    if (!transaction.isValid()) {
      throw new Error('无效的交易');
    }

    if (!this.utxoSet.canProcessTransaction(transaction)) {
      throw new Error('余额不足以处理此交易');
    }

    // 检查双重支付
    const existingTx = this.pendingTransactions.find(tx => tx.txId === transaction.txId);
    if (existingTx) {
      throw new Error('交易已存在于待处理队列中');
    }

    this.pendingTransactions.push(transaction);
    console.log(`交易已添加到待处理队列: ${transaction.txId}`);
    
    return transaction.txId;
  }

  /**
   * 挖矿新区块
   */
  async mineBlock(minerAddress = null) {
    const miner = minerAddress || this.minerWallet.getAddress();
    
    // 创建coinbase交易（挖矿奖励）
    const coinbaseTx = Transaction.createCoinbaseTransaction(miner, this.miningReward);
    
    // 验证并选择交易
    const validTransactions = [coinbaseTx];
    const fees = this.selectTransactionsForBlock(validTransactions);
    
    // 如果有交易费用，增加到coinbase交易中
    if (fees > 0) {
      coinbaseTx.amount += fees;
    }

    // 创建新区块
    const newBlock = new Block(
      this.getLatestBlock().index + 1,
      this.getLatestBlock().hash,
      Date.now(),
      validTransactions
    );

    // 执行工作量证明
    const miningResult = await newBlock.mineBlock(this.difficulty);
    
    // 验证新区块
    if (!this.isValidNewBlock(newBlock, this.getLatestBlock())) {
      throw new Error('挖出的区块无效');
    }

    // 添加到区块链
    this.chain.push(newBlock);
    
    // 更新UTXO集合
    for (const tx of validTransactions) {
      this.utxoSet.processTransaction(tx);
    }
    
    // 移除已处理的交易
    this.removePendingTransactions(validTransactions);
    
    // 调整挖矿难度
    this.adjustDifficulty();
    
    // 保存到文件
    await this.saveToFile();
    
    console.log(`新区块 #${newBlock.index} 已挖出并添加到区块链`);
    console.log(`矿工 ${miner} 获得奖励: ${coinbaseTx.amount}`);
    
    return {
      block: newBlock,
      miningResult,
      reward: coinbaseTx.amount
    };
  }

  /**
   * 为区块选择交易
   */
  selectTransactionsForBlock(transactions) {
    let totalFees = 0;
    const maxTransactions = 100; // 每个区块最大交易数
    
    // 按费用率排序（费用/大小）
    const sortedPending = [...this.pendingTransactions]
      .filter(tx => this.utxoSet.canProcessTransaction(tx))
      .sort((a, b) => (b.fee || 0) - (a.fee || 0))
      .slice(0, maxTransactions - 1); // 减1为coinbase交易留空间
    
    for (const tx of sortedPending) {
      transactions.push(tx);
      totalFees += tx.fee || 0;
    }
    
    return totalFees;
  }

  /**
   * 移除已处理的交易
   */
  removePendingTransactions(processedTransactions) {
    const processedTxIds = new Set(
      processedTransactions
        .filter(tx => tx.txId)
        .map(tx => tx.txId)
    );
    
    this.pendingTransactions = this.pendingTransactions.filter(
      tx => !processedTxIds.has(tx.txId)
    );
  }

  /**
   * 调整挖矿难度
   */
  adjustDifficulty() {
    const latestBlock = this.getLatestBlock();
    
    // 只在指定间隔调整难度
    if (latestBlock.index % this.difficultyAdjustmentInterval !== 0 || latestBlock.index === 0) {
      return;
    }

    // 获取调整间隔前的区块
    const prevAdjustmentBlock = this.chain[this.chain.length - this.difficultyAdjustmentInterval];
    
    // 计算实际用时
    const timeExpected = this.blockTime * this.difficultyAdjustmentInterval;
    const timeActual = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    
    // 调整难度
    if (timeActual < timeExpected / 2) {
      this.difficulty++;
      console.log(`挖矿速度过快，难度增加到: ${this.difficulty}`);
    } else if (timeActual > timeExpected * 2) {
      this.difficulty = Math.max(1, this.difficulty - 1);
      console.log(`挖矿速度过慢，难度降低到: ${this.difficulty}`);
    }
  }

  /**
   * 验证新区块
   */
  isValidNewBlock(newBlock, previousBlock) {
    // 检查区块索引
    if (newBlock.index !== previousBlock.index + 1) {
      console.log('无效的区块索引');
      return false;
    }

    // 检查前一个区块哈希
    if (newBlock.previousHash !== previousBlock.hash) {
      console.log('无效的前一个区块哈希');
      return false;
    }

    // 检查区块哈希
    if (!newBlock.hasValidHash()) {
      console.log('无效的区块哈希');
      return false;
    }

    // 检查工作量证明
    const target = Array(this.difficulty + 1).join('0');
    if (newBlock.hash.substring(0, this.difficulty) !== target) {
      console.log('工作量证明无效');
      return false;
    }

    // 检查交易
    if (!newBlock.hasValidTransactions()) {
      console.log('区块包含无效交易');
      return false;
    }

    return true;
  }

  /**
   * 验证整个区块链
   */
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (!this.isValidNewBlock(currentBlock, previousBlock)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 获取地址余额
   */
  getBalance(address) {
    return this.utxoSet.getBalance(address);
  }

  /**
   * 获取所有余额
   */
  getAllBalances() {
    return this.utxoSet.getAllBalances();
  }

  /**
   * 根据高度获取区块
   */
  getBlockByHeight(height) {
    return this.chain[height] || null;
  }

  /**
   * 根据哈希获取区块
   */
  getBlockByHash(hash) {
    return this.chain.find(block => block.hash === hash) || null;
  }

  /**
   * 重建UTXO集合
   */
  async rebuildUTXOSet() {
    console.log('重建UTXO集合...');
    this.utxoSet.clear();
    
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        this.utxoSet.processTransaction(tx);
      }
    }
    
    console.log('UTXO集合重建完成');
  }

  /**
   * 保存区块链到文件
   */
  async saveToFile() {
    try {
      const data = {
        chain: this.chain.map(block => block.toJSON()),
        difficulty: this.difficulty,
        miningReward: this.miningReward,
        minerWallet: this.minerWallet.toJSON(),
        timestamp: Date.now()
      };
      
      const filePath = path.join(this.dataDir, 'blockchain.json');
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      console.log('区块链数据已保存到文件');
    } catch (error) {
      console.error('保存区块链数据失败:', error);
    }
  }

  /**
   * 从文件加载区块链
   */
  async loadFromFile() {
    try {
      const filePath = path.join(this.dataDir, 'blockchain.json');
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      
      this.chain = data.chain.map(blockData => Block.fromJSON(blockData));
      this.difficulty = data.difficulty || 2;
      this.miningReward = data.miningReward || 50;
      
      if (data.minerWallet) {
        this.minerWallet = MinerWallet.fromJSON(data.minerWallet);
      }
      
      console.log(`从文件加载了 ${this.chain.length} 个区块`);
      
    } catch (error) {
      console.log('无法从文件加载区块链数据，将创建新的区块链');
    }
  }

  /**
   * 获取区块链统计信息
   */
  getStatistics() {
    const latestBlock = this.getLatestBlock();
    const utxoStats = this.utxoSet.getStatistics();
    
    return {
      height: latestBlock.index,
      totalBlocks: this.chain.length,
      difficulty: this.difficulty,
      totalSupply: this.utxoSet.getTotalSupply(),
      pendingTransactions: this.pendingTransactions.length,
      miningReward: this.miningReward,
      latestBlockHash: latestBlock.hash,
      latestBlockTime: new Date(latestBlock.timestamp).toISOString(),
      utxoStatistics: utxoStats
    };
  }

  /**
   * 获取矿工钱包
   */
  getMinerWallet() {
    return this.minerWallet;
  }

  /**
   * 替换区块链（用于P2P同步）
   */
  replaceChain(newChain) {
    if (newChain.length > this.chain.length && this.isValidChain(newChain)) {
      console.log('替换当前区块链为更长的有效区块链');
      this.chain = newChain;
      this.rebuildUTXOSet();
      return true;
    }
    return false;
  }

  /**
   * 验证区块链数组
   */
  isValidChain(chain) {
    for (let i = 1; i < chain.length; i++) {
      const currentBlock = chain[i];
      const previousBlock = chain[i - 1];
      
      if (!this.isValidNewBlock(currentBlock, previousBlock)) {
        return false;
      }
    }
    return true;
  }
}

module.exports = { Blockchain };