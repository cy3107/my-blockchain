const crypto = require('crypto');
const { Sha256 } = require('@cosmjs/crypto');
const { toHex, fromHex } = require('@cosmjs/encoding');
const secp256k1 = require('secp256k1');

class MinerWallet {
  constructor(privateKey = null) {
    if (privateKey) {
      this.privateKey = typeof privateKey === 'string' ? fromHex(privateKey) : privateKey;
    } else {
      this.privateKey = this.generatePrivateKey();
    }
    
    this.publicKey = this.derivePublicKey();
    this.address = this.deriveAddress();
    
    console.log(`矿工钱包已创建: ${this.address}`);
  }

  /**
   * 生成私钥
   */
  generatePrivateKey() {
    let privateKey;
    do {
      privateKey = crypto.randomBytes(32);
    } while (!secp256k1.privateKeyVerify(privateKey));
    
    return privateKey;
  }

  /**
   * 从私钥推导公钥
   */
  derivePublicKey() {
    return secp256k1.publicKeyCreate(this.privateKey, false); // 未压缩格式
  }

  /**
   * 从公钥推导地址
   */
  deriveAddress() {
    // 使用SHA256和RIPEMD160生成地址（类似比特币）
    const sha256Hash = crypto.createHash('sha256').update(this.publicKey).digest();
    const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
    
    // 转换为Cosmos地址格式（简化版本）
    const address = 'cosmos' + ripemd160Hash.toString('hex').substring(0, 40);
    return address;
  }

  /**
   * 获取地址
   */
  getAddress() {
    return this.address;
  }

  /**
   * 获取公钥（十六进制）
   */
  getPublicKey() {
    return toHex(this.publicKey);
  }

  /**
   * 获取私钥（十六进制）
   */
  getPrivateKey() {
    return toHex(this.privateKey);
  }

  /**
   * 签名数据
   */
  sign(data) {
    const hash = typeof data === 'string' ? fromHex(data) : data;
    const msgHash = new Uint8Array(Sha256(hash));
    
    const signature = secp256k1.ecdsaSign(msgHash, this.privateKey);
    
    return {
      r: toHex(signature.signature.slice(0, 32)),
      s: toHex(signature.signature.slice(32, 64)),
      recoveryId: signature.recid
    };
  }

  /**
   * 验证签名
   */
  verify(data, signature) {
    try {
      const hash = typeof data === 'string' ? fromHex(data) : data;
      const msgHash = new Uint8Array(Sha256(hash));
      
      const signatureBytes = new Uint8Array(64);
      signatureBytes.set(fromHex(signature.r), 0);
      signatureBytes.set(fromHex(signature.s), 32);
      
      return secp256k1.ecdsaVerify(signatureBytes, msgHash, this.publicKey);
    } catch (error) {
      console.error('签名验证错误:', error);
      return false;
    }
  }

  /**
   * 创建转账交易
   */
  createTransaction(toAddress, amount, fee = 0) {
    const { Transaction } = require('./Transaction');
    
    const transaction = Transaction.createTransferTransaction(
      this.address,
      toAddress,
      amount,
      fee
    );
    
    // 签名交易
    transaction.signTransaction(this.privateKey);
    
    return transaction;
  }

  /**
   * 生成新的钱包地址
   */
  static generateAddress() {
    const tempWallet = new MinerWallet();
    return {
      address: tempWallet.getAddress(),
      privateKey: tempWallet.getPrivateKey(),
      publicKey: tempWallet.getPublicKey()
    };
  }

  /**
   * 从私钥恢复钱包
   */
  static fromPrivateKey(privateKey) {
    return new MinerWallet(privateKey);
  }

  /**
   * 生成助记词（简化版本）
   */
  generateMnemonic() {
    // 这里是一个简化版本，实际应用中应该使用BIP39标准
    const words = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
      'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
      'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual'
    ];
    
    const privateKeyHex = this.getPrivateKey();
    const mnemonic = [];
    
    // 从私钥生成12个词的助记词（简化算法）
    for (let i = 0; i < 12; i++) {
      const index = parseInt(privateKeyHex.substr(i * 5, 4), 16) % words.length;
      mnemonic.push(words[index]);
    }
    
    return mnemonic.join(' ');
  }

  /**
   * 钱包信息摘要
   */
  getInfo() {
    return {
      address: this.address,
      publicKey: this.getPublicKey(),
      mnemonic: this.generateMnemonic()
    };
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      privateKey: this.getPrivateKey(),
      publicKey: this.getPublicKey(),
      address: this.address
    };
  }

  /**
   * 从JSON恢复钱包
   */
  static fromJSON(data) {
    const wallet = new MinerWallet(data.privateKey);
    
    // 验证地址匹配
    if (wallet.address !== data.address) {
      throw new Error('钱包地址不匹配');
    }
    
    return wallet;
  }

  /**
   * 验证地址格式
   */
  static isValidAddress(address) {
    // 简单的地址格式验证
    return typeof address === 'string' && 
           address.startsWith('cosmos') && 
           address.length === 46 && 
           /^cosmos[0-9a-f]{40}$/.test(address);
  }

  /**
   * 比较两个地址是否相同
   */
  static addressEquals(addr1, addr2) {
    return addr1 && addr2 && addr1.toLowerCase() === addr2.toLowerCase();
  }
}

module.exports = { MinerWallet };