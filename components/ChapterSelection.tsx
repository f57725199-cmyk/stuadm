import React, { useState, useEffect } from 'react';
import { Chapter, Subject, ClassLevel, User, SystemSettings, Stream, Board } from '../types';
import { BookOpen, ChevronRight, Lock, CheckCircle, PlayCircle, Plus, Trash2, Edit2, Save, X } from 'lucide-react';

interface Props {
  chapters: Chapter[];
  subject: Subject;
  classLevel: ClassLevel;
  board?: Board;
  stream?: Stream | null;
  loading: boolean;
  user: User | null;
  onSelect: (chapter: Chapter) => void;
  onBack: () => void;
}

export const ChapterSelection: React.FC<Props> = ({ 
  chapters, 
  subject, 
  classLevel, 
  board = 'CBSE', 
  stream = null,
  loading, 
  user,
  onSelect, 
  onBack 
}) => {
  
  // Local State for Admin Editing
  const [localChapters, setLocalChapters] = useState<Chapter[]>(chapters);
  const [isEditing, setIsEditing] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Sync with props
  useEffect(() => {
      setLocalChapters(chapters);
  }, [chapters]);

  let settings: SystemSettings | null = null;
  try {
      const s = localStorage.getItem('nst_system_settings');
      if (s) settings = JSON.parse(s);
  } catch(e){}

  const restrictionEnabled = settings?.enableMcqUnlockRestriction !== false; 
  const userProgress = user?.progress?.[subject.id] || { currentChapterIndex: 0, totalMCQsSolved: 0 };
  const isAdmin = user?.role === 'ADMIN';

  // --- ADMIN HANDLERS ---
  const saveChaptersToStorage = (updatedList: Chapter[]) => {
      const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
      const cacheKey = `nst_custom_chapters_${board}-${classLevel}${streamKey}-${subject.name}-English`;
      const cacheKeyHindi = `nst_custom_chapters_${board}-${classLevel}${streamKey}-${subject.name}-Hindi`;
      
      localStorage.setItem(cacheKey, JSON.stringify(updatedList));
      localStorage.setItem(cacheKeyHindi, JSON.stringify(updatedList));
      // Note: Ideally sync to Firebase here too if needed, but AdminDashboard logic relied on local storage + optional sync
      // For now, local persistence is fine as app reads from it.
  };

  const handleAddChapter = () => {
      if (!newChapterTitle.trim()) return;
      const newCh: Chapter = {
          id: `ch-${Date.now()}`,
          title: newChapterTitle.trim()
      };
      const updated = [...localChapters, newCh];
      setLocalChapters(updated);
      saveChaptersToStorage(updated);
      setNewChapterTitle('');
      setIsEditing(false);
  };

  const handleDeleteChapter = (id: string) => {
      if (!confirm("Delete this chapter?")) return;
      const updated = localChapters.filter(c => c.id !== id);
      setLocalChapters(updated);
      saveChaptersToStorage(updated);
  };

  const startEdit = (ch: Chapter) => {
      setEditingId(ch.id);
      setEditTitle(ch.title);
  };

  const saveEdit = () => {
      const updated = localChapters.map(c => c.id === editingId ? { ...c, title: editTitle } : c);
      setLocalChapters(updated);
      saveChaptersToStorage(updated);
      setEditingId(null);
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-4xl mx-auto pb-20">
       <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-50 py-4 z-10">
        <div className="flex items-center">
            <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors mr-4 font-medium flex items-center gap-1">
            Back
            </button>
            <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <span>Class {classLevel}</span>
                <span>/</span>
                <span className="font-medium text-slate-700">{subject.name}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Syllabus</h2>
            </div>
        </div>
        
        {isAdmin && (
            <button 
                onClick={() => setIsEditing(!isEditing)} 
                className="bg-slate-900 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
            >
                {isEditing ? <X size={20} /> : <Plus size={20} />}
            </button>
        )}
      </div>

      {isEditing && isAdmin && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4 shadow-sm animate-in slide-in-from-top-4">
              <h4 className="font-bold text-slate-800 mb-2">Add New Chapter</h4>
              <div className="flex gap-2">
                  <input 
                      type="text" 
                      value={newChapterTitle} 
                      onChange={e => setNewChapterTitle(e.target.value)} 
                      placeholder="Chapter Name..." 
                      className="flex-1 p-3 border rounded-xl"
                  />
                  <button onClick={handleAddChapter} className="bg-blue-600 text-white px-6 rounded-xl font-bold">Add</button>
              </div>
          </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
             <div key={i} className="h-24 bg-white rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {localChapters.map((chapter, index) => {
            const isCompleted = restrictionEnabled ? index < userProgress.currentChapterIndex : false;
            const isCurrent = restrictionEnabled ? index === userProgress.currentChapterIndex : true; 
            
            // @ts-ignore
            const isExplicitlyLocked = chapter.isLocked === true;
            const isLocked = !isAdmin && (
                isExplicitlyLocked || 
                (restrictionEnabled && index > userProgress.currentChapterIndex)
            );
            
            if (editingId === chapter.id) {
                return (
                    <div key={chapter.id} className="bg-white p-4 rounded-xl border border-blue-500 shadow-md flex gap-2 items-center">
                        <input 
                            type="text" 
                            value={editTitle} 
                            onChange={e => setEditTitle(e.target.value)} 
                            className="flex-1 p-2 border rounded-lg"
                            autoFocus
                        />
                        <button onClick={saveEdit} className="p-2 bg-green-100 text-green-700 rounded-lg"><Save size={18} /></button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-slate-100 text-slate-500 rounded-lg"><X size={18} /></button>
                    </div>
                );
            }

            return (
              <div key={chapter.id} className="relative group">
                  <button
                    onClick={() => onSelect(chapter)}
                    disabled={isLocked}
                    className={`w-full p-5 rounded-xl border transition-all text-left flex items-center relative overflow-hidden ${
                        isLocked 
                        ? 'bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed' 
                        : isCurrent 
                            ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' 
                            : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                        isLocked ? 'bg-slate-300' : isCurrent ? 'bg-blue-600' : 'bg-green-500'
                    }`}></div>

                    <div className="mr-5 ml-2 min-w-[3.5rem] flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CH</span>
                    <span className={`text-2xl font-bold ${isCurrent ? 'text-blue-600' : isLocked ? 'text-slate-400' : 'text-green-600'}`}>
                        {(index + 1).toString().padStart(2, '0')}
                    </span>
                    </div>
                    
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-bold text-lg ${isLocked ? 'text-slate-500' : 'text-slate-800'}`}>
                                {chapter.title}
                            </h3>
                            {isCurrent && !isAdmin && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold animate-pulse">ACTIVE</span>}
                        </div>
                        
                        {isLocked && !isAdmin ? (
                            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                                <Lock size={12} />
                                <span>{isExplicitlyLocked ? "Locked by Admin" : "Complete previous chapters"}</span>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400">
                                {isAdmin ? 'Admin Access' : isCurrent ? 'Continue Learning' : 'Completed'}
                            </div>
                        )}
                    </div>

                    <div className="ml-2">
                        {isLocked && !isAdmin ? (
                            <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center"><Lock size={18} /></div>
                        ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCurrent ? 'bg-blue-600 text-white' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                                {isCurrent ? <PlayCircle size={20} /> : <CheckCircle size={18} />}
                            </div>
                        )}
                    </div>
                  </button>

                  {/* ADMIN ACTION BUTTONS (Overlay) */}
                  {isAdmin && (
                      <div className="absolute right-16 top-1/2 -translate-y-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm p-1 rounded-lg shadow-sm">
                          <button onClick={(e) => { e.stopPropagation(); startEdit(chapter); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit2 size={16} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteChapter(chapter.id); }} className="p-2 text-red-600 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                      </div>
                  )}
              </div>
            );
          })}
          
          {localChapters.length === 0 && !loading && (
             <div className="text-center py-20 text-slate-400">
                <BookOpen size={48} className="mx-auto mb-4 opacity-50"/>
                <p>No chapters found. Add one!</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
};
