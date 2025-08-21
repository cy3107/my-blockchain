const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const { Blockchain } = require('./modules/Blockchain');
const { MiningManager } = require('./modules/MiningManager');
const { P2PNetwork } = require('./modules/P2PNetwork');
const addressRoutes = require('./api/addresses');
const blockRoutes = require('./api/blocks');
const miningRoutes = require('./api/mining');
const transactionRoutes = require('./api/transactions');

class BlockchainApp {
  constructor() {
    this.app = new Koa();
    this.router = new Router();
    this.port = process.env.PORT || 1317;
    this.p2pPort = process.env.P2P_PORT || 6001;
    this.peers = process.env.PEERS ? process.env.PEERS.split(',') : [];
    
    this.blockchain = new Blockchain();
    this.miningManager = new MiningManager(this.blockchain);
    this.p2pNetwork = new P2PNetwork(this.p2pPort, this.blockchain);
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.setupErrorHandling();
  }

  initializeMiddleware() {
    this.app.use(cors());
    this.app.use(bodyParser());
    
    // 添加区块链实例到上下文
    this.app.use(async (ctx, next) => {
      ctx.blockchain = this.blockchain;
      ctx.miningManager = this.miningManager;
      ctx.p2pNetwork = this.p2pNetwork;
      await next();
    });
  }

  initializeRoutes() {
    // API 路由
    this.router.use('/api/addresses', addressRoutes.routes());
    this.router.use('/api/blocks', blockRoutes.routes());
    this.router.use('/api/mining', miningRoutes.routes());
    this.router.use('/api/transactions', transactionRoutes.routes());
    
    // 健康检查
    this.router.get('/health', (ctx) => {
      ctx.body = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        blockchain: {
          height: this.blockchain.getLatestBlock().index,
          difficulty: this.blockchain.difficulty
        },
        mining: {
          isActive: this.miningManager.isMining,
          hashRate: this.miningManager.getHashRate()
        },
        network: {
          peers: this.p2pNetwork.getPeers().length
        }
      };
    });
    
    this.app.use(this.router.routes());
    this.app.use(this.router.allowedMethods());
  }

  setupErrorHandling() {
    this.app.on('error', (err, ctx) => {
      console.error('应用错误:', err);
    });
    
    this.app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        ctx.status = err.status || 500;
        ctx.body = {
          error: err.message,
          timestamp: new Date().toISOString()
        };
        console.error('请求错误:', err);
      }
    });
  }

  async start() {
    try {
      // 初始化区块链
      await this.blockchain.initialize();
      
      // 启动P2P网络
      await this.p2pNetwork.start();
      
      // 连接到对等节点
      for (const peer of this.peers) {
        await this.p2pNetwork.connectToPeer(peer);
      }
      
      // 启动HTTP服务器
      this.server = this.app.listen(this.port, () => {
        console.log(`🚀 区块链服务器启动成功`);
        console.log(`📡 HTTP服务: http://localhost:${this.port}`);
        console.log(`🔗 P2P端口: ${this.p2pPort}`);
        console.log(`👥 连接的节点数: ${this.p2pNetwork.getPeers().length}`);
        console.log(`⛏️  挖矿状态: ${this.miningManager.isMining ? '进行中' : '停止'}`);
      });
      
    } catch (error) {
      console.error('启动失败:', error);
      process.exit(1);
    }
  }

  async stop() {
    console.log('正在关闭服务器...');
    
    if (this.miningManager.isMining) {
      await this.miningManager.stopMining();
    }
    
    if (this.p2pNetwork) {
      await this.p2pNetwork.stop();
    }
    
    if (this.server) {
      this.server.close();
    }
    
    console.log('服务器已关闭');
  }
}

// 启动应用
const app = new BlockchainApp();
app.start();

// 优雅关闭
process.on('SIGINT', async () => {
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await app.stop();
  process.exit(0);
});

module.exports = BlockchainApp;