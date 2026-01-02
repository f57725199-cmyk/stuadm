import React, { useState, useEffect } from 'react';
import { Chapter, User, Subject, SystemSettings } from '../types';
import { FileText, Lock, ArrowLeft, Crown, Star, CheckCircle, AlertCircle, Edit, Save, Link } from 'lucide-react';
import { CustomAlert } from './CustomDialogs';
import { getChapterData, saveChapterData, saveUserToLive } from '../firebase';
import { CreditConfirmationModal } from './CreditConfirmationModal';

interface Props {
  chapter: Chapter;
  subject: Subject;
  user: User;
  board: string;
  classLevel: string;
  stream: string | null;
  onBack: () => void;
  onUpdateUser: (user: User) => void;
  settings?: SystemSettings;
}

export const PdfView: React.FC<Props> = ({ 
  chapter, subject, user, board, classLevel, stream, onBack, onUpdateUser, settings 
}) => {
  const [contentData, setContentData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activePdf, setActivePdf] = useState<string | null>(null);
  const [pendingPdf, setPendingPdf] = useState<{type: string, price: number, link: string} | null>(null);
  
  // ADMIN STATE
  const [isEditing, setIsEditing] = useState(false);
  const [editFreeLink, setEditFreeLink] = useState('');
  const [editPremiumLink, setEditPremiumLink] = useState('');
  const [editPrice, setEditPrice] = useState(5);
  const isAdmin = user.role === 'ADMIN';

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});

  const getStorageKey = () => {
      const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
      return `nst_content_${board}_${classLevel}${streamKey}_${subject.name}_${chapter.id}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const key = getStorageKey();
        
        let data = await getChapterData(key);
        if (!data) {
            const stored = localStorage.getItem(key);
            if (stored) data = JSON.parse(stored);
        }
        setContentData(data || {});
        setEditFreeLink(data?.freeLink || '');
        setEditPremiumLink(data?.premiumLink || '');
        setEditPrice(data?.price !== undefined ? data.price : (settings?.defaultPdfCost ?? 5));
      } catch (error) {
        console.error("Error loading PDF data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [chapter.id, board, classLevel, stream, subject.name]);

  const handleSaveLinks = async () => {
      const key = getStorageKey();
      const updatedData = {
          ...contentData,
          freeLink: editFreeLink,
          premiumLink: editPremiumLink,
          price: editPrice
      };
      
      // Local
      localStorage.setItem(key, JSON.stringify(updatedData));
      setContentData(updatedData);
      
      // Cloud
      try {
          await saveChapterData(key, updatedData);
          setAlertConfig({ isOpen: true, message: "PDF Links Updated!" });
          setIsEditing(false);
      } catch (e) {
          setAlertConfig({ isOpen: true, message: "Save Failed." });
      }
  };

  const handlePdfClick = (type: 'FREE' | 'PREMIUM') => {
      let link = '';
      let price = 0;

      if (type === 'FREE') {
          link = contentData?.freeLink;
          price = 0;
      } else if (type === 'PREMIUM') {
          link = contentData?.premiumLink;
          price = contentData?.price !== undefined ? contentData.price : (settings?.defaultPdfCost ?? 5);
      }

      if (!link) {
          if (isAdmin) {
              setIsEditing(true);
              return;
          }
          setAlertConfig({isOpen: true, message: "Coming Soon! This content is being prepared."});
          return;
      }

      // Access Check
      if (isAdmin) {
          setActivePdf(link);
          return;
      }

      if (price === 0) {
          setActivePdf(link);
          return;
      }

      // Subscription Check
      const isSubscribed = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
      if (isSubscribed) {
          // ULTRA unlocks EVERYTHING
          if (user.subscriptionLevel === 'ULTRA') {
              setActivePdf(link);
              return;
          }
      }

      // Coin Deduction
      if (user.isAutoDeductEnabled) {
          processPaymentAndOpen(link, price);
      } else {
          setPendingPdf({ type, price, link });
      }
  };

  const processPaymentAndOpen = (link: string, price: number, enableAuto: boolean = false) => {
      if (user.credits < price) {
          setAlertConfig({isOpen: true, message: `Insufficient Credits! You need ${price} coins.`});
          return;
      }

      let updatedUser = { ...user, credits: user.credits - price };
      
      if (enableAuto) {
          updatedUser.isAutoDeductEnabled = true;
      }

      localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
      saveUserToLive(updatedUser);
      onUpdateUser(updatedUser);
      
      setActivePdf(link);
      setPendingPdf(null);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20 animate-in fade-in slide-in-from-right-8">
       <CustomAlert 
           isOpen={alertConfig.isOpen} 
           message={alertConfig.message} 
           onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
       />
       {/* HEADER */}
       <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm p-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
                <button onClick={() => activePdf ? setActivePdf(null) : onBack()} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h3 className="font-bold text-slate-800 leading-tight line-clamp-1">{chapter.title}</h3>
                    <p className="text-xs text-slate-500">{subject.name} • Notes</p>
                </div>
           </div>
           
           <div className="flex items-center gap-2">
               {isAdmin && (
                   <button onClick={() => setIsEditing(!isEditing)} className={`p-2 rounded-full ${isEditing ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                       <Edit size={18} />
                   </button>
               )}
               <div className="flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                   <Crown size={14} className="text-blue-600" />
                   <span className="font-black text-blue-800 text-xs">{user.credits} CR</span>
               </div>
           </div>
       </div>

       {activePdf ? (
           <div className="h-[calc(100vh-80px)] w-full bg-slate-100 relative">
               {(contentData?.watermarkText || contentData?.watermarkConfig) && (
                   <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden select-none">
                       {/* Simplified Watermark for View */}
                       <div className="w-full h-full flex flex-col items-center justify-center gap-24 opacity-30">
                            {Array.from({length: 8}).map((_, i) => (
                                <div key={i} style={{ transform: 'rotate(-12deg)' }}>
                                    <span className="text-4xl font-black text-slate-400 uppercase">
                                        {contentData.watermarkText || 'IIC'}
                                    </span>
                                </div>
                            ))}
                       </div>
                   </div>
               )}
               <iframe 
                   src={activePdf.includes('drive.google.com') ? activePdf.replace('/view', '/preview') : activePdf} 
                   className="w-full h-full border-none relative z-0"
                   title="PDF Viewer"
                   sandbox="allow-scripts allow-same-origin"
               ></iframe>
           </div>
       ) : (
       <div className="p-6 space-y-4">
           {isEditing && (
               <div className="bg-white p-4 rounded-xl border-2 border-blue-100 shadow-sm mb-6 animate-in slide-in-from-top-2">
                   <h4 className="font-bold text-slate-800 mb-3 text-sm">Update Links</h4>
                   <div className="space-y-3">
                       <div>
                           <label className="text-xs font-bold text-slate-500 uppercase">Free Link</label>
                           <input type="text" value={editFreeLink} onChange={e => setEditFreeLink(e.target.value)} className="w-full p-2 border rounded-lg text-sm" placeholder="https://..." />
                       </div>
                       <div>
                           <label className="text-xs font-bold text-slate-500 uppercase">Premium Link</label>
                           <input type="text" value={editPremiumLink} onChange={e => setEditPremiumLink(e.target.value)} className="w-full p-2 border rounded-lg text-sm" placeholder="https://..." />
                       </div>
                       <div>
                           <label className="text-xs font-bold text-slate-500 uppercase">Price</label>
                           <input type="number" value={editPrice} onChange={e => setEditPrice(Number(e.target.value))} className="w-20 p-2 border rounded-lg text-sm" />
                       </div>
                       <button onClick={handleSaveLinks} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                           <Save size={16} /> Save Changes
                       </button>
                   </div>
               </div>
           )}

           {loading ? (
               <div className="space-y-4">
                   <div className="h-24 bg-slate-100 rounded-2xl animate-pulse"></div>
               </div>
           ) : (
               <>
                   {/* FREE NOTES */}
                   <button 
                       onClick={() => handlePdfClick('FREE')}
                       className="w-full p-5 rounded-2xl border-2 border-green-100 bg-white hover:bg-green-50 flex items-center gap-4 transition-all relative group overflow-hidden"
                   >
                       <div className="absolute top-3 right-3 flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold"><CheckCircle size={10} /> FREE</div>
                       <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center border border-green-100"><FileText size={24} /></div>
                       <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-800">Free Notes</h4>
                           <p className="text-xs text-slate-500">{editFreeLink ? 'Available' : 'Coming Soon'}</p>
                       </div>
                       <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center"><ArrowLeft size={16} className="rotate-180" /></div>
                   </button>

                   {/* PREMIUM NOTES */}
                   <button 
                       onClick={() => handlePdfClick('PREMIUM')}
                       className="w-full p-5 rounded-2xl border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-white hover:border-yellow-300 flex items-center gap-4 transition-all relative group overflow-hidden"
                   >
                       <div className="absolute top-3 right-3 flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-yellow-200"><Crown size={10} /> PREMIUM</div>
                       <div className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center border border-yellow-200"><Star size={24} fill="currentColor" /></div>
                       <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-800">Premium Notes</h4>
                           <p className="text-xs text-slate-500">{editPremiumLink ? 'Available' : 'Coming Soon'}</p>
                       </div>
                       <div className="flex flex-col items-end">
                           <span className="text-xs font-black text-yellow-700">{contentData?.price !== undefined ? contentData.price : 5} CR</span>
                           <span className="text-[10px] text-slate-400">Unlock</span>
                       </div>
                   </button>
               </>
           )}
       </div>
       )}

       {pendingPdf && (
           <CreditConfirmationModal 
               title={`Unlock ${pendingPdf.type === 'PREMIUM' ? 'Premium' : 'Free'} Notes`}
               cost={pendingPdf.price}
               userCredits={user.credits}
               isAutoEnabledInitial={!!user.isAutoDeductEnabled}
               onCancel={() => setPendingPdf(null)}
               onConfirm={(auto) => processPaymentAndOpen(pendingPdf.link, pendingPdf.price, auto)}
           />
       )}
    </div>
  );
};
