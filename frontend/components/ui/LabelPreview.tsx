'use client';

import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { LabelUIConfig } from '@/lib/label-config';

interface LabelPreviewProps {
  config: LabelUIConfig;
  productName: string;
  price: number;
  discountPrice?: number;
  sku: string;
  battery?: number;
  stock?: number;
  isPromo?: boolean;
}

export const LabelPreview = ({
  config,
  productName,
  price,
  discountPrice,
  sku,
  battery = 92,
  stock = 14,
  isPromo = false
}: LabelPreviewProps) => {
  const { 
    template, 
    fontFamily, 
    highContrast, 
    showBattery, 
    showQrCode, 
    showStock 
  } = config;

  return (
    <div 
      className={`w-full h-full flex flex-col grayscale transition-all ${highContrast ? 'contrast-150' : 'contrast-100'} relative bg-white`}
      style={{ 
        fontFamily: fontFamily,
        backgroundImage: 'radial-gradient(#d1d5db 0.5px, transparent 0.5px)',
        backgroundSize: '8px 8px'
      }}
    >
      {/* Header / Status Bar */}
      <div className="px-3 py-1.5 flex justify-between items-center border-b-[2px] border-black">
         <div className="flex items-center gap-1">
            <div className="h-3.5 w-3.5 bg-black flex items-center justify-center text-white">
               <Zap className="h-2 w-2 fill-current" />
            </div>
            <span className="text-[7px] font-black uppercase tracking-tighter italic">Digital Label</span>
         </div>
         <div className="flex items-center gap-1.5 text-black">
            {showBattery && (
               <div className="flex items-center gap-0.5 border-[1.5px] border-black px-1 py-0.5">
                  <span className="text-[6px] font-black">{battery}%</span>
                  <div className="h-1.5 w-3 border-[1px] border-black relative">
                     <div className="h-full bg-black" style={{ width: `${battery}%` }} />
                  </div>
               </div>
            )}
         </div>
      </div>

      {/* Main Product Content */}
      <div className="flex-1 p-3 flex flex-col relative overflow-hidden">
        {(template === 'promo' || isPromo) && (
          <div className="absolute top-1 right-2 bg-black text-white px-2 py-0.5 font-black text-[8px] rotate-3 shadow-md z-20">
            HOT SALE!
          </div>
        )}

        <div className="space-y-0.5 mb-2">
          <p className="text-[6px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Premium Goods</p>
          <h1 className="text-sm font-black leading-[0.95] tracking-tighter text-black uppercase line-clamp-2">{productName}</h1>
        </div>

        <div className="flex-1 flex items-end justify-between min-h-0">
           <div className="space-y-0">
              {(template === 'promo' || isPromo) && discountPrice && (
                <p className="text-[10px] font-black line-through text-slate-300 -mb-1">${price.toFixed(2)}</p>
              )}
              <div className="flex items-baseline gap-0.5">
                 <span className="text-[10px] font-black leading-none">$</span>
                 <span className="text-3xl font-black tracking-tighter leading-[0.8] py-1">
                   {((template === 'promo' || isPromo) && discountPrice) ? Math.floor(discountPrice) : Math.floor(price)}
                 </span>
                 <div className="flex flex-col mb-0.5">
                    <span className="text-xs font-black leading-none border-b-[2px] border-black pb-0.5">
                        {(((template === 'promo' || isPromo) && discountPrice) ? (discountPrice % 1).toFixed(2) : (price % 1).toFixed(2)).split('.')[1]}
                    </span>
                    <span className="text-[6px] font-black uppercase mt-0.5">USD</span>
                 </div>
              </div>
           </div>

           <div className="flex flex-col items-end gap-2">
              {showQrCode && (
                 <div className="p-0.5 bg-white border-[1.5px] border-black shadow-[2px_2px_0_rgba(0,0,0,1)]">
                    <QRCodeSVG 
                      value={`https://digital-label.com/p/${sku}`}
                      size={40}
                      level="H"
                    />
                 </div>
              )}
              {showStock && (
                 <div className="bg-black text-white px-1.5 py-0.5 font-black text-[6px] uppercase tracking-widest leading-none">
                    Stock: {stock}
                 </div>
              )}
           </div>
        </div>
      </div>

      {/* Footer Meta */}
      <div className="p-2 bg-slate-50 border-t-[2px] border-black flex justify-between items-center">
         <div className="space-y-0.5">
            <p className="text-[5px] font-black text-slate-400 uppercase tracking-widest leading-none">Ref Code</p>
            <p className="text-[8px] font-black text-black leading-none tracking-tight">{sku}</p>
         </div>
         <div className="flex flex-col items-end">
            <div className="flex gap-0.5">
               {[1,1,0,1,0,1,1,1,0,1,1,0,1].map((v, i) => (
                 <div key={i} className={`w-[1px] h-2 ${v ? 'bg-black' : 'bg-transparent'}`} />
               ))}
            </div>
            <p className="text-[5px] font-black uppercase tracking-widest mt-0.5 italic">Hardware Verified</p>
         </div>
      </div>

      {/* GLASS REFLECTION OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
    </div>
  );
};
