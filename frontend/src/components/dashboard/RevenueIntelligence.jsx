/**
 * Revenue Intelligence Dashboard Component
 * Phase 4: Displays MRR tracking, collection metrics, forecasting, and insights
 */
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  TrendingUpIcon,
  DollarIcon,
  AlertIcon,
  CheckIcon,
  RefreshIcon,
  UserIcon
} from '../common/Icons';
import Card from '../common/Card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';

const RevenueIntelligence = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    fetchRevenueSummary();
  }, []);

  const fetchRevenueSummary = async () => {
    try {
      setLoading(true);
      // Use the centralized api service which handles auth headers automatically
      const response = await api.get('/revenue/summary');
      setSummary(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching revenue summary:', err);
      setError(err.response?.data?.detail || 'Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'warning':
        return <AlertIcon size={20} className="text-yellow-600" />;
      case 'alert':
        return <AlertIcon size={20} className="text-red-600" />;
      case 'success':
        return <CheckIcon size={20} className="text-green-600" />;
      default:
        return <AlertIcon size={20} className="text-blue-600" />;
    }
  };

  const getInsightBgColor = (type) => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'alert':
        return 'bg-red-50 border-red-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshIcon size={48} className="text-blue-600 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-600">Loading revenue intelligence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertIcon size={24} className="text-red-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-red-900">Error Loading Revenue Data</h3>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <DollarIcon size={64} className="text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No revenue data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Current MRR</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(summary.current_mrr)}
              </p>
            </div>
            <DollarIcon size={40} className="text-blue-600 opacity-80" />
          </div>
          <div className="mt-3 flex items-center">
            {summary.mrr_growth_rate >= 0 ? (
              <TrendingUpIcon size={16} className="text-green-600 mr-1" />
            ) : (
              <TrendingUpIcon size={16} className="text-red-600 mr-1" style={{ transform: 'scaleY(-1)' }} />
            )}
            <span className={`text-sm font-medium ${summary.mrr_growth_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.mrr_growth_rate.toFixed(1)}% MoM
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Collection Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summary.collection_rate.toFixed(1)}%
              </p>
            </div>
            <CheckIcon size={40} className="text-green-600 opacity-80" />
          </div>
          <div className="mt-3">
            <p className="text-xs text-gray-500">Last 30 days</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Overdue Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(summary.overdue_revenue)}
              </p>
            </div>
            <AlertIcon size={40} className="text-yellow-600 opacity-80" />
          </div>
          <div className="mt-3">
            <p className="text-xs text-gray-500">Requires attention</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Accounts Receivable</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(summary.current_ar)}
              </p>
            </div>
            <UserIcon size={40} className="text-purple-600 opacity-80" />
          </div>
          <div className="mt-3">
            <p className="text-xs text-gray-500">Total outstanding</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setSelectedTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              MRR Trend
            </button>
            <button
              onClick={() => setSelectedTab('forecast')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'forecast'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Forecast
            </button>
            <button
              onClick={() => setSelectedTab('insights')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'insights'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Insights
            </button>
          </nav>
        </div>

        <div className="p-6">
          {selectedTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">MRR Trend (6 Months)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={summary.mrr_trend}>
                    <defs>
                      <linearGradient id="colorMRR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#6B7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#6B7280"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => [formatCurrency(value), 'MRR']}
                    />
                    <Area
                      type="monotone"
                      dataKey="mrr"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fill="url(#colorMRR)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {selectedTab === 'forecast' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Revenue Forecast</h3>
                {summary.forecast.status === 'success' ? (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <div className="flex items-start">
                        <AlertIcon size={20} className="text-blue-600 mr-3 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900 mb-2">Forecast Method: {summary.forecast.method}</p>
                          <div className="text-xs text-blue-800 space-y-1">
                            <p><strong>Assumptions:</strong></p>
                            <ul className="list-disc list-inside ml-2 space-y-0.5">
                              {summary.forecast.assumptions.map((assumption, idx) => (
                                <li key={idx}>{assumption}</li>
                              ))}
                            </ul>
                          </div>
                          {summary.forecast.warning && (
                            <p className="text-xs text-blue-700 mt-2 font-medium">{summary.forecast.warning}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Current MRR</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">
                          {formatCurrency(summary.forecast.current_mrr)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">3-Month Average</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">
                          {formatCurrency(summary.forecast.avg_mrr_3m)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Monthly Trend</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">
                          {summary.forecast.trend_per_month >= 0 ? '+' : ''}
                          {formatCurrency(summary.forecast.trend_per_month)}
                        </p>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={summary.forecast.forecasts}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis 
                          dataKey="month" 
                          stroke="#6B7280"
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis 
                          stroke="#6B7280"
                          style={{ fontSize: '12px' }}
                          tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px'
                          }}
                          formatter={(value, name, props) => {
                            if (name === 'forecasted_mrr') {
                              return [
                                <>
                                  {formatCurrency(value)}
                                  <br />
                                  <span className="text-xs text-gray-500">
                                    {props.payload.uncertainty}
                                  </span>
                                </>,
                                'Forecast'
                              ];
                            }
                            return [value, name];
                          }}
                        />
                        <Bar dataKey="forecasted_mrr" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <AlertIcon size={48} className="text-yellow-600 mx-auto mb-3" />
                    <p className="text-yellow-900 font-medium">{summary.forecast.message || 'Insufficient data for forecasting'}</p>
                    <p className="text-yellow-700 text-sm mt-2">Need at least 3 months of historical data</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTab === 'insights' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Insights</h3>
              
              {summary.insights && summary.insights.length > 0 ? (
                <div className="space-y-4">
                  {summary.insights.map((insight, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-5 ${getInsightBgColor(insight.type)}`}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5">
                          {getInsightIcon(insight.type)}
                        </div>
                        <div className="ml-3 flex-1">
                          <h4 className="text-base font-semibold text-gray-900">
                            {insight.title}
                          </h4>
                          <p className="text-sm text-gray-700 mt-1">
                            {insight.message}
                          </p>
                          
                          {insight.evidence && (
                            <div className="mt-3 bg-white bg-opacity-50 rounded p-3">
                              <p className="text-xs font-medium text-gray-700 mb-2">Evidence:</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
                                {Object.entries(insight.evidence).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="font-medium">{key.replace(/_/g, ' ')}:</span>{' '}
                                    {typeof value === 'number' && !key.includes('count') && !key.includes('percentage') && !key.includes('rate')
                                      ? formatCurrency(value)
                                      : value}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {insight.recommendation && (
                            <div className="mt-3 flex items-start">
                              <CheckIcon size={16} className="text-gray-600 mr-2 mt-0.5 flex-shrink-0" />
                              <p className="text-sm font-medium text-gray-800">
                                <strong>Recommendation:</strong> {insight.recommendation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                  <CheckIcon size={48} className="text-blue-600 mx-auto mb-3" />
                  <p className="text-blue-900 font-medium">No insights available</p>
                  <p className="text-blue-700 text-sm mt-2">All revenue metrics appear healthy</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RevenueIntelligence;
