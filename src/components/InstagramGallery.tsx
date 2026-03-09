import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Loader2 } from "lucide-react";
import { subscribeToGalleryImages, GalleryImage } from "@/services/galleryService";

const InstagramGallery = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToGalleryImages((galleryImages) => {
      setImages(galleryImages);
      setLoading(false);
    }, true); // Only show active images

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <section className="pt-4 pb-8 bg-white">
        <div className="container-custom flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </section>
    );
  }

  if (images.length === 0) {
    return null; // Don't show the section if no images
  }

  return (
    <section className="pt-4 pb-8 bg-white">
      <div className="container-custom">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
            >
              <img
                src={image.imageUrl}
                alt={image.alt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InstagramGallery;
