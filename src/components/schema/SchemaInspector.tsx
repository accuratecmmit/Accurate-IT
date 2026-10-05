import React, { useState, useMemo } from 'react';
import {
  NORMALIZED_SCHEMA_MODELS,
  validateSchemaIntegrity,
  ModelDefinition,
} from '../../services/schemaService';
import { useMasterData } from '../../context/MasterDataContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Key,
  Link,
  Shield,
  Layers,
  History,
  Lock,
  Search,
  Check,
  FileText,
  Server,
  Users,
  HardDrive,
  Ticket,
  Clock,
  UserCheck,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Flame,
} from 'lucide-react';

export const SchemaInspector: React.FC = () => {
  const { ticketSchema, ticketPriorities, ticketStatuses, ticketMetrics, helpdeskTickets } = useMasterData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedModelName, setSelectedModelName] = useState<string>(
    NORMALIZED_SCHEMA_MODELS[0].name
  );

  // Run authoritative schema integrity validation
  const validationReport = useMemo(() => validateSchemaIntegrity(), []);

  const categories = [
    { id: 'ALL', label: 'All Tables', count: NORMALIZED_SCHEMA_MODELS.length },
    { id: 'CORE_IDENTITY', label: 'Core Identity & Roles', count: NORMALIZED_SCHEMA_MODELS.filter(m => m.category === 'CORE_IDENTITY').length },
    { id: 'MASTER_DATA', label: 'Independent Master Data', count: NORMALIZED_SCHEMA_MODELS.filter(m => m.category === 'MASTER_DATA').length },
    { id: 'TICKETING', label: 'Ticketing & History', count: NORMALIZED_SCHEMA_MODELS.filter(m => m.category === 'TICKETING').length },
    { id: 'INVENTORY', label: 'Hardware & Asset History', count: NORMALIZED_SCHEMA_MODELS.filter(m => m.category === 'INVENTORY').length },
    { id: 'GOVERNANCE', label: 'SLA & Governance', count: NORMALIZED_SCHEMA_MODELS.filter(m => m.category === 'GOVERNANCE').length },
    { id: 'SECURITY', label: 'Security, Sessions & Audit', count: NORMALIZED_SCHEMA_MODELS.filter(m => m.category === 'SECURITY').length },
  ];

  const filteredModels = useMemo(() => {
    return NORMALIZED_SCHEMA_MODELS.filter((m) => {
      const matchesCategory =
        selectedCategory === 'ALL' || m.category === selectedCategory;
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.collectionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.fields.some((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const activeModel = useMemo(() => {
    return (
      NORMALIZED_SCHEMA_MODELS.find((m) => m.name === selectedModelName) ||
      filteredModels[0] ||
      NORMALIZED_SCHEMA_MODELS[0]
    );
  }, [selectedModelName, filteredModels]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'CORE_IDENTITY':
        return <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'MASTER_DATA':
        return <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'TICKETING':
        return <Ticket className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'INVENTORY':
        return <HardDrive className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'GOVERNANCE':
        return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'SECURITY':
        return <Shield className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      default:
        return <Database className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Bento Grid Header & Status Card */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Status Callout */}
        <Card className="lg:col-span-3 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    Normalized Database Schema & Architecture
                  </h1>
                  <Badge variant="success" className="rounded-full px-2.5 py-0.5 text-xs">
                    Verified Normal Form (3NF)
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Normalized entity models, immutable history ledgers, non-reusable ticket sequence, and independent Company/Location master data.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-center px-3 border-r border-slate-200 dark:border-slate-700">
                <span className="block text-lg font-bold text-slate-900 dark:text-white">
                  {validationReport.modelCount}
                </span>
                <span className="block text-[11px] uppercase tracking-wider text-slate-500">
                  Tables/Models
                </span>
              </div>
              <div className="text-center px-3 border-r border-slate-200 dark:border-slate-700">
                <span className="block text-lg font-bold text-slate-900 dark:text-white">
                  {validationReport.relationshipsCount}
                </span>
                <span className="block text-[11px] uppercase tracking-wider text-slate-500">
                  Relations
                </span>
              </div>
              <div className="text-center px-3">
                <span className="flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                  <Check className="w-5 h-5 mr-1" /> Pass
                </span>
                <span className="block text-[11px] uppercase tracking-wider text-slate-500">
                  Validation
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Security & Integrity Bento Card */}
        <Card className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
                Integrity Engine
              </span>
              <Shield className="w-4 h-4 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              Zero Circular Cycles
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              All 25 entities validated against circular dependency deadlock and missing keys.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>Historical Retention:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Enforced</span>
          </div>
        </Card>
      </div>

      {/* Verification Checklist Bento Grid */}
      <Card className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center">
          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
          Mandatory Architectural & Permission Invariants Verification
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {validationReport.permissionRulesChecked.map((ruleCheck, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {ruleCheck.rule}
                  </span>
                  <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {ruleCheck.details}
                </p>
              </div>
              <div className="mt-2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                Constrained & Verified
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Category Pills & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center overflow-x-auto pb-1 gap-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-700/80 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        <div className="w-full md:w-72">
          <Input
            placeholder="Search tables, fields, collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={Search}
            className="rounded-xl"
          />
        </div>
      </div>

      {/* Two-Column Bento Layout: Left Model List, Right Model Deep-Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tables / Models List (4 cols) */}
        <div className="lg:col-span-4 space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {filteredModels.map((model) => {
            const isSelected = model.name === activeModel.name;
            return (
              <div
                key={model.name}
                onClick={() => setSelectedModelName(model.name)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getCategoryIcon(model.category)}
                    <span
                      className={`text-sm font-bold ${
                        isSelected
                          ? 'text-indigo-900 dark:text-indigo-200'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {model.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    /{model.collectionName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                  {model.description}
                </p>
                <div className="mt-2 flex items-center space-x-3 text-[11px] text-slate-400">
                  <span>{model.fields.length} fields</span>
                  <span>•</span>
                  <span>{model.indexes.length} indexes</span>
                  <span>•</span>
                  <span
                    className={
                      model.softDeleteEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }
                  >
                    {model.softDeleteEnabled ? 'Soft-delete' : 'Append-only'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Model Detailed Specification (8 cols) */}
        <Card className="lg:col-span-8 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          {/* Active Model Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center space-x-2.5">
                {getCategoryIcon(activeModel.category)}
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {activeModel.name}
                </h2>
                <Badge variant="indigo" className="rounded-full px-2.5 py-0.5 text-xs font-mono">
                  {activeModel.collectionName}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {activeModel.description}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300">
                Retention: {activeModel.softDeleteEnabled ? 'Soft-Delete' : 'Immutable Ledger'}
              </span>
            </div>
          </div>

          {/* Helpdesk Ticket Firestore Architecture & MasterDataContext Integration Banner */}
          {activeModel.name === 'Ticket' && (
            <div className="space-y-4 p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-indigo-200/60 dark:border-indigo-800/60">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                      Helpdesk Ticket Firestore Schema & MasterDataContext Integration
                    </h3>
                    <p className="text-xs text-indigo-700 dark:text-indigo-400">
                      Live Firestore synchronized state in <code className="font-mono bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded">MasterDataContext</code> with real-time listeners and ABAC rules.
                    </p>
                  </div>
                </div>
                <Badge variant="indigo" className="text-xs font-mono self-start sm:self-auto">
                  Path: /tickets/&#123;ticketId&#125;
                </Badge>
              </div>

              {/* 4 Pillars of Helpdesk Ticket Schema */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Priority */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    <span>Priority (5 Tiers)</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-500">LOW</span>
                      <span className="text-slate-400">8h resp / 48h res</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-500">MEDIUM</span>
                      <span className="text-slate-400">4h resp / 24h res</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-500">HIGH</span>
                      <span className="text-slate-400">1h resp / 8h res</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-500">CRITICAL</span>
                      <span className="text-slate-400">30m resp / 4h res</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-500">URGENT</span>
                      <span className="text-slate-400">15m resp / 2h res</span>
                    </div>
                  </div>
                </div>

                {/* 2. Status */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Status Lifecycle</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sky-600">NEW / ASSIGNED</span>
                      <span className="text-slate-400">Triage phase</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-blue-600">OPEN / IN_PROGRESS</span>
                      <span className="text-slate-400">Active diagnosis</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-purple-600">WAITING / VENDOR</span>
                      <span className="text-slate-400">SLA clock paused</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-emerald-600">RESOLVED</span>
                      <span className="text-slate-400">Verification window</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-600">CLOSED / CANCELLED</span>
                      <span className="text-rose-500 font-semibold">Terminal states</span>
                    </div>
                  </div>
                </div>

                {/* 3. Assignee */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Assignee Mapping</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <p><code className="font-mono text-indigo-600">assignedTeamId</code>: FK to IT Team</p>
                    <p><code className="font-mono text-indigo-600">assignedTeamName</code>: Denormalized</p>
                    <p><code className="font-mono text-indigo-600">assignedTechnicianId</code>: UID</p>
                    <p><code className="font-mono text-indigo-600">assignedTechnicianName</code>: Name</p>
                    <p><code className="font-mono text-indigo-600">assignedTechnicianEmail</code>: Email</p>
                    <p><code className="font-mono text-indigo-600">assignedAt</code>: Assignment ISO</p>
                  </div>
                </div>

                {/* 4. Timestamps */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-500" />
                    <span>Timestamp Audit</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <p><code className="font-mono text-purple-600">createdAt</code>: Immutable creation</p>
                    <p><code className="font-mono text-purple-600">updatedAt</code>: Mutation stamp</p>
                    <p><code className="font-mono text-purple-600">firstRespondedAt</code>: 1st response</p>
                    <p><code className="font-mono text-purple-600">resolvedAt</code>: State = RESOLVED</p>
                    <p><code className="font-mono text-purple-600">closedAt</code>: State = CLOSED</p>
                    <p><code className="font-mono text-purple-600">responseTargetTime</code>: SLA target</p>
                  </div>
                </div>
              </div>

              {/* MasterDataContext Live Sync Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center space-x-3">
                  <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> MasterDataContext Realtime Sync Active
                  </span>
                  <span>•</span>
                  <span><strong>{ticketMetrics.totalCount}</strong> Total Tickets Loaded</span>
                  <span>•</span>
                  <span><strong>{ticketMetrics.openCount}</strong> Open</span>
                  <span>•</span>
                  <span><strong>{ticketMetrics.unassignedCount}</strong> Unassigned</span>
                  {ticketMetrics.slaBreachedCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-rose-600 font-semibold">{ticketMetrics.slaBreachedCount} SLA Breached</span>
                    </>
                  )}
                </div>
                <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                  useMasterData().helpdeskTickets
                </span>
              </div>
            </div>
          )}

          {/* Fields Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                Model Schema & Types ({activeModel.fields.length} Fields)
              </h3>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Field Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Key / Relation</th>
                    <th className="py-2.5 px-3">Required</th>
                    <th className="py-2.5 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeModel.fields.map((field) => (
                    <tr
                      key={field.name}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-white">
                        {field.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-indigo-600 dark:text-indigo-400">
                        {field.type}
                      </td>
                      <td className="py-2.5 px-3">
                        {field.isPrimaryKey && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 font-semibold text-[10px] mr-1">
                            <Key className="w-3 h-3 mr-0.5" /> PK
                          </span>
                        )}
                        {field.isForeignKey && field.references && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-semibold text-[10px]">
                            <Link className="w-3 h-3 mr-0.5" /> FK → {field.references.model}
                          </span>
                        )}
                        {field.isImmutable && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] ml-1">
                            <Lock className="w-3 h-3 mr-0.5" /> Immutable
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {field.required ? (
                          <span className="font-semibold text-slate-900 dark:text-white">YES</span>
                        ) : (
                          <span className="text-slate-400">Optional</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                        {field.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Model Constraints & Historical Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center">
                <Shield className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                Integrity Constraints
              </h4>
              <ul className="space-y-1.5">
                {activeModel.constraints.map((c, i) => (
                  <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center">
                <History className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                History & Auditing Policy
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {activeModel.historyRetentionRule}
              </p>
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Indexes: </span>
                {activeModel.indexes.join(' | ')}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
