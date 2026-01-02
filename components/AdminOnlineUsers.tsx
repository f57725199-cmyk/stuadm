import React, { useEffect, useState } from 'react';
import { subscribeToUsers } from '../firebase';
import { User } from '../types';
import { Users, Wifi, Clock, Search } from 'lucide-react';

export const AdminOnlineUsers: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        const unsub = subscribeToUsers((u) => {
            // Sort by last active desc
            const sorted = u.sort((a,b) => {
                const ta = a.lastActiveTime ? new Date(a.lastActiveTime).getTime() : 0;
                const tb = b.lastActiveTime ? new Date(b.lastActiveTime).getTime() : 0;
                return tb - ta;
            });
            setUsers(sorted);
        });
        return () => unsub();
    }, []);

    const isOnline = (time?: string) => {
        if (!time) return false;
        return (Date.now() - new Date(time).getTime()) < 5 * 60 * 1000;
    };

    const onlineCount = users.filter(u => isOnline(u.lastActiveTime)).length;
    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(filter.toLowerCase()) || u.email?.toLowerCase().includes(filter.toLowerCase()));

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Users size={20} />
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                    </div>
                    <h3 className="font-bold">Live Users ({onlineCount})</h3>
                </div>
            </div>
            
            <div className="p-2 border-b">
                <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2">
                    <Search size={14} className="text-slate-400 mr-2" />
                    <input 
                        type="text" 
                        placeholder="Search users..." 
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="bg-transparent text-xs w-full outline-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filteredUsers.map(u => {
                    const online = isOnline(u.lastActiveTime);
                    return (
                        <div key={u.id} className={`p-3 rounded-xl border flex items-center justify-between ${online ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${online ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {u.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800">{u.name}</p>
                                    <p className="text-[10px] text-slate-500">{u.classLevel} • {u.board}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                {online ? (
                                    <span className="text-[10px] font-bold text-green-600 flex items-center gap-1 justify-end">
                                        <Wifi size={10} /> Online
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                                        <Clock size={10} /> {u.lastActiveTime ? new Date(u.lastActiveTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Offline'}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
