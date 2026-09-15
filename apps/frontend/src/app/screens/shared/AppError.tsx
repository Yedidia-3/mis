import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button";

export function AppError() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = "Something went wrong";
  let message = "An unexpected error occurred. Please try again.";
  let detail: string | null = null;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Page not found";
      message = "The page you're looking for doesn't exist.";
    } else if (error.status === 403) {
      title = "Access denied";
      message = "You don't have permission to view this page.";
    } else {
      title = `Error ${error.status}`;
      message = error.statusText || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
    detail = error.stack?.split('\n').slice(0, 3).join('\n') ?? null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: "var(--light-gray)" }}>
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 8%, transparent)" }}>
          <AlertTriangle size={40} style={{ color: "var(--maroon)" }} />
        </div>

        {/* Message */}
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--dark-gray)" }}>{title}</h1>
          <p style={{ color: "var(--mid-gray)" }}>{message}</p>
        </div>

        {/* Technical detail (dev-only style) */}
        {detail && (
          <pre className="text-left text-xs p-4 rounded-lg overflow-x-auto"
            style={{ backgroundColor: "var(--dark-gray)", color: "var(--light-gray)", fontFamily: "monospace" }}>
            {detail}
          </pre>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}
            style={{ borderColor: "var(--border)", color: "var(--dark-gray)" }}>
            <RefreshCw size={16} className="mr-2" /> Try Again
          </Button>
          <Button onClick={() => navigate('/')}
            style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
            <Home size={16} className="mr-2" /> Go Home
          </Button>
        </div>

        <p className="text-xs" style={{ color: "#C0C0C0" }}>
          Jericho School Management System
        </p>
      </div>
    </div>
  );
}
