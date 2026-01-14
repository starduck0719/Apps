import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Search, 
  ChefHat, 
  Clock, 
  Utensils, 
  Check, 
  Star,
  Filter,
  Image as ImageIcon,
  AlertCircle,
  Settings,
  Key,
  X,
  ExternalLink
} from 'lucide-react';

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
  rating: number; 
  reviewCount: string; 
  imageUrl?: string; 
}

interface FilterState {
  cuisine: string;
  timeLimit: string;
  difficulty: string;
  mainIngredient: string;
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

// --- Components ---

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick }) => (
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
  
  // API Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  // Initialize API Key
  useEffect(() => {
    // 1. Try LocalStorage
    const localKey = localStorage.getItem('gemini_api_key');
    // 2. Try Environment Variable (if built/injected)
    const envKey = process.env.API_KEY;

    if (localKey) {
      setApiKey(localKey);
    } else if (envKey) {
      setApiKey(envKey);
    } else {
      // If no key found anywhere, prompt user
      setShowSettings(true);
    }
  }, []);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const input = (document.getElementById('apiKeyInput') as HTMLInputElement).value.trim();
    if (input) {
      localStorage.setItem('gemini_api_key', input);
      setApiKey(input);
      setShowSettings(false);
      setError(null);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    // Optionally keep settings open so they can enter a new one
  };

  const handleSearch = async () => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    if (!query.trim() && !filters.mainIngredient) {
      setError('请输入菜名或主要食材');
      return;
    }

    setLoading(true);
    setError(null);
    setRecipe(null);

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      const filterDesc = [
        filters.cuisine ? `菜系: ${filters.cuisine}` : '',
        filters.timeLimit ? `时间限制: ${filters.timeLimit}` : '',
        filters.difficulty ? `难度: ${filters.difficulty}` : '',
        filters.mainIngredient ? `主要食材: ${filters.mainIngredient}` : ''
      ].filter(Boolean).join(', ');

      const userPrompt = `Wait, act as a professional recipe aggregator for Chinese users. 
      Target Dish: "${query || filters.mainIngredient}". 
      Constraints: ${filterDesc}.
      
      Task: Search data from Xiaohongshu, Bilibili, and Xiachufang to find the "Best" recipe.
      
      REQUIREMENTS:
      1. Output language: Simplified Chinese.
      2. Mention sources in 'summary'.
      3. Return strict JSON.
      `;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          cuisine: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          totalTime: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          rating: { type: Type.NUMBER },
          reviewCount: { type: Type.STRING }
        },
        required: ["title", "summary", "ingredients", "steps"]
      };

      const textResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: userPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        }
      });

      const data = JSON.parse(textResponse.text || '{}') as Recipe;
      
      let generatedImageUrl = undefined;
      try {
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: `A high-quality, professional food photo of ${data.title}. Appetizing, restaurant style, 4k, bokeh background.` }]
          },
          config: {
            imageConfig: { aspectRatio: "16:9" }
          }
        });

        if (imageResponse.candidates?.[0]?.content?.parts) {
          const part = imageResponse.candidates[0].content.parts.find(p => p.inlineData);
          if (part?.inlineData) {
            generatedImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
      } catch (imgErr) {
        console.warn("Image generation failed, proceeding with text only", imgErr);
      }

      setRecipe({ ...data, imageUrl: generatedImageUrl });

    } catch (err: any) {
      console.error("API Error:", err);
      if (err.message?.includes('403') || err.message?.includes('API_KEY_INVALID')) {
         setError('API Key 无效。请检查设置。');
         setShowSettings(true);
      } else if (err.message?.includes('429')) {
        setError('请求太频繁了，请稍后再试。');
      } else {
        setError(`生成失败: ${err.message || '未知错误'}`);
      }
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
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-10 flex flex-col items-center">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 sticky top-0 z-50 shadow-md w-full">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-8 h-8" />
            <h1 className="text-xl font-bold tracking-wide">智厨搜珍</h1>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-emerald-700 rounded-full hover:bg-emerald-800 transition-colors"
          >
            <Settings className="w-5 h-5 text-emerald-100" />
          </button>
        </div>
      </header>

      <main className="w-full max-w-3xl p-4 space-y-6">
        
        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-scaleIn">
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="flex flex-col items-center mb-6">
                <div className="bg-emerald-100 p-3 rounded-full mb-3">
                  <Key className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">API Key 设置</h3>
                <p className="text-sm text-gray-500 text-center mt-2">
                  为了在浏览器中直接访问 Gemini，请配置您的 API Key。<br/>
                  <span className="text-xs text-gray-400">(Key 仅存储在您的设备本地，不会上传)</span>
                </p>
              </div>

              <form onSubmit={handleSaveKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Google Gemini API Key</label>
                  <input 
                    id="apiKeyInput"
                    type="password" 
                    placeholder="AIzaSy..." 
                    defaultValue={apiKey}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono text-sm"
                  />
                </div>
                
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-200"
                >
                  保存配置
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-emerald-600 font-medium flex items-center gap-1 hover:underline"
                >
                  获取免费 Key <ExternalLink className="w-3 h-3"/>
                </a>
                {apiKey && (
                  <button onClick={handleClearKey} className="text-red-500 hover:text-red-700 font-medium">
                    清除本地 Key
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter Section */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <div className="relative">
            <input
              type="text"
              className="w-full bg-gray-100 border-none rounded-xl py-3 pl-12 pr-4 text-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              placeholder="输入菜名，AI为您全网优选..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 font-medium">定制偏好</span>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="text-emerald-600 text-sm font-medium flex items-center gap-1 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? '隐藏筛选' : '更多筛选'}
            </button>
          </div>

          {showFilters && (
            <div className="space-y-4 pt-2 border-t border-gray-50 animate-fadeIn">
               <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">菜系风格</label>
                <div className="flex flex-wrap gap-2">
                  {['川菜', '粤菜', '湘菜', '日韩', '西餐', '快手菜'].map(c => (
                    <FilterChip key={c} label={c} active={filters.cuisine === c} onClick={() => toggleFilter('cuisine', c)} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">烹饪难度</label>
                <div className="flex flex-wrap gap-2">
                  {['新手', '进阶', '大厨'].map(d => (
                    <FilterChip key={d} label={d} active={filters.difficulty === d} onClick={() => toggleFilter('difficulty', d)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
              ${loading ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'}`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>AI 正在汇总最佳菜谱...</span>
              </>
            ) : (
              <span>开始搜寻最佳菜谱</span>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-start gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">生成遇到问题</p>
              <p className="opacity-80">{error}</p>
              {error.includes('Key') && (
                <button 
                  onClick={() => setShowSettings(true)}
                  className="mt-2 text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold hover:bg-red-200"
                >
                  点击检查 Key 设置
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {recipe && !loading && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden animate-slideUp">
            <div className="relative w-full aspect-video bg-gray-200">
              {recipe.imageUrl ? (
                 <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2">
                  <ImageIcon className="w-10 h-10 opacity-30"/>
                  <span className="text-xs">图片生成已跳过</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
               <div className="absolute bottom-0 left-0 p-6 text-white w-full">
                <div className="flex items-center gap-2 mb-2">
                   <div className="bg-emerald-500 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">Top Rated</div>
                   <div className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold border border-white/30 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> {recipe.rating || '4.9'}
                  </div>
                </div>
                <h2 className="text-2xl font-black mb-1">{recipe.title}</h2>
                <div className="flex items-center gap-4 text-xs font-medium opacity-80">
                   <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {recipe.totalTime}</span>
                   <span className="flex items-center gap-1"><Utensils className="w-3 h-3"/> {recipe.difficulty}</span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                 <h3 className="text-xs font-black text-emerald-800 uppercase mb-2 tracking-widest flex items-center gap-2">
                   <Check className="w-4 h-4" /> 专家推荐理由
                 </h3>
                 <p className="text-sm text-emerald-900 leading-relaxed italic">"{recipe.summary}"</p>
              </div>

              <div>
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-emerald-500 rounded-full"></span>
                  食材清单
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {recipe.ingredients.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm font-medium text-gray-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-emerald-500 rounded-full"></span>
                  详细步骤
                </h3>
                <div className="space-y-4">
                  {recipe.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gray-900 text-white text-[10px] font-black flex items-center justify-center mt-1">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed pt-1">{step}</p>
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