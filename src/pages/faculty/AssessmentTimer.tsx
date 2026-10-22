import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../lib/api.ts";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  ShieldAlert,
} from "lucide-react";

interface AssessmentTimerItem {
  assessmentId: number;
  title: string;
  subject: string;
  status: string;
  timerEnabled: boolean;
  durationMinutes: number;
  gracePeriodSeconds: number;
  autoSubmitOnExpiry: boolean;
  updatedAt: string | null;
  updatedBy: number | null;
  activeSessionsCount: number;
  submittedSessionsCount: number;
  expiredSessionsCount: number;
}

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120];

export default function AssessmentTimer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTestIdParam = searchParams.get("testId");

  const [assessments, setAssessments] = useState<AssessmentTimerItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialTestIdParam ? Number(initialTestIdParam) : null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [timerEnabled, setTimerEnabled] = useState<boolean>(true);
  const [hoursInput, setHoursInput] = useState<string>("0");
  const [minutesInput, setMinutesInput] = useState<string>("45");
  const [customTotalMinutes, setCustomTotalMinutes] = useState<string>("45");
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState<number>(15);
  const [applyToActiveSessions, setApplyToActiveSessions] =
    useState<boolean>(false);

  // Feedback & confirmation modal state
  const [validationError, setValidationError] = useState<string>("");
  const [confirmationMessage, setConfirmationMessage] = useState<string>("");
  const [showActiveConfirmModal, setShowActiveConfirmModal] =
    useState<boolean>(false);

  const syncInputsFromTotalMinutes = (totalMins: number) => {
    const safeMins = Math.max(0, Math.round(totalMins));
    const hrs = Math.floor(safeMins / 60);
    const mins = safeMins % 60;
    setHoursInput(String(hrs));
    setMinutesInput(String(mins));
    setCustomTotalMinutes(String(safeMins));
    setValidationError("");
  };

  const fetchTimers = async (preserveSelection = true) => {
    try {
      setLoading(true);
      const res = await api.get("/admin/assessments/timers");
      const list: AssessmentTimerItem[] = Array.isArray(res.data)
        ? res.data
        : [];
      setAssessments(list);

      if (list.length > 0) {
        let target = list[0];
        if (preserveSelection && selectedId) {
          const found = list.find((a) => a.assessmentId === selectedId);
          if (found) target = found;
        } else if (initialTestIdParam) {
          const found = list.find(
            (a) => a.assessmentId === Number(initialTestIdParam)
          );
          if (found) target = found;
        } else {
          const published = list.find((a) => a.status === "published");
          if (published) target = published;
        }

        setSelectedId(target.assessmentId);
        setTimerEnabled(Boolean(target.timerEnabled));
        syncInputsFromTotalMinutes(target.durationMinutes || 60);
        setGracePeriodSeconds(target.gracePeriodSeconds ?? 15);
      }
    } catch (err) {
      console.error("Failed to load assessment timer settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimers(false);
  }, []);

  const selectedAssessment =
    assessments.find((a) => a.assessmentId === selectedId) || null;

  const handleSelectAssessment = (id: number) => {
    setSelectedId(id);
    setSearchParams({ testId: String(id) });
    setConfirmationMessage("");
    setValidationError("");
    setApplyToActiveSessions(false);
    const found = assessments.find((a) => a.assessmentId === id);
    if (found) {
      setTimerEnabled(Boolean(found.timerEnabled));
      syncInputsFromTotalMinutes(found.durationMinutes);
      setGracePeriodSeconds(found.gracePeriodSeconds ?? 15);
    }
  };

  const handleHoursChange = (val: string) => {
    setHoursInput(val);
    setConfirmationMessage("");
    const h = Number(val);
    const m = Number(minutesInput || 0);
    if (!isNaN(h) && !isNaN(m) && h >= 0 && m >= 0) {
      setCustomTotalMinutes(String(Math.round(h * 60 + m)));
      setValidationError("");
    }
  };

  const handleMinutesChange = (val: string) => {
    setMinutesInput(val);
    setConfirmationMessage("");
    const h = Number(hoursInput || 0);
    const m = Number(val);
    if (!isNaN(h) && !isNaN(m) && h >= 0 && m >= 0) {
      setCustomTotalMinutes(String(Math.round(h * 60 + m)));
      setValidationError("");
    }
  };

  const handleCustomTotalChange = (val: string) => {
    setCustomTotalMinutes(val);
    setConfirmationMessage("");
    const total = Number(val);
    if (!isNaN(total) && total >= 0) {
      const hrs = Math.floor(total / 60);
      const mins = Math.round(total % 60);
      setHoursInput(String(hrs));
      setMinutesInput(String(mins));
      setValidationError("");
    }
  };

  const handleQuickDuration = (mins: number) => {
    setConfirmationMessage("");
    syncInputsFromTotalMinutes(mins);
  };

  const validateForm = (): number | null => {
    const h = Number(hoursInput);
    const m = Number(minutesInput);
    const total = Number(customTotalMinutes);

    if (
      hoursInput.trim() === "" ||
      minutesInput.trim() === "" ||
      customTotalMinutes.trim() === "" ||
      isNaN(h) ||
      isNaN(m) ||
      isNaN(total)
    ) {
      setValidationError(
        "Please enter valid numeric values for hours and minutes."
      );
      return null;
    }

    if (h < 0 || m < 0 || total < 0) {
      setValidationError(
        "Duration cannot be negative. Please enter a non-negative duration."
      );
      return null;
    }

    const computedMinutes = Math.round(total);

    if (timerEnabled && computedMinutes <= 0) {
      setValidationError(
        "A positive duration (at least 1 minute) is required when the timer is enabled."
      );
      return null;
    }

    if (computedMinutes > 720) {
      setValidationError(
        "Assessment duration cannot exceed 720 minutes (12 hours)."
      );
      return null;
    }

    setValidationError("");
    return computedMinutes;
  };

  const executeSaveTimer = async (forceApplyActive: boolean) => {
    if (!selectedAssessment) return;
    const validMinutes = validateForm();
    if (validMinutes === null) return;

    setSaving(true);
    setConfirmationMessage("");
    setValidationError("");

    try {
      const res = await api.put(
        `/admin/assessments/${selectedAssessment.assessmentId}/timer`,
        {
          timerEnabled,
          durationMinutes: validMinutes > 0 ? validMinutes : selectedAssessment.durationMinutes || 60,
          hours: Math.floor(validMinutes / 60),
          minutes: validMinutes % 60,
          gracePeriodSeconds,
          autoSubmitOnExpiry: true,
          applyToActiveSessions: forceApplyActive,
        }
      );

      setConfirmationMessage(
        res.data?.message || "Timer settings saved and applied successfully."
      );
      setShowActiveConfirmModal(false);
      await fetchTimers(true);
    } catch (err: any) {
      setValidationError(
        err.response?.data?.message ||
          "Failed to save assessment timer configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettingsClick = (e: React.FormEvent) => {
    e.preventDefault();
    const validMinutes = validateForm();
    if (validMinutes === null) return;

    if (
      applyToActiveSessions &&
      selectedAssessment &&
      selectedAssessment.activeSessionsCount > 0
    ) {
      setShowActiveConfirmModal(true);
      return;
    }

    executeSaveTimer(applyToActiveSessions);
  };

  const handleApplySettingsClick = () => {
    const validMinutes = validateForm();
    if (validMinutes === null) return;

    if (
      applyToActiveSessions &&
      selectedAssessment &&
      selectedAssessment.activeSessionsCount > 0
    ) {
      setShowActiveConfirmModal(true);
      return;
    }

    executeSaveTimer(applyToActiveSessions);
  };

  const formatDurationSummary = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m (${mins} mins)`;
    if (h > 0) return `${h}h 0m (${mins} mins)`;
    return `${m} minutes`;
  };

  if (loading && assessments.length === 0) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Loading assessment timer configurations...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Assessment Timer
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Configure authoritative server-enforced countdown durations, expiry policies, and live session rules.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchTimers(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Status
        </button>
      </div>

      {assessments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-600 text-sm">
            No assessments found. Create an assessment in the Tests tab first to configure its timer.
          </p>
        </div>
      ) : (
        <>
          {/* Assessment Selector & Live Configuration Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Configuration Form (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div>
                <label
                  htmlFor="assessment-select"
                  className="block text-xs font-semibold text-slate-700 mb-2"
                >
                  Target Assessment
                </label>
                <select
                  id="assessment-select"
                  value={selectedId ?? ""}
                  onChange={(e) =>
                    handleSelectAssessment(Number(e.target.value))
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                >
                  {assessments.map((item) => (
                    <option key={item.assessmentId} value={item.assessmentId}>
                      {item.title} — {item.subject} ({item.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Enable / Disable Timer Toggle */}
              <div className="flex items-center justify-between py-4 border-y border-slate-100">
                <div>
                  <span className="block text-sm font-semibold text-slate-900">
                    Enable Assessment Timer
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {timerEnabled
                      ? "Server enforces strict deadline and automatically submits saved drafts at 00:00."
                      : "Timer enforcement is disabled. Students can complete the assessment without a countdown."}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={timerEnabled}
                  aria-label="Enable or Disable Assessment Timer"
                  onClick={() => {
                    setTimerEnabled(!timerEnabled);
                    setConfirmationMessage("");
                    setValidationError("");
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    timerEnabled ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${
                      timerEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Quick Duration Options */}
              <div className={timerEnabled ? "" : "opacity-60"}>
                <label className="block text-xs font-semibold text-slate-700 mb-2.5">
                  Quick Duration Presets
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {QUICK_DURATIONS.map((preset) => {
                    const isSelected = Number(customTotalMinutes) === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleQuickDuration(preset)}
                        className={`py-2 px-3 rounded-lg text-xs font-mono tabular-nums font-semibold border transition-colors whitespace-nowrap ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {preset} min
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hours, Minutes, and Custom Duration Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="timer-hours"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Hours
                  </label>
                  <input
                    id="timer-hours"
                    type="number"
                    min={0}
                    max={12}
                    value={hoursInput}
                    onChange={(e) => handleHoursChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="timer-minutes"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Minutes
                  </label>
                  <input
                    id="timer-minutes"
                    type="number"
                    min={0}
                    max={59}
                    value={minutesInput}
                    onChange={(e) => handleMinutesChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="timer-custom-minutes"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Custom Total (Minutes)
                  </label>
                  <input
                    id="timer-custom-minutes"
                    type="number"
                    min={1}
                    max={720}
                    value={customTotalMinutes}
                    onChange={(e) => handleCustomTotalChange(e.target.value)}
                    placeholder="e.g. 45"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Active Session Application Scope */}
              <div className="pt-2 border-t border-slate-100">
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  Session Application Policy
                </span>
                <div className="space-y-2.5">
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="sessionScope"
                      checked={!applyToActiveSessions}
                      onChange={() => setApplyToActiveSessions(false)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-600"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900 block">
                        Apply to Future Assessment Sessions Only (Recommended)
                      </span>
                      <span className="text-slate-500">
                        Students who have already started keep their recorded deadline. New sessions use the updated duration.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="sessionScope"
                      checked={applyToActiveSessions}
                      onChange={() => setApplyToActiveSessions(true)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-600"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900 block">
                        Update Currently Active Student Sessions ({selectedAssessment?.activeSessionsCount || 0} Active)
                      </span>
                      <span className="text-slate-500">
                        Recalculates the server deadline for students currently in progress based on their original start time.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Validation Error */}
              {validationError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 font-medium"
                >
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Success Confirmation */}
              {confirmationMessage && (
                <div
                  role="status"
                  className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{confirmationMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveSettingsClick}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {saving ? "Saving..." : "Save Timer Settings"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleApplySettingsClick}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {saving ? "Applying..." : "Apply Settings"}
                </button>
              </div>
            </div>

            {/* Right Column: Current Configuration & Assessment Status (5 cols) */}
            {selectedAssessment && (
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Current Timer Configuration
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Authoritative backend settings for {selectedAssessment.title}
                    </p>
                  </div>
                  <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                </div>

                <dl className="divide-y divide-slate-100 text-sm">
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500">Assessment Status</dt>
                    <dd className="font-semibold text-slate-900 uppercase text-xs">
                      {selectedAssessment.status}
                    </dd>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500">Timer State</dt>
                    <dd
                      className={`font-semibold text-xs ${
                        selectedAssessment.timerEnabled
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      {selectedAssessment.timerEnabled
                        ? "Enabled (Server Enforced)"
                        : "Disabled (Untimed)"}
                    </dd>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500">Saved Duration</dt>
                    <dd className="font-mono tabular-nums font-bold text-slate-900">
                      {selectedAssessment.timerEnabled
                        ? formatDurationSummary(
                            selectedAssessment.durationMinutes
                          )
                        : `Untimed (${selectedAssessment.durationMinutes}m default)`}
                    </dd>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500">Unsaved Preview</dt>
                    <dd className="font-mono tabular-nums text-xs text-blue-700 font-semibold">
                      {timerEnabled
                        ? formatDurationSummary(
                            Math.max(0, Number(customTotalMinutes) || 0)
                          )
                        : "Timer Disabled"}
                    </dd>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500">Effective Scope</dt>
                    <dd className="text-xs font-medium text-slate-800">
                      {applyToActiveSessions
                        ? "Active & Future Sessions"
                        : "Future Sessions Only"}
                    </dd>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500">Last Updated</dt>
                    <dd className="font-mono tabular-nums text-xs text-slate-600">
                      {selectedAssessment.updatedAt
                        ? new Date(
                            selectedAssessment.updatedAt
                          ).toLocaleString()
                        : "Default"}
                    </dd>
                  </div>
                </dl>

                {/* Live Session Telemetry */}
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-700 mb-3">
                    Student Session Activity
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="block text-xs text-slate-500">
                        Active Now
                      </span>
                      <span className="mt-1 block text-lg font-mono tabular-nums font-bold text-blue-700">
                        {selectedAssessment.activeSessionsCount}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="block text-xs text-slate-500">
                        Submitted
                      </span>
                      <span className="mt-1 block text-lg font-mono tabular-nums font-bold text-emerald-700">
                        {selectedAssessment.submittedSessionsCount}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="block text-xs text-slate-500">
                        Auto-Expired
                      </span>
                      <span className="mt-1 block text-lg font-mono tabular-nums font-bold text-amber-700">
                        {selectedAssessment.expiredSessionsCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* All Assessments Timer Overview Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                All Assessments Timer Matrix
              </h3>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {assessments.length} Assessment(s)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Assessment</th>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Timer Mode</th>
                    <th className="px-6 py-3 text-right">Duration</th>
                    <th className="px-6 py-3 text-right">Active Sessions</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {assessments.map((item) => {
                    const isCurrent = item.assessmentId === selectedId;
                    return (
                      <tr
                        key={item.assessmentId}
                        className={
                          isCurrent ? "bg-blue-50/40" : "hover:bg-slate-50"
                        }
                      >
                        <td className="px-6 py-3.5 font-medium text-slate-900">
                          {item.title}
                        </td>
                        <td className="px-6 py-3.5 text-slate-600">
                          {item.subject}
                        </td>
                        <td className="px-6 py-3.5 text-xs font-medium text-slate-600 uppercase">
                          {item.status}
                        </td>
                        <td className="px-6 py-3.5 text-xs font-semibold">
                          <span
                            className={
                              item.timerEnabled
                                ? "text-emerald-700"
                                : "text-slate-500"
                            }
                          >
                            {item.timerEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono tabular-nums text-slate-900">
                          {item.durationMinutes} min
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono tabular-nums text-slate-700">
                          {item.activeSessionsCount}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectAssessment(item.assessmentId)
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            Configure
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal when updating currently active student sessions */}
      {showActiveConfirmModal && selectedAssessment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Update Active Student Sessions?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  There are currently{" "}
                  <strong className="font-mono tabular-nums">
                    {selectedAssessment.activeSessionsCount}
                  </strong>{" "}
                  active student session(s) for{" "}
                  <strong>{selectedAssessment.title}</strong>. Proceeding will
                  recalculate their server deadlines using their recorded start
                  times and the new configuration (
                  {timerEnabled
                    ? `${customTotalMinutes} minutes`
                    : "Timer Disabled"}
                  ).
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowActiveConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => executeSaveTimer(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
              >
                {saving
                  ? "Updating..."
                  : "Confirm & Update Active Sessions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
