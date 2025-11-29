import { AdData, AnalysisResult } from '../types';

export const analyzeAds = async (data: AdData[]): Promise<AnalysisResult> => {
  // Simulate async processing
  await new Promise(resolve => setTimeout(resolve, 100));

  // --- 1. Global Metrics Calculation ---
  const totalSpent = data.reduce((sum, item) => sum + item.amountSpent, 0);
  const totalRevenue = data.reduce((sum, item) => sum + (item.amountSpent * item.roas), 0);
  const totalResults = data.reduce((sum, item) => sum + item.results, 0);
  
  // Averages
  const avgRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;
  const avgCpa = totalResults > 0 ? totalSpent / totalResults : 0;
  
  // Detect Context
  const counts: Record<string, number> = {};
  for (const item of data) {
    counts[item.resultType] = (counts[item.resultType] || 0) + 1;
  }
  const dominantResultType = Object.keys(counts).reduce((a, b) => 
    (counts[a] > counts[b] ? a : b), 'generic'
  );
  
  const isEcommerce = avgRoas > 0.5 || dominantResultType === 'purchase';

  // --- 2. Dynamic Thresholds ---
  // We use the account average as a baseline.
  // Good = Significantly better than average.
  // Bad = Significantly worse than average.
  
  const roasThreshold = {
      good: avgRoas * 1.2, // 20% better than avg
      bad: avgRoas * 0.8   // 20% worse than avg
  };
  
  const cpaThreshold = {
      good: avgCpa > 0 ? avgCpa * 0.8 : 0, // 20% cheaper than avg
      bad: avgCpa > 0 ? avgCpa * 1.3 : 0   // 30% more expensive than avg
  };

  // Spend Significance: Don't judge too early.
  // If avgCpa exists, use it. Otherwise use average spend per ad as a proxy.
  const significanceThreshold = avgCpa > 0 ? avgCpa : (totalSpent / (data.length || 1));

  // --- 3. Aggregation (AdSet & Creative) ---
  interface AggregatedMetrics {
    name: string;
    spend: number;
    revenue: number;
    results: number;
    impressions: number;
    clicks: number;
    roas: number;
    cpa: number;
    ctr: number;
    cpc: number;
  }

  const aggregate = (keyFn: (d: AdData) => string) => {
    const map: Record<string, AggregatedMetrics> = {};
    data.forEach(item => {
        const key = keyFn(item);
        if (!map[key]) {
            map[key] = { 
                name: key, spend: 0, revenue: 0, results: 0, 
                impressions: 0, clicks: 0, roas: 0, cpa: 0, ctr: 0, cpc: 0 
            };
        }
        map[key].spend += item.amountSpent;
        map[key].revenue += (item.amountSpent * item.roas);
        map[key].results += item.results;
        map[key].impressions += item.impressions;
        map[key].clicks += item.clicks;
    });
    return Object.values(map).map(item => ({
        ...item,
        roas: item.spend > 0 ? item.revenue / item.spend : 0,
        cpa: item.results > 0 ? item.spend / item.results : 0,
        ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
        cpc: item.clicks > 0 ? item.spend / item.clicks : 0
    }));
  };

  const adSets = aggregate(d => d.adSetName || 'Unknown AdSet');
  const creatives = aggregate(d => d.adName || 'Unknown Creative');

  // --- 4. Deep Segmentation Logic (The Core) ---
  
  // A. Zombies: Spent money (significant amount) but 0 results.
  const zombies = data.filter(d => d.results === 0 && d.amountSpent > (significanceThreshold * 0.5));
  
  // B. Bleeders: High Spend + Bad Performance (Kill immediately).
  const bleeders = data.filter(d => {
      if (d.results === 0) return false; // Handled by zombies
      if (d.amountSpent < significanceThreshold) return false; // Not enough data yet
      
      if (isEcommerce) return d.roas < roasThreshold.bad;
      return d.costPerResult > cpaThreshold.bad;
  });

  // C. Winners (Scale): High Spend + Good Performance.
  const winners = data.filter(d => {
      if (d.results === 0) return false;
      if (d.amountSpent < significanceThreshold) return false; // Needs volume
      
      if (isEcommerce) return d.roas >= roasThreshold.good;
      return d.costPerResult <= cpaThreshold.good;
  });

  // D. Potentials: Low Spend + Good Performance (Test more).
  const potentials = data.filter(d => {
      if (d.results === 0) return false;
      if (d.amountSpent >= significanceThreshold) return false; // Already scaled
      
      if (isEcommerce) return d.roas >= avgRoas; // At least average
      return d.costPerResult <= avgCpa; // At least average
  });

  // Creative Analysis (Aggregated)
  const topCreatives = creatives
    .filter(c => c.spend > significanceThreshold && (isEcommerce ? c.roas > avgRoas : c.cpa < avgCpa))
    .sort((a,b) => isEcommerce ? b.roas - a.roas : a.cpa - b.cpa);

  const badCreatives = creatives
    .filter(c => c.spend > significanceThreshold && (isEcommerce ? c.roas < roasThreshold.bad : c.cpa > cpaThreshold.bad))
    .sort((a,b) => b.spend - a.spend);


  // --- 5. Generate Markdown Report in Darija ---
  let markdown = `## 📊 تقرير التحليل المعمق\n\n`;

  // Section 1: Health Check
  markdown += `### 🏥 الحالة العامة للحساب\n`;
  markdown += `صرفتي فالمجموع **$${totalSpent.toLocaleString(undefined, {maximumFractionDigits:0})}** وجبتي **${totalResults}** نتيجة.\n`;
  
  if (totalResults === 0) {
      markdown += `⚠️ **مشكل كبير:** مازال ما جبتي حتى نتيجة (Sales/Leads). تأكد واش الـ Pixel خدام مزيان أو واش الـ Offer ديالك مطلوب.\n`;
  } else if (isEcommerce) {
      markdown += `- **Moyenne ROAS:** ${avgRoas.toFixed(2)}. \n`;
      markdown += `- **Break-even:** نتا اللي عارف المارج ديالك، ولكن أي حاجة تحت **${(avgRoas * 0.8).toFixed(2)}** كتعتبر عيانة مقارنة بالمعدل ديالك.\n`;
  } else {
      markdown += `- **Moyenne CPA:** $${avgCpa.toFixed(2)}. \n`;
      markdown += `- أي نتيجة كتقام عليك بأكثر من **$${cpaThreshold.bad.toFixed(2)}** راها غالية بزاف.\n`;
  }
  markdown += `\n---\n\n`;

  // Section 2: Actionable Ads Analysis
  markdown += `### 🚦 الإجراءات اللي خاصك دير دابا (Action Plan)\n\n`;

  // 1. KILL (Zombies & Bleeders)
  if (zombies.length > 0 || bleeders.length > 0) {
      markdown += `#### 🛑 حبس هادشي دابا (Kill)\n`;
      markdown += `هاد الإعلانات كتحرق ليك الفلوس بلا فايدة:\n`;
      
      if (zombies.length > 0) {
          markdown += `**💀 إعلانات ميتة (0 Results):**\n`;
          zombies.sort((a,b) => b.amountSpent - a.amountSpent).slice(0, 3).forEach(ad => {
              markdown += `- \`${ad.adName}\`: كلات **$${ad.amountSpent.toFixed(2)}** وماجابت والو.\n`;
          });
      }
      
      if (bleeders.length > 0) {
          markdown += `**💸 إعلانات خاسرة (High CPA/Low ROAS):**\n`;
          bleeders.sort((a,b) => isEcommerce ? a.roas - b.roas : b.costPerResult - a.costPerResult).slice(0, 3).forEach(ad => {
             const metric = isEcommerce ? `ROAS: ${ad.roas.toFixed(2)}` : `CPA: $${ad.costPerResult.toFixed(2)}`;
             markdown += `- \`${ad.adName}\`: صرفات **$${ad.amountSpent.toFixed(2)}** ولكن ${metric}.\n`;
          });
      }
      markdown += `\n`;
  }

  // 2. SCALE (Winners)
  if (winners.length > 0) {
      markdown += `#### 🔥 زيد فالبيجي لهادو (Scale)\n`;
      markdown += `هادو هما الـ Winners ديالك، خدامين مزيان وصارفين تبارك الله:\n`;
      winners.sort((a,b) => isEcommerce ? b.roas - a.roas : a.costPerResult - b.costPerResult).slice(0, 3).forEach(ad => {
          const metric = isEcommerce ? `ROAS: ${ad.roas.toFixed(2)}` : `CPA: $${ad.costPerResult.toFixed(2)}`;
          markdown += `- \`${ad.adName}\`: ${metric} (Results: ${ad.results}).\n`;
      });
      markdown += `*نصيحة: زيد فالميزانية بـ 20% كل 2-3 أيام باش ما تخسرش الـ Optimization.*\n\n`;
  }

  // 3. POTENTIAL (Test)
  if (potentials.length > 0) {
      markdown += `#### 💎 عطيهم فرصة (Potentials)\n`;
      markdown += `هاد الإعلانات يالاه بدات ولكن المؤشرات ديالها خضرا. حاول تصبر عليها شوية:\n`;
      potentials.sort((a,b) => isEcommerce ? b.roas - a.roas : a.costPerResult - b.costPerResult).slice(0, 3).forEach(ad => {
           const metric = isEcommerce ? `ROAS: ${ad.roas.toFixed(2)}` : `CPA: $${ad.costPerResult.toFixed(2)}`;
           markdown += `- \`${ad.adName}\`: صرفات قليل ($${ad.amountSpent.toFixed(2)}) ولكن ${metric} مزيان.\n`;
      });
      markdown += `\n`;
  }

  markdown += `---\n\n`;

  // Section 3: Creative & AdSet Insights
  markdown += `### 🧠 تحليل الكرياتيف و المجموعات\n\n`;
  
  // AdSets
  markdown += `**📂 المجموعات (AdSets):**\n`;
  const winningSets = adSets.filter(s => isEcommerce ? s.roas > avgRoas : s.cpa < avgCpa);
  if (winningSets.length > 0) {
      const topSet = winningSets.sort((a,b) => isEcommerce ? b.roas - a.roas : a.cpa - b.cpa)[0];
      markdown += `- أحسن AdSet هي \`${topSet.name}\` بـ ${isEcommerce ? 'ROAS ' + topSet.roas.toFixed(2) : 'CPA $' + topSet.cpa.toFixed(2)}.\n`;
  } else {
      markdown += `- جميع الـ AdSets الأداء ديالها متقارب أو طايح.\n`;
  }

  // Creatives
  markdown += `\n**🎨 الكرياتيف (Ads):**\n`;
  if (topCreatives.length > 0) {
      markdown += `أحسن فورما/فيديو خدام ليك هو \`${topCreatives[0].name}\`. \n`;
      markdown += `حاول تصاوب إعلانات جديدة كتشبه لهاد الستيل (نفس الـ Hook أو الزاوية الإعلانية).\n`;
  } else if (badCreatives.length > 0) {
       markdown += `الكرياتيف \`${badCreatives[0].name}\` عيان بزاف. بدلو دغيا.\n`;
  }
  
  markdown += `\n`;

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