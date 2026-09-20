'use client';

interface Props {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
  };
  member: {
    id: string;
    organizationId: string;
    role: string;
    status: string;
    weeklyTargetHours: string | null;
    department: string | null;
    startDate: string | null;
  };
  organization: {
    id: string;
    name: string;
    defaultTimezone: string;
  };
}

export function ProfileContent({ user, member, organization }: Props) {
  const fields = [
    { label: 'Full Name', value: user.fullName },
    { label: 'Email', value: user.email },
    { label: 'Role', value: member.role.charAt(0).toUpperCase() + member.role.slice(1) },
    { label: 'Department', value: member.department || 'Not set' },
    { label: 'Status', value: member.status.charAt(0).toUpperCase() + member.status.slice(1) },
    { label: 'Weekly Target', value: member.weeklyTargetHours ? `${member.weeklyTargetHours}h` : '40h' },
    { label: 'Start Date', value: member.startDate || 'Not set' },
    { label: 'Organization', value: organization.name },
    { label: 'Timezone', value: organization.defaultTimezone },
  ];

  return (
    <div className="border rounded-lg bg-card divide-y">
      {fields.map((field) => (
        <div key={field.label} className="flex items-center justify-between px-6 py-4">
          <span className="text-sm font-medium text-muted-foreground">{field.label}</span>
          <span className="text-sm">{field.value}</span>
        </div>
      ))}
    </div>
  );
}
