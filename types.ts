
export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerationResult {
  componentName: string;
  files: GeneratedFile[];
  metadata?: {
    complexity: 'Low' | 'Medium' | 'High';
    techStack: string[];
    architecturePattern: string;
  };
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  config?: any;
}

export interface DeploymentStatus {
  id: string;
  url: string;
  state: 'INITIALIZING' | 'ANALYZING' | 'BUILDING' | 'DEPLOYING' | 'READY' | 'ERROR';
  createdAt: number;
}

export interface LibraryItem {
  id: string;
  name: string;
  description: string;
  type: 'template' | 'component';
  previewColor: string;
  codeSnippet?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  files?: GeneratedFile[];
  media?: MediaItem;
  groundingLinks?: { uri: string; title: string }[];
  isThinking?: boolean;
}

export enum TabType {
  EDITOR = 'EDITOR',
  PREVIEW = 'PREVIEW',
  MEDIA = 'MEDIA',
  AGENT = 'AGENT',
  DEPLOY = 'DEPLOY'
}
