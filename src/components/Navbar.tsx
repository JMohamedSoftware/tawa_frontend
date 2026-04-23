import { Hammer, LogOut, Map, Bell, User as UserIcon } from 'lucide-react';

interface User {
    id: string;
    email: string;
    fullName: string;
    role: 'client' | 'artisan' | 'admin';
}

export const Navbar = ({ user, onLogout, onNavigate }: { user: User | null, onLogout: () => void, onNavigate: (v: string) => void }) => (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
                <div className="bg-emerald-600 p-1.5 rounded-lg">
                    <Hammer className="text-white w-5 h-5" />
                </div>
                <span className="text-xl font-bold tracking-tight text-stone-900">Artisan<span className="text-emerald-600">.tn</span></span>
            </div>

            <div className="flex items-center gap-2 sm:gap-6">
                <button onClick={() => onNavigate('map')} className="p-2 text-stone-500 hover:text-emerald-600 transition-colors">
                    <Map className="w-5 h-5" />
                </button>
                
                {user && (
                    <button onClick={() => onNavigate('notifications')} className="p-2 text-stone-500 hover:text-emerald-600 transition-colors relative">
                        <Bell className="w-5 h-5" />
                    </button>
                )}

                {user ? (
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button
                            onClick={() => onNavigate(user.role === 'artisan' ? 'artisan-dashboard' : user.role === 'admin' ? 'admin-dashboard' : 'client-dashboard')}
                            className="text-sm font-bold text-stone-600 hover:text-emerald-600 transition-colors hidden sm:inline uppercase tracking-tighter"
                        >
                            {user.role === 'artisan' ? 'Dashboard' : user.role === 'admin' ? 'Admin' : 'Requests'}
                        </button>
                        
                        <div className="h-4 w-px bg-stone-200 hidden sm:block" />
                        
                        <button onClick={() => onNavigate(user.role === 'client' ? 'client-profile' : 'home')} className="flex items-center gap-2 group">
                            <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                                <UserIcon className="w-4 h-4 text-stone-500 group-hover:text-emerald-600" />
                            </div>
                        </button>

                        <button onClick={onLogout} className="p-2 hover:bg-rose-50 rounded-lg transition-colors group">
                            <LogOut className="w-4 h-4 text-stone-400 group-hover:text-rose-600" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setView ? onNavigate('login') : null} className="text-sm font-bold text-stone-600 px-4 py-2 hover:bg-stone-50 rounded-xl transition-colors">LOGIN</button>
                        <button onClick={() => setView ? onNavigate('register') : null} className="text-sm font-bold bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100">JOIN</button>
                    </div>
                )}
            </div>
        </div>
    </nav>
);
