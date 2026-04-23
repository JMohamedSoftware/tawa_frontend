import { motion } from 'motion/react';

interface Photo {
    id: number;
    file_path: string;
    description: string;
}

export const PhotoGallery = ({ photos }: { photos: Photo[] }) => {
    if (photos.length === 0) return (
        <div className="text-center py-12 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
            <p className="text-stone-400 text-sm italic">No workspace photos shared yet.</p>
        </div>
    );

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((photo) => (
                <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative aspect-square bg-stone-100 rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                >
                    <img
                        src={photo.file_path}
                        alt={photo.description}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {photo.description && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <p className="text-white text-[10px] line-clamp-2">{photo.description}</p>
                        </div>
                    )}
                </motion.div>
            ))}
        </div>
    );
};
