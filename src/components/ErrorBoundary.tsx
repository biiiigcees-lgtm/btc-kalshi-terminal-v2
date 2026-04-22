'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#050a0e] text-[#e0f0f8] font-mono flex items-center justify-center p-4">
          <div className="border border-[#ff4466] rounded-lg p-6 bg-[#0c141a] max-w-md">
            <div className="text-[#ff4466] text-sm mb-2">ERROR</div>
            <div className="text-lg mb-4">Something went wrong</div>
            <div className="text-[#4a7a96] text-xs mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#00ffe7] text-[#050a0e] rounded font-mono text-sm hover:bg-[#00ffe7]/80 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
