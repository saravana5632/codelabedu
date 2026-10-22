import React, { useEffect, useState } from "react";
import api from "../../lib/api.ts";
import {
  Search,
  UserCircle,
  Users,
  UserPlus,
  KeyRound,
  Edit3,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
} from "lucide-react";

export default function StudentManagement() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [bannerMessage, setBannerMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Add / Edit Student Modal State
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [formRollNumber, setFormRollNumber] = useState("");
  const [formName, setFormName] = useState("");
  const [formDepartment, setFormDepartment] = useState(
    "Computer Science and Business Systems"
  );
  const [formRegisterNumber, setFormRegisterNumber] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  // Password Reset Modal State
  const [resetTargetStudent, setResetTargetStudent] = useState<any | null>(
    null
  );
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await api.get("/faculty/students");
      if (Array.isArray(res.data)) {
        setStudents(res.data);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingStudent(null);
    setFormRollNumber("");
    setFormName("");
    setFormDepartment("Computer Science and Business Systems");
    setFormRegisterNumber("");
    setFormPassword("");
    setFormError("");
    setShowStudentModal(true);
  };

  const openEditModal = (student: any) => {
    setEditingStudent(student);
    setFormRollNumber(student.rollNumber || "");
    setFormName(student.name || "");
    setFormDepartment(
      student.department || "Computer Science and Business Systems"
    );
    setFormRegisterNumber(String(student.registerNumber || ""));
    setFormPassword("");
    setFormError("");
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSavingStudent(true);

    try {
      const regNum = Number(formRegisterNumber.trim());
      if (isNaN(regNum) || regNum <= 0) {
        setFormError("Register Number must be a valid positive number");
        setIsSavingStudent(false);
        return;
      }

      if (editingStudent) {
        const res = await api.put(`/faculty/students/${editingStudent.id}`, {
          rollNumber: formRollNumber.trim(),
          name: formName.trim(),
          department: formDepartment.trim(),
          registerNumber: regNum,
        });
        setBannerMessage({
          type: "success",
          text: res.data?.message || "Student updated successfully",
        });
      } else {
        const res = await api.post("/faculty/students", {
          rollNumber: formRollNumber.trim(),
          name: formName.trim(),
          department: formDepartment.trim(),
          registerNumber: regNum,
          ...(formPassword ? { password: formPassword } : {}),
        });
        setBannerMessage({
          type: "success",
          text: res.data?.message || "Student created successfully",
        });
      }

      setShowStudentModal(false);
      await fetchStudents();
    } catch (err: any) {
      setFormError(
        err.response?.data?.message || "Failed to save student record"
      );
    } finally {
      setIsSavingStudent(false);
    }
  };

  const openResetPasswordModal = (student: any) => {
    setResetTargetStudent(student);
    setResetNewPassword("");
    setResetError("");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetStudent) return;
    setResetError("");
    setIsResetting(true);

    try {
      const res = await api.post(
        `/faculty/students/${resetTargetStudent.id}/reset-password`,
        {
          mode: "set_password",
          newPassword: resetNewPassword,
        }
      );
      setBannerMessage({
        type: "success",
        text:
          res.data?.message ||
          `Updated password credentials for ${resetTargetStudent.name}`,
      });
      setResetTargetStudent(null);
      await fetchStudents();
    } catch (err: any) {
      setResetError(
        err.response?.data?.message || "Failed to reset student password"
      );
    } finally {
      setIsResetting(false);
    }
  };

  const filteredStudents = students.filter((student) => {
    const q = searchTerm.toLowerCase();
    return (
      String(student.name || "")
        .toLowerCase()
        .includes(q) ||
      String(student.rollNumber || "")
        .toLowerCase()
        .includes(q) ||
      String(student.registerNumber || "").includes(q) ||
      String(student.department || "")
        .toLowerCase()
        .includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Student & Credential Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage registered students, university register numbers, and password
            credentials.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      {bannerMessage && (
        <div
          className={`p-4 rounded-lg border flex items-center justify-between ${
            bannerMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {bannerMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Loading students...
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <Users className="w-4 h-4" />
                <span className="font-semibold">
                  Total Registered Students: {students.length}
                </span>
              </div>
            </div>

            <div className="relative w-full lg:w-72">
              <input
                type="text"
                placeholder="Search name, roll no, reg no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roll Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Register Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auth Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-9 w-9 bg-gray-100 rounded-full flex items-center justify-center">
                            <UserCircle className="h-5 w-5 text-gray-400" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {student.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                        {student.rollNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono tabular-nums text-gray-600">
                        {student.registerNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.department || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Password Active
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => openEditModal(student)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                          title="Edit Student"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => openResetPasswordModal(student)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Reset Password
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-gray-500"
                    >
                      No students found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                {editingStudent ? "Edit Student Record" : "Add New Student"}
              </h3>
              <button
                onClick={() => setShowStudentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Roll Number
                </label>
                <input
                  type="text"
                  required
                  value={formRollNumber}
                  onChange={(e) => setFormRollNumber(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 2024PECCB353"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Student Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  University Register Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={formRegisterNumber}
                  onChange={(e) => setFormRegisterNumber(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 211424244353"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                <input
                  type="text"
                  required
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {!editingStudent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type={showFormPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Minimum 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword((p) => !p)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showFormPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
                >
                  {isSavingStudent ? "Saving..." : "Save Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900">
                  Reset Student Password
                </h3>
              </div>
              <button
                onClick={() => setResetTargetStudent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700 space-y-1">
                <p>
                  <span className="font-semibold">Student:</span>{" "}
                  {resetTargetStudent.name}
                </p>
                <p>
                  <span className="font-semibold">Roll Number:</span>{" "}
                  <span className="font-mono">
                    {resetTargetStudent.rollNumber}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Register Number:</span>{" "}
                  <span className="font-mono">
                    {resetTargetStudent.registerNumber}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="mt-1 relative">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showResetPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  The password will be securely hashed with bcrypt and all
                  existing sessions for this student will be invalidated.
                </p>
              </div>

              {resetError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetStudent(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
                >
                  {isResetting ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

