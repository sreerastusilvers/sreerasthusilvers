import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Copy,
  Check,
  Loader2,
  Gem,
  Image as ImageIcon,
  Wand2,
  ChevronDown,
  RefreshCw,
  Upload,
  X,
  Shield,
  Camera,
  Gift,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  generateProductModelPrompt,
  generateProductStudioPrompt,
  generateHeroSectionPrompt,
  generateCustomImagePrompt,
  generateVariationPrompt,
  refinePrompt,
  type ImageInput,
} from '@/services/geminiService';

type PromptCategory = 'product-model' | 'product-studio' | 'hero-section' | 'custom';

interface GeneratedPrompt {
  id: string;
  category: PromptCategory;
  prompt: string;
  inputs: Record<string, string>;
  timestamp: Date;
}

// ─── Image Upload Helper ─────────────────────────────────────────────────

function fileToImageInput(file: File): Promise<ImageInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function urlToImageInput(url: string): Promise<ImageInput> {
  const res = await fetch(url);
  const blob = await res.blob();
  return fileToImageInput(new File([blob], 'logo.png', { type: blob.type }));
}

// ─── Drop Zone Component ─────────────────────────────────────────────────

function ImageDropZone({
  label,
  image,
  preview,
  onSelect,
  onClear,
  hint,
  required,
}: {
  label: string;
  image: ImageInput | null;
  preview: string;
  onSelect: (file: File) => void;
  onClear: () => void;
  hint?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) onSelect(file);
      else toast.error('Please drop an image file');
    },
    [onSelect]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelect(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {image && preview ? (
        <div className="relative group rounded-lg border border-[#F5EFE6] overflow-hidden bg-gray-50">
          <img src={preview} alt="preview" className="w-full h-36 object-contain bg-white" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-amber-500 bg-amber-50'
              : required
                ? 'border-amber-300 hover:border-amber-500 hover:bg-[#FFF9E6]/30 bg-[#FFF9E6]/10'
                : 'border-[#F5EFE6] hover:border-amber-400 hover:bg-[#FFF9E6]/30'
          }`}
        >
          <Upload className="h-6 w-6 mx-auto text-gray-400 mb-1.5" />
          <p className="text-xs text-gray-500">
            Drop image or <span className="text-amber-600 font-medium">click to upload</span>
          </p>
          {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

// ─── Multi-Image Drop Zone (Hero) ────────────────────────────────────────

function HeroImageDropZone({
  onSelectMultiple,
  onSelectSingle,
  imageCount,
}: {
  onSelectMultiple: (files: FileList) => void;
  onSelectSingle: (file: File) => void;
  imageCount: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 1) {
        onSelectMultiple(files);
      } else if (files.length === 1 && files[0].type.startsWith('image/')) {
        onSelectSingle(files[0]);
      } else {
        toast.error('Please drop image files');
      }
    },
    [onSelectMultiple, onSelectSingle]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onSelectMultiple(files);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-amber-500 bg-amber-50'
            : 'border-[#F5EFE6] hover:border-amber-400 hover:bg-[#FFF9E6]/30'
        }`}
      >
        <Upload className="h-5 w-5 mx-auto text-gray-400 mb-1" />
        <p className="text-xs text-gray-500">
          {imageCount === 0
            ? <>Drop images or <span className="text-amber-600 font-medium">click to upload</span> (select multiple)</>
            : <>Add more images — <span className="text-amber-600 font-medium">click or drop</span></>
          }
        </p>
        <p className="text-[10px] text-gray-400 mt-1">
          Upload jewelry products, style references, banner inspiration — AI studies all and creates one banner
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

const AdminImagePrompts = () => {
  const [activeTab, setActiveTab] = useState<PromptCategory>('product-model');
  const [loading, setLoading] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<GeneratedPrompt[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Refine / Variation state
  const [refineText, setRefineText] = useState('');
  const [refining, setRefining] = useState(false);
  const [variationLoading, setVariationLoading] = useState(false);

  // Hero section form state
  const [festivalOrEvent, setFestivalOrEvent] = useState('');
  const [offerTitle, setOfferTitle] = useState('');
  const [offerInfo, setOfferInfo] = useState('');
  const [bannerHeadline, setBannerHeadline] = useState('');
  const [includeModel, setIncludeModel] = useState<'auto' | 'yes' | 'no'>('auto');

  // Custom form state
  const [customRequirement, setCustomRequirement] = useState('');
  const [customImageType, setCustomImageType] = useState('Product Photography');

  // Image upload state
  const [productImage, setProductImage] = useState<ImageInput | null>(null);
  const [productPreview, setProductPreview] = useState('');
  const [logoImage, setLogoImage] = useState<ImageInput | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [referenceImage, setReferenceImage] = useState<ImageInput | null>(null);
  const [referencePreview, setReferencePreview] = useState('');
  // Hero multi-image state
  const [heroImages, setHeroImages] = useState<ImageInput[]>([]);
  const [heroPreviews, setHeroPreviews] = useState<string[]>([]);

  // Auto-load logo
  useEffect(() => {
    urlToImageInput('/logo-new.png')
      .then((img) => {
        setLogoImage(img);
        setLogoPreview('/logo-new.png');
      })
      .catch(() => {
        // logo-new.png not found, user can upload manually
      });
  }, []);

  const handleProductImageSelect = async (file: File) => {
    const img = await fileToImageInput(file);
    setProductImage(img);
    setProductPreview(URL.createObjectURL(file));
  };

  const handleReferenceImageSelect = async (file: File) => {
    const img = await fileToImageInput(file);
    setReferenceImage(img);
    setReferencePreview(URL.createObjectURL(file));
  };

  const handleHeroImageAdd = async (file: File) => {
    const img = await fileToImageInput(file);
    setHeroImages(prev => [...prev, img]);
    setHeroPreviews(prev => [...prev, URL.createObjectURL(file)]);
  };

  const handleHeroImageAddMultiple = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const img = await fileToImageInput(file);
        setHeroImages(prev => [...prev, img]);
        setHeroPreviews(prev => [...prev, URL.createObjectURL(file)]);
      }
    }
  };

  const handleHeroImageRemove = (index: number) => {
    setHeroImages(prev => prev.filter((_, i) => i !== index));
    setHeroPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleLogoSelect = async (file: File) => {
    const img = await fileToImageInput(file);
    setLogoImage(img);
    setLogoPreview(URL.createObjectURL(file));
  };

  const tabs = [
    { id: 'product-model' as PromptCategory, label: 'Product + Model', icon: Gem, description: 'Jewelry on celebrity-level model' },
    { id: 'product-studio' as PromptCategory, label: 'Studio Product', icon: Camera, description: 'Clean studio product shots' },
    { id: 'hero-section' as PromptCategory, label: 'Hero Banners', icon: Gift, description: 'Festival / Offer hero banners' },
    { id: 'custom' as PromptCategory, label: 'Custom Prompt', icon: Wand2, description: 'Any custom image need' },
  ];

  const festivalSuggestions = [
    'Diwali Sale', 'Akshaya Tritiya', 'Navratri Collection', 'Christmas Offer',
    'New Year Sale', 'Pongal Festival', 'Wedding Season', 'Raksha Bandhan',
    'Valentine\'s Day', 'Mother\'s Day', 'Independence Day', 'Ugadi Festival',
    'Onam Special', 'Eid Collection', 'Ganesh Chaturthi', 'Karwa Chauth',
    'Anniversary Sale', 'Launch Offer', 'Clearance Sale', 'Flash Sale',
  ];

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedPrompt('');
    setCopied(false);

    try {
      let prompt = '';
      let inputs: Record<string, string> = {};

      switch (activeTab) {
        case 'product-model':
          if (!productImage) {
            toast.error('Please upload a product image — it\'s required for model shots');
            setLoading(false);
            return;
          }
          prompt = await generateProductModelPrompt(
            productImage, logoImage || undefined
          );
          inputs = { type: 'Product + Model' };
          break;

        case 'product-studio':
          if (!productImage) {
            toast.error('Please upload a product image — it\'s required for studio shots');
            setLoading(false);
            return;
          }
          prompt = await generateProductStudioPrompt(
            productImage, logoImage || undefined
          );
          inputs = { type: 'Studio Product' };
          break;

        case 'hero-section':
          if (!festivalOrEvent.trim()) {
            toast.error('Please enter the festival, event, or offer type');
            setLoading(false);
            return;
          }
          if (!offerTitle.trim()) {
            toast.error('Please enter the offer title');
            setLoading(false);
            return;
          }
          prompt = await generateHeroSectionPrompt(
            festivalOrEvent, offerTitle, offerInfo,
            bannerHeadline || '', includeModel,
            heroImages.length > 0 ? heroImages : undefined, logoImage || undefined
          );
          inputs = { festivalOrEvent, offerTitle, offerInfo, bannerHeadline, includeModel };
          break;

        case 'custom':
          if (!customRequirement.trim()) { toast.error('Please describe your requirement'); setLoading(false); return; }
          prompt = await generateCustomImagePrompt(
            customRequirement, customImageType,
            referenceImage || productImage || undefined, logoImage || undefined
          );
          inputs = { customRequirement, customImageType };
          break;
      }

      setGeneratedPrompt(prompt);

      const newEntry: GeneratedPrompt = {
        id: Date.now().toString(),
        category: activeTab,
        prompt,
        inputs,
        timestamp: new Date(),
      };
      setHistory(prev => [newEntry, ...prev].slice(0, 20));

      toast.success('Prompt generated successfully!');
    } catch (error: any) {
      console.error('Gemini API error:', error);
      toast.error(error?.message || 'Failed to generate prompt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      toast.success('Prompt copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const loadFromHistory = (entry: GeneratedPrompt) => {
    setGeneratedPrompt(entry.prompt);
    setActiveTab(entry.category);
    setCopied(false);
    setRefineText('');
  };

  const handleRefine = async () => {
    if (!refineText.trim() || !generatedPrompt) return;
    setRefining(true);
    try {
      const refined = await refinePrompt(generatedPrompt, refineText);
      setGeneratedPrompt(refined);
      setRefineText('');
      toast.success('Prompt refined!');
      const newEntry: GeneratedPrompt = {
        id: Date.now().toString(),
        category: activeTab,
        prompt: refined,
        inputs: { type: 'Refined' },
        timestamp: new Date(),
      };
      setHistory(prev => [newEntry, ...prev].slice(0, 20));
    } catch (error: any) {
      toast.error(error?.message || 'Failed to refine prompt');
    } finally {
      setRefining(false);
    }
  };

  const handleVariation = async () => {
    if (!generatedPrompt || !productImage) return;
    setVariationLoading(true);
    try {
      const variation = await generateVariationPrompt(generatedPrompt, productImage, logoImage || undefined);
      setGeneratedPrompt(variation);
      toast.success('Variation generated — different angle & pose, same background!');
      const newEntry: GeneratedPrompt = {
        id: Date.now().toString(),
        category: 'product-model',
        prompt: variation,
        inputs: { type: 'Variation' },
        timestamp: new Date(),
      };
      setHistory(prev => [newEntry, ...prev].slice(0, 20));
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate variation');
    } finally {
      setVariationLoading(false);
    }
  };

  const inputStyles = "w-full bg-white border border-[#F5EFE6] rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-colors";
  const selectStyles = "w-full bg-white border border-[#F5EFE6] rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-colors appearance-none cursor-pointer";
  const labelStyles = "block text-sm font-medium text-gray-700 mb-1.5";
  const textareaStyles = "w-full bg-white border border-[#F5EFE6] rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-colors resize-none";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-amber-600" />
            AI Image Prompt Generator
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Upload your jewelry image → Gemini auto-detects everything → generates world-class prompts
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-white px-3 py-1.5 rounded-full border border-[#F5EFE6]">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Gemini 2.5 Flash
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-[#F5EFE6] p-1.5 flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setGeneratedPrompt(''); setCopied(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 min-w-[140px] justify-center ${
              activeTab === tab.id
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-[#FFF9E6] hover:text-amber-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden text-xs">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Input Section */}
        <div className="xl:col-span-2 space-y-4">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl border border-[#F5EFE6] p-6 space-y-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                {activeTab === 'product-model' && <Gem className="h-4 w-4 text-amber-600" />}
                {activeTab === 'product-studio' && <Camera className="h-4 w-4 text-amber-600" />}
                {activeTab === 'hero-section' && <Gift className="h-4 w-4 text-amber-600" />}
                {activeTab === 'custom' && <Wand2 className="h-4 w-4 text-amber-600" />}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h2>
                <p className="text-xs text-gray-400">
                  {tabs.find(t => t.id === activeTab)?.description}
                </p>
              </div>
            </div>

            {/* Product Forms (Model & Studio — only image upload needed) */}
            {(activeTab === 'product-model' || activeTab === 'product-studio') && (
              <>
                {/* Product Image Upload — REQUIRED */}
                <ImageDropZone
                  label="Upload Jewelry Image"
                  image={productImage}
                  preview={productPreview}
                  onSelect={handleProductImageSelect}
                  onClear={() => { setProductImage(null); setProductPreview(''); }}
                  hint="AI auto-detects jewelry type, metal, stones, design — no manual input needed"
                  required
                />

                {activeTab === 'product-model' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs text-amber-800 font-semibold">Real DSLR Model Photoshoot</p>
                    <ul className="text-[11px] text-amber-700 space-y-0.5 list-disc list-inside">
                      <li>Stunning Indian model — DSLR photographed, not AI-looking</li>
                      <li>Real skin pores, catchlights, hair flyaways, natural imperfections</li>
                      <li>Professional makeup & styling done specifically for this jewelry</li>
                      <li>Your EXACT product preserved 100% — only environment enhanced</li>
                      <li>After generating, click <strong>"Different Angle / Pose"</strong> for variations</li>
                      <li>Use <strong>"Refine"</strong> to modify any detail you want changed</li>
                    </ul>
                  </div>
                )}
                {activeTab === 'product-studio' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs text-amber-800 font-semibold">Studio Product Photoshoot</p>
                    <ul className="text-[11px] text-amber-700 space-y-0.5 list-disc list-inside">
                      <li>Product-only premium studio shot — no model</li>
                      <li>AI auto-detects metal, stones, style from your image</li>
                      <li>Macro-level detail — every texture and engraving razor-sharp</li>
                      <li>Premium surface auto-selected to complement the jewelry</li>
                      <li>1:1, 4K, Canon macro lens, focus stacking</li>
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Hero Section Form */}
            {activeTab === 'hero-section' && (
              <>
                {/* Multi-Image Upload for Hero */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Reference / Jewelry Images <span className="text-gray-400 text-xs font-normal">(upload multiple)</span>
                  </label>
                  {heroPreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {heroPreviews.map((preview, idx) => (
                        <div key={idx} className="relative group rounded-lg border border-[#F5EFE6] overflow-hidden bg-gray-50">
                          <img src={preview} alt={`ref-${idx + 1}`} className="w-full h-24 object-contain bg-white" />
                          <button
                            type="button"
                            onClick={() => handleHeroImageRemove(idx)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5">
                            Image {idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <HeroImageDropZone
                    onSelectMultiple={handleHeroImageAddMultiple}
                    onSelectSingle={handleHeroImageAdd}
                    imageCount={heroPreviews.length}
                  />
                  {heroPreviews.length > 0 && (
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-[10px] text-amber-600 font-medium">{heroPreviews.length} image{heroPreviews.length > 1 ? 's' : ''} uploaded — AI will study all and create one cohesive banner</p>
                      <button
                        type="button"
                        onClick={() => { setHeroImages([]); setHeroPreviews([]); }}
                        className="text-[10px] text-red-500 hover:text-red-700"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelStyles}>Festival / Event / Offer Type <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={festivalOrEvent}
                    onChange={(e) => setFestivalOrEvent(e.target.value)}
                    placeholder="e.g., Diwali Sale, Wedding Season, Akshaya Tritiya..."
                    className={inputStyles}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {festivalSuggestions.slice(0, 8).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFestivalOrEvent(s)}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                          festivalOrEvent === s
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'border-[#F5EFE6] text-gray-500 hover:border-amber-400 hover:text-amber-700'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    <div className="relative group">
                      <button
                        type="button"
                        className="text-[10px] px-2 py-1 rounded-full border border-[#F5EFE6] text-gray-400 hover:text-amber-600"
                      >
                        More...
                      </button>
                      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex flex-wrap gap-1 bg-white border border-[#F5EFE6] rounded-lg p-2 shadow-lg z-10 w-64">
                        {festivalSuggestions.slice(8).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setFestivalOrEvent(s)}
                            className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                              festivalOrEvent === s
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'border-[#F5EFE6] text-gray-500 hover:border-amber-400 hover:text-amber-700'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelStyles}>Banner Headline <span className="text-gray-400 text-xs font-normal">(optional — AI creates one if blank)</span></label>
                  <input
                    type="text"
                    value={bannerHeadline}
                    onChange={(e) => setBannerHeadline(e.target.value)}
                    placeholder="e.g., Festive jewellery for auspicious beginnings"
                    className={inputStyles}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">The emotional tagline rendered on the banner with aesthetic typography</p>
                </div>
                <div>
                  <label className={labelStyles}>Offer Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={offerTitle}
                    onChange={(e) => setOfferTitle(e.target.value)}
                    placeholder="e.g., Flat 30% Off, Buy 1 Get 1 Free, Up to 50% Off"
                    className={inputStyles}
                  />
                </div>
                <div>
                  <label className={labelStyles}>Offer Details <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
                  <textarea
                    value={offerInfo}
                    onChange={(e) => setOfferInfo(e.target.value)}
                    placeholder="e.g., On all silver jewelry above ₹2,000. Valid till 31st Dec."
                    rows={2}
                    className={textareaStyles}
                  />
                </div>
                <div>
                  <label className={labelStyles}>Include Model?</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'auto', label: 'AI Decides', desc: 'Recommended' },
                      { value: 'yes', label: 'Yes', desc: 'Include model' },
                      { value: 'no', label: 'No', desc: 'Product only' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setIncludeModel(opt.value)}
                        className={`flex-1 text-center px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                          includeModel === opt.value
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'border-[#F5EFE6] text-gray-500 hover:border-amber-400 hover:text-amber-700'
                        }`}
                      >
                        <div>{opt.label}</div>
                        <div className={`text-[10px] font-normal mt-0.5 ${includeModel === opt.value ? 'text-amber-100' : 'text-gray-400'}`}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs text-amber-800 font-semibold">Complete Banner Design</p>
                  <ul className="text-[11px] text-amber-700 space-y-0.5 list-disc list-inside">
                    <li><strong>Upload multiple images</strong> — jewelry, references, inspiration. AI studies ALL</li>
                    <li>Text rendered IN the image with aesthetic typography</li>
                    <li>Offer styled as a premium design element (not plain text)</li>
                    <li>SHOP NOW / CTA button included in the design</li>
                    <li>Logo placed where it fits best (not always bottom-right)</li>
                    <li>AI decides model vs product-only — both equally premium</li>
                    <li>Ultra-wide 4K, luxury aesthetic, real DSLR camera quality</li>
                  </ul>
                </div>
              </>
            )}

            {/* Custom Prompt Form */}
            {activeTab === 'custom' && (
              <>
                <ImageDropZone
                  label="Reference / Product Image (optional)"
                  image={referenceImage || productImage}
                  preview={referencePreview || productPreview}
                  onSelect={handleReferenceImageSelect}
                  onClear={() => { setReferenceImage(null); setReferencePreview(''); setProductImage(null); setProductPreview(''); }}
                  hint="Upload any image — AI will reference it exactly in the prompt"
                />
                <div>
                  <label className={labelStyles}>Image Type</label>
                  <div className="relative">
                    <select value={customImageType} onChange={(e) => setCustomImageType(e.target.value)} className={selectStyles}>
                      <option value="Product Photography">Product Photography</option>
                      <option value="Model Photography">Model Photography</option>
                      <option value="Banner/Hero Image">Banner / Hero Image</option>
                      <option value="Social Media Post">Social Media Post</option>
                      <option value="Category Banner">Category Banner</option>
                      <option value="Promotional Image">Promotional Image</option>
                      <option value="Lifestyle Shot">Lifestyle Shot</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelStyles}>Describe Your Requirement <span className="text-red-500">*</span></label>
                  <textarea
                    value={customRequirement}
                    onChange={(e) => setCustomRequirement(e.target.value)}
                    placeholder="Describe exactly what you want... e.g., 'A festive Diwali banner showing silver diyas and jewelry with warm golden lighting'"
                    rows={5}
                    className={textareaStyles}
                  />
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <strong>Custom:</strong> Any image type. Upload a reference and AI will preserve it exactly while enhancing the scene around it.
                </div>
              </>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-medium transition-all shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating with Gemini 2.5 Flash...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Prompt
                </>
              )}
            </Button>
          </motion.div>

          {/* Logo / Watermark Card */}
          <div className="bg-white rounded-xl border border-[#F5EFE6] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-amber-600" />
              <h3 className="font-semibold text-gray-900 text-sm">Brand Watermark</h3>
            </div>
            <ImageDropZone
              label=""
              image={logoImage}
              preview={logoPreview}
              onSelect={handleLogoSelect}
              onClear={() => { setLogoImage(null); setLogoPreview(''); }}
              hint="Upload your brand logo — auto-loaded from logo-new.png"
            />
            <p className="text-[10px] text-gray-400 mt-2">
              {logoImage
                ? 'Logo loaded — prompts will auto-select best placement & color for each image composition.'
                : 'No logo loaded. Upload one or ensure logo-new.png exists in public/.'}
            </p>
          </div>
        </div>

        {/* Output Section */}
        <div className="xl:col-span-3 space-y-4">
          {/* Generated Prompt Display */}
          <div className="bg-white rounded-xl border border-[#F5EFE6] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F5EFE6]">
              <h3 className="font-semibold text-gray-900 text-sm">Generated Prompt</h3>
              <div className="flex items-center gap-2">
                {generatedPrompt && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerate}
                      disabled={loading}
                      className="text-xs border-[#F5EFE6] hover:bg-amber-50"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                      Regenerate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="text-xs border-[#F5EFE6] hover:bg-amber-50"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                    <Sparkles className="h-5 w-5 text-amber-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-sm text-gray-500">Gemini 2.5 Flash is analyzing your jewelry & crafting the prompt...</p>
                </div>
              ) : generatedPrompt ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">
                      {generatedPrompt}
                    </pre>
                  </div>

                  {/* Action buttons row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {activeTab === 'product-model' && productImage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleVariation}
                        disabled={variationLoading || refining}
                        className="text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700"
                      >
                        {variationLoading ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Generating Variation...
                          </>
                        ) : (
                          <>
                            <Camera className="h-3 w-3 mr-1" />
                            Different Angle / Pose
                          </>
                        )}
                      </Button>
                    )}
                    <span className="text-xs text-gray-400">
                      Copy prompt → paste into Midjourney / DALL-E 3 / Flux
                    </span>
                    {(productImage || referenceImage) && (
                      <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">
                        Attach your uploaded image alongside the prompt
                      </span>
                    )}
                  </div>

                  {/* Refine Section */}
                  <div className="border border-[#F5EFE6] rounded-lg p-4 space-y-3 bg-[#FFFCF5]">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-amber-600" />
                      <h4 className="text-sm font-medium text-gray-800">Refine this prompt</h4>
                    </div>
                    <textarea
                      value={refineText}
                      onChange={(e) => setRefineText(e.target.value)}
                      placeholder="Tell AI what to change... e.g., 'Make the background darker', 'Change pose to side profile', 'Add more festive elements', 'Make the model look more traditional'"
                      rows={2}
                      className="w-full bg-white border border-[#F5EFE6] rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-colors resize-none"
                    />
                    <Button
                      onClick={handleRefine}
                      disabled={!refineText.trim() || refining || variationLoading}
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                    >
                      {refining ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Refining...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-1" />
                          Refine Prompt
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <Wand2 className="h-8 w-8 text-gray-300" />
                  </div>
                  <p className="text-sm">Upload your jewelry image, then click "Generate Prompt"</p>
                  <p className="text-xs">Gemini auto-detects metal, type, stones — no manual input needed</p>
                </div>
              )}
            </div>
          </div>

          {/* How to use */}
          <div className="bg-white rounded-xl border border-[#F5EFE6] p-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">How to use these prompts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-[10px]">1</span>
                <span><strong>Upload</strong> your jewelry image → Gemini auto-detects everything (type, metal, stones, style) and generates an accurate prompt.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-[10px]">2</span>
                <span><strong>Copy</strong> the prompt and paste into Midjourney/DALL-E/Flux. <strong>Attach the same jewelry image</strong> as reference.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-[10px]">3</span>
                <span>The prompt says <strong>"do not alter the product/logo"</strong> — AI tools will preserve your originals and only enhance the scene.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-[10px]">4</span>
                <span>Your <strong>logo watermark</strong> is auto-loaded. Prompt auto-selects best placement & color for each composition.</span>
              </div>
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl border border-[#F5EFE6] overflow-hidden">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 text-sm">
                  Prompt History ({history.length})
                </h3>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>
              {showHistory && (
                <div className="border-t border-[#F5EFE6] divide-y divide-[#F5EFE6] max-h-[400px] overflow-y-auto">
                  {history.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => loadFromHistory(entry)}
                      className="w-full text-left px-6 py-3 hover:bg-[#FFF9E6]/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-amber-700 capitalize">
                          {entry.category.replace('-', ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {entry.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {entry.prompt.slice(0, 120)}...
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminImagePrompts;
