import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect, useState } from "react";
import { RouteLoadingFallback } from "./components/common/RouteLoadingFallback";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Support = lazy(() => import("./pages/Support"));
const PersonaSelection = lazy(() => import("./pages/PersonaSelection"));
const BuildingWealthContext = lazy(() => import("./pages/BuildingWealthContext"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SpendingInsights = lazy(() => import("./pages/SpendingInsights"));
const GoalPlanner = lazy(() => import("./pages/GoalPlanner"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const AvatarAdvisor = lazy(() => import("./pages/AvatarAdvisor"));
const InariStudio = lazy(() => import("./pages/InariStudio"));
const NotFound = lazy(() => import("./pages/NotFound"));

let historyEventsPatched = false;

function useCurrentPath() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);

    if (!historyEventsPatched) {
      historyEventsPatched = true;
      const pushState = window.history.pushState;
      const replaceState = window.history.replaceState;

      window.history.pushState = function (...args) {
        const result = pushState.apply(this, args);
        window.dispatchEvent(new Event("wealthverse:navigation"));
        return result;
      };

      window.history.replaceState = function (...args) {
        const result = replaceState.apply(this, args);
        window.dispatchEvent(new Event("wealthverse:navigation"));
        return result;
      };
    }

    window.addEventListener("popstate", updatePath);
    window.addEventListener("wealthverse:navigation", updatePath);

    return () => {
      window.removeEventListener("popstate", updatePath);
      window.removeEventListener("wealthverse:navigation", updatePath);
    };
  }, []);

  return path;
}

function Router() {
  const location = useCurrentPath();

  if (location === "/") return <Home />;
  if (location === "/login") return <Login />;
  if (location === "/signup") return <Signup />;
  if (location === "/support") return <Support />;
  if (location === "/choose-profile") return <PersonaSelection />;
  if (location === "/building-context") return <BuildingWealthContext />;
  if (location === "/dashboard") return <Dashboard />;
  if (location === "/spending") return <SpendingInsights />;
  if (location === "/goals") return <GoalPlanner />;
  if (location === "/recommendations") return <Recommendations />;
  if (location === "/avatar") return <AvatarAdvisor />;
  if (location === "/inari") return <InariStudio />;
  return <NotFound />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<RouteLoadingFallback />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
