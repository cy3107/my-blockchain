import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Play, 
  Square, 
  Settings, 
  TrendingUp, 
  Zap, 
  Clock, 
  Award,
  BarChart3,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { miningAPI } from '@/services/api';
import { MiningStatus, MiningStatistics } from '@/types/blockchain';
import toast from 'react-hot-toast';

const MiningManager: React.FC = () => {
  const [difficulty, setDifficulty] = useState<number>(2);
  const [reward, setReward] = useState<number>(50);
  const [showSettings, setShowSettings] = useState(false);
  const [hashRateHistory, setHashRateHistory] = useState<Array<{ time: string; hashRate: number }>>([]);
  
  const queryClient = useQueryClient();

  // 获取矿工信息
  const { data: minerInfo, isLoading: minerLoading } = useQuery({
    queryKey: ['miner-info'],
    queryFn: miningAPI.getMinerInfo,
    onError: (error) => {
      console.error('获取矿工信息失败:', error);
      toast.error('获取矿工信息失败');
    },
  });

  // 获取挖矿状态
  const { 
    data: miningStatusData, 
    isLoading: statusLoading,
    refetch: refetchStatus
  } = useQuery({
    queryKey: ['mining-status'],
    queryFn: miningAPI.getMiningStatus,
    refetchInterval: 3000, // 3秒刷新一次
    onError: (error) => {
      console.error('获取挖矿状态失败:', error);
    },
  });

  // 获取挖矿历史
  const { data: miningHistory } = useQuery({
    queryKey: ['mining-history', 1, 10],
    queryFn: () => miningAPI.getMiningHistory(1, 10),
    refetchInterval: 10000, // 10秒刷新一次
  });

  // 开始挖矿
  const startMiningMutation = useMutation({
    mutationFn: miningAPI.startMining,
    onSuccess: () => {
      toast.success('挖矿已启动');
      queryClient.invalidateQueries(['mining-status']);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '挖矿启动失败');
    },
  });

  // 停止挖矿
  const stopMiningMutation = useMutation({
    mutationFn: miningAPI.stopMining,
    onSuccess: () => {
      toast.success('挖矿已停止');
      queryClient.invalidateQueries(['mining-status']);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '挖矿停止失败');
    },
  });

  // 调整难度
  const setDifficultyMutation = useMutation({
    mutationFn: (newDifficulty: number) => miningAPI.setDifficulty(newDifficulty),
    onSuccess: () => {
      toast.success('挖矿难度已调整');
      queryClient.invalidateQueries(['mining-status']);
      setShowSettings(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '难度调整失败');
    },
  });

  // 调整奖励
  const setRewardMutation = useMutation({
    mutationFn: (newReward: number) => miningAPI.setReward(newReward),
    onSuccess: () => {
      toast.success('挖矿奖励已调整');
      queryClient.invalidateQueries(['mining-status']);
      setShowSettings(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '奖励调整失败');
    },
  });

  // 重置统计
  const resetStatsMutation = useMutation({
    mutationFn: miningAPI.resetStatistics,
    onSuccess: () => {
      toast.success('挖矿统计已重置');
      queryClient.invalidateQueries(['mining-status']);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '统计重置失败');
    },
  });

  // 更新算力历史数据
  useEffect(() => {
    if (miningStatusData?.data.statistics) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      
      setHashRateHistory(prev => {
        const newHistory = [...prev, {
          time: timeStr,
          hashRate: miningStatusData.data.statistics.hashRate || 0
        }];
        
        // 保持最近20个数据点
        return newHistory.slice(-20);
      });
    }
  }, [miningStatusData]);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatHashRate = (hashRate: number) => {
    if (hashRate >= 1000000) {
      return `${(hashRate / 1000000).toFixed(2)} MH/s`;
    } else if (hashRate >= 1000) {
      return `${(hashRate / 1000).toFixed(2)} KH/s`;
    }
    return `${hashRate.toFixed(2)} H/s`;
  };

  const isMining = miningStatusData?.data.status.isActive || false;
  const currentStatus = miningStatusData?.data.status;
  const currentStats = miningStatusData?.data.statistics;
  const efficiency = miningStatusData?.data.efficiency;
  const estimation = miningStatusData?.data.estimation;

  return (
    <div className="space-y-6">
      {/* 挖矿控制面板 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 矿工信息 */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">矿工信息</h3>
          </div>
          {minerLoading ? (
            <div className="flex justify-center py-4">
              <div className="loading-spinner" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label">矿工地址</label>
                <div className="code text-xs break-all">
                  {minerInfo?.data.address}
                </div>
              </div>
              <div>
                <label className="label">当前余额</label>
                <div className="text-2xl font-bold text-green-600">
                  {minerInfo?.data.balance || 0} ATOM
                </div>
              </div>
              <div>
                <label className="label">助记词</label>
                <div className="code text-xs break-all">
                  {minerInfo?.data.mnemonic}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 挖矿控制 */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">挖矿控制</h3>
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${
                isMining ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
              }`} />
              <span className="text-sm text-gray-600">
                {isMining ? '挖矿中' : '已停止'}
              </span>
            </div>
          </div>
          
          <div className="space-y-4">
            {statusLoading ? (
              <div className="flex justify-center py-4">
                <div className="loading-spinner" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">难度</label>
                    <div className="text-xl font-bold">
                      {currentStatus?.currentDifficulty || 0}
                    </div>
                  </div>
                  <div>
                    <label className="label">待处理交易</label>
                    <div className="text-xl font-bold text-orange-600">
                      {currentStatus?.pendingTransactions || 0}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">当前算力</label>
                    <div className="text-lg font-semibold text-blue-600">
                      {formatHashRate(currentStatus?.hashRate || 0)}
                    </div>
                  </div>
                  <div>
                    <label className="label">已挖区块</label>
                    <div className="text-lg font-semibold text-purple-600">
                      {currentStatus?.blocksMinedCount || 0}
                    </div>
                  </div>
                </div>

                {isMining && currentStatus?.uptime && (
                  <div>
                    <label className="label">运行时间</label>
                    <div className="text-lg font-semibold text-gray-700">
                      {formatUptime(currentStatus.uptime / 1000)}
                    </div>
                  </div>
                )}
              </>
            )}
            
            <div className="flex space-x-2">
              {isMining ? (
                <button
                  onClick={() => stopMiningMutation.mutate()}
                  disabled={stopMiningMutation.isLoading}
                  className="btn-error flex-1"
                >
                  <Square className="h-4 w-4 mr-2" />
                  {stopMiningMutation.isLoading ? '停止中...' : '停止挖矿'}
                </button>
              ) : (
                <button
                  onClick={() => startMiningMutation.mutate()}
                  disabled={startMiningMutation.isLoading || (currentStatus?.pendingTransactions || 0) === 0}
                  className="btn-success flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {startMiningMutation.isLoading ? '启动中...' : '开始挖矿'}
                </button>
              )}
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="btn-secondary"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>

            {(currentStatus?.pendingTransactions || 0) === 0 && !isMining && (
              <div className="alert-warning flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                没有待处理的交易，无法开始挖矿
              </div>
            )}
          </div>
        </div>

        {/* 挖矿统计 */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">挖矿统计</h3>
            <button
              onClick={() => resetStatsMutation.mutate()}
              disabled={resetStatsMutation.isLoading}
              className="btn-ghost text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              重置
            </button>
          </div>
          
          {currentStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">平均算力</label>
                  <div className="text-lg font-semibold text-blue-600">
                    {formatHashRate(currentStats.hashRate)}
                  </div>
                </div>
                <div>
                  <label className="label">平均出块时间</label>
                  <div className="text-lg font-semibold text-green-600">
                    {currentStats.averageBlockTime.toFixed(1)}s
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">总哈希数</label>
                  <div className="text-sm font-semibold text-purple-600">
                    {currentStats.totalHashesComputed.toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="label">挖矿奖励</label>
                  <div className="text-sm font-semibold text-orange-600">
                    {currentStats.miningReward} ATOM
                  </div>
                </div>
              </div>

              {efficiency && (
                <div>
                  <label className="label">预估日收益</label>
                  <div className="text-lg font-bold text-green-600">
                    {efficiency.profitability.estimatedDailyRewards.toFixed(2)} ATOM
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">挖矿设置</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">挖矿难度 (1-10)</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={difficulty}
                  onChange={(e) => setDifficulty(parseInt(e.target.value))}
                  className="input flex-1"
                />
                <button
                  onClick={() => setDifficultyMutation.mutate(difficulty)}
                  disabled={setDifficultyMutation.isLoading}
                  className="btn-primary"
                >
                  设置
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                当前难度: {currentStatus?.currentDifficulty || 0}
              </p>
            </div>
            
            <div>
              <label className="label">挖矿奖励 (ATOM)</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={reward}
                  onChange={(e) => setReward(parseFloat(e.target.value))}
                  className="input flex-1"
                />
                <button
                  onClick={() => setRewardMutation.mutate(reward)}
                  disabled={setRewardMutation.isLoading}
                  className="btn-primary"
                >
                  设置
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                当前奖励: {currentStats?.miningReward || 0} ATOM
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 算力走势图 */}
      {hashRateHistory.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">算力走势</h3>
            <span className="text-sm text-gray-500">实时算力变化</span>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hashRateHistory}>
                <defs>
                  <linearGradient id="hashRateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(value) => formatHashRate(value)}
                />
                <Tooltip 
                  formatter={(value: any) => [formatHashRate(value), '算力']}
                  labelStyle={{ color: '#374151' }}
                />
                <Area
                  type="monotone"
                  dataKey="hashRate"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#hashRateGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 挖矿历史 */}
      {miningHistory?.data.history && miningHistory.data.history.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">最近挖出的区块</h3>
            <div className="text-sm text-gray-500">
              总计挖出 {miningHistory.data.statistics.totalBlocksMined} 个区块，
              获得 {miningHistory.data.statistics.totalRewards} ATOM
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>区块高度</th>
                  <th>挖出时间</th>
                  <th>奖励</th>
                  <th>难度</th>
                  <th>随机数</th>
                </tr>
              </thead>
              <tbody>
                {miningHistory.data.history.map((record: any, index: number) => (
                  <tr key={index}>
                    <td className="font-mono font-semibold text-primary-600">
                      #{record.blockHeight}
                    </td>
                    <td className="text-gray-600">
                      {new Date(record.timestamp).toLocaleString()}
                    </td>
                    <td className="font-semibold text-green-600">
                      {record.reward} ATOM
                    </td>
                    <td className="text-gray-600">
                      {record.difficulty}
                    </td>
                    <td className="font-mono text-sm text-gray-500">
                      {record.nonce.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MiningManager;