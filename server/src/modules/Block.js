const crypto = require('crypto');
const { Transaction } = require('./Transaction');

class Block {
  constructor(index, previousHash, timestamp, transactions, nonce = 0) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.nonce = nonce;
    this.hash = this.calculateHash();
    this.merkleRoot = this.calculateMerkleRoot();
  }

  /**
   * 计算区块哈希
   */
  calculateHash() {
    const data = this.index + 
                 this.previousHash + 
                 this.timestamp + 
                 JSON.stringify(this.transactions) + 
                 this.nonce;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * 计算默克尔根
   */
  calculateMerkleRoot() {
    if (this.transactions.length === 0) {
      return crypto.createHash('sha256').update('').digest('hex');
    }

    const txHashes = this.transactions.map(tx => 
      typeof tx === 'string' ? tx : tx.calculateHash()
    );

    return this.buildMerkleTree(txHashes);
  }

  /**
   * 构建默克尔树
   */
  buildMerkleTree(hashes) {
    if (hashes.length === 1) {
      return hashes[0];
    }

    const newLevel = [];
    
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = hashes[i + 1] || hashes[i]; // 如果是奇数个，重复最后一个
      const combined = crypto.createHash('sha256')
        .update(left + right)
        .digest('hex');
      newLevel.push(combined);
    }

    return this.buildMerkleTree(newLevel);
  }

  /**
   * 挖矿 - 工作量证明
   */
  async mineBlock(difficulty) {
    const target = Array(difficulty + 1).join('0');
    
    console.log(`开始挖矿区块 #${this.index}，难度: ${difficulty}`);
    const startTime = Date.now();
    
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
      
      // 每1000次迭代检查一次，避免阻塞
      if (this.nonce % 1000 === 0) {
        await new Promise(resolve => setImmediate(resolve));
        
        // 每10000次迭代输出进度
        if (this.nonce % 10000 === 0) {
          console.log(`挖矿进度: nonce=${this.nonce}, hash=${this.hash.substring(0, 10)}...`);
        }
      }
    }
    
    const endTime = Date.now();
    const miningTime = (endTime - startTime) / 1000;
    const hashRate = this.nonce / miningTime;
    
    console.log(`区块 #${this.index} 挖矿成功!`);
    console.log(`哈希: ${this.hash}`);
    console.log(`随机数: ${this.nonce}`);
    console.log(`用时: ${miningTime.toFixed(2)}秒`);
    console.log(`算力: ${hashRate.toFixed(2)} H/s`);
    
    return {
      hash: this.hash,
      nonce: this.nonce,
      miningTime,
      hashRate
    };
  }

  /**
   * 验证区块中的所有交易
   */
  hasValidTransactions() {
    for (const tx of this.transactions) {
      if (tx instanceof Transaction && !tx.isValid()) {
        console.log('发现无效交易:', tx);
        return false;
      }
    }
    return true;
  }

  /**
   * 验证区块哈希
   */
  hasValidHash() {
    return this.hash === this.calculateHash();
  }

  /**
   * 获取区块大小（字节）
   */
  getSize() {
    return Buffer.byteLength(JSON.stringify(this.toJSON()), 'utf8');
  }

  /**
   * 获取交易费用总和
   */
  getTotalFees() {
    return this.transactions
      .filter(tx => tx instanceof Transaction)
      .reduce((total, tx) => total + (tx.fee || 0), 0);
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      index: this.index,
      previousHash: this.previousHash,
      timestamp: this.timestamp,
      transactions: this.transactions.map(tx => 
        tx instanceof Transaction ? tx.toJSON() : tx
      ),
      nonce: this.nonce,
      hash: this.hash,
      merkleRoot: this.merkleRoot
    };
  }

  /**
   * 从JSON创建区块实例
   */
  static fromJSON(data) {
    const transactions = data.transactions.map(txData => {
      if (typeof txData === 'object' && txData.fromAddress !== undefined) {
        return Transaction.fromJSON(txData);
      }
      return txData;
    });
    
    const block = new Block(
      data.index,
      data.previousHash,
      data.timestamp,
      transactions,
      data.nonce
    );
    
    block.hash = data.hash;
    block.merkleRoot = data.merkleRoot;
    
    return block;
  }

  /**
   * 创建创世区块
   */
  static createGenesisBlock() {
    const genesisBlock = new Block(0, '0', Date.now(), [], 0);
    genesisBlock.hash = genesisBlock.calculateHash();
    console.log('创世区块已创建:', genesisBlock.hash);
    return genesisBlock;
  }
}

module.exports = { Block };