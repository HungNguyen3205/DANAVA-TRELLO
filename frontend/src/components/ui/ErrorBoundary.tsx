import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
    if (error.message?.includes('dynamically imported module') || error.message?.includes('Importing a module script failed')) {
      window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md w-full bg-card p-8 rounded-2xl border border-border shadow-xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-2xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold">Hệ thống vừa cập nhật phiên bản mới</h2>
            <p className="text-sm text-muted-foreground">
              Vui lòng tải lại trang để nạp mã nguồn và dữ liệu mới nhất.
            </p>
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-all shadow-md"
            >
              Tải lại trang ngay
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
