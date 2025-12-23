
import { LibraryItem } from "../types";

export const TEMPLATE_LIBRARY: LibraryItem[] = [
  {
    id: 'tpl-vercel-dashboard',
    name: 'Vercel-Style Dashboard',
    description: 'A clean, high-performance admin interface inspired by the Vercel dashboard matrix.',
    type: 'template',
    previewColor: 'from-slate-900 to-black',
  },
  {
    id: 'tpl-bento',
    name: 'Bento Grid Showcase',
    description: 'A modern multi-column grid for featuring products or stats with glassmorphic cards.',
    type: 'template',
    previewColor: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'tpl-saas',
    name: 'SaaS Hero Module',
    description: 'High-conversion landing section with animated background and clean typography.',
    type: 'template',
    previewColor: 'from-purple-500 to-pink-600',
  }
];

export const COMPONENT_LIBRARY: LibraryItem[] = [
  {
    id: 'cmp-universal-modal',
    name: 'Universal Modal Dialog',
    description: 'A reusable React modal component with props for title, content, isOpen, and onClose. Fully accessible.',
    type: 'component',
    previewColor: 'from-zinc-700 to-zinc-900',
    codeSnippet: `// Props: title (string), content (ReactNode), isOpen (boolean), onClose (void function)`
  },
  {
    id: 'cmp-universal-btn',
    name: 'Universal Action Button',
    description: 'A robust React button accepting text, onClick, and variants (primary, secondary, danger).',
    type: 'component',
    previewColor: 'from-blue-400 to-indigo-500',
  },
  {
    id: 'cmp-glass-btn',
    name: 'Neural Glass Button',
    description: 'Translucent interactive button with backdrop-blur and hover glow.',
    type: 'component',
    previewColor: 'from-indigo-400 to-blue-400',
  }
];
