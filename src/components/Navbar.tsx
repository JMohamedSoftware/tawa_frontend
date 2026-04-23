import { Hammer, LogOut } from 'lucide-react';

interface User {
    id: number;
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

            <div className="flex items-center gap-4">
                {user ? (
                    <>
                        <button
                            onClick={() => onNavigate(user.role === 'artisan' ? 'artisan-dashboard' : user.role === 'admin' ? 'admin-dashboard' : 'client-dashboard')}
                            className="text-sm font-medium text-stone-600 hover:text-emerald-600 transition-colors"
                        >
                            {user.role === 'artisan' ? 'Dashboard' : user.role === 'admin' ? 'Admin' : 'My Requests'}
                        </button>
                        <div className="h-4 w-px bg-stone-200" />
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-stone-900 hidden sm:inline">{user.fullName}</span>
                            <button onClick={onLogout} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                                <LogOut className="w-4 h-4 text-stone-500" />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-2">
                        <button onClick={() => onNavigate('login')} className="text-sm font-medium text-stone-600 px-4 py-2 hover:bg-stone-50 rounded-lg transition-colors">Login</button>
                        <button onClick={() => onNavigate('register')} className="text-sm font-medium bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-shadow shadow-sm">Join as Artisan</button>
                    </div>
                )}
            </div>
        </div>
    </nav>
);
