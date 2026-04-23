import { Star, ClipboardList, MapPin, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Artisan {
    id: string;
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
    profile_image?: string;
}

export const ArtisanCard = ({ artisan, onClick }: { artisan: Artisan, onClick: () => void }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-xl transition-all group cursor-pointer"
        onClick={onClick}
        dir="rtl"
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
            <div className="flex gap-2">
                {artisan.smart_score > 0.8 && (
                    <div className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" /> متميز
                    </div>
                )}
                {artisan.is_verified === 1 && (
                    <div className="bg-emerald-100 text-emerald-700 p-1 rounded-full" title="حرفي موثق">
                        <ShieldCheck className="w-4 h-4" />
                    </div>
                )}
            </div>
        </div>

        <div className="flex items-center gap-4 mb-4 text-sm text-right">
            <div className="flex items-center gap-1 text-amber-500 font-bold">
                <Star className="w-4 h-4 fill-current" />
                <span>{artisan.avg_rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1 text-stone-500">
                <ClipboardList className="w-4 h-4" />
                <span>{artisan.completed_jobs} عمل</span>
            </div>
            <div className="flex items-center gap-1 text-stone-500">
                <MapPin className="w-4 h-4" />
                <span>{artisan.distance_km} كم</span>
            </div>
        </div>

        <p className="text-sm text-stone-600 line-clamp-2 mb-4 italic">"{artisan.bio || 'حرفي محترف مستعد لتلبية احتياجاتكم.'}"</p>

        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", artisan.is_online ? "bg-emerald-500 animate-pulse" : "bg-stone-300")} />
                <span className="text-xs font-medium text-stone-500">{artisan.is_online ? 'متصل' : 'غير متصل'}</span>
            </div>
            <button className="text-xs font-bold text-emerald-600 uppercase tracking-widest group-hover:translate-x-[-4px] transition-transform">
                عرض الملف الشخصي ←
            </button>
        </div>
    </motion.div>
);
