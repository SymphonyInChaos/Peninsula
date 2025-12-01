import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("STAFF");
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);

  const {
    login,
    register,
    setup,
    checkSystemSetup,
    system,
    isLoading,
    error,
    clearError,
  } = useAuth();

  // Check system setup status on component mount
  useEffect(() => {
    checkSystemSetup();
  }, []);

  // Update first-time setup state when system status changes
  useEffect(() => {
    if (!system.isLoading && !system.isSetup) {
      setIsFirstTimeSetup(true);
      setIsLogin(false); // Force registration mode for first user
    }
  }, [system.isSetup, system.isLoading]);

  // Clear error when form changes
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [email, password, name, role, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isFirstTimeSetup) {
      // Use setup for first user (no authentication required)
      await setup(email, password, name);
    } else if (isLogin) {
      await login(email, password);
    } else {
      await register(email, password, name, role);
    }
  };

  // Show loading while checking system status
  if (system.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl"
          >
            <Package className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <p className="text-muted-foreground">Checking system...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-card shadow-medium rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Logo and Title */}
          <div className="text-center space-y-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-primary rounded-2xl mb-3 sm:mb-4"
            >
              <Package className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-light font-sans tracking-tight">
              Peninsula
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {isFirstTimeSetup
                ? "Setup your admin account"
                : isLogin
                ? "Welcome back"
                : "Create your account"}
            </p>
            {isFirstTimeSetup && (
              <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                First-time setup: Creating initial admin account
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-lg"
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name{" "}
                    {isFirstTimeSetup && (
                      <span className="text-destructive">*</span>
                    )}
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="rounded-xl"
                    disabled={isLoading}
                  />
                </div>

                {!isFirstTimeSetup && (
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={role}
                      onValueChange={setRole}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STAFF">Staff</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">
                Email{" "}
                {isFirstTimeSetup && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password{" "}
                {isFirstTimeSetup && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl"
                disabled={isLoading}
                minLength={6}
              />
            </div>

            {isFirstTimeSetup && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Password must be at least 6 characters long</p>
                <p>• This will create your first admin account</p>
                <p>• You can create additional users after setup</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full rounded-2xl h-12"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isFirstTimeSetup
                    ? "Setting up..."
                    : isLogin
                    ? "Signing in..."
                    : "Creating account..."}
                </>
              ) : isFirstTimeSetup ? (
                "Setup Peninsula"
              ) : isLogin ? (
                "Continue"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* Toggle - Only show if system is already setup */}
          {system.isSetup && (
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setIsLogin(!isLogin);
                }}
                disabled={isLoading}
                className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {isLogin
                  ? "Don't have an account? "
                  : "Already have an account? "}
                <span className="text-primary font-medium">
                  {isLogin ? "Sign up" : "Sign in"}
                </span>
              </button>
            </div>
          )}

          {/* First-time setup info */}
          {isFirstTimeSetup && (
            <div className="text-center text-xs text-muted-foreground">
              <p>
                Welcome to Peninsula! Let's get started by creating your admin
                account.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
