import { Zap, Droplets, Hammer, Wind, Paintbrush, Leaf } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Category {
    id: string;
    name: string;
    slug: string;
    icon: string;
}

export const CategoryCard = ({ category, active, onClick }: { category: Category, active: boolean, onClick: () => void }) => {
    const Icon = ({ Zap, Droplets, Hammer, Wind, Paintbrush, Leaf } as any)[category.icon] || Hammer;
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 min-w-[100px]",
                active
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-md scale-105"
                    : "border-stone-100 bg-white text-stone-500 hover:border-emerald-200 hover:bg-stone-50"
            )}
        >
            <Icon className="w-6 h-6 mb-2" />
            <span className="text-xs font-semibold uppercase tracking-wider">{category.name}</span>
        </button>
    );
};
