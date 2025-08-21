const WebSocket = require('ws');
const EventEmitter = require('events');
const { Block } = require('./Block');
const { Transaction } = require('./Transaction');

class P2PNetwork extends EventEmitter {
  constructor(port, blockchain) {
    super();
    this.port = port;
    this.blockchain = blockchain;
    this.server = null;
    this.peers = new Map(); // 连接的对等节点
    this.messageTypes = {
      REQUEST_CHAIN: 'REQUEST_CHAIN',
      RECEIVE_CHAIN: 'RECEIVE_CHAIN',
      REQUEST_LATEST_BLOCK: 'REQUEST_LATEST_BLOCK',
      RECEIVE_LATEST_BLOCK: 'RECEIVE_LATEST_BLOCK',
      NEW_TRANSACTION: 'NEW_TRANSACTION',
      NEW_BLOCK: 'NEW_BLOCK',
      PEER_HANDSHAKE: 'PEER_HANDSHAKE',
      PING: 'PING',
      PONG: 'PONG'
    };
  }

  /**
   * 启动P2P服务器
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = new WebSocket.Server({ port: this.port });
      
      this.server.on('connection', (ws, req) => {
        const clientIP = req.socket.remoteAddress;
        console.log(`新的P2P连接: ${clientIP}`);
        
        this.handleConnection(ws, clientIP);
      });
      
      this.server.on('listening', () => {
        console.log(`P2P服务器启动，端口: ${this.port}`);
        resolve();
      });
      
      this.server.on('error', (error) => {
        console.error('P2P服务器错误:', error);
        reject(error);
      });
    });
  }

  /**
   * 停止P2P服务器
   */
  async stop() {
    return new Promise((resolve) => {
      // 关闭所有对等连接
      for (const [peerId, peer] of this.peers) {
        peer.ws.terminate();
      }
      this.peers.clear();
      
      // 关闭服务器
      if (this.server) {
        this.server.close(() => {
          console.log('P2P服务器已关闭');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 连接到对等节点
   */
  async connectToPeer(peerUrl) {
    try {
      const ws = new WebSocket(peerUrl);
      
      ws.on('open', () => {
        console.log(`连接到对等节点: ${peerUrl}`);
        this.handleConnection(ws, peerUrl);
        
        // 发送握手消息
        this.sendHandshake(ws);
      });
      
      ws.on('error', (error) => {
        console.error(`连接对等节点失败 ${peerUrl}:`, error.message);
      });
      
    } catch (error) {
      console.error(`连接错误:`, error);
    }
  }

  /**
   * 处理WebSocket连接
   */
  handleConnection(ws, peerId) {
    const peer = {
      id: peerId,
      ws: ws,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      chainHeight: 0
    };
    
    this.peers.set(peerId, peer);
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(peer, message);
      } catch (error) {
        console.error('解析P2P消息错误:', error);
      }
    });
    
    ws.on('close', () => {
      console.log(`对等节点断开连接: ${peerId}`);
      this.peers.delete(peerId);
    });
    
    ws.on('error', (error) => {
      console.error(`对等节点错误 ${peerId}:`, error);
    });
    
    // 启动心跳检测
    this.startHeartbeat(peer);
  }

  /**
   * 处理收到的消息
   */
  async handleMessage(peer, message) {
    const { type, data } = message;
    
    switch (type) {
      case this.messageTypes.PEER_HANDSHAKE:
        await this.handleHandshake(peer, data);
        break;
        
      case this.messageTypes.REQUEST_CHAIN:
        this.sendChain(peer);
        break;
        
      case this.messageTypes.RECEIVE_CHAIN:
        await this.handleReceiveChain(data);
        break;
        
      case this.messageTypes.REQUEST_LATEST_BLOCK:
        this.sendLatestBlock(peer);
        break;
        
      case this.messageTypes.RECEIVE_LATEST_BLOCK:
        await this.handleReceiveLatestBlock(data);
        break;
        
      case this.messageTypes.NEW_TRANSACTION:
        await this.handleNewTransaction(data);
        break;
        
      case this.messageTypes.NEW_BLOCK:
        await this.handleNewBlock(data);
        break;
        
      case this.messageTypes.PING:
        this.sendToPeer(peer, this.messageTypes.PONG, { timestamp: Date.now() });
        break;
        
      case this.messageTypes.PONG:
        peer.lastPing = Date.now();
        break;
        
      default:
        console.log(`未知消息类型: ${type}`);
    }
  }

  /**
   * 处理握手消息
   */
  async handleHandshake(peer, data) {
    peer.chainHeight = data.chainHeight;
    peer.nodeInfo = data.nodeInfo;
    
    console.log(`揥手成功: ${peer.id}, 链高度: ${data.chainHeight}`);
    
    // 如果对方链更长，请求同步
    if (data.chainHeight > this.blockchain.getLatestBlock().index) {
      this.requestChain(peer);
    }
  }

  /**
   * 处理接收到的区块链
   */
  async handleReceiveChain(chainData) {
    try {
      const receivedChain = chainData.map(blockData => Block.fromJSON(blockData));
      
      if (this.blockchain.replaceChain(receivedChain)) {
        console.log('区块链已更新');
        this.emit('chainUpdated', { newChain: receivedChain });
      }
    } catch (error) {
      console.error('处理接收链错误:', error);
    }
  }

  /**
   * 处理接收到的最新区块
   */
  async handleReceiveLatestBlock(blockData) {
    try {
      const receivedBlock = Block.fromJSON(blockData);
      const latestBlock = this.blockchain.getLatestBlock();
      
      // 检查是否是下一个区块
      if (receivedBlock.index === latestBlock.index + 1 && 
          receivedBlock.previousHash === latestBlock.hash) {
        
        if (this.blockchain.isValidNewBlock(receivedBlock, latestBlock)) {
          this.blockchain.chain.push(receivedBlock);
          
          // 更新UTXO集合
          for (const tx of receivedBlock.transactions) {
            this.blockchain.utxoSet.processTransaction(tx);
          }
          
          console.log(`接收到新区块 #${receivedBlock.index}`);
          this.emit('blockReceived', { block: receivedBlock });
        }
      } else {
        // 如果不是直接的下一个区块，请求完整链
        this.broadcastMessage(this.messageTypes.REQUEST_CHAIN, {});
      }
    } catch (error) {
      console.error('处理最新区块错误:', error);
    }
  }

  /**
   * 处理新交易
   */
  async handleNewTransaction(transactionData) {
    try {
      const transaction = Transaction.fromJSON(transactionData);
      
      // 验证交易并添加到待处理队列
      if (transaction.isValid() && this.blockchain.utxoSet.canProcessTransaction(transaction)) {
        this.blockchain.addTransaction(transaction);
        console.log(`接收到新交易: ${transaction.txId}`);
        
        // 转发给其他节点
        this.broadcastMessage(this.messageTypes.NEW_TRANSACTION, transactionData, transaction.txId);
      }
    } catch (error) {
      console.error('处理新交易错误:', error);
    }
  }

  /**
   * 处理新区块
   */
  async handleNewBlock(blockData) {
    try {
      const newBlock = Block.fromJSON(blockData);
      const latestBlock = this.blockchain.getLatestBlock();
      
      if (this.blockchain.isValidNewBlock(newBlock, latestBlock)) {
        this.blockchain.chain.push(newBlock);
        
        // 更新UTXO集合
        for (const tx of newBlock.transactions) {
          this.blockchain.utxoSet.processTransaction(tx);
        }
        
        console.log(`接收到新挖出区块 #${newBlock.index}`);
        this.emit('blockReceived', { block: newBlock });
        
        // 转发给其他节点
        this.broadcastMessage(this.messageTypes.NEW_BLOCK, blockData, newBlock.hash);
      }
    } catch (error) {
      console.error('处理新区块错误:', error);
    }
  }

  /**
   * 发送握手消息
   */
  sendHandshake(ws) {
    const handshakeData = {
      chainHeight: this.blockchain.getLatestBlock().index,
      nodeInfo: {
        version: '1.0.0',
        name: 'My Blockchain Node',
        port: this.port
      }
    };
    
    this.sendMessage(ws, this.messageTypes.PEER_HANDSHAKE, handshakeData);
  }

  /**
   * 请求区块链
   */
  requestChain(peer) {
    this.sendToPeer(peer, this.messageTypes.REQUEST_CHAIN, {});
  }

  /**
   * 发送区块链
   */
  sendChain(peer) {
    const chainData = this.blockchain.chain.map(block => block.toJSON());
    this.sendToPeer(peer, this.messageTypes.RECEIVE_CHAIN, chainData);
  }

  /**
   * 发送最新区块
   */
  sendLatestBlock(peer) {
    const latestBlock = this.blockchain.getLatestBlock();
    this.sendToPeer(peer, this.messageTypes.RECEIVE_LATEST_BLOCK, latestBlock.toJSON());
  }

  /**
   * 广播交易
   */
  broadcastTransaction(transaction) {
    this.broadcastMessage(this.messageTypes.NEW_TRANSACTION, transaction.toJSON(), transaction.txId);
  }

  /**
   * 广播新区块
   */
  broadcastBlock(block) {
    this.broadcastMessage(this.messageTypes.NEW_BLOCK, block.toJSON(), block.hash);
  }

  /**
   * 广播消息到所有对等节点
   */
  broadcastMessage(type, data, excludeId = null) {
    for (const [peerId, peer] of this.peers) {
      if (excludeId && peerId === excludeId) continue;
      
      if (peer.ws.readyState === WebSocket.OPEN) {
        this.sendToPeer(peer, type, data);
      }
    }
  }

  /**
   * 发送消息到特定对等节点
   */
  sendToPeer(peer, type, data) {
    if (peer.ws.readyState === WebSocket.OPEN) {
      this.sendMessage(peer.ws, type, data);
    }
  }

  /**
   * 发送消息
   */
  sendMessage(ws, type, data) {
    try {
      const message = JSON.stringify({ type, data, timestamp: Date.now() });
      ws.send(message);
    } catch (error) {
      console.error('发送消息错误:', error);
    }
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat(peer) {
    const heartbeatInterval = setInterval(() => {
      if (peer.ws.readyState === WebSocket.OPEN) {
        // 检查上次ping时间
        const timeSinceLastPing = Date.now() - peer.lastPing;
        
        if (timeSinceLastPing > 60000) { // 60秒超时
          console.log(`对等节点 ${peer.id} 心跳超时，关闭连接`);
          peer.ws.terminate();
          clearInterval(heartbeatInterval);
        } else {
          // 发送ping
          this.sendToPeer(peer, this.messageTypes.PING, { timestamp: Date.now() });
        }
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // 每30秒ping一次
  }

  /**
   * 获取对等节点列表
   */
  getPeers() {
    return Array.from(this.peers.values()).map(peer => ({
      id: peer.id,
      connectedAt: peer.connectedAt,
      chainHeight: peer.chainHeight,
      nodeInfo: peer.nodeInfo,
      lastPing: peer.lastPing,
      isActive: peer.ws.readyState === WebSocket.OPEN
    }));
  }

  /**
   * 获取网络统计
   */
  getNetworkStatistics() {
    const activePeers = this.getPeers().filter(peer => peer.isActive);
    const totalPeers = this.peers.size;
    
    return {
      totalPeers,
      activePeers: activePeers.length,
      port: this.port,
      isServerRunning: this.server !== null,
      averageChainHeight: activePeers.length > 0 ? 
        activePeers.reduce((sum, peer) => sum + peer.chainHeight, 0) / activePeers.length : 0,
      networkHealth: activePeers.length > 0 ? 'healthy' : 'isolated'
    };
  }

  /**
   * 同步区块链
   */
  async synchronizeBlockchain() {
    if (this.peers.size === 0) {
      console.log('没有对等节点，无法同步');
      return;
    }

    console.log('开始同步区块链...');
    
    // 找到链高度最高的对等节点
    let highestPeer = null;
    let highestHeight = this.blockchain.getLatestBlock().index;
    
    for (const peer of this.peers.values()) {
      if (peer.chainHeight > highestHeight) {
        highestHeight = peer.chainHeight;
        highestPeer = peer;
      }
    }
    
    if (highestPeer) {
      console.log(`从对等节点 ${highestPeer.id} 请求同步，高度: ${highestHeight}`);
      this.requestChain(highestPeer);
    } else {
      console.log('当前节点已是最新状态');
    }
  }

  /**
   * 断开所有连接
   */
  disconnectAll() {
    for (const [peerId, peer] of this.peers) {
      peer.ws.close();
    }
    this.peers.clear();
    console.log('已断开所有对等节点连接');
  }

  /**
   * 销毁P2P网络
   */
  destroy() {
    this.disconnectAll();
    if (this.server) {
      this.server.close();
    }
    this.removeAllListeners();
    console.log('P2P网络已销毁');
  }
}

module.exports = { P2PNetwork };