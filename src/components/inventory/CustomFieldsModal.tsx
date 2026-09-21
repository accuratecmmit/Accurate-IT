import React, { useState, useEffect } from 'react';
import { AssetCustomField } from '../../types';
import { fetchCustomFields, createCustomField, updateCustomField } from '../../services/assetService';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Plus, Sliders, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface CustomFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFieldsUpdated?: () => void;
}

export const CustomFieldsModal: React.FC<CustomFieldsModalProps> = ({
  isOpen,
  onClose,
  onFieldsUpdated,
}) => {
  const [fields, setFields] = useState<AssetCustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New field form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState<AssetCustomField['fieldType']>('TEXT');
  const [newOptionsStr, setNewOptionsStr] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsRequired, setNewIsRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadFields = async () => {
    setIsLoading(true);
    const res = await fetchCustomFields();
    if (res.error) {
      setError(res.error);
    } else {
      setFields(res.customFields || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadFields();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const handleLabelChange = (val: string) => {
    setNewLabel(val);
    if (!newKey || newKey === '') {
      // Auto-suggest camelCase / snake_case key
      const suggestedKey = val
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
      setNewKey(suggestedKey);
    }
  };

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newKey.trim()) {
      setError('Label and field identifier key are mandatory.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const options =
      newType === 'SELECT'
        ? newOptionsStr
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const res = await createCustomField({
      label: newLabel.trim(),
      fieldKey: newKey.trim(),
      fieldType: newType,
      options,
      description: newDescription.trim() || undefined,
      isRequired: newIsRequired,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSuccess(`Custom field "${newLabel}" created successfully.`);
      setShowAddForm(false);
      setNewLabel('');
      setNewKey('');
      setNewType('TEXT');
      setNewOptionsStr('');
      setNewDescription('');
      setNewIsRequired(false);
      await loadFields();
      if (onFieldsUpdated) onFieldsUpdated();
    } else {
      setError(res.error || 'Failed to create custom field');
    }
  };

  const handleToggleActive = async (field: AssetCustomField) => {
    const res = await updateCustomField(field.id, { isActive: !field.isActive });
    if (res.success) {
      setFields((prev) =>
        prev.map((f) => (f.id === field.id ? { ...f, isActive: !f.isActive } : f))
      );
      if (onFieldsUpdated) onFieldsUpdated();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Manage Inventory Custom Fields
                <Badge variant="purple">Super Admin Only</Badge>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Define dynamic metadata fields that appear on every computer asset and Excel export.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Configured Fields ({fields.length})
          </span>
          {!showAddForm && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowAddForm(true)}
              className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 font-semibold"
            >
              Add Custom Field
            </Button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {showAddForm && (
            <form
              onSubmit={handleCreateField}
              className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Define New Asset Field
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Display Label *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asset Tier, GPU Model"
                    value={newLabel}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    System Field Key *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. assetTier, gpuModel"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data Type *
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  >
                    <option value="TEXT">Text String</option>
                    <option value="NUMBER">Numeric Value</option>
                    <option value="BOOLEAN">Boolean (Yes / No)</option>
                    <option value="DATE">Date</option>
                    <option value="SELECT">Dropdown Selection</option>
                  </select>
                </div>

                {newType === 'SELECT' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Options (Comma Separated) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Option 1, Option 2, Option 3"
                      value={newOptionsStr}
                      onChange={(e) => setNewOptionsStr(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Help Hint (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Explains what should be recorded in this custom field"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={newIsRequired}
                    onChange={(e) => setNewIsRequired(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Mark as required field</span>
                </label>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                  className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 font-semibold"
                >
                  {isSubmitting ? 'Saving...' : 'Save Field'}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading custom fields...</div>
          ) : fields.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-400 text-xs">
              No custom fields configured yet. Create one above to extend the Computer Inventory schema.
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {field.label}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        ({field.fieldKey})
                      </span>
                      <Badge variant="neutral">{field.fieldType}</Badge>
                      {field.isRequired && <Badge variant="warning">Required</Badge>}
                    </div>

                    {field.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {field.description}
                      </p>
                    )}

                    {field.options && field.options.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {field.options.map((opt, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] text-slate-600 dark:text-slate-300"
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(field)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        field.isActive
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
                      }`}
                    >
                      {field.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs font-semibold">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
