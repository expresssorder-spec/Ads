import { GoogleGenAI } from "@google/genai";
import { AdData, AnalysisResult } from '../types';

export const analyzeAdsWithGemini = async (data: AdData[]): Promise<AnalysisResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Pre-calculate summary stats for the UI
  const totalSpent = data.reduce((sum, item) => sum + item.amountSpent, 0);
  const totalRevenue = data.reduce((sum, item) => sum + (item.amountSpent * item.roas), 0);
  const totalResults = data.reduce((sum, item) => sum + item.results, 0);
  const avgRoas = totalRevenue / totalSpent || 0;
  const avgCpa = totalResults > 0 ? totalSpent / totalResults : 0;
  
  // Detect dominant result type from data if not explicitly set consistently
  const resultTypes = data.map(d => d.resultType);
  const dominantResultType = resultTypes.sort((a,b) =>
        resultTypes.filter(v => v===a).length - resultTypes.filter(v => v===b).length
  ).pop() || 'generic';

  // Determine analysis mode
  const isEcommerce = avgRoas > 0.5 || dominantResultType === 'purchase';
  const objectiveContext = isEcommerce ? "E-Commerce (Purchases/ROAS)" : (dominantResultType === 'message' ? "Messaging (WhatsApp/Messenger)" : "Lead Generation");

  // Prepare a condensed version of data
  const sortedData = [...data].sort((a, b) => b.amountSpent - a.amountSpent).slice(0, 50);

  const dataString = JSON.stringify(sortedData.map(item => ({
    Ad: item.adName,
    Spend: item.amountSpent.toFixed(2),
    ROAS: item.roas.toFixed(2),
    Results: item.results, // Using generic 'Results' label but context is provided in prompt
    CPA: item.costPerResult.toFixed(2),
    CTR: item.ctr.toFixed(2),
    Clicks: item.clicks
  })));

  const systemInstruction = `
    You are a world-class Facebook Ads Media Buyer and Digital Marketing expert specializing in the Moroccan market.
    Your persona: Professional, insightful, direct, and you speak in "Moroccan Darija" (Arabic script).
    
    Current Campaign Objective Context: **${objectiveContext}**
    
    CRITICAL ANALYSIS RULES:
    1. **If Objective is Messaging/Leads**: 
       - IGNORE ROAS (Return on Ad Spend) if it is 0 or low. It is expected to be 0 for WhatsApp/Messenger ads.
       - Focus strictly on CPA (Cost Per Result) and Volume (Number of Messages/Leads).
       - A "Good" ad has Low CPA and High Volume.
       - A "Bad" ad has High CPA.
    
    2. **If Objective is E-Commerce**:
       - Focus on ROAS.
       - A "Good" ad has High ROAS.
    
    Task:
    1. Analyze the provided JSON data.
    2. Identify patterns: High Spend/High CPA (Bleeding), Low CPA/High Volume (Winners).
    3. Provide actionable advice.
    
    Output Structure (in Markdown):
    - **ملاحظات عامة (General Observations):** Overall health based on the Objective (${objectiveContext}).
    - **شنو خاصك تحبس (What to Kill):** Identify ads wasting budget (High CPA for messages, Low ROAS for sales). Explain why.
    - **شنو خاصك تزيد (What to Scale):** Identify winners (Low CPA, High Volume).
    - **نصائح للتحسين (Creative/Strategy Advice):** Creative suggestions.
    
    formatting:
    - Enclose specific "Ad" names in backticks (e.g., \`Ad Name\`).
    
    Tone: Encouraging but critical on wasted budget. Use Moroccan marketing terms.
    Response must be in Moroccan Darija (Arabic Script).
  `;

  const prompt = `
    هادي هي الداتا ديال الحملة الإعلانية ديالي.
    نوع الهدف: ${objectiveContext}
    
    البيانات:
    ${dataString}
    
    عطيني تحليل معمق وشنو خاصني ندير. 
    ${!isEcommerce ? "عفاك ما تهضرش ليا على ROAS حيتاش أنا خدام Messages/Leads، ركز ليا على ثمن الرسالة/النتيجة." : ""}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    return {
      markdownReport: response.text || "تعذر الحصول على تحليل في الوقت الحالي.",
      summary: {
        totalSpent,
        totalRevenue,
        avgRoas,
        avgCpa,
        totalResults,
        dominantResultType
      }
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("فشل الاتصال بـ Gemini للتحليل");
  }
};