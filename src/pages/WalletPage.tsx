// ============================================
// WALLET PAGE — Premium Jewellery eCommerce
// Full wallet dashboard with balance, transactions,
// rewards, gift cards, and refunds
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import { Button } from '@/components/ui/button';
import {
  Wallet as WalletIcon, ArrowLeft, ArrowUpRight, ArrowDownLeft, Clock, Gift,
  Star, Trophy, ChevronRight, CreditCard, RefreshCcw, Shield, AlertCircle,
  TrendingUp, Coins, Sparkles, Eye, EyeOff, Copy, Check, Search,
  Filter, Calendar, Download, ChevronDown, Loader2, IndianRupee, Zap,
  Award, Target, Crown, Diamond,
} from 'lucide-react';
import {
  initializeWallet,
  subscribeToWallet,
  subscribeToTransactions,
  getRewardSummary,
  redeemPoints,
  redeemGiftCard,
  getPaymentMethods,
} from '@/services/walletService';
import type {
  Wallet,
  WalletTransaction,
  RewardSummary,
  PaymentMethod,
  TransactionType,
} from '@/types/wallet';

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile, loading: authLoading } = useAuth();

  // State
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [rewards, setRewards] = useState<RewardSummary | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'rewards' | 'gift-cards'>('overview');
  const [showBalance, setShowBalance] = useState(true);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [redeemingGiftCard, setRedeemingGiftCard] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');
  const [txFilter, setTxFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [redeemingPoints, setRedeemingPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Initialize wallet and subscriptions
  useEffect(() => {
    if (!user) return;

    let unsubWallet: (() => void) | undefined;
    let unsubTx: (() => void) | undefined;

    const init = async () => {
      try {
        await initializeWallet(user.uid);

        unsubWallet = subscribeToWallet(user.uid, (w) => {
          setWallet(w);
          setLoading(false);
        });

        unsubTx = subscribeToTransactions(user.uid, 50, (txs) => {
          setTransactions(txs);
        });

        const rewardData = await getRewardSummary(user.uid);
        setRewards(rewardData);

        const methods = await getPaymentMethods(user.uid);
        setPaymentMethods(methods);
      } catch (error) {
        console.error('Wallet init error:', error);
        setLoading(false);
      }
    };

    init();
    return () => {
      unsubWallet?.();
      unsubTx?.();
    };
  }, [user]);

  // Handlers
  const handleRedeemGiftCard = async () => {
    if (!user || !giftCardCode.trim()) return;
    setRedeemingGiftCard(true);
    setRedeemError('');
    setRedeemSuccess('');
    try {
      const tx = await redeemGiftCard(user.uid, giftCardCode.trim());
      setRedeemSuccess(`Gift card redeemed! ₹${tx.amount.toLocaleString()} added to your wallet.`);
      setGiftCardCode('');
    } catch (err: any) {
      setRedeemError(err.message || 'Failed to redeem gift card');
    } finally {
      setRedeemingGiftCard(false);
    }
  };

  const handleRedeemPoints = async () => {
    if (!user || !pointsToRedeem) return;
    const pts = parseInt(pointsToRedeem);
    if (isNaN(pts) || pts < 100) {
      setRedeemError('Minimum 100 points required');
      return;
    }
    setRedeemingPoints(true);
    setRedeemError('');
    setRedeemSuccess('');
    try {
      const tx = await redeemPoints(user.uid, pts);
      setRedeemSuccess(`${pts} points redeemed! ₹${tx.amount.toLocaleString()} added.`);
      setPointsToRedeem('');
      // Refresh rewards
      const updated = await getRewardSummary(user.uid);
      setRewards(updated);
    } catch (err: any) {
      setRedeemError(err.message || 'Failed to redeem points');
    } finally {
      setRedeemingPoints(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (txFilter === 'all') return true;
    return tx.type === txFilter;
  });

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'from-amber-600 to-amber-800';
      case 'silver': return 'from-gray-400 to-gray-600';
      case 'gold': return 'from-yellow-400 to-yellow-600';
      case 'platinum': return 'from-purple-400 to-purple-700';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'bronze': return <Award className="w-5 h-5" />;
      case 'silver': return <Star className="w-5 h-5" />;
      case 'gold': return <Crown className="w-5 h-5" />;
      case 'platinum': return <Diamond className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading wallet...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/account');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="hidden lg:block"><Header /></div>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">My Wallet</h1>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10 pb-24 lg:pb-10">
        {/* ─── WALLET CARD ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 lg:p-8 text-white shadow-xl mb-6 relative overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <WalletIcon className="w-6 h-6" />
                <span className="text-sm font-medium text-blue-100">Sree Rasthu Wallet</span>
              </div>
              <button onClick={() => setShowBalance(!showBalance)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-blue-200 mb-1">Available Balance</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl lg:text-5xl font-bold">
                  {showBalance ? `₹${(wallet?.balance.available || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹••••••'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <p className="text-xs text-blue-200 mb-1">Pending</p>
                <p className="text-sm font-semibold">
                  {showBalance ? `₹${(wallet?.balance.pending || 0).toLocaleString()}` : '••••'}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <p className="text-xs text-blue-200 mb-1">Total Earned</p>
                <p className="text-sm font-semibold">
                  {showBalance ? `₹${(wallet?.balance.totalEarned || 0).toLocaleString()}` : '••••'}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <p className="text-xs text-blue-200 mb-1">Total Spent</p>
                <p className="text-sm font-semibold">
                  {showBalance ? `₹${(wallet?.balance.totalSpent || 0).toLocaleString()}` : '••••'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── QUICK ACTIONS ──────────────────── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: <ArrowDownLeft className="w-5 h-5" />, label: 'Add Money', color: 'bg-green-50 text-green-600', action: () => setActiveTab('gift-cards') },
            { icon: <ArrowUpRight className="w-5 h-5" />, label: 'History', color: 'bg-blue-50 text-blue-600', action: () => setActiveTab('transactions') },
            { icon: <Star className="w-5 h-5" />, label: 'Rewards', color: 'bg-amber-50 text-amber-600', action: () => setActiveTab('rewards') },
            { icon: <Gift className="w-5 h-5" />, label: 'Gift Card', color: 'bg-purple-50 text-purple-600', action: () => setActiveTab('gift-cards') },
          ].map((item, idx) => (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.95 }}
              onClick={item.action}
              className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 ${item.color} rounded-full flex items-center justify-center`}>
                {item.icon}
              </div>
              <span className="text-xs font-medium text-gray-700">{item.label}</span>
            </motion.button>
          ))}
        </div>

        {/* ─── TAB NAVIGATION ─────────────────── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'transactions', label: 'Transactions' },
            { id: 'rewards', label: 'Rewards' },
            { id: 'gift-cards', label: 'Gift Cards' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── TAB CONTENT ────────────────────── */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Rewards Tier Card */}
              {rewards && (
                <div className={`bg-gradient-to-r ${getTierColor(rewards.tier)} rounded-2xl p-5 text-white mb-6 relative overflow-hidden`}>
                  <div className="absolute top-2 right-2 opacity-10">
                    <Trophy className="w-24 h-24" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      {getTierIcon(rewards.tier)}
                      <span className="text-sm font-semibold uppercase tracking-wider">{rewards.tier} Member</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl font-bold">{rewards.availablePoints.toLocaleString()}</span>
                      <span className="text-sm opacity-80">points</span>
                    </div>
                    {rewards.nextTierPoints > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs opacity-80 mb-1">
                          <span>Progress to next tier</span>
                          <span>{rewards.nextTierPoints.toLocaleString()} pts needed</span>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white/60 rounded-full transition-all"
                            style={{ width: `${Math.min(100, ((rewards.totalPoints / (rewards.totalPoints + rewards.nextTierPoints)) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
                  <button onClick={() => setActiveTab('transactions')} className="text-sm text-blue-600 font-medium flex items-center gap-1">
                    View All <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {transactions.slice(0, 5).length > 0 ? (
                    transactions.slice(0, 5).map((tx) => (
                      <TransactionItem key={tx.id} transaction={tx} formatDate={formatDate} formatTime={formatTime} />
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <WalletIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No transactions yet</p>
                      <p className="text-gray-400 text-xs mt-1">Your wallet transactions will appear here</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Security Notice */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Wallet Security</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Your wallet is protected with bank-grade encryption. All transactions are verified
                    server-side and cannot be tampered with. Suspicious activities are automatically flagged.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'transactions' && (
            <motion.div key="transactions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Filters */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'credit', label: 'Credits' },
                  { id: 'debit', label: 'Debits' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTxFilter(f.id as any)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      txFilter === f.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Transaction List */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="divide-y divide-gray-50">
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((tx) => (
                      <TransactionItem key={tx.id} transaction={tx} formatDate={formatDate} formatTime={formatTime} detailed />
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No {txFilter !== 'all' ? txFilter : ''} transactions found</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'rewards' && (
            <motion.div key="rewards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {rewards && (
                <>
                  {/* Points Summary */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Coins className="w-5 h-5 text-amber-500" />
                        <span className="text-sm text-gray-600">Available</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{rewards.availablePoints.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-1">points</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-gray-600">Total Earned</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{rewards.totalPoints.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-1">lifetime</p>
                    </div>
                  </div>

                  {/* Expiring Points Warning */}
                  {rewards.expiringPoints > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">
                          {rewards.expiringPoints.toLocaleString()} points expiring soon
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          Redeem before they expire to get wallet credit
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Redeem Points */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-1">Redeem Points</h3>
                    <p className="text-sm text-gray-500 mb-4">Convert your points to wallet credit. 100 points = ₹10</p>

                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          value={pointsToRedeem}
                          onChange={(e) => setPointsToRedeem(e.target.value)}
                          placeholder="Enter points (min 100)"
                          min={100}
                          max={rewards.availablePoints}
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <Button
                        onClick={handleRedeemPoints}
                        disabled={redeemingPoints || !pointsToRedeem}
                        className="px-6 bg-blue-600 hover:bg-blue-700 rounded-xl"
                      >
                        {redeemingPoints ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redeem'}
                      </Button>
                    </div>

                    {pointsToRedeem && parseInt(pointsToRedeem) >= 100 && (
                      <p className="text-sm text-green-600 mt-2">
                        You'll get ₹{((parseInt(pointsToRedeem) / 100) * 10).toLocaleString()} wallet credit
                      </p>
                    )}
                  </div>

                  {/* How Points Work */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-900 mb-4">How Rewards Work</h3>
                    <div className="space-y-4">
                      {[
                        { icon: <Zap className="w-5 h-5" />, title: 'Earn on every purchase', desc: 'Get 10 points per ₹100 spent', color: 'bg-blue-50 text-blue-600' },
                        { icon: <Target className="w-5 h-5" />, title: 'Tier multiplier', desc: 'Higher tiers earn points faster', color: 'bg-green-50 text-green-600' },
                        { icon: <Sparkles className="w-5 h-5" />, title: 'Bonus events', desc: 'Extra points on festivals & birthdays', color: 'bg-purple-50 text-purple-600' },
                        { icon: <IndianRupee className="w-5 h-5" />, title: 'Redeem anytime', desc: '100 points = ₹10 wallet credit', color: 'bg-amber-50 text-amber-600' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            {item.icon}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.title}</p>
                            <p className="text-xs text-gray-500">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'gift-cards' && (
            <motion.div key="gift-cards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Redeem Gift Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Gift className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Redeem Gift Card</h3>
                    <p className="text-sm text-gray-500">Enter your gift card code below</p>
                  </div>
                </div>

                {redeemError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                    <p className="text-sm text-red-600">{redeemError}</p>
                  </div>
                )}
                {redeemSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                    <p className="text-sm text-green-600">{redeemSuccess}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={giftCardCode}
                      onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                      placeholder="XXXX-XXXX-XXXX"
                      maxLength={16}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-mono tracking-wider focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none uppercase"
                    />
                  </div>
                  <Button
                    onClick={handleRedeemGiftCard}
                    disabled={redeemingGiftCard || !giftCardCode.trim()}
                    className="px-6 bg-purple-600 hover:bg-purple-700 rounded-xl"
                  >
                    {redeemingGiftCard ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
              </div>

              {/* Payment Methods (Razorpay Ready) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Payment Methods</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Coming Soon</span>
                </div>

                {paymentMethods.length > 0 ? (
                  <div className="space-y-3">
                    {paymentMethods.map((pm) => (
                      <div key={pm.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl">
                        <CreditCard className="w-5 h-5 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{pm.label}</p>
                          {pm.cardLast4 && <p className="text-xs text-gray-500">•••• {pm.cardLast4}</p>}
                        </div>
                        {pm.isDefault && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Default</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No payment methods saved</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Card and UPI payment options will be available when online payments are enabled
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="hidden lg:block"><Footer /></div>
      <div className="lg:hidden"><MobileBottomNav /></div>
    </div>
  );
};

// ─── TRANSACTION ITEM COMPONENT ──────────────

const TransactionItem: React.FC<{
  transaction: WalletTransaction;
  formatDate: (ts: any) => string;
  formatTime: (ts: any) => string;
  detailed?: boolean;
}> = ({ transaction, formatDate, formatTime, detailed }) => {
  const isCredit = transaction.type === 'credit';

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'refund': return <RefreshCcw className="w-4 h-4" />;
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'purchase': return <CreditCard className="w-4 h-4" />;
      case 'reward': return <Star className="w-4 h-4" />;
      case 'cashback': return <TrendingUp className="w-4 h-4" />;
      case 'gift_card': return <Gift className="w-4 h-4" />;
      default: return <WalletIcon className="w-4 h-4" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'refund': return 'bg-orange-50 text-orange-600';
      case 'admin': return 'bg-purple-50 text-purple-600';
      case 'purchase': return 'bg-red-50 text-red-600';
      case 'reward': return 'bg-amber-50 text-amber-600';
      case 'cashback': return 'bg-green-50 text-green-600';
      case 'gift_card': return 'bg-pink-50 text-pink-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getSourceColor(transaction.source)}`}>
        {getSourceIcon(transaction.source)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{transaction.description}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-500">{formatDate(transaction.createdAt)}</p>
          {detailed && <p className="text-xs text-gray-400">{formatTime(transaction.createdAt)}</p>}
        </div>
        {detailed && transaction.orderId && (
          <p className="text-xs text-blue-500 mt-0.5">Order #{transaction.orderId}</p>
        )}
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
          {isCredit ? '+' : '-'}₹{transaction.amount.toLocaleString()}
        </p>
        {detailed && (
          <p className="text-xs text-gray-400">Bal: ₹{transaction.balanceAfter.toLocaleString()}</p>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
