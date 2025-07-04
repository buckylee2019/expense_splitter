import { useEffect } from 'react';

const useMobileDetection = () => {
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 767;
      
      if (isMobile) {
        document.body.classList.add('mobile-tabs-visible');
      } else {
        document.body.classList.remove('mobile-tabs-visible');
      }
    };

    // Check on mount
    checkMobile();

    // Check on resize
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile);
      document.body.classList.remove('mobile-tabs-visible');
    };
  }, []);
};

export default useMobileDetection;
