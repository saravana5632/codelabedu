import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api.ts";
import {
  GraduationCap,
  Briefcase,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
} from "lucide-react";

export default function Login() {
  const [loginType, setLoginType] = useState<"student" | "faculty">("student");

  // Student Login State
  const [rollNumber, setRollNumber] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // Faculty Login State
  const [email, setEmail] = useState("");
  const [facultyPassword, setFacultyPassword] = useState("");
  const [showFacultyPassword, setShowFacultyPassword] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const payload =
        loginType === "student"
          ? {
              loginType: "student",
              rollNumber: rollNumber.trim(),
              password: studentPassword,
            }
          : {
              loginType: "faculty",
              email: email.trim(),
              password: facultyPassword,
            };

      const res = await api.post("/login", payload);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      if (res.data.user.role === "student") {
        navigate("/student");
      } else {
        navigate("/faculty");
      }
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.message || "Invalid roll number or password");
    } finally {
      setIsLoading(false);
    }
  };

  const switchTab = (tab: "student" | "faculty") => {
    setLoginType(tab);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="mt-6 text-3xl font-bold text-gray-900 tracking-tight">
          CodeLab
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Classroom Programming Assessment Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-gray-100">
          <div className="flex gap-4 mb-8">
            <button
              type="button"
              onClick={() => switchTab("student")}
              className={`flex-1 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                loginType === "student"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-500 hover:bg-gray-50 border border-transparent"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Student
            </button>
            <button
              type="button"
              onClick={() => switchTab("faculty")}
              className={`flex-1 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                loginType === "faculty"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-500 hover:bg-gray-50 border border-transparent"
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Faculty
            </button>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            {loginType === "student" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Roll Number
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      required
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      autoComplete="username"
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="e.g. 2024PECCB001"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type={showStudentPassword ? "text" : "password"}
                      required
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      autoComplete="current-password"
                      className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStudentPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                      aria-label={
                        showStudentPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showStudentPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="mt-1">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="mail"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type={showFacultyPassword ? "text" : "password"}
                      required
                      value={facultyPassword}
                      onChange={(e) => setFacultyPassword(e.target.value)}
                      autoComplete="current-password"
                      className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter faculty password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFacultyPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                      aria-label={
                        showFacultyPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showFacultyPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Lock className="w-4 h-4" />
                {isLoading ? "Signing in..." : "Login"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

