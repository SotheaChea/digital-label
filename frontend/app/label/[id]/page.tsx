'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, collection, query, where, limit } from 'firebase/firestore';

import { DigitalLabel } from '@/types/vendor';

import { Loader2 } from 'lucide-react';

const EAN_L: Record<string, string> = {
  '0': '0001101',
  '1': '0011001',
  '2': '0010011',
  '3': '0111101',
  '4': '0100011',
  '5': '0110001',
  '6': '0101111',
  '7': '0111011',
  '8': '0110111',
  '9': '0001011',
};

const EAN_G: Record<string, string> = {
  '0': '0100111',
  '1': '0110011',
  '2': '0011011',
  '3': '0100001',
  '4': '0011101',
  '5': '0111001',
  '6': '0000101',
  '7': '0010001',
  '8': '0001001',
  '9': '0010111',
};

const EAN_R: Record<string, string> = {
  '0': '1110010',
  '1': '1100110',
  '2': '1101100',
  '3': '1000010',
  '4': '1011100',
  '5': '1001110',
  '6': '1010000',
  '7': '1000100',
  '8': '1001000',
  '9': '1110100',
};

const EAN_PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '*': 'nwnnwnwnn',
  '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
};

const getEan13Checksum = (digits12: string) => {
  const sum = digits12
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
};

const normalizeEan13 = (value: string) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  // EAN-13
  if (digits.length === 12) return `${digits}${getEan13Checksum(digits)}`;
  if (digits.length === 13) return digits;
  // EAN-8
  if (digits.length === 7 || digits.length === 8) return digits.padStart(8, '0');
  return null;
};

const buildEan13Modules = (ean: string) => {
  const first = Number(ean[0]);
  const parity = EAN_PARITY[first];
  const left = ean
    .slice(1, 7)
    .split('')
    .map((digit, index) => (parity[index] === 'L' ? EAN_L[digit] : EAN_G[digit]))
    .join('');
  const right = ean
    .slice(7)
    .split('')
    .map((digit) => EAN_R[digit])
    .join('');
  return `101${left}01010${right}101`;
};

const buildCode39Bars = (value: string) => {
  const normalized = value.toUpperCase().replace(/[^0-9A-Z .$/+%-]/g, '-');
  const encoded = `*${normalized || 'NO-CODE'}*`;
  const bars: { x: number; width: number }[] = [];
  let x = 0;

  encoded.split('').forEach((char, charIndex) => {
    const pattern = CODE39[char] || CODE39['-'];
    pattern.split('').forEach((part, index) => {
      const width = part === 'w' ? 3 : 1;
      if (index % 2 === 0) bars.push({ x, width });
      x += width;
    });
    if (charIndex < encoded.length - 1) x += 1;
  });

  return { bars, width: x, text: normalized || 'NO-CODE' };
};

const BarcodeSvg = ({ value, className = '' }: { value: string; className?: string }) => {
  if (!value) {
    return (
      <div className={`flex items-center justify-center border border-dashed border-black/40 bg-white ${className}`}>
        <span className="text-[8px] font-black uppercase tracking-widest text-black/50">No Product Barcode</span>
      </div>
    );
  }

  const ean = normalizeEan13(value);

  if (ean) {
    const modules = buildEan13Modules(ean);
    const firstDigit = ean[0];
    const restOfEan = ean.slice(1);
    
    return (
      <div className={`flex items-center justify-center bg-white ${className}`}>
        <svg viewBox="0 0 115 80" className="h-full w-full" preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges" role="img" aria-label={`EAN-13 barcode ${ean}`}>
          <rect width="115" height="80" fill="white" />
          
          {/* First Digit (Outside Guard) */}
          <text x="6" y="72" fontSize="10" fontFamily="monospace" fontWeight="900" fill="black">
            {firstDigit}
          </text>

          {modules.split('').map((bit, index) => {
            if (bit !== '1') return null;
            const isGuard = index < 3 || (index >= 45 && index < 50) || index >= 92;
            return (
              <rect 
                key={index} 
                x={index + 14} 
                y="5" 
                width="1" 
                height={isGuard ? 60 : 54} 
                fill="black" 
              />
            );
          })}

          {/* Rest of digits */}
          <text x="33" y="72" fontSize="10" fontFamily="monospace" fontWeight="900" fill="black">
            {restOfEan.slice(0, 6)}
          </text>
          <text x="78" y="72" fontSize="10" fontFamily="monospace" fontWeight="900" fill="black">
            {restOfEan.slice(6)}
          </text>
        </svg>
      </div>
    );
  }

  const code39 = buildCode39Bars(value);
  return (
    <div className={`flex items-center justify-center bg-white ${className}`}>
      <svg viewBox={`0 0 ${code39.width + 40} 80`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges" role="img" aria-label={`Code 39 barcode ${code39.text}`}>
        <rect width={code39.width + 40} height="80" fill="white" />
        {code39.bars.map((bar, index) => (
          <rect key={index} x={bar.x + 20} y="5" width={bar.width} height="50" fill="black" />
        ))}
        <text x={(code39.width + 40) / 2} y="72" textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="900" fill="black">
          {code39.text}
        </text>
      </svg>
    </div>
  );
};

export default function LabelPreviewPage() {
  const { id } = useParams();
  const [label, setLabel] = useState<DigitalLabel | null>(null);
  const [design, setDesign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (!id) return;
    
    let unsubLabel = () => {};

    const handleLabelSnap = async (labelDoc: any) => {
      const data = labelDoc.data();
      const labelData = { id: labelDoc.id, ...data } as DigitalLabel;

      if (labelData.productId) {
        try {
          const productSnap = await getDoc(doc(db, 'products', labelData.productId));
          if (productSnap.exists()) {
            const product = productSnap.data() as any;
            labelData.productCode = product.productCode || labelData.productCode || '';
            labelData.productSku = product.sku || labelData.productSku || '';
            labelData.productName = product.name || labelData.productName || '';
          }
        } catch (e) {}
      }
      
      if (!labelData.branchName && labelData.branchId) {
        try {
          const branchSnap = await getDoc(doc(db, 'branches', labelData.branchId));
          if (branchSnap.exists()) {
            labelData.branchName = branchSnap.data().name;
          }
        } catch (e) {}
      }
      setLabel(labelData);
      setLoading(false);
    };

    // First try subscribing to doc directly (using Firestore document ID)
    const docRef = doc(db, 'labels', id as string);
    const primaryUnsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        handleLabelSnap(snap);
      } else {
        // Fallback 1: Query by labelId (e.g. "TAG-001")
        primaryUnsub(); // clean up
        const qId = query(collection(db, 'labels'), where('labelId', '==', id as string), limit(1));
        const unsubFallbackId = onSnapshot(qId, (qSnap) => {
          if (!qSnap.empty) {
            handleLabelSnap(qSnap.docs[0]);
          } else {
            // Fallback 2: Query by labelCode or stringified ID "1", "2"
            unsubFallbackId(); // clean up
            const qCode = query(collection(db, 'labels'), where('labelCode', '==', id as string), limit(1));
            const unsubFallbackCode = onSnapshot(qCode, (qCodeSnap) => {
              if (!qCodeSnap.empty) {
                handleLabelSnap(qCodeSnap.docs[0]);
              } else {
                // Fallback 3: Query by id property being string
                unsubFallbackCode(); // clean up
                const qInt = query(collection(db, 'labels'), where('id', '==', id as string), limit(1));
                const unsubFallbackInt = onSnapshot(qInt, (qIntSnap) => {
                  if (!qIntSnap.empty) {
                    handleLabelSnap(qIntSnap.docs[0]);
                  } else {
                    setLabel(null);
                    setLoading(false);
                  }
                });
                unsubLabel = unsubFallbackInt;
              }
            });
            unsubLabel = unsubFallbackCode;
          }
        });
        unsubLabel = unsubFallbackId;
      }
    });
    unsubLabel = primaryUnsub;

    // Listen to global design config
    const unsubDesign = onSnapshot(doc(db, 'system_config', 'label_design'), (snap) => {
      if (snap.exists()) {
        setDesign(snap.data());
      } else {
        // Fallback default design
        setDesign({
          template: 'standard',
          showBattery: true,
          showQrCode: true,
          showStock: true,
          highContrast: true,
          fontFamily: 'Inter'
        });
      }
    });

    return () => {
      unsubLabel();
      unsubDesign();
    };
  }, [id]);

  // Build QR URL client-side only
  useEffect(() => {
    if (label) {
      try {
        const shortUrl = `${window.location.origin}/l/${label.id}`;
        setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shortUrl)}`);
      } catch (e) {
        console.error('Error creating QR URL:', e);
      }
    }
  }, [label]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#D1D5DB] flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Establishing Node Connection...</p>
      </div>
    );
  }

  if (!label) {
    return (
      <div className="min-h-screen bg-[#D1D5DB] flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-white/50 p-10 rounded-3xl backdrop-blur-md shadow-xl border border-white/20">
          <h1 className="text-4xl font-black text-slate-700 uppercase tracking-tighter">Node 404</h1>
          <p className="mt-4 text-slate-500 font-bold text-sm uppercase tracking-widest max-w-xs mx-auto">
            This hardware identifier is not currently registered in our sync network.
          </p>
        </div>
      </div>
    );
  }

  // Safety checks for rendering
  const originalPrice = Number(label.currentPrice || label.basePrice || 0);
  const finalPrice = Number(label.finalPrice || originalPrice || 0);
  const wholePart = Math.floor(finalPrice);
  const centsPart = finalPrice.toFixed(2).split('.')[1];
  
  // Logic to determine the best barcode value to display
  // 1. Try productCode if it looks like a real barcode (not our internal PR- prefix)
  // 2. Try productSku if it looks like a real barcode
  // 3. Fallback to productCode, then productSku
  const getBestBarcode = () => {
    const code = label.productCode || '';
    const sku = label.productSku || '';
    
    const isInternal = (val: string) => val.startsWith('PR-') || val.startsWith('DL-');
    const isEan = (val: string) => {
      const d = val.replace(/\D/g, '');
      return d.length === 8 || d.length === 12 || d.length === 13;
    };

    if (code && !isInternal(code)) return code;
    if (sku && !isInternal(sku)) return sku;
    if (isEan(code)) return code;
    if (isEan(sku)) return sku;
    
    return code || sku || '';
  };

  const barcodeValue = getBestBarcode();
  const labelLocation = label.location || label.branchName || 'Unplaced';

  return (
    <div className="min-h-screen bg-[#C8CCD2] flex items-center justify-center p-3 sm:p-5 lg:p-8 overflow-hidden"
      style={{ 
        background: 'radial-gradient(ellipse at center, #D4D8DE 0%, #A8AEB6 100%)'
      }}
    >
      {/* 3D Physical Device */}
      <div 
        className="relative w-full max-w-[min(92vw,620px)] sm:max-w-[min(88vw,680px)] lg:max-w-[min(72vw,700px)]"
        style={{
          perspective: '1200px',
        }}
      >
        <div 
          className="relative bg-[#F5F5F0] rounded-[14px] sm:rounded-[18px] overflow-hidden"
          style={{
            transform: 'rotateX(1.5deg) rotateY(-0.75deg)',
            transformStyle: 'preserve-3d',
            boxShadow: `
              0 2px 4px rgba(0,0,0,0.05),
              0 8px 16px rgba(0,0,0,0.08),
              0 30px 60px rgba(0,0,0,0.12),
              0 50px 80px rgba(0,0,0,0.08),
              inset 0 1px 0 rgba(255,255,255,0.6)
            `,
          }}
        >
          {/* Device Top Bezel */}
          <div className="px-4 pt-3 pb-2 sm:px-6 sm:pt-4 sm:pb-3 flex items-center justify-between">
            <span className="text-[8px] sm:text-[10px] font-bold text-[#999] uppercase tracking-[0.15em]">DIGITAL LABEL 4.2</span>
            <div className="h-2 w-2 sm:h-[9px] sm:w-[9px] rounded-full bg-[#4ADE80]" 
              style={{ boxShadow: '0 0 6px rgba(74,222,128,0.7)' }} 
            />
          </div>

          {/* E-Ink Screen Area */}
          <div className="mx-3 mb-3 sm:mx-4 sm:mb-4 bg-white border-2 border-[#1a1a1a] rounded-[3px] overflow-hidden relative"
            style={{
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
              fontFamily: design?.fontFamily || 'Inter',
              filter: design?.highContrast ? 'contrast(1.2)' : 'none'
            }}
          >
            {/* Status Bar */}
            <div className="px-3 py-2 sm:px-5 sm:py-2.5 flex justify-between items-center border-b-2 border-[#1a1a1a]">
               <div className="flex items-center gap-1.5">
                  <div className="h-3.5 w-3.5 bg-black flex items-center justify-center text-white rounded-sm">
                     <span className="text-[7px] font-black italic">S</span>
                  </div>
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter">SmartSync E-Ink</span>
               </div>
               {design?.showBattery && (
                  <div className="flex items-center gap-1 border border-black px-1 rounded-sm scale-90">
                     <span className="text-[8px] font-black">{label.battery || 100}%</span>
                     <div className="h-1.5 w-3 border-[1px] border-black relative">
                        <div className="h-full bg-black" style={{ width: `${label.battery || 100}%` }} />
                     </div>
                  </div>
               )}
            </div>

            {/* Template Rendering */}
            {(design?.template === 'promo' || (label.finalPrice && label.currentPrice && label.finalPrice < label.currentPrice)) ? (
               <>
                 {/* Standard & Promo shared layout structure */}
                 <div className="flex items-start justify-between border-b-2 border-[#1a1a1a] px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex-1">
                       <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Limited Time Offer</p>
                       <h1 className="text-[26px] sm:text-[36px] lg:text-[40px] font-black text-[#1a1a1a] tracking-tighter uppercase leading-[0.9]">
                        {label.productName || 'PRODUCT'}
                       </h1>
                    </div>
                    <div className="bg-rose-600 text-white p-2 sm:p-3 rotate-3 shadow-lg border-2 border-black">
                       <span className="text-[8px] sm:text-[9px] font-black block leading-none">SAVE</span>
                       <span className="text-lg sm:text-xl font-black">
                         {label.discountPercent || Math.round((1 - (label.finalPrice || 0) / (label.currentPrice || 1)) * 100)}%
                       </span>
                    </div>
                 </div>

                 <div className="flex border-b-2 border-[#1a1a1a]">
                    <div className="w-[38%] border-r-2 border-[#1a1a1a] p-3 sm:p-5 flex flex-col justify-center bg-slate-50/50">
                       <span className="text-[8px] sm:text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1">Was</span>
                       <span className="font-black text-[#1a1a1a] tracking-tight leading-none text-[16px] sm:text-[22px] line-through opacity-40">
                         ${originalPrice.toFixed(2)}
                       </span>
                       <span className="text-[8px] sm:text-[10px] font-bold text-[#888] uppercase tracking-widest mt-2 sm:mt-3 mb-1">Now Only</span>
                       <span className="text-[22px] sm:text-[30px] font-black text-rose-600 leading-none">${finalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-3 sm:p-5">
                       <div className="flex items-start">
                          <span className="text-[22px] sm:text-[30px] font-black text-black mt-5 sm:mt-7 mr-1">$</span>
                          <span className="text-[76px] sm:text-[112px] lg:text-[124px] font-black text-black leading-[0.75] tracking-tighter">
                            {wholePart}
                          </span>
                          <span className="text-[38px] sm:text-[56px] lg:text-[62px] font-black text-black leading-[0.9] tracking-tight mt-1">
                            .{centsPart}
                          </span>
                       </div>
                    </div>
                 </div>

                 <div className="flex items-stretch">
                    <div className="flex-1 px-4 py-3 sm:px-6 sm:py-4 flex flex-col justify-center border-r-2 border-black">
                       <BarcodeSvg value={barcodeValue} className="h-[76px] sm:h-[88px] w-[280px] sm:w-[390px] max-w-full mb-2" />
                       <div className="flex flex-wrap justify-between items-center gap-2">
                          <span className="text-[8px] sm:text-[10px] font-black tracking-[0.2em] sm:tracking-[0.3em] uppercase">{barcodeValue || 'PRODUCT BARCODE MISSING'}</span>
                          <span className="border border-black px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase">Loc: {labelLocation}</span>
                          {design?.showStock && (
                             <span className="bg-black text-white px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase">In Stock: {label.stock || 0}</span>
                          )}
                       </div>
                    </div>
                    {design?.showQrCode && qrUrl && (
                       <div className="w-[76px] sm:w-[96px] p-2 sm:p-3 flex items-center justify-center bg-white">
                          <img src={qrUrl} className="w-[58px] h-[58px] sm:w-[72px] sm:h-[72px] object-contain" alt="QR" />
                       </div>
                    )}
                 </div>
               </>
            ) : design?.template === 'minimal' ? (
               <div className="p-5 sm:p-7 flex flex-col items-center justify-center text-center min-h-[220px] sm:min-h-[280px]">
                  <h1 className="text-2xl sm:text-3xl font-black text-black leading-tight mb-3 uppercase tracking-tighter">
                    {label.productName || 'PRODUCT'}
                  </h1>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black">$</span>
                    <span className="text-6xl sm:text-7xl font-black tracking-tighter">{wholePart}.{centsPart}</span>
                  </div>
                  <BarcodeSvg value={barcodeValue} className="mt-5 h-[76px] sm:h-[88px] w-[280px] sm:w-[400px] max-w-full" />
                  <div className="mt-3 border border-black px-3 py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                    Loc: {labelLocation}
                  </div>
                  {design?.showQrCode && qrUrl && (
                    <div className="mt-8 p-1 border-[2px] border-black">
                       <img src={qrUrl} className="w-16 h-16" alt="QR" />
                    </div>
                  )}
               </div>
            ) : design?.template === 'inventory' ? (
               <div className="p-0 flex flex-col min-h-[220px] sm:min-h-[280px]">
                  <div className="bg-black text-white p-3 sm:p-4 flex justify-between items-center">
                     <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">Stock Control Log</span>
                     <span className="text-sm sm:text-lg font-black">{label.productSku}</span>
                  </div>
                  <div className="p-4 sm:p-6 flex-1 flex flex-col justify-center">
                     <h2 className="text-xl sm:text-2xl font-black text-black uppercase mb-2">{label.productName}</h2>
                     <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
                        <div className="border-2 border-black p-2 sm:p-3">
                           <span className="text-[8px] font-black uppercase block text-slate-500">Current Stock</span>
                           <span className="text-2xl sm:text-3xl font-black">{label.stock || 0}</span>
                        </div>
                        <div className="border-2 border-black p-2 sm:p-3">
                           <span className="text-[8px] font-black uppercase block text-slate-500">Price Point</span>
                           <span className="text-2xl sm:text-3xl font-black">${finalPrice}</span>
                        </div>
                     </div>
                  </div>
                  <div className="p-3 sm:p-4 border-t-2 border-black flex justify-between items-center gap-3">
                     <BarcodeSvg value={barcodeValue} className="h-[74px] sm:h-[84px] w-[270px] sm:w-[380px] max-w-full" />
                     <div className="text-right">
                        <span className="text-[8px] font-black uppercase block">Location</span>
                        <span className="text-[10px] font-bold uppercase block mb-1">{labelLocation}</span>
                        <span className="text-[8px] font-black uppercase block">Last Count</span>
                        <span className="text-[10px] font-bold">{new Date().toLocaleDateString()}</span>
                     </div>
                     {design?.showQrCode && qrUrl && <img src={qrUrl} className="w-12 h-12" alt="QR" />}
                  </div>
               </div>
            ) : (
               <>
                 {/* Standard layout structure */}
                 <div className="flex items-start justify-between border-b-2 border-[#1a1a1a] px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex-1">
                       <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Premium Retail</p>
                       <h1 className="text-[26px] sm:text-[36px] lg:text-[40px] font-black text-[#1a1a1a] tracking-tighter uppercase leading-[0.9]">
                        {label.productName || 'PRODUCT'}
                       </h1>
                    </div>
                 </div>

                 <div className="flex border-b-2 border-[#1a1a1a]">
                    <div className="w-[38%] border-r-2 border-[#1a1a1a] p-3 sm:p-5 flex flex-col justify-center">
                       <span className="text-[8px] sm:text-[10px] font-bold text-[#888] uppercase tracking-widest mb-1">Unit Price</span>
                       <span className="font-black text-[#1a1a1a] tracking-tight leading-none text-[20px] sm:text-[28px]">
                         ${originalPrice.toFixed(2)}
                       </span>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-3 sm:p-5 bg-slate-50/50">
                       <div className="flex items-start">
                          <span className="text-[22px] sm:text-[30px] font-black text-black mt-5 sm:mt-7 mr-1">$</span>
                          <span className="text-[76px] sm:text-[112px] lg:text-[124px] font-black text-black leading-[0.75] tracking-tighter">
                            {wholePart}
                          </span>
                          <span className="text-[38px] sm:text-[56px] lg:text-[62px] font-black text-black leading-[0.9] tracking-tight mt-1">
                            .{centsPart}
                          </span>
                       </div>
                    </div>
                 </div>

                 <div className="flex items-stretch">
                    <div className="flex-1 px-4 py-3 sm:px-6 sm:py-4 flex flex-col justify-center border-r-2 border-black">
                       <BarcodeSvg value={barcodeValue} className="h-[76px] sm:h-[88px] w-[280px] sm:w-[390px] max-w-full mb-2" />
                       <div className="flex flex-wrap justify-between items-center gap-2">
                          <span className="text-[8px] sm:text-[10px] font-black tracking-[0.2em] sm:tracking-[0.3em] uppercase">{barcodeValue || 'PRODUCT BARCODE MISSING'}</span>
                          <span className="border border-black px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase">Loc: {labelLocation}</span>
                          {design?.showStock && (
                             <span className="bg-black text-white px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase">Stock: {label.stock || 0}</span>
                          )}
                       </div>
                    </div>
                    {design?.showQrCode && qrUrl && (
                       <div className="w-[76px] sm:w-[96px] p-2 sm:p-3 flex items-center justify-center bg-white">
                          <img src={qrUrl} className="w-[58px] h-[58px] sm:w-[72px] sm:h-[72px] object-contain" alt="QR" />
                       </div>
                    )}
                 </div>
               </>
            )}
          </div>
        </div>

        {/* Subtle reflection underneath */}
        <div 
          className="absolute -bottom-4 left-[10%] right-[10%] h-8 rounded-[50%] opacity-20"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
      </div>

      {/* Corner Branding */}
      <div className="fixed top-6 left-8 flex items-center gap-3 opacity-40">
        <span className="text-sm font-black text-slate-600 uppercase tracking-[0.2em]">
          {label.branchName || 'SMART MARKET'}
        </span>
      </div>
      <div className="fixed top-6 right-8 flex items-center gap-2 opacity-40">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">LIVE</span>
      </div>
    </div>
  );
}
