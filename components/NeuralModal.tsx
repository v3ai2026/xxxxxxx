
import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

/** 
 * NeuralModal Transition Protocols 
 * fade: Standard opacity shift
 * slide: Enterprise-grade vertical entrance
 * zoom: Dynamic scaling effect
 * fadeSlideIn: High-fidelity cinematic motion with blur
 */
export type ModalTransition = 'slide' | 'fade' | 'zoom' | 'fadeSlideIn';

/** 
 * NeuralModal Sizing Protocols 
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface NeuralModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  transition?: ModalTransition;
  size?: ModalSize;
}

const SIZE_MAP: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[95vw] h-[92vh]',
};

/** 
 * Protocol Transition Map
 * Consolidates all Tailwind CSS animation bindings defined in index.html
 */
const TRANSITION_MAP: Record<ModalTransition, string> = {
  slide: 'animate-modal-slide',
  fade: 'animate-modal-fade',
  zoom: 'animate-modal-zoom',
  fadeSlideIn: 'animate-modal-fade-slide-in',
};

/**
 * NeuralModal: The primary dialogue orchestration shard for IntelliBuild Studio.
 * Optimized for high-performance AI agent interactions.
 */
export const NeuralModal: React.FC<NeuralModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  transition = 'fade',
  size = 'md',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const portalRoot = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalRoot.current = document.getElementById('modal-root');
  }, []);

  /** 
   * Strict Keyboard Isolation Protocol
   * Ensures focus remains trapped within the modal context during active sessions.
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key === 'Tab' && modalRef.current) {
      const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const elements = Array.from(modalRef.current.querySelectorAll(focusableSelectors)) as HTMLElement[];
      const focusables = elements.filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
      
      if (focusables.length === 0) return;
      
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      // Automated Focus Targeting
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const firstFocusable = modalRef.current.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          (firstFocusable || modalRef.current).focus();
        }
      }, 150);

      return () => {
        document.body.style.overflow = originalStyle;
        window.removeEventListener('keydown', handleKeyDown);
        clearTimeout(timer);
      };
    }
  }, [isOpen, handleKeyDown]);

  const transitionClass = useMemo(() => TRANSITION_MAP[transition], [transition]);
  const sizeClass = useMemo(() => SIZE_MAP[size], [size]);

  if (!isOpen || !portalRoot.current) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[5000] flex items-center justify-center p-6 md:p-12 pointer-events-none"
      role="presentation"
    >
      {/* Cinematic Backdrop Shard */}
      <div 
        className="fixed inset-0 animate-backdrop backdrop-blur-3xl cursor-pointer pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Primary Dialogue Surface Shard */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="neural-modal-title"
        tabIndex={-1}
        className={`relative w-full ${sizeClass} bg-[#020420] border border-[#1a1e43] rounded-[3rem] shadow-[0_0_120px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden outline-none pointer-events-auto transition-transform duration-500 ease-out ${transitionClass}`}
      >
        {/* Shard Navigation Protocol */}
        <header className="flex items-center justify-between px-10 py-8 border-b border-[#1a1e43] bg-black/50 z-20">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-[#00DC82] shadow-[0_0_12px_#00DC82] animate-pulse" />
            <h2 id="neural-modal-title" className="text-[12px] font-black text-[#00DC82] uppercase tracking-[0.6em] leading-none">
              {title}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-white/20 hover:text-[#00DC82] transition-all p-3 rounded-2xl hover:bg-white/5 active:scale-90"
            aria-label="Terminate dialogue shard"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Shard Intellectual Core */}
        <div className="flex-1 p-12 text-[15px] font-medium text-slate-400 leading-[1.8] overflow-y-auto custom-scrollbar bg-[#020420]/80">
          {children}
        </div>

        {/* Shard Command Console */}
        <footer className="px-10 py-8 border-t border-[#1a1e43] bg-black/50 flex justify-end items-center gap-6 z-20">
          {footer ? footer : (
            <>
              <button 
                onClick={onClose}
                className="px-8 py-4 bg-white/5 border border-white/10 text-white/40 text-[11px] font-black uppercase tracking-[0.3em] rounded-xl hover:bg-white/10 transition-all"
              >
                Abort
              </button>
              <button 
                onClick={onClose}
                className="px-10 py-4 bg-nuxt-gradient text-black text-[11px] font-black uppercase tracking-[0.4em] rounded-xl shadow-[0_0_30px_rgba(0,220,130,0.3)] hover:brightness-110 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-[#00DC82]/50"
              >
                Commit Shard
              </button>
            </>
          )}
        </footer>
      </div>
    </div>,
    portalRoot.current
  );
};
