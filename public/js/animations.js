/**
 * animations.js — Micro-animations & visual effects
 */

const Animations = {
  /**
   * Smooth scroll to element
   */
  scrollTo(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  /**
   * Typewriter effect — streams text character by character
   */
  typewriter(element, text, speed = 15) {
    return new Promise(resolve => {
      let i = 0;
      const interval = setInterval(() => {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
        } else {
          clearInterval(interval);
          resolve();
        }
      }, speed);
    });
  },

  /**
   * Fade in an element
   */
  fadeIn(element, duration = 400) {
    element.style.opacity = '0';
    element.style.display = '';
    element.style.transition = `opacity ${duration}ms ease`;

    requestAnimationFrame(() => {
      element.style.opacity = '1';
    });
  },

  /**
   * Show element with slide-down animation
   */
  slideDown(element) {
    element.style.display = '';
    element.style.opacity = '0';
    element.style.transform = 'translateY(-10px)';
    element.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

    requestAnimationFrame(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    });
  },

  /**
   * Create a pulsing glow effect on an element
   */
  pulseGlow(element, color = 'rgba(0, 212, 255, 0.3)') {
    element.style.boxShadow = `0 0 0 0 ${color}`;
    element.style.transition = 'box-shadow 0.4s ease';

    requestAnimationFrame(() => {
      element.style.boxShadow = `0 0 20px 5px ${color}`;

      setTimeout(() => {
        element.style.boxShadow = `0 0 0 0 ${color}`;
      }, 400);
    });
  },

  /**
   * Animate a counter from 0 to target value
   */
  countUp(element, target, duration = 1000) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);

      element.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  },

  /**
   * Show a toast notification
   */
  showToast(message, duration = 4000) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');

    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.style.display = '';

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  }
};

window.Animations = Animations;
