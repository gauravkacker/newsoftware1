"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { feeDb } from "@/lib/db/database";
import type { FeeType } from "@/types";

export default function FeeSettingsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fees, setFees] = useState<FeeType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingFee, setEditingFee] = useState<FeeType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    amount: 0,
    description: "",
    isActive: true,
    displayOrder: 0,
  });

  const loadFees = useCallback(() => {
    setIsLoading(true);
    const allFees = feeDb.getActive() as FeeType[];
    setFees(allFees);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadFees();
  }, [loadFees]);

  const handleCreate = () => {
    setEditingFee(null);
    setFormData({
      name: "",
      amount: 0,
      description: "",
      isActive: true,
      displayOrder: fees.length,
    });
  };

  const handleEdit = (fee: FeeType) => {
    setEditingFee(fee);
    setFormData({
      name: fee.name,
      amount: fee.amount,
      description: fee.description || "",
      isActive: fee.isActive,
      displayOrder: fee.displayOrder || 0,
    });
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("Please enter a fee name");
      return;
    }

    if (editingFee) {
      feeDb.update(editingFee.id, formData);
    } else {
      feeDb.create({
        name: formData.name,
        amount: formData.amount,
        description: formData.description,
        isActive: formData.isActive,
        displayOrder: formData.displayOrder,
      } as unknown as Parameters<typeof feeDb.create>[0]);
    }

    setEditingFee(null);
    loadFees();
  };

  const handleDelete = (feeId: string) => {
    if (confirm("Delete this fee type? Existing appointments using this fee will not be affected.")) {
      feeDb.delete(feeId);
      loadFees();
    }
  };

  const handleToggleActive = (feeId: string) => {
    feeDb.toggleActive(feeId);
    loadFees();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className={`transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        <div className="p-8">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fee Configuration</h1>
              <p className="text-gray-500">Configure consultation fees and payment types</p>
            </div>

            {/* Fee List */}
            <div className="grid gap-4">
              {fees.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-gray-400 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No fee types configured</h3>
                  <p className="text-gray-500 mb-4">Create your first fee type to start collecting payments</p>
                  <Button onClick={handleCreate}>Create Fee Type</Button>
                </Card>
              ) : (
                fees.map((fee) => {
                  const f = fee as FeeType;
                  return (
                    <Card key={f.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">
                            ₹{f.amount}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{f.name}</h3>
                              <Badge variant={f.isActive ? "success" : "default"}>
                                {f.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">
                              {f.description || "No description"} • Order: {f.displayOrder + 1}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => handleEdit(f)}>
                            Edit
                          </Button>
                          <Button
                            variant={f.isActive ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => handleToggleActive(f.id)}
                          >
                            {f.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(f.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Add/Edit Form */}
            {(editingFee || fees.length === 0) && !isLoading && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingFee ? "Edit Fee Type" : "Create New Fee Type"}
                </h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fee Name</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., New Patient, Follow Up"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                    <Input
                      type="number"
                      value={formData.displayOrder}
                      onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave}>{editingFee ? "Update" : "Create"} Fee Type</Button>
                  <Button variant="secondary" onClick={() => setEditingFee(null)}>
                    Cancel
                  </Button>
                </div>
              </Card>
            )}

            {/* Add Fee Button */}
            {!editingFee && fees.length > 0 && (
              <Button onClick={handleCreate}>Add Another Fee Type</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
