const crypto = require('crypto');
const { Sha256 } = require('@cosmjs/crypto');
const { toHex, fromHex } = require('@cosmjs/encoding');
const secp256k1 = require('secp256k1');

class Transaction {
  constructor(fromAddress, toAddress, amount, fee = 0) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.fee = fee;
    this.timestamp = Date.now();
    this.signature = null;
    this.txId = this.calculateHash();
  }

  /**
   * 计算交易哈希
   */
  calculateHash() {
    const data = (this.fromAddress || '') + 
                 (this.toAddress || '') + 
                 this.amount + 
                 this.fee + 
                 this.timestamp;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * 签名交易（使用secp256k1）
   */
  signTransaction(privateKey) {
    if (this.fromAddress === null) {
      throw new Error('无法为挖矿奖励交易签名');
    }

    const hashTx = this.calculateHash();
    const msgHash = new Uint8Array(Sha256(fromHex(hashTx)));
    
    let privKeyBytes;
    if (typeof privateKey === 'string') {
      privKeyBytes = fromHex(privateKey);
    } else {
      privKeyBytes = privateKey;
    }

    const signature = secp256k1.ecdsaSign(msgHash, privKeyBytes);
    this.signature = {
      r: toHex(signature.signature.slice(0, 32)),
      s: toHex(signature.signature.slice(32, 64)),
      recoveryId: signature.recid
    };

    console.log(`交易已签名: ${this.txId.substring(0, 10)}...`);
  }

  /**
   * 验证交易签名
   */
  isValid() {
    // 挖矿奖励交易无需验证签名
    if (this.fromAddress === null) {
      return this.amount > 0;
    }

    // 检查基本字段
    if (!this.signature || !this.fromAddress || !this.toAddress) {
      console.log('交易缺少必要字段');
      return false;
    }

    if (this.amount <= 0) {
      console.log('交易金额必须大于0');
      return false;
    }

    if (this.fromAddress === this.toAddress) {
      console.log('发送方和接收方不能相同');
      return false;
    }

    try {
      // 验证签名
      const hashTx = this.calculateHash();
      const msgHash = new Uint8Array(Sha256(fromHex(hashTx)));
      
      const signatureBytes = new Uint8Array(64);
      signatureBytes.set(fromHex(this.signature.r), 0);
      signatureBytes.set(fromHex(this.signature.s), 32);

      // 恢复公钥
      const publicKey = secp256k1.ecdsaRecover(
        signatureBytes,
        this.signature.recoveryId,
        msgHash
      );

      // 验证公钥是否匹配地址
      const derivedAddress = this.publicKeyToAddress(publicKey);
      
      if (derivedAddress !== this.fromAddress) {
        console.log('签名验证失败：地址不匹配');
        return false;
      }

      return true;
    } catch (error) {
      console.error('签名验证错误:', error.message);
      return false;
    }
  }

  /**
   * 从公钥生成Cosmos地址
   */
  publicKeyToAddress(publicKey) {
    // 使用SHA256和RIPEMD160生成地址（简化版本）
    const sha256Hash = crypto.createHash('sha256').update(publicKey).digest();
    const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
    
    // 转换为Cosmos地址格式（简化）
    const address = 'cosmos' + ripemd160Hash.toString('hex').substring(0, 40);
    return address;
  }

  /**
   * 获取交易输入总额
   */
  getTotalInput() {
    return this.amount + this.fee;
  }

  /**
   * 检查是否为Coinbase交易（挖矿奖励）
   */
  isCoinbase() {
    return this.fromAddress === null;
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      txId: this.txId,
      fromAddress: this.fromAddress,
      toAddress: this.toAddress,
      amount: this.amount,
      fee: this.fee,
      timestamp: this.timestamp,
      signature: this.signature
    };
  }

  /**
   * 从JSON创建交易实例
   */
  static fromJSON(data) {
    const tx = new Transaction(
      data.fromAddress,
      data.toAddress,
      data.amount,
      data.fee
    );
    
    tx.txId = data.txId;
    tx.timestamp = data.timestamp;
    tx.signature = data.signature;
    
    return tx;
  }

  /**
   * 创建挖矿奖励交易
   */
  static createCoinbaseTransaction(toAddress, amount) {
    const tx = new Transaction(null, toAddress, amount, 0);
    console.log(`创建挖矿奖励交易: ${amount} -> ${toAddress}`);
    return tx;
  }

  /**
   * 创建普通转账交易
   */
  static createTransferTransaction(fromAddress, toAddress, amount, fee = 0) {
    if (!fromAddress || !toAddress) {
      throw new Error('发送方和接收方地址不能为空');
    }
    
    if (amount <= 0) {
      throw new Error('转账金额必须大于0');
    }

    const tx = new Transaction(fromAddress, toAddress, amount, fee);
    console.log(`创建转账交易: ${fromAddress} -> ${toAddress}: ${amount}`);
    return tx;
  }
}

module.exports = { Transaction };