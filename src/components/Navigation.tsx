import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { Leaf, LayoutDashboard, Calculator, BarChart3, BookOpen, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export default function Navigation() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <nav className="glass-card sticky top-0 z-50 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Climaiview
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink
              to="/dashboard"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-accent/50 transition-colors"
              activeClassName="text-primary bg-accent font-medium"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink
              to="/carbon-tracker"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-accent/50 transition-colors"
              activeClassName="text-primary bg-accent font-medium"
            >
              <Calculator className="h-4 w-4" />
              Carbon Tracker
            </NavLink>
            <NavLink
              to="/visualization"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-accent/50 transition-colors"
              activeClassName="text-primary bg-accent font-medium"
            >
              <BarChart3 className="h-4 w-4" />
              Visualization
            </NavLink>
            <NavLink
              to="/education"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-accent/50 transition-colors"
              activeClassName="text-primary bg-accent font-medium"
            >
              <BookOpen className="h-4 w-4" />
              Education
            </NavLink>
          </div>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
