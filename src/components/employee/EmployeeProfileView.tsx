import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchUserProfile,
  updateMobileNumber,
  submitProfileChangeRequest,
} from '../../services/profileService';
import {
  fetchMasterDepartments,
  fetchMasterLocations,
} from '../../services/masterDataService';
import { Department, Location, UserProfile, UserProfileChangeRequest } from '../../types';
import { validateUsername } from '../../lib/security';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  User,
  Phone,
  Building,
  MapPin,
  Laptop,
  Briefcase,
  Mail,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  X,
  FileText,
  Send,
  History,
  Check,
  ChevronRight,
  Info,
  ShieldCheck,
} from 'lucide-react';

export const EmployeeProfileView: React.FC = () => {
  const { user, profile: authProfile, refreshProfile } = useAuth();

  // Profile data
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [changeRequests, setChangeRequests] = useState<UserProfileChangeRequest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Direct Mobile Editing State
  const [isEditingMobile, setIsEditingMobile] = useState(false);
  const [mobileInput, setMobileInput] = useState('');
  const [isSavingMobile, setIsSavingMobile] = useState(false);
  const [mobileError, setMobileError] = useState<string | null>(null);

  // Official Change Request Modal State
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formAssetTag, setFormAssetTag] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [usernameValidationErr, setUsernameValidationErr] = useState<string | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Feedback states
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pRes, dRes, lRes] = await Promise.all([
        fetchUserProfile(),
        fetchMasterDepartments(false), // active only
        fetchMasterLocations(false),   // active only
      ]);

      if (pRes.profile) {
        setProfileData(pRes.profile);
        setMobileInput(pRes.profile.mobileNumber || '');
      } else if (authProfile) {
        setProfileData(authProfile);
        setMobileInput(authProfile.mobileNumber || '');
      }

      if (pRes.changeRequests) {
        setChangeRequests(pRes.changeRequests);
      }

      if (dRes.departments) {
        setDepartments(dRes.departments);
      }

      if (lRes.locations) {
        setLocations(lRes.locations);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load profile data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Direct Mobile Number Save
  const handleSaveMobile = async () => {
    setMobileError(null);
    const trimmed = mobileInput.trim();

    if (!trimmed) {
      setMobileError('Please enter a valid mobile number.');
      return;
    }

    if (!/^[+]?[\d\s\-()]{7,20}$/.test(trimmed)) {
      setMobileError('Invalid mobile number format (7-20 digits or phone characters).');
      return;
    }

    setIsSavingMobile(true);
    try {
      const res = await updateMobileNumber(trimmed);
      if (res.success && res.profile) {
        setProfileData(res.profile);
        setIsEditingMobile(false);
        showSuccess('Mobile number updated directly successfully.');
        if (refreshProfile) refreshProfile();
      } else {
        setMobileError(res.error || 'Failed to update mobile number.');
      }
    } catch (err: any) {
      setMobileError(err.message || 'Error updating mobile number.');
    } finally {
      setIsSavingMobile(false);
    }
  };

  // Open Change Request Modal
  const handleOpenChangeModal = () => {
    const current = profileData || authProfile;
    if (!current) return;

    setFormName(current.displayName || '');
    setFormUsername(current.username || '');
    setFormDepartmentId(current.departmentId || '');
    setFormDesignation(current.designation || '');
    setFormAssetTag(current.assetTag || '');
    setFormLocationId(current.locationId || '');
    setFormReason('');
    setUsernameValidationErr(null);
    setIsChangeModalOpen(true);
  };

  // Username live validation
  const handleUsernameChange = (val: string) => {
    setFormUsername(val);
    if (!val.trim()) {
      setUsernameValidationErr(null);
      return;
    }
    const current = profileData || authProfile;
    if (val.trim().toLowerCase() === current?.username?.toLowerCase()) {
      setUsernameValidationErr(null);
      return;
    }
    const check = validateUsername(val);
    if (!check.isValid) {
      setUsernameValidationErr(check.error || 'Invalid username');
    } else {
      setUsernameValidationErr(null);
    }
  };

  // Submit Official Field Change Request
  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const current = profileData || authProfile;
    if (!current) return;

    if (!formReason.trim()) {
      setErrorMessage('A reason for the official change request is required for IT Admin review.');
      return;
    }

    // Validate username if changed
    if (formUsername.trim() && formUsername.trim().toLowerCase() !== current.username?.toLowerCase()) {
      const uCheck = validateUsername(formUsername);
      if (!uCheck.isValid) {
        setUsernameValidationErr(uCheck.error || 'Invalid username');
        return;
      }
    }

    setIsSubmittingRequest(true);
    try {
      const res = await submitProfileChangeRequest({
        employeeName: formName.trim() !== current.displayName ? formName.trim() : undefined,
        username: formUsername.trim().toLowerCase() !== current.username?.toLowerCase() ? formUsername.trim() : undefined,
        departmentId: formDepartmentId !== current.departmentId ? formDepartmentId : undefined,
        designation: formDesignation.trim() !== current.designation ? formDesignation.trim() : undefined,
        assetTag: formAssetTag.trim() !== current.assetTag ? formAssetTag.trim() : undefined,
        locationId: formLocationId !== current.locationId ? formLocationId : undefined,
        reason: formReason.trim(),
      });

      if (res.success && res.changeRequest) {
        setChangeRequests((prev) => [res.changeRequest!, ...prev]);
        setIsChangeModalOpen(false);
        showSuccess(res.message || 'Profile change request submitted to IT Admin.');
      } else {
        setErrorMessage(res.error || 'Failed to submit change request.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit change request.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">APPROVED</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">REJECTED</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning">PENDING IT REVIEW</Badge>;
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const currentProfile = profileData || authProfile;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Profile Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-md">
              {currentProfile?.displayName ? currentProfile.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {currentProfile?.displayName || 'Employee Profile'}
                </h1>
                <Badge variant="purple">EMPLOYEE</Badge>
                <Badge variant="success">ACTIVE</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  @{currentProfile?.username}
                </span>
                <span>•</span>
                <span>{currentProfile?.email}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Private Employee View
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              icon={FileText}
              onClick={handleOpenChangeModal}
              className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-xs"
            >
              Request Official Field Change
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              Corporate Profile Governance Policy
            </p>
            <p>
              Your <strong>Mobile Number</strong> can be changed directly below. Official employment credentials (Employee Name, Username, Department, Designation, Computer Tag, and Location) require an official change request and IT Administrator approval before taking effect.
            </p>
          </div>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: PROFILE FIELDS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Personal & Official Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  Employee Profile Details
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Current corporate attributes recorded in Accurate Group ITMS
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Field 1: Employee Name (Official) */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  <span>Employee Name</span>
                  <Badge variant="purple" className="text-3xs py-0">Official</Badge>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {currentProfile?.displayName || '—'}
                </div>
                <span className="text-3xs text-slate-400 mt-1 block">
                  Requires IT Admin approval to change
                </span>
              </div>

              {/* Field 2: Username (Official) */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  <span>Username</span>
                  <Badge variant="purple" className="text-3xs py-0">Official</Badge>
                </div>
                <div className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                  @{currentProfile?.username || '—'}
                </div>
                <span className="text-3xs text-slate-400 mt-1 block">
                  A-Z only • Governed by IT policy
                </span>
              </div>

              {/* Field 3: Mobile Number (Directly Editable) */}
              <div className="p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20 sm:col-span-2">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider font-semibold mb-1">
                  <span className="text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Mobile Number
                  </span>
                  <Badge variant="success" className="text-3xs py-0">Directly Editable</Badge>
                </div>

                {!isEditingMobile ? (
                  <div className="flex items-center justify-between mt-1">
                    <div>
                      <span className="text-base font-semibold text-slate-900 dark:text-slate-100 font-mono">
                        {currentProfile?.mobileNumber || '(Not set yet)'}
                      </span>
                      <p className="text-3xs text-slate-500 mt-0.5">
                        Can be updated directly without administrative approval
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      icon={Edit3}
                      onClick={() => {
                        setMobileInput(currentProfile?.mobileNumber || '');
                        setIsEditingMobile(true);
                        setMobileError(null);
                      }}
                      className="text-xs rounded-xl"
                    >
                      Change Mobile
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={mobileInput}
                        onChange={(e) => setMobileInput(e.target.value)}
                        placeholder="e.g. +1 (555) 234-5678"
                        className="flex-1 text-xs p-2.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Save}
                        disabled={isSavingMobile}
                        onClick={handleSaveMobile}
                        className="text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isSavingMobile ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditingMobile(false);
                          setMobileError(null);
                        }}
                        className="text-xs rounded-xl"
                      >
                        Cancel
                      </Button>
                    </div>
                    {mobileError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                        {mobileError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Field 4: Department (Official) */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  <span>Department</span>
                  <Badge variant="purple" className="text-3xs py-0">Official</Badge>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  {currentProfile?.departmentName || '—'}
                </div>
                <span className="text-3xs text-slate-400 mt-1 block">
                  Selected from predefined master departments
                </span>
              </div>

              {/* Field 5: Designation (Official) */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  <span>Designation</span>
                  <Badge variant="purple" className="text-3xs py-0">Official</Badge>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {currentProfile?.designation || 'Staff Member'}
                </div>
                <span className="text-3xs text-slate-400 mt-1 block">
                  Official job title
                </span>
              </div>

              {/* Field 6: Computer / Asset Tag (Official) */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  <span>Computer / Asset Tag</span>
                  <Badge variant="purple" className="text-3xs py-0">Official</Badge>
                </div>
                <div className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-slate-400" />
                  {currentProfile?.assetTag || 'Not Assigned'}
                </div>
                <span className="text-3xs text-slate-400 mt-1 block">
                  Hardware inventory binding
                </span>
              </div>

              {/* Field 7: Location (Official) */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  <span>Location</span>
                  <Badge variant="purple" className="text-3xs py-0">Official</Badge>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {currentProfile?.locationName || '—'}
                </div>
                <span className="text-3xs text-slate-400 mt-1 block">
                  Physical workplace site
                </span>
              </div>

              {/* Field 8: Company (Independent Master Data) */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  <span>Company</span>
                  <Badge variant="neutral" className="text-3xs py-0">Master Data</Badge>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-slate-400" />
                  {currentProfile?.companyName || 'Accurate Group'}
                </div>
                <span className="text-3xs text-slate-400 mt-1 block">
                  Operating entity
                </span>
              </div>

              {/* Field 9: Email (Corporate SSO) */}
              <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  <span>Corporate Email</span>
                  <Badge variant="neutral" className="text-3xs py-0">Identity</Badge>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{currentProfile?.email || '—'}</span>
                </div>
                <span className="text-3xs text-slate-400 mt-1 block">
                  Primary login and notification address
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Help & Action Card */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              Need to Update Official Info?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              If your name, designation, department, work location, computer hardware, or corporate username has changed, submit an Official Profile Change Request.
            </p>
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <span className="font-semibold block">Username Policy:</span>
              <p className="text-3xs">
                Must contain letters (A-Z) only. Spaces, numbers, and special characters are not permitted. All username changes are permanently audited.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={FileText}
              onClick={handleOpenChangeModal}
              className="w-full text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700"
            >
              Request Official Field Change
            </Button>
          </div>
        </div>
      </div>

      {/* SECTION 2: OFFICIAL PROFILE CHANGE REQUEST HISTORY */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              My Profile Change Requests
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Audit record of all submitted official profile change requests and administrative decisions
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
            <thead className="text-3xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <tr>
                <th className="py-3 px-3">Request Number</th>
                <th className="py-3 px-3">Requested Changes</th>
                <th className="py-3 px-3">Reason</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Reviewed By</th>
                <th className="py-3 px-3">Submitted Date</th>
                <th className="py-3 px-3">Reviewer Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {changeRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      No Profile Change Requests Found
                    </p>
                    <p className="text-3xs text-slate-400 mt-0.5">
                      You have not submitted any official profile updates yet.
                    </p>
                  </td>
                </tr>
              ) : (
                changeRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      {req.requestNumber}
                    </td>
                    <td className="py-3 px-3 max-w-[240px]">
                      <div className="flex flex-wrap gap-1">
                        {req.requestedChanges.employeeName && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-3xs">
                            Name: {req.requestedChanges.employeeName}
                          </span>
                        )}
                        {req.requestedChanges.username && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-3xs">
                            @{req.requestedChanges.username}
                          </span>
                        )}
                        {req.requestedChanges.departmentName && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-3xs">
                            Dept: {req.requestedChanges.departmentName}
                          </span>
                        )}
                        {req.requestedChanges.designation && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-3xs">
                            Title: {req.requestedChanges.designation}
                          </span>
                        )}
                        {req.requestedChanges.assetTag && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-3xs">
                            Tag: {req.requestedChanges.assetTag}
                          </span>
                        )}
                        {req.requestedChanges.locationName && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-3xs">
                            Loc: {req.requestedChanges.locationName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                      {req.reason}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {req.reviewerName || '—'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                      {formatDateTime(req.createdAt)}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-[220px]">
                      {req.reviewNotes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OFFICIAL FIELD CHANGE REQUEST MODAL */}
      {isChangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Submit Profile Change Request
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modifications will be submitted to the IT Administration team for review and approval.
                </p>
              </div>
              <button
                onClick={() => setIsChangeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitChangeRequest} className="space-y-4">
              {/* Employee Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Employee Full Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Official legal name"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Username with real-time rule enforcement */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Corporate Username
                  </label>
                  <span className="text-3xs text-slate-400 font-mono">
                    Policy: A-Z letters only (no spaces, numbers, or symbols)
                  </span>
                </div>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="e.g. JohnDoe"
                  className={`w-full text-xs p-3 rounded-xl border bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 font-mono ${
                    usernameValidationErr
                      ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20'
                  }`}
                />
                {usernameValidationErr && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {usernameValidationErr}
                  </p>
                )}
              </div>

              {/* Department (Predefined active departments) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={formDepartmentId}
                  onChange={(e) => setFormDepartmentId(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">-- Select Department --</option>
                  {(departments || [])
                    .filter((d) => !d.isArchived)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                </select>
                <span className="text-3xs text-slate-400 mt-0.5 block">
                  Archived departments are excluded per master data governance
                </span>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Designation / Job Title
                </label>
                <input
                  type="text"
                  value={formDesignation}
                  onChange={(e) => setFormDesignation(e.target.value)}
                  placeholder="e.g. Senior Financial Analyst"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Computer / Asset Tag */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Computer / Asset Tag
                </label>
                <input
                  type="text"
                  value={formAssetTag}
                  onChange={(e) => setFormAssetTag(e.target.value)}
                  placeholder="e.g. AST-LAP-0012"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                />
              </div>

              {/* Location (Predefined active locations) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Work Location
                </label>
                <select
                  value={formLocationId}
                  onChange={(e) => setFormLocationId(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">-- Select Work Location --</option>
                  {(locations || [])
                    .filter((l) => !l.isArchived)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} - {l.city}, {l.country} ({l.code})
                      </option>
                    ))}
                </select>
                <span className="text-3xs text-slate-400 mt-0.5 block">
                  Archived locations are excluded per master data governance
                </span>
              </div>

              {/* Reason for Request * */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Official Profile Change *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Please state the business justification for this change (e.g., Transfer to Finance Department, hardware replacement)..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangeModalOpen(false)}
                  className="text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingRequest || !!usernameValidationErr}
                  icon={Send}
                  className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700"
                >
                  {isSubmittingRequest ? 'Submitting...' : 'Submit Request to IT Admin'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
