// ============================================
// Module 2: User Management Page
// Doctor can manage users and roles (Module 2.3, 2.8)
// ============================================

'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { userDb, roleDb, permissionDb } from '@/lib/db/database';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { User, Role, Permission } from '@/types';

export default function UsersPage() {
  const { user, hasPermission, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Check if user has permission to manage users
  if (!isAuthenticated || !hasPermission('settings')) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">Access Denied</p>
            <p className="text-sm text-gray-400">You don&apos;t have permission to manage users.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const users = userDb.getAll() as User[];
  const roles = roleDb.getAll() as Role[];
  const permissions = permissionDb.getAll() as Permission[];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="space-x-2">
          <Button
            variant={activeTab === 'users' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('users')}
          >
            Users
          </Button>
          <Button
            variant={activeTab === 'roles' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('roles')}
          >
            Roles & Permissions
          </Button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <UsersList users={users} roles={roles} />
      ) : (
        <RolesList 
          roles={roles} 
          permissions={permissions}
          editingRole={editingRole}
          setEditingRole={setEditingRole}
        />
      )}
    </div>
  );
}

function UsersList({ users, roles }: { users: User[]; roles: Role[] }) {
  const getRoleName = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    return role?.name || 'Unknown';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>System Users</span>
          <Button size="sm">Add User</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b">
                <th className="pb-2">Name</th>
                <th className="pb-2">Username</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Last Login</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="py-3">{user.name}</td>
                  <td className="py-3">{user.username}</td>
                  <td className="py-3">
                    <Badge variant="outline">{getRoleName(user.roleId)}</Badge>
                  </td>
                  <td className="py-3">
                    <Badge variant={user.isActive ? 'success' : 'destructive'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {user.lastLogin 
                      ? new Date(user.lastLogin).toLocaleDateString() 
                      : 'Never'}
                  </td>
                  <td className="py-3">
                    <div className="space-x-2">
                      <Button size="sm" variant="secondary">Edit</Button>
                      {!user.isDoctor && (
                        <Button size="sm" variant="destructive">Deactivate</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function RolesList({ 
  roles, 
  permissions, 
  editingRole, 
  setEditingRole 
}: { 
  roles: Role[]; 
  permissions: Permission[];
  editingRole: Role | null;
  setEditingRole: (role: Role | null) => void;
}) {
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (editingRole) {
    return (
      <RoleEditor
        role={editingRole}
        groupedPermissions={groupedPermissions}
        onSave={() => setEditingRole(null)}
        onCancel={() => setEditingRole(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <Card key={role.id}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <div>
                <span>{role.name}</span>
                {role.isSystem && (
                  <Badge variant="outline" className="ml-2">System</Badge>
                )}
              </div>
              <div className="space-x-2">
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => setEditingRole(role)}
                >
                  Edit Permissions
                </Button>
                {!role.isSystem && (
                  <Button size="sm" variant="destructive">Delete</Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">{role.description}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(role.permissions)
                .filter(([, enabled]) => enabled)
                .map(([key]) => {
                  const perm = permissions.find((p) => p.key === key);
                  return perm ? (
                    <Badge key={key} variant="success">{perm.name}</Badge>
                  ) : null;
                })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RoleEditor({
  role,
  groupedPermissions,
  onSave,
  onCancel,
}: {
  role: Role;
  groupedPermissions: Record<string, Permission[]>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [permissions, setPermissions] = useState(role.permissions);
  const { logActivity } = useAuth();

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    // In a real app, this would update the database
    roleDb.update(role.id, { permissions });
    logActivity('edit_role_permissions', 'admin', { roleId: role.id, permissions });
    onSave();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Permissions: {role.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(groupedPermissions).map(([category, perms]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold uppercase text-gray-500 mb-2">
                {category}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {perms.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={permissions[perm.key] || false}
                      onChange={() => togglePermission(perm.key)}
                      className="rounded"
                    />
                    <div>
                      <span className="text-sm">{perm.name}</span>
                      <p className="text-xs text-gray-400">{perm.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end space-x-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </CardContent>
    </Card>
  );
}
