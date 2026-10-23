import { Response } from "express";
import { db } from "../db/index.js";
import {
  malpracticeSettings,
  malpracticeEvents,
  assessmentSessions,
  students,
  tests,
  faculty,
} from "../db/schema.js";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { AuthRequest } from "../middleware/authMiddleware.js";
import { ensureTimerTables } from "../db/migrate.js";

export const ALLOWED_EVENT_TYPES = [
  "copy_attempt",
  "cut_attempt",
  "paste_attempt",
  "context_menu_attempt",
  "devtools_shortcut_attempt",
  "tab_visibility_changed",
  "window_focus_lost",
  "fullscreen_exited",
] as const;

export type MalpracticeEventType = (typeof ALLOWED_EVENT_TYPES)[number];

export interface MalpracticeFlags {
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
}

export interface AuthoritativeMalpracticeConfig extends MalpracticeFlags {
  id: number;
  violationThreshold: number;
  updatedAt: string;
  updatedBy: number | null;
  updatedByName: string | null;
  effective: MalpracticeFlags & {
    violationThreshold: number;
  };
}

// Short-TTL in-memory cache to serve 3,500 concurrent students without hitting Turso on every request,
// while remaining consistent across multiple backend instances within a few seconds.
const SETTINGS_CACHE_TTL_MS = 3000;
let cachedConfig: AuthoritativeMalpracticeConfig | null = null;
let cacheExpiresAt = 0;

// Per-session rate limiter & deduplication map to prevent event flooding under 3,500 concurrent users
interface SessionRateState {
  lastEventByType: Record<string, number>;
  windowStartMs: number;
  eventsInWindow: number;
}
const sessionRateMap = new Map<number, SessionRateState>();
const MAX_EVENTS_PER_MINUTE_PER_SESSION = 40;

export function invalidateMalpracticeCache() {
  cachedConfig = null;
  cacheExpiresAt = 0;
}

export function computeEffectiveFlags(
  raw: MalpracticeFlags,
  violationThreshold = 3
): MalpracticeFlags & { violationThreshold: number } {
  if (!raw.masterEnabled) {
    return {
      masterEnabled: false,
      disableCopy: false,
      disableCut: false,
      disablePaste: false,
      disableRightClick: false,
      detectDevtoolsShortcuts: false,
      detectTabSwitch: false,
      detectWindowFocus: false,
      showStudentWarnings: false,
      enableViolationLogging: false,
      violationThreshold,
    };
  }

  return {
    masterEnabled: true,
    disableCopy: Boolean(raw.disableCopy),
    disableCut: Boolean(raw.disableCut),
    disablePaste: Boolean(raw.disablePaste),
    disableRightClick: Boolean(raw.disableRightClick),
    detectDevtoolsShortcuts: Boolean(raw.detectDevtoolsShortcuts),
    detectTabSwitch: Boolean(raw.detectTabSwitch),
    detectWindowFocus: Boolean(raw.detectWindowFocus),
    showStudentWarnings: Boolean(raw.showStudentWarnings),
    enableViolationLogging: Boolean(raw.enableViolationLogging),
    violationThreshold,
  };
}

export async function getAuthoritativeMalpracticeConfig(
  forceRefresh = false
): Promise<AuthoritativeMalpracticeConfig> {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now < cacheExpiresAt) {
    return cachedConfig;
  }

  await ensureTimerTables();

  let row = await db
    .select()
    .from(malpracticeSettings)
    .orderBy(desc(malpracticeSettings.id))
    .limit(1)
    .get();

  if (!row) {
    const nowIso = new Date().toISOString();
    const fac = await db.select().from(faculty).limit(1).get();
    row = await db
      .insert(malpracticeSettings)
      .values({
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
        updatedAt: nowIso,
        updatedBy: fac?.id ?? null,
        updatedByName: fac?.name ?? "Admin Faculty",
      })
      .returning()
      .get();
  }

  const rawFlags: MalpracticeFlags = {
    masterEnabled: Boolean(row.masterEnabled),
    disableCopy: Boolean(row.disableCopy),
    disableCut: Boolean(row.disableCut),
    disablePaste: Boolean(row.disablePaste),
    disableRightClick: Boolean(row.disableRightClick),
    detectDevtoolsShortcuts: Boolean(row.detectDevtoolsShortcuts),
    detectTabSwitch: Boolean(row.detectTabSwitch),
    detectWindowFocus: Boolean(row.detectWindowFocus),
    showStudentWarnings: Boolean(row.showStudentWarnings),
    enableViolationLogging: Boolean(row.enableViolationLogging),
  };

  const threshold =
    typeof row.violationThreshold === "number" && row.violationThreshold > 0
      ? row.violationThreshold
      : 3;

  const config: AuthoritativeMalpracticeConfig = {
    id: row.id,
    ...rawFlags,
    violationThreshold: threshold,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy ?? null,
    updatedByName: row.updatedByName ?? "Admin Faculty",
    effective: computeEffectiveFlags(rawFlags, threshold),
  };

  cachedConfig = config;
  cacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS;
  return config;
}

/**
 * Checks whether a specific malpractice event type is currently enabled under the effective settings.
 */
export function isEventTypeRestrictionActive(
  eventType: MalpracticeEventType,
  effective: MalpracticeFlags
): boolean {
  if (!effective.masterEnabled) return false;

  switch (eventType) {
    case "copy_attempt":
      return effective.disableCopy;
    case "cut_attempt":
      return effective.disableCut;
    case "paste_attempt":
      return effective.disablePaste;
    case "context_menu_attempt":
      return effective.disableRightClick;
    case "devtools_shortcut_attempt":
      return effective.detectDevtoolsShortcuts;
    case "tab_visibility_changed":
      return effective.detectTabSwitch;
    case "window_focus_lost":
      return effective.detectWindowFocus;
    case "fullscreen_exited":
      return effective.detectTabSwitch || effective.detectWindowFocus;
    default:
      return false;
  }
}

/**
 * Computes the server-authoritative count of focus/tab violations for a given session.
 */
export async function getServerSessionFocusViolationCount(
  sessionId: number,
  effective: MalpracticeFlags
): Promise<number> {
  if (!effective.masterEnabled) return 0;

  const activeFocusTypes: string[] = [];
  if (effective.detectTabSwitch) {
    activeFocusTypes.push("tab_visibility_changed");
  }
  if (effective.detectWindowFocus) {
    activeFocusTypes.push("window_focus_lost");
  }
  if (activeFocusTypes.length === 0) return 0;

  const res = await db
    .select({ count: count() })
    .from(malpracticeEvents)
    .where(
      and(
        eq(malpracticeEvents.sessionId, sessionId),
        inArray(malpracticeEvents.eventType, activeFocusTypes)
      )
    )
    .get();

  return res?.count ?? 0;
}

// =========================================================
// ADMIN / FACULTY ENDPOINTS
// =========================================================

export const getAdminMalpracticeSettings = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const config = await getAuthoritativeMalpracticeConfig(true);

    const [activeSessObj, totalEventsObj, pendingEventsObj] = await Promise.all([
      db
        .select({ count: count() })
        .from(assessmentSessions)
        .where(eq(assessmentSessions.status, "active"))
        .get(),
      db.select({ count: count() }).from(malpracticeEvents).get(),
      db
        .select({ count: count() })
        .from(malpracticeEvents)
        .where(eq(malpracticeEvents.reviewStatus, "pending"))
        .get(),
    ]);

    return res.json({
      ...config,
      settings: {
        masterEnabled: config.masterEnabled,
        disableCopy: config.disableCopy,
        disableCut: config.disableCut,
        disablePaste: config.disablePaste,
        disableRightClick: config.disableRightClick,
        detectDevtoolsShortcuts: config.detectDevtoolsShortcuts,
        detectTabSwitch: config.detectTabSwitch,
        detectWindowFocus: config.detectWindowFocus,
        showStudentWarnings: config.showStudentWarnings,
        enableViolationLogging: config.enableViolationLogging,
        violationThreshold: config.violationThreshold,
      },
      effectiveSettings: config.effective,
      activeSessionsCount: activeSessObj?.count ?? 0,
      totalLoggedEventsCount: totalEventsObj?.count ?? 0,
      pendingReviewEventsCount: pendingEventsObj?.count ?? 0,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[GET ADMIN MALPRACTICE SETTINGS] Error:", error);
    return res.status(500).json({
      message: "Failed to load malpractice configuration settings.",
    });
  }
};

const BOOLEAN_SETTING_KEYS: (keyof MalpracticeFlags)[] = [
  "masterEnabled",
  "disableCopy",
  "disableCut",
  "disablePaste",
  "disableRightClick",
  "detectDevtoolsShortcuts",
  "detectTabSwitch",
  "detectWindowFocus",
  "showStudentWarnings",
  "enableViolationLogging",
];

export const updateAdminMalpracticeSettings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user || req.user.role !== "faculty") {
      return res.status(403).json({
        message: "Forbidden: Only faculty/administrators can update malpractice settings.",
      });
    }

    const current = await getAuthoritativeMalpracticeConfig(true);
    const body = req.body || {};

    // Validate boolean switches
    const nextFlags: MalpracticeFlags = {
      masterEnabled: current.masterEnabled,
      disableCopy: current.disableCopy,
      disableCut: current.disableCut,
      disablePaste: current.disablePaste,
      disableRightClick: current.disableRightClick,
      detectDevtoolsShortcuts: current.detectDevtoolsShortcuts,
      detectTabSwitch: current.detectTabSwitch,
      detectWindowFocus: current.detectWindowFocus,
      showStudentWarnings: current.showStudentWarnings,
      enableViolationLogging: current.enableViolationLogging,
    };

    for (const key of BOOLEAN_SETTING_KEYS) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== "boolean") {
          return res.status(400).json({
            message: `Invalid configuration value for '${key}': expected a boolean (true or false).`,
          });
        }
        nextFlags[key] = body[key];
      }
    }

    let nextThreshold = current.violationThreshold;
    if (body.violationThreshold !== undefined) {
      const parsed = Number(body.violationThreshold);
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
        return res.status(400).json({
          message:
            "Invalid violationThreshold: must be an integer between 1 and 50.",
        });
      }
      nextThreshold = parsed;
    }

    const fac = await db
      .select()
      .from(faculty)
      .where(eq(faculty.id, req.user.id))
      .get();

    const nowIso = new Date().toISOString();
    const adminName = fac?.name || "Admin Faculty";

    await db
      .update(malpracticeSettings)
      .set({
        masterEnabled: nextFlags.masterEnabled,
        disableCopy: nextFlags.disableCopy,
        disableCut: nextFlags.disableCut,
        disablePaste: nextFlags.disablePaste,
        disableRightClick: nextFlags.disableRightClick,
        detectDevtoolsShortcuts: nextFlags.detectDevtoolsShortcuts,
        detectTabSwitch: nextFlags.detectTabSwitch,
        detectWindowFocus: nextFlags.detectWindowFocus,
        showStudentWarnings: nextFlags.showStudentWarnings,
        enableViolationLogging: nextFlags.enableViolationLogging,
        violationThreshold: nextThreshold,
        updatedAt: nowIso,
        updatedBy: req.user.id,
        updatedByName: adminName,
      })
      .where(eq(malpracticeSettings.id, current.id))
      .execute();

    // Immediately invalidate cache so all subsequent requests get the updated configuration
    invalidateMalpracticeCache();
    const updated = await getAuthoritativeMalpracticeConfig(true);

    const activeSessObj = await db
      .select({ count: count() })
      .from(assessmentSessions)
      .where(eq(assessmentSessions.status, "active"))
      .get();

    const activeCount = activeSessObj?.count ?? 0;

    return res.json({
      success: true,
      message: updated.masterEnabled
        ? `Malpractice configuration saved to Turso and synchronized${
            activeCount > 0 ? ` across ${activeCount} active session(s)` : ""
          }.`
        : "Master Malpractice Monitoring turned OFF. All student restrictions, warnings, and new violation logs are currently suspended while historical logs remain preserved.",
      ...updated,
      settings: {
        masterEnabled: updated.masterEnabled,
        disableCopy: updated.disableCopy,
        disableCut: updated.disableCut,
        disablePaste: updated.disablePaste,
        disableRightClick: updated.disableRightClick,
        detectDevtoolsShortcuts: updated.detectDevtoolsShortcuts,
        detectTabSwitch: updated.detectTabSwitch,
        detectWindowFocus: updated.detectWindowFocus,
        showStudentWarnings: updated.showStudentWarnings,
        enableViolationLogging: updated.enableViolationLogging,
        violationThreshold: updated.violationThreshold,
      },
      effectiveSettings: updated.effective,
      activeSessionsCount: activeCount,
      serverTime: nowIso,
    });
  } catch (error: any) {
    console.error("[UPDATE ADMIN MALPRACTICE SETTINGS] Error:", error);
    return res.status(500).json({
      message: "Failed to save malpractice configuration settings.",
    });
  }
};

// =========================================================
// STUDENT SETTINGS & EVENT REPORTING ENDPOINTS
// =========================================================

export const getStudentMalpracticeSettings = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const config = await getAuthoritativeMalpracticeConfig(false);
    return res.json({
      ...config,
      settings: {
        masterEnabled: config.masterEnabled,
        disableCopy: config.disableCopy,
        disableCut: config.disableCut,
        disablePaste: config.disablePaste,
        disableRightClick: config.disableRightClick,
        detectDevtoolsShortcuts: config.detectDevtoolsShortcuts,
        detectTabSwitch: config.detectTabSwitch,
        detectWindowFocus: config.detectWindowFocus,
        showStudentWarnings: config.showStudentWarnings,
        enableViolationLogging: config.enableViolationLogging,
        violationThreshold: config.violationThreshold,
      },
      effectiveSettings: config.effective,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[GET STUDENT MALPRACTICE SETTINGS] Error:", error);
    return res.status(500).json({
      message: "Failed to load malpractice settings.",
    });
  }
};

export const recordMalpracticeEvent = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user || req.user.role !== "student") {
      return res.status(403).json({
        message: "Only authenticated students in an active assessment session can report events.",
      });
    }

    const studentId = req.user.id;
    const sessionId = Number(req.params.sessionId);
    if (!sessionId || isNaN(sessionId)) {
      return res.status(400).json({ message: "Invalid assessment session ID." });
    }

    const rawEventType = String(req.body?.eventType || "").trim();
    if (!ALLOWED_EVENT_TYPES.includes(rawEventType as MalpracticeEventType)) {
      return res.status(400).json({
        message: `Unsupported malpractice eventType '${rawEventType}'.`,
      });
    }
    const eventType = rawEventType as MalpracticeEventType;

    // Fetch authoritative configuration (cached for 3s to handle 3,500 concurrent students)
    const config = await getAuthoritativeMalpracticeConfig(false);
    const effective = config.effective;

    // Verify assessment session belongs to the authenticated student
    const session = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.id, sessionId),
          eq(assessmentSessions.studentId, studentId)
        )
      )
      .get();

    if (!session) {
      return res.status(404).json({
        message: "Assessment session not found or unauthorized.",
      });
    }

    if (session.status !== "active") {
      return res.json({
        recorded: false,
        reason: "session_not_active",
        sessionStatus: session.status,
        effectiveSettings: effective,
      });
    }

    // Check if Master Monitoring is ON, the specific restriction is ON, and Violation Logging is ON
    const restrictionActive = isEventTypeRestrictionActive(eventType, effective);
    if (!effective.masterEnabled || !restrictionActive || !effective.enableViolationLogging) {
      const currentFocusViolations = await getServerSessionFocusViolationCount(
        sessionId,
        effective
      );
      return res.json({
        recorded: false,
        reason: !effective.masterEnabled
          ? "master_monitoring_disabled"
          : !restrictionActive
          ? "restriction_disabled"
          : "violation_logging_disabled",
        effectiveSettings: effective,
        serverViolationCount: currentFocusViolations,
        violationThreshold: effective.violationThreshold,
      });
    }

    // Apply per-session rate limiting & debouncing
    const nowMs = Date.now();
    let rateState = sessionRateMap.get(sessionId);
    if (!rateState || nowMs - rateState.windowStartMs > 60000) {
      rateState = {
        lastEventByType: rateState?.lastEventByType || {},
        windowStartMs: nowMs,
        eventsInWindow: 0,
      };
      sessionRateMap.set(sessionId, rateState);
    }

    const debounceWindowMs =
      eventType === "tab_visibility_changed" || eventType === "window_focus_lost"
        ? 1200
        : 500;
    const lastMs = rateState.lastEventByType[eventType] || 0;

    if (
      nowMs - lastMs < debounceWindowMs ||
      rateState.eventsInWindow >= MAX_EVENTS_PER_MINUTE_PER_SESSION
    ) {
      const currentFocusViolations = await getServerSessionFocusViolationCount(
        sessionId,
        effective
      );
      return res.json({
        recorded: false,
        reason: "debounced_or_rate_limited",
        effectiveSettings: effective,
        serverViolationCount: currentFocusViolations,
        violationThreshold: effective.violationThreshold,
      });
    }

    rateState.lastEventByType[eventType] = nowMs;
    rateState.eventsInWindow += 1;

    const serverTimestamp = new Date(nowMs).toISOString();

    // Strictly sanitize metadata — NEVER store clipboard contents, passwords, tokens, or PII
    const safeShortcut =
      typeof req.body?.shortcut === "string"
        ? req.body.shortcut.slice(0, 40).replace(/[^a-zA-Z0-9+_ -]/g, "")
        : undefined;
    const safeTargetArea =
      typeof req.body?.targetArea === "string"
        ? req.body.targetArea.slice(0, 40).replace(/[^a-zA-Z0-9_-]/g, "")
        : "workspace";
    const safeQuestionId =
      req.body?.questionId !== undefined && !isNaN(Number(req.body.questionId))
        ? Number(req.body.questionId)
        : undefined;

    const relevantConfiguration = {
      masterEnabled: effective.masterEnabled,
      disableCopy: effective.disableCopy,
      disableCut: effective.disableCut,
      disablePaste: effective.disablePaste,
      disableRightClick: effective.disableRightClick,
      detectDevtoolsShortcuts: effective.detectDevtoolsShortcuts,
      detectTabSwitch: effective.detectTabSwitch,
      detectWindowFocus: effective.detectWindowFocus,
      showStudentWarnings: effective.showStudentWarnings,
      enableViolationLogging: effective.enableViolationLogging,
      targetArea: safeTargetArea,
      ...(safeShortcut ? { shortcut: safeShortcut } : {}),
      ...(safeQuestionId ? { questionId: safeQuestionId } : {}),
    };

    const inserted = await db
      .insert(malpracticeEvents)
      .values({
        studentId,
        assessmentId: session.assessmentId,
        sessionId: session.id,
        eventType,
        serverTimestamp,
        relevantConfiguration,
        reviewStatus: "pending",
      })
      .returning()
      .get();

    const serverViolationCount = await getServerSessionFocusViolationCount(
      sessionId,
      effective
    );

    return res.status(201).json({
      recorded: true,
      eventId: inserted.id,
      eventType,
      serverTimestamp,
      effectiveSettings: effective,
      serverViolationCount,
      violationThreshold: effective.violationThreshold,
      shouldAutoSubmit:
        effective.masterEnabled &&
        (effective.detectTabSwitch || effective.detectWindowFocus) &&
        serverViolationCount > effective.violationThreshold,
    });
  } catch (error: any) {
    console.error("[RECORD MALPRACTICE EVENT] Error:", error);
    return res.status(500).json({
      message: "Error recording malpractice event.",
    });
  }
};

// =========================================================
// ADMIN VIOLATION LOGS SEARCH, FILTER & REVIEW ENDPOINTS
// =========================================================

export const getAdminMalpracticeEvents = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await ensureTimerTables();

    const search = String(req.query.search || "")
      .trim()
      .toLowerCase();
    const eventTypeFilter = String(req.query.eventType || "").trim();
    const reviewStatusFilter = String(req.query.reviewStatus || "").trim();
    const assessmentIdFilter = req.query.assessmentId
      ? Number(req.query.assessmentId)
      : null;
    const sessionIdFilter = req.query.sessionId
      ? Number(req.query.sessionId)
      : null;
    const limit = Math.min(
      500,
      Math.max(1, Number(req.query.limit) || 150)
    );

    const rows = await db
      .select({
        id: malpracticeEvents.id,
        studentId: malpracticeEvents.studentId,
        assessmentId: malpracticeEvents.assessmentId,
        sessionId: malpracticeEvents.sessionId,
        eventType: malpracticeEvents.eventType,
        serverTimestamp: malpracticeEvents.serverTimestamp,
        relevantConfiguration: malpracticeEvents.relevantConfiguration,
        reviewStatus: malpracticeEvents.reviewStatus,
        reviewedBy: malpracticeEvents.reviewedBy,
        reviewedAt: malpracticeEvents.reviewedAt,
        notes: malpracticeEvents.notes,
        studentRollNumber: students.rollNumber,
        studentName: students.name,
        studentDepartment: students.department,
        assessmentTitle: tests.title,
        assessmentSubject: tests.subject,
      })
      .from(malpracticeEvents)
      .leftJoin(students, eq(malpracticeEvents.studentId, students.id))
      .leftJoin(tests, eq(malpracticeEvents.assessmentId, tests.id))
      .orderBy(desc(malpracticeEvents.id))
      .limit(1000)
      .all();

    const filtered = rows.filter((r) => {
      if (eventTypeFilter && eventTypeFilter !== "all" && r.eventType !== eventTypeFilter) {
        return false;
      }
      if (
        reviewStatusFilter &&
        reviewStatusFilter !== "all" &&
        r.reviewStatus !== reviewStatusFilter
      ) {
        return false;
      }
      if (assessmentIdFilter && r.assessmentId !== assessmentIdFilter) {
        return false;
      }
      if (sessionIdFilter && r.sessionId !== sessionIdFilter) {
        return false;
      }
      if (search) {
        const roll = (r.studentRollNumber || "").toLowerCase();
        const name = (r.studentName || "").toLowerCase();
        const title = (r.assessmentTitle || "").toLowerCase();
        const ev = (r.eventType || "").toLowerCase();
        if (
          !roll.includes(search) &&
          !name.includes(search) &&
          !title.includes(search) &&
          !ev.includes(search)
        ) {
          return false;
        }
      }
      return true;
    });

    const summary = {
      totalCount: rows.length,
      filteredCount: filtered.length,
      pendingCount: rows.filter((r) => r.reviewStatus === "pending").length,
      reviewedCount: rows.filter((r) => r.reviewStatus === "reviewed").length,
      flaggedCount: rows.filter((r) => r.reviewStatus === "flagged").length,
      dismissedCount: rows.filter((r) => r.reviewStatus === "dismissed").length,
    };

    const events = filtered.slice(0, limit).map((r) => ({
      ...r,
      relevantConfiguration:
        typeof r.relevantConfiguration === "string"
          ? JSON.parse(r.relevantConfiguration || "{}")
          : r.relevantConfiguration || {},
    }));

    return res.json({
      events,
      summary,
    });
  } catch (error: any) {
    console.error("[GET ADMIN MALPRACTICE EVENTS] Error:", error);
    return res.status(500).json({
      message: "Failed to fetch malpractice violation logs.",
    });
  }
};

export const updateMalpracticeEventReview = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user || req.user.role !== "faculty") {
      return res.status(403).json({
        message: "Forbidden: Only faculty/administrators can review violation logs.",
      });
    }

    const eventId = Number(req.params.id);
    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID." });
    }

    const { reviewStatus, notes } = req.body || {};
    const validStatuses = ["pending", "reviewed", "dismissed", "flagged"];
    if (!validStatuses.includes(reviewStatus)) {
      return res.status(400).json({
        message:
          "Invalid reviewStatus. Must be one of: pending, reviewed, dismissed, flagged.",
      });
    }

    const existing = await db
      .select()
      .from(malpracticeEvents)
      .where(eq(malpracticeEvents.id, eventId))
      .get();

    if (!existing) {
      return res.status(404).json({ message: "Violation log entry not found." });
    }

    const nowIso = new Date().toISOString();
    const cleanNotes =
      typeof notes === "string" ? notes.trim().slice(0, 500) : existing.notes;

    await db
      .update(malpracticeEvents)
      .set({
        reviewStatus,
        reviewedBy: req.user.id,
        reviewedAt: nowIso,
        notes: cleanNotes,
      })
      .where(eq(malpracticeEvents.id, eventId))
      .execute();

    return res.json({
      success: true,
      message: `Violation log #${eventId} marked as ${reviewStatus}.`,
      eventId,
      reviewStatus,
      reviewedAt: nowIso,
      notes: cleanNotes,
    });
  } catch (error: any) {
    console.error("[UPDATE MALPRACTICE EVENT REVIEW] Error:", error);
    return res.status(500).json({
      message: "Failed to update violation review status.",
    });
  }
};
