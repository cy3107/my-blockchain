const Router = require('@koa/router');
const { MinerWallet } = require('../modules/MinerWallet');

const router = new Router();

/**
 * 生成新地址
 * POST /api/addresses/generate
 */
router.post('/generate', async (ctx) => {
  try {
    const walletInfo = MinerWallet.generateAddress();
    
    ctx.body = {
      success: true,
      data: {
        address: walletInfo.address,
        publicKey: walletInfo.publicKey,
        // 注意：在生产环境中不应该返回私钥
        privateKey: walletInfo.privateKey
      },
      message: '地址生成成功'
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: error.message,
      message: '地址生成失败'
    };
  }
});

/**
 * 查询地址余额
 * GET /api/addresses/:address/balance
 */
router.get('/:address/balance', async (ctx) => {
  try {
    const { address } = ctx.params;
    
    // 验证地址格式
    if (!MinerWallet.isValidAddress(address)) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '无效的地址格式',
        message: '地址格式不正确'
      };
      return;
    }
    
    const balance = ctx.blockchain.getBalance(address);
    const utxos = ctx.blockchain.utxoSet.getUTXOs(address);
    
    ctx.body = {
      success: true,
      data: {
        address,
        balance,
        utxos: utxos.map(utxo => ({
          txId: utxo.txId,
          amount: utxo.amount,
          outputIndex: utxo.outputIndex,
          timestamp: utxo.timestamp
        }))
      },
      message: '余额查询成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '余额查询失败'
    };
  }
});

/**
 * 验证地址
 * POST /api/addresses/validate
 */
router.post('/validate', async (ctx) => {
  try {
    const { address } = ctx.request.body;
    
    if (!address) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '地址不能为空',
        message: '请提供地址'
      };
      return;
    }
    
    const isValid = MinerWallet.isValidAddress(address);
    
    ctx.body = {
      success: true,
      data: {
        address,
        isValid,
        format: isValid ? 'cosmos' : 'unknown'
      },
      message: isValid ? '地址格式正确' : '地址格式错误'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '地址验证失败'
    };
  }
});

/**
 * 获取所有地址余额
 * GET /api/addresses/balances
 */
router.get('/balances', async (ctx) => {
  try {
    const allBalances = ctx.blockchain.getAllBalances();
    const utxoStats = ctx.blockchain.utxoSet.getStatistics();
    
    const balanceList = Object.entries(allBalances).map(([address, balance]) => ({
      address,
      balance,
      utxoCount: ctx.blockchain.utxoSet.getUTXOs(address).length
    }));
    
    // 按余额排序
    balanceList.sort((a, b) => b.balance - a.balance);
    
    ctx.body = {
      success: true,
      data: {
        balances: balanceList,
        statistics: {
          totalAddresses: balanceList.length,
          totalSupply: utxoStats.totalValue,
          averageBalance: balanceList.length > 0 ? 
            utxoStats.totalValue / balanceList.length : 0,
          totalUTXOs: utxoStats.totalUTXOs
        }
      },
      message: '余额查询成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '余额查询失败'
    };
  }
});

/**
 * 从私钥导入地址
 * POST /api/addresses/import
 */
router.post('/import', async (ctx) => {
  try {
    const { privateKey } = ctx.request.body;
    
    if (!privateKey) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '私钥不能为空',
        message: '请提供私钥'
      };
      return;
    }
    
    const wallet = MinerWallet.fromPrivateKey(privateKey);
    const balance = ctx.blockchain.getBalance(wallet.getAddress());
    
    ctx.body = {
      success: true,
      data: {
        address: wallet.getAddress(),
        publicKey: wallet.getPublicKey(),
        balance,
        mnemonic: wallet.generateMnemonic()
      },
      message: '地址导入成功'
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: error.message,
      message: '地址导入失败'
    };
  }
});

/**
 * 获取地址交易历史
 * GET /api/addresses/:address/transactions
 */
router.get('/:address/transactions', async (ctx) => {
  try {
    const { address } = ctx.params;
    const { page = 1, limit = 20 } = ctx.query;
    
    if (!MinerWallet.isValidAddress(address)) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '无效的地址格式'
      };
      return;
    }
    
    const transactions = [];
    
    // 遍历所有区块查找相关交易
    for (const block of ctx.blockchain.chain) {
      for (const tx of block.transactions) {
        if (tx.fromAddress === address || tx.toAddress === address) {
          transactions.push({
            txId: tx.txId,
            blockHeight: block.index,
            blockHash: block.hash,
            timestamp: tx.timestamp,
            fromAddress: tx.fromAddress,
            toAddress: tx.toAddress,
            amount: tx.amount,
            fee: tx.fee || 0,
            type: tx.fromAddress === null ? 'coinbase' : 
                  (tx.fromAddress === address ? 'send' : 'receive')
          });
        }
      }
    }
    
    // 按时间排序（最新的在前）
    transactions.sort((a, b) => b.timestamp - a.timestamp);
    
    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTxs = transactions.slice(startIndex, endIndex);
    
    ctx.body = {
      success: true,
      data: {
        address,
        transactions: paginatedTxs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: transactions.length,
          totalPages: Math.ceil(transactions.length / limit)
        }
      },
      message: '交易历史查询成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '交易历史查询失败'
    };
  }
});

module.exports = router;