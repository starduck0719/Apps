import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { 
  Search, 
  ChefHat, 
  Clock, 
  Flame, 
  Utensils, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Star,
  ArrowRight,
  Filter,
  Image as ImageIcon
} from 'lucide-react';

// --- Configuration ---
// API Key is accessed via process.env.API_KEY directly in the component.

// --- Types ---

interface Recipe {
  title: string;
  summary: string;
  cuisine: string;
  difficulty: string;
  totalTime: string;
  calories: number;
  ingredients: string[];
  steps: string[];
  rating: number; // Simulated rating based on "web data"
  reviewCount: string; // Simulated review count
  imageUrl?: string; // New field for the generated image
}

interface FilterState {
  cuisine: string;
  timeLimit: string;
  difficulty: string;
  mainIngredient: string;
}

// --- Components ---

const FilterChip = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border
      ${active 
        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'}`}
  >
    {label}
  </button>
);

const App = () => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    cuisine: '',
    timeLimit: '',
    difficulty: '',
    mainIngredient: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim() && !filters.mainIngredient) {
      setError('请输入菜名或主要食材');
      return;
    }

    setLoading(true);
    setError(null);
    setRecipe(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const filterDesc = [
        filters.cuisine ? `菜系: ${filters.cuisine}` : '',
        filters.timeLimit ? `时间限制: ${filters.timeLimit}` : '',
        filters.difficulty ? `难度: ${filters.difficulty}` : '',
        filters.mainIngredient ? `主要食材: ${filters.mainIngredient}` : ''
      ].filter(Boolean).join(', ');

      // 1. Text Generation Prompt (Enforcing Chinese and specific sources)
      const userPrompt = `Wait, act as a professional recipe aggregator for Chinese users. 
      Target Dish: "${query}". 
      Constraints: ${filterDesc}.
      
      Task: Search your internal database simulating data from **Xiaohongshu (Little Red Book)**, **Bilibili**, and **Xiachufang** to find the "Best" version of this dish based on high view counts, high ratings, and positive reviews. 
      Synthesize a recipe that combines the best techniques from these top-rated sources.
      
      REQUIREMENTS:
      1. **Output language must be Simplified Chinese (简体中文).**
      2. The 'summary' field must explicitly mention the data sources (e.g., "综合了小红书百万点赞笔记和下厨房金牌菜谱...").
      3. Return the result in strict JSON format.
      `;

      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "The name of the dish in Chinese" },
          summary: { type: Type.STRING, description: "Explanation of why this is the best recipe, mentioning sources like Xiaohongshu/Bilibili/Xiachufang" },
          cuisine: { type: Type.STRING, description: "Cuisine type (e.g. 川菜)" },
          difficulty: { type: Type.STRING, description: "Difficulty level (e.g. 简单)" },
          totalTime: { type: Type.STRING, description: "Total cooking time" },
          calories: { type: Type.NUMBER, description: "Estimated calories" },
          ingredients: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of ingredients with quantities"
          },
          steps: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Step by step instructions"
          },
          rating: { type: Type.NUMBER, description: "Simulated rating (e.g. 4.9)" },
          reviewCount: { type: Type.STRING, description: "Simulated review count (e.g. '10w+')" }
        },
        required: ["title", "summary", "cuisine", "difficulty", "totalTime", "ingredients", "steps", "rating"]
      };

      // 2. Execute Requests in Parallel
      const textRequest = ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        }
      });

      const imageRequest = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `A professional, appetizing, high-resolution food photography shot of ${query}. 4k, delicious, cinematic lighting, closeup, food magazine style.` }]
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9"
          }
        }
      });

      const [textResponse, imageResponse] = await Promise.all([textRequest, imageRequest]);

      // 3. Process Text Response
      const jsonText = textResponse.text;
      let data: Recipe | null = null;
      if (jsonText) {
        data = JSON.parse(jsonText) as Recipe;
      } else {
        throw new Error("Text generation failed");
      }

      // 4. Process Image Response
      let generatedImageUrl = undefined;
      if (imageResponse.candidates?.[0]?.content?.parts) {
        for (const part of imageResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            generatedImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      // Combine Data
      if (data) {
        setRecipe({ ...data, imageUrl: generatedImageUrl });
      }

    } catch (err) {
      console.error(err);
      setError('生成失败，请检查网络或重试。');
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key] === value ? '' : value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-10">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-8 h-8" />
            <h1 className="text-xl font-bold tracking-wide">智厨搜珍</h1>
          </div>
          <div className="text-emerald-100 text-xs font-medium bg-emerald-700 px-2 py-1 rounded">
            AI 驱动
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        
        {/* Search & Filter Section */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <div className="relative">
            <input
              type="text"
              className="w-full bg-gray-100 border-none rounded-xl py-3 pl-12 pr-4 text-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              placeholder="想吃什么？例如：宫保鸡丁"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 font-medium">筛选条件</span>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="text-emerald-600 text-sm font-medium flex items-center gap-1 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? '收起' : '展开'}
            </button>
          </div>

          {showFilters && (
            <div className="space-y-4 pt-2 animate-fadeIn">
               {/* Cuisine */}
               <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">菜系</label>
                <div className="flex flex-wrap gap-2">
                  {['川菜', '粤菜', '湘菜', '鲁菜', '日式', '西餐', '家常菜'].map(c => (
                    <FilterChip 
                      key={c} 
                      label={c} 
                      active={filters.cuisine === c} 
                      onClick={() => toggleFilter('cuisine', c)} 
                    />
                  ))}
                </div>
              </div>

              {/* Time */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">烹饪时间</label>
                <div className="flex flex-wrap gap-2">
                  {['15分钟内', '30分钟内', '1小时内', '慢炖'].map(t => (
                    <FilterChip 
                      key={t} 
                      label={t} 
                      active={filters.timeLimit === t} 
                      onClick={() => toggleFilter('timeLimit', t)} 
                    />
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">难度</label>
                <div className="flex flex-wrap gap-2">
                  {['简单', '中等', '困难/大厨'].map(d => (
                    <FilterChip 
                      key={d} 
                      label={d} 
                      active={filters.difficulty === d} 
                      onClick={() => toggleFilter('difficulty', d)} 
                    />
                  ))}
                </div>
              </div>

              {/* Main Ingredient */}
               <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">主要食材</label>
                <div className="flex gap-2">
                   <input 
                    type="text" 
                    placeholder="例如：鸡肉、豆腐..." 
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    value={filters.mainIngredient}
                    onChange={(e) => setFilters({...filters, mainIngredient: e.target.value})}
                   />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-2
              ${loading ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]'}`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>AI 正在全网搜寻并绘图...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>生成最佳方案</span>
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center text-sm font-medium animate-fadeIn">
            {error}
          </div>
        )}

        {/* Results */}
        {recipe && !loading && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-slideUp">
            
            {/* Generated Image */}
            <div className="relative w-full aspect-video bg-gray-200 overflow-hidden group">
              {recipe.imageUrl ? (
                 <img 
                  src={recipe.imageUrl} 
                  alt={recipe.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                 />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2">
                  <ImageIcon className="w-10 h-10 opacity-50"/>
                  <span className="text-xs">图片生成中或暂无图片</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
              
               <div className="absolute bottom-0 left-0 p-6 text-white w-full">
                <div className="flex items-center gap-2 mb-2">
                   <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold border border-white/30 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {recipe.rating} ({recipe.reviewCount} 评价)
                  </div>
                </div>
                <h2 className="text-3xl font-bold mb-1 shadow-black drop-shadow-lg">{recipe.title}</h2>
                <div className="flex flex-wrap gap-2 text-sm opacity-90 font-medium">
                   <span className="flex items-center gap-1"><Utensils className="w-3 h-3"/> {recipe.cuisine}</span>
                   <span>•</span>
                   <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {recipe.totalTime}</span>
                   <span>•</span>
                   <span className="flex items-center gap-1"><Flame className="w-3 h-3"/> {recipe.calories} kcal</span>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100">
               <div className="flex gap-3">
                 <div className="mt-1 min-w-[24px]">
                   <div className="w-6 h-6 bg-emerald-200 rounded-full flex items-center justify-center text-emerald-800">
                     <ChefHat className="w-3.5 h-3.5" />
                   </div>
                 </div>
                 <div>
                   <h3 className="text-xs font-bold text-emerald-800 uppercase mb-1">推荐理由 & 数据来源</h3>
                   <p className="text-sm text-emerald-900 leading-relaxed">{recipe.summary}</p>
                 </div>
               </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Ingredients */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                  食材清单
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recipe.ingredients.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="w-5 h-5 rounded-full border-2 border-emerald-200 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                      </div>
                      <span className="text-gray-700 font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Steps */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                  烹饪步骤
                </h3>
                <div className="space-y-6">
                  {recipe.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <div className="flex-shrink-0 flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center border-2 border-emerald-200 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-colors">
                          {idx + 1}
                        </div>
                        {idx !== recipe.steps.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 my-2 rounded-full"></div>
                        )}
                      </div>
                      <div className="pb-2">
                        <p className="text-gray-700 leading-relaxed pt-1">{step}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
