# My Blockchain

一个基于模拟比特币链的区块链项目，包含完整的挖矿、转账和区块浏览功能。

## 项目结构

```
my-blockchain/
├── server/                 # 后端服务器
│   ├── src/
│   │   ├── api/           # REST API 接口
│   │   ├── modules/       # 核心模块
│   │   │   ├── Block.js          # 区块模块
│   │   │   ├── Blockchain.js     # 区块链主逻辑
│   │   │   ├── MinerWallet.js    # 矿工钱包
│   │   │   ├── MiningManager.js  # 挖矿管理器
│   │   │   ├── P2PNetwork.js     # P2P 网络
│   │   │   ├── Transaction.js    # 交易处理
│   │   │   └── UTXOSet.js        # UTXO 集合管理
│   │   ├── utils/         # 工具类
│   │   └── app.js         # 应用入口
│   └── package.json
└── client/                # 前端客户端
    ├── src/
    │   ├── components/    # React 组件
    │   │   ├── BlockExplorer.tsx    # 区块浏览器
    │   │   ├── MinerTransfer.tsx    # 矿工转账
    │   │   ├── MiningManager.tsx    # 挖矿管理
    │   │   ├── NetworkStatus.tsx    # 网络状态
    │   │   ├── TransactionForm.tsx  # 交易表单
    │   │   └── WalletManager.tsx    # 钱包管理
    │   ├── services/      # 服务层
    │   │   ├── cosmosClient.ts      # Cosmos 客户端
    │   │   └── walletManager.ts     # 钱包管理服务
    │   └── types/         # TypeScript 类型定义
    └── package.json
```

## 启动方式

### 1. 启动后端服务器

```bash
# 进入服务器目录
cd server

# 安装依赖
npm install

# 启动开发模式 (默认端口 1317)
npm run dev

# 或启动生产模式
npm start

# 启动多节点网络
# 节点1 (端口 1317, P2P 端口 6001)
npm run start-node1

# 节点2 (端口 1318, P2P 端口 6002, 连接到节点1)
npm run start-node2
```

### 2. 启动前端客户端

```bash
# 进入客户端目录
cd client

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## API 接口说明

### 地址管理

- `POST /api/addresses/generate` - 生成新地址
- `GET /api/addresses/:address/balance` - 查询地址余额

### 区块查询

- `GET /api/blocks/all` - 获取所有区块
- `GET /api/blocks/:height` - 获取指定高度的区块

### 交易相关

- `POST /api/mining/miner/transfer` - 矿工转账
- `POST /api/transactions/client-transfer` - 客户端转账

### 挖矿管理

- `GET /api/mining/miner` - 获取矿工信息
- `POST /api/mining/start` - 开始挖矿
- `POST /api/mining/stop` - 停止挖矿
- `GET /api/mining/status` - 获取挖矿状态

## 功能特性

- **区块链核心功能**: 完整的区块链实现，支持 UTXO 模型
- **挖矿系统**: 可控的挖矿难度和奖励机制
- **P2P 网络**: 支持多节点网络通信和数据同步
- **交易处理**: 支持转账交易的创建、验证和广播
- **钱包管理**: 兼容 Cosmos SDK 的地址格式和签名
- **区块浏览器**: 实时查看区块和交易信息
- **响应式 UI**: 基于 React + TypeScript + Tailwind CSS

## 技术栈

### 后端

- Node.js
- Koa.js (Web 框架)
- WebSocket (P2P 通信)
- secp256k1 (加密签名)
- @cosmjs/* (Cosmos SDK 兼容)

### 前端

- React 19
- TypeScript
- Tailwind CSS
- Vite (构建工具)
- @cosmjs/* (Cosmos 客户端)

## 开发说明

1. 服务器默认运行在 `http://localhost:1317`
2. 客户端开发服务器默认运行在 `http://localhost:5173`
3. 支持热重载开发模式
4. 内置 ESLint 代码检查

## 许可证

MIT License
