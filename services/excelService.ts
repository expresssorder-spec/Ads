import * as XLSX from 'xlsx';
import { AdData } from '../types';

export const parseExcelFile = async (file: File): Promise<AdData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Read as ArrayBuffer for better encoding support (Arabic/French chars)
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with raw values (array of arrays)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (!jsonData || jsonData.length < 2) {
            reject(new Error("الملف خاوي أو مافيهش داتا مقروءة"));
            return;
        }

        // --- 1. Dynamic Header Row Detection ---
        // Scan first 20 rows to find the one with the most matching keywords
        let headerRowIndex = 0;
        let maxMatches = 0;
        const keywords = ['campaign', 'ad name', 'ad set', 'results', 'amount spent', 'impressions', 'إعلان', 'حملة', 'نتائج', 'publicité'];

        for (let i = 0; i < Math.min(jsonData.length, 25); i++) {
            const row = (jsonData[i] as any[]).map(c => c ? c.toString().toLowerCase() : '');
            const matches = row.filter(cell => keywords.some(k => cell.includes(k))).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                headerRowIndex = i;
            }
        }

        if (maxMatches < 2) {
             // Fallback: If we couldn't confidently find a header row, assume row 0 or try to proceed
             console.warn("Could not detect header row confidently. Defaulting to 0.");
             headerRowIndex = 0;
        }

        // --- 2. Extract Headers and Data ---
        const rawHeaders = (jsonData[headerRowIndex] as string[]) || [];
        const headers = rawHeaders.map(h => 
            h ? h.toString().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '') : ''
        );
        
        const rows = jsonData.slice(headerRowIndex + 1);

        // Helper to find column index based on possible keywords (fuzzy match)
        const findIndex = (possibleNames: string[]) => {
            const normalizedNames = possibleNames.map(n => n.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, ''));
            return headers.findIndex(h => 
                normalizedNames.some(name => h.includes(name))
            );
        };

        // Comprehensive mapping for EN, FR, AR
        const idxMap = {
          campaign: findIndex(['campaign name', 'campaign', 'campagne', 'اسم الحملة']),
          adSet: findIndex(['ad set name', 'ad set', 'adset', 'ensemble de publicités', 'المجموعة الإعلانية']),
          ad: findIndex(['ad name', 'ad', 'publicité', 'name', 'اسم الإعلان']),
          spent: findIndex(['amount spent', 'spend', 'montant dépensé', 'cost', 'المبلغ الذي تم إنفاقه', 'depense', 'amountspent']),
          impressions: findIndex(['impressions', 'مرات الظهور']),
          clicks: findIndex(['link clicks', 'clicks', 'clics', 'النقرات']),
          ctr: findIndex(['ctr', 'click-through rate', 'taux de clics', 'نسبة النقر']),
          cpc: findIndex(['cpc', 'cost per click', 'coût par clic']),
          results: findIndex(['results', 'résultats', 'result', 'purchases', 'leads', 'messaging conversations', 'النتائج']),
          cpa: findIndex(['cost per result', 'coût par résultat', 'cpr', 'cost per purchase', 'التكلفة لكل نتيجة']),
          roas: findIndex(['purchase roas', 'roas', 'return on ad spend', 'retour sur les dépenses', 'عائد الإنفاق', 'roasachats']),
        };

        if (idxMap.spent === -1) {
             reject(new Error("ماقدرناش نلقاو خانة المصاريف (Amount Spent). تأكد أن الملف فيه هاد المعلومة."));
             return;
        }

        // Detect Result Type based on the Header Name of the 'Results' column
        let detectedResultType = 'generic';
        if (idxMap.results !== -1) {
            const resultHeader = rawHeaders[idxMap.results] ? rawHeaders[idxMap.results].toLowerCase() : '';
            if (resultHeader.includes('purchase') || resultHeader.includes('achat') || resultHeader.includes('شراء')) {
                detectedResultType = 'purchase';
            } else if (resultHeader.includes('messag') || resultHeader.includes('convers') || resultHeader.includes('مراسلة') || resultHeader.includes('رسائل')) {
                detectedResultType = 'message';
            } else if (resultHeader.includes('lead') || resultHeader.includes('prospect') || resultHeader.includes('عميل')) {
                detectedResultType = 'lead';
            }
        }

        // --- 3. Robust Number Parsing Function ---
        const parseNumber = (val: any) => {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return val;
            
            let str = val.toString().trim();
            // Remove currency symbols and non-numeric chars except . , -
            // Also handle spaces and NBSP used as thousand separators
            str = str.replace(/\s/g, '').replace(/\u00A0/g, ''); 

            const hasDot = str.includes('.');
            const hasComma = str.includes(',');

            // Heuristic for format detection
            if (hasDot && hasComma) {
                // Determine which is last. The last separator is usually the decimal.
                if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                    // Format: 1.234,56 (EU/Morocco) -> Replace dots, swap comma to dot
                    str = str.replace(/\./g, '').replace(',', '.');
                } else {
                    // Format: 1,234.56 (US) -> Remove commas
                    str = str.replace(/,/g, '');
                }
            } else if (hasComma) {
                // Only comma: 1234,56 or 1,234 (Ambiguous)
                // In Moroccan/French context, comma is usually decimal.
                // Exception: If it looks like US integer 1,000 (length - index == 4)
                // But generally safe to replace comma with dot for ad metrics which often have decimals.
                str = str.replace(',', '.');
            }
            // If only dot: 1234.56 (Standard) -> keep as is.

            return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
        };

        // --- 4. Safe String Helper ---
        const safeString = (val: any, defaultVal: string): string => {
            if (val === undefined || val === null) return defaultVal;
            return String(val).trim();
        };

        const parsedData: AdData[] = rows.map((row: any) => {
            const spent = parseNumber(row[idxMap.spent]);
            
            // Skip summary rows (often total rows at bottom have no Ad Name)
            if (!row[idxMap.ad] && !row[idxMap.campaign]) return null;

            return {
                campaignName: idxMap.campaign !== -1 ? safeString(row[idxMap.campaign], 'Unknown Campaign') : 'Unknown Campaign',
                adSetName: idxMap.adSet !== -1 ? safeString(row[idxMap.adSet], 'Unknown AdSet') : 'Unknown AdSet',
                adName: idxMap.ad !== -1 ? safeString(row[idxMap.ad], safeString(row[0], 'Unknown Ad')) : safeString(row[0], 'Unknown Ad'),
                amountSpent: spent,
                impressions: parseNumber(row[idxMap.impressions]),
                clicks: parseNumber(row[idxMap.clicks]),
                ctr: parseNumber(row[idxMap.ctr]),
                cpc: parseNumber(row[idxMap.cpc]),
                results: parseNumber(row[idxMap.results]),
                costPerResult: parseNumber(row[idxMap.cpa]),
                roas: parseNumber(row[idxMap.roas]),
                currency: 'USD',
                resultType: detectedResultType
            };
        }).filter((item): item is AdData => item !== null && item.amountSpent > 0); // Type guard and filter

        if (parsedData.length === 0) {
            reject(new Error("ما لقينا حتى إعلان فيه صرف (Amount Spent > 0). تأكد من الملف والعناوين."));
            return;
        }

        resolve(parsedData);
      } catch (error) {
        console.error("Excel Parse Error:", error);
        reject(new Error("وقع مشكل فقراءة ملف Excel. تأكد أنه ماشي مضروب."));
      }
    };

    reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    reader.readAsArrayBuffer(file);
  });
};