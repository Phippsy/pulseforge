import { useCallback } from 'react';
import { useStore } from '../store';

export function ImageLoader() {
  const { userImages, activeImageIndex, addImage, removeImage, setActiveImage } = useStore();

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) addImage(e.target.result as string);
      };
      reader.readAsDataURL(file);
    });
  }, [addImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div
      className="flex flex-col gap-2"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <label className="text-xs text-white/60 uppercase tracking-wider">Images</label>
      <label className="flex items-center justify-center h-10 border border-dashed border-white/30 rounded cursor-pointer hover:border-white/60 transition-colors">
        <span className="text-xs text-white/50">Drop or click to load</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {userImages.length > 0 && (
        <div className="flex gap-1 flex-wrap max-h-20 overflow-y-auto">
          {userImages.map((img, i) => (
            <div
              key={i}
              className={`relative w-10 h-10 rounded overflow-hidden cursor-pointer border-2 ${i === activeImageIndex ? 'border-cyan-400' : 'border-transparent'}`}
              onClick={() => setActiveImage(i)}
            >
              <img src={img} className="w-full h-full object-cover" alt="" />
              <button
                className="absolute top-0 right-0 w-3 h-3 bg-red-500/80 text-white text-[8px] leading-none flex items-center justify-center rounded-bl"
                onClick={(e) => { e.stopPropagation(); removeImage(i); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
