'use client';

import { 
  Save, 
  Palette, 
  Eye, 
  RefreshCw, 
  Smartphone,
  Layout,
  Type,
  Maximize2,
  Minimize2,
  Tag,
  Zap,
  Package,
  QrCode,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';

type LabelTemplate = 'standard' | 'promo' | 'minimal' | 'inventory';

export const AdminLabelUI = () => {
  const { t } = useLanguage();
  const [template, setTemplate] = useState<LabelTemplate>('standard');
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState({
    primaryColor: '#000000',
    accentColor: '#FB5050',
    fontFamily: 'Inter',
    refreshInterval: 15,
    showBattery: true,
    showLocation: true,
    showStock: true,
    showQrCode: true,
    highContrast: true,
    productName: 'Premium Espresso Beans',
    price: 24.99,
    discountPrice: 19.99,
    sku: 'COF-772-PRO'
  });

  const templates = [
    { id: 'standard', name: t('template_standard'), icon: Layout },
    { id: 'promo', name: t('template_promo'), icon: Tag },
    { id: 'minimal', name: t('template_minimal'), icon: Minimize2 },
    { id: 'inventory', name: t('template_inventory'), icon: Package },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system_config', 'label_design'), {
        ...config,
        template,
        updatedAt: Timestamp.now(),
        updatedBy: 'admin'
      });
      alert('Global Label UI Design has been applied! All vendor labels will now sync with this new standard.');
    } catch (error) {
      console.error('Failed to save label design:', error);
      alert('Failed to apply design. Please check permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-[#111928] dark:text-white tracking-tight">{t('label_ui')}</h2>
          <p className="text-sm font-medium text-[#637381] dark:text-slate-400 mt-1">
            {t('designer_desc')}
          </p>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" className="h-11 px-6 rounded-lg border border-[#E2E8F0] dark:border-slate-800 text-sm font-bold text-[#637381] dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all gap-2">
             <RefreshCw className="h-4 w-4" />
             Full Refresh
           </Button>
           <Button 
            onClick={handleSave}
            isLoading={isSaving}
            className="h-11 px-6 rounded-lg bg-[#5750F1] hover:bg-[#4a42e0] text-white font-bold text-sm shadow-md shadow-[#5750F1]/10 gap-2"
          >
            <Save className="h-4 w-4" />
            {t('save_changes')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Settings Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* Template Selector */}
          <div className="bg-white dark:bg-[#24303F] p-6 rounded-[10px] border border-[#E2E8F0] dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-bold text-[#111928] dark:text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#5750F1]" />
              {t('templates') || 'UI Templates'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id as LabelTemplate)}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    template === t.id 
                      ? 'border-[#5750F1] bg-[#5750F1]/5 text-[#5750F1]' 
                      : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  <t.icon className="h-5 w-5" />
                  <span className="text-[10px] font-bold uppercase">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Visual Config */}
          <div className="bg-white dark:bg-[#24303F] p-6 rounded-[10px] border border-[#E2E8F0] dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-bold text-[#111928] dark:text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Palette className="h-4 w-4 text-emerald-500" />
              {t('preview_settings')}
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-[#637381] uppercase tracking-wider mb-2">Display Mode</label>
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button 
                    onClick={() => setConfig({...config, highContrast: true})}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${config.highContrast ? 'bg-white dark:bg-slate-700 text-[#111928] dark:text-white shadow-sm' : 'text-slate-400'}`}
                  >
                    High Contrast
                  </button>
                  <button 
                    onClick={() => setConfig({...config, highContrast: false})}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${!config.highContrast ? 'bg-white dark:bg-slate-700 text-[#111928] dark:text-white shadow-sm' : 'text-slate-400'}`}
                  >
                    Soft E-Ink
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#637381] uppercase tracking-wider mb-2">Typography</label>
                <select 
                  value={config.fontFamily}
                  onChange={(e) => setConfig({...config, fontFamily: e.target.value})}
                  className="w-full h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-semibold"
                >
                  <option value="Inter">Inter (Sans)</option>
                  <option value="'Kantumruy Pro', sans-serif">Kantumruy Pro (Khmer)</option>
                  <option value="Georgia">Georgia (Serif)</option>
                  <option value="monospace">Mono Space</option>
                </select>
              </div>

              <div className="pt-2 space-y-3">
                  {[
                    { id: 'showBattery', label: 'Battery Indicator' },
                    { id: 'showQrCode', label: t('show_qr') },
                    { id: 'showStock', label: t('show_stock') },
                  ].map(item => (
                    <label key={item.id} className="flex items-center justify-between group cursor-pointer">
                       <span className="text-xs font-medium text-[#111928] dark:text-white">{item.label}</span>
                       <div className="relative inline-flex items-center">
                         <input 
                           type="checkbox" 
                           checked={(config as any)[item.id]}
                           onChange={(e) => setConfig({...config, [item.id]: e.target.checked})}
                           className="sr-only peer"
                         />
                         <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5750F1]"></div>
                       </div>
                    </label>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Real 3D Label Preview Panel */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#F8FAFC] dark:bg-[#1A222C] rounded-[20px] border border-[#E2E8F0] dark:border-slate-800 p-8 lg:p-16 flex flex-col items-center justify-center min-h-[600px] relative overflow-hidden shadow-inner">
            
            {/* 3D HARDWARE WRAPPER */}
            <div className="[perspective:2000px] hover:[perspective:3000px] transition-all duration-700">
              <motion.div 
                layout
                initial={{ scale: 0.8, opacity: 0, rotateY: -15, rotateX: 10 }}
                animate={{ scale: 1, opacity: 1, rotateY: -5, rotateX: 5 }}
                whileHover={{ rotateY: 0, rotateX: 0, scale: 1.05 }}
                className="w-[450px] aspect-[4/3] bg-[#F1F5F9] rounded-[32px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4),0_30px_60px_-30px_rgba(0,0,0,0.5),inset_0_-4px_10px_rgba(0,0,0,0.1)] border-[1px] border-white/50 p-6 flex flex-col relative transition-all duration-500 [transform-style:preserve-3d]"
              >
                {/* Physical Bezel Depth */}
                <div className="absolute inset-0 rounded-[32px] border-[14px] border-[#24303F] shadow-[inset_0_4px_10px_rgba(0,0,0,0.8)] pointer-events-none z-10" />
                
                {/* Internal Screen Recess */}
                <div className="absolute inset-[14px] bg-white rounded-xl shadow-[inset_0_4px_20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">
                  
                  {/* REALISTIC E-INK LABEL CONTENT */}
                  <div 
                    className={`flex-1 flex flex-col grayscale transition-all ${config.highContrast ? 'contrast-150' : 'contrast-100'}`}
                    style={{ 
                      fontFamily: config.fontFamily,
                      backgroundImage: 'radial-gradient(#d1d5db 0.5px, transparent 0.5px)',
                      backgroundSize: '8px 8px'
                    }}
                  >
                    {/* Header / Status Bar */}
                    <div className="px-6 py-4 flex justify-between items-center border-b-[3px] border-black">
                       <div className="flex items-center gap-2">
                          <div className="h-6 w-6 bg-black flex items-center justify-center text-white rounded-sm">
                             <Zap className="h-3.5 w-3.5 fill-current" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-tighter italic">Digital Label</span>
                       </div>
                       <div className="flex items-center gap-3 text-black">
                          {config.showBattery && (
                             <div className="flex items-center gap-1 border-[2px] border-black px-1 rounded-sm">
                                <span className="text-[8px] font-black">92%</span>
                                <div className="h-2 w-3.5 border-[1px] border-black relative">
                                   <div className="h-full bg-black w-[80%]" />
                                </div>
                             </div>
                          )}
                       </div>
                    </div>

                    {/* Main Product Content */}
                    <div className="flex-1 p-6 flex flex-col relative">
                      {template === 'promo' && (
                        <div className="absolute top-2 right-4 bg-black text-white px-3 py-1 font-black text-sm rotate-3 shadow-md z-20">
                          HOT SALE!
                        </div>
                      )}

                      <div className="space-y-0.5 mb-4">
                        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500">Dept: Premium Goods</p>
                        <h1 className="text-3xl font-black leading-[1.1] tracking-tight text-black">{config.productName}</h1>
                      </div>

                      <div className="flex-1 flex items-end justify-between">
                         <div className="space-y-0">
                            {template === 'promo' && (
                              <p className="text-xl font-bold line-through text-slate-400 -mb-2">$24.99</p>
                            )}
                            <div className="flex items-baseline gap-0.5">
                              <span className="text-3xl font-black">$</span>
                              <span className="text-7xl font-black tracking-tighter leading-none">
                                {template === 'promo' ? '19' : '24'}
                              </span>
                              <span className="text-3xl font-black">.99</span>
                            </div>
                         </div>

                         <div className="flex flex-col items-end gap-3">
                            {config.showQrCode && (
                              <div className="p-1 bg-white border-[2.5px] border-black rounded-sm shadow-sm">
                                 <QRCodeSVG 
                                   value={`https://digital-label.com/p/${config.sku}`}
                                   size={64}
                                   level="H"
                                   includeMargin={false}
                                   imageSettings={{
                                     src: "/logo.jpg",
                                     x: undefined,
                                     y: undefined,
                                     height: 12,
                                     width: 12,
                                     excavate: true,
                                   }}
                                 />
                              </div>
                            )}
                            {config.showStock && (
                              <div className="bg-black text-white px-2 py-0.5 font-black text-[8px] uppercase tracking-widest">
                                 In Stock: 14
                              </div>
                            )}
                         </div>
                      </div>
                    </div>

                    {/* Footer Meta */}
                    <div className="p-4 bg-slate-50 border-t-[2px] border-black flex justify-between items-center">
                       <div className="space-y-0.5">
                          <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none">Global Sku</p>
                          <p className="text-[10px] font-black text-black leading-none">{config.sku}</p>
                       </div>
                       <div className="flex flex-col items-end">
                          <div className="flex gap-0.5">
                             {[1,1,0,1,0,1,1,1,0,1,1,0,1].map((v, i) => (
                               <div key={i} className={`w-[1px] h-3 ${v ? 'bg-black' : 'bg-transparent'}`} />
                             ))}
                          </div>
                          <p className="text-[7px] font-bold uppercase tracking-widest mt-1">Barcode: 772993</p>
                       </div>
                    </div>

                    {/* GLASS REFLECTION OVERLAY */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20 pointer-events-none" />
                    
                    {/* E-INK GRAIN */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
                  </div>
                </div>

                {/* Hardware Highlights */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/30 rounded-full blur-[1px] z-20" />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-1 bg-black/10 rounded-full blur-[2px] z-20" />
              </motion.div>
            </div>

            {/* Scale Indicator */}
            <div className="mt-16 flex items-center gap-8">
               <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-slate-300" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Display: 4.2" E-Ink</span>
               </div>
               <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-slate-300" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resolution: 400x300</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
