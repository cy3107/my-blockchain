const Router = require('@koa/router');

const router = new Router();

/**
 * 获取所有区块
 * GET /api/blocks/all
 */
router.get('/all', async (ctx) => {
  try {
    const { page = 1, limit = 10 } = ctx.query;
    const blocks = ctx.blockchain.chain;
    
    // 分页处理
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    // 倒序排列（最新的区块在前）
    const reversedBlocks = [...blocks].reverse();
    const paginatedBlocks = reversedBlocks.slice(startIndex, endIndex);
    
    const blocksData = paginatedBlocks.map(block => ({
      index: block.index,
      hash: block.hash,
      previousHash: block.previousHash,
      timestamp: block.timestamp,
      nonce: block.nonce,
      merkleRoot: block.merkleRoot,
      transactionCount: block.transactions.length,
      size: block.getSize(),
      difficulty: ctx.blockchain.difficulty,
      transactions: block.transactions.map(tx => ({
        txId: tx.txId || 'coinbase',
        fromAddress: tx.fromAddress,
        toAddress: tx.toAddress,
        amount: tx.amount,
        fee: tx.fee || 0,
        type: tx.fromAddress === null ? 'coinbase' : 'transfer'
      }))
    }));
    
    ctx.body = {
      success: true,
      data: {
        blocks: blocksData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: blocks.length,
          totalPages: Math.ceil(blocks.length / limit)
        },
        statistics: {
          totalBlocks: blocks.length,
          latestHeight: blocks[blocks.length - 1].index,
          averageBlockSize: blocks.length > 0 ? 
            blocks.reduce((sum, block) => sum + block.getSize(), 0) / blocks.length : 0
        }
      },
      message: '区块查询成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '区块查询失败'
    };
  }
});

/**
 * 根据高度获取区块
 * GET /api/blocks/:height
 */
router.get('/:height', async (ctx) => {
  try {
    const height = parseInt(ctx.params.height);
    
    if (isNaN(height) || height < 0) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '无效的区块高度',
        message: '区块高度必须是非负整数'
      };
      return;
    }
    
    const block = ctx.blockchain.getBlockByHeight(height);
    
    if (!block) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: '区块不存在',
        message: `高度为 ${height} 的区块不存在`
      };
      return;
    }
    
    // 计算区块奖励总额
    const totalRewards = block.transactions
      .filter(tx => tx.fromAddress === null)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    // 计算交易费用总额
    const totalFees = block.transactions
      .filter(tx => tx.fromAddress !== null)
      .reduce((sum, tx) => sum + (tx.fee || 0), 0);
    
    ctx.body = {
      success: true,
      data: {
        index: block.index,
        hash: block.hash,
        previousHash: block.previousHash,
        timestamp: block.timestamp,
        nonce: block.nonce,
        merkleRoot: block.merkleRoot,
        difficulty: ctx.blockchain.difficulty,
        size: block.getSize(),
        transactionCount: block.transactions.length,
        totalRewards,
        totalFees,
        transactions: block.transactions.map(tx => ({
          txId: tx.txId || 'coinbase',
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          amount: tx.amount,
          fee: tx.fee || 0,
          timestamp: tx.timestamp,
          signature: tx.signature,
          type: tx.fromAddress === null ? 'coinbase' : 'transfer'
        })),
        metadata: {
          isGenesis: block.index === 0,
          confirmations: ctx.blockchain.chain.length - 1 - block.index,
          nextBlockHash: block.index < ctx.blockchain.chain.length - 1 ? 
            ctx.blockchain.chain[block.index + 1].hash : null
        }
      },
      message: '区块查询成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '区块查询失败'
    };
  }
});

/**
 * 根据哈希获取区块
 * GET /api/blocks/hash/:hash
 */
router.get('/hash/:hash', async (ctx) => {
  try {
    const { hash } = ctx.params;
    
    if (!hash || hash.length !== 64) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: '无效的区块哈希',
        message: '区块哈希必须是64位十六进制字符串'
      };
      return;
    }
    
    const block = ctx.blockchain.getBlockByHash(hash);
    
    if (!block) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: '区块不存在',
        message: `哈希为 ${hash} 的区块不存在`
      };
      return;
    }
    
    ctx.body = {
      success: true,
      data: {
        index: block.index,
        hash: block.hash,
        previousHash: block.previousHash,
        timestamp: block.timestamp,
        nonce: block.nonce,
        merkleRoot: block.merkleRoot,
        transactionCount: block.transactions.length,
        transactions: block.transactions.map(tx => ({
          txId: tx.txId || 'coinbase',
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          amount: tx.amount,
          fee: tx.fee || 0,
          type: tx.fromAddress === null ? 'coinbase' : 'transfer'
        }))
      },
      message: '区块查询成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '区块查询失败'
    };
  }
});

/**
 * 获取最新区块
 * GET /api/blocks/latest
 */
router.get('/latest', async (ctx) => {
  try {
    const latestBlock = ctx.blockchain.getLatestBlock();
    
    ctx.body = {
      success: true,
      data: {
        index: latestBlock.index,
        hash: latestBlock.hash,
        previousHash: latestBlock.previousHash,
        timestamp: latestBlock.timestamp,
        nonce: latestBlock.nonce,
        merkleRoot: latestBlock.merkleRoot,
        transactionCount: latestBlock.transactions.length,
        size: latestBlock.getSize(),
        difficulty: ctx.blockchain.difficulty,
        transactions: latestBlock.transactions.map(tx => ({
          txId: tx.txId || 'coinbase',
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          amount: tx.amount,
          fee: tx.fee || 0,
          type: tx.fromAddress === null ? 'coinbase' : 'transfer'
        }))
      },
      message: '最新区块查询成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '最新区块查询失败'
    };
  }
});

/**
 * 获取区块链统计信息
 * GET /api/blocks/statistics
 */
router.get('/statistics', async (ctx) => {
  try {
    const stats = ctx.blockchain.getStatistics();
    const latestBlock = ctx.blockchain.getLatestBlock();
    
    // 计算平均出块时间
    let averageBlockTime = 0;
    if (ctx.blockchain.chain.length > 1) {
      const firstBlock = ctx.blockchain.chain[1]; // 跳过创世区块
      const totalTime = latestBlock.timestamp - firstBlock.timestamp;
      averageBlockTime = totalTime / (ctx.blockchain.chain.length - 1);
    }
    
    // 计算哈希率（简化估算）
    const estimatedHashRate = Math.pow(16, ctx.blockchain.difficulty) / (averageBlockTime / 1000);
    
    ctx.body = {
      success: true,
      data: {
        ...stats,
        averageBlockTime: averageBlockTime / 1000, // 转换为秒
        estimatedHashRate,
        chainSize: ctx.blockchain.chain.reduce((sum, block) => sum + block.getSize(), 0),
        networkHealth: {
          isValid: ctx.blockchain.isChainValid(),
          lastBlockAge: Date.now() - latestBlock.timestamp,
          syncStatus: 'synced'
        }
      },
      message: '区块链统计查询成功'
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
      message: '区块链统计查询失败'
    };
  }
});

module.exports = router;