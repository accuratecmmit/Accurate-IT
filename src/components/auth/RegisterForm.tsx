import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMasterData } from '../../context/MasterDataContext';
import { validateUsername, validatePassword } from '../../lib/security';
import { Button } from '../ui/Button';
import {
  User,
  AtSign,
  Lock,
  Building,
  Briefcase,
  Laptop,
  MapPin,
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin }) => {
  const { register } = useAuth();
  const { activeDepartments, activeLocations } = useMasterData();

  // 9 Required Registration Fields
  const [employeeName, setEmployeeName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [locationId, setLocationId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; userId?: string } | null>(null);

  // Real-time username validation
  const usernameCheck = useMemo(() => {
    if (!username) return null;
    return validateUsername(username);
  }, [username]);

  // Real-time password validation (5 mandatory rules)
  const passwordCheck = useMemo(() => {
    if (!password) return null;
    return validatePassword(password);
  }, [password]);

  // Confirm password matching
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation checks
    if (!employeeName.trim()) {
      setErrorMessage('Employee Name is required.');
      return;
    }

    const uCheck = validateUsername(username);
    if (!uCheck.isValid) {
      setErrorMessage(uCheck.error || 'Invalid username format.');
      return;
    }

    const pCheck = validatePassword(password);
    if (!pCheck.isValid) {
      setErrorMessage('Password does not satisfy all complexity requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password and Confirm Password do not match.');
      return;
    }

    if (!departmentId) {
      setErrorMessage('Department is required.');
      return;
    }

    if (!designation.trim()) {
      setErrorMessage('Designation is required.');
      return;
    }

    if (!assetTag.trim()) {
      setErrorMessage('Computer / Asset Tag is required.');
      return;
    }

    if (!locationId) {
      setErrorMessage('Location is required.');
      return;
    }

    if (!mobileNumber.trim()) {
      setErrorMessage('Mobile Number is required.');
      return;
    }

    setIsSubmitting(true);

    const selectedDept = activeDepartments.find((d) => d.id === departmentId);
    const selectedLoc = activeLocations.find((l) => l.id === locationId);

    const res = await register({
      employeeName: employeeName.trim(),
      username: username.trim(),
      password,
      confirmPassword,
      departmentId,
      departmentName: selectedDept?.name,
      designation: designation.trim(),
      assetTag: assetTag.trim().toUpperCase(),
      locationId,
      locationName: selectedLoc?.name,
      mobileNumber: mobileNumber.trim(),
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || res.message || 'Registration failed.');
    } else {
      setSuccessInfo({ message: res.message, userId: (res as any).userId });
      if (onSuccess) {
        setTimeout(onSuccess, 3000);
      }
    }
  };

  if (successInfo) {
    return (
      <div className="text-center py-6 px-4 space-y-4">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Registration Submitted Successfully
        </h3>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-300 text-left space-y-2">
          <p className="font-semibold flex items-center gap-1.5">
            <Clock className="w-4 h-4 shrink-0" />
            Status: PENDING IT ADMIN REVIEW
          </p>
          <p>
            Your account credentials for <strong>@{username}</strong> have been created in secure pending state. An IT Administrator will review your department, asset tag, and identity before approving access.
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={onSwitchToLogin}
            className="w-full justify-center"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid: 1. Employee Name & 2. Username */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Field 1: Employee Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            1. Employee Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Field 2: Username */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            2. Username <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <AtSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="A-Z only (e.g. Rahul)"
              className={`w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border rounded-xl focus:outline-none focus:ring-2 text-slate-800 dark:text-slate-100 ${
                usernameCheck
                  ? usernameCheck.isValid
                    ? 'border-emerald-500 focus:ring-emerald-500'
                    : 'border-rose-400 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
              }`}
            />
            {usernameCheck && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {usernameCheck.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500" />
                )}
              </span>
            )}
          </div>
          {usernameCheck && !usernameCheck.isValid && (
            <p className="text-[10px] text-rose-500 mt-1 font-medium">{usernameCheck.error}</p>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5">
            A-Z alphabetic only &bull; Case-insensitive uniqueness (Rahul = rahul)
          </p>
        </div>
      </div>

      {/* Grid: 3. Password & 4. Confirm Password */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Field 3: Password */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            3. Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Field 4: Confirm Password */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            4. Confirm Password <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className={`w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border rounded-xl focus:outline-none focus:ring-2 text-slate-800 dark:text-slate-100 ${
                confirmPassword
                  ? passwordsMatch
                    ? 'border-emerald-500 focus:ring-emerald-500'
                    : 'border-rose-400 focus:ring-rose-500'
                  : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
              }`}
            />
            {confirmPassword && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {passwordsMatch ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500" />
                )}
              </span>
            )}
          </div>
          {confirmPassword && !passwordsMatch && (
            <p className="text-[10px] text-rose-500 mt-1 font-medium">Passwords do not match.</p>
          )}
        </div>
      </div>

      {/* Password Rules Checklist */}
      {password && passwordCheck && (
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            Enterprise Password Requirements:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px]">
            <span className={`flex items-center gap-1 ${passwordCheck.rules.minLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {passwordCheck.rules.minLength ? '✓' : '○'} Min 8 chars
            </span>
            <span className={`flex items-center gap-1 ${passwordCheck.rules.hasUppercase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {passwordCheck.rules.hasUppercase ? '✓' : '○'} Uppercase (A-Z)
            </span>
            <span className={`flex items-center gap-1 ${passwordCheck.rules.hasLowercase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {passwordCheck.rules.hasLowercase ? '✓' : '○'} Lowercase (a-z)
            </span>
            <span className={`flex items-center gap-1 ${passwordCheck.rules.hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {passwordCheck.rules.hasNumber ? '✓' : '○'} Number (0-9)
            </span>
            <span className={`flex items-center gap-1 ${passwordCheck.rules.hasSpecial ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {passwordCheck.rules.hasSpecial ? '✓' : '○'} Special char (!@#$)
            </span>
            <span className="text-slate-400">✓ Reuse permitted</span>
          </div>
        </div>
      )}

      {/* Grid: 5. Department & 6. Designation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Field 5: Department */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            5. Department <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            >
              <option value="">Select Department...</option>
              {activeDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Field 6: Designation */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            6. Designation <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Briefcase className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Grid: 7. Computer/Asset Tag, 8. Location, 9. Mobile Number */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Field 7: Computer/Asset Tag */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            7. Computer/Asset Tag <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Laptop className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={assetTag}
              onChange={(e) => setAssetTag(e.target.value)}
              placeholder="e.g. AST-0921"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-mono uppercase"
            />
          </div>
        </div>

        {/* Field 8: Location */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            8. Location <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              required
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            >
              <option value="">Select Location...</option>
              {activeLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} - {loc.city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Field 9: Mobile Number */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            9. Mobile Number <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              required
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="+1 (555) 012-3456"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Notice about Approval Workflow */}
      <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl text-[11px] text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
        <Clock className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
        <span>
          <strong>Approval Workflow:</strong> Submitted registrations enter <em>Pending</em> status. An IT Administrator will review and approve or reject your account before login is granted.
        </span>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="w-full sm:flex-1 justify-center py-2.5 font-semibold"
        >
          Submit Registration for IT Approval
        </Button>
        {onSwitchToLogin && (
          <Button
            type="button"
            variant="ghost"
            onClick={onSwitchToLogin}
            className="w-full sm:w-auto text-xs"
          >
            Already registered? Sign in
          </Button>
        )}
      </div>
    </form>
  );
};
