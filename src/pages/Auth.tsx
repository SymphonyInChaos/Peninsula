// Updated Auth component with no shadows, larger inputs, cleaner layout, polished production look
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Boxes, Eye, EyeOff, Icon, Loader, Package } from 'lucide-react';
import { GridPattern } from '@/components/ui/GridBg';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login, register } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const navigate =  useNavigate();
  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate async operation
    setTimeout(() => {
      setIsLoading(false);
       if (isLogin) {
         login(email, password);
         navigate('/');
       } else {
         register(email, password, name);
         navigate('/');
       }
    }, 1000);
   
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Left brand side */}
      
      <div className="hidden md:flex w-1/2 bg-black text-white items-center justify-center p-10 flex-col space-y-6 relative overflow-hidden">

  {/* Background Grid Animation */}
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{
      duration: 1.2,
      ease: "easeOut"
    }}
  >
    <GridPattern
      width={80}
      height={80}
      x={-1}
      y={-1}
      strokeDasharray="3 3"
      className={cn('[mask-image:radial-gradient(450px_circle_at_center,green,transparent)] stroke-gray-500')}
    />
  </motion.div>

  {/* Text Animation */}
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      duration: 1,
      ease: "easeOut",
      delay: 0.2
    }}
    className="text-center"
  >
    <h2 className="text-7xl font-light tracking-wide leading-tight">
      Everything <span className="font-mono italic font-semibold text-orange-500">at;</span><br />One Command
    </h2>

    <p className="text-muted-foreground text-md max-w-md mx-auto mt-4">
      The smartest way to manage customers and products in natural language.
    </p>
  </motion.div>

</div>


      {/* Form area */}
      <div className="w-full md:w-1/2  flex items-center justify-center p-2 min-h-screen overflow-hidden relative">
      <GridPattern
      width={80}
      height={80}
      x={-1}
      y={-1}
      strokeDasharray="3 3"
      className={cn('[mask-image:radial-gradient(450px_circle_at_center,green,transparent)] stroke-blue-500 md:hidden ')}
    />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg z-10 bg-white"
        >
          <div className="rounded-none p-8 space-y-6 border-gray-400 border-2 border-dashed">
            {/* Mobile logo */}
           <div className="flex justify-between items-center gap-2 sm:gap-3">
      <div className='flex gap-2'>
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary  flex items-center justify-center">
              <Boxes className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
          </div>
            <h1 className="text-lg sm:text-xl font-light italic tracking-tight">
              Peninsula

            </h1>
          </div>
            <p className="text-muted-foreground text-sm font-mono">
              Auth 
            </p>
        </div>
         <Separator className="my-2 bg-black/30" />


            

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-1">
                  <Label htmlFor="name" className="font-serif">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="rounded-none h-14 text-base"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="email" className="font-sans font-thin italic">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-none  h-14 border border-gray-400 font-serif"
                />
              </div>

             <div className="space-y-1">
  <Label htmlFor="password" className="font-sans italic font-thin">Password</Label>

  <div className="relative">
    <Input
      id="password"
      type={showPassword ? "text" : "password"}
      placeholder="••••••••"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      required
      className="rounded-none h-14 text-base border border-gray-400 pr-12 font-mono"
    />

    <Button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm bg-transparent text-blue-600 hover:bg-transparent hover:underline focus:ring-0 focus:ring-offset-0"
    >
      {showPassword ? <EyeOff/> : <Eye/>}
    </Button>
  </div>
</div>


              <Button
  type="submit"
  className="
    w-full rounded-none h-14 text-base font-medium text-white font-serif
    bg-gradient-to-r from-blue-600 via-black to-blue-600
    transition-all duration-300 ease-in-out
    hover:from-blue-800 hover:via-black hover:to-blue-800 
    hover:shadow-xl hover:scale-[0.985]
  "
>
  {isLoading ? <Loader className='animate-spin text-blue-200 ' size={30}/> : "Authenticate"}
</Button>

            </form>

            <div className="text-center text-sm">
              {/* <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isLogin ? (
                  <>Don't have an account? <span className="text-primary font-medium">Sign up</span></>
                ) : (
                  <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
                )}
              </button> */}
              <span className='text-xs opacity-40 font-mono'> V 0.0.1</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
