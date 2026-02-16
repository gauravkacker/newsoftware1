// ============================================
// Module 2: Login Page
// Supports 3 login modes (Module 2.4)
// ============================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import type { LoginMode } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginMode: currentLoginMode } = useAuth();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(identifier, password);
      
      if (success) {
        router.push('/');
      } else {
        setError('Invalid credentials');
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show login form only if login mode is not 'none'
  if (currentLoginMode === 'none') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Login Mode: None</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              This clinic is running in &quot;No Login&quot; mode.
              All users have full access to the system.
            </p>
            <Button onClick={() => router.push('/')} className="w-full">
              Enter System
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <p className="text-sm text-gray-500">
            {currentLoginMode === 'basic' ? 'Basic Login' : 'Role-Based Login'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username / Email / Phone
              </label>
              <Input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter your username, email, or phone"
                required
                className="w-full"
              />
            </div>

            {currentLoginMode === 'basic' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full"
                />
              </div>
            )}

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              Demo accounts: doctor, frontdesk, pharmacy, assistant
              <br />
              Password for all: [username]123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
