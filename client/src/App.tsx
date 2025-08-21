import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Blocks, 
  Pickaxe, 
  Send, 
  Wallet, 
  Network, 
  BarChart3,
  Menu,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { systemAPI } from '@/services/api';
import BlockExplorer from '@/components/BlockExplorer';
import MiningManager from '@/components/MiningManager';
import TransactionForm from '@/components/TransactionForm';
import WalletManager from '@/components/WalletManager';
import NetworkStatus from '@/components/NetworkStatus';
import MinerTransfer from '@/components/MinerTransfer';

type TabType = 'blocks' | 'mining' | 'transactions' | 'wallets' | 'network' | 'miner-transfer';

interface Tab {
  id: TabType;
  name: string;
  icon: React.ElementType;
  description: string;
}

const tabs: Tab[] = [
  {
    id: 'blocks',
    name: '区块浏览器',
    icon: Blocks,
    description: '查看区块链中的所有区块和交易',
  },
  {
    id: 'mining',
    name: '挖矿管理',
    icon: Pickaxe,
    description: '管理挖矿操作和查看挖矿统计',
  },
  {
    id: 'transactions',
    name: '发送交易',
    icon: Send,
    description: '创建和发送新的交易',
  },
  {
    id: 'wallets',
    name: '钱包管理',
    icon: Wallet,
    description: '管理您的数字钱包和地址',
  },
  {
    id: 'miner-transfer',
    name: '矿工转账',
    icon: BarChart3,
    description: '使用矿工钱包进行转账',
  },
  {
    id: 'network',
    name: '网络状态',
    icon: Network,
    description: '查看网络连接和节点信息',
  },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('blocks');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 获取系统健康状态
  const { data: healthData, isError: healthError } = useQuery({
    queryKey: ['health'],
    queryFn: systemAPI.getHealth,
    refetchInterval: 30000, // 30秒刷新一次
    retry: 1,
    onError: () => {
      toast.error('无法连接到区块链节点');
    },
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'blocks':
        return <BlockExplorer />;
      case 'mining':
        return <MiningManager />;
      case 'transactions':
        return <TransactionForm />;
      case 'wallets':
        return <WalletManager />;
      case 'network':
        return <NetworkStatus />;
      case 'miner-transfer':
        return <MinerTransfer />;
      default:
        return <BlockExplorer />;
    }
  };

  const currentTab = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo和标题 */}
            <div className="flex items-center">
              <button
                className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div className="flex items-center ml-2 md:ml-0">
                <div className="h-8 w-8 bg-gradient-to-r from-primary-600 to-primary-800 rounded-lg flex items-center justify-center">
                  <Blocks className="h-5 w-5 text-white" />
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-bold text-gray-900">My Blockchain</h1>
                  <p className="text-xs text-gray-500">区块链管理平台</p>
                </div>
              </div>
            </div>

            {/* 系统状态 */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${
                  healthError 
                    ? 'bg-error-500' 
                    : healthData?.status === 'OK' 
                    ? 'bg-success-500 animate-pulse' 
                    : 'bg-warning-500'
                }`} />
                <span className="text-sm text-gray-600">
                  {healthError 
                    ? '连接失败' 
                    : healthData?.status === 'OK' 
                    ? '在线' 
                    : '连接中'}
                </span>
              </div>
              
              {healthData && (
                <div className="hidden sm:flex items-center space-x-4 text-sm text-gray-600">
                  <span>区块高度: {healthData.blockchain.height}</span>
                  <span>难度: {healthData.blockchain.difficulty}</span>
                  <span>矿工: {healthData.mining.isActive ? '活跃' : '非活跃'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 侧边栏 */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-sm border-r border-gray-200 transform transition-transform duration-300 ease-in-out mt-16
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:mt-0
        `}>
          <nav className="h-full px-4 py-6 overflow-y-auto">
            <div className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSidebarOpen(false); // 移动端点击后关闭侧边栏
                    }}
                    className={`
                      w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                      ${isActive
                        ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 mr-3 ${
                      isActive ? 'text-primary-600' : 'text-gray-400'
                    }`} />
                    <div className="text-left">
                      <div className="font-medium">{tab.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {tab.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 md:ml-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* 页面标题 */}
            <div className="mb-8">
              <div className="flex items-center">
                {currentTab && (
                  <>
                    <currentTab.icon className="h-6 w-6 text-primary-600 mr-3" />
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {currentTab.name}
                      </h2>
                      <p className="text-gray-600 mt-1">
                        {currentTab.description}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 组件内容 */}
            <div className="animate-fade-in">
              {renderTabContent()}
            </div>
          </div>
        </main>
      </div>

      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default App;