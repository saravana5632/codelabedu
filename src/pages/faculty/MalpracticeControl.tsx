import React, { useEffect, useState } from "react";
import api from "../../lib/api.ts";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Save,
  Clipboard,
  Scissors,
  ClipboardPaste,
  MousePointerClick,
  Terminal,
  AppWindow,
  Focus,
  Bell,
  FileWarning,
} from "lucide-react";

export interface MalpracticeSettingsData {
  masterEnabled: boolean;
  disableCopy: boolean;
  disableCut: boolean;
  disablePaste: boolean;
  disableRightClick: boolean;
  detectDevtoolsShortcuts: boolean;
  detectTabSwitch: boolean;
  detectWindowFocus: boolean;
  showStudentWarnings: boolean;
  enableViolationLogging: boolean;
  violationThreshold: number;
}

interface MalpracticeEventRecord {
  id: number;
  studentId: number;
  studentRollNumber: string | null;
  studentName: string | null;
  studentDepartment: string | null;
  assessmentId: number;
  assessmentTitle: string | null;
  sessionId: number;
  eventType: string;
  serverTimestamp: string;
  relevantConfiguration: Record<string, any>;
  reviewStatus: "pending" | "reviewed" | "dismissed" | "flagged";
  reviewedBy: number | null;
  reviewedAt: string | null;
  notes: string | null;
}

const DEFAULT_SETTINGS: MalpracticeSettingsData = {
  masterEnabled: true,
  disableCopy: true,
  disableCut: true,
  disablePaste: true,
  disableRightClick: true,
  detectDevtoolsShortcuts: true,
  detectTabSwitch: true,
  detectWindowFocus: true,
  showStudentWarnings: true,
  enableViolationLogging: true,
  violationThreshold: 3,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  copy_attempt: "Copy Attempt",
  cut_attempt: "Cut Attempt",
  paste_attempt: "Paste Attempt",
  context_menu_attempt: "Right-Click / Context Menu",
  devtools_shortcut_attempt: "DevTools Shortcut Attempt",
  tab_visibility_changed: "Tab Visibility Changed",
  window_focus_lost: "Window Focus Lost",
  fullscreen_exited: "Fullscreen Exited",
};

export default function MalpracticeControl() {
  const [formSettings, setFormSettings] =
    useState<MalpracticeSettingsData>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<MalpracticeSettingsData>(DEFAULT_SETTINGS);
  const [effectiveSettings, setEffectiveSettings] =
    useState<MalpracticeSettingsData>(DEFAULT_SETTINGS);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedByName, setUpdatedByName] = useState<string>("Admin Faculty");
  const [activeSessionsCount, setActiveSessionsCount] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Violation Logs state
  const [events, setEvents] = useState<MalpracticeEventRecord[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(false);
  const [eventsSummary, setEventsSummary] = useState({
    totalCount: 0,
    filteredCount: 0,
    pendingCount: 0,
    reviewedCount: 0,
    flaggedCount: 0,
    dismissedCount: 0,
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("all");
  const [inspectingEvent, setInspectingEvent] =
    useState<MalpracticeEventRecord | null>(null);
  const [updatingEventId, setUpdatingEventId] = useState<number | null>(null);

  const fetchMalpracticeSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/malpractice/settings");
      const data = res.data;
      const loaded: MalpracticeSettingsData = {
        masterEnabled: Boolean(data.masterEnabled),
        disableCopy: Boolean(data.disableCopy),
        disableCut: Boolean(data.disableCut),
        disablePaste: Boolean(data.disablePaste),
        disableRightClick: Boolean(data.disableRightClick),
        detectDevtoolsShortcuts: Boolean(data.detectDevtoolsShortcuts),
        detectTabSwitch: Boolean(data.detectTabSwitch),
        detectWindowFocus: Boolean(data.detectWindowFocus),
        showStudentWarnings: Boolean(data.showStudentWarnings),
        enableViolationLogging: Boolean(data.enableViolationLogging),
        violationThreshold: Number(data.violationThreshold) || 3,
      };
      setFormSettings(loaded);
      setSavedSettings(loaded);
      setEffectiveSettings(data.effectiveSettings || data.effective || loaded);
      setUpdatedAt(data.updatedAt || null);
      setUpdatedByName(data.updatedByName || "Admin Faculty");
      setActiveSessionsCount(data.activeSessionsCount ?? 0);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          "Failed to load malpractice control settings."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchViolationLogs = async () => {
    try {
      setEventsLoading(true);
      const params: Record<string, string> = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (eventTypeFilter !== "all") params.eventType = eventTypeFilter;
      if (reviewStatusFilter !== "all")
        params.reviewStatus = reviewStatusFilter;

      const res = await api.get("/admin/malpractice/events", { params });
      setEvents(Array.isArray(res.data?.events) ? res.data.events : []);
      if (res.data?.summary) {
        setEventsSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch violation logs:", err);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchMalpracticeSettings();
    fetchViolationLogs();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchViolationLogs();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery, eventTypeFilter, reviewStatusFilter]);

  const handleToggleSwitch = (key: keyof MalpracticeSettingsData) => {
    setSuccessMessage("");
    setErrorMessage("");
    setFormSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const res = await api.put("/admin/malpractice/settings", formSettings);
      const data = res.data;
      const updated: MalpracticeSettingsData = {
        masterEnabled: Boolean(data.masterEnabled),
        disableCopy: Boolean(data.disableCopy),
        disableCut: Boolean(data.disableCut),
        disablePaste: Boolean(data.disablePaste),
        disableRightClick: Boolean(data.disableRightClick),
        detectDevtoolsShortcuts: Boolean(data.detectDevtoolsShortcuts),
        detectTabSwitch: Boolean(data.detectTabSwitch),
        detectWindowFocus: Boolean(data.detectWindowFocus),
        showStudentWarnings: Boolean(data.showStudentWarnings),
        enableViolationLogging: Boolean(data.enableViolationLogging),
        violationThreshold: Number(data.violationThreshold) || 3,
      };
      setFormSettings(updated);
      setSavedSettings(updated);
      setEffectiveSettings(
        data.effectiveSettings || data.effective || updated
      );
      setUpdatedAt(data.updatedAt || new Date().toISOString());
      setUpdatedByName(data.updatedByName || "Admin Faculty");
      setActiveSessionsCount(data.activeSessionsCount ?? activeSessionsCount);
      setSuccessMessage(
        data.message || "Malpractice settings saved and applied successfully."
      );

      // Broadcast immediate update for any student tabs open in the same browser
      try {
        localStorage.setItem(
          "codelab_malpractice_sync",
          JSON.stringify({
            updatedAt: data.updatedAt || new Date().toISOString(),
            effectiveSettings: data.effectiveSettings || data.effective,
          })
        );
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("codelab_malpractice_config");
          channel.postMessage({
            type: "MALPRACTICE_CONFIG_UPDATED",
            effectiveSettings: data.effectiveSettings || data.effective,
            settings: updated,
          });
          channel.close();
        }
      } catch {
        // Ignore cross-tab broadcast errors
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          "Failed to save malpractice configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateReviewStatus = async (
    eventId: number,
    newStatus: "pending" | "reviewed" | "dismissed" | "flagged"
  ) => {
    try {
      setUpdatingEventId(eventId);
      await api.patch(`/admin/malpractice/events/${eventId}`, {
        reviewStatus: newStatus,
      });
      await fetchViolationLogs();
      if (inspectingEvent && inspectingEvent.id === eventId) {
        setInspectingEvent({
          ...inspectingEvent,
          reviewStatus: newStatus,
          reviewedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("Error updating review status:", err);
    } finally {
      setUpdatingEventId(null);
    }
  };

  const individualSwitches: {
    key: Exclude<keyof MalpracticeSettingsData, "masterEnabled" | "violationThreshold">;
    number: number;
    title: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    {
      key: "disableCopy",
      number: 2,
      title: "Disable Copy",
      description:
        "Blocks Ctrl+C / Cmd+C, browser copy clipboard events, and Monaco Editor internal copy commands.",
      icon: Clipboard,
    },
    {
      key: "disableCut",
      number: 3,
      title: "Disable Cut",
      description:
        "Blocks Ctrl+X / Cmd+X, browser cut clipboard events, and Monaco Editor internal cut commands without erasing code.",
      icon: Scissors,
    },
    {
      key: "disablePaste",
      number: 4,
      title: "Disable Paste",
      description:
        "Blocks Ctrl+V, Ctrl+Shift+V, Shift+Insert, Cmd+V, Cmd+Shift+V, browser paste events, and Monaco paste actions.",
      icon: ClipboardPaste,
    },
    {
      key: "disableRightClick",
      number: 5,
      title: "Disable Right-Click",
      description:
        "Prevents browser contextmenu events across the problem statement, Monaco Editor, and assessment workspace.",
      icon: MousePointerClick,
    },
    {
      key: "detectDevtoolsShortcuts",
      number: 6,
      title: "Developer Tools Shortcut Detection",
      description:
        "Intercepts F12, Ctrl+Shift+I/J/C, Ctrl+U, and macOS Cmd+Option+I/J/C shortcuts where allowed by the browser.",
      icon: Terminal,
    },
    {
      key: "detectTabSwitch",
      number: 7,
      title: "Tab-Switch Detection",
      description:
        "Monitors Page Visibility API (visibilitychange) to detect when a student switches away from the assessment tab.",
      icon: AppWindow,
    },
    {
      key: "detectWindowFocus",
      number: 8,
      title: "Window-Focus Detection",
      description:
        "Monitors browser window blur and focus changes with debouncing to avoid false duplicate events.",
      icon: Focus,
    },
    {
      key: "showStudentWarnings",
      number: 9,
      title: "Student Warning Messages",
      description:
        "Displays non-disruptive in-workspace warning banners when restricted actions occur without stealing editor focus.",
      icon: Bell,
    },
    {
      key: "enableViolationLogging",
      number: 10,
      title: "Violation Logging",
      description:
        "Records detected malpractice attempts to the Turso database with server timestamps for faculty review.",
      icon: FileWarning,
    },
  ];

  if (loading) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Loading anti-malpractice configuration from server...
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="malpractice-control-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Malpractice Control
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Configure anti-malpractice restrictions, Monaco Editor clipboard locks, shortcut deterrence, and violation logging across student assessments.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              fetchMalpracticeSettings();
              fetchViolationLogs();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Status
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveSettings()}
            data-testid="save-malpractice-settings-btn"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Status / Error Alerts */}
      {errorMessage && (
        <div
          role="alert"
          data-testid="malpractice-error-alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-800 font-medium"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          data-testid="malpractice-success-alert"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-sm text-emerald-800 font-medium"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 10 Configurable Switches (8 cols) */}
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          {/* Switch #1: Master Malpractice Monitoring */}
          <div
            className={`p-6 border-b transition-colors ${
              formSettings.masterEnabled
                ? "bg-blue-50/50 border-blue-100"
                : "bg-amber-50/60 border-amber-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                {formSettings.masterEnabled ? (
                  <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldOff className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-700">
                      Switch 1 · Master Control
                    </span>
                    <span
                      data-testid="master-switch-status-label"
                      className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${
                        formSettings.masterEnabled
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}
                    >
                      {formSettings.masterEnabled ? "ON" : "OFF"}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    1. Master Malpractice Monitoring
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {formSettings.masterEnabled
                      ? "Master monitoring is ON. Each individual restriction below is enforced according to its saved ON/OFF switch."
                      : "Master monitoring is OFF. This overrides all individual switches: copy, cut, paste, and right-click are restored, warnings are silenced, and new violation logging is paused while historical logs are preserved."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={formSettings.masterEnabled}
                aria-label="Master Malpractice Monitoring"
                data-testid="switch-masterEnabled"
                onClick={() => handleToggleSwitch("masterEnabled")}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  formSettings.masterEnabled ? "bg-blue-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${
                    formSettings.masterEnabled
                      ? "translate-x-5"
                      : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Individual Switches 2-10 */}
          <div className="divide-y divide-slate-100">
            {individualSwitches.map((item) => {
              const Icon = item.icon;
              const isChecked = Boolean(formSettings[item.key]);
              const isOverriddenOff = !formSettings.masterEnabled;

              return (
                <div
                  key={item.key}
                  className={`px-6 py-4 flex items-center justify-between gap-4 transition-colors ${
                    isOverriddenOff ? "bg-slate-50/70" : "hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <Icon
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        !isOverriddenOff && isChecked
                          ? "text-blue-600"
                          : "text-slate-400"
                      }`}
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {item.number}. {item.title}
                        </span>
                        <span
                          className={`text-[11px] font-mono font-bold uppercase ${
                            isChecked ? "text-emerald-700" : "text-slate-500"
                          }`}
                        >
                          {isChecked ? "ON" : "OFF"}
                        </span>
                        {isOverriddenOff && isChecked && (
                          <span className="text-[11px] text-amber-700 font-medium">
                            (Overridden OFF by Master Switch)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isChecked}
                    aria-label={item.title}
                    data-testid={`switch-${item.key}`}
                    onClick={() => handleToggleSwitch(item.key)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      isChecked
                        ? isOverriddenOff
                          ? "bg-blue-400"
                          : "bg-blue-600"
                        : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${
                        isChecked ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </form>

        {/* Right Column: Authoritative Configuration Status (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
            data-testid="current-malpractice-status-panel"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Current Configuration Status
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authoritative settings persisted in Turso
                </p>
              </div>
              <ShieldAlert
                className={`w-5 h-5 shrink-0 ${
                  savedSettings.masterEnabled
                    ? "text-blue-600"
                    : "text-amber-600"
                }`}
              />
            </div>

            <dl className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Master Monitoring</dt>
                <dd
                  data-testid="saved-master-status"
                  className={`font-bold uppercase ${
                    savedSettings.masterEnabled
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                >
                  {savedSettings.masterEnabled
                    ? "ACTIVE (ON)"
                    : "SUSPENDED (OFF)"}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Effective Copy Lock</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {effectiveSettings.disableCopy ? "Restricted" : "Allowed"}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Effective Cut Lock</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {effectiveSettings.disableCut ? "Restricted" : "Allowed"}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Effective Paste Lock</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {effectiveSettings.disablePaste ? "Restricted" : "Allowed"}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Effective Right-Click</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {effectiveSettings.disableRightClick
                    ? "Restricted"
                    : "Allowed"}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">DevTools Shortcuts</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {effectiveSettings.detectDevtoolsShortcuts
                    ? "Monitored"
                    : "Off"}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Tab-Switch Detection</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {effectiveSettings.detectTabSwitch ? "Monitored" : "Off"}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Window-Focus Detection</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {effectiveSettings.detectWindowFocus ? "Monitored" : "Off"}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Student Warnings</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {effectiveSettings.showStudentWarnings ? "Enabled" : "Hidden"}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Violation Logging</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {effectiveSettings.enableViolationLogging
                    ? "Recording"
                    : "Paused"}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Active Sessions</dt>
                <dd className="font-mono tabular-nums font-bold text-blue-700">
                  {activeSessionsCount}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Updated By</dt>
                <dd className="font-medium text-slate-800">{updatedByName}</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-500">Last Updated</dt>
                <dd className="font-mono tabular-nums text-slate-600">
                  {updatedAt ? new Date(updatedAt).toLocaleString() : "Default"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Violation Logs Section */}
      <div
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        data-testid="violation-logs-section"
      >
        <div className="p-6 border-b border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Detected Malpractice Violation Logs
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Historical records are preserved even when Violation Logging or Master Monitoring is turned OFF. Clipboard contents and credentials are never stored.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-600">
              <span>
                Total: <strong>{eventsSummary.totalCount}</strong>
              </span>
              <span>·</span>
              <span>
                Pending: <strong className="text-amber-700">{eventsSummary.pendingCount}</strong>
              </span>
              <span>·</span>
              <span>
                Flagged: <strong className="text-red-700">{eventsSummary.flaggedCount}</strong>
              </span>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roll no, student name, or test..."
                data-testid="violation-logs-search"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                data-testid="violation-logs-type-filter"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Event Types</option>
                <option value="copy_attempt">Copy Attempt (copy_attempt)</option>
                <option value="cut_attempt">Cut Attempt (cut_attempt)</option>
                <option value="paste_attempt">Paste Attempt (paste_attempt)</option>
                <option value="context_menu_attempt">
                  Right-Click Attempt (context_menu_attempt)
                </option>
                <option value="devtools_shortcut_attempt">
                  DevTools Shortcut (devtools_shortcut_attempt)
                </option>
                <option value="tab_visibility_changed">
                  Tab Switch (tab_visibility_changed)
                </option>
                <option value="window_focus_lost">
                  Window Focus Lost (window_focus_lost)
                </option>
              </select>
            </div>

            <div>
              <select
                value={reviewStatusFilter}
                onChange={(e) => setReviewStatusFilter(e.target.value)}
                data-testid="violation-logs-status-filter"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Review Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="reviewed">Reviewed</option>
                <option value="flagged">Flagged</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3">Event ID / Time</th>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">Session / Assessment</th>
                <th className="px-6 py-3">Event Type</th>
                <th className="px-6 py-3">Review Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {eventsLoading && events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Loading violation logs...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No malpractice events match the current filters.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      <div className="font-bold text-slate-900">#{ev.id}</div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(ev.serverTimestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-slate-900">
                        {ev.studentRollNumber || `Student #${ev.studentId}`}
                      </div>
                      <div className="text-slate-500">
                        {ev.studentName || "Unknown"}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="font-mono text-slate-800">
                        Session #{ev.sessionId}
                      </div>
                      <div className="text-slate-500">
                        {ev.assessmentTitle || `Assessment #${ev.assessmentId}`}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-mono font-semibold text-slate-900">
                        {ev.eventType}
                      </span>
                      <div className="text-slate-500">
                        {EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <select
                        value={ev.reviewStatus}
                        disabled={updatingEventId === ev.id}
                        onChange={(e) =>
                          handleUpdateReviewStatus(
                            ev.id,
                            e.target.value as any
                          )
                        }
                        className={`px-2.5 py-1 rounded border text-xs font-semibold ${
                          ev.reviewStatus === "flagged"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : ev.reviewStatus === "reviewed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : ev.reviewStatus === "dismissed"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="flagged">Flagged</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setInspectingEvent(ev)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Detail Inspection Modal */}
      {inspectingEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Violation Event #{inspectingEvent.id}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {inspectingEvent.eventType} ·{" "}
                  {new Date(inspectingEvent.serverTimestamp).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingEvent(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">Student</span>
                <span className="font-semibold text-slate-900 block mt-0.5">
                  {inspectingEvent.studentRollNumber} ({inspectingEvent.studentName})
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">Assessment Session</span>
                <span className="font-mono font-semibold text-slate-900 block mt-0.5">
                  Session #{inspectingEvent.sessionId} ·{" "}
                  {inspectingEvent.assessmentTitle}
                </span>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                Active Configuration Snapshot at Event Time
              </span>
              <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                {JSON.stringify(inspectingEvent.relevantConfiguration, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Review Status:
                </span>
                {(
                  ["pending", "reviewed", "flagged", "dismissed"] as const
                ).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      handleUpdateReviewStatus(inspectingEvent.id, st)
                    }
                    className={`px-2.5 py-1 rounded text-xs font-semibold capitalize border ${
                      inspectingEvent.reviewStatus === st
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setInspectingEvent(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
