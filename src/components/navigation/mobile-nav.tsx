'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, CalendarDays, MoreHorizontal } from 'lucide-react';
import { useUser } from '@/components/providers/user-provider';

export function MobileNav() {
  const pathname = usePathname();
  const { member } = useUser();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Timesheet', href: '/timesheet', icon: Clock },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: member.role === 'admin' || member.role === 'manager' ? 'Team' : 'Reports', href: member.role === 'admin' || member.role === 'manager' ? '/admin/team' : '/reports', icon: MoreHorizontal },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border h-16 z-50">
      <nav className="flex h-full max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col flex-1 items-center justify-center gap-1 text-xs font-medium ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
