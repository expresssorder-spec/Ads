import React, { useRef } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
      className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white shadow-sm
        ${isLoading ? 'opacity-50 cursor-not-allowed border-gray-300' : 'border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'}
      `}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={!isLoading ? handleClick : undefined}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleChange} 
        accept=".xlsx,.xls,.csv" 
        className="hidden" 
        disabled={isLoading}
      />
      
      <div className="bg-indigo-100 p-4 rounded-full mb-4">
        <FileSpreadsheet className="w-10 h-10 text-indigo-600" />
      </div>
      
      <h3 className="text-xl font-bold text-gray-800 mb-2">حط الفيشي ديالك هنا</h3>
      <p className="text-gray-500 mb-6">Excel (.xlsx) أو CSV</p>
      
      <button 
        disabled={isLoading}
        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
      >
        <Upload className="w-4 h-4" />
        {isLoading ? 'جاري التحميل...' : 'ختار الملف'}
      </button>
      
      <p className="text-xs text-gray-400 mt-4">
        تأكد بلي الملف فيه: Amount Spent, ROAS, Results, Cost per Result
      </p>
    </div>
  );
};

export default FileUpload;