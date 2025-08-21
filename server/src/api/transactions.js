const Router = require('@koa/router');
const { Transaction } = require('../modules/Transaction');
const { MinerWallet } = require('../modules/MinerWallet');

const router = new Router();

/**
 * 客户端转账
 * POST /api/transactions/client-transfer
 */
router.post('/client-transfer', async (ctx) => {
  try {
    const { privateKey, toAddress, amount, fee = 0 } = ctx.request.body;
    
    if (!privateKey || !toAddress || !amount) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '缺少必要参数',
        message: '请提供私钥、接收地址和转账金额'
      };
      return;
    }
    
    if (amount <= 0) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '无效的转账金额',
        message: '转账金额必须大于0'
      };
      return;
    }
    
    // 从私钥创建钱包
    const wallet = MinerWallet.fromPrivateKey(privateKey);
    const fromAddress = wallet.getAddress();
    
    // 检查余额
    const balance = ctx.blockchain.getBalance(fromAddress);
    if (balance < amount + fee) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '余额不足',
        message: `当前余额: ${balance}, 需要: ${amount + fee}`
      };
      return;
    }
    
    // 创建并签名交易
    const transaction = wallet.createTransaction(toAddress, amount, fee);
    
    // 添加交易到待处理队列
    const txId = ctx.blockchain.addTransaction(transaction);
    
    // 广播交易到P2P网络
    ctx.p2pNetwork.broadcastTransaction(transaction);
    
    ctx.body = {
      success: true,
      data: {
        txId,
        fromAddress,
        toAddress,
        amount,
        fee,
        timestamp: transaction.timestamp,
        status: 'pending'
      },
      message: '交易提交成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '交易提交失败'
    };
  }
});

/**
 * 创建原始交易（不签名）
 * POST /api/transactions/create
 */
router.post('/create', async (ctx) => {
  try {
    const { fromAddress, toAddress, amount, fee = 0 } = ctx.request.body;
    
    if (!fromAddress || !toAddress || !amount) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '缺少必要参数',
        message: '请提供发送地址、接收地址和转账金额'
      };
      return;
    }
    
    const transaction = Transaction.createTransferTransaction(fromAddress, toAddress, amount, fee);
    
    ctx.body = {
      success: true,
      data: {
        transaction: transaction.toJSON(),
        hash: transaction.calculateHash()
      },
      message: '交易创建成功，请进行签名'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '交易创建失败'
    };
  }
});

/**
 * 验证交易
 * POST /api/transactions/validate
 */
router.post('/validate', async (ctx) => {
  try {
    const { transactionData } = ctx.request.body;
    
    if (!transactionData) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '缺少交易数据',
        message: '请提供交易数据'
      };
      return;
    }
    
    const transaction = Transaction.fromJSON(transactionData);
    const isValid = transaction.isValid();
    const canProcess = ctx.blockchain.utxoSet.canProcessTransaction(transaction);
    
    ctx.body = {
      success: true,
      data: {
        isValid,
        canProcess,
        transaction: transaction.toJSON(),
        validation: {
          hasValidSignature: isValid,
          hasSufficientBalance: canProcess,
          isNotCoinbase: transaction.fromAddress !== null
        }
      },
      message: isValid && canProcess ? '交易有效' : '交易无效'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '交易验证失败'
    };
  }
});

/**
 * 提交已签名交易
 * POST /api/transactions/submit
 */
router.post('/submit', async (ctx) => {
  try {
    const { transactionData } = ctx.request.body;
    
    if (!transactionData) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '缺少交易数据',
        message: '请提供交易数据'
      };
      return;
    }
    
    const transaction = Transaction.fromJSON(transactionData);
    
    // 验证交易
    if (!transaction.isValid()) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '交易签名验证失败',
        message: '交易签名无效或交易数据已被篡改'
      };
      return;
    }
    
    if (!ctx.blockchain.utxoSet.canProcessTransaction(transaction)) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '交易无法处理',
        message: '发送方余额不足'
      };
      return;
    }
    
    // 添加交易到待处理队列
    const txId = ctx.blockchain.addTransaction(transaction);
    
    // 广播交易到P2P网络
    ctx.p2pNetwork.broadcastTransaction(transaction);
    
    ctx.body = {
      success: true,
      data: {
        txId,
        status: 'pending',
        timestamp: transaction.timestamp
      },
      message: '交易提交成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '交易提交失败'
    };
  }
});

/**
 * 获取待处理交易
 * GET /api/transactions/pending
 */
router.get('/pending', async (ctx) => {
  try {
    const pendingTxs = ctx.blockchain.pendingTransactions.map(tx => ({
      txId: tx.txId,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      amount: tx.amount,
      fee: tx.fee || 0,
      timestamp: tx.timestamp,
      type: tx.fromAddress === null ? 'coinbase' : 'transfer'
    }));
    
    // 按费用排序（高费用在前）
    pendingTxs.sort((a, b) => b.fee - a.fee);
    
    ctx.body = {
      success: true,
      data: {
        transactions: pendingTxs,
        count: pendingTxs.length,
        totalFees: pendingTxs.reduce((sum, tx) => sum + tx.fee, 0),
        estimatedProcessTime: pendingTxs.length > 0 ? 
          Math.ceil(pendingTxs.length / 100) * 10 : 0 // 简化估算
      },
      message: '待处理交易查询成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '待处理交易查询失败'
    };
  }
});

/**
 * 根据TxId查询交易
 * GET /api/transactions/:txId
 */
router.get('/:txId', async (ctx) => {
  try {
    const { txId } = ctx.params;
    
    // 先在待处理交易中查找
    const pendingTx = ctx.blockchain.pendingTransactions.find(tx => tx.txId === txId);
    if (pendingTx) {
      ctx.body = {
        success: true,
        data: {
          transaction: pendingTx.toJSON(),
          status: 'pending',
          confirmations: 0,
          blockHeight: null,
          blockHash: null
        },
        message: '交易查询成功（待处理）'
      };
      return;
    }
    
    // 在区块链中查找
    for (const block of ctx.blockchain.chain) {
      for (const tx of block.transactions) {
        if (tx.txId === txId || (tx.fromAddress === null && txId === 'coinbase')) {
          const confirmations = ctx.blockchain.chain.length - 1 - block.index;
          
          ctx.body = {
            success: true,
            data: {
              transaction: {
                txId: tx.txId || 'coinbase',
                fromAddress: tx.fromAddress,
                toAddress: tx.toAddress,
                amount: tx.amount,
                fee: tx.fee || 0,
                timestamp: tx.timestamp,
                signature: tx.signature
              },
              status: 'confirmed',
              confirmations,
              blockHeight: block.index,
              blockHash: block.hash,
              blockTimestamp: block.timestamp,
              type: tx.fromAddress === null ? 'coinbase' : 'transfer'
            },
            message: '交易查询成功（已确认）'
          };
          return;
        }
      }
    }
    
    // 交易不存在
    ctx.status = 404;
    ctx.body = {
      success: false,
      error: '交易不存在',
      message: `TxId ${txId} 对应的交易不存在`
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '交易查询失败'
    };
  }
});

/**
 * 获取交易统计信息
 * GET /api/transactions/statistics
 */
router.get('/statistics', async (ctx) => {
  try {
    let totalTransactions = 0;
    let totalVolume = 0;
    let totalFees = 0;
    let coinbaseCount = 0;
    let transferCount = 0;
    
    // 统计所有区块中的交易
    for (const block of ctx.blockchain.chain) {
      totalTransactions += block.transactions.length;
      
      for (const tx of block.transactions) {
        if (tx.fromAddress === null) {
          coinbaseCount++;
        } else {
          transferCount++;
          totalVolume += tx.amount;
          totalFees += tx.fee || 0;
        }
      }
    }
    
    // 待处理交易统计
    const pendingCount = ctx.blockchain.pendingTransactions.length;
    const pendingVolume = ctx.blockchain.pendingTransactions.reduce(
      (sum, tx) => sum + tx.amount, 0
    );
    const pendingFees = ctx.blockchain.pendingTransactions.reduce(
      (sum, tx) => sum + (tx.fee || 0), 0
    );
    
    ctx.body = {
      success: true,
      data: {
        confirmed: {
          totalTransactions,
          coinbaseTransactions: coinbaseCount,
          transferTransactions: transferCount,
          totalVolume,
          totalFees,
          averageTransactionValue: transferCount > 0 ? totalVolume / transferCount : 0,
          averageFee: transferCount > 0 ? totalFees / transferCount : 0
        },
        pending: {
          count: pendingCount,
          totalVolume: pendingVolume,
          totalFees: pendingFees,
          averageValue: pendingCount > 0 ? pendingVolume / pendingCount : 0,
          averageFee: pendingCount > 0 ? pendingFees / pendingCount : 0
        },
        network: {
          transactionThroughput: totalTransactions / Math.max(ctx.blockchain.chain.length - 1, 1),
          memPoolSize: pendingCount,
          networkUtilization: pendingCount > 100 ? 'high' : 
                             pendingCount > 50 ? 'medium' : 'low'
        }
      },
      message: '交易统计查询成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '交易统计查询失败'
    };
  }
});

/**
 * 获取交易历史
 * GET /api/transactions/history
 */
router.get('/history', async (ctx) => {
  try {
    const { page = 1, limit = 20, type = 'all' } = ctx.query;
    const transactions = [];
    
    // 遍历所有区块收集交易
    for (const block of ctx.blockchain.chain) {
      for (const tx of block.transactions) {
        const txType = tx.fromAddress === null ? 'coinbase' : 'transfer';
        
        // 按类型过滤
        if (type !== 'all' && txType !== type) {
          continue;
        }
        
        transactions.push({
          txId: tx.txId || 'coinbase',
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          amount: tx.amount,
          fee: tx.fee || 0,
          timestamp: tx.timestamp,
          blockHeight: block.index,
          blockHash: block.hash,
          confirmations: ctx.blockchain.chain.length - 1 - block.index,
          type: txType
        });
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
        transactions: paginatedTxs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: transactions.length,
          totalPages: Math.ceil(transactions.length / limit)
        },
        filter: {
          type,
          availableTypes: ['all', 'coinbase', 'transfer']
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