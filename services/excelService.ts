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
        // Scan first 25 rows to find the one with the most matching keywords
        let headerRowIndex = 0;
        let maxMatches = 0;
        // Added 'campagne', 'montant', 'nom', 'dépensé' for better French detection
        const keywords = [
            'campaign', 'ad name', 'ad set', 'results', 'amount spent', 'impressions', 
            'إعلان', 'حملة', 'نتائج', 'publicité', 'campagne', 'montant', 'dépensé', 'nom'
        ];

        for (let i = 0; i < Math.min(jsonData.length, 25); i++) {
            const row = (jsonData[i] as any[]).map(c => c ? c.toString().toLowerCase() : '');
            const matches = row.filter(cell => keywords.some(k => cell.includes(k))).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                headerRowIndex = i;
            }
        }

        if (maxMatches < 2) {
             console.warn("Could not detect header row confidently. Defaulting to 0.");
             headerRowIndex = 0;
        }

        // --- 2. Extract Headers and Data ---
        const rawHeaders = (jsonData[headerRowIndex] as string[]) || [];
        
        // Normalize headers for comparison (remove special chars, lowercase)
        // Note: We allow basic latin chars to handle accents properly by NOT stripping everything initially if possible,
        // but for robustness we strip non-alphanumeric except Arabic. 
        // To support 'publicité' (é), we should include extended latin or just fuzzy match base chars.
        // Strategy: Strip strict non-alphanumeric but keep arabic. 
        // 'Nom de la campagne' -> 'nomdelacampagne'
        // 'Publicité' -> 'publicit' (if é is stripped) or 'publicité' if allowed.
        // Let's rely on stripping accents/special chars for easier matching.
        
        const normalize = (str: string) => {
            if (!str) return '';
            return str.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents (é -> e)
                .replace(/[^a-z0-9\u0600-\u06FF]/g, ''); // Remove non-alphanumeric
        };

        const headers = rawHeaders.map(h => normalize(h.toString()));
        
        const rows = jsonData.slice(headerRowIndex + 1);

        // Helper to find column index based on possible keywords
        const findIndex = (possibleNames: string[]) => {
            const normalizedKeywords = possibleNames.map(n => normalize(n));
            return headers.findIndex(h => 
                normalizedKeywords.some(keyword => h.includes(keyword))
            );
        };

        // Comprehensive mapping for EN, FR, AR
        const idxMap = {
          campaign: findIndex(['nom de la campagne', 'campaign name', 'campaign', 'campagne', 'اسم الحملة']),
          adSet: findIndex(['nom de l\'ensemble', 'ad set name', 'ad set', 'adset', 'ensemble de publicités', 'المجموعة الإعلانية']),
          ad: findIndex(['nom de la publicité', 'ad name', 'ad', 'publicité', 'name', 'اسم الإعلان']),
          spent: findIndex(['amount spent', 'spend', 'montant dépensé', 'cost', 'المبلغ الذي تم إنفاقه', 'depense', 'amountspent']),
          impressions: findIndex(['impressions', 'مرات الظهور']),
          clicks: findIndex(['link clicks', 'clicks', 'clics', 'النقرات']),
          ctr: findIndex(['ctr', 'click-through rate', 'taux de clics', 'نسبة النقر']),
          cpc: findIndex(['cpc', 'cost per click', 'coût par clic', 'cout par clic']),
          results: findIndex(['results', 'résultats', 'resultats', 'result', 'purchases', 'leads', 'messaging conversations', 'النتائج']),
          cpa: findIndex(['cost per result', 'coût par résultat', 'cout par resultat', 'cpr', 'cost per purchase', 'التكلفة لكل نتيجة']),
          roas: findIndex(['purchase roas', 'roas', 'return on ad spend', 'retour sur les dépenses', 'عائد الإنفاق', 'roasachats']),
        };

        if (idxMap.spent === -1) {
             // Try fallback for 'Amount Spent' if exact match failed
             reject(new Error("ماقدرناش نلقاو خانة المصاريف (Montant dépensé / Amount Spent). تأكد أن الملف فيه هاد المعلومة."));
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
                if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                    // 1.234,56 (EU/FR)
                    str = str.replace(/\./g, '').replace(',', '.');
                } else {
                    // 1,234.56 (US)
                    str = str.replace(/,/g, '');
                }
            } else if (hasComma) {
                // 1234,56 or 1,234. In Ads context usually decimal.
                str = str.replace(',', '.');
            }
            
            return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
        };

        // --- 4. Safe String Helper ---
        const safeString = (val: any, defaultVal: string): string => {
            if (val === undefined || val === null) return defaultVal;
            return String(val).trim();
        };

        const parsedData: AdData[] = rows.map((row: any) => {
            const spent = parseNumber(row[idxMap.spent]);
            
            // Skip summary rows
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
        }).filter((item): item is AdData => item !== null && item.amountSpent > 0); 

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