import React, { useState, useEffect } from 'react';
import { ClassLevel, Subject, Stream, User, Board } from '../types';
import { getSubjectsList, DEFAULT_SUBJECTS } from '../constants';
import { Calculator, FlaskConical, Languages, Globe2, BookMarked, History, Binary, TrendingUp, Briefcase, Landmark, Palette, Feather, Home, HeartPulse, Activity, Cpu, Plus, Trash2, X } from 'lucide-react';

interface Props {
  classLevel: ClassLevel;
  stream: Stream | null;
  board?: Board; // Optional context
  user?: User | null; // For Admin Check
  onSelect: (subject: Subject) => void;
  onBack: () => void;
  hideBack?: boolean; 
}

const SubjectIcon: React.FC<{ icon: string, className?: string }> = ({ icon, className }) => {
    switch(icon) {
        case 'math': return <Calculator className={className} />;
        case 'science': 
        case 'physics': return <FlaskConical className={className} />;
        case 'flask': return <FlaskConical className={className} />; 
        case 'bio': return <HeartPulse className={className} />;
        case 'english': 
        case 'hindi':
        case 'sanskrit':
        case 'book':
            return <Languages className={className} />;
        case 'social': return <Globe2 className={className} />;
        case 'geo': return <Globe2 className={className} />;
        case 'computer': return <Cpu className={className} />;
        case 'history': return <History className={className} />;
        case 'accounts': return <TrendingUp className={className} />;
        case 'business': return <Briefcase className={className} />;
        case 'gov': return <Landmark className={className} />;
        case 'ppl': return <BookMarked className={className} />;
        case 'mind': return <Feather className={className} />;
        case 'home': return <Home className={className} />;
        case 'active': return <Activity className={className} />;
        default: return <BookMarked className={className} />;
    }
}

export const SubjectSelection: React.FC<Props> = ({ classLevel, stream, board, user, onSelect, onBack, hideBack = false }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
      setSubjects(getSubjectsList(classLevel, stream));
  }, [classLevel, stream]);

  const handleAddSubject = () => {
      if (!newSubName.trim()) return;
      
      const id = newSubName.toLowerCase().replace(/\s+/g, '');
      const newSubject: Subject = { 
          id, 
          name: newSubName.trim(), 
          icon: 'book', 
          color: 'bg-slate-50 text-slate-600' 
      };

      // Update LocalStorage Pool
      let pool = { ...DEFAULT_SUBJECTS };
      try {
          const stored = localStorage.getItem('nst_custom_subjects_pool');
          if (stored) pool = JSON.parse(stored);
      } catch(e) {}
      
      pool = { ...pool, [id]: newSubject };
      localStorage.setItem('nst_custom_subjects_pool', JSON.stringify(pool));
      
      setSubjects(prev => [...prev, newSubject]);
      setNewSubName('');
      setShowAddModal(false);
  };

  const handleDeleteSubject = (id: string) => {
      if (!confirm("Delete this subject?")) return;
      
      // Update LocalStorage Pool (Remove from pool if custom)
      // Note: We can't delete default subjects easily from the pool merging logic unless we flag them.
      // But we can filter them out from the current view list for now.
      // Or we assume Admin wants to hide them?
      // `getSubjectsList` logic merges defaults.
      // To "delete", we might need a "hiddenSubjects" list in settings.
      // But for custom added ones, we can remove from pool.
      
      let pool: any = {};
      try {
          const stored = localStorage.getItem('nst_custom_subjects_pool');
          if (stored) pool = JSON.parse(stored);
      } catch(e) {}
      
      if (pool[id]) {
          delete pool[id];
          localStorage.setItem('nst_custom_subjects_pool', JSON.stringify(pool));
          setSubjects(prev => prev.filter(s => s.id !== id));
      } else {
          // It's a default subject. We can't "delete" it from pool, but we can hide it locally?
          alert("Cannot delete default subjects. You can hide them in Global Settings.");
      }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500 pb-20">
      {!hideBack && (
        <div className="flex items-center mb-8">
            <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors mr-4">
            &larr; Back
            </button>
            <div>
            <h2 className="text-2xl font-bold text-slate-800">
                {stream ? `${stream} Subjects` : `Class ${classLevel} Subjects`}
            </h2>
            <p className="text-slate-500 text-sm">Select a subject to view chapters</p>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((subject) => (
          <div key={subject.id} className="relative group">
              <button
                onClick={() => onSelect(subject)}
                className="w-full flex items-center p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left"
              >
                <div className={`w-14 h-14 rounded-lg flex items-center justify-center mr-4 ${subject.color} group-hover:scale-110 transition-transform`}>
                  <SubjectIcon icon={subject.icon} className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{subject.name}</h3>
                  <p className="text-xs text-slate-400">Explore Syllabus</p>
                </div>
              </button>
              
              {isAdmin && (
                  <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteSubject(subject.id); }}
                      className="absolute top-2 right-2 p-2 bg-white/80 rounded-full text-red-400 hover:text-red-600 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                      <Trash2 size={16} />
                  </button>
              )}
          </div>
        ))}

        {isAdmin && (
            <button 
                onClick={() => setShowAddModal(true)}
                className="flex flex-col items-center justify-center p-5 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all text-slate-400 hover:text-blue-500 h-full min-h-[100px]"
            >
                <Plus size={32} />
                <span className="font-bold text-xs mt-2">Add Subject</span>
            </button>
        )}
      </div>

      {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                  <h3 className="text-lg font-bold mb-4">Add New Subject</h3>
                  <input 
                      type="text" 
                      value={newSubName} 
                      onChange={e => setNewSubName(e.target.value)} 
                      placeholder="Subject Name" 
                      className="w-full p-3 border rounded-xl mb-4"
                      autoFocus
                  />
                  <div className="flex gap-2">
                      <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button>
                      <button onClick={handleAddSubject} className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold">Add</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
