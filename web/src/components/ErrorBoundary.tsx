import React, { Component, type ErrorInfo, type ReactNode } from "react"
import { postError } from "../api/client"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    
    const project = localStorage.getItem("opencode-q-last-project") || ""
    postError({
      message: error.message || String(error),
      stack: error.stack || errorInfo.componentStack || "",
      url: window.location.href,
      project,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    }).catch(() => {})
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <span className="text-3xl">⚠️</span>
              <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
            </div>
            
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              An unexpected error occurred in the application. The crash details have been captured and logged to help resolve the issue.
            </p>
            
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Error Details</div>
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 overflow-auto max-h-60 text-xs font-mono text-red-700 whitespace-pre-wrap">
                {this.state.error?.toString()}
                {this.state.error?.stack && (
                  <div className="mt-2 pt-2 border-t border-red-100/50">
                    {this.state.error.stack}
                  </div>
                )}
                {this.state.errorInfo?.componentStack && (
                  <div className="mt-2 pt-2 border-t border-red-100/50 text-gray-500">
                    Component Stack:
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors rounded-xl shadow-sm cursor-pointer"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
