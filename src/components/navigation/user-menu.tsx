'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/components/providers/user-provider';
import { LogOut, Settings, User } from 'lucide-react';

export function UserMenu() {
  const { user, member } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const isAdmin = member.role === 'admin';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-muted transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold overflow-hidden shrink-0">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
          ) : (
            getInitials(user.fullName)
          )}
        </div>
        <div className="flex flex-col text-left overflow-hidden">
          <span className="text-sm font-medium truncate">{user.fullName || user.email}</span>
          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
        </div>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 w-full bg-white border border-border rounded-md shadow-lg py-1 z-50">
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
            >
              <User className="w-4 h-4 text-muted-foreground" />
              Profile
            </Link>
            
            {isAdmin && (
              <Link
                href="/admin/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
                Settings
              </Link>
            )}
            
            <div className="h-px bg-border my-1" />
            
            <button
              onClick={() => {
                setIsOpen(false);
                handleSignOut();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
