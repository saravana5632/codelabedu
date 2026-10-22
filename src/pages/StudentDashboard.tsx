import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api.ts";
import {
  LogOut,
  PlayCircle,
  CheckCircle,
  Clock,
  KeyRound,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function StudentDashboard() {
  const [tests, setTests] = useState<any[]>([]);
  const [completedTests, setCompletedTests] = useState<any[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const testsRes = await api.get("/student/tests");
      setTests(
        Array.isArray(testsRes.data?.available)
          ? testsRes.data.available
          : Array.isArray(testsRes.data)
          ? testsRes.data
          : []
      );
      setCompletedTests(
        Array.isArray(testsRes.data?.completed) ? testsRes.data.completed : []
      );
    } catch (err) {
      if ((err as any).response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore logout network error
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    setPwdSuccess("");

    if (!currentPassword || !newPassword) {
      setPwdError("Current password and new password are required");
      return;
    }

    if (newPassword.length < 8) {
      setPwdError("New password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError("New password and confirm password do not match");
      return;
    }

    setIsUpdatingPwd(true);
    try {
      const res = await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.data?.token) {
        localStorage.setItem("token", res.data.token);
      }

      setPwdSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPwdSuccess("");
      }, 1200);
    } catch (err: any) {
      setPwdError(
        err.response?.data?.message || "Failed to update password"
      );
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  const formatDurationLabel = (test: any) => {
    if (test.timerEnabled === false) {
      return "Untimed (Timer Disabled)";
    }
    const mins = Number(test.durationMinutes ?? test.duration ?? 60);
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs > 0 && rem > 0) return `${hrs}h ${rem}m (${mins} Minutes)`;
    if (hrs > 0) return `${hrs}h (${mins} Minutes)`;
    return `${mins} Minutes`;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">CodeLab</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">
              {user.name} ({user.rollNumber})
            </span>
            <button
              onClick={() => {
                setPwdError("");
                setPwdSuccess("");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setShowPasswordModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Change Password"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Change Password
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-900"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Available Assessments
          </h2>
          {tests.length > 0 ? (
            <div className="space-y-4">
              {tests.map((test) => {
                const isInProgress = test.sessionStatus === "active";
                return (
                  <div
                    key={test.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {test.title}
                        </h3>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <p>
                            Subject:{" "}
                            <span className="font-medium text-gray-900">
                              {test.subject}
                            </span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-blue-600" />
                            Duration:{" "}
                            <span className="font-mono tabular-nums font-semibold text-gray-900">
                              {formatDurationLabel(test)}
                            </span>
                          </p>
                          <p>
                            Status:{" "}
                            <span
                              className={`font-semibold ${
                                isInProgress
                                  ? "text-blue-700"
                                  : "text-emerald-700"
                              }`}
                            >
                              {isInProgress
                                ? "In Progress (Timer Running)"
                                : "Available"}
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/test/${test.id}/selection`)}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none whitespace-nowrap"
                      >
                        <PlayCircle className="w-5 h-5" />
                        {isInProgress ? "Resume Test" : "Start Test"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              No Programming Tests Available
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Completed Assessments
          </h2>
          {completedTests.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <ul className="divide-y divide-gray-200">
                {completedTests.map((t, idx) => (
                  <li
                    key={idx}
                    className="p-4 sm:px-6 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {t.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Subject: {t.subject} · Duration:{" "}
                        {t.durationMinutes ?? t.duration} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-xs font-semibold text-gray-700">
                        {t.sessionStatus === "expired"
                          ? "Auto-Submitted (Time Expired)"
                          : "Completed"}
                      </span>
                      <CheckCircle className="w-5 h-5 text-green-500 ml-1" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-sm text-gray-500">
              No completed assessments yet.
            </div>
          )}
        </div>
      </main>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900">
                  Change Account Password
                </h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Current Password
                </label>
                <div className="mt-1 relative">
                  <input
                    type={showPasswords ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPasswords ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <input
                  type={showPasswords ? "text" : "password"}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>
                <input
                  type={showPasswords ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Re-enter new password"
                />
              </div>

              {pwdError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              {pwdSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPwd}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
                >
                  {isUpdatingPwd ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
