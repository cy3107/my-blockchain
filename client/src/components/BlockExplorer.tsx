import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  Clock, 
  Hash, 
  Users, 
  Coins,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  TrendingUp
} from 'lucide-react';
import { blockAPI, transactionAPI } from '@/services/api';
import { Block, Transaction } from '@/types/blockchain';
import toast from 'react-hot-toast';

const BlockExplorer: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const pageSize = 10;

  // 获取区块列表
  const { 
    data: blocksData, 
    isLoading: blocksLoading, 
    error: blocksError,
    refetch: refetchBlocks
  } = useQuery({
    queryKey: ['blocks', currentPage, pageSize],
    queryFn: () => blockAPI.getAllBlocks(currentPage, pageSize),
    refetchInterval: 10000, // 10秒刷新一次
    onError: (error) => {
      console.error('获取区块列表失败:', error);
      toast.error('获取区块列表失败');
    },
  });

  // 获取区块链统计信息
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['blockchain-stats'],
    queryFn: blockAPI.getStatistics,
    refetchInterval: 15000, // 15秒刷新一次
  });

  // 获取交易统计信息
  const { data: txStatsData } = useQuery({
    queryKey: ['transaction-stats'],
    queryFn: transactionAPI.getStatistics,
    refetchInterval: 15000,
  });

  // 搜索功能
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('请输入搜索内容');
      return;
    }

    try {
      // 尝试按高度搜索
      if (/^\d+$/.test(searchQuery)) {
        const height = parseInt(searchQuery);
        const response = await blockAPI.getBlockByHeight(height);
        if (response.success) {
          setSelectedBlock(response.data);
          return;
        }
      }

      // 尝试按哈希搜索
      if (searchQuery.length === 64) {
        const response = await blockAPI.getBlockByHash(searchQuery);
        if (response.success) {
          setSelectedBlock(response.data);
          return;
        }
      }

      // 尝试搜索交易
      const txResponse = await transactionAPI.getTransactionById(searchQuery);
      if (txResponse.success) {
        toast.success('找到交易，正在跳转到相关区块');
        if (txResponse.data.blockHeight !== null) {
          const blockResponse = await blockAPI.getBlockByHeight(txResponse.data.blockHeight);
          if (blockResponse.success) {
            setSelectedBlock(blockResponse.data);
          }
        }
        return;
      }

      toast.error('未找到相关区块或交易');
    } catch (error) {
      console.error('搜索失败:', error);
      toast.error('搜索失败');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatHash = (hash: string, length = 10) => {
    return `${hash.slice(0, length)}...${hash.slice(-length)}`;
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'coinbase':
        return 'bg-success-100 text-success-800';
      case 'transfer':
        return 'bg-primary-100 text-primary-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const BlockDetailsModal = ({ block, onClose }: { block: Block; onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              区块详情 #{block.index}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="label">区块高度</label>
                <div className="code">{block.index}</div>
              </div>
              <div>
                <label className="label">区块哈希</label>
                <div className="code text-xs break-all">{block.hash}</div>
              </div>
              <div>
                <label className="label">前一个区块哈希</label>
                <div className="code text-xs break-all">{block.previousHash}</div>
              </div>
              <div>
                <label className="label">默克尔根</label>
                <div className="code text-xs break-all">{block.merkleRoot}</div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="label">时间戳</label>
                <div className="code">{formatTimestamp(block.timestamp)}</div>
              </div>
              <div>
                <label className="label">随机数 (Nonce)</label>
                <div className="code">{block.nonce.toLocaleString()}</div>
              </div>
              <div>
                <label className="label">难度</label>
                <div className="code">{block.difficulty}</div>
              </div>
              <div>
                <label className="label">区块大小</label>
                <div className="code">{block.size} 字节</div>
              </div>
            </div>
          </div>

          {/* 交易列表 */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              交易列表 ({block.transactions.length})
            </h4>
            {block.transactions.length > 0 ? (
              <div className="space-y-3">
                {block.transactions.map((tx, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`badge ${getTransactionTypeColor(tx.type)}`}>
                        {tx.type === 'coinbase' ? '挖矿奖励' : '转账'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatTimestamp(tx.timestamp)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">发送方:</span>
                        <div className="font-mono text-xs break-all">
                          {tx.fromAddress || '系统奖励'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">接收方:</span>
                        <div className="font-mono text-xs break-all">{tx.toAddress}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">金额:</span>
                        <div className="font-semibold text-green-600">
                          {tx.amount} ATOM
                          {tx.fee > 0 && (
                            <span className="text-gray-500 ml-2">
                              (+{tx.fee} 手续费)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                此区块中没有交易
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stats-card">
          <div className="flex items-center">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Hash className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <div className="stats-value">
                {statsLoading ? '-' : statsData?.data.height || 0}
              </div>
              <div className="stats-label">区块高度</div>
            </div>
          </div>
        </div>

        <div className="stats-card">
          <div className="flex items-center">
            <div className="p-3 bg-success-100 rounded-lg">
              <Coins className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-4">
              <div className="stats-value">
                {statsLoading ? '-' : Math.round(statsData?.data.totalSupply || 0)}
              </div>
              <div className="stats-label">总供应量</div>
            </div>
          </div>
        </div>

        <div className="stats-card">
          <div className="flex items-center">
            <div className="p-3 bg-warning-100 rounded-lg">
              <Users className="h-6 w-6 text-warning-600" />
            </div>
            <div className="ml-4">
              <div className="stats-value">
                {txStatsData?.data.confirmed.totalTransactions || 0}
              </div>
              <div className="stats-label">总交易数</div>
            </div>
          </div>
        </div>

        <div className="stats-card">
          <div className="flex items-center">
            <div className="p-3 bg-error-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-error-600" />
            </div>
            <div className="ml-4">
              <div className="stats-value">
                {statsLoading ? '-' : statsData?.data.difficulty || 0}
              </div>
              <div className="stats-label">挖矿难度</div>
            </div>
          </div>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="card">
        <div className="flex space-x-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索区块高度、区块哈希或交易ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="input"
            />
          </div>
          <button onClick={handleSearch} className="btn-primary">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 区块列表 */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">最新区块</h3>
          <button
            onClick={() => refetchBlocks()}
            className="btn-secondary"
            disabled={blocksLoading}
          >
            {blocksLoading ? '刷新中...' : '刷新'}
          </button>
        </div>

        {blocksError ? (
          <div className="alert-error">
            加载区块数据失败，请检查网络连接
          </div>
        ) : blocksLoading ? (
          <div className="flex justify-center py-8">
            <div className="loading-spinner" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>高度</th>
                    <th>时间</th>
                    <th>哈希</th>
                    <th>交易数</th>
                    <th>大小</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {blocksData?.data.blocks.map((block) => (
                    <tr key={block.index}>
                      <td className="font-mono font-semibold text-primary-600">
                        #{block.index}
                      </td>
                      <td className="text-gray-600">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatTimestamp(block.timestamp)}
                        </div>
                      </td>
                      <td className="font-mono text-sm">
                        {formatHash(block.hash)}
                      </td>
                      <td>
                        <span className="badge-primary">
                          {block.transactionCount}
                        </span>
                      </td>
                      <td className="text-gray-600">
                        {block.size} B
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedBlock(block)}
                          className="text-primary-600 hover:text-primary-800 flex items-center"
                        >
                          <Info className="h-4 w-4 mr-1" />
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {blocksData?.data.pagination && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  显示 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, blocksData.data.pagination.total)} 条，
                  共 {blocksData.data.pagination.total} 条
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="btn-secondary disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {blocksData.data.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage >= blocksData.data.pagination.totalPages}
                    className="btn-secondary disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 区块详情模态框 */}
      {selectedBlock && (
        <BlockDetailsModal
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
        />
      )}
    </div>
  );
};

export default BlockExplorer;