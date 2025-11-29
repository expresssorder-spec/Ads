import React, { useState, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { AdData, AnalysisResult } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatsCard from './StatsCard';
import { DollarSign, TrendingUp, Target, Activity, RefreshCw, Search, MessageCircle, Users } from 'lucide-react';

interface AnalysisViewProps {
  data: AdData[];
  analysis: AnalysisResult;
  onReset: () => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ data, analysis, onReset }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);

  // Determine if this is an e-commerce (ROAS based) or Lead/Message (CPA based) view
  const isEcommerce = analysis.summary.avgRoas > 0.5 || analysis.summary.dominantResultType === 'purchase';

  // Prepare data for chart (Top 10 Spenders)
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.amountSpent - a.amountSpent)
      .slice(0, 10)
      .map(item => ({
        name: item.adName.length > 15 ? item.adName.substring(0, 15) + '...' : item.adName,
        fullName: item.adName,
        roas: item.roas,
        spent: item.amountSpent,
        cpa: item.costPerResult,
        results: item.results
      }));
  }, [data]);

  const handleAdClick = (adName: string) => {
    setSearchTerm(adName);
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerTerm = searchTerm.toLowerCase();
    return data.filter(item => 
      String(item.adName).toLowerCase().includes(lowerTerm) ||
      String(item.campaignName).toLowerCase().includes(lowerTerm) ||
      String(item.adSetName).toLowerCase().includes(lowerTerm)
    );
  }, [data, searchTerm]);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">نتائج التحليل</h2>
           <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md mt-1 inline-block">
             نوع الحملة: {isEcommerce ? 'مبيعات (E-Com)' : analysis.summary.dominantResultType === 'message' ? 'رسائل (Messages)' : 'Leads/Results'}
           </span>
        </div>
        <button 
          onClick={onReset}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 px-4 py-2 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          تحليل ملف جديد
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="المصروف الإجمالي" 
          value={`$${analysis.summary.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={<DollarSign className="w-6 h-6" />}
          color="indigo"
        />
        
        {isEcommerce ? (
            <StatsCard 
            title="العائد (ROAS)" 
            value={`${analysis.summary.avgRoas.toFixed(2)}x`}
            icon={<TrendingUp className="w-6 h-6" />}
            color={analysis.summary.avgRoas > 2 ? 'green' : 'orange'}
            />
        ) : (
            <StatsCard 
            title="مجموع النتائج" 
            value={`${analysis.summary.totalResults}`}
            subValue={analysis.summary.dominantResultType === 'message' ? 'Messages' : 'Leads'}
            icon={analysis.summary.dominantResultType === 'message' ? <MessageCircle className="w-6 h-6" /> : <Users className="w-6 h-6" />}
            color="indigo"
            />
        )}

        <StatsCard 
          title={isEcommerce ? "تكلفة الشراء (CPA)" : "تكلفة النتيجة (CPA)"}
          value={`$${analysis.summary.avgCpa.toFixed(2)}`}
          icon={<Target className="w-6 h-6" />}
          color="red"
        />

        {isEcommerce ? (
             <StatsCard 
             title="العائد المتوقع" 
             value={`$${analysis.summary.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
             icon={<Activity className="w-6 h-6" />}
             color="green"
           />
        ) : (
            <StatsCard 
            title="معدل النقر (CTR)" 
            // Average CTR calculation naive
            value={`${(data.reduce((acc, curr) => acc + curr.ctr, 0) / (data.length || 1)).toFixed(2)}%`}
            icon={<Activity className="w-6 h-6" />}
            color="green"
          />
        )}
       
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Gemini Report Section */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              تقرير التحليل
            </h3>
          </div>
          <div className="p-6 prose prose-indigo max-w-none text-right flex-grow" dir="rtl">
            <ReactMarkdown
              components={{
                h2: ({node, ...props}) => <h2 className="text-xl font-bold text-indigo-700 mt-6 mb-3 border-b pb-2" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-bold text-gray-800 mt-4 mb-2" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc mr-5 space-y-1 text-gray-700" {...props} />,
                li: ({node, ...props}) => <li className="pl-1" {...props} />,
                strong: ({node, ...props}) => <strong className="font-extrabold text-gray-900" {...props} />,
                p: ({node, ...props}) => <p className="text-gray-700 leading-relaxed mb-4" {...props} />,
                code: ({node, className, children, ...props}) => {
                  const text = String(children).replace(/\n$/, '');
                  // Safer check ensuring d.adName is treated as string
                  const isAd = data.some(d => {
                      const name = String(d.adName || "");
                      return name.includes(text) || text.includes(name);
                  });
                  
                  if (isAd) {
                    return (
                      <button 
                        onClick={() => handleAdClick(text)}
                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-md text-sm font-bold transition-all mx-1 inline-flex items-center gap-1 border border-indigo-200 cursor-pointer"
                        title="عرض التفاصيل في الجدول"
                      >
                        {text}
                        <Search size={12} />
                      </button>
                    );
                  }
                  return <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800" {...props}>{children}</code>;
                }
              }}
            >
              {analysis.markdownReport}
            </ReactMarkdown>
          </div>
        </div>

        {/* Charts Section */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-6">
                    {isEcommerce ? "أداء الإعلانات (Top 10 Spend)" : "الأكثر صرفاً ومعدل النتائج"}
                </h3>
                <div className="h-64 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} interval={0} />
                            <Tooltip 
                                cursor={{fill: '#f3f4f6'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            />
                            {isEcommerce ? (
                                <Bar dataKey="roas" name="ROAS" radius={[0, 4, 4, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.roas >= 2 ? '#10b981' : '#f43f5e'} />
                                    ))}
                                </Bar>
                            ) : (
                                <Bar dataKey="results" name="Results" radius={[0, 4, 4, 0]}>
                                     {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#6366f1" />
                                    ))}
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-400 mt-4 text-center">
                    {isEcommerce ? "الأخضر: ROAS طالع، الأحمر: ROAS هابط" : "البار كيمثل عدد النتائج (Leads/Messages)"}
                </p>
            </div>

            <div className="bg-indigo-900 rounded-xl p-6 text-white">
                <h3 className="font-bold text-lg mb-2">💡 نصيحة سريعة</h3>
                <p className="text-indigo-200 text-sm leading-relaxed">
                    {isEcommerce 
                        ? "ركز ديما على الـ Creative. إلا كان CTR طالع و Conversion هابط، المشكل غالبا ف الـ Landing Page."
                        : "فحملات الرسائل، الـ Creative هو اللي كيتحكم ف الثمن. جرب تبدل الهوك (First 3 seconds) باش طيح الـ CPA."
                    }
                </p>
            </div>
        </div>
      </div>

      {/* Data Table Section */}
      <div ref={tableRef} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden scroll-mt-24">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            📊 تفاصيل الإعلانات
            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {filteredData.length} إعلان
            </span>
          </h3>
          
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="بحث عن إعلان..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-right"
              dir="rtl"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right" dir="rtl">
            <thead className="bg-gray-50 text-gray-600 text-sm">
              <tr>
                <th className="px-6 py-3 font-medium">اسم الإعلان</th>
                <th className="px-6 py-3 font-medium">Spend</th>
                <th className="px-6 py-3 font-medium">{isEcommerce ? 'ROAS' : 'CTR'}</th>
                <th className="px-6 py-3 font-medium">Results ({analysis.summary.dominantResultType === 'message' ? 'Msg' : analysis.summary.dominantResultType === 'lead' ? 'Leads' : 'Sales'})</th>
                <th className="px-6 py-3 font-medium">CPA</th>
                <th className="px-6 py-3 font-medium">{isEcommerce ? 'CTR' : 'Clicks'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <tr 
                    key={index} 
                    className={`hover:bg-indigo-50 transition-colors`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate" title={item.adName}>
                      {item.adName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      ${item.amountSpent.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">
                       {isEcommerce ? (
                            <span className={`${item.roas >= 2 ? 'text-green-600' : item.roas >= 1 ? 'text-orange-500' : 'text-red-500'}`}>
                                {item.roas.toFixed(2)}x
                            </span>
                       ) : (
                            <span className="text-gray-700">{item.ctr.toFixed(2)}%</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.results}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      ${item.costPerResult.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {isEcommerce ? `${item.ctr.toFixed(2)}%` : item.clicks}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    ما كاين حتى نتيجة بهاد الاسم
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredData.length > 20 && (
           <div className="p-3 text-center text-xs text-gray-400 border-t border-gray-100">
             عرض أول 20 نتيجة فقط في البحث
           </div>
        )}
      </div>

    </div>
  );
};

export default AnalysisView;