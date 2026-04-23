import { Star, ClipboardList, MapPin, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Artisan {
    id: number;
    full_name: string;
    category_name: string;
    category_slug: string;
    bio: string;
    avg_rating: number;
    completed_jobs: number;
    is_verified: number;
    is_online: number;
    distance_km: string;
    smart_score: number;
}

export const ArtisanCard = ({ artisan, onClick }: { artisan: Artisan, onClick: () => void }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-xl transition-all group cursor-pointer"
        onClick={onClick}
    >
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 font-bold text-xl uppercase">
                    {artisan.full_name.charAt(0)}
                </div>
                <div>
                    <h3 className="font-bold text-stone-900 group-hover:text-emerald-600 transition-colors">{artisan.full_name}</h3>
                    <p className="text-xs text-stone-500 font-medium uppercase tracking-tighter">{artisan.category_name}</p>
                </div>
            </div>
            {artisan.is_verified === 1 && (
                <div className="bg-emerald-100 text-emerald-700 p-1 rounded-full" title="Verified Artisan">
                    <ShieldCheck className="w-4 h-4" />
                </div>
            )}
        </div>

        <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1 text-amber-500 font-bold">
                <Star className="w-4 h-4 fill-current" />
                <span>{artisan.avg_rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1 text-stone-500">
                <ClipboardList className="w-4 h-4" />
                <span>{artisan.completed_jobs} jobs</span>
            </div>
            <div className="flex items-center gap-1 text-stone-500">
                <MapPin className="w-4 h-4" />
                <span>{artisan.distance_km} km</span>
            </div>
        </div>

        <p className="text-sm text-stone-600 line-clamp-2 mb-4 italic">"{artisan.bio || 'Professional artisan ready to help with your needs.'}"</p>

        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", artisan.is_online ? "bg-emerald-500 animate-pulse" : "bg-stone-300")} />
                <span className="text-xs font-medium text-stone-500">{artisan.is_online ? 'Online' : 'Offline'}</span>
            </div>
            <button className="text-xs font-bold text-emerald-600 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                View Profile →
            </button>
        </div>
    </motion.div>
);
