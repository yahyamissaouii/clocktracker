'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Clock, 
  CalendarDays, 
  BarChart3, 
  Users, 
  UserCog, 
  CheckSquare, 
  Settings, 
  Shield 
} from 'lucide-react';
import { useUser } from '@/components/providers/user-provider';
import { UserMenu } from '@/components/navigation/user-menu';

export function Sidebar() {
  const pathname = usePathname();
  const { member, organization } = useUser();
  const isAdminOrManager = member.role === 'admin' || member.role === 'manager';
  const isAdmin = member.role === 'admin';

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Timesheet', href: '/timesheet', icon: Clock },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
  ];

  const adminItems = [
    { name: 'Team', href: '/admin/team', icon: Users, show: isAdminOrManager },
    { name: 'Employees', href: '/admin/employees', icon: UserCog, show: isAdminOrManager },
    { name: 'Team Reports', href: '/admin/reports', icon: BarChart3, show: isAdminOrManager },
    { name: 'Approvals', href: '/admin/approvals', icon: CheckSquare, show: isAdmin },
    { name: 'Settings', href: '/admin/settings', icon: Settings, show: isAdmin },
    { name: 'Audit Log', href: '/admin/audit', icon: Shield, show: isAdmin },
  ].filter(item => item.show);

  return (
    <div className="hidden lg:flex flex-col w-[260px] bg-white border-r border-border h-full shrink-0">
      <div className="flex h-14 items-center px-6 border-b border-border shrink-0">
        {organization.logoUrl ? (
          <img src={organization.logoUrl} alt={organization.name} className="h-6 w-auto" />
        ) : (
          <div className="font-semibold text-lg truncate">{organization.name}</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {adminItems.length > 0 && (
          <div>
            <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Administration
            </div>
            <nav className="space-y-1">
              {adminItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border shrink-0">
        <UserMenu />
      </div>
    </div>
  );
}
