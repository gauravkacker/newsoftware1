"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { patientTagDb } from "@/lib/db/database";
import type { PatientTag } from "@/types";

// Default system tags
const SYSTEM_TAGS: PatientTag[] = [
  { id: "diabetic", name: "Diabetic", color: "#ef4444", description: "Diabetic patient", isSystem: true },
  { id: "hypertensive", name: "Hypertensive", color: "#f97316", description: "Hypertensive patient", isSystem: true },
  { id: "chronic", name: "Chronic", color: "#8b5cf6", description: "Chronic case", isSystem: true },
  { id: "vip", name: "VIP", color: "#eab308", description: "VIP patient", isSystem: true },
  { id: "exempt", name: "Fee Exempt", color: "#22c55e", description: "Exempt from fees", isSystem: true },
];

export default function TagManagementPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tags, setTags] = useState<PatientTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTag, setEditingTag] = useState<PatientTag | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<PatientTag | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    color: "#3b82f6",
    description: "",
  });

  // Load tags
  const loadTags = () => {
    setIsLoading(true);
    const allTags = patientTagDb.getAll() as PatientTag[];
    
    // Merge system tags with custom tags
    const customTags = allTags.filter(t => !t.isSystem);
    setTags([...SYSTEM_TAGS, ...customTags]);
    setIsLoading(false);
  };

  // Load tags on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadTags();
  }, []);

  // Initialize system tags if not exist
  useEffect(() => {
    const existingTags = patientTagDb.getAll() as PatientTag[];
    if (existingTags.length === 0) {
      SYSTEM_TAGS.forEach(tag => patientTagDb.create(tag as unknown as Record<string, unknown>));
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadTags();
    }
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({ name: "", color: "#3b82f6", description: "" });
    setEditingTag(null);
    setShowAddModal(false);
  };

  // Handle save
  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("Tag name is required");
      return;
    }

    if (editingTag) {
      // Update existing tag
      const updatedTag = {
        ...editingTag,
        name: formData.name.trim(),
        color: formData.color,
        description: formData.description.trim(),
      };
      patientTagDb.update(editingTag.id, updatedTag);
    } else {
      // Create new tag
      const newTag: PatientTag = {
        id: `tag-${Date.now()}`,
        name: formData.name.trim(),
        color: formData.color,
        description: formData.description.trim(),
        isSystem: false,
      };
      patientTagDb.create(newTag as unknown as Record<string, unknown>);
    }

    resetForm();
    loadTags();
  };

  // Handle edit
  const handleEdit = (tag: PatientTag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || "",
    });
    setShowAddModal(true);
  };

  // Handle delete
  const handleDelete = (tag: PatientTag) => {
    if (tag.isSystem) {
      alert("System tags cannot be deleted");
      return;
    }
    setShowDeleteConfirm(tag);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (showDeleteConfirm) {
      patientTagDb.delete(showDeleteConfirm.id);
      setShowDeleteConfirm(null);
      loadTags();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Patient Tags</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Manage custom tags for patient categorization
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowAddModal(true)}
            >
              + Add Tag
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid gap-4">
              {tags.map((tag) => (
                <Card key={tag.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: tag.color + "20" }}
                      >
                        <span
                          className="font-medium"
                          style={{ color: tag.color }}
                        >
                          {tag.name[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{tag.name}</h3>
                          {tag.isSystem && (
                            <Badge variant="default" size="sm">System</Badge>
                          )}
                        </div>
                        {tag.description && (
                          <p className="text-sm text-gray-500">{tag.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        size="sm"
                        style={{ backgroundColor: tag.color + "20", color: tag.color }}
                      >
                        Preview
                      </Badge>
                      {!tag.isSystem && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tag)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(tag)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}

              {tags.length === 0 && (
                <Card className="p-12 text-center">
                  <div className="text-gray-400 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tags yet</h3>
                  <p className="text-gray-500 mb-4">
                    Create custom tags to categorize patients
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setShowAddModal(true)}
                  >
                    + Add First Tag
                  </Button>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {editingTag ? "Edit Tag" : "Add New Tag"}
              </h2>
              <div className="space-y-4">
                <Input
                  label="Tag Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., VIP, Chronic, Diabetic"
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <div className="flex gap-2">
                    {["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`h-8 w-8 rounded-full transition-transform ${
                          formData.color === color ? "ring-2 ring-offset-2 ring-blue-500 scale-110" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-8 w-8 rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this tag"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                  />
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preview
                  </label>
                  <div className="flex items-center gap-2">
                    <Badge
                      style={{ backgroundColor: formData.color + "20", color: formData.color }}
                    >
                      {formData.name || "Tag Name"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  variant="secondary"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  className="flex-1"
                >
                  {editingTag ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">Delete Tag</h2>
              <p className="text-gray-500 mb-4">
                Are you sure you want to delete &quot;{showDeleteConfirm.name}&quot;?
                This will remove the tag from all patients.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmDelete}
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
