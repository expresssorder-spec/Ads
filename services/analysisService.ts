import { AdData, AnalysisResult } from '../types';

export const analyzeAds = async (data: AdData[]): Promise<AnalysisResult> => {
  // Simulate async processing to allow UI to render loading state
  await new Promise(resolve => setTimeout(resolve, 100));

  // 1. Calculate Summary Stats
  const totalSpent = data.reduce((sum, item) => sum + item.amountSpent, 0);
  const totalRevenue = data.reduce((sum, item) => sum + (item.amountSpent * item.roas), 0);
  const totalResults = data.reduce((sum, item) => sum + item.results, 0);
  const avgRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;
  const avgCpa = totalResults > 0 ? totalSpent / totalResults : 0;
  
  // Detect Context (Optimized Performance)
  const counts: Record<string, number> = {};
  for (const item of data) {
    counts[item.resultType] = (counts[item.resultType] || 0) + 1;
  }
  
  const dominantResultType = Object.keys(counts).reduce((a, b) => 
    (counts[a] > counts[b] ? a : b), 'generic'
  );
  
  const isEcommerce = avgRoas > 0.5 || dominantResultType === 'purchase';

  // 2. Deep Analysis Logic
  
  // Thresholds
  const highCpaThreshold = avgCpa > 0 ? avgCpa * 1.3 : 0; // 30% more expensive than average
  const goodCpaThreshold = avgCpa > 0 ? avgCpa * 0.8 : 0; // 20% cheaper than average
  const minSpendForDecision = data.length > 0 ? (totalSpent / data.length) * 0.2 : 0; // Ignore ads with very low spend relative to others

  // Categorize Ads
  const zeroResultAds = data.filter(d => d.amountSpent > minSpendForDecision && d.results === 0);
  
  const badAds = data.filter(d => {
    if (d.amountSpent < minSpendForDecision) return false;
    if (isEcommerce) {
        return d.roas < 1.0 || (d.roas < avgRoas * 0.7);
    } else {
        return d.costPerResult > highCpaThreshold;
    }
  });

  const goodAds = data.filter(d => {
    if (d.results === 0) return false;
    if (isEcommerce) {
        return d.roas > 2.0 || d.roas > avgRoas * 1.3;
    } else {
        return d.costPerResult < goodCpaThreshold;
    }
  });

  // Calculate Wasted Budget (Zero results + Bad performance)
  const wastedBudget = zeroResultAds.reduce((acc, curr) => acc + curr.amountSpent, 0) + 
                       badAds.reduce((acc, curr) => acc + curr.amountSpent, 0);

  // 3. Generate Markdown Report in Darija
  let markdown = `## 📊 تقرير التحليل المباشر\n\n`;

  // General Observations
  markdown += `### 🧐 ملاحظات عامة\n`;
  markdown += `المجموع ديال المصاريف هو **$${totalSpent.toLocaleString(undefined, {maximumFractionDigits:0})}** وجاب ليك **${totalResults}** نتيجة.\n\n`;
  
  if (isEcommerce) {
      markdown += `- **الـ ROAS العام:** ${avgRoas.toFixed(2)}. \n`;
      markdown += avgRoas < 1.5 
        ? `⚠️ رد البال، الـ ROAS طايح شوية. خاصك تراجع الـ Creative والـ Offer.` 
        : `✅ الـ ROAS مزيان، كاين فرص باش تزيد فالميزانية.`;
  } else {
      markdown += `- **ثمن النتيجة المتوسط (Avg CPA):** $${avgCpa.toFixed(2)}. \n`;
      markdown += `- كاين **${zeroResultAds.length}** إعلانات خسرات فلوس بلا ما تجيب حتى نتيجة.`;
  }
  markdown += `\n\n---\n\n`;

  // What to Kill
  markdown += `### 🛑 شنو خاصك تحبس (Kill)\n`;
  if (zeroResultAds.length > 0 || badAds.length > 0) {
      markdown += `ضيعتي تقريبا **$${wastedBudget.toFixed(2)}** ف إعلانات عيانة. هادشي خاصو يتحبس دابا:\n\n`;
      
      if (zeroResultAds.length > 0) {
        markdown += `**1. إعلانات خسرات فلوس بلا نتيجة (Zero Results):**\n`;
        zeroResultAds.sort((a,b) => b.amountSpent - a.amountSpent).slice(0, 5).forEach(ad => {
             markdown += `- \`${ad.adName}\`: خسرات **$${ad.amountSpent.toFixed(2)}** وماجابت والو.\n`;
        });
        markdown += `\n`;
      }

      if (badAds.length > 0) {
        markdown += `**2. إعلانات غالية بزاف (High CPA / Low ROAS):**\n`;
        badAds.sort((a,b) => isEcommerce ? a.roas - b.roas : b.costPerResult - a.costPerResult).slice(0, 5).forEach(ad => {
            if (isEcommerce) {
                 markdown += `- \`${ad.adName}\`: جابت ROAS عيان **${ad.roas.toFixed(2)}**.\n`;
            } else {
                 markdown += `- \`${ad.adName}\`: النتيجة طالعة بـ **$${ad.costPerResult.toFixed(2)}** (المتوسط هو $${avgCpa.toFixed(2)}).\n`;
            }
        });
      }
  } else {
      markdown += `🎉 مبروك! ما عندكش شي إعلانات خايبة بزاف، كلشي غادي مزيان تقريباً.\n`;
  }
  markdown += `\n\n---\n\n`;

  // What to Scale
  markdown += `### 🚀 شنو خاصك تزيد (Scale)\n`;
  if (goodAds.length > 0) {
      markdown += `هاد الإعلانات هي "الهمزة" ديالك، زيد فيهم الميزانية:\n\n`;
      goodAds.sort((a,b) => isEcommerce ? b.roas - a.roas : a.costPerResult - b.costPerResult).slice(0, 5).forEach(ad => {
          if (isEcommerce) {
              markdown += `- \`${ad.adName}\`: ROAS طالع **${ad.roas.toFixed(2)}** وصارفة **$${ad.amountSpent.toFixed(2)}**.\n`;
          } else {
              markdown += `- \`${ad.adName}\`: رخيصة بزاف **$${ad.costPerResult.toFixed(2)}** وجايبة **${ad.results}** نتيجة.\n`;
          }
      });
      markdown += `\n💡 **نصيحة:** حاول تدير Duplicate لهاد الإعلانات ف Campaign جديدة (CBO) باش تزيد تكسيري بيهم.`;
  } else {
      markdown += `مزال ما بانوش Winners واضحين. جرب Creatives جداد باش تهرس الـ Avg CPA الحالي.\n`;
  }

  return {
    markdownReport: markdown,
    summary: {
      totalSpent,
      totalRevenue,
      avgRoas,
      avgCpa,
      totalResults,
      dominantResultType
    }
  };
};