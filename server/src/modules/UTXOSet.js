/**
 * UTXO (Unspent Transaction Output) 集合管理
 * 用于跟踪未花费的交易输出，实现类似比特币的UTXO模型
 */
class UTXOSet {
  constructor() {
    this.utxos = new Map(); // address -> [{ txId, amount, index }]
    this.balances = new Map(); // address -> total balance
  }

  /**
   * 添加UTXO
   */
  addUTXO(address, txId, amount, outputIndex = 0) {
    if (!this.utxos.has(address)) {
      this.utxos.set(address, []);
    }
    
    const utxo = {
      txId,
      amount,
      outputIndex,
      timestamp: Date.now()
    };
    
    this.utxos.get(address).push(utxo);
    
    // 更新余额
    const currentBalance = this.balances.get(address) || 0;
    this.balances.set(address, currentBalance + amount);
    
    console.log(`添加UTXO: ${address} +${amount} (总余额: ${this.balances.get(address)})`);
  }

  /**
   * 花费UTXO
   */
  spendUTXO(address, amount) {
    const addressUTXOs = this.utxos.get(address) || [];
    
    if (this.getBalance(address) < amount) {
      throw new Error(`余额不足: 需要 ${amount}, 当前 ${this.getBalance(address)}`);
    }

    // 选择要花费的UTXO（简单的贪心算法）
    const toSpend = [];
    let totalSelected = 0;
    
    // 按金额排序，优先选择大额的UTXO
    const sortedUTXOs = [...addressUTXOs].sort((a, b) => b.amount - a.amount);
    
    for (const utxo of sortedUTXOs) {
      if (totalSelected >= amount) break;
      
      toSpend.push(utxo);
      totalSelected += utxo.amount;
    }

    // 移除花费的UTXO
    for (const spentUTXO of toSpend) {
      const index = addressUTXOs.findIndex(utxo => 
        utxo.txId === spentUTXO.txId && utxo.outputIndex === spentUTXO.outputIndex
      );
      if (index > -1) {
        addressUTXOs.splice(index, 1);
      }
    }

    // 更新余额
    const currentBalance = this.balances.get(address) || 0;
    this.balances.set(address, currentBalance - amount);

    // 如果有找零，创建新的UTXO
    const change = totalSelected - amount;
    if (change > 0) {
      const changeTxId = this.generateTxId();
      this.addUTXO(address, changeTxId, change, 1);
    }

    console.log(`花费UTXO: ${address} -${amount} (找零: ${change}, 剩余余额: ${this.balances.get(address)})`);
    
    return {
      spentUTXOs: toSpend,
      change,
      totalSpent: totalSelected
    };
  }

  /**
   * 获取地址余额
   */
  getBalance(address) {
    return this.balances.get(address) || 0;
  }

  /**
   * 获取地址的所有UTXO
   */
  getUTXOs(address) {
    return this.utxos.get(address) || [];
  }

  /**
   * 获取所有地址的余额
   */
  getAllBalances() {
    const balances = {};
    for (const [address, balance] of this.balances) {
      if (balance > 0) {
        balances[address] = balance;
      }
    }
    return balances;
  }

  /**
   * 处理交易，更新UTXO集合
   */
  processTransaction(transaction) {
    // Coinbase交易（挖矿奖励）
    if (transaction.fromAddress === null) {
      this.addUTXO(transaction.toAddress, transaction.txId, transaction.amount);
      return;
    }

    // 普通转账交易
    try {
      // 花费发送方的UTXO
      const spendResult = this.spendUTXO(transaction.fromAddress, transaction.amount + transaction.fee);
      
      // 给接收方添加新的UTXO
      this.addUTXO(transaction.toAddress, transaction.txId, transaction.amount);
      
      console.log(`处理交易: ${transaction.fromAddress} -> ${transaction.toAddress}: ${transaction.amount}`);
      
    } catch (error) {
      console.error('处理交易失败:', error.message);
      throw error;
    }
  }

  /**
   * 验证交易是否有足够的余额
   */
  canProcessTransaction(transaction) {
    if (transaction.fromAddress === null) {
      return true; // Coinbase交易总是有效
    }
    
    const requiredAmount = transaction.amount + transaction.fee;
    const availableBalance = this.getBalance(transaction.fromAddress);
    
    return availableBalance >= requiredAmount;
  }

  /**
   * 获取网络总供应量
   */
  getTotalSupply() {
    let total = 0;
    for (const balance of this.balances.values()) {
      total += balance;
    }
    return total;
  }

  /**
   * 获取UTXO统计信息
   */
  getStatistics() {
    let totalUTXOs = 0;
    let totalValue = 0;
    
    for (const utxos of this.utxos.values()) {
      totalUTXOs += utxos.length;
      for (const utxo of utxos) {
        totalValue += utxo.amount;
      }
    }
    
    return {
      totalAddresses: this.balances.size,
      totalUTXOs,
      totalValue,
      averageUTXOValue: totalUTXOs > 0 ? totalValue / totalUTXOs : 0
    };
  }

  /**
   * 生成交易ID
   */
  generateTxId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 清空UTXO集合
   */
  clear() {
    this.utxos.clear();
    this.balances.clear();
    console.log('UTXO集合已清空');
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      utxos: Array.from(this.utxos.entries()),
      balances: Array.from(this.balances.entries())
    };
  }

  /**
   * 从JSON恢复UTXO集合
   */
  static fromJSON(data) {
    const utxoSet = new UTXOSet();
    
    if (data.utxos) {
      utxoSet.utxos = new Map(data.utxos);
    }
    
    if (data.balances) {
      utxoSet.balances = new Map(data.balances);
    }
    
    return utxoSet;
  }
}

module.exports = { UTXOSet };