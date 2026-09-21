import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchTickets,
  fetchTicketsAdvanced,
  fetchTicketById,
  createTicket,
  editTicket,
  cancelTicket,
  takeTicket,
  updateTicketStatus,
  updateTicketPriority,
  assignTicket,
  addTicketComment,
  uploadTicketAttachment,
  deleteTicketAttachment,
  fetchTicketHistory,
  getAttachmentPreviewUrl,
  getAttachmentDownloadUrl,
  fetchActiveTechnicians,
  fetchSavedFilters,
  createSavedFilter,
  deleteSavedFilter,
  fetchSortingPreference,
  saveSortingPreference,
  updateTicketLinkedAsset,
  StoredTicket,
  TicketComment,
  StoredTicketAttachment,
  StoredTicketHistory,
  SavedFilter,
  ActiveTechnician,
} from '../../services/ticketService';
import { fetchITTeams, ITTeam } from '../../services/itTeamService';
import { fetchAssets, fetchTicketSelectableAssets, StoredAsset } from '../../services/assetService';
import { fetchMasterLocations, fetchMasterDepartments } from '../../services/masterDataService';
import { Location, Department } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  Ticket,
  Plus,
  Search,
  RefreshCw,
  Clock,
  User,
  Shield,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Send,
  Lock,
  Building,
  Laptop,
  ArrowRight,
  Info,
  Paperclip,
  History,
  Trash2,
  Download,
  FileText,
  Phone,
  MapPin,
  Tag,
  Edit3,
  XCircle,
  Check,
  Eye,
  UserCheck,
  AlertCircle,
  FileCheck,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  ExternalLink,
  Filter,
  ChevronDown,
  ChevronUp,
  Bookmark,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Share2,
  Calendar,
  X,
  BookmarkCheck,
  Sparkles,
} from 'lucide-react';

export const TicketManagementView: React.FC = () => {
  const { user, profile, effectiveRole, isSuperAdmin } = useAuth();

  const [tickets, setTickets] = useState<(StoredTicket & { slaStatus?: 'BREACHED' | 'WARNING' | 'ON_TRACK' | 'MET' })[]>([]);
  const [itTeams, setItTeams] = useState<ITTeam[]>([]);
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeTechnicians, setActiveTechnicians] = useState<ActiveTechnician[]>([]);
  const [teamTechnicians, setTeamTechnicians] = useState<ActiveTechnician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter Criteria
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterTicketNumber, setFilterTicketNumber] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterTechnicianId, setFilterTechnicianId] = useState('ALL');
  const [filterLocationId, setFilterLocationId] = useState('ALL');
  const [filterDateField, setFilterDateField] = useState<'createdAt' | 'updatedAt'>('createdAt');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  const activeFiltersCount = [
    filterStatus !== 'ALL',
    filterPriority !== 'ALL',
    filterCategory !== 'ALL',
    filterDepartmentId !== 'ALL',
    filterTechnicianId !== 'ALL',
    filterLocationId !== 'ALL',
    Boolean(filterTicketNumber),
    Boolean(filterSubject),
    Boolean(filterEmployee),
    Boolean(filterStartDate),
    Boolean(filterEndDate),
  ].filter(Boolean).length;

  // Sorting
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination (10 per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Saved Filters
  const [savedFiltersList, setSavedFiltersList] = useState<SavedFilter[]>([]);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);
  const [isSaveFilterModalOpen, setIsSaveFilterModalOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterIsShared, setNewFilterIsShared] = useState(false);
  const [isSavingFilter, setIsSavingFilter] = useState(false);

  // Administrative Correction for Reassignment
  const [isAdministrativeCorrectionMode, setIsAdministrativeCorrectionMode] = useState(false);
  const [adminCorrectionTechId, setAdminCorrectionTechId] = useState('');

  // Selected Ticket for Detail Drawer
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<StoredTicket | null>(null);
  const [ticketComments, setTicketComments] = useState<TicketComment[]>([]);
  const [ticketAttachments, setTicketAttachments] = useState<StoredTicketAttachment[]>([]);
  const [ticketHistory, setTicketHistory] = useState<StoredTicketHistory[]>([]);
  const [activeDetailTab, setActiveDetailTab] = useState<'discussion' | 'attachments' | 'history'>('discussion');
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // New Comment Form
  const [commentContent, setCommentContent] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Create Ticket Modal (all 9 fields)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('HARDWARE');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newAssetTag, setNewAssetTag] = useState('');
  const [newLocationId, setNewLocationId] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');
  const [newTechnicianId, setNewTechnicianId] = useState('');
  const [newAssignedTeamId, setNewAssignedTeamId] = useState('');
  const [newAttachmentFile, setNewAttachmentFile] = useState<{
    originalFileName: string;
    mimeType: string;
    fileData: string;
    fileSizeBytes: number;
  } | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Ticket <-> Asset Relationship state
  const [assignedComputer, setAssignedComputer] = useState<StoredAsset | null>(null);
  const [selectableAssets, setSelectableAssets] = useState<StoredAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [assetOverrideReason, setAssetOverrideReason] = useState<string>('');
  const [isChangingAsset, setIsChangingAsset] = useState<boolean>(false);
  const [isLoadingAssetOptions, setIsLoadingAssetOptions] = useState<boolean>(false);
  const [overrideReasonError, setOverrideReasonError] = useState<string | null>(null);

  // Quick Action: Change Linked Asset (IT Staff)
  const [isChangeAssetModalOpen, setIsChangeAssetModalOpen] = useState<boolean>(false);
  const [changeAssetSelectedId, setChangeAssetSelectedId] = useState<string>('');
  const [changeAssetNotes, setChangeAssetNotes] = useState<string>('');
  const [isSubmittingAssetChange, setIsSubmittingAssetChange] = useState<boolean>(false);

  // Edit Ticket Modal (for Employee when New/Assigned or IT Staff)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLocationId, setEditLocationId] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editAssetTag, setEditAssetTag] = useState('');
  const [editAssetId, setEditAssetId] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Cancel Ticket Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Attachment upload inside detail pane
  const [isUploadingDetailAttachment, setIsUploadingDetailAttachment] = useState(false);

  // Destructive Action Confirmation Dialog
  const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const isEmployee = effectiveRole === 'EMPLOYEE';
  const isTechnician = effectiveRole === 'IT_TECHNICIAN';
  const isITAdmin = effectiveRole === 'IT_ADMIN';

  const [previewAttachment, setPreviewAttachment] = useState<StoredTicketAttachment | null>(null);

  const ALLOWED_ATTACHMENT_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'txt',
    'zip',
  ];

  // Helper to insert basic formatting into comment textarea
  const insertFormatting = (type: 'bold' | 'italic' | 'bullet' | 'numbered' | 'link') => {
    const textarea = document.getElementById('ticket-comment-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selectedText = commentContent.substring(start, end);
    let replacement = '';
    let newCursorPos = start;

    switch (type) {
      case 'bold':
        replacement = `**${selectedText || 'bold text'}**`;
        newCursorPos = selectedText ? end + 4 : start + 2;
        break;
      case 'italic':
        replacement = `*${selectedText || 'italic text'}*`;
        newCursorPos = selectedText ? end + 2 : start + 1;
        break;
      case 'bullet':
        replacement = selectedText
          ? selectedText
              .split('\n')
              .map((l) => `- ${l}`)
              .join('\n')
          : '- list item\n';
        newCursorPos = start + replacement.length;
        break;
      case 'numbered':
        replacement = selectedText
          ? selectedText
              .split('\n')
              .map((l, i) => `${i + 1}. ${l}`)
              .join('\n')
          : '1. list item\n';
        newCursorPos = start + replacement.length;
        break;
      case 'link':
        replacement = `[${selectedText || 'link title'}](https://)`;
        newCursorPos = selectedText ? end + 3 : start + 1;
        break;
    }

    const updated = commentContent.substring(0, start) + replacement + commentContent.substring(end);
    if (updated.length <= 2000) {
      setCommentContent(updated);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  // Safe formatting renderer for comments (handles bold, italic, bullet lists, numbered lists, links)
  const renderFormattedComment = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    let inBulletList = false;
    let inNumberedList = false;
    let bulletItems: React.ReactNode[] = [];
    let numberedItems: React.ReactNode[] = [];

    const flushLists = () => {
      if (inBulletList && bulletItems.length > 0) {
        elements.push(
          <ul
            key={`ul-${elements.length}`}
            className="list-disc list-inside space-y-0.5 my-1 ml-1 text-slate-700 dark:text-slate-300"
          >
            {bulletItems}
          </ul>
        );
        bulletItems = [];
        inBulletList = false;
      }
      if (inNumberedList && numberedItems.length > 0) {
        elements.push(
          <ol
            key={`ol-${elements.length}`}
            className="list-decimal list-inside space-y-0.5 my-1 ml-1 text-slate-700 dark:text-slate-300"
          >
            {numberedItems}
          </ol>
        );
        numberedItems = [];
        inNumberedList = false;
      }
    };

    const parseInline = (line: string): React.ReactNode => {
      let sanitized = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      sanitized = sanitized.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/gi,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 font-semibold underline hover:text-indigo-800">$1</a>'
      );

      sanitized = sanitized.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      sanitized = sanitized.replace(/\*([^*]+)\*/g, '<em>$1</em>');

      return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (inNumberedList) flushLists();
        inBulletList = true;
        bulletItems.push(<li key={`b-${idx}`}>{parseInline(trimmed.substring(2))}</li>);
      } else if (/^\d+\.\s/.test(trimmed)) {
        if (inBulletList) flushLists();
        inNumberedList = true;
        const content = trimmed.replace(/^\d+\.\s+/, '');
        numberedItems.push(<li key={`n-${idx}`}>{parseInline(content)}</li>);
      } else {
        flushLists();
        if (trimmed === '') {
          elements.push(<div key={`br-${idx}`} className="h-1.5" />);
        } else {
          elements.push(
            <p key={`p-${idx}`} className="text-slate-700 dark:text-slate-300 leading-relaxed break-words">
              {parseInline(line)}
            </p>
          );
        }
      }
    });

    flushLists();
    return elements;
  };

  // Attachment deletion permission check:
  // - Employee can delete own attachment while ticket is New/Assigned.
  // - Technician can delete own attachment while ticket is active.
  // - After Resolved/Closed, normal users cannot delete.
  const canDeleteAttachment = (att: StoredTicketAttachment) => {
    if (!selectedTicket) return false;
    if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(selectedTicket.status)) {
      return isSuperAdmin;
    }
    if (isEmployee) {
      const isNewOrAssigned = selectedTicket.status === 'NEW' || selectedTicket.status === 'ASSIGNED';
      return isNewOrAssigned && att.uploadedById === user?.id;
    }
    if (isTechnician) {
      const isActive = [
        'NEW',
        'ASSIGNED',
        'OPEN',
        'IN_PROGRESS',
        'WAITING_FOR_USER',
        'PENDING_USER',
        'PENDING_VENDOR',
      ].includes(selectedTicket.status);
      return isActive && att.uploadedById === user?.id;
    }
    if (isITAdmin) {
      return isSuperAdmin || att.uploadedById === user?.id;
    }
    return isSuperAdmin;
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 6000);
  };

  const loadTickets = async (
    page = currentPage,
    customFilters: any = null,
    customSort: { sortBy: string; sortOrder: 'asc' | 'desc' } | null = null
  ) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const activeSortBy = customSort ? customSort.sortBy : sortBy;
      const activeSortOrder = customSort ? customSort.sortOrder : sortOrder;

      const f = customFilters || {
        keyword: filterKeyword,
        ticketNumber: filterTicketNumber,
        subject: filterSubject,
        employee: filterEmployee,
        departmentId: filterDepartmentId,
        category: filterCategory,
        priority: filterPriority,
        status: filterStatus,
        technicianId: filterTechnicianId,
        locationId: filterLocationId,
        dateField: filterDateField,
        startDate: filterStartDate,
        endDate: filterEndDate,
      };

      const res = await fetchTicketsAdvanced({
        page,
        limit: 10,
        keyword: f.keyword ? f.keyword.trim() : undefined,
        ticketNumber: f.ticketNumber ? f.ticketNumber.trim() : undefined,
        subject: f.subject ? f.subject.trim() : undefined,
        employee: f.employee ? f.employee.trim() : undefined,
        departmentId: f.departmentId !== 'ALL' ? f.departmentId : undefined,
        category: f.category !== 'ALL' ? f.category : undefined,
        priority: f.priority !== 'ALL' ? f.priority : undefined,
        status: f.status !== 'ALL' ? f.status : undefined,
        technicianId: f.technicianId !== 'ALL' ? f.technicianId : undefined,
        locationId: f.locationId !== 'ALL' ? f.locationId : undefined,
        dateField: f.dateField || 'createdAt',
        startDate: f.startDate || undefined,
        endDate: f.endDate || undefined,
        sortBy: activeSortBy,
        sortOrder: activeSortOrder,
      });

      if (res.error) {
        showError(res.error);
      } else {
        setTickets(res.tickets);
        setTotalTickets(res.total);
        setCurrentPage(res.page);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [teamRes, assetRes, locRes, deptRes, techRes, filtersRes, sortPref] = await Promise.all([
        fetchITTeams(),
        fetchAssets(),
        fetchMasterLocations(),
        fetchMasterDepartments(),
        fetchActiveTechnicians(),
        fetchSavedFilters(),
        fetchSortingPreference(),
      ]);

      setItTeams(teamRes.teams || []);
      setAssets(assetRes.assets || []);
      setLocations(locRes.locations || []);
      setDepartments(deptRes.departments || []);
      setActiveTechnicians(techRes.technicians || []);
      setTeamTechnicians(techRes.technicians || []);
      setSavedFiltersList(filtersRes.savedFilters || []);

      let initialSortBy = sortBy;
      let initialSortOrder = sortOrder;
      if (sortPref && sortPref.sortBy) {
        initialSortBy = sortPref.sortBy;
        initialSortOrder = sortPref.sortOrder;
        setSortBy(sortPref.sortBy);
        setSortOrder(sortPref.sortOrder);
      }

      await loadTickets(1, null, { sortBy: initialSortBy, sortOrder: initialSortOrder });
    } catch (err: any) {
      showError(err.message || 'Failed to load tickets and master data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveRole]);

  const handleSortChange = async (newSortBy: string, newSortOrder?: 'asc' | 'desc') => {
    const finalOrder = newSortOrder || (sortBy === newSortBy ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortBy(newSortBy);
    setSortOrder(finalOrder);
    saveSortingPreference({ sortBy: newSortBy, sortOrder: finalOrder });
    await loadTickets(1, null, { sortBy: newSortBy, sortOrder: finalOrder });
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    await loadTickets(newPage);
  };

  const applySavedFilter = async (filter: SavedFilter) => {
    setActiveSavedFilterId(filter.id);
    const c = filter.criteria || {};
    setFilterKeyword(c.keyword || '');
    setFilterTicketNumber(c.ticketNumber || '');
    setFilterSubject(c.subject || '');
    setFilterEmployee(c.employee || '');
    setFilterDepartmentId(c.departmentId || 'ALL');
    setFilterCategory(c.category || 'ALL');
    setFilterPriority(c.priority || 'ALL');
    setFilterStatus(c.status || 'ALL');
    setFilterTechnicianId(c.technicianId || 'ALL');
    setFilterLocationId(c.locationId || 'ALL');
    setFilterDateField(c.dateField || 'createdAt');
    setFilterStartDate(c.startDate || '');
    setFilterEndDate(c.endDate || '');

    const customSort = filter.sortConfig
      ? { sortBy: filter.sortConfig.sortBy || 'updatedAt', sortOrder: (filter.sortConfig.sortOrder as 'asc' | 'desc') || 'desc' }
      : null;

    if (customSort) {
      setSortBy(customSort.sortBy);
      setSortOrder(customSort.sortOrder);
      saveSortingPreference(customSort);
    }

    await loadTickets(1, c, customSort);
    showSuccess(`Applied saved filter: "${filter.name}"`);
  };

  const handleSaveCurrentFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilterName.trim()) {
      showError('Filter preset name is required.');
      return;
    }
    setIsSavingFilter(true);
    try {
      const criteria: any = {};
      if (filterKeyword.trim()) criteria.keyword = filterKeyword.trim();
      if (filterTicketNumber.trim()) criteria.ticketNumber = filterTicketNumber.trim();
      if (filterSubject.trim()) criteria.subject = filterSubject.trim();
      if (filterEmployee.trim()) criteria.employee = filterEmployee.trim();
      if (filterDepartmentId !== 'ALL') criteria.departmentId = filterDepartmentId;
      if (filterCategory !== 'ALL') criteria.category = filterCategory;
      if (filterPriority !== 'ALL') criteria.priority = filterPriority;
      if (filterStatus !== 'ALL') criteria.status = filterStatus;
      if (filterTechnicianId !== 'ALL') criteria.technicianId = filterTechnicianId;
      if (filterLocationId !== 'ALL') criteria.locationId = filterLocationId;
      if (filterStartDate) criteria.startDate = filterStartDate;
      if (filterEndDate) criteria.endDate = filterEndDate;
      criteria.dateField = filterDateField;

      const sortConfig = { sortBy, sortOrder };

      const res = await createSavedFilter({
        name: newFilterName.trim(),
        criteria,
        sortConfig,
        isShared: isSuperAdmin && newFilterIsShared,
      });

      if (res.success && res.savedFilter) {
        setSavedFiltersList((prev) => [res.savedFilter!, ...prev]);
        setActiveSavedFilterId(res.savedFilter.id);
        setIsSaveFilterModalOpen(false);
        setNewFilterName('');
        setNewFilterIsShared(false);
        showSuccess(`Filter preset "${res.savedFilter.name}" saved.`);
      } else {
        showError(res.error || 'Failed to save filter preset.');
      }
    } catch (err: any) {
      showError(err.message || 'Error saving filter preset');
    } finally {
      setIsSavingFilter(false);
    }
  };

  const handleDeleteSavedFilter = (filterId: string, filterName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialogConfig({
      isOpen: true,
      title: 'Remove Saved Filter',
      message: `Are you sure you want to remove saved filter "${filterName}"?`,
      confirmText: 'Remove Filter',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialogConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await deleteSavedFilter(filterId);
          if (res.success) {
            setSavedFiltersList((prev) => prev.filter((f) => f.id !== filterId));
            if (activeSavedFilterId === filterId) {
              setActiveSavedFilterId(null);
            }
            showSuccess(`Saved filter "${filterName}" deleted.`);
          } else {
            showError(res.error || 'Failed to delete filter.');
          }
        } catch (err: any) {
          showError(err.message || 'Error deleting filter');
        }
      },
    });
  };

  const handleResetFilters = async () => {
    setActiveSavedFilterId(null);
    setFilterKeyword('');
    setFilterTicketNumber('');
    setFilterSubject('');
    setFilterEmployee('');
    setFilterDepartmentId('ALL');
    setFilterCategory('ALL');
    setFilterPriority('ALL');
    setFilterStatus('ALL');
    setFilterTechnicianId('ALL');
    setFilterLocationId('ALL');
    setFilterStartDate('');
    setFilterEndDate('');
    await loadTickets(1, {
      keyword: '',
      ticketNumber: '',
      subject: '',
      employee: '',
      departmentId: 'ALL',
      category: 'ALL',
      priority: 'ALL',
      status: 'ALL',
      technicianId: 'ALL',
      locationId: 'ALL',
      dateField: 'createdAt',
      startDate: '',
      endDate: '',
    });
  };

  // Pre-fill contact number and location when user opens create modal
  const openCreateModal = async () => {
    setNewTitle('');
    setNewDescription('');
    setNewCategory('HARDWARE');
    setNewPriority('MEDIUM');
    setNewLocationId(profile?.locationId || user?.locationId || (locations[0]?.id || ''));
    setNewContactNumber(profile?.mobileNumber || user?.mobileNumber || '');
    setNewAssignedTeamId(profile?.itTeamId || '');
    setNewTechnicianId('');
    setNewAttachmentFile(null);
    setAssetOverrideReason('');
    setOverrideReasonError(null);
    setIsChangingAsset(false);
    setIsCreateModalOpen(true);
    setIsLoadingAssetOptions(true);

    try {
      const res = await fetchTicketSelectableAssets();
      setAssignedComputer(res.myAsset || null);
      setSelectableAssets(res.otherAssets || []);

      if (res.myAsset) {
        setSelectedAssetId(res.myAsset.id);
        setNewAssetTag(res.myAsset.assetTag);
      } else {
        setSelectedAssetId('');
        setNewAssetTag('');
      }
    } catch (err) {
      console.error('Error fetching ticket equipment options:', err);
    } finally {
      setIsLoadingAssetOptions(false);
    }
  };

  // Load ticket details when selected
  const loadSelectedTicketDetails = async (id: string) => {
    setIsDetailLoading(true);
    const res = await fetchTicketById(id);
    if (res.error) {
      showError(res.error);
    } else {
      setSelectedTicket(res.ticket || null);
      setTicketComments(res.comments || []);
      setTicketAttachments(res.attachments || []);
      setTicketHistory(res.history || []);
    }
    setIsDetailLoading(false);
  };

  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicket(null);
      setTicketComments([]);
      setTicketAttachments([]);
      setTicketHistory([]);
      return;
    }
    loadSelectedTicketDetails(selectedTicketId);
  }, [selectedTicketId]);

  // Handle file select for ticket creation attachment
  const handleAttachmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
      showError(
        `File extension .${ext} is not allowed. Permitted: Images (JPG, PNG, GIF), Documents (PDF, DOC/DOCX, XLS/XLSX, TXT), Diagnostic (ZIP).`
      );
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('Attachment exceeds the 10MB limit. Please choose a smaller file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setNewAttachmentFile({
        originalFileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileData: result,
        fileSizeBytes: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  // Handle file upload directly inside detail pane
  const handleDetailAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTicket) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
      showError(
        `File extension .${ext} is not allowed. Permitted: Images (JPG, PNG, GIF), Documents (PDF, DOC/DOCX, XLS/XLSX, TXT), Diagnostic (ZIP).`
      );
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('Attachment exceeds maximum 10MB limit.');
      e.target.value = '';
      return;
    }

    setIsUploadingDetailAttachment(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = reader.result as string;
        const res = await uploadTicketAttachment(selectedTicket.id, {
          originalFileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileData: result,
        });

        if (res.success && res.attachment) {
          setTicketAttachments((prev) => [...prev, res.attachment!]);
          showSuccess(`Attachment "${file.name}" uploaded successfully.`);
          await loadSelectedTicketDetails(selectedTicket.id);
        } else {
          showError(res.error || 'Failed to upload attachment.');
        }
      } catch (err: any) {
        showError(err.message || 'Error uploading file.');
      } finally {
        setIsUploadingDetailAttachment(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle delete attachment
  const handleDeleteAttachment = (attId: string, fileName: string) => {
    if (!selectedTicket) return;
    setConfirmDialogConfig({
      isOpen: true,
      title: 'Remove Attachment',
      message: `Are you sure you want to remove attachment "${fileName}"? This will detach the file from the ticket.`,
      confirmText: 'Remove Attachment',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialogConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await deleteTicketAttachment(selectedTicket.id, attId);
          if (res.success) {
            setTicketAttachments((prev) => prev.filter((a) => a.id !== attId));
            showSuccess(`Attachment "${fileName}" removed.`);
            await loadSelectedTicketDetails(selectedTicket.id);
          } else {
            showError(res.error || 'Failed to delete attachment.');
          }
        } catch (err: any) {
          showError(err.message || 'Error deleting attachment.');
        }
      },
    });
  };

  // Handle create ticket submit
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showError('Problem / Subject is mandatory (maximum 150 characters).');
      return;
    }
    if (newTitle.trim().length > 150) {
      showError('Problem / Subject cannot exceed 150 characters.');
      return;
    }
    if (!newDescription.trim()) {
      showError('Description is mandatory (maximum 2,000 characters).');
      return;
    }
    if (newDescription.trim().length > 2000) {
      showError('Description cannot exceed 2,000 characters.');
      return;
    }

    // Validate exception rule for employee linking non-assigned asset
    const isNonAssigned =
      isEmployee &&
      selectedAssetId &&
      selectedAssetId !== 'NONE' &&
      (!assignedComputer || selectedAssetId !== assignedComputer.id);

    if (isNonAssigned && !assetOverrideReason.trim()) {
      setOverrideReasonError(
        'Mandatory justification required: You are reporting an issue for equipment not currently assigned to you. Please provide a clear explanation.'
      );
      showError('Mandatory justification required: Please provide an explicit reason for reporting on non-assigned equipment.');
      return;
    }

    setIsSubmittingTicket(true);
    setOverrideReasonError(null);
    try {
      const selectedLoc = locations.find((l) => l.id === newLocationId);

      const res = await createTicket({
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory,
        priority: newPriority,
        contactNumber: newContactNumber.trim() || undefined,
        locationId: newLocationId || undefined,
        locationName: selectedLoc?.name || undefined,
        assignedTeamId: newAssignedTeamId || undefined,
        assignedTechnicianId: newTechnicianId || undefined,
        relatedAssetId: selectedAssetId === 'NONE' ? undefined : selectedAssetId || undefined,
        relatedAssetTag: newAssetTag.trim() || undefined,
        assetOverrideReason: isNonAssigned ? assetOverrideReason.trim() : undefined,
        attachment: newAttachmentFile
          ? {
              originalFileName: newAttachmentFile.originalFileName,
              mimeType: newAttachmentFile.mimeType,
              fileData: newAttachmentFile.fileData,
            }
          : undefined,
      });

      if (res.success && res.ticket) {
        showSuccess(`Ticket ${res.ticket.ticketNumber} created successfully.`);
        setIsCreateModalOpen(false);
        await loadData();
        setSelectedTicketId(res.ticket.id);
      } else {
        if (res.requiresOverrideReason) {
          setOverrideReasonError(res.error || 'Mandatory reason required for non-assigned equipment.');
        }
        showError(res.error || 'Failed to create ticket.');
      }
    } catch (err: any) {
      showError(err.message || 'Error creating ticket');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // Open Edit Modal
  const openEditModal = async () => {
    if (!selectedTicket) return;
    setEditTitle(selectedTicket.title);
    setEditDescription(selectedTicket.description);
    setEditCategory(selectedTicket.category);
    setEditLocationId(selectedTicket.locationId || selectedTicket.requesterLocationId || '');
    setEditContactNumber(selectedTicket.contactNumber || '');
    setEditAssetTag(selectedTicket.relatedAssetTag || '');
    setEditAssetId(selectedTicket.relatedAssetId || '');

    if (!isEmployee) {
      try {
        const res = await fetchTicketSelectableAssets();
        setSelectableAssets(res.otherAssets || []);
      } catch (err) {
        console.error('Error fetching selectable assets for edit modal:', err);
      }
    }
    setIsEditModalOpen(true);
  };

  // Quick Action for IT Staff: Re-link / Reassign Equipment
  const openChangeAssetModal = async () => {
    if (!selectedTicket) return;
    setChangeAssetSelectedId(selectedTicket.relatedAssetId || 'NONE');
    setChangeAssetNotes('');
    setIsChangeAssetModalOpen(true);
    try {
      const res = await fetchTicketSelectableAssets();
      setSelectableAssets(res.otherAssets || []);
    } catch (err) {
      console.error('Error fetching assets for change asset modal:', err);
    }
  };

  const handleChangeAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setIsSubmittingAssetChange(true);
    try {
      const targetAssetId = changeAssetSelectedId === 'NONE' ? null : changeAssetSelectedId || null;
      const res = await updateTicketLinkedAsset(
        selectedTicket.id,
        targetAssetId,
        changeAssetNotes.trim() || undefined
      );

      if (res.success && res.ticket) {
        setSelectedTicket(res.ticket);
        showSuccess(`Linked equipment updated for Ticket ${res.ticket.ticketNumber}.`);
        setIsChangeAssetModalOpen(false);
        await loadData();
        await loadSelectedTicketDetails(selectedTicket.id);
      } else {
        showError(res.error || 'Failed to update linked equipment.');
      }
    } catch (err: any) {
      showError(err.message || 'Error updating linked equipment');
    } finally {
      setIsSubmittingAssetChange(false);
    }
  };

  // Submit Edit Ticket
  const handleEditTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (!editTitle.trim() || editTitle.trim().length > 150) {
      showError('Subject is required and must be at most 150 characters.');
      return;
    }
    if (!editDescription.trim() || editDescription.trim().length > 2000) {
      showError('Description is required and must be at most 2,000 characters.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      // Employees cannot change linked asset. IT staff can pass editAssetId
      const payload: any = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        contactNumber: editContactNumber.trim(),
        locationId: editLocationId,
      };

      if (!isEmployee) {
        payload.relatedAssetId = editAssetId === 'NONE' ? '' : editAssetId;
      }

      const res = await editTicket(selectedTicket.id, payload);

      if (res.success && res.ticket) {
        setSelectedTicket(res.ticket);
        showSuccess(`Ticket ${res.ticket.ticketNumber} updated successfully.`);
        setIsEditModalOpen(false);
        await loadData();
        await loadSelectedTicketDetails(selectedTicket.id);
      } else {
        showError(res.error || 'Failed to update ticket.');
      }
    } catch (err: any) {
      showError(err.message || 'Error updating ticket');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Submit Cancel Ticket
  const handleCancelTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setIsSubmittingCancel(true);
    try {
      const res = await cancelTicket(selectedTicket.id, cancelReason.trim());
      if (res.success && res.ticket) {
        setSelectedTicket(res.ticket);
        showSuccess(`Ticket ${res.ticket.ticketNumber} cancelled. Retained permanently as historical record.`);
        setIsCancelModalOpen(false);
        setCancelReason('');
        await loadData();
        await loadSelectedTicketDetails(selectedTicket.id);
      } else {
        showError(res.error || 'Failed to cancel ticket.');
      }
    } catch (err: any) {
      showError(err.message || 'Error cancelling ticket');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Handle Technician Taking Unassigned Ticket
  const handleTakeTicket = async () => {
    if (!selectedTicket) return;
    try {
      const res = await takeTicket(selectedTicket.id);
      if (res.success && res.ticket) {
        setSelectedTicket(res.ticket);
        showSuccess(`Ticket taken! Status changed from NEW to ASSIGNED to you.`);
        await loadData();
        await loadSelectedTicketDetails(selectedTicket.id);
      } else {
        showError(res.error || 'Failed to take ticket.');
      }
    } catch (err: any) {
      showError(err.message || 'Error taking ticket.');
    }
  };

  // Handle status update
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket) return;
    try {
      const res = await updateTicketStatus(selectedTicket.id, newStatus);
      if (res.success && res.ticket) {
        setSelectedTicket(res.ticket);
        showSuccess(`Status changed to ${newStatus}`);
        await loadData();
        await loadSelectedTicketDetails(selectedTicket.id);
      } else {
        showError(res.error || 'Failed to change status.');
      }
    } catch (err: any) {
      showError(err.message || 'Status transition error');
    }
  };

  // Handle priority update
  const handlePriorityChange = async (newPriority: string) => {
    if (!selectedTicket) return;
    try {
      const res = await updateTicketPriority(selectedTicket.id, newPriority);
      if (res.success && res.ticket) {
        setSelectedTicket(res.ticket);
        showSuccess(`Priority updated to ${newPriority}`);
        await loadData();
        await loadSelectedTicketDetails(selectedTicket.id);
      } else {
        showError(res.error || 'Failed to change priority.');
      }
    } catch (err: any) {
      showError(err.message || 'Priority update error');
    }
  };

  // Handle assignment (standard or administrative correction)
  const handleAssign = async (technicianId: string | null, isCorrection = false) => {
    if (!selectedTicket) return;
    try {
      const res = await assignTicket(selectedTicket.id, technicianId, isCorrection);
      if (res.success && res.ticket) {
        setSelectedTicket(res.ticket);
        setIsAdministrativeCorrectionMode(false);
        showSuccess(
          isCorrection
            ? `Administrative Correction: Reassigned to ${res.ticket.assignedTechnicianName || 'Unassigned'} (Audited)`
            : `Assigned to ${res.ticket.assignedTechnicianName || 'Unassigned'}`
        );
        await loadTickets(currentPage);
        await loadSelectedTicketDetails(selectedTicket.id);
      } else {
        showError(res.error || 'Failed to assign ticket.');
      }
    } catch (err: any) {
      showError(err.message || 'Assignment error');
    }
  };

  // Handle comment submit
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !commentContent.trim()) return;

    setIsPostingComment(true);
    try {
      const res = await addTicketComment(selectedTicket.id, commentContent.trim(), isInternalComment);
      if (res.success && res.comment) {
        setTicketComments((prev) => [...prev, res.comment!]);
        setCommentContent('');
        setIsInternalComment(false);
        showSuccess('Comment added to ticket thread.');
        await loadSelectedTicketDetails(selectedTicket.id);
      } else {
        showError(res.error || 'Failed to post comment.');
      }
    } catch (err: any) {
      showError(err.message || 'Comment error');
    } finally {
      setIsPostingComment(false);
    }
  };

  const getSlaBadge = (slaStatus?: 'BREACHED' | 'WARNING' | 'ON_TRACK' | 'MET') => {
    switch (slaStatus) {
      case 'BREACHED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            SLA BREACHED
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            SLA WARNING
          </span>
        );
      case 'ON_TRACK':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            SLA ON TRACK
          </span>
        );
      case 'MET':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            SLA MET
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
      case 'URGENT':
        return <Badge variant="danger">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge variant="warning">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge variant="info">MEDIUM</Badge>;
      default:
        return <Badge variant="neutral">LOW</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <Badge variant="success">RESOLVED</Badge>;
      case 'CLOSED':
        return <Badge variant="neutral">CLOSED</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="purple">IN PROGRESS</Badge>;
      case 'WAITING_FOR_USER':
        return <Badge variant="warning">WAITING FOR USER</Badge>;
      case 'ASSIGNED':
        return <Badge variant="info">ASSIGNED</Badge>;
      case 'NEW':
        return <Badge variant="warning">NEW</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">CANCELLED</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Check if employee can edit / cancel: only while status is NEW or ASSIGNED
  const canEmployeeEditOrCancel =
    selectedTicket &&
    (selectedTicket.status === 'NEW' || selectedTicket.status === 'ASSIGNED') &&
    (isEmployee ? selectedTicket.requesterId === user?.id : true);

  // Workflow steps for status visualizer
  const workflowSteps = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'];

  return (
    <div className="space-y-6">
      {/* Header & RBAC Scope Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              IT Support Helpdesk
            </h2>
            <Badge variant={isEmployee ? 'neutral' : isTechnician ? 'warning' : isITAdmin ? 'info' : 'purple'}>
              {effectiveRole} SCOPE
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isEmployee && 'Create and track support tickets. Edit/cancel while New or Assigned. Active commenting enabled.'}
            {isTechnician && 'Assigned team queue. Take unassigned tickets, advance workflow status, resolve, and close tickets.'}
            {isITAdmin && 'Full ticket queue management within your IT Team. Dispatch technicians and monitor SLAs.'}
            {isSuperAdmin && 'Organization-wide ticket oversight across all companies, locations, and IT Teams.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            icon={RefreshCw}
            disabled={isLoading}
            className="text-xs font-semibold rounded-xl"
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            icon={Plus}
            className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-xs"
          >
            Create Ticket
          </Button>
        </div>
      </div>

      {/* Scope Alert Badge for Technicians / Admins */}
      {(isTechnician || isITAdmin) && profile?.itTeamId && (
        <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              <strong>Active IT Team Scope:</strong> You belong to{' '}
              <span className="underline font-bold">{profile.itTeamName || profile.itTeamId}</span>. All operations are strictly authorized within this boundary.
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 rounded-md font-bold">
            Team Scoped
          </span>
        </div>
      )}

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Saved Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 shrink-0">
            <Bookmark className="w-4 h-4 text-indigo-500" />
            <span>Saved Views:</span>
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className={`px-3 py-1 rounded-xl font-semibold transition-all shrink-0 ${
              activeSavedFilterId === null && activeFiltersCount === 0 && !filterKeyword
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All Tickets
          </button>

          {savedFiltersList.map((sf) => {
            const isActive = activeSavedFilterId === sf.id;
            const canDelete = isSuperAdmin || sf.createdByUserId === user?.id;

            return (
              <div
                key={sf.id}
                onClick={() => applySavedFilter(sf)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                {sf.isShared ? (
                  <Share2 className="w-3 h-3 text-indigo-500" title="Shared with Organization" />
                ) : (
                  <Bookmark className="w-3 h-3 text-slate-400" />
                )}
                <span>{sf.name}</span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSavedFilter(sf.id, sf.name, e)}
                    className="p-0.5 hover:text-rose-500 rounded-md transition-colors"
                    title="Delete saved filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setNewFilterName('');
            setNewFilterIsShared(false);
            setIsSaveFilterModalOpen(true);
          }}
          icon={BookmarkCheck}
          className="rounded-xl text-xs py-1 px-3 shrink-0"
        >
          Save Current Filter
        </Button>
      </div>

      {/* Main Search & Filter Control Bar */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="relative md:col-span-4">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search across ticket #, subject, requester, tags..."
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadTickets(1);
                }
              }}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            />
            {filterKeyword && (
              <button
                onClick={() => {
                  setFilterKeyword('');
                  loadTickets(1, { keyword: '' });
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Status Dropdown */}
          <div className="md:col-span-2">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                loadTickets(1, { status: e.target.value });
              }}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">NEW</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="WAITING_FOR_USER">WAITING FOR USER</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          {/* Quick Priority Dropdown */}
          <div className="md:col-span-2">
            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                loadTickets(1, { priority: e.target.value });
              }}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="updatedAt">Sort: Last Updated</option>
              <option value="createdAt">Sort: Created Date</option>
              <option value="priority">Sort: Priority</option>
              <option value="status">Sort: Status</option>
              <option value="slaStatus">Sort: SLA Status</option>
              <option value="ticketNumber">Sort: Ticket Number</option>
              <option value="assignedTechnicianName">Sort: Technician</option>
            </select>
          </div>

          {/* Sort Direction Toggle & Advanced Toggle */}
          <div className="md:col-span-2 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
              icon={ArrowUpDown}
              className="px-2.5 py-2 rounded-xl text-xs shrink-0"
              title={`Sort order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
            >
              {sortOrder.toUpperCase()}
            </Button>

            <Button
              type="button"
              variant={isAdvancedFiltersOpen || activeFiltersCount > 0 ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
              icon={SlidersHorizontal}
              className={`flex-1 rounded-xl text-xs py-2 font-semibold ${
                isAdvancedFiltersOpen || activeFiltersCount > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : ''
              }`}
            >
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              {isAdvancedFiltersOpen ? (
                <ChevronUp className="w-3.5 h-3.5 ml-1" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Collapsible Advanced Search Panel */}
        {isAdvancedFiltersOpen && (
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                Advanced Multi-Field Search & Filter Criteria
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Reset All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Ticket Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. TCK-10001"
                  value={filterTicketNumber}
                  onChange={(e) => setFilterTicketNumber(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Subject / Title
                </label>
                <input
                  type="text"
                  placeholder="Subject contains..."
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Employee / Requester
                </label>
                <input
                  type="text"
                  placeholder="Name, email, or ID..."
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Department
                </label>
                <select
                  value={filterDepartmentId}
                  onChange={(e) => setFilterDepartmentId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  <option value="ALL">All Departments</option>
                  {(departments || [])
                    .filter((d) => !d.isArchived)
                    .map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  <option value="ALL">All Categories</option>
                  <option value="HARDWARE">Hardware & Peripherals</option>
                  <option value="SOFTWARE">Software & Applications</option>
                  <option value="NETWORK">Network & Connectivity</option>
                  <option value="ACCESS">Access & Authentication</option>
                  <option value="EMAIL">Email & Collaboration</option>
                  <option value="TELEPHONY">Telephony & VoIP</option>
                  <option value="OTHER">Other Technical Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Assigned Technician
                </label>
                <select
                  value={filterTechnicianId}
                  onChange={(e) => setFilterTechnicianId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  <option value="ALL">All Technicians</option>
                  <option value="UNASSIGNED">-- Unassigned Only --</option>
                  {activeTechnicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName} ({t.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Location
                </label>
                <select
                  value={filterLocationId}
                  onChange={(e) => setFilterLocationId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  <option value="ALL">All Locations</option>
                  {(locations || [])
                    .filter((l) => !l.isArchived)
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.city})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Date Range Target
                </label>
                <select
                  value={filterDateField}
                  onChange={(e) => setFilterDateField(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  <option value="createdAt">Created Date</option>
                  <option value="updatedAt">Last Updated Date</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="rounded-xl text-xs"
              >
                Clear Filters
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => loadTickets(1)}
                icon={Search}
                className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700"
              >
                Apply Criteria & Search
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area: Split View when Ticket is Selected */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ticket List Table/Cards */}
        <div className={selectedTicketId ? 'lg:col-span-6 space-y-3' : 'lg:col-span-12 space-y-3'}>
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              <p className="text-xs">Loading authorized tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Ticket className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Tickets Found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isEmployee
                  ? "You haven't submitted any tickets matching the current criteria. Click 'Create Ticket' to request IT assistance."
                  : 'No tickets match your search parameters or permitted IT team boundary.'}
              </p>
              {(activeFiltersCount > 0 || filterKeyword) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="rounded-xl text-xs"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {tickets.map((t) => {
                const isSelected = selectedTicketId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                            {t.ticketNumber}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            &bull; {t.category}
                          </span>
                          {t.locationName && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {t.locationName}
                            </span>
                          )}
                          {getSlaBadge(t.slaStatus)}
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1 leading-snug">
                          {t.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {getPriorityBadge(t.priority)}
                        {getStatusBadge(t.status)}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {t.requesterName}
                        </span>
                        {t.relatedAssetTag && (
                          <span className="flex items-center gap-1 font-mono text-indigo-500">
                            <Laptop className="w-3 h-3" />
                            {t.relatedAssetTag}
                          </span>
                        )}
                        {t.assignedTechnicianName ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <UserCheck className="w-3 h-3" />
                            {t.assignedTechnicianName}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                            <AlertCircle className="w-3 h-3" />
                            Unassigned
                          </span>
                        )}
                      </div>

                      <span className="flex items-center gap-1 text-[10px]">
                        <Clock className="w-3 h-3" />
                        {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Pagination Bar (10 per page) */}
              {totalTickets > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <div>
                    Showing{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {(currentPage - 1) * 10 + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {Math.min(currentPage * 10, totalTickets)}
                    </span>{' '}
                    of{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {totalTickets}
                    </span>{' '}
                    tickets
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1 || isLoading}
                      onClick={() => handlePageChange(currentPage - 1)}
                      icon={ChevronLeft}
                      className="rounded-xl text-xs py-1 px-2.5"
                    >
                      Previous
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, idx, arr) => {
                          const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                          return (
                            <React.Fragment key={p}>
                              {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                              <button
                                onClick={() => handlePageChange(p)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                                  currentPage === p
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {p}
                              </button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages || isLoading}
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="rounded-xl text-xs py-1 px-2.5"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ticket Detail & Workflow Drawer */}
        {selectedTicketId && (
          <div className="lg:col-span-6 space-y-4">
            {isDetailLoading ? (
              <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                <p className="text-xs">Loading ticket details...</p>
              </div>
            ) : selectedTicket ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-xs">
                {/* Header with Title & Action Controls */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {selectedTicket.ticketNumber}
                      </span>
                      {getPriorityBadge(selectedTicket.priority)}
                      {getStatusBadge(selectedTicket.status)}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {selectedTicket.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Employee or Staff can Edit when New or Assigned */}
                    {canEmployeeEditOrCancel && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openEditModal}
                          icon={Edit3}
                          className="text-[11px] py-1 px-2.5 font-semibold rounded-xl"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCancelModalOpen(true)}
                          icon={XCircle}
                          className="text-[11px] py-1 px-2.5 font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                        >
                          Cancel
                        </Button>
                      </>
                    )}

                    <button
                      onClick={() => setSelectedTicketId(null)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* Status Visualizer: New -> Assigned -> In Progress -> Waiting for User -> Resolved -> Closed */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Workflow Lifecycle:
                  </span>
                  <div className="flex items-center justify-between text-[11px] overflow-x-auto pb-1 gap-1">
                    {workflowSteps.map((step, idx) => {
                      const isCurrent = selectedTicket.status === step;
                      const isPast =
                        workflowSteps.indexOf(selectedTicket.status) > idx ||
                        selectedTicket.status === 'CLOSED';
                      const isCancelled = selectedTicket.status === 'CANCELLED';

                      return (
                        <div key={step} className="flex items-center gap-1 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              isCancelled
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                : isCurrent
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : isPast
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-200/70 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            {step.replace(/_/g, ' ')}
                          </span>
                          {idx < workflowSteps.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {selectedTicket.status === 'CANCELLED' && (
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200">
                      <strong>Cancelled Ticket:</strong> Retained permanently as historical record.
                      {selectedTicket.cancellationReason && (
                        <span className="block mt-0.5 text-[11px] text-rose-700 dark:text-rose-300">
                          Reason: {selectedTicket.cancellationReason}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50/70 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Requester</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedTicket.requesterName}
                    </span>
                    <span className="block text-[10px] text-slate-400">{selectedTicket.requesterEmail}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Contact Number</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-indigo-500" />
                      {selectedTicket.contactNumber || 'Not specified'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Location</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-indigo-500" />
                      {selectedTicket.locationName || 'Main Office'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Linked Computer</span>
                    <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Laptop className="w-3 h-3" />
                      {selectedTicket.relatedAssetTag || 'None'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Team</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedTicket.assignedTeamName || 'Unassigned'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">IT Technician</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      {selectedTicket.assignedTechnicianName || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Linked IT Equipment & Relationship Context */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Linked IT Equipment</span>
                    </span>

                    {/* Quick Action: Re-link / Change Asset for IT Staff */}
                    {!isEmployee && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={openChangeAssetModal}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 h-7 px-2"
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        {selectedTicket.relatedAssetId ? 'Reassign Equipment' : 'Link Equipment'}
                      </Button>
                    )}
                  </div>

                  {selectedTicket.relatedAssetId || selectedTicket.relatedAssetTag ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-md border border-indigo-200 dark:border-indigo-900/60">
                            {selectedTicket.relatedAssetTag}
                          </span>
                          {selectedTicket.relatedAssetName && (
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {selectedTicket.relatedAssetName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Historical Employee Assignment Snapshot */}
                      {selectedTicket.historicalAssetAssignment && (
                        <div className="p-2 bg-white dark:bg-slate-900/70 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>
                            Assigned to{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {selectedTicket.historicalAssetAssignment.assignedUserName}
                            </strong>{' '}
                            when ticket was opened
                            {selectedTicket.historicalAssetAssignment.assignedDepartmentName
                              ? ` (${selectedTicket.historicalAssetAssignment.assignedDepartmentName})`
                              : ''}
                          </span>
                        </div>
                      )}

                      {/* Exception Non-Assigned Asset Override Justification */}
                      {selectedTicket.assetOverrideReason && (
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block text-[11px]">
                              Non-Assigned Equipment Exception
                            </span>
                            <span className="text-[11px] text-amber-800 dark:text-amber-300">
                              Justification: "{selectedTicket.assetOverrideReason}"
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic py-1 flex items-center justify-between">
                      <span>No computer equipment currently linked to this ticket.</span>
                      {isEmployee && (
                        <span className="text-[10px] text-slate-400 not-italic">
                          (General or Software Request)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Ticket Description */}
                <div>
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Problem / Description
                  </h5>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.description}
                  </div>
                </div>

                {/* Authorized Actions / Workflow Control */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                  <h5 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Workflow & State Management</span>
                    {isEmployee && (
                      <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Status transitions restricted to IT staff
                      </span>
                    )}
                  </h5>

                  {/* Technician "Take Ticket" Button: Unassigned Ticket within permitted team -> Assigns to Self and changes New -> Assigned */}
                  {isTechnician &&
                    !selectedTicket.assignedTechnicianId &&
                    (isSuperAdmin || profile?.itTeamId === selectedTicket.assignedTeamId) &&
                    selectedTicket.status !== 'CLOSED' &&
                    selectedTicket.status !== 'RESOLVED' &&
                    selectedTicket.status !== 'CANCELLED' && (
                      <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between gap-2">
                        <div className="text-xs text-indigo-900 dark:text-indigo-200">
                          <span className="font-bold block">Unassigned Team Ticket</span>
                          <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                            Take ownership to assign this ticket to yourself and advance status from New to Assigned.
                          </span>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleTakeTicket}
                          icon={UserCheck}
                          className="text-xs font-semibold py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl shrink-0 shadow-xs"
                        >
                          Take Ownership
                        </Button>
                      </div>
                    )}

                  {/* Technician, IT Admin & Super Admin Action Controls */}
                  {!isEmployee && selectedTicket.status !== 'CANCELLED' ? (
                    <div className="space-y-3">
                      {/* Workflow Status Buttons: Assigned, In Progress, Waiting for User, Resolved, Closed */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          Change Status:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {['ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'].map((st) => (
                            <button
                              key={st}
                              disabled={selectedTicket.status === st}
                              onClick={() => handleStatusChange(st)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                selectedTicket.status === st
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {st.replace(/_/g, ' ')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Official Priority Review & Change (Audited) */}
                      <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-500">
                            Review / Change Official Priority:
                          </span>
                          <span className="text-[10px] text-slate-400">
                            (Audited)
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((pr) => (
                            <button
                              key={pr}
                              disabled={selectedTicket.priority === pr}
                              onClick={() => handlePriorityChange(pr)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                selectedTicket.priority === pr
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {pr}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Technician Assignment & Administrative Correction */}
                      {(isITAdmin || isSuperAdmin || isTechnician) && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-500">
                              Primary Technician Assignment:
                            </span>
                            {['RESOLVED', 'CLOSED'].includes(selectedTicket.status) ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold">
                                  <Lock className="w-3 h-3" /> Locked
                                </span>
                                {(isSuperAdmin || (isITAdmin && profile?.itTeamId === selectedTicket.assignedTeamId)) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsAdministrativeCorrectionMode(!isAdministrativeCorrectionMode);
                                      setAdminCorrectionTechId(selectedTicket.assignedTechnicianId || '');
                                    }}
                                    className="text-[10px] font-bold text-amber-600 dark:text-amber-400 underline hover:text-amber-700"
                                  >
                                    {isAdministrativeCorrectionMode ? 'Cancel Correction' : 'Admin Correction'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                Exactly one primary technician
                              </span>
                            )}
                          </div>

                          {!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedTicket.assignedTechnicianId || ''}
                                onChange={(e) => handleAssign(e.target.value || null)}
                                className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                              >
                                <option value="">-- Unassigned --</option>
                                {(activeTechnicians || [])
                                  .filter((tech) => isSuperAdmin || tech.itTeamId === selectedTicket.assignedTeamId)
                                  .map((tech) => (
                                    <option key={tech.id} value={tech.id}>
                                      {tech.displayName} ({tech.role})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          ) : isAdministrativeCorrectionMode ? (
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl space-y-2">
                              <div className="flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-200 font-bold">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>Administrative Correction (Resolved/Closed Ticket)</span>
                              </div>
                              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-normal">
                                You are performing an administrative correction on a resolved or closed ticket. This operation is permanently recorded in the audit trail.
                              </p>
                              <div className="flex items-center gap-2">
                                <select
                                  value={adminCorrectionTechId}
                                  onChange={(e) => setAdminCorrectionTechId(e.target.value)}
                                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-amber-300 text-slate-800 dark:text-slate-200 font-medium"
                                >
                                  <option value="">-- Unassigned --</option>
                                  {(activeTechnicians || [])
                                    .filter((tech) => isSuperAdmin || tech.itTeamId === selectedTicket.assignedTeamId)
                                    .map((tech) => (
                                      <option key={tech.id} value={tech.id}>
                                        {tech.displayName} ({tech.role})
                                      </option>
                                    ))}
                                </select>
                                <Button
                                  size="sm"
                                  variant="warning"
                                  onClick={() => handleAssign(adminCorrectionTechId || null, true)}
                                  className="text-xs font-bold rounded-lg py-1.5 shrink-0"
                                >
                                  Save Correction
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400">
                              Ticket is resolved/closed. Technician assignment is locked to maintain historical integrity.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : isEmployee ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Primary IT Technician:
                        </span>
                        {selectedTicket.status === 'NEW' || selectedTicket.status === 'ASSIGNED' ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                            Editable by Requester (New/Assigned)
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                      </div>

                      {selectedTicket.status === 'NEW' || selectedTicket.status === 'ASSIGNED' ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedTicket.assignedTechnicianId || ''}
                            onChange={(e) => handleAssign(e.target.value || null)}
                            className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          >
                            <option value="">-- Unassigned (Auto-Route) --</option>
                            {(activeTechnicians || [])
                              .filter((tech) => !selectedTicket.assignedTeamId || tech.itTeamId === selectedTicket.assignedTeamId)
                              .map((tech) => (
                                <option key={tech.id} value={tech.id}>
                                  {tech.displayName} ({tech.role})
                                </option>
                              ))}
                          </select>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Technician assignment is locked once work has progressed past Assigned status.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Tabs for Details: Discussion, Attachments, History */}
                <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs font-bold">
                  <button
                    onClick={() => setActiveDetailTab('discussion')}
                    className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
                      activeDetailTab === 'discussion'
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Discussion ({ticketComments.length})
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('attachments')}
                    className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
                      activeDetailTab === 'attachments'
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Paperclip className="w-4 h-4" />
                    Attachments ({ticketAttachments.length})
                  </button>

                  <button
                    onClick={() => setActiveDetailTab('history')}
                    className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
                      activeDetailTab === 'history'
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <History className="w-4 h-4" />
                    Audit History ({ticketHistory.length})
                  </button>
                </div>

                {/* Tab Content */}
                {activeDetailTab === 'discussion' && (
                  <div className="space-y-3">
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {ticketComments.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">
                          No comments posted yet.
                        </p>
                      ) : (
                        ticketComments.map((cmt) => (
                          <div
                            key={cmt.id}
                            className={`p-3 rounded-2xl text-xs space-y-1.5 ${
                              cmt.isInternalOnly
                                ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                                : cmt.authorId === user?.id
                                ? 'bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 ml-4'
                                : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 mr-4'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold">{cmt.authorName}</span>
                                <span className="opacity-75">({cmt.authorRole})</span>
                                {cmt.isInternalOnly && (
                                  <span className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 px-1.5 py-0.2 rounded font-bold">
                                    Internal Tech Note
                                  </span>
                                )}
                              </div>
                              <span className="opacity-60">{new Date(cmt.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="text-xs">
                              {renderFormattedComment(cmt.content)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Comment Input */}
                    {selectedTicket.status !== 'RESOLVED' &&
                    selectedTicket.status !== 'CLOSED' &&
                    selectedTicket.status !== 'CANCELLED' ? (
                      <form onSubmit={handlePostComment} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                          {/* Formatting Toolbar */}
                          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 px-2 py-1 text-slate-600 dark:text-slate-300">
                            <button
                              type="button"
                              onClick={() => insertFormatting('bold')}
                              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                              title="Bold (**text**)"
                            >
                              <Bold className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormatting('italic')}
                              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                              title="Italic (*text*)"
                            >
                              <Italic className="w-3.5 h-3.5" />
                            </button>
                            <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-600 mx-0.5" />
                            <button
                              type="button"
                              onClick={() => insertFormatting('bullet')}
                              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                              title="Bullet List (- item)"
                            >
                              <List className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormatting('numbered')}
                              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                              title="Numbered List (1. item)"
                            >
                              <ListOrdered className="w-3.5 h-3.5" />
                            </button>
                            <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-600 mx-0.5" />
                            <button
                              type="button"
                              onClick={() => insertFormatting('link')}
                              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                              title="Link ([title](url))"
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                            </button>

                            <div className="ml-auto text-[10px] font-mono">
                              <span
                                className={
                                  commentContent.length > 1800
                                    ? 'text-rose-500 font-bold'
                                    : 'text-slate-400'
                                }
                              >
                                {2000 - commentContent.length} / 2,000 left
                              </span>
                            </div>
                          </div>

                          <textarea
                            id="ticket-comment-textarea"
                            rows={3}
                            maxLength={2000}
                            placeholder={
                              isInternalComment
                                ? 'Add internal troubleshooting note (visible to IT staff only)...'
                                : 'Type reply or inquiry (supports bold, italic, lists, links)...'
                            }
                            value={commentContent}
                            onChange={(e) => setCommentContent(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-transparent focus:outline-none focus:ring-0 resize-none font-sans text-slate-800 dark:text-slate-200"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          {!isEmployee ? (
                            <label className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isInternalComment}
                                onChange={(e) => setIsInternalComment(e.target.checked)}
                                className="rounded text-amber-600 focus:ring-amber-500"
                              />
                              <span>Internal IT Note Only</span>
                            </label>
                          ) : (
                            <div />
                          )}

                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={isPostingComment || !commentContent.trim()}
                            icon={Send}
                            className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700"
                          >
                            {isPostingComment ? 'Sending...' : 'Send Message'}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Conversation is read-only because ticket is <strong>{selectedTicket.status.toLowerCase()}</strong>. No new comments can be posted.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {activeDetailTab === 'attachments' && (
                  <div className="space-y-3">
                    {/* Format Guidelines Banner */}
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
                      <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Supported Formats:</span> Images (JPG, JPEG, PNG, GIF) • Documents (PDF, DOC/DOCX, XLS/XLSX, TXT) • Diagnostic (ZIP). Max 10MB per file.
                      </div>
                    </div>

                    {/* Attachments List */}
                    {ticketAttachments.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">
                        No files attached to this ticket.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {ticketAttachments.map((att) => (
                          <div
                            key={att.id}
                            className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between text-xs gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {att.originalFileName}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {(att.fileSizeBytes / 1024).toFixed(1)} KB &bull; Uploaded by {att.uploadedByName} ({new Date(att.uploadedAt).toLocaleDateString()})
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {att.isPreviewable && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewAttachment(att)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                                  title="Preview File"
                                >
                                  <Eye className="w-3.5 h-3.5 text-indigo-500" />
                                  <span className="hidden sm:inline">Preview</span>
                                </button>
                              )}

                              <a
                                href={getAttachmentDownloadUrl(att.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                                title="Download File"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Download</span>
                              </a>

                              {canDeleteAttachment(att) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(att.id, att.originalFileName)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-500 transition-colors"
                                  title="Delete Attachment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload button inside ticket */}
                    {selectedTicket.status !== 'RESOLVED' &&
                    selectedTicket.status !== 'CLOSED' &&
                    selectedTicket.status !== 'CANCELLED' ? (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Maximum 10MB &bull; Validated MIME & extension</span>
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 transition-colors">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{isUploadingDetailAttachment ? 'Uploading...' : 'Attach File'}</span>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                            className="hidden"
                            disabled={isUploadingDetailAttachment}
                            onChange={handleDetailAttachmentUpload}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400">
                        Attachments cannot be added or deleted on {selectedTicket.status.toLowerCase()} tickets.
                      </div>
                    )}
                  </div>
                )}

                {activeDetailTab === 'history' && (
                  <div className="space-y-3">
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {ticketHistory.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">
                          No audit history recorded yet.
                        </p>
                      ) : (
                        ticketHistory.map((h) => (
                          <div
                            key={h.id}
                            className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-mono uppercase font-bold text-indigo-500">
                                {h.action.replace(/_/g, ' ')}
                              </span>
                              <span>{new Date(h.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 font-medium">
                              {h.details}
                            </p>
                            <div className="text-[10px] text-slate-400">
                              Actor: <span className="font-semibold text-slate-600 dark:text-slate-300">{h.actorName}</span> ({h.actorRole})
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* CREATE TICKET MODAL (Complete 9 Fields) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New IT Support Ticket"
        subtitle="Submit your issue for triage by designated Accurate Group IT teams."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          {/* 1. Problem / Subject (max 150 chars) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                1. Problem / Subject *
              </label>
              <span className={`text-[10px] ${newTitle.length > 150 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                {newTitle.length} / 150 characters
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={150}
              placeholder="e.g. Workstation BSOD on kernel boot or VPN certificate error"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          {/* 2. Description (mandatory, max 2000 chars) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                2. Detailed Description *
              </label>
              <span className={`text-[10px] ${newDescription.length > 2000 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                {newDescription.length} / 2,000 characters
              </span>
            </div>
            <textarea
              rows={3}
              required
              maxLength={2000}
              placeholder="Provide exact error codes, troubleshooting steps attempted, impact on business operations, and steps to reproduce..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
          </div>

          {/* 3. Category & 4. Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                3. Category *
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              >
                <option value="HARDWARE">Hardware / Computer</option>
                <option value="SOFTWARE">Software / Operating System</option>
                <option value="NETWORK">Network & Wi-Fi Connectivity</option>
                <option value="ACCESS">Account & System Access</option>
                <option value="EMAIL">Email & Productivity Suite</option>
                <option value="TELEPHONY">Telephony & VoIP</option>
                <option value="OTHER">Other Technical Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                4. Priority *
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical (System Down)</option>
              </select>
            </div>
          </div>

          {/* 5. Computer / Linked IT Asset Selection & 6. Location */}
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-indigo-500" />
                  <span>5. Linked Computer / Workstation</span>
                  {isEmployee && assignedComputer && !isChangingAsset && (
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                      Auto-Identified Default
                    </span>
                  )}
                </label>

                {isEmployee && assignedComputer && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingAsset(!isChangingAsset);
                      if (isChangingAsset) {
                        // Reset to assigned default
                        setSelectedAssetId(assignedComputer.id);
                        setNewAssetTag(assignedComputer.assetTag);
                        setAssetOverrideReason('');
                        setOverrideReasonError(null);
                      }
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
                  >
                    {isChangingAsset ? 'Use My Assigned Computer' : 'Change / Report Other Device'}
                  </button>
                )}
              </div>

              {isLoadingAssetOptions ? (
                <div className="py-2 flex items-center gap-2 text-xs text-slate-500">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span>Identifying assigned computer equipment...</span>
                </div>
              ) : isEmployee && assignedComputer && !isChangingAsset ? (
                /* Auto-Identified Employee Workstation (Default) */
                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                      PC
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {assignedComputer.assetTag}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {assignedComputer.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {assignedComputer.manufacturer || ''} {assignedComputer.model || ''} • S/N:{' '}
                        {assignedComputer.serialNumber || 'N/A'} • Status:{' '}
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {assignedComputer.status}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm" className="text-[10px]">
                    Assigned to You
                  </Badge>
                </div>
              ) : (
                /* Asset Selection Dropdown (For IT Staff, or Employee Exception Workflow) */
                <div className="space-y-2.5">
                  <select
                    value={selectedAssetId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedAssetId(val);
                      if (val === 'NONE') {
                        setNewAssetTag('');
                      } else if (val === assignedComputer?.id) {
                        setNewAssetTag(assignedComputer.assetTag);
                        setAssetOverrideReason('');
                        setOverrideReasonError(null);
                      } else {
                        const chosen = selectableAssets.find((a) => a.id === val);
                        setNewAssetTag(chosen ? chosen.assetTag : '');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  >
                    {assignedComputer && (
                      <option value={assignedComputer.id}>
                        {assignedComputer.assetTag} - {assignedComputer.name} (My Assigned Workstation)
                      </option>
                    )}
                    <option value="NONE">-- No Computer / Not Applicable --</option>
                    {selectableAssets.map((ast) => (
                      <option key={ast.id} value={ast.id}>
                        {ast.assetTag} - {ast.name} ({ast.model || ast.assetType}) [
                        {ast.assignedUserName ? `Assigned: ${ast.assignedUserName}` : 'Unassigned Stock'}]
                      </option>
                    ))}
                  </select>

                  {/* Exception Warning & Mandatory Reason for Non-Assigned Asset */}
                  {isEmployee &&
                    selectedAssetId &&
                    selectedAssetId !== 'NONE' &&
                    (!assignedComputer || selectedAssetId !== assignedComputer.id) && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-xs text-amber-900 dark:text-amber-200">
                            <strong className="font-semibold">Exception Workflow: Non-Assigned Equipment.</strong>
                            <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                              You are submitting a ticket for equipment that is not currently assigned to you. Enterprise policy requires a mandatory reason, which will be logged in the audit trail.
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-amber-950 dark:text-amber-200 mb-1">
                            Mandatory Justification / Reason *
                          </label>
                          <textarea
                            rows={2}
                            required
                            placeholder="e.g. Reporting on behalf of a teammate, or using shared conference room PC, loaner laptop..."
                            value={assetOverrideReason}
                            onChange={(e) => {
                              setAssetOverrideReason(e.target.value);
                              if (e.target.value.trim()) setOverrideReasonError(null);
                            }}
                            className={`w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border rounded-xl font-medium ${
                              overrideReasonError
                                ? 'border-rose-500 focus:ring-rose-500'
                                : 'border-amber-300 dark:border-amber-700 focus:border-amber-500'
                            }`}
                          />
                          {overrideReasonError && (
                            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                              {overrideReasonError}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* 6. Location */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                6. Location *
              </label>
              <select
                value={newLocationId}
                onChange={(e) => setNewLocationId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              >
                <option value="">-- Select Location --</option>
                {(locations || [])
                  .filter((l) => !l.isArchived)
                  .map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.city})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* 8. Contact Number & 9. IT Technician Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                8. Contact Number
              </label>
              <input
                type="text"
                placeholder="+1 (555) 012-3456"
                value={newContactNumber}
                onChange={(e) => setNewContactNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                9. IT Technician Selection (Optional)
              </label>
              <select
                value={newTechnicianId}
                onChange={(e) => setNewTechnicianId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              >
                <option value="">-- Auto-Route / Unassigned --</option>
                {activeTechnicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.displayName} ({tech.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 7. Attachment — optional */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                7. Attachment (Optional, max 10MB)
              </label>
              <span className="text-[10px] text-slate-400">JPG, PNG, GIF, PDF, DOC/X, XLS/X, TXT, ZIP</span>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                onChange={handleAttachmentFileChange}
                className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950 dark:file:text-indigo-300"
              />
              {newAttachmentFile && (
                <button
                  type="button"
                  onClick={() => setNewAttachmentFile(null)}
                  className="text-xs text-rose-500 hover:underline font-semibold"
                >
                  Clear file
                </button>
              )}
            </div>
            {newAttachmentFile && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <FileCheck className="w-3.5 h-3.5" />
                Selected: {newAttachmentFile.originalFileName} ({(newAttachmentFile.fileSizeBytes / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingTicket}
              className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmittingTicket ? 'Creating...' : 'Submit Support Ticket'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT TICKET MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Ticket ${selectedTicket?.ticketNumber}`}
        subtitle="Employees can modify tickets while status is New or Assigned."
        maxWidth="lg"
      >
        <form onSubmit={handleEditTicket} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Problem / Subject * (max 150 chars)
              </label>
              <span className={`text-[10px] ${editTitle.length > 150 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                {editTitle.length} / 150
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={150}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Description * (max 2,000 chars)
              </label>
              <span className={`text-[10px] ${editDescription.length > 2000 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                {editDescription.length} / 2,000
              </span>
            </div>
            <textarea
              rows={3}
              required
              maxLength={2000}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
              >
                <option value="HARDWARE">Hardware / Computer</option>
                <option value="SOFTWARE">Software / OS</option>
                <option value="NETWORK">Network & Wi-Fi</option>
                <option value="ACCESS">Account & Access</option>
                <option value="EMAIL">Email & Office</option>
                <option value="TELEPHONY">Telephony / VoIP</option>
                <option value="OTHER">Other Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Location
              </label>
              <select
                value={editLocationId}
                onChange={(e) => setEditLocationId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
              >
                <option value="">-- Select Location --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                value={editContactNumber}
                onChange={(e) => setEditContactNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>Linked Equipment</span>
                {isEmployee && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> Read-Only for Employees
                  </span>
                )}
              </label>
              {isEmployee ? (
                <div className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>{editAssetTag || 'None'}</span>
                  <span className="text-[10px] font-sans text-slate-400">Locked after creation</span>
                </div>
              ) : (
                <select
                  value={editAssetId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditAssetId(val);
                    const chosen = selectableAssets.find((a) => a.id === val);
                    setEditAssetTag(chosen ? chosen.assetTag : '');
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                >
                  <option value="NONE">-- No Equipment Linked --</option>
                  {selectedTicket?.relatedAssetId && !selectableAssets.some((a) => a.id === selectedTicket.relatedAssetId) && (
                    <option value={selectedTicket.relatedAssetId}>
                      {selectedTicket.relatedAssetTag} {selectedTicket.relatedAssetName ? `(${selectedTicket.relatedAssetName})` : ''} [Current]
                    </option>
                  )}
                  {selectableAssets.map((ast) => (
                    <option key={ast.id} value={ast.id}>
                      {ast.assetTag} - {ast.name} ({ast.model || ast.assetType}) [
                      {ast.assignedUserName ? `Assigned: ${ast.assignedUserName}` : 'Stock'}]
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingEdit}
              className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CHANGE LINKED ASSET MODAL (IT Staff Only) */}
      <Modal
        isOpen={isChangeAssetModalOpen}
        onClose={() => setIsChangeAssetModalOpen(false)}
        title={`Reassign Linked Equipment: Ticket ${selectedTicket?.ticketNumber}`}
        subtitle="Only IT Technicians, IT Admins, and Super Admins may reassign equipment."
        maxWidth="md"
      >
        <form onSubmit={handleChangeAssetSubmit} className="space-y-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              All modifications to linked equipment are preserved in the permanent ticket audit log. Historical employee assignment snapshots will remain recorded.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Equipment from Inventory
            </label>
            <select
              value={changeAssetSelectedId}
              onChange={(e) => setChangeAssetSelectedId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
            >
              <option value="NONE">-- No Equipment Linked (Unlink) --</option>
              {selectedTicket?.relatedAssetId &&
                !selectableAssets.some((a) => a.id === selectedTicket.relatedAssetId) && (
                  <option value={selectedTicket.relatedAssetId}>
                    {selectedTicket.relatedAssetTag}{' '}
                    {selectedTicket.relatedAssetName ? `(${selectedTicket.relatedAssetName})` : ''} [Current]
                  </option>
                )}
              {selectableAssets.map((ast) => (
                <option key={ast.id} value={ast.id}>
                  {ast.assetTag} - {ast.name} ({ast.model || ast.assetType}) [
                  {ast.assignedUserName ? `Assigned: ${ast.assignedUserName}` : 'Stock'}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Audit Notes / Reason for Reassignment
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Swapped with loaner device during hardware diagnostic, or employee workstation replaced..."
              value={changeAssetNotes}
              onChange={(e) => setChangeAssetNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsChangeAssetModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingAssetChange}
              className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmittingAssetChange ? 'Updating...' : 'Update Linked Equipment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CANCEL TICKET MODAL */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={`Cancel Ticket ${selectedTicket?.ticketNumber}`}
        subtitle="Cancelled tickets are retained permanently as historical audit records."
        maxWidth="md"
      >
        <form onSubmit={handleCancelTicket} className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Per enterprise policy, tickets are never deleted. Cancelling this ticket will mark its status as <strong>CANCELLED</strong> and preserve all logs.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Cancellation Reason (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Issue resolved independently or duplicate request..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={isSubmittingCancel}
              className="rounded-xl text-xs font-semibold"
            >
              {isSubmittingCancel ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* SAVE FILTER PRESET MODAL */}
      <Modal
        isOpen={isSaveFilterModalOpen}
        onClose={() => setIsSaveFilterModalOpen(false)}
        title="Save Current Filter Preset"
        subtitle="Store your current search criteria for instant 1-click access anytime."
        maxWidth="md"
      >
        <form onSubmit={handleSaveCurrentFilter} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Preset Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Critical Unassigned, London Office Hardware..."
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
          </div>

          {/* Active Criteria Snapshot */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
            <span className="font-bold text-slate-400 uppercase text-[10px] block">
              Current Filter Snapshot:
            </span>
            <div>&bull; Keyword: <span className="font-semibold text-slate-800 dark:text-slate-200">{filterKeyword || '(Any)'}</span></div>
            <div>&bull; Status: <span className="font-semibold text-slate-800 dark:text-slate-200">{filterStatus}</span> | Priority: <span className="font-semibold text-slate-800 dark:text-slate-200">{filterPriority}</span></div>
            {filterCategory !== 'ALL' && <div>&bull; Category: <span className="font-semibold text-slate-800 dark:text-slate-200">{filterCategory}</span></div>}
            {filterDepartmentId !== 'ALL' && <div>&bull; Department Filter Applied</div>}
            {filterTechnicianId !== 'ALL' && <div>&bull; Technician Filter Applied</div>}
            {filterStartDate && <div>&bull; Date Range: {filterStartDate} to {filterEndDate || 'now'}</div>}
          </div>

          {/* Super Admin Organization Sharing */}
          {isSuperAdmin && (
            <div className="flex items-center gap-2 p-2.5 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/60 text-xs">
              <input
                type="checkbox"
                id="shareFilterCheckbox"
                checked={newFilterIsShared}
                onChange={(e) => setNewFilterIsShared(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label htmlFor="shareFilterCheckbox" className="font-semibold text-indigo-900 dark:text-indigo-200 cursor-pointer">
                Share this preset with all employees and IT staff across the organization
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSaveFilterModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSavingFilter || !newFilterName.trim()}
              className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700"
            >
              {isSavingFilter ? 'Saving Preset...' : 'Save Preset'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ATTACHMENT PREVIEW MODAL */}
      <Modal
        isOpen={previewAttachment !== null}
        onClose={() => setPreviewAttachment(null)}
        title={previewAttachment?.originalFileName || 'Attachment Preview'}
        subtitle={
          previewAttachment
            ? `${(previewAttachment.fileSizeBytes / 1024).toFixed(1)} KB • Uploaded by ${previewAttachment.uploadedByName}`
            : undefined
        }
        maxWidth="2xl"
      >
        {previewAttachment && (
          <div className="space-y-4">
            {['jpg', 'jpeg', 'png', 'gif'].includes(previewAttachment.extension.toLowerCase()) ? (
              <div className="flex justify-center items-center p-3 bg-slate-900/5 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 max-h-[60vh] overflow-auto">
                <img
                  src={getAttachmentPreviewUrl(previewAttachment.id)}
                  alt={previewAttachment.originalFileName}
                  className="max-h-[55vh] max-w-full rounded-lg object-contain shadow-sm"
                />
              </div>
            ) : previewAttachment.extension.toLowerCase() === 'pdf' ? (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                <iframe
                  src={getAttachmentPreviewUrl(previewAttachment.id)}
                  className="w-full h-[55vh] rounded-xl"
                  title={previewAttachment.originalFileName}
                />
              </div>
            ) : previewAttachment.extension.toLowerCase() === 'txt' ? (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
                <iframe
                  src={getAttachmentPreviewUrl(previewAttachment.id)}
                  className="w-full h-[50vh] rounded-lg font-mono text-xs"
                  title={previewAttachment.originalFileName}
                />
              </div>
            ) : (
              <div className="p-8 text-center space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Direct preview is not supported for <strong>.{previewAttachment.extension}</strong> files.
                </p>
                <p className="text-xs text-slate-400">
                  You can safely download this file to open it in your system viewer.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-mono">
                {previewAttachment.mimeType}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={getAttachmentDownloadUrl(previewAttachment.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download File
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewAttachment(null)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Corporate Confirmation Dialog for Destructive Actions */}
      <ConfirmDialog
        isOpen={confirmDialogConfig.isOpen}
        title={confirmDialogConfig.title}
        message={confirmDialogConfig.message}
        confirmText={confirmDialogConfig.confirmText}
        cancelText={confirmDialogConfig.cancelText}
        variant={confirmDialogConfig.variant}
        onConfirm={confirmDialogConfig.onConfirm}
        onCancel={() => setConfirmDialogConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
