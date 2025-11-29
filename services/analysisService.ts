import { AdData, AnalysisResult } from '../types';

export const analyzeAds = async (data: AdData[]): Promise<AnalysisResult> => {
  // Simulate async processing to allow UI to render loading state
  await new Promise(resolve => setTimeout(resolve, 100));

  // 1. Calculate Summary Stats (Global)
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

  // --- 2. AdSet Level Aggregation ---
  interface AggregatedMetrics {
    name: string;
    spend: number;
    revenue: number;
    results: number;
    impressions: number;
    clicks: number;
  }
  
  const adSetMap: Record<string, AggregatedMetrics> = {};
  // --- New: Creative Level (Ad Name) Aggregation ---
  const creativeMap: Record<string, AggregatedMetrics> = {};

  data.forEach(item => {
    // AdSet Aggregation
    const setKey = item.adSetName || 'Unknown AdSet';
    if (!adSetMap[setKey]) {
      adSetMap[setKey] = { name: setKey, spend: 0, revenue: 0, results: 0, impressions: 0, clicks: 0 };
    }
    adSetMap[setKey].spend += item.amountSpent;
    adSetMap[setKey].revenue += (item.amountSpent * item.roas);
    adSetMap[setKey].results += item.results;
    adSetMap[setKey].impressions += item.impressions;
    adSetMap[setKey].clicks += item.clicks;

    // Creative Aggregation (Grouping by Ad Name)
    const creativeKey = item.adName || 'Unknown Creative';
    if (!creativeMap[creativeKey]) {
        creativeMap[creativeKey] = { name: creativeKey, spend: 0, revenue: 0, results: 0, impressions: 0, clicks: 0 };
    }
    creativeMap[creativeKey].spend += item.amountSpent;
    creativeMap[creativeKey].revenue += (item.amountSpent * item.roas);
    creativeMap[creativeKey].results += item.results;
    creativeMap[creativeKey].impressions += item.impressions;
    creativeMap[creativeKey].clicks += item.clicks;
  });

  const calculateMetrics = (item: AggregatedMetrics) => ({
    ...item,
    roas: item.spend > 0 ? item.revenue / item.spend : 0,
    cpa: item.results > 0 ? item.spend / item.results : 0,
    ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0
  });

  const adSets = Object.values(adSetMap).map(calculateMetrics);
  const creatives = Object.values(creativeMap).map(calculateMetrics);

  // --- 3. Deep Analysis Logic ---
  
  // Thresholds
  const highCpaThreshold = avgCpa > 0 ? avgCpa * 1.3 : 0; // 30% more expensive than average
  const goodCpaThreshold = avgCpa > 0 ? avgCpa * 0.8 : 0; // 20% cheaper than average
  const minSpendForDecision = data.length > 0 ? (totalSpent / data.length) * 0.2 : 0;

  // Categorize Ads (Individual Rows)
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

  // Categorize AdSets
  const badAdSets = adSets.filter(s => {
      if (s.spend < minSpendForDecision) return false;
      if (isEcommerce) return s.roas < 1.0 || (s.roas < avgRoas * 0.8);
      return s.results === 0 || s.cpa > highCpaThreshold;
  });

  const goodAdSets = adSets.filter(s => {
      if (s.results === 0) return false;
      if (isEcommerce) return s.roas > avgRoas * 1.2;
      return s.cpa < goodCpaThreshold;
  });

  // Categorize Creatives (Aggregated)
  const bestCreatives = creatives.filter(c => {
      if (c.spend < minSpendForDecision) return false;
      if (isEcommerce) return c.roas > avgRoas * 1.1; // Better than avg ROAS
      return c.results > 3 && c.cpa < avgCpa; // Better than avg CPA with volume
  }).sort((a,b) => isEcommerce ? b.roas - a.roas : a.cpa - b.cpa); // Sort by best metric

  const worstCreatives = creatives.filter(c => {
      if (c.spend < minSpendForDecision) return false;
      if (isEcommerce) return c.roas < avgRoas * 0.8;
      return (c.spend > avgCpa * 2 && c.results === 0) || c.cpa > highCpaThreshold;
  }).sort((a,b) => b.spend - a.spend); // Sort by highest waste

  // Calculate Wasted Budget
  const wastedBudget = zeroResultAds.reduce((acc, curr) => acc + curr.amountSpent, 0) + 
                       badAds.reduce((acc, curr) => acc + curr.amountSpent, 0);

  // --- 4. Generate Markdown Report in Darija ---
  let markdown = `## 📊 تقرير التحليل المباشر\n\n`;

  // General Observations
  markdown += `### 🧐 ملاحظات عامة\n`;
  markdown += `المجموع ديال المصاريف هو **$${totalSpent.toLocaleString(undefined, {maximumFractionDigits:0})}** على **${adSets.length}** ديال المجموعات (AdSets).\n\n`;
  
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

  // --- AdSets Analysis Section ---
  markdown += `### 📂 تحليل المجموعات (AdSets)\n`;
  if (badAdSets.length > 0) {
      markdown += `🔴 **مجموعات عيانة (خاصها تموت):**\n`;
      badAdSets.sort((a,b) => b.spend - a.spend).slice(0, 3).forEach(set => {
          if(isEcommerce) {
              markdown += `- \`${set.name}\`: صرفات **$${set.spend.toFixed(2)}** و ROAS ديالها **${set.roas.toFixed(2)}** (ناقص).\n`;
          } else {
              markdown += `- \`${set.name}\`: صرفات **$${set.spend.toFixed(2)}** و CPA غالي **$${set.cpa.toFixed(2)}**.\n`;
          }
      });
      markdown += `\n`;
  }

  if (goodAdSets.length > 0) {
      markdown += `🟢 **مجموعات رابحة (خاصها تتزاد):**\n`;
      goodAdSets.sort((a,b) => isEcommerce ? b.roas - a.roas : a.cpa - b.cpa).slice(0, 3).forEach(set => {
          if(isEcommerce) {
             markdown += `- \`${set.name}\`: ROAS **${set.roas.toFixed(2)}**.\n`;
          } else {
             markdown += `- \`${set.name}\`: CPA رخيص **$${set.cpa.toFixed(2)}**.\n`;
          }
      });
  } else {
      markdown += `ما كاينش فرق كبير بين الـ AdSets. ركز على تحسين الإعلانات (Creatives) داخل المجموعات.\n`;
  }
  markdown += `\n---\n\n`;

  // --- Creatives Analysis Section (NEW) ---
  markdown += `### 🎨 تحليل الكرياتيف (Creatives)\n`;
  markdown += `هنا جمعنا الإعلانات اللي عندها نفس السمية (Ad Name) باش نعرفو أشنو اللي خدام ف ديزاين/فيديو.\n\n`;

  if (bestCreatives.length > 0) {
      markdown += `✅ **أفضل الكرياتيفات (Scale It):**\n`;
      bestCreatives.slice(0, 3).forEach(c => {
         if (isEcommerce) {
             markdown += `- \`${c.name}\`: جاب ROAS واعر **${c.roas.toFixed(2)}** وصرف **$${c.spend.toFixed(2)}**.\n`;
         } else {
             markdown += `- \`${c.name}\`: جاب نتائج رخيصة بـ **$${c.cpa.toFixed(2)}** (مجموع ${c.results} نتيجة).\n`;
         }
      });
      markdown += `\n`;
  }

  if (worstCreatives.length > 0) {
      markdown += `🚫 **كرياتيفات عيانة (Kill It):**\n`;
      worstCreatives.slice(0, 3).forEach(c => {
          if (c.results === 0) {
              markdown += `- \`${c.name}\`: صرف **$${c.spend.toFixed(2)}** وماجاب والو (0 Results).\n`;
          } else if (isEcommerce) {
              markdown += `- \`${c.name}\`: ROAS طايح **${c.roas.toFixed(2)}** واخا صرف **$${c.spend.toFixed(2)}**.\n`;
          } else {
              markdown += `- \`${c.name}\`: النتيجة غالية بزاف **$${c.cpa.toFixed(2)}**.\n`;
          }
      });
      markdown += `\n`;
  }

  if (bestCreatives.length === 0 && worstCreatives.length === 0) {
      markdown += `مازال ماكاينش داتا كافية باش نحكمو على الكرياتيف. خلي الحملة تزيد تخدم شوية.\n`;
  }
  
  markdown += `\n---\n\n`;

  // --- Ads Analysis Section (Individual Rows) ---
  markdown += `### 🛑 شنو خاصك تحبس (Individual Ads)\n`;
  if (zeroResultAds.length > 0 || badAds.length > 0) {
      markdown += `ضيعتي تقريبا **$${wastedBudget.toFixed(2)}** ف إعلانات فردية عيانة:\n\n`;
      
      if (zeroResultAds.length > 0) {
        markdown += `**1. إعلانات خسرات فلوس بلا نتيجة (Zero Results):**\n`;
        zeroResultAds.sort((a,b) => b.amountSpent - a.amountSpent).slice(0, 5).forEach(ad => {
             markdown += `- \`${ad.adName}\` (فـ ${ad.adSetName}): خسرات **$${ad.amountSpent.toFixed(2)}**.\n`;
        });
        markdown += `\n`;
      }

      if (badAds.length > 0) {
        markdown += `**2. إعلانات غالية بزاف (Bad Performance):**\n`;
        badAds.sort((a,b) => isEcommerce ? a.roas - b.roas : b.costPerResult - a.costPerResult).slice(0, 5).forEach(ad => {
            if (isEcommerce) {
                 markdown += `- \`${ad.adName}\`: جابت ROAS عيان **${ad.roas.toFixed(2)}**.\n`;
            } else {
                 markdown += `- \`${ad.adName}\`: النتيجة طالعة بـ **$${ad.costPerResult.toFixed(2)}**.\n`;
            }
        });
      }
  } else {
      markdown += `🎉 مبروك! ما عندكش شي إعلانات خايبة بزاف فالمستوى الفردي.\n`;
  }
  markdown += `\n\n---\n\n`;

  // What to Scale (Ads)
  markdown += `### 🚀 أفضل الإعلانات (Top Individual Ads)\n`;
  if (goodAds.length > 0) {
      markdown += `هاد الإعلانات هي "الهمزة" ديالك:\n\n`;
      goodAds.sort((a,b) => isEcommerce ? b.roas - a.roas : a.costPerResult - b.costPerResult).slice(0, 5).forEach(ad => {
          if (isEcommerce) {
              markdown += `- \`${ad.adName}\`: ROAS **${ad.roas.toFixed(2)}**.\n`;
          } else {
              markdown += `- \`${ad.adName}\`: رخيصة **$${ad.costPerResult.toFixed(2)}** وجايبة **${ad.results}** نتيجة.\n`;
          }
      });
      markdown += `\n💡 **نصيحة:** حاول تدير Duplicate لهاد الإعلانات ف Campaign جديدة.\n`;
  } else {
      markdown += `مزال ما بانوش Winners واضحين.\n`;
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