import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Landing from "./pages/Landing";
import Client from "./pages/Client";
import Professional from "./pages/Professional";
import Admin from "./pages/Admin";
import ConfirmEmail from "./pages/ConfirmEmail";
import ResetPassword from "./pages/ResetPassword";
import CompleteClientProfile from "./pages/CompleteClientProfile";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            {/* Email confirmation route */}
            <Route path="/confirm-email" element={<ConfirmEmail />} />
            {/* Password reset route */}
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Complete client profile route for invited users */}
            <Route path="/complete-client-profile" element={<CompleteClientProfile />} />
            {/* Admin route */}
            <Route path="/admin" element={<Admin />} />
            {/* Client routes */}
            <Route path="/client" element={<Navigate to="/client/dashboard" replace />} />
            <Route path="/client/:section" element={<Client />} />
            {/* Professional routes */}
            <Route path="/professional" element={<Navigate to="/professional/dashboard" replace />} />
            <Route path="/professional/:section" element={<Professional />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
