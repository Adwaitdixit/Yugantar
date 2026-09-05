import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../contexts/I18nContext';
import './styles/AboutUs.css';

const TOTAL_FRAMES = 300;

export default function AboutUs() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const preloadImages = async () => {
      const loadedImages: HTMLImageElement[] = [];
      let loadedCount = 0;

      for (let i = 1; i <= TOTAL_FRAMES; i++) {
        const img = new Image();
        // format: frame_000001.jpg
        const frameNumber = i.toString().padStart(6, '0');
        img.src = `/heritage_frames/frame_${frameNumber}.jpg`;
        
        await new Promise((resolve) => {
          img.onload = () => {
            loadedCount++;
            loadedImages.push(img);
            resolve(null);
          };
          img.onerror = () => {
            loadedCount++;
            loadedImages.push(img); // push broken img to maintain index
            resolve(null);
          }
        });
      }
      setImages(loadedImages);
      setLoaded(true);
    };

    preloadImages();
  }, []);

  useEffect(() => {
    if (!loaded || images.length === 0 || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set initial frame
    renderFrame(0);

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const containerTop = rect.top;
      const containerHeight = rect.height;
      const windowHeight = window.innerHeight;

      // Calculate scroll progress (0 to 1)
      const scrollableDistance = containerHeight - windowHeight;
      // When top is at 0, progress is 0. When top is -scrollableDistance, progress is 1.
      let progress = -containerTop / scrollableDistance;
      
      progress = Math.max(0, Math.min(1, progress));

      const frameIndex = Math.floor(progress * (TOTAL_FRAMES - 1));
      renderFrame(frameIndex);
    };

    function renderFrame(index: number) {
      if (images[index] && images[index].complete && images[index].naturalHeight !== 0) {
        // Draw image to fill canvas, maintaining aspect ratio like object-fit: cover
        const img = images[index];
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (canvasRatio > imgRatio) {
          // Canvas is wider than image
          drawHeight = canvas.width / imgRatio;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          // Image is wider than canvas
          drawWidth = canvas.height * imgRatio;
          offsetX = (canvas.width - drawWidth) / 2;
        }

        ctx!.clearRect(0, 0, canvas.width, canvas.height);
        ctx!.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      }
    }

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      handleScroll(); // re-render current frame
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial size
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [loaded, images]);

  return (
    <section className="about-us-section" ref={containerRef}>
      <div className="about-us-sticky-bg">
        <canvas ref={canvasRef} className="about-us-canvas" />
        <div className="about-us-overlay" />
      </div>

      <div className="about-us-content">
        <div className="about-us-header-block">
          <h2>{t('about.aboutDharoharSetu')}</h2>
          <p className="core-idea">
            {t('about.missionStatement')}
          </p>
        </div>

        <div className="about-us-steps">
          <div className="about-step">
            <div className="step-icon">🇮🇳</div>
            <h3>{t('about.preserve')}</h3>
            <p>{t('about.preserveDesc')}</p>
          </div>

          <div className="about-step">
            <div className="step-icon">🗺️</div>
            <h3>{t('about.discover')}</h3>
            <p>{t('about.discoverDesc')}</p>
          </div>

          <div className="about-step">
            <div className="step-icon">🎙️</div>
            <h3>{t('about.listen')}</h3>
            <p>{t('about.listenDesc')}</p>
          </div>

          <div className="about-step">
            <div className="step-icon">📚</div>
            <h3>{t('about.learn')}</h3>
            <p>{t('about.learnDesc')}</p>
          </div>

          <div className="about-step">
            <div className="step-icon">🤝</div>
            <h3>{t('about.connectGenerations')}</h3>
            <p>{t('about.connectDesc')}</p>
          </div>
        </div>

        <div className="about-us-conclusion">
          <p>“{t('about.finalStatement')}”</p>
        </div>
      </div>
    </section>
  );
}
