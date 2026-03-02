"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

// Simple user type
interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'doctor' | 'receptionist' | 'pharmacist';
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

// Module permissions
const MODULES = [
  { id: 'patients', name: 'Patients' },
  { id: 'appointments', name: 'Appointments' },
  { id: 'doctor-panel', name: 'Doctor Panel' },
  { id: 'pharmacy', name: 'Pharmacy' },
  { id: 'billing', name: 'Billing' },
  { id: 'prescriptions', name: 'Prescriptions' },
  { id: 'reports', name: 'Reports' },
  { id: 'settings', name: 'Settings' },
  { id: 'admin', name: 'Admin' },
];

// Role presets
const ROLE_PRESETS = {
  admin: ['patients', 'appointments', 'doctor-panel', 'pharmacy', 'billing', 'prescriptions', 'reports', 'settings', 'admin'],
  doctor: ['patients', 'appointments', 'doctor-panel', 'pharmacy', 'prescriptions', 'reports'],
  receptionist: ['patients', 'appointments', 'billing'],
  pharmacist: ['pharmacy', 'prescriptions'],
};

// Simple localStorage-based user management
const USERS_KEY = 'clinic_users';

const getUsers = (): User[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) {
    // Create default admin user
    const defaultAdmin: User = {
      id: 'admin-1',
      username: 'admin',
      password: 'admin123',
      name: 'Administrator',
      role: 'admin',
      permissions: ROLE_PRESETS.admin,
      isActive: true,
      createdAt: new Date(),
    };
    localStorage.setItem(USERS_KEY, JSON.stringify([defaultAdmin]));
    return [defaultAdmin];
  }
  return JSON.parse(stored);
};

const saveUsers = (users: User[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
};

// Password generator
const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export default function UsersManagementPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'receptionist' as User['role'],
    permissions: [] as string[],
  });

  useEffect(() => {
    setUsers(getUsers());
  }, []);

  const handleCreate = () => {
    setEditingUser(null);
    setShowForm(true);
    const generatedPassword = generatePassword();
    setFormData({
      username: '',
      password: generatedPassword,
      name: '',
      role: 'receptionist',
      permissions: ROLE_PRESETS.receptionist,
    });
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
    setFormData({
      username: user.username,
      password: user.password,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    });
  };

  const handleSave = () => {
    if (!formData.username.trim() || !formData.name.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    const updatedUsers = [...users];
    
    if (editingUser) {
      const index = updatedUsers.findIndex(u => u.id === editingUser.id);
      updatedUsers[index] = {
        ...editingUser,
        ...formData,
      };
    } else {
      const newUser: User = {
        id: `user-${Date.now()}`,
        ...formData,
        isActive: true,
        createdAt: new Date(),
      };
      updatedUsers.push(newUser);
    }

    saveUsers(updatedUsers);
    setUsers(updatedUsers);
    setShowForm(false);
    setEditingUser(null);
  };

  const handleDelete = (userId: string) => {
    if (userId === 'admin-1') {
      alert('Cannot delete the default admin user');
      return;
    }
    
    if (confirm('Are you sure you want to delete this user?')) {
      const updatedUsers = users.filter(u => u.id !== userId);
      saveUsers(updatedUsers);
      setUsers(updatedUsers);
    }
  };

  const handleToggleActive = (userId: string) => {
    const updatedUsers = users.map(u => 
      u.id === userId ? { ...u, isActive: !u.isActive } : u
    );
    saveUsers(updatedUsers);
    setUsers(updatedUsers);
  };

  const handleRoleChange = (role: User['role']) => {
    setFormData({
      ...formData,
      role,
      permissions: ROLE_PRESETS[role],
    });
  };

  const togglePermission = (moduleId: string) => {
    const newPermissions = formData.permissions.includes(moduleId)
      ? formData.permissions.filter(p => p !== moduleId)
      : [...formData.permissions, moduleId];
    setFormData({ ...formData, permissions: newPermissions });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className={`transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="text-sm text-gray-500">Manage system users, roles, and permissions</p>
            </div>
            {!showForm && (
              <Button onClick={handleCreate}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add User
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* User Form */}
          {showForm && (
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="password"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => setFormData({ ...formData, password: generatePassword() })}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value as User['role'])}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="doctor">Doctor</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="pharmacist">Pharmacist</option>
                  </select>
                </div>
              </div>

              {/* Permissions */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Module Permissions</label>
                <div className="grid grid-cols-3 gap-2">
                  {MODULES.map((module) => (
                    <label key={module.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(module.id)}
                        onChange={() => togglePermission(module.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{module.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave}>
                  {editingUser ? 'Update User' : 'Create User'}
                </Button>
                <Button variant="secondary" onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                }}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {/* Users List */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Users</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-3 text-sm font-medium text-gray-700">Name</th>
                    <th className="pb-3 text-sm font-medium text-gray-700">Username</th>
                    <th className="pb-3 text-sm font-medium text-gray-700">Password</th>
                    <th className="pb-3 text-sm font-medium text-gray-700">Role</th>
                    <th className="pb-3 text-sm font-medium text-gray-700">Permissions</th>
                    <th className="pb-3 text-sm font-medium text-gray-700">Status</th>
                    <th className="pb-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="py-3">{user.name}</td>
                      <td className="py-3 font-mono text-sm">{user.username}</td>
                      <td className="py-3 font-mono text-sm">{user.password}</td>
                      <td className="py-3">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <span className="text-sm text-gray-600">{user.permissions.length} modules</span>
                      </td>
                      <td className="py-3">
                        <Badge variant={user.isActive ? 'success' : 'default'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleEdit(user)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleToggleActive(user.id)}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          {user.id !== 'admin-1' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDelete(user.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
