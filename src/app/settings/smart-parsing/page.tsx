"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface SmartParsingRule {
  id: string;
  name: string;
  type: 'quantity' | 'doseForm' | 'dosePattern' | 'duration';
  pattern: string;
  replacement: string;
  isRegex: boolean;
  priority: number;
  isActive: boolean;
}

const RULE_TYPES = [
  { value: 'quantity', label: 'Quantity' },
  { value: 'doseForm', label: 'Dose Form' },
  { value: 'dosePattern', label: 'Dose Pattern' },
  { value: 'duration', label: 'Duration' },
];

const DEFAULT_QUANTITY_RULES: Partial<SmartParsingRule>[] = [
  { name: 'Drachm', type: 'quantity', pattern: '\\b(\\d+)\\s*dr\\b', replacement: '$1 dr', isRegex: true },
  { name: 'Ounce', type: 'quantity', pattern: '\\b(\\d+)\\s*oz\\b', replacement: '$1 oz', isRegex: true },
  { name: 'Half Ounce', type: 'quantity', pattern: '\\b(1/2|0\\.5)\\s*oz\\b', replacement: '1/2 oz', isRegex: true },
  { name: 'Milliliter', type: 'quantity', pattern: '\\b(\\d+)\\s*ml\\b', replacement: '$1 ml', isRegex: true },
];

const DEFAULT_DOSEFORM_RULES: Partial<SmartParsingRule>[] = [
  { name: 'Pills', type: 'doseForm', pattern: '\\b(pills?)\\b', replacement: 'Pills', isRegex: true },
  { name: 'Tablet', type: 'doseForm', pattern: '\\b(tablets?|tabs?)\\b', replacement: 'Tab', isRegex: true },
  { name: 'Liquid', type: 'doseForm', pattern: '\\b(liq|liquid|solution)\\b', replacement: 'Liq', isRegex: true },
  { name: 'Drops', type: 'doseForm', pattern: '\\b(drops?)\\b', replacement: 'Drops', isRegex: true },
  { name: 'Sachet', type: 'doseForm', pattern: '\\b(sachets?)\\b', replacement: 'Sachet', isRegex: true },
  { name: 'Powder', type: 'doseForm', pattern: '\\b(powders?)\\b', replacement: 'Powder', isRegex: true },
  { name: 'Ointment', type: 'doseForm', pattern: '\\b(ointment|cream|balm)\\b', replacement: 'Ointment', isRegex: true },
];

const DEFAULT_DOSEPATTERN_RULES: Partial<SmartParsingRule>[] = [
  { name: 'OD', type: 'dosePattern', pattern: '\\bOD\\b', replacement: '1-0-0', isRegex: false },
  { name: 'BD', type: 'dosePattern', pattern: '\\bBD\\b', replacement: '1-1-0', isRegex: false },
  { name: 'TDS', type: 'dosePattern', pattern: '\\bTDS\\b', replacement: '1-1-1', isRegex: false },
  { name: 'QID', type: 'dosePattern', pattern: '\\bQID\\b', replacement: '1-1-1-1', isRegex: false },
  { name: 'SOS', type: 'dosePattern', pattern: '\\bSOS\\b', replacement: 'SOS', isRegex: false },
  { name: 'HS', type: 'dosePattern', pattern: '\\bHS\\b', replacement: '0-0-1', isRegex: false },
  { name: 'TID', type: 'dosePattern', pattern: '\\bTID\\b', replacement: '1-1-1', isRegex: false },
];

const DEFAULT_DURATION_RULES: Partial<SmartParsingRule>[] = [
  { name: 'Days', type: 'duration', pattern: '(\\d+)\\s*days?', replacement: '$1 days', isRegex: true },
  { name: 'Weeks', type: 'duration', pattern: '(\\d+)\\s*weeks?', replacement: '$1 weeks', isRegex: true },
  { name: 'Months', type: 'duration', pattern: '(\\d+)\\s*months?', replacement: '$1 months', isRegex: true },
];

export default function SmartParsingSettingsPage() {
  const [rules, setRules] = useState<SmartParsingRule[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState<SmartParsingRule | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'quantity' as 'quantity' | 'doseForm' | 'dosePattern' | 'duration',
    pattern: '',
    replacement: '',
    isRegex: false,
    priority: 0,
    isActive: true,
  });

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/smart-parsing');
      const data = await response.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchRules();
  }, []);

  const handleSave = async () => {
    try {
      if (editingRule) {
        await fetch('/api/smart-parsing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, id: editingRule.id }),
        });
      } else {
        await fetch('/api/smart-parsing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      fetchRules();
      resetForm();
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await fetch(`/api/smart-parsing?id=${id}`, { method: 'DELETE' });
      fetchRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleEdit = (rule: SmartParsingRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type,
      pattern: rule.pattern,
      replacement: rule.replacement,
      isRegex: rule.isRegex,
      priority: rule.priority,
      isActive: rule.isActive,
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      type: 'quantity',
      pattern: '',
      replacement: '',
      isRegex: false,
      priority: 0,
      isActive: true,
    });
  };

  const loadDefaultRules = async (type: string) => {
    const defaultRules = {
      quantity: DEFAULT_QUANTITY_RULES,
      doseForm: DEFAULT_DOSEFORM_RULES,
      dosePattern: DEFAULT_DOSEPATTERN_RULES,
      duration: DEFAULT_DURATION_RULES,
    };
    
    for (const rule of defaultRules[type as keyof typeof defaultRules] || []) {
      try {
        await fetch('/api/smart-parsing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...rule, priority: 10 }),
        });
      } catch (error) {
        console.error('Failed to load default rule:', error);
      }
    }
    fetchRules();
  };

  const filteredRules = filterType === 'all' 
    ? rules 
    : rules.filter(r => r.type === filterType);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quantity': return 'bg-blue-100 text-blue-800';
      case 'doseForm': return 'bg-green-100 text-green-800';
      case 'dosePattern': return 'bg-purple-100 text-purple-800';
      case 'duration': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="ml-64 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Smart Parsing Rules</h1>
              <p className="text-gray-600">Configure how the system parses prescription text automatically</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => loadDefaultRules('quantity')}>
                Load Quantity Rules
              </Button>
              <Button variant="secondary" onClick={() => loadDefaultRules('doseForm')}>
                Load Dose Form Rules
              </Button>
              <Button variant="secondary" onClick={() => loadDefaultRules('dosePattern')}>
                Load Dose Pattern Rules
              </Button>
              <Button onClick={() => { resetForm(); setShowAddModal(true); }}>
                Add New Rule
              </Button>
            </div>
          </div>

          {/* Filter */}
          <div className="mb-4 flex gap-2">
            <Button 
              variant={filterType === 'all' ? 'primary' : 'secondary'} 
              size="sm"
              onClick={() => setFilterType('all')}
            >
              All
            </Button>
            {RULE_TYPES.map(type => (
              <Button 
                key={type.value}
                variant={filterType === type.value ? 'primary' : 'secondary'} 
                size="sm"
                onClick={() => setFilterType(type.value)}
              >
                {type.label}
              </Button>
            ))}
          </div>

          {/* Rules Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredRules.map(rule => (
              <Card key={rule.id} className={!rule.isActive ? 'opacity-50' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{rule.name}</CardTitle>
                    <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(rule.type)}`}>
                      {rule.type}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-gray-500 mb-2">
                    <div><strong>Pattern:</strong> {rule.pattern}</div>
                    <div><strong>Replacement:</strong> {rule.replacement}</div>
                    {rule.isRegex && <span className="text-blue-600">Regex</span>}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Priority: {rule.priority}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredRules.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No rules found. Click &quot;Add New Rule&quot; or load default rules to get started.
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">
                {editingRule ? 'Edit Rule' : 'Add New Rule'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., OD Pattern"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as typeof formData.type })}
                    className="w-full border rounded px-3 py-2"
                  >
                    {RULE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pattern 
                    <span className="text-gray-400 ml-2">(what to match in prescription text)</span>
                  </label>
                  <Input
                    value={formData.pattern}
                    onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                    placeholder="e.g., \\bOD\\b or 4-4-4"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Replacement
                    <span className="text-gray-400 ml-2">(value to fill in the field)</span>
                  </label>
                  <Input
                    value={formData.replacement}
                    onChange={(e) => setFormData({ ...formData, replacement: e.target.value })}
                    placeholder="e.g., 1-0-0"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isRegex}
                      onChange={(e) => setFormData({ ...formData, isRegex: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm">Use Regex</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    placeholder="Higher priority rules are checked first"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="secondary" onClick={() => { setShowAddModal(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!formData.name || !formData.pattern}>
                  {editingRule ? 'Update' : 'Add'} Rule
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
