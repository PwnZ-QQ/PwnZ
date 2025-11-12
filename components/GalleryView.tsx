import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { CloseIcon, TrashIcon, PlayIcon } from './Icons';

const GalleryView: React.FC = () => {
    const { gallery, removeFromGallery } = useAppStore();
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

    const handleItemClick = (index: number) => {
        setSelectedItemIndex(index);
    };

    const handleCloseViewer = () => {
        setSelectedItemIndex(null);
    };

    const handleDelete = () => {
        if (selectedItemIndex !== null) {
            if (window.confirm("Are you sure you want to delete this item?")) {
                removeFromGallery(selectedItemIndex);
                setSelectedItemIndex(null);
            }
        }
    };

    const selectedItem = selectedItemIndex !== null ? gallery[selectedItemIndex] : null;

    return (
        <div className="h-full w-full bg-black flex flex-col pt-10 pb-24">
            <h1 className="text-xl font-bold text-center text-white fixed top-0 left-0 right-0 py-4 bg-black/80 backdrop-blur-md z-10">Gallery</h1>

            <div className="flex-1 p-2 overflow-y-auto">
                {gallery.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-center text-gray-400">
                        <p className="text-lg">Your gallery is empty</p>
                        <p className="text-sm">Go to the Camera tab and take some photos or videos.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-1">
                        {gallery.map((item, index) => (
                            <motion.div
                                key={index}
                                className="aspect-square bg-gray-800 relative"
                                onClick={() => handleItemClick(index)}
                                layoutId={`gallery-item-${index}`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {item.type === 'photo' ? (
                                    <img src={item.src} alt={`Gallery item ${index}`} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                    <>
                                        <video src={item.src} className="w-full h-full object-cover" preload="metadata" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            <PlayIcon />
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCloseViewer}
                    >
                        <motion.div
                            className="w-full h-full flex items-center justify-center"
                            layoutId={`gallery-item-${selectedItemIndex}`}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {selectedItem.type === 'photo' ? (
                                <img
                                    src={selectedItem.src}
                                    alt={`Full view gallery item ${selectedItemIndex}`}
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                <video
                                    src={selectedItem.src}
                                    className="max-w-full max-h-full"
                                    controls
                                    autoPlay
                                />
                            )}
                        </motion.div>
                        
                        <button onClick={handleCloseViewer} className="absolute top-4 right-4 p-2 bg-gray-700/50 rounded-full text-white">
                            <CloseIcon />
                        </button>
                        <button onClick={handleDelete} className="absolute bottom-28 p-3 bg-red-600/70 rounded-full text-white">
                            <TrashIcon />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GalleryView;