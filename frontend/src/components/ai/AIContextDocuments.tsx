import { useState, useEffect } from 'react';
import { aiApi } from '../../services/ai-api.js';
import { PlusIcon, Pencil1Icon, TrashIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { AIContextDocument } from '@echo-portal/shared';

interface DocFormData {
  title: string;
  content: string;
  sortOrder: number;
}

const emptyForm: DocFormData = { title: '', content: '', sortOrder: 0 };

/**
 * AIContextDocuments — admin panel for managing AI reference materials
 *
 * Allows creating, editing, enabling/disabling, and deleting context documents
 * that are injected into AI system prompts.
 */
export function AIContextDocuments() {
  const [documents, setDocuments] = useState<AIContextDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null = not editing, 'new' = creating
  const [form, setForm] = useState<DocFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await aiApi.getContextDocuments();
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load context documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleCreate = () => {
    setEditingId('new');
    setForm(emptyForm);
  };

  const handleEdit = (doc: AIContextDocument) => {
    setEditingId(doc.id);
    setForm({ title: doc.title, content: doc.content, sortOrder: doc.sortOrder });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      if (editingId === 'new') {
        await aiApi.createContextDocument({
          title: form.title.trim(),
          content: form.content.trim(),
          sortOrder: form.sortOrder,
        });
      } else if (editingId) {
        await aiApi.updateContextDocument(editingId, {
          title: form.title.trim(),
          content: form.content.trim(),
          sortOrder: form.sortOrder,
        });
      }
      setEditingId(null);
      setForm(emptyForm);
      await fetchDocs();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (doc: AIContextDocument) => {
    try {
      await aiApi.updateContextDocument(doc.id, { enabled: !doc.enabled });
      await fetchDocs();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await aiApi.deleteContextDocument(id);
      await fetchDocs();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Context Documents</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Reference materials injected into AI prompts (brand guidelines, tone of voice, etc.)
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={editingId !== null}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon />
          Add Document
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 mb-4 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-900 font-medium">Dismiss</button>
        </div>
      )}

      {/* Create / Edit form */}
      {editingId !== null && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            {editingId === 'new' ? 'New Context Document' : 'Edit Context Document'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Brand Guidelines"
                maxLength={200}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Content (Markdown)</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Enter document content in markdown..."
                rows={8}
                maxLength={100000}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">{form.content.length.toLocaleString()} / 100,000 chars</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                min={0}
                className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.content.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckIcon />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                <Cross2Icon />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : documents.length === 0 && editingId === null ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No context documents yet.</p>
          <p className="text-xs mt-1">Add brand guidelines, tone-of-voice docs, or style guides for the AI to reference.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-3 rounded-lg border border-gray-200 px-4 py-3"
              style={{ opacity: doc.enabled ? 1 : 0.6 }}
            >
              {/* Enable toggle */}
              <button
                onClick={() => handleToggle(doc)}
                className="mt-0.5 shrink-0"
                title={doc.enabled ? 'Disable' : 'Enable'}
              >
                <div
                  className="w-9 h-5 rounded-full relative transition-colors"
                  style={{ background: doc.enabled ? 'var(--green-9, #22c55e)' : '#d1d5db' }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                    style={{ left: doc.enabled ? '18px' : '2px' }}
                  />
                </div>
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{doc.title}</span>
                  <span className="text-xs text-gray-400">Order: {doc.sortOrder}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{doc.content.slice(0, 150)}{doc.content.length > 150 ? '...' : ''}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleEdit(doc)}
                  disabled={editingId !== null}
                  className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                  title="Edit"
                >
                  <Pencil1Icon />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id || editingId !== null}
                  className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
