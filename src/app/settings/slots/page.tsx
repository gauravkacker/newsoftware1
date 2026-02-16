"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { slotDb } from "@/lib/db/database";
import type { Slot } from "@/types";

export default function SlotSettingsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    startTime: "09:00",
    endTime: "13:00",
    maxTokens: 20,
    duration: 10,
    tokenReset: true,
    isActive: true,
    displayOrder: 0,
  });

  const loadSlots = useCallback(() => {
    setIsLoading(true);
    const allSlots = slotDb.getAll() as Slot[];
    const sortedSlots = allSlots.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    setSlots(sortedSlots);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadSlots();
  }, [loadSlots]);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingSlot(null);
    setFormData({
      name: "",
      startTime: "09:00",
      endTime: "13:00",
      maxTokens: 20,
      duration: 10,
      tokenReset: true,
      isActive: true,
      displayOrder: slots.length,
    });
  };

  const handleEdit = (slot: Slot) => {
    setEditingSlot(slot);
    setFormData({
      name: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxTokens: slot.maxTokens,
      duration: slot.duration || 10,
      tokenReset: slot.tokenReset,
      isActive: slot.isActive,
      displayOrder: slot.displayOrder || 0,
    });
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("Please enter a slot name");
      return;
    }

    if (editingSlot) {
      slotDb.update(editingSlot.id, formData);
    } else {
      slotDb.create({
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        maxTokens: formData.maxTokens,
        duration: formData.duration,
        tokenReset: formData.tokenReset,
        isActive: formData.isActive,
        displayOrder: formData.displayOrder,
      } as unknown as Parameters<typeof slotDb.create>[0]);
    }

    setEditingSlot(null);
    setIsCreating(false);
    loadSlots();
  };

  const handleDelete = (slotId: string) => {
    if (confirm("Delete this slot? Existing appointments will not be affected.")) {
      slotDb.delete(slotId);
      loadSlots();
    }
  };

  const handleToggleActive = (slotId: string) => {
    slotDb.toggleActive(slotId);
    loadSlots();
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
              <h1 className="text-2xl font-bold text-gray-900">Slot Configuration</h1>
              <p className="text-gray-500">Configure appointment slots for your clinic</p>
            </div>

            {/* Slot List */}
            <div className="grid gap-4">
              {slots.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-gray-400 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No slots configured</h3>
                  <p className="text-gray-500 mb-4">Create your first time slot to start booking appointments</p>
                  <Button onClick={handleCreate}>Create Slot</Button>
                </Card>
              ) : (
                slots.map((slot) => {
                  const s = slot as Slot;
                  return (
                    <Card key={s.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                            {s.displayOrder + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{s.name}</h3>
                              <Badge variant={s.isActive ? "success" : "default"}>
                                {s.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">
                              {s.startTime} - {s.endTime} • Max {s.maxTokens} tokens
                              {s.tokenReset && " • Token resets"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => handleEdit(s)}>
                            Edit
                          </Button>
                          <Button
                            variant={s.isActive ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => handleToggleActive(s.id)}
                          >
                            {s.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(s.id)}>
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
            {(editingSlot || isCreating) && !isLoading && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingSlot ? "Edit Slot" : "Create New Slot"}
                </h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slot Name</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Morning, Evening"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                    <Input
                      type="number"
                      value={formData.maxTokens}
                      onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) || 20 })}
                    />
                  </div>
                </div>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.tokenReset}
                      onChange={(e) => setFormData({ ...formData, tokenReset: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Reset token numbering for this slot</span>
                  </label>
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
                  <Button onClick={handleSave}>{editingSlot ? "Update" : "Create"} Slot</Button>
                  <Button variant="secondary" onClick={() => {
                    setEditingSlot(null);
                    setIsCreating(false);
                  }}>
                    Cancel
                  </Button>
                </div>
              </Card>
            )}

            {/* Add Slot Button */}
            {!editingSlot && !isCreating && slots.length > 0 && (
              <Button onClick={handleCreate}>Add Another Slot</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
