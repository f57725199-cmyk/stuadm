import React, { useState, useEffect } from 'react';
import { Chapter, User, Subject, SystemSettings } from '../types';
import { PlayCircle, Lock, ArrowLeft, Crown, AlertCircle, CheckCircle, Wifi, Youtube, Edit, Plus, Trash2, Save, X } from 'lucide-react';
import { getChapterData, saveChapterData, saveUserToLive } from '../firebase';
import { CreditConfirmationModal } from './CreditConfirmationModal';
import { CustomAlert } from './CustomDialogs';

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

export const VideoPlaylistView: React.FC<Props> = ({ 
  chapter, subject, user, board, classLevel, stream, onBack, onUpdateUser, settings 
}) => {
  const [playlist, setPlaylist] = useState<{title: string, url: string, price?: number}[]>([]);
  const [activeVideo, setActiveVideo] = useState<{url: string, title: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  
  // ADMIN STATE
  const [isEditing, setIsEditing] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoPrice, setNewVideoPrice] = useState(5);
  const isAdmin = user.role === 'ADMIN';

  // New Confirmation State
  const [pendingVideo, setPendingVideo] = useState<{index: number, price: number} | null>(null);

  const getStorageKey = () => {
      const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
      return `nst_content_${board}_${classLevel}${streamKey}_${subject.name}_${chapter.id}`;
  };

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      const key = getStorageKey();
      
      let data = await getChapterData(key);
      if (!data) {
          const stored = localStorage.getItem(key);
          if (stored) data = JSON.parse(stored);
      }

      if (data && data.videoPlaylist && Array.isArray(data.videoPlaylist)) {
          setPlaylist(data.videoPlaylist);
      } else if (data && (data.premiumVideoLink || data.freeVideoLink)) {
          // Legacy support
          setPlaylist([
              { title: 'Lecture 1', url: data.premiumVideoLink || data.freeVideoLink || '', price: data.price || settings?.defaultVideoCost || 5 }
          ]);
      } else {
          setPlaylist([]);
      }
      setLoading(false);
    };

    fetchVideos();
  }, [chapter.id, board, classLevel, stream, subject.name]);

  const handleSavePlaylist = async (updatedPlaylist: any[]) => {
      const key = getStorageKey();
      // We need to fetch existing data to merge, or assume we overwrite the playlist part
      // Since getChapterData might have other fields (PDF links etc), we should merge.
      // But `saveChapterData` overwrites if we don't be careful? No, `saveChapterData` in firebase.ts:
      // "await set(ref(rtdb, ...), data)" -> Overwrites node.
      // "await setDoc(..., data)" -> Overwrites doc.
      // So we MUST merge with existing data.
      
      let existingData = await getChapterData(key) || {};
      const stored = localStorage.getItem(key);
      if (stored) existingData = { ...existingData, ...JSON.parse(stored) };

      const newData = {
          ...existingData,
          videoPlaylist: updatedPlaylist
      };

      // Save Local
      localStorage.setItem(key, JSON.stringify(newData));
      setPlaylist(updatedPlaylist);
      
      // Save Cloud
      await saveChapterData(key, newData);
  };

  const handleAddVideo = async () => {
      if (!newVideoTitle || !newVideoUrl) {
          setAlertConfig({isOpen: true, message: "Title and URL are required."});
          return;
      }
      const newVideo = { title: newVideoTitle, url: newVideoUrl, price: newVideoPrice };
      const updated = [...playlist, newVideo];
      await handleSavePlaylist(updated);
      setNewVideoTitle(''); setNewVideoUrl('');
      setAlertConfig({isOpen: true, message: "Video Added!"});
  };

  const handleDeleteVideo = async (index: number) => {
      if (!confirm("Delete this video?")) return;
      const updated = playlist.filter((_, i) => i !== index);
      await handleSavePlaylist(updated);
  };

  const handleVideoClick = (index: number) => {
      const video = playlist[index];
      if (!video.url) return;

      const price = video.price !== undefined ? video.price : (settings?.defaultVideoCost ?? 5); 
      
      // 1. Check if Admin
      if (user.role === 'ADMIN') {
          setActiveVideo(video);
          return;
      }

      // 2. Check Subscription (Global or Specific)
      const isSubscribed = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
      // If Ultra, everything free?
      if (isSubscribed && user.subscriptionLevel === 'ULTRA') {
          setActiveVideo(video);
          return;
      }

      // 4. Pay & Play (Check Auto-Pay)
      if (user.credits < price) {
          setAlertConfig({isOpen: true, message: `Insufficient Credits! You need ${price} coins to watch this video.`});
          return;
      }

      if (user.isAutoDeductEnabled) {
          processPaymentAndPlay(video, price);
      } else {
          setPendingVideo({ index, price });
      }
  };

  const processPaymentAndPlay = (video: any, price: number, enableAuto: boolean = false) => {
      let updatedUser = { ...user, credits: user.credits - price };
      
      if (enableAuto) {
          updatedUser.isAutoDeductEnabled = true;
      }

      localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
      saveUserToLive(updatedUser); // Cloud Sync
      onUpdateUser(updatedUser); // Update Parent State
      
      setActiveVideo(video);
      setPendingVideo(null);
  };

  const getVideoEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('youtu')) {
        let videoId = '';
        if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
        else if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
        else if (url.includes('embed/')) videoId = url.split('embed/')[1].split('?')[0];
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }
    if (url.includes('drive.google.com')) return url.replace('/view', '/preview');
    return url;
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20 animate-in fade-in slide-in-from-right-8">
       {/* HEADER */}
       <CustomAlert 
            isOpen={alertConfig.isOpen} 
            message={alertConfig.message} 
            onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
       />
       <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm p-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h3 className="font-bold text-slate-800 leading-tight line-clamp-1">{chapter.title}</h3>
                    <p className="text-xs text-slate-500">{subject.name}</p>
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

       {/* PLAYER AREA */}
       {activeVideo ? (
           <div className="aspect-video bg-black w-full sticky top-[73px] z-10 relative">
               <div className="absolute top-0 left-0 right-0 h-14 z-20 bg-transparent"></div>
               <div className="absolute bottom-0 right-0 w-32 h-14 z-20 bg-transparent"></div>
               <iframe 
                   src={getVideoEmbedUrl(activeVideo.url)} 
                   className="w-full h-full relative z-10" 
                   allow="autoplay; encrypted-media; fullscreen" 
                   allowFullScreen
                   title="Video Player"
               />
           </div>
       ) : null}

       {/* PLAYLIST */}
       <div className="p-4">
           {isEditing && (
               <div className="bg-white p-4 rounded-xl border-2 border-blue-100 mb-6 shadow-sm animate-in slide-in-from-top-2">
                   <h4 className="font-bold text-slate-800 mb-3 text-sm">Add New Video</h4>
                   <div className="space-y-2">
                       <input 
                           type="text" placeholder="Video Title" 
                           value={newVideoTitle} onChange={e => setNewVideoTitle(e.target.value)} 
                           className="w-full p-2 border rounded-lg text-sm"
                       />
                       <input 
                           type="text" placeholder="Video URL (YouTube/Drive)" 
                           value={newVideoUrl} onChange={e => setNewVideoUrl(e.target.value)} 
                           className="w-full p-2 border rounded-lg text-sm font-mono text-blue-600"
                       />
                       <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-slate-500">Price:</span>
                           <input 
                               type="number" value={newVideoPrice} onChange={e => setNewVideoPrice(Number(e.target.value))} 
                               className="w-20 p-2 border rounded-lg text-sm"
                           />
                           <button onClick={handleAddVideo} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2">
                               <Plus size={16} /> Add Video
                           </button>
                       </div>
                   </div>
               </div>
           )}

           <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
               <Youtube size={20} className="text-red-600" /> 
               Video Lectures
           </h4>
           
           {loading ? (
               <div className="space-y-3">
                   {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse"/>)}
               </div>
           ) : playlist.length === 0 ? (
               <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                   <p className="text-slate-400 font-medium">No videos uploaded for this chapter yet.</p>
               </div>
           ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {playlist.map((vid, idx) => {
                       const price = vid.price !== undefined ? vid.price : (settings?.defaultVideoCost ?? 5);
                       const isFree = price === 0 || user.role === 'ADMIN' || (user.isPremium && user.subscriptionLevel === 'ULTRA');
                       const isActive = activeVideo?.url === vid.url;

                       return (
                           <div key={idx} className={`group relative overflow-hidden rounded-2xl border transition-all ${isActive ? 'bg-red-50 border-red-200 shadow-md ring-1 ring-red-200' : 'bg-white border-slate-200 hover:shadow-lg'}`}>
                               {isEditing && (
                                   <button 
                                       onClick={() => handleDeleteVideo(idx)} 
                                       className="absolute top-2 right-2 z-20 bg-white text-red-500 p-1.5 rounded-full shadow-md hover:bg-red-50"
                                   >
                                       <Trash2 size={14} />
                                   </button>
                               )}
                               
                               {/* THUMBNAIL */}
                               <div className="aspect-video bg-slate-800 relative">
                                   {!isFree && !isActive && (
                                       <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 backdrop-blur-[1px]">
                                           <Lock size={32} className="text-white/80 mb-1" />
                                           <span className="text-[10px] font-bold text-white uppercase tracking-wider">Locked</span>
                                       </div>
                                   )}
                                   <div className="absolute inset-0 flex items-center justify-center">
                                       <PlayCircle size={48} className="text-white/50 group-hover:text-white transition-colors" />
                                   </div>
                               </div>

                               {/* CONTENT */}
                               <div className="p-3">
                                   <h5 className="font-bold text-sm text-slate-800 line-clamp-2 leading-snug mb-2">{vid.title}</h5>
                                   {isFree || isActive ? (
                                       <button onClick={() => handleVideoClick(idx)} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2">
                                           <PlayCircle size={14} /> Play Now
                                       </button>
                                   ) : (
                                       <div className="flex gap-2">
                                           <button onClick={() => handleVideoClick(idx)} className="flex-1 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1">
                                               <span className="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-white text-[8px]">🟡</span> Play ({price} CR)
                                           </button>
                                           <button onClick={() => setAlertConfig({isOpen: true, message: "Go to Store to buy Ultra Subscription!"})} className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1">
                                               <span>👑</span> Unlock Ultra
                                           </button>
                                       </div>
                                   )}
                               </div>
                           </div>
                       );
                   })}
               </div>
           )}
       </div>

       {pendingVideo && (
           <CreditConfirmationModal 
               title="Unlock Video"
               cost={pendingVideo.price}
               userCredits={user.credits}
               isAutoEnabledInitial={!!user.isAutoDeductEnabled}
               onCancel={() => setPendingVideo(null)}
               onConfirm={(auto) => {
                   const video = playlist[pendingVideo.index];
                   processPaymentAndPlay(video, pendingVideo.price, auto);
               }}
           />
       )}
    </div>
  );
};
