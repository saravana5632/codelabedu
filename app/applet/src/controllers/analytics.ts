import { Response } from "express";
import { db } from "../db/index.js";
import { tests, questions, submissions, students } from "../db/schema.js";
import { eq, inArray, count } from "drizzle-orm";
import { AuthRequest } from "../middleware/authMiddleware.js";

export const getAnalyticsDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const totalStudentsObj = await db.select({ count: count() }).from(students).get();
    const totalTestsObj = await db.select({ count: count() }).from(tests).get();
    const activeTestsObj = await db.select({ count: count() }).from(tests).where(eq(tests.status, "published")).get();
    const completedTestsObj = await db.select({ count: count() }).from(tests).where(eq(tests.status, "completed")).get();
    const totalSubmissionsObj = await db.select({ count: count() }).from(submissions).get();
    
    const allSubsForPassRate = await db.select({ status: submissions.status }).from(submissions).all();
    const passedCount = allSubsForPassRate.filter(s => s.status && (s.status.toLowerCase().includes('accepted') || s.status.toLowerCase().includes('pass'))).length;
    
    let avgPassPercentage = 0;
    if (allSubsForPassRate.length > 0) {
      avgPassPercentage = Number(((passedCount / allSubsForPassRate.length) * 100).toFixed(1));
    }

    res.json({
      totalStudents: totalStudentsObj?.count || 0,
      totalTests: totalTestsObj?.count || 0,
      activeTests: activeTestsObj?.count || 0,
      completedTests: completedTestsObj?.count || 0,
      upcomingTests: 0,
      totalSubmissions: totalSubmissionsObj?.count || 0,
      avgPassPercentage: avgPassPercentage,
      totalFaculty: 1
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    res.status(500).json({ message: "Error fetching dashboard summary" });
  }
};

export const getTestAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const testId = parseInt(req.params.testId);

    // Total students
    const totalStudentsObj = await db.select({ count: count() }).from(students).get();
    const totalStudents = totalStudentsObj?.count || 0;

    // Get test info
    const testObj = await db.select().from(tests).where(eq(tests.id, testId)).get();

    // Get all questions for test
    const testQs = await db.select({ id: questions.id }).from(questions).where(eq(questions.testId, testId)).all();
    const qIds = testQs.map(q => q.id);

    if (qIds.length === 0) {
      return res.json({
        test: testObj || null,
        summary: {
          totalStudents,
          started: 0,
          submitted: 0,
          notSubmitted: totalStudents,
          passCount: 0,
          failCount: 0,
          avgScore: 0,
          highestScore: 0,
          lowestScore: 0,
          avgExecTime: "0ms"
        },
        languageUsage: [],
        submissions: [],
        allSubmissions: [],
        passFail: [
          { name: "Pass", value: 0 },
          { name: "Fail", value: 0 }
        ],
        scoreDistribution: [
          { range: "0-20", count: 0 },
          { range: "21-40", count: 0 },
          { range: "41-60", count: 0 },
          { range: "61-80", count: 0 },
          { range: "81-100", count: 0 }
        ],
        timeline: []
      });
    }

    // Raw submissions for these questions
    const rawSubs = await db.select({
      id: submissions.id,
      studentId: submissions.studentId,
      questionId: submissions.questionId,
      language: submissions.language,
      status: submissions.status,
      submittedAt: submissions.submittedAt,
      studentName: students.name,
      studentRoll: students.rollNumber
    }).from(submissions)
      .innerJoin(students, eq(submissions.studentId, students.id))
      .where(inArray(submissions.questionId, qIds)).all();

    let allSubs = rawSubs.map(s => {
      const isPass = s.status ? (s.status.toLowerCase().includes('accepted') || s.status.toLowerCase().includes('pass')) : false;
      return {
        ...s,
        score: isPass ? 100 : 0,
        execTimeMs: isPass ? 20 : 0
      };
    });

    // Aggregate by student
    const studentAggregates: Record<number, any> = {};
    allSubs.forEach(s => {
      if (!studentAggregates[s.studentId]) {
        studentAggregates[s.studentId] = {
          id: s.studentId,
          studentId: s.studentId,
          studentRoll: s.studentRoll,
          studentName: s.studentName,
          language: s.language || "Python",
          status: s.status || "Submitted",
          score: 0,
          execTimeMs: 0,
          submittedAt: s.submittedAt
        };
      }
      studentAggregates[s.studentId].score += s.score;
      studentAggregates[s.studentId].execTimeMs += (s.execTimeMs || 0);
      if (new Date(s.submittedAt) > new Date(studentAggregates[s.studentId].submittedAt)) {
        studentAggregates[s.studentId].submittedAt = s.submittedAt;
        studentAggregates[s.studentId].language = s.language || studentAggregates[s.studentId].language;
        studentAggregates[s.studentId].status = s.status || studentAggregates[s.studentId].status;
      }
    });

    const aggregatedSubs = Object.values(studentAggregates);
    const submittedCount = aggregatedSubs.length;
    const uniqueStudents = submittedCount;

    // We consider "pass" if they got > 0 on the whole assessment
    const passCount = aggregatedSubs.filter(s => s.score > 0).length;
    const failCount = submittedCount - passCount;

    let totalScore = 0;
    let highestScore = 0;
    let lowestScore = submittedCount > 0 ? 100 * qIds.length : 0;
    let totalExecTime = 0;

    aggregatedSubs.forEach(s => {
      totalScore += s.score;
      highestScore = Math.max(highestScore, s.score);
      lowestScore = Math.min(lowestScore, s.score);
      if (s.execTimeMs) totalExecTime += s.execTimeMs;
    });

    const avgScore = submittedCount > 0 ? Math.round(totalScore / submittedCount) : 0;
    if (submittedCount === 0) {
      lowestScore = 0;
    }
    const avgExecTime = submittedCount > 0 ? Math.round(totalExecTime / submittedCount) : 0;

    // Language Usage
    const langUsage: Record<string, number> = {};
    allSubs.forEach(s => {
      const l = s.language || "Unknown";
      langUsage[l] = (langUsage[l] || 0) + 1;
    });

    // Score distribution (0-20, 21-40, etc)
    const scoreDistribution = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0
    };

    aggregatedSubs.forEach(s => {
      if (s.score <= 20) scoreDistribution['0-20']++;
      else if (s.score <= 40) scoreDistribution['21-40']++;
      else if (s.score <= 60) scoreDistribution['41-60']++;
      else if (s.score <= 80) scoreDistribution['61-80']++;
      else scoreDistribution['81-100']++;
    });

    // Timeline data (group by minute)
    const timelineMap: Record<string, number> = {};
    allSubs.forEach(s => {
      const d = new Date(s.submittedAt);
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      timelineMap[timeStr] = (timelineMap[timeStr] || 0) + 1;
    });

    const timelineData = Object.keys(timelineMap).sort().map(time => ({
      time,
      submissions: timelineMap[time]
    }));

    res.json({
      test: testObj || null,
      summary: {
        totalStudents,
        started: uniqueStudents,
        submitted: submittedCount,
        notSubmitted: Math.max(0, totalStudents - uniqueStudents),
        passCount,
        failCount,
        avgScore,
        highestScore,
        lowestScore,
        avgExecTime: `${avgExecTime}ms`
      },
      languageUsage: Object.entries(langUsage).map(([name, count]) => ({ name, count })),
      submissions: aggregatedSubs,
      allSubmissions: allSubs,
      passFail: [
        { name: "Pass", value: passCount },
        { name: "Fail", value: failCount }
      ],
      scoreDistribution: Object.entries(scoreDistribution).map(([range, count]) => ({ range, count })),
      timeline: timelineData
    });
  } catch (error) {
    console.error("Test analytics error:", error);
    res.status(500).json({ message: "Error fetching test analytics" });
  }
};
