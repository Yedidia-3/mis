import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";

export function NotFoundScreen() {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "var(--light-gray)" }}>
      <div className="text-center space-y-6 max-w-md px-6">
        <h1 className="text-8xl font-bold" style={{ color: "var(--maroon)" }}>404</h1>
        <h2 className="text-3xl font-semibold" style={{ color: "var(--dark-gray)" }}>Page not found</h2>
        <p className="text-lg" style={{ color: "var(--mid-gray)" }}>
          The page you are looking for doesn't exist.
        </p>
        <Button
          onClick={() => navigate(-1)}
          className="h-11 px-6"
          style={{ backgroundColor: "var(--navy-blue)", color: "#FFFFFF" }}
        >
          Go back to Dashboard
        </Button>
      </div>
    </div>
  );
}
