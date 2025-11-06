/**
 * @file Login page for ChainEquity frontend
 * @notice Demo mode: Simulated authentication with any valid credentials
 *
 * @note Post-Demo: This will be replaced with Firebase Auth integration
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DEMO_USERS } from '@/types/auth';

/**
 * Login form schema validation
 */
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Login page component
 */
export function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      // Use email field to determine which user to log in as
      // Accepts: email addresses or usernames (admin, alice, bob, charlie)
      await login(data.email);
      // Redirect to home after successful login
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
      // Error is handled by form state, but we can set a form-level error if needed
      form.setError('root', {
        message: error instanceof Error ? error.message : 'Login failed',
      });
    }
  };

  const handleQuickLogin = async (username: string) => {
    try {
      await login(username);
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
      form.setError('root', {
        message: error instanceof Error ? error.message : 'Login failed',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access ChainEquity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary hover:underline">
                  Register
                </Link>
              </div>
            </form>
          </Form>
          <div className="mt-4 p-3 bg-muted/50 border border-border rounded-md">
            <p className="text-xs text-muted-foreground text-center mb-3">
              <strong>Demo Mode:</strong> Enter an email or username to log in as a demo user.
              Use quick login buttons below for easy access.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(DEMO_USERS).map(([username]) => (
                <Button
                  key={username}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickLogin(username)}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {username === 'admin' ? '👑 Admin' : `👤 ${username}`}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Or enter email/username in the form above:{' '}
              {Object.values(DEMO_USERS)
                .map(u => u.email)
                .join(', ')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

