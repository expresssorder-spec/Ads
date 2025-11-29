import React, { useState } from 'react';
import { parseExcelFile } from './services/excelService';
import { analyzeAdsWithGemini } from './services/geminiService';
import FileUpload from './components/FileUpload';
import AnalysisView from './components/AnalysisView';
import { AdData, AnalysisResult, AppState } from './types';
import { LayoutDashboard, AlertCircle, Loader2 } from 'lucide-react';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [data, setData] = useState<AdData[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    try {
      setAppState(AppState.PARSING);
      setError(null);
      
      const parsedData = await parseExcelFile(file);
      setData(parsedData);
      
      setAppState(AppState.ANALYZING);
      const result = await analyzeAdsWithGemini(parsedData);
      setAnalysis(result);
      
      setAppState(AppState.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "وقع شي مشكل ف معالجة الملف");
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setData([]);
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-800">Mouhallil Ads</span>
          </div>
          <div className="text-sm font-medium text-gray-500 hidden sm:block">
            Gemini AI Powered 🇲🇦
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 animate-bounce-in">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {/* State: IDLE or PARSING */}
        {(appState === AppState.IDLE || appState === AppState.PARSING || appState === AppState.ERROR) && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
                حلل إعلانات الفيسبوك ديالك <br />
                <span className="text-indigo-600">بالذكاء الاصطناعي</span>
              </h1>
              <p className="text-lg text-gray-600">
                حط الملف ديال الحملة (Export) وحنا غانعطيوك تقرير كامل بالدارجة، شنو تزيد وشنو تنقص باش تطلع الـ ROAS.
              </p>
            </div>
            
            <FileUpload 
              onFileSelect={handleFileSelect} 
              isLoading={appState === AppState.PARSING} 
            />
          </div>
        )}

        {/* State: ANALYZING */}
        {appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
             <div className="relative">
                <div className="w-20 h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl">🤖</span>
                </div>
             </div>
             <h2 className="text-2xl font-bold text-gray-800 mt-8">كنحللو ف الداتا ديالك...</h2>
             <p className="text-gray-500 mt-2">Gemini خدام كيقرا الأرقام باش يعطيك الخلاصة</p>
          </div>
        )}

        {/* State: SUCCESS */}
        {appState === AppState.SUCCESS && analysis && (
          <AnalysisView 
            data={data} 
            analysis={analysis} 
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

export default App;