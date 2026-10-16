/* ==============================================================
   SLP MONITORING SYSTEM
   MAIN JAVASCRIPT FILE

   This file controls:
    1. Demo accounts and demo data
    2. Sign in, sign out and the session timeout
    3. Role checks and the sidebar menu
    4. Page navigation
    5. Reusable UI components (buttons, fields, tables, badges ...)
    6. Every page and form
    7. Modals, confirmation dialogs and toast messages

   DATA:
   Signed-in data comes from the PHP API in api/ (database
   slp_monitoring). After sign-in, GET api/bootstrap.php returns what
   this user may see; applySnapshot() maps it into data, users and
   profileForms. Saves POST to the API and reload the snapshot.

   DESIGN SYSTEM:
   Markup in this file must use the components documented in
   docs/DESIGN-SYSTEM.md. Do not add inline style="" attributes.
   ============================================================== */


/* ==============================================================
   1. ACCOUNTS (filled from the server)
   ============================================================== */

/*
   Everything in sections 1–3 is filled by applySnapshot() from
   GET api/bootstrap.php after sign-in, already filtered by the server
   for the signed-in role. Nothing here holds a password.
   users: accounts (staff only), keyed by username.
*/
const users = {};


/* ==============================================================
   2. RECORDS
   ============================================================== */

const data = {
    beneficiaries: [],
    projects: [],
    monitoring: [],
    assistance: [],
    reports: [],
    documents: [],
    notifications: []
};

/* Reference lists from the server: barangays, livelihood types, associations. */
let referenceData = { barangays: [], livelihoodTypes: [], associations: [] };


/* ==============================================================
   3. BENEFICIARY PROFILE FORMS
   ============================================================== */

/* The signed-in participant's Annex G.1 answers, keyed by username. */
const profileForms = {};

function createEmptyProfile(defaultName) {
    const parts = defaultName.split(" ");

    const profile = {
        pcn: "",
        participantId: "",
        consentAssess: false,
        consentPolicy: false,
        consentRetain: false,
        consentShare: false,
        participantSignature: "",
        participantDate: "",
        thumbmark: "",
        participantType: "",
        householdNumber: "",
        eligibility: "",
        referringParty: "",
        lastName: parts[parts.length - 1] || "",
        firstName: parts[0] || "",
        middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
        extensionName: "",
        houseNo: "",
        street: "",
        barangay: "",
        municipality: "Lubang",
        province: "Occidental Mindoro",
        birthday: "",
        age: "",
        sex: "",
        civilStatus: "",
        civilOther: "",
        contactNo: "",
        email: "",
        genderIdentity: "",
        sector: "",
        sectorGroup: "",
        disability: "",
        otherSector: "",
        education: "",
        q15: "",
        q16: "",
        q17: "",
        programIncomeSource: "",
        programGrossIncome: "",
        totalGrossIncome: "",
        housing: "",
        utilities: "",
        food: "",
        transportation: "",
        healthcare: "",
        educationExpense: "",
        childcare: "",
        otherExpense: "",
        totalExpenses: "",
        netIncome: "",
        vulnerabilityTotal: "",
        povertyThreshold: "",
        personnelVulnerabilityScore: "",
        incomeAssessment: "",
        vulnerabilitySeverity: "",
        overallAssessment: "",
        remarks: "",
        track: "",
        personnelSignature: "",
        referenceId: "",
        intakeDate: "",
        officeAddress: "",
        officeEmail: "",
        officeContact: ""
    };

    // Create six empty household-member rows.
    for (let i = 0; i < 6; i++) {
        profile["hh" + i + "Name"] = "";
        profile["hh" + i + "Birthday"] = "";
        profile["hh" + i + "Sex"] = "";
        profile["hh" + i + "Relation"] = "";
        profile["hh" + i + "IncomeSource"] = "";
        profile["hh" + i + "Income"] = "";
        profile["vulnerability" + i] = "";
    }

    return profile;
}


/* ==============================================================
   4. CURRENT SESSION STATE
   ============================================================== */

let currentUser = null;      // set after a successful sign in
let currentPage = null;      // name of the page on screen
let profileDirty = false;    // true when the profile form or a monitoring tool has unsaved edits


/* ==============================================================
   5. SMALL HELPERS
   ============================================================== */

/* Shortcut for document.getElementById("..."). */
function get(id) {
    if (typeof document === "undefined") {
        return null;
    }
    return document.getElementById(id);
}

/* True when running in a real browser (not the Node test runner). */
function isBrowser() {
    return typeof window !== "undefined" && typeof document !== "undefined";
}

/*
   Safely place user-entered text inside HTML.
   This prevents special characters from breaking HTML markup or attributes.
*/
function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* Focus an element if the environment supports it. */
function focusElement(el) {
    if (el && typeof el.focus === "function") {
        el.focus();
    }
}

/* Today's date as YYYY-MM-DD, e.g. 2026-09-23. */
function getCurrentDate() {
    return new Date().toISOString().slice(0, 10);
}

/* Show ISO dates in a plain, unambiguous format: "15 Sep 2026". */
function formatDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) {
        return iso || "";
    }
    const date = new Date(iso + "T00:00:00Z");
    if (isNaN(date.getTime())) {
        return iso;
    }
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/* Parse "₱10,000" or "5000" into a number (0 when empty). */
function parseAmount(value) {
    const n = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
}

function formatPeso(amount, decimals = 2) {
    return "₱" + Number(amount).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
}


/* ==============================================================
   5B. SERVER API AND THE SIGNED-IN SNAPSHOT
   Spec: docs/superpowers/specs/2026-10-13-slp-app-wiring-design.md
   ============================================================== */

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

let csrfToken = null;   // from the sign-in or session response; sent on every POST

/*
   GET when body is undefined, otherwise POST it as JSON.
   Resolves the parsed JSON or throws ApiError with the server's message.
   A 401 while someone is signed in means the session ended: sign out.
*/
async function api(path, body) {
    const options = { method: body === undefined ? "GET" : "POST", credentials: "same-origin", headers: { Accept: "application/json" } };
    if (body !== undefined) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
        if (csrfToken) options.headers["X-CSRF-Token"] = csrfToken;
    }
    let response;
    try {
        response = await fetch(path, options);
    } catch (error) {
        throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
    }
    let json = null;
    try {
        json = await response.json();
    } catch (error) {
        json = null;
    }
    if (!response.ok) {
        if (response.status === 401 && currentUser) logoutUser("timeout");
        throw new ApiError(response.status, (json && json.error) || "Something went wrong. Try again.");
    }
    return json;
}

/* "B-001" from ("B", 1). */
function displayId(prefix, id) {
    return prefix + "-" + String(id).padStart(3, "0");
}

/* Database codes → the names shown on screen (wiring spec §4.2). */
const LABELS = {
    enrollment: { active: "Active", for_monitoring: "For Monitoring", completed: "Completed", inactive: "Inactive" },
    project: { ongoing: "Ongoing", for_monitoring: "For Monitoring", completed: "Completed" },
    progress: { good: "Good", needs_follow_up: "Needs Follow-up", completed: "Completed" },
    support: { livelihood_capital: "Livelihood Capital", training_support: "Training Support", equipment: "Equipment", other: "Other Assistance" },
    reportType: { project: "Project Report", progress: "Progress Report", status: "Status Report", beneficiary_status: "Beneficiary Status Report", accomplishment: "Accomplishment Report" },
    reportStatus: { for_review: "For Review", submitted: "Submitted" },
    docCategory: { profile: "Profile", project: "Project", progress: "Progress", other: "Other" },
    docStatus: { for_review: "For Review", approved: "Approved", returned: "Returned" },
    profileStatus: { draft: "Draft", submitted: "Submitted", verified: "Verified" },
    role: { staff: "MSWDO Personnel", leader: "Beneficiary Leader", member: "Beneficiary Member" },
    userStatus: { active: "Active", inactive: "Inactive" }
};

/* Replace all signed-in data with the server's snapshot (GET api/bootstrap.php). */
function applySnapshot(snapshot) {
    const me = snapshot.me;
    currentUser = {
        userId: me.userId,
        username: me.username,
        role: LABELS.role[me.role],
        name: me.name,
        beneficiaryId: me.beneficiaryId,
        associationId: me.associationId,
        associationName: me.associationName
    };
    referenceData = snapshot.reference;

    data.beneficiaries = snapshot.beneficiaries.map(b => ({
        dbId: b.id,
        id: displayId("B", b.id),
        name: [b.firstName, b.middleName, b.lastName, b.extensionName].filter(Boolean).join(" "),
        firstName: b.firstName,
        lastName: b.lastName,
        livelihood: b.livelihood,
        status: LABELS.enrollment[b.enrollmentStatus],
        location: b.barangay,
        associationId: b.associationId,
        associationName: b.associationName,
        profileStatus: LABELS.profileStatus[b.profileStatus],
        householdInformation: b.householdInformation,
        hasAccount: b.hasAccount
    }));
    data.projects = snapshot.projects.map(p => ({
        dbId: p.id, id: displayId("P", p.id), name: p.name, leader: p.ownerName,
        status: LABELS.project[p.status], associationName: p.associationName, livelihood: p.livelihood
    }));
    data.monitoring = snapshot.monitoring.map(m => ({
        dbId: m.id, id: displayId("M", m.id), beneficiary: m.beneficiaryName, beneficiaryId: displayId("B", m.beneficiaryId),
        date: m.visitDate, progress: LABELS.progress[m.progress], issue: m.issue || "None", recommendation: m.recommendation
    }));
    data.assistance = snapshot.assistance.map(a => ({
        dbId: a.id, id: displayId("A", a.id), recipient: a.beneficiaryName, type: LABELS.support[a.supportType],
        date: a.releaseDate, amount: a.amount === null ? "—" : formatPeso(a.amount, 0)
    }));
    data.reports = snapshot.reports.map(r => ({
        dbId: r.id, id: displayId("R", r.id), type: LABELS.reportType[r.reportType], period: r.period, details: r.details,
        date: r.createdAt.slice(0, 10), status: LABELS.reportStatus[r.status], shared: r.shared
    }));
    data.documents = snapshot.documents.map(d => ({
        dbId: d.id, name: d.title, type: LABELS.docCategory[d.category], status: LABELS.docStatus[d.status],
        reviewNote: d.reviewNote, beneficiary: d.ownerName, date: d.createdAt.slice(0, 10)
    }));
    data.notifications = snapshot.notifications.map(n => ({
        dbId: n.id, title: n.title, message: n.message, date: n.createdAt.slice(0, 10),
        recipient: n.recipientName || "All Beneficiaries", read: n.read
    }));

    Object.keys(users).forEach(key => delete users[key]);
    snapshot.users.forEach(u => {
        users[u.username] = { dbId: u.id, role: LABELS.role[u.role], name: u.name, status: LABELS.userStatus[u.status], beneficiaryId: u.beneficiaryId };
    });

    Object.keys(profileForms).forEach(key => delete profileForms[key]);
    if (me.role !== "staff") {
        profileForms[me.username] = Object.assign(createEmptyProfile(me.name), snapshot.profile || {});
    }
}

/* Forget every record of the signed-in user (sign-out on a shared computer). */
function clearSignedInData() {
    Object.keys(data).forEach(key => { data[key] = []; });
    Object.keys(users).forEach(key => delete users[key]);
    Object.keys(profileForms).forEach(key => delete profileForms[key]);
    referenceData = { barangays: [], livelihoodTypes: [], associations: [] };
}

async function loadData() {
    applySnapshot(await api("api/bootstrap.php"));
}


/* ==============================================================
   6. ICONS — ONE SET (Lucide, outline, 2px stroke, round caps)
   Sizes: 16, 20 (default), 24. See docs/DESIGN-SYSTEM.md for
   the action → icon map; always use the same icon for the same
   meaning.
   ============================================================== */

const ICON_PATHS = {
    // Navigation / modules
    "layout-dashboard": '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    "users":            '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "user":             '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    "user-cog":         '<circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="m21.7 16.4-.9-.3"/><path d="m15.2 13.9-.9-.3"/><path d="m16.6 18.7.3-.9"/><path d="m19.1 12.2.3-.9"/><path d="m19.6 18.7-.4-1"/><path d="m16.8 12.3-.4-1"/><path d="m14.3 16.6 1-.4"/><path d="m20.7 13.8 1-.4"/>',
    "square-user":      '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 21v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>',
    "clipboard-check":  '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    "clipboard-list":   '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    "wallet":           '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    "file-text":        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    "bell":             '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    "briefcase":        '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    "folder":           '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    "home":             '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',

    // Actions
    "plus":             '<path d="M5 12h14"/><path d="M12 5v14"/>',
    "eye":              '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    "eye-off":          '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    "printer":          '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    "download":         '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    "upload":           '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    "send":             '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    "save":             '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    "pencil":           '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    "check":            '<path d="M20 6 9 17l-5-5"/>',
    "check-check":      '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
    "calculator":       '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    "log-out":          '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    "x":                '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    "arrow-left":       '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    "arrow-right":      '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    "chevron-left":     '<path d="m15 18-6-6 6-6"/>',
    "chevron-right":    '<path d="m9 18 6-6-6-6"/>',
    "chevrons-up-down": '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    "arrow-up":         '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    "arrow-down":       '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',

    // Status & feedback
    "circle-check":       '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "clock":              '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    "triangle-alert":     '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    "circle-alert":       '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    "circle-x":           '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    "circle-arrow-right": '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="m12 16 4-4-4-4"/>',
    "circle":             '<circle cx="12" cy="12" r="10"/>',
    "info":               '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    "lock":               '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    "shield-check":       '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    "timer":              '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
    "inbox":              '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    "search-x":           '<path d="m13.5 8.5-5 5"/><path d="m8.5 8.5 5 5"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',

    // Metadata
    "calendar":         '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    "mail":             '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    "clipboard-pen":    '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M10.4 12.6a2 2 0 0 1 3 3L8 21l-4 1 1-4Z"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5.5"/><path d="M4 13.5V6a2 2 0 0 1 2-2h2"/>',
    "network":          '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
    "badge-check":      '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    "map-pin":          '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'
};

/* Return an inline SVG icon. Icons are decorative: always pair with text. */
function icon(name, size = 20, extraClass = "") {
    const paths = ICON_PATHS[name] || ICON_PATHS.circle;
    const sizeClass = size === 20 ? "" : " icon--" + size;
    const cls = "icon" + sizeClass + (extraClass ? " " + extraClass : "");
    return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}


/* ==============================================================
   7. REUSABLE UI COMPONENTS
   Every page is built from these. Reuse — do not hand-write
   one-off markup for something that exists here.
   ============================================================== */

/* Button. `label` is trusted static text written in this file. */
function button(label, onclick, options = {}) {
    const variant = options.variant || "secondary";
    const type = options.type || "button";
    const iconHTML = options.icon ? icon(options.icon) : "";
    const clickAttr = onclick ? ` onclick="${onclick}"` : "";
    const extra = options.attrs ? " " + options.attrs : "";
    return `<button type="${type}" class="btn btn--${variant}"${clickAttr}${extra}>${iconHTML}<span>${label}</span></button>`;
}

/* Card header: heading, optional description, optional actions. */
function cardHeader(title, description, actionsHTML, headingId) {
    const idAttr = headingId ? ` id="${headingId}"` : "";
    return `
        <div class="card__header">
            <div class="card__heading">
                <h2${idAttr}>${title}</h2>
                ${description ? `<p class="card__desc">${description}</p>` : ""}
            </div>
            ${actionsHTML ? `<div class="card__actions">${actionsHTML}</div>` : ""}
        </div>`;
}

/* Inline alert (info, success, warning, error, neutral). Title/body are trusted. */
function alertBox(type, title, body, iconName) {
    const icons = { info: "info", success: "circle-check", warning: "triangle-alert", error: "circle-alert", neutral: "info" };
    return `
        <div class="alert alert--${type}">
            ${icon(iconName || icons[type] || "info")}
            <div class="alert__content">
                ${title ? `<p class="alert__title">${title}</p>` : ""}
                ${body ? `<p class="alert__body">${body}</p>` : ""}
            </div>
        </div>`;
}

/* Empty / error state. Title and text are trusted. */
function emptyState(iconName, title, text, actionsHTML, options = {}) {
    const headingTag = options.headingTag || "h3";
    return `
        <div class="state${options.error ? " state--error" : ""}">
            <span class="state__icon">${icon(iconName, 24)}</span>
            ${options.eyebrow ? `<p class="state__eyebrow">${options.eyebrow}</p>` : ""}
            <${headingTag}>${title}</${headingTag}>
            ${text ? `<p class="state__text">${text}</p>` : ""}
            ${actionsHTML ? `<div class="btn-group">${actionsHTML}</div>` : ""}
        </div>`;
}

/*
   Status badge. Status is always shown as icon + text, never colour alone.
   Status names are data values and keep their Title Case.
*/
const STATUS_TONES = {
    "Active": "success", "Completed": "success", "Approved": "success", "Submitted": "success",
    "Good": "success", "Verified": "success", "Qualified": "success",
    "For Review": "warning", "For Monitoring": "warning", "Needs Follow-up": "attention",
    "Ongoing": "info",
    "Returned": "attention", "Draft": "neutral",
    "Rejected": "error", "Not Qualified": "error", "Inactive": "error"
};

const TONE_STYLES = {
    success:   { cls: "badge--success", icon: "circle-check" },
    warning:   { cls: "badge--warning", icon: "clock" },
    attention: { cls: "badge--warning", icon: "triangle-alert" },
    info:      { cls: "badge--info",    icon: "circle-arrow-right" },
    error:     { cls: "badge--error",   icon: "circle-x" },
    neutral:   { cls: "badge--neutral", icon: "circle" }
};

function statusBadge(status) {
    const tone = TONE_STYLES[STATUS_TONES[status] || "neutral"];
    return `<span class="badge ${tone.cls}">${icon(tone.icon, 16)}${escapeHTML(status)}</span>`;
}

/* Role indicator shown in the header, sidebar and account table. */
function roleBadge(role) {
    if (role === "MSWDO Personnel") {
        return `<span class="badge badge--info">${icon("shield-check", 16)}MSWDO Personnel</span>`;
    }
    if (role === "Beneficiary Leader") {
        return `<span class="badge badge--neutral">${icon("users", 16)}Association Leader</span>`;
    }
    return `<span class="badge badge--neutral">${icon("user", 16)}${role === "Beneficiary Member" ? "Participant" : escapeHTML(role)}</span>`;
}

/* Record detail list: pairs of [label, valueHTML]. Labels are trusted. */
function summaryList(pairs) {
    return `
        <dl class="summary-list">
            ${pairs.map(([label, valueHTML]) => `<dt>${label}</dt><dd>${valueHTML}</dd>`).join("")}
        </dl>`;
}

/*
   Form field for modal forms.
   Options: id, label, type, required, hint, options (for select),
   value, placeholder, attrs (extra trusted attributes).
*/
function formField(config) {
    const { id, label, type = "text", required = false, hint = "", options = null, value = "", placeholder = "", attrs = "" } = config;
    const hintId = hint ? id + "Hint" : "";
    const describedBy = hintId ? ` aria-describedby="${hintId}"` : "";
    const requiredAttr = required ? " required" : "";
    const placeholderAttr = placeholder ? ` placeholder="${escapeHTML(placeholder)}"` : "";
    const extra = attrs ? " " + attrs : "";

    let control;
    if (options) {
        const optionHTML = options.map(option => {
            const opt = typeof option === "string" ? { value: option, label: option } : option;
            const selected = opt.selected ? " selected" : "";
            return `<option value="${escapeHTML(opt.value)}"${selected}>${escapeHTML(opt.label)}</option>`;
        }).join("");
        control = `<select id="${id}"${requiredAttr}${describedBy}${extra}>${optionHTML}</select>`;
    } else if (type === "textarea") {
        control = `<textarea id="${id}"${requiredAttr}${describedBy}${placeholderAttr}${extra}>${escapeHTML(value)}</textarea>`;
    } else {
        const valueAttr = value ? ` value="${escapeHTML(value)}"` : "";
        control = `<input type="${type}" id="${id}"${valueAttr}${requiredAttr}${describedBy}${placeholderAttr}${extra}>`;
    }

    return `
        <div class="field">
            <label class="field__label" for="${id}">${escapeHTML(label)}${required ? ' <span class="field__req">(required)</span>' : ""}</label>
            ${hint ? `<p class="field__hint" id="${hintId}">${hint}</p>` : ""}
            ${control}
            <p class="field__error" id="${id}Error" hidden></p>
        </div>`;
}

/*
   Modal form with a built-in review step.
   Submit → validate → "Check your answers" → Confirm calls saveFn().
*/
function modalForm({ formId, fieldsHTML, saveFn, confirmLabel }) {
    return `
        <form id="${formId}" novalidate onsubmit="return reviewForm(event, '${saveFn}', '${confirmLabel}')">
            <div class="error-summary" id="${formId}Errors" role="alert" tabindex="-1" hidden></div>
            ${fieldsHTML}
            <div class="modal__footer">
                ${button("Cancel", "closeModal()")}
                ${button("Continue to review", "", { variant: "primary", type: "submit", icon: "arrow-right" })}
            </div>
        </form>
        <div id="${formId}Review" class="stack" hidden></div>`;
}


/* ==============================================================
   8. DATA TABLES — sort, search, filter, paginate (client side)
   ============================================================== */

const tableState = {};
const TABLE_PAGE_SIZE = 10;
let renderedTables = [];   // tables registered by the page currently on screen

function getTableState(id) {
    if (!tableState[id]) {
        tableState[id] = { query: "", filter: "", sortCol: null, sortDir: "ascending", page: 1, countId: "", noun: "records", caption: "" };
    }
    return tableState[id];
}

/* Called while building a page; resets search/sort/page for that table. */
function registerTable(id, options) {
    const state = getTableState(id);
    Object.assign(state, options, { query: "", filter: "", sortCol: null, sortDir: "ascending", page: 1 });
    if (!renderedTables.includes(id)) renderedTables.push(id);
}

/*
   Build a table.
   columns: [{ label, sortable = true, num = false, cls }]
   rows:    [{ cells: [html], filter: "value for the filter select", sort: [optional sort values] }]
*/
function dataTable({ id, caption, columns, rows, emptyTitle, emptyText, sortable = true, paginate = true }) {
    const colCount = columns.length;

    const headerHTML = columns.map((column, index) => {
        const numCls = column.num ? " num" : "";
        if (!sortable || column.sortable === false) {
            return `<th scope="col" class="${(column.cls || "") + numCls}">${column.label}</th>`;
        }
        return `
            <th scope="col" class="sortable${numCls}" data-col="${index}" aria-sort="none">
                <button type="button" class="table__sort" onclick="sortTable('${id}', ${index})">
                    ${column.label}
                    ${icon("chevrons-up-down", 16, "sort-icon--none")}${icon("arrow-up", 16, "sort-icon--asc")}${icon("arrow-down", 16, "sort-icon--desc")}
                </button>
            </th>`;
    }).join("");

    const rowHTML = rows.map(row => {
        const filterAttr = row.filter !== undefined ? ` data-filter="${escapeHTML(row.filter)}"` : "";
        const cells = row.cells.map((cell, index) => {
            const column = columns[index] || {};
            const sortValue = row.sort && row.sort[index] !== undefined ? ` data-sort="${escapeHTML(row.sort[index])}"` : "";
            const cls = [column.num ? "num" : "", column.cls || ""].filter(Boolean).join(" ");
            return `<td${cls ? ` class="${cls}"` : ""}${sortValue}>${cell}</td>`;
        }).join("");
        return `<tr data-row${filterAttr}>${cells}</tr>`;
    }).join("");

    const emptyHTML = rows.length === 0
        ? `<tr><td colspan="${colCount}">${emptyState("inbox", emptyTitle || "No records yet", emptyText || "")}</td></tr>`
        : `<tr data-no-results hidden><td colspan="${colCount}">${emptyState("search-x", "No matching records", "Try a different search term or choose another filter.")}</td></tr>`;

    return `
        <div class="table-wrap" role="region" aria-label="${escapeHTML(caption)}" tabindex="0">
            <table class="table">
                <caption class="visually-hidden">${escapeHTML(caption)}</caption>
                <thead><tr>${headerHTML}</tr></thead>
                <tbody id="${id}">${rowHTML}${emptyHTML}</tbody>
            </table>
        </div>
        ${paginate ? `<div class="pagination" id="${id}Pagination"></div>` : ""}`;
}

/*
   Search box, optional filter select, and the live record count.
   ids for search/count are passed in so existing element ids stay stable.
*/
function tableToolbar({ tableId, searchId, searchHint, countId, total, noun, filterLabel, filterOptions, summaryHTML }) {
    const filterHTML = filterOptions && filterOptions.length
        ? `
            <div class="field table-toolbar__filter">
                <label class="field__label" for="${tableId}Filter">${filterLabel}</label>
                <select id="${tableId}Filter" onchange="setTableFilter('${tableId}', this.value)">
                    <option value="">All</option>
                    ${filterOptions.map(option => `<option value="${escapeHTML(option)}">${escapeHTML(option)}</option>`).join("")}
                </select>
            </div>`
        : "";

    return `
        <div class="table-toolbar">
            <div class="table-toolbar__controls">
                <div class="field table-toolbar__search">
                    <label class="field__label" for="${searchId}">Search</label>
                    <input type="search" id="${searchId}" placeholder="${escapeHTML(searchHint)}" autocomplete="off"
                           oninput="setTableQuery('${tableId}', this.value)">
                </div>
                ${filterHTML}
            </div>
            ${summaryHTML || ""}
            <p class="table-count" id="${countId}" aria-live="polite">${total} ${noun}</p>
        </div>`;
}

/* Unique, sorted values of one field — used to build filter options. */
function uniqueValues(records, key) {
    return Array.from(new Set(records.map(record => record[key]).filter(Boolean))).sort();
}

function setTableQuery(id, query) {
    const state = getTableState(id);
    state.query = query || "";
    state.page = 1;
    updateTable(id);
}

function setTableFilter(id, value) {
    const state = getTableState(id);
    state.filter = value || "";
    state.page = 1;
    updateTable(id);
}

function sortTable(id, colIndex) {
    const state = getTableState(id);
    if (state.sortCol === colIndex) {
        state.sortDir = state.sortDir === "ascending" ? "descending" : "ascending";
    } else {
        state.sortCol = colIndex;
        state.sortDir = "ascending";
    }
    updateTable(id);
}

function goToTablePage(id, page) {
    getTableState(id).page = page;
    updateTable(id);
    const tbody = get(id);
    const wrap = tbody && tbody.closest ? tbody.closest(".table-wrap") : null;
    focusElement(wrap);
}

/* Apply sort → filter → pagination to the rows already in the DOM. */
function updateTable(id) {
    if (!isBrowser()) return;
    const tbody = document.getElementById(id);
    if (!tbody || typeof tbody.querySelectorAll !== "function") return;

    const state = getTableState(id);
    const rows = Array.from(tbody.querySelectorAll("tr[data-row]"));

    if (state.sortCol !== null) {
        const valueOf = row => {
            const cell = row.children[state.sortCol];
            if (!cell) return "";
            return cell.hasAttribute("data-sort") ? cell.getAttribute("data-sort") : cell.textContent.trim();
        };
        rows.sort((a, b) => {
            const result = String(valueOf(a)).localeCompare(String(valueOf(b)), undefined, { numeric: true, sensitivity: "base" });
            return state.sortDir === "ascending" ? result : -result;
        });
        rows.forEach(row => tbody.appendChild(row));
    }

    const query = state.query.trim().toLowerCase();
    const matches = rows.filter(row => {
        const matchesQuery = !query || row.textContent.toLowerCase().includes(query);
        const matchesFilter = !state.filter || row.getAttribute("data-filter") === state.filter;
        const visible = matchesQuery && matchesFilter;
        row.classList.toggle("is-filtered-out", !visible);
        return visible;
    });

    const pages = Math.max(1, Math.ceil(matches.length / TABLE_PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * TABLE_PAGE_SIZE;
    matches.forEach((row, index) => {
        row.classList.toggle("is-paged-out", index < start || index >= start + TABLE_PAGE_SIZE);
    });

    const noResults = tbody.querySelector("tr[data-no-results]");
    if (noResults) {
        noResults.hidden = matches.length > 0;
        tbody.appendChild(noResults);
    }

    const countEl = state.countId ? document.getElementById(state.countId) : null;
    if (countEl) {
        countEl.textContent = (query || state.filter)
            ? `Showing ${matches.length} of ${rows.length} ${state.noun}`
            : `${rows.length} ${state.noun}`;
    }

    const table = tbody.closest("table");
    if (table) {
        table.querySelectorAll("th[data-col]").forEach(th => {
            const col = Number(th.getAttribute("data-col"));
            th.setAttribute("aria-sort", col === state.sortCol ? state.sortDir : "none");
        });
    }

    renderPagination(id, matches.length, pages, start);
}

function renderPagination(id, count, pages, start) {
    const container = document.getElementById(id + "Pagination");
    if (!container) return;
    if (pages <= 1) {
        container.innerHTML = "";
        return;
    }
    const state = getTableState(id);
    const end = Math.min(start + TABLE_PAGE_SIZE, count);
    let pageButtons = "";
    for (let page = 1; page <= pages; page++) {
        const current = page === state.page ? ' aria-current="page"' : "";
        pageButtons += `<li><button type="button" class="pagination__btn"${current} aria-label="Page ${page}" onclick="goToTablePage('${id}', ${page})">${page}</button></li>`;
    }
    container.innerHTML = `
        <p class="pagination__status">Showing ${start + 1}–${end} of ${count}</p>
        <nav aria-label="Pages for ${escapeHTML(state.caption)}">
            <ul class="pagination__list">
                <li><button type="button" class="pagination__btn" onclick="goToTablePage('${id}', ${state.page - 1})" ${state.page === 1 ? "disabled" : ""}>${icon("chevron-left", 16)}Previous</button></li>
                ${pageButtons}
                <li><button type="button" class="pagination__btn" onclick="goToTablePage('${id}', ${state.page + 1})" ${state.page === pages ? "disabled" : ""}>Next${icon("chevron-right", 16)}</button></li>
            </ul>
        </nav>`;
}

/* Refresh the tables registered by the page currently on screen. */
function initTables() {
    renderedTables.forEach(updateTable);
}

/* Backwards-compatible search functions (older markup called these). */
function filterBeneficiaryTable(query) { setTableQuery("beneficiaryTableBody", query); }
function filterMonitoringTable(query)  { setTableQuery("monitoringTableBody", query); }
function filterAssistanceTable(query)  { setTableQuery("assistanceTableBody", query); }
function filterReportsTable(query)     { setTableQuery("reportsTableBody", query); }
function filterAccountsTable(query)    { setTableQuery("accountsTableBody", query); }
function filterProjectsTable(query)    { setTableQuery("projectsTableBody", query); }
function filterDocumentsTable(query)   { setTableQuery("documentsTableBody", query); }


/* ==============================================================
   9. EXPORT & PRINT
   ============================================================== */

/* CSV columns per registry. Passwords are never exported. */
const EXPORTS = {
    beneficiaries: {
        file: "slp-beneficiaries",
        columns: [["ID", "id"], ["Participant Name", "name"], ["Livelihood Project", "livelihood"], ["Enrollment Status", "status"], ["Barangay / Location", "location"], ["Household Information", "householdInformation"]],
        rows: () => data.beneficiaries
    },
    projects: {
        file: "slp-livelihood-projects",
        columns: [["ID", "id"], ["Project Name", "name"], ["Project Leader", "leader"], ["Project Status", "status"]],
        rows: () => data.projects
    },
    assistance: {
        file: "slp-assistance",
        columns: [["ID", "id"], ["Recipient", "recipient"], ["Support Type", "type"], ["Release Date", "date"], ["Amount", "amount"]],
        rows: () => data.assistance
    },
    monitoring: {
        file: "slp-field-monitoring",
        columns: [["ID", "id"], ["Participant", "beneficiary"], ["Visit Date", "date"], ["Progress", "progress"], ["Issue / Concern", "issue"], ["Recommendation", "recommendation"]],
        rows: () => data.monitoring
    },
    reports: {
        file: "slp-reports",
        columns: [["ID", "id"], ["Report Type", "type"], ["Coverage Period", "period"], ["Date Filed", "date"], ["Review Status", "status"], ["Details", "details"]],
        rows: () => data.reports
    },
    accounts: {
        file: "slp-user-accounts",
        columns: [["Username", "username"], ["Role", "role"], ["Full Name", "name"], ["Status", "status"]],
        rows: () => Object.keys(users).map(key => ({ username: key, role: users[key].role, name: users[key].name, status: users[key].status }))
    }
};

/* Quote a CSV cell and neutralise spreadsheet formula injection. */
function csvCell(value) {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
    }
    return '"' + text.replace(/"/g, '""') + '"';
}

function exportCSV(name) {
    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can export records.", "error");
        return;
    }
    const config = EXPORTS[name];
    if (!config || !isBrowser() || typeof Blob === "undefined") return;

    const records = config.rows();
    const lines = [config.columns.map(column => csvCell(column[0])).join(",")]
        .concat(records.map(record => config.columns.map(column => csvCell(record[column[1]])).join(",")));
    // BOM so Excel reads the peso sign (₱) correctly.
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.file}-${getCurrentDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${records.length} records to a CSV file.`);
}

function printPage() {
    updateTopbarDate();
    if (isBrowser() && typeof window.print === "function") {
        window.print();
    }
}


/* ==============================================================
   10. DATE IN THE GOVERNMENT BANNER
   ============================================================== */

function updateTopbarDate() {
    if (typeof document === "undefined") {
        return;
    }
    const dateStr = new Date().toLocaleDateString("en-US", {
        timeZone: "Asia/Manila",   // Philippine Standard Time (UTC+8)
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
    });
    const clockEl = get("govphClock");
    if (clockEl) {
        clockEl.textContent = `Philippine Standard Time · ${dateStr}`;
    }
    const printDateEl = get("printDate");
    if (printDateEl) {
        printDateEl.textContent = dateStr;
    }
}


/* ==============================================================
   11. SIGN IN
   ============================================================== */

/*
   Sign in against the server. The server checks the password, the
   account status and the lockout; this only shows the result.
   Resolves true when signed in, false otherwise.
*/
async function loginUser(username, password) {
    try {
        const result = await api("api/login.php", { username, password });
        csrfToken = result.csrf;
        await loadData();
    } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        showLoginError(error.message);
        return false;
    }
    enterApp();
    showToast(`Signed in as ${currentUser.role}.`);
    return true;
}

function showLoginError(message) {
    const loginErrorEl = get("loginError");
    if (loginErrorEl) loginErrorEl.textContent = message;
    const usernameEl = get("username");
    const passwordEl = get("password");
    if (usernameEl && !usernameEl.value) {
        usernameEl.setAttribute("aria-invalid", "true");
        focusElement(usernameEl);
    } else if (passwordEl) {
        passwordEl.setAttribute("aria-invalid", "true");
        focusElement(passwordEl);
    }
}

/* Show the app for the signed-in user (after sign-in or a resumed session). */
function enterApp() {
    profileDirty = false;

    const loginErrorEl = get("loginError");
    if (loginErrorEl) loginErrorEl.textContent = "";
    const loginNoticeEl = get("loginNotice");
    if (loginNoticeEl) loginNoticeEl.classList.add("hidden");
    const loginScreenEl = get("loginScreen");
    if (loginScreenEl) loginScreenEl.classList.add("hidden");
    const appEl = get("app");
    if (appEl) appEl.classList.remove("hidden");

    updateUserInformation();
    createNavigation();
    updateTopbarDate();
    showPage(initialPage(), { history: "replace" });
    startSessionTimer();
}

/* On page load: a session that is still valid signs the user back in silently. */
async function resumeSession() {
    try {
        const result = await api("api/session.php");
        csrfToken = result.csrf;
        await loadData();
    } catch (error) {
        return;   // not signed in: stay on the sign-in screen
    }
    enterApp();
}

const loginFormEl = get("loginForm");
if (loginFormEl) {
    loginFormEl.addEventListener("submit", function (event) {
        event.preventDefault();
        const usernameEl = get("username");
        const passwordEl = get("password");
        loginUser(usernameEl ? usernameEl.value : "", passwordEl ? passwordEl.value : "");
    });
}

/* Clear the sign-in error as soon as the user changes something. */
function clearLoginError() {
    const loginErrorEl = get("loginError");
    if (loginErrorEl) loginErrorEl.textContent = "";
    ["username", "password"].forEach(id => {
        const el = get(id);
        if (el && el.removeAttribute) el.removeAttribute("aria-invalid");
    });
}

const roleSelectEl = get("username");
if (roleSelectEl && roleSelectEl.addEventListener) {
    roleSelectEl.addEventListener("change", clearLoginError);
}

const passwordInputEl = get("password");
if (passwordInputEl && passwordInputEl.addEventListener) {
    passwordInputEl.addEventListener("input", clearLoginError);
}

/* Show / hide password (text button with aria-pressed). */
const togglePassBtn = get("togglePasswordBtn");
if (togglePassBtn && togglePassBtn.addEventListener) {
    togglePassBtn.addEventListener("click", function () {
        const passEl = get("password");
        if (!passEl) return;
        const reveal = passEl.type === "password";
        passEl.type = reveal ? "text" : "password";
        togglePassBtn.setAttribute("aria-pressed", reveal ? "true" : "false");
        const textEl = get("togglePasswordText");
        if (textEl) textEl.textContent = reveal ? "Hide" : "Show";
        const iconEl = get("togglePasswordIcon");
        if (iconEl) iconEl.innerHTML = reveal ? ICON_PATHS["eye-off"] : ICON_PATHS.eye;
    });
}

/* Demo account buttons fill in the form (prototype only). */
if (typeof document !== "undefined" && document.querySelectorAll) {
    const demoRows = document.querySelectorAll(".demo-account-row");
    if (demoRows && demoRows.forEach) {
        demoRows.forEach(function (row) {
            row.addEventListener("click", function () {
                const usernameEl = get("username");
                const passwordEl = get("password");
                if (usernameEl) usernameEl.value = this.getAttribute("data-username");
                if (passwordEl) passwordEl.value = this.getAttribute("data-password");
                clearLoginError();
            });
        });
    }
}


/* ==============================================================
   12. SIGN OUT & SESSION TIMEOUT
   ============================================================== */

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;   // sign out after 15 minutes without activity
const SESSION_WARNING_MS = 2 * 60 * 1000;    // warn 2 minutes before

let sessionTimer = null;
let sessionCountdownTimer = null;
let sessionDeadline = 0;
let sessionWarningOpen = false;
let lastActivity = 0;

/*
   reason: undefined (silent), "signout" (user chose to) or "timeout".
*/
function logoutUser(reason) {
    // End the server session too, without waiting. After a timeout it is already gone.
    const token = csrfToken;
    csrfToken = null;
    if (token && reason !== "timeout" && typeof fetch === "function") {
        fetch("api/logout.php", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
            body: "{}"
        }).catch(() => {});
    }

    currentUser = null;
    currentPage = null;
    profileDirty = false;
    clearSignedInData();
    clearSessionTimers();
    sessionWarningOpen = false;

    if (typeof document !== "undefined") {
        closeAlertDialog();
        const modal = get("modal");
        if (modal && modal.classList && !modal.classList.contains("hidden")) closeModal();
        closeSidebar();
    }

    const appEl = get("app");
    if (appEl) appEl.classList.add("hidden");

    const loginScreenEl = get("loginScreen");
    if (loginScreenEl) loginScreenEl.classList.remove("hidden");

    const loginForm = get("loginForm");
    if (loginForm && loginForm.reset) loginForm.reset();

    const loginErrorEl = get("loginError");
    if (loginErrorEl) loginErrorEl.textContent = "";

    const noticeEl = get("loginNotice");
    if (noticeEl && reason) {
        const message = reason === "timeout"
            ? "You were signed out because there was no activity for 15 minutes. Any changes you had not saved were not kept. Sign in again to continue."
            : "You have signed out. Close the browser if you are using a shared computer.";
        noticeEl.innerHTML = `${icon("info")}<div class="alert__content"><p class="alert__body">${message}</p></div>`;
        noticeEl.classList.remove("hidden");
    }

    if (isBrowser() && window.history && window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    focusElement(get("loginTitle"));
}

/* Sign-out button: warn first if the profile has unsaved changes. */
function requestLogout() {
    if (profileDirty) {
        confirmAction({
            title: "Sign out without saving?",
            message: "You have changes on a form that are not saved. If you sign out now, they will be lost.",
            confirmLabel: "Sign out without saving",
            cancelLabel: "Stay signed in",
            destructive: true,
            onConfirm: () => logoutUser("signout")
        });
        return;
    }
    logoutUser("signout");
}

["logoutButton", "logoutButtonMobile"].forEach(id => {
    const btn = get(id);
    if (btn && btn.addEventListener) btn.addEventListener("click", requestLogout);
});

function clearSessionTimers() {
    clearTimeout(sessionTimer);
    clearInterval(sessionCountdownTimer);
    sessionTimer = null;
    sessionCountdownTimer = null;
}

function startSessionTimer() {
    if (!isBrowser() || !currentUser) return;
    clearSessionTimers();
    sessionDeadline = Date.now() + SESSION_TIMEOUT_MS;
    sessionTimer = setTimeout(showSessionWarning, SESSION_TIMEOUT_MS - SESSION_WARNING_MS);
}

/* Any interaction restarts the inactivity timer (at most every 15 s). */
function recordActivity() {
    if (!currentUser || sessionWarningOpen) return;
    const now = Date.now();
    if (now - lastActivity < 15000) return;
    lastActivity = now;
    startSessionTimer();
}

function formatCountdown(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function showSessionWarning() {
    if (!currentUser) return;
    sessionWarningOpen = true;
    openAlertDialog({
        title: "Your session is about to end",
        bodyHTML: `
            <p>For your security, you will be signed out in <strong id="sessionCountdown">${formatCountdown(sessionDeadline - Date.now())}</strong> because there has been no activity.</p>
            <p class="text-secondary">Changes you have not saved will be lost.</p>`,
        actionsHTML: button("Sign out now", "endSession(false)") + button("Stay signed in", "extendSession()", { variant: "primary" }),
        onCancel: extendSession,
        focusLast: true
    });
    sessionCountdownTimer = setInterval(() => {
        const remaining = sessionDeadline - Date.now();
        const countdownEl = get("sessionCountdown");
        if (countdownEl) countdownEl.textContent = formatCountdown(remaining);
        if (remaining <= 0) endSession(true);
    }, 1000);
}

function extendSession() {
    sessionWarningOpen = false;
    closeAlertDialog();
    startSessionTimer();
    showToast("You are still signed in.", "info");
}

function endSession(timedOut) {
    logoutUser(timedOut ? "timeout" : "signout");
}


/* ==============================================================
   13. USER ROLE CHECKS
   ============================================================== */

function isStaff() {
    return currentUser ? currentUser.role === "MSWDO Personnel" : false;
}

function isLeader() {
    return currentUser ? currentUser.role === "Beneficiary Leader" : false;
}

function isMember() {
    return currentUser ? currentUser.role === "Beneficiary Member" : false;
}


/* ==============================================================
   14. USER INFORMATION (header + mobile drawer)
   ============================================================== */

function updateUserInformation() {
    if (!currentUser) {
        return;
    }

    const beneficiary = (isLeader() || isMember()) ? getCurrentBeneficiary() : null;
    const displayName = beneficiary ? beneficiary.name : currentUser.name;

    // Avatar initials, e.g. "Maria Santos" → "MS"
    const nameParts = String(displayName || "?").trim().split(/\s+/);
    const initials = nameParts.length >= 2
        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
        : String(displayName || "?")[0].toUpperCase();

    const chipHTML = `
        <span class="avatar" aria-hidden="true">${escapeHTML(initials)}</span>
        <span class="user-chip__text">
            <span class="user-chip__name">${escapeHTML(displayName)}</span>
            ${roleBadge(currentUser.role)}
        </span>`;

    ["userInfo", "sidebarUser"].forEach(id => {
        const el = get(id);
        if (el) el.innerHTML = chipHTML;
    });

    updateNotificationCount();
}


/* ==============================================================
   15. SIDEBAR MENU
   ============================================================== */

/*
   MSWDO Personnel has different menus from beneficiaries.
   To add a new menu item, add it to the right list below.
*/
const NAV_ITEMS = {
    staff: [
        { heading: "Program records" },
        { page: "dashboard",     label: "Dashboard",           icon: "layout-dashboard" },
        { page: "beneficiaries", label: "Beneficiaries",       icon: "users" },
        { page: "projects",      label: "Livelihood projects", icon: "briefcase" },
        { page: "assistance",    label: "Assistance",          icon: "wallet" },
        { heading: "Monitoring" },
        { page: "monitoring",    label: "Field monitoring",    icon: "clipboard-check" },
        { page: "usbongassessment", label: "MD Usbong Assessment Tool",     icon: "badge-check" },
        { page: "reports",       label: "Reports",             icon: "file-text" },
        { heading: "Administration" },
        { page: "notifications", label: "Notifications",       icon: "bell" },
        { page: "accounts",      label: "User accounts",       icon: "user-cog" }
    ],
    beneficiary: [
        { heading: "My SLP" },
        { page: "dashboard",     label: "Dashboard",           icon: "layout-dashboard" },
        { page: "profile",       label: "Manage profile",      icon: "square-user" },
        { page: "documents",     label: "My documents",        icon: "folder" },
        { heading: "Updates" },
        { page: "notifications", label: "Notifications",       icon: "bell" },
        { page: "reports",       label: "Reports",             icon: "file-text" }
    ]
};

// Association leaders also fill in the association monitoring tools.
NAV_ITEMS.leader = NAV_ITEMS.beneficiary.concat([
    { heading: "Association" },
    { page: "mdmonitoring",  label: "MD Monitoring Tool (Association)", icon: "clipboard-pen" },
    { page: "orgassessment", label: "Organization Assessment Tool",     icon: "network" }
]);

function createNavigation() {
    const items = isStaff() ? NAV_ITEMS.staff : isLeader() ? NAV_ITEMS.leader : NAV_ITEMS.beneficiary;

    const menuHTML = items.map(item => item.heading
        ? `<h2 class="nav__heading">${item.heading}</h2>`
        : `<button type="button" class="nav__item" id="nav-${item.page}" onclick="navigate('${item.page}')">${icon(item.icon)}<span>${item.label}</span></button>`
    ).join("");

    const navigationEl = get("navigation");
    if (navigationEl) {
        navigationEl.innerHTML = menuHTML;
    }
}


/* ==============================================================
   16. PAGE NAVIGATION
   ============================================================== */

const PAGE_TITLES = {
    dashboard: "Dashboard",
    beneficiaries: "Beneficiaries",
    monitoring: "Field monitoring",
    mdmonitoring: "MD Monitoring Tool (Association)",
    orgassessment: "Organization Assessment Tool",
    usbongassessment: "MD Usbong Assessment Tool",
    assistance: "Assistance",
    reports: "Reports",
    notifications: "Notifications",
    accounts: "User accounts",
    projects: "Livelihood projects",
    profile: "Manage profile",
    documents: "My documents"
};

function pageDescription(pageName) {
    const staff = isStaff();
    const descriptions = {
        dashboard: staff ? "Overview of SLP participants, projects and monitoring in Lubang." : "Your Sustainable Livelihood Program participation at a glance.",
        beneficiaries: "Register participants and view their records and documents.",
        monitoring: "Record field visits, progress, issues and recommendations.",
        mdmonitoring: MONITORING_TOOLS.mdmonitoring.description,
        orgassessment: MONITORING_TOOLS.orgassessment.description,
        usbongassessment: MONITORING_TOOLS.usbongassessment.description,
        assistance: "Record livelihood assistance released to participants.",
        reports: staff ? "Create and review SLP reports." : "View reports shared by the MSWDO.",
        notifications: staff ? "Send notices to participants and review alerts." : "Messages and reminders from the MSWDO.",
        accounts: "Manage who can sign in to the system and what they can do.",
        projects: "Track community livelihood projects and their leaders.",
        profile: "Your SLP Eligibility Assessment and Profile Form.",
        documents: "Upload required documents and check their review status."
    };
    return descriptions[pageName] || "";
}

/*
   Use navigate() for user-initiated navigation (menu, links, Back).
   It protects unsaved profile changes, then calls showPage().
   options.fromHistory: the browser's Back/Forward triggered it.
*/
function navigate(pageName, options = {}) {
    const history = options.fromHistory ? "none" : "push";
    const formPage = currentPage;
    if (profileDirty && (formPage === "profile" || MONITORING_TOOLS[formPage]) && pageName !== formPage) {
        confirmAction({
            title: "Leave without saving?",
            message: "You have changes on this form that are not saved. If you leave this page now, they will be lost.",
            confirmLabel: "Leave without saving",
            cancelLabel: "Stay on this page",
            destructive: true,
            onConfirm: () => {
                profileDirty = false;
                showPage(pageName, { history });
            },
            // Back was pressed but the user stayed: put the profile URL back.
            onCancel: () => { if (options.fromHistory) updatePageUrl(formPage, "push"); }
        });
        return;
    }
    showPage(pageName, { history });
}

/* ---- Page URLs (#/page) so Back, Forward and bookmarks work ---- */

const STAFF_PAGES = ["dashboard", "beneficiaries", "monitoring", "usbongassessment", "assistance", "reports", "notifications", "accounts", "projects"];
const BENEFICIARY_PAGES = ["dashboard", "profile", "documents", "notifications", "reports"];
const LEADER_PAGES = BENEFICIARY_PAGES.concat(["mdmonitoring", "orgassessment"]);

/* Pages the signed-in role may open. */
function allowedPages() {
    return isStaff() ? STAFF_PAGES : isLeader() ? LEADER_PAGES : BENEFICIARY_PAGES;
}

function pageFromUrl() {
    if (!isBrowser()) return null;
    const match = window.location.hash.match(/^#\/([a-z]+)$/);
    return match ? match[1] : null;
}

/* mode: "push" (new history entry), "replace" or "none" */
function updatePageUrl(pageName, mode) {
    if (!isBrowser() || !window.history || mode === "none") return;
    const hash = "#/" + pageName;
    if (window.location.hash === hash) return;
    if (mode === "replace") {
        window.history.replaceState(null, "", hash);
    } else {
        window.history.pushState(null, "", hash);
    }
}

/* First page after sign in: the bookmarked page if this role may open it. */
function initialPage() {
    const requested = pageFromUrl();
    return requested && allowedPages().includes(requested) ? requested : "dashboard";
}

function showPage(pageName, options = {}) {

    // If no user is logged in, do not render application pages.
    if (!currentUser) {
        logoutUser();
        return;
    }

    // Role-based route authorization.
    const isAuthorized = allowedPages().includes(pageName);

    const titleEl = get("pageTitle");
    const descEl = get("pageDescription");
    const contentEl = get("pageContent");
    const breadcrumbEl = get("breadcrumbCurrent");

    if (!isAuthorized) {
        if (titleEl) titleEl.textContent = "Access Denied";
        if (descEl) descEl.textContent = "You do not have permission to view this page.";
        if (breadcrumbEl) breadcrumbEl.textContent = "Access Denied";
        if (contentEl) {
            contentEl.innerHTML = `
                <section class="card">
                    ${emptyState(
                        "lock",
                        "Access Denied",
                        `Your account type (<strong>${escapeHTML(currentUser.role)}</strong>) cannot open this page. If you think this is a mistake, contact the MSWDO office.`,
                        button("Return to dashboard", "navigate('dashboard')", { variant: "primary", icon: "home" }),
                        { error: true, eyebrow: "Error 403", headingTag: "h2" }
                    )}
                </section>`;
        }
        showToast("Access denied: You do not have permission to access this page.", "error");
        return;
    }

    currentPage = pageName;
    const title = PAGE_TITLES[pageName] || "SLP System";

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = pageDescription(pageName);
    if (breadcrumbEl) breadcrumbEl.textContent = title;
    if (typeof document !== "undefined") {
        document.title = `${title} | SLP Information System | MSWDO Lubang`;
    }

    if (!contentEl) {
        return;
    }

    renderedTables = [];

    switch (pageName) {
        case "dashboard":     contentEl.innerHTML = dashboardPage();     break;
        case "beneficiaries": contentEl.innerHTML = beneficiariesPage(); break;
        case "monitoring":    contentEl.innerHTML = monitoringPage();    break;
        case "assistance":    contentEl.innerHTML = assistancePage();    break;
        case "reports":       contentEl.innerHTML = reportsPage();       break;
        case "notifications": contentEl.innerHTML = notificationsPage(); break;
        case "accounts":      contentEl.innerHTML = accountsPage();      break;
        case "projects":      contentEl.innerHTML = projectsPage();      break;
        case "profile":       contentEl.innerHTML = profilePage();       break;
        case "documents":     contentEl.innerHTML = documentsPage();     break;
        default:
            contentEl.innerHTML = MONITORING_TOOLS[pageName] ? MONITORING_TOOLS[pageName].render() : `<section class="card">${emptyState("search-x", "Page Not Found", "The page you asked for does not exist.", button("Return to dashboard", "navigate('dashboard')", { variant: "primary", icon: "home" }), { error: true, eyebrow: "Error 404", headingTag: "h2" })}</section>`;
    }

    // Mark the current menu item.
    if (typeof document !== "undefined" && document.querySelectorAll) {
        const navButtons = document.querySelectorAll(".nav__item");
        if (navButtons.forEach) {
            navButtons.forEach(btn => btn.removeAttribute && btn.removeAttribute("aria-current"));
        }
    }
    const activeNavBtn = get("nav-" + pageName);
    if (activeNavBtn && activeNavBtn.setAttribute) {
        activeNavBtn.setAttribute("aria-current", "page");
    }

    initTables();
    updateToolTotals();
    updateTopbarDate();
    closeSidebar();
    updatePageUrl(pageName, options.history || "push");

    // Move focus to the new page title so screen readers announce it.
    focusElement(titleEl);
}


/* ==============================================================
   17. DASHBOARD
   ============================================================== */

function dashboardPage() {

    // ----------------------------------------------------------
    // STAFF DASHBOARD
    // ----------------------------------------------------------
    if (isStaff()) {
        const totalBeneficiaries = data.beneficiaries.length;
        const activeProjects = data.projects.filter(project => project.status === "Ongoing").length;
        const forMonitoring = data.beneficiaries.filter(beneficiary => beneficiary.status === "For Monitoring").length;
        const unreadNotifications = data.notifications.filter(notification => !notification.read).length;

        return `
            <div class="grid-12">
                <div class="span-sm-6 span-lg-3">${statCard("Total Beneficiaries", totalBeneficiaries, "users")}</div>
                <div class="span-sm-6 span-lg-3">${statCard("Active Projects", activeProjects, "briefcase")}</div>
                <div class="span-sm-6 span-lg-3">${statCard("For Monitoring", forMonitoring, "clipboard-check")}</div>
                <div class="span-sm-6 span-lg-3">${statCard("Pending Notifications", unreadNotifications, "bell")}</div>

                <section class="card span-lg-8" aria-labelledby="recentTitle">
                    ${cardHeader("Recent beneficiaries", "Latest registered participants in LGU Lubang.", button("View all beneficiaries", "navigate('beneficiaries')", { variant: "tertiary", icon: "arrow-right" }), "recentTitle")}
                    ${beneficiaryTable(4)}
                </section>

                <section class="card span-lg-4" aria-labelledby="quickTitle">
                    ${cardHeader("Quick actions", "Common tasks for MSWDO personnel.", "", "quickTitle")}
                    <div class="action-list">
                        ${quickAction("users", "Add beneficiary", "openBeneficiaryForm()", "Register a new SLP participant")}
                        ${quickAction("clipboard-check", "Add monitoring visit", "openMonitoringForm()", "Record a field visit and findings")}
                        ${quickAction("wallet", "Record assistance", "openAssistanceForm()", "Log a grant or support released")}
                    </div>
                </section>
            </div>`;
    }

    // ----------------------------------------------------------
    // BENEFICIARY DASHBOARD
    // ----------------------------------------------------------
    // The server sends a participant only their own records.
    const beneficiary = getCurrentBeneficiary();
    const myDocsCount = data.documents.length;
    const myUnreadNotifs = getVisibleNotifications().filter(n => !n.read).length;
    const profileStatus = beneficiary && beneficiary.profileStatus ? beneficiary.profileStatus : "Draft";
    // Their association's project (or their own on the individual track), not their enrollment status.
    const project = data.projects[0] || null;

    const leaderNotice = isLeader()
        ? alertBox(
            "info",
            "You are signed in as an SLP Association Leader",
            `${escapeHTML(currentUser.associationName || "")} · Livelihood: <strong>${escapeHTML(beneficiary ? beneficiary.livelihood : "")}</strong> · Barangay: <strong>${escapeHTML(beneficiary ? beneficiary.location : "")}</strong>`,
            "users")
        : "";

    return `
        ${leaderNotice}
        <div class="grid-12">
            <div class="span-sm-6 span-lg-3">${statCard("Profile Status", profileStatus, "square-user")}</div>
            <div class="span-sm-6 span-lg-3">${statCard("My Documents", myDocsCount, "folder")}</div>
            <div class="span-sm-6 span-lg-3">${statCard("Project Status", project ? project.status : "No project yet", "briefcase")}</div>
            <div class="span-sm-6 span-lg-3">${statCard("Unread Notices", myUnreadNotifs, "bell")}</div>

            <section class="card span-lg-8" aria-labelledby="myInfoTitle">
                ${cardHeader("My beneficiary information", "Your participant record as kept by the MSWDO.", button("Update my profile", "navigate('profile')", { variant: "tertiary", icon: "pencil" }), "myInfoTitle")}
                ${summaryList([
                    ["Participant Name", `<strong>${beneficiary ? escapeHTML(beneficiary.name) : "—"}</strong>`],
                    ["Livelihood Project", beneficiary ? escapeHTML(beneficiary.livelihood) : "—"],
                    ["Enrollment Status", statusBadge(beneficiary ? beneficiary.status : "Active")],
                    ["Barangay / Location", beneficiary ? escapeHTML(beneficiary.location) : "—"]
                ])}
            </section>

            <section class="card span-lg-4" aria-labelledby="quickTitle">
                ${cardHeader("Quick actions", "What would you like to do?", "", "quickTitle")}
                <div class="action-list">
                    ${quickAction("square-user", "Update profile", "navigate('profile')", "Fill in or correct your SLP form")}
                    ${quickAction("upload", "Upload document", "navigate('documents')", "Send a required document")}
                    ${quickAction("bell", "View notifications", "navigate('notifications')", "Read messages from the MSWDO")}
                </div>
            </section>
        </div>`;
}


/* ==============================================================
   18. DASHBOARD COMPONENTS
   ============================================================== */

/* Statistic tile. `iconName` is a key of ICON_PATHS. */
function statCard(title, value, iconName) {
    const isText = typeof value === "string" && isNaN(Number(value));
    return `
        <div class="card stat">
            <p class="stat__label">${icon(iconName)}${escapeHTML(title)}</p>
            <p class="stat__value${isText ? " stat__value--text" : ""}">${escapeHTML(value)}</p>
        </div>`;
}

/* Large labelled action button. */
function quickAction(iconName, title, action, description) {
    return `
        <button type="button" class="action-tile" onclick="${action}">
            ${icon(iconName, 24)}
            <span class="action-tile__text">
                <span class="action-tile__title">${escapeHTML(title)}</span>
                ${description ? `<span class="action-tile__desc">${escapeHTML(description)}</span>` : ""}
            </span>
            ${icon("chevron-right")}
        </button>`;
}

/* Header action buttons shared by staff registries. */
function registryActions(exportName, addLabel, addAction) {
    return [
        button("Export CSV", `exportCSV('${exportName}')`, { icon: "download" }),
        button("Print", "printPage()", { icon: "printer" }),
        addLabel ? button(addLabel, addAction, { variant: "primary", icon: "plus" }) : ""
    ].join("");
}


/* ==============================================================
   18B. SAVING TO THE SERVER
   ============================================================== */

/* Saves send one POST, then reload the snapshot (wiring spec §4.1). */

/* Trimmed value of a form control, or "" when it is missing. */
function fieldValue(id) {
    const el = get(id);
    return el && el.value != null ? String(el.value).trim() : "";
}

/* Select options from a LABELS map: [{ value: code, label }]. */
function codeOptions(labels) {
    return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

function setBusy(el, busy) {
    if (!el) return;
    el.disabled = busy;
    if (busy) {
        el.setAttribute("aria-busy", "true");
    } else if (el.removeAttribute) {
        el.removeAttribute("aria-busy");
    }
}

/*
   POST body to path. On success: reload the snapshot, close the modal,
   show the page and the success toast. On an ApiError: keep the modal open
   and show the server's message. The confirm button is disabled while the
   request is pending, so a double click cannot save twice.
   Resolves the server's JSON, or null on an error.
*/
async function sendSave(path, body, page, successMessage) {
    const confirmEl = get("confirmButton");
    setBusy(confirmEl, true);
    try {
        const result = await api(path, body);
        await loadData();
        updateNotificationCount();
        closeModal();
        showPage(page);
        showToast(typeof successMessage === "function" ? successMessage(result) : successMessage);
        return result;
    } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (error.status !== 401) showToast(error.message, "error");   // a 401 has already signed the user out
        return null;
    } finally {
        setBusy(confirmEl, false);
    }
}

/* ==============================================================
   19. BENEFICIARIES
   ============================================================== */

function beneficiariesPage() {
    registerTable("beneficiaryTableBody", { countId: "beneficiaryRecordCount", noun: "beneficiaries", caption: "Beneficiary registry" });

    return `
        <section class="card" aria-labelledby="registryTitle">
            ${cardHeader("Beneficiary registry", "Official SLP participant enrollment records and livelihood assignments.", registryActions("beneficiaries", "Add beneficiary", "openBeneficiaryForm()"), "registryTitle")}
            ${tableToolbar({
                tableId: "beneficiaryTableBody",
                searchId: "beneficiarySearch",
                searchHint: "Name, ID or barangay",
                countId: "beneficiaryRecordCount",
                total: data.beneficiaries.length,
                noun: "beneficiaries",
                filterLabel: "Enrollment status",
                filterOptions: uniqueValues(data.beneficiaries, "status")
            })}
            ${beneficiaryTable()}
        </section>`;
}

/*
   Beneficiary table. "limit" is optional: beneficiaryTable(4)
   shows only 4 records (dashboard) without sorting or pages.
*/
function beneficiaryTable(limit) {
    let beneficiaries = data.beneficiaries;
    if (limit) {
        beneficiaries = beneficiaries.slice(0, limit);
    }

    return dataTable({
        id: "beneficiaryTableBody",
        caption: limit ? "Recent beneficiaries" : "Beneficiary registry",
        sortable: !limit,
        paginate: !limit,
        columns: [
            { label: "ID" },
            { label: "Participant Name" },
            { label: "Livelihood Project" },
            { label: "Enrollment Status" },
            { label: "Barangay / Location" },
            { label: '<span class="visually-hidden">Actions</span>', sortable: false, cls: "actions" }
        ],
        rows: beneficiaries.map(beneficiary => ({
            filter: beneficiary.status,
            cells: [
                `<span class="text-id">${escapeHTML(beneficiary.id)}</span>`,
                `<strong>${escapeHTML(beneficiary.name)}</strong>`,
                escapeHTML(beneficiary.livelihood),
                statusBadge(beneficiary.status),
                escapeHTML(beneficiary.location),
                button(`View<span class="visually-hidden"> ${escapeHTML(beneficiary.name)}</span>`, `viewBeneficiary('${escapeHTML(beneficiary.id)}')`, { variant: "tertiary" })
            ]
        })),
        emptyTitle: "No beneficiaries yet",
        emptyText: "Registered participants will appear here."
    });
}

function openBeneficiaryForm() {
    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can add beneficiaries.", "error");
        return;
    }

    const barangayOptions = [{ value: "", label: "Select a barangay" }].concat(
        referenceData.barangays.map(barangay => ({ value: String(barangay.id), label: barangay.name }))
    );
    const associationOptions = [{ value: "", label: "Individual track (no association)" }].concat(
        referenceData.associations.map(association => ({ value: String(association.id), label: association.name }))
    );

    openModal("Add beneficiary", modalForm({
        formId: "beneficiaryForm",
        saveFn: "saveBeneficiary",
        confirmLabel: "Save beneficiary",
        fieldsHTML: `
            ${formField({ id: "beneficiaryFirstName", label: "First Name", required: true, attrs: 'autocomplete="off"' })}
            ${formField({ id: "beneficiaryLastName", label: "Last Name", required: true, attrs: 'autocomplete="off"' })}
            ${formField({ id: "beneficiaryBarangay", label: "Barangay", required: true, options: barangayOptions, hint: "Where the participant lives." })}
            ${formField({ id: "beneficiaryAssociation", label: "Association", options: associationOptions, hint: "The SLP Association the participant belongs to. Their livelihood comes from it." })}
            ${formField({ id: "householdInformation", label: "Household Information", type: "textarea", hint: "Number of members and anything the MSWDO should know, for example: Household of 4, two school-age children." })}`
    }));
}

/* Runs when the Add Beneficiary form is confirmed. */
async function saveBeneficiary(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can add beneficiaries.", "error");
        return;
    }

    const association = fieldValue("beneficiaryAssociation");
    await sendSave("api/beneficiaries.php", {
        firstName: fieldValue("beneficiaryFirstName"),
        lastName: fieldValue("beneficiaryLastName"),
        barangayId: Number(fieldValue("beneficiaryBarangay")) || null,
        associationId: association ? Number(association) : null,
        householdInformation: fieldValue("householdInformation")
    }, "beneficiaries", result => `Beneficiary ${displayId("B", result.id)} was saved.`);
}

/* Ask before approving — approval is recorded as verified. */
function approveDocumentWithConfirmation(docIndex, beneficiaryId) {
    const doc = data.documents[docIndex];
    if (!doc) return;
    confirmAction({
        title: "Approve this document?",
        message: `"${doc.name}" will be marked as Approved and the participant will see it as verified.`,
        confirmLabel: "Approve document",
        cancelLabel: "Cancel",
        onConfirm: () => approveDocument(doc.name, beneficiaryId)
    });
}

function approveDocument(docName, beneficiaryId) {
    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can review documents.", "error");
        return;
    }
    const doc = data.documents.find(d => d.name === docName);
    if (doc) {
        doc.status = "Approved";
        showToast(`Document "${docName}" approved.`);
        if (beneficiaryId) {
            viewBeneficiary(beneficiaryId);
        }
    }
}

function viewBeneficiary(id) {
    const beneficiary = data.beneficiaries.find(item => item.id === id);
    if (!beneficiary) {
        return;
    }

    const submittedDocs = data.documents.filter(d => d.beneficiary === beneficiary.name);

    const documentsHTML = submittedDocs.length === 0
        ? `<p class="text-secondary">No compliance documents on record for this participant.</p>`
        : `
            <div class="table-wrap" role="region" aria-label="Compliance documents" tabindex="0">
                <table class="table table--compact">
                    <caption class="visually-hidden">Compliance and verification documents</caption>
                    <thead><tr><th scope="col">Document Title</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
                    <tbody>
                        ${submittedDocs.map(doc => `
                            <tr>
                                <td><strong>${escapeHTML(doc.name)}</strong></td>
                                <td>${escapeHTML(doc.type)}</td>
                                <td>${statusBadge(doc.status)}</td>
                                <td class="actions">
                                    ${doc.status === "For Review"
                                        ? button("Approve", `approveDocumentWithConfirmation(${data.documents.indexOf(doc)}, '${escapeHTML(beneficiary.id)}')`, { variant: "tertiary", icon: "check" })
                                        : ""}
                                </td>
                            </tr>`).join("")}
                    </tbody>
                </table>
            </div>`;

    openModal("Beneficiary details", `
        <div class="modal__section">
            ${summaryList([
                ["Beneficiary ID", `<span class="text-id">${escapeHTML(beneficiary.id)}</span>`],
                ["Name", `<strong>${escapeHTML(beneficiary.name)}</strong>`],
                ["Livelihood", escapeHTML(beneficiary.livelihood)],
                ["Status", statusBadge(beneficiary.status)],
                ["Location", escapeHTML(beneficiary.location)],
                ["Household Information", `<span class="summary-list__pre">${escapeHTML(beneficiary.householdInformation || "None")}</span>`]
            ])}
        </div>
        <div class="modal__section">
            <h3 class="modal__section-title">Compliance and verification documents</h3>
            ${documentsHTML}
        </div>
        <div class="modal__footer">
            ${button("Print record", "printPage()", { icon: "printer" })}
            ${button("View reports", "closeModal(); navigate('reports')")}
            <button type="button" class="btn btn--primary" onclick="openMonitoringForm('${escapeHTML(beneficiary.id)}')">${icon("plus")}<span>Add monitoring visit</span></button>
        </div>`);
}


/* ==============================================================
   20. FIELD MONITORING
   ============================================================== */

function monitoringPage() {
    registerTable("monitoringTableBody", { countId: "monitoringRecordCount", noun: "records", caption: "Field monitoring records" });

    return `
        <section class="card" aria-labelledby="monitoringTitle">
            ${cardHeader("Field monitoring records", "Site visits, observations, participant progress and recommendations.", registryActions("monitoring", "Add monitoring visit", "openMonitoringForm()"), "monitoringTitle")}
            ${tableToolbar({
                tableId: "monitoringTableBody",
                searchId: "monitoringSearch",
                searchHint: "Participant, ID or remarks",
                countId: "monitoringRecordCount",
                total: data.monitoring.length,
                noun: "records",
                filterLabel: "Evaluation status",
                filterOptions: uniqueValues(data.monitoring, "progress")
            })}
            ${dataTable({
                id: "monitoringTableBody",
                caption: "Field monitoring records",
                columns: [
                    { label: "ID" },
                    { label: "Participant" },
                    { label: "Visit Date" },
                    { label: "Evaluation Status" },
                    { label: "Reported Issue" },
                    { label: "Recommendation" },
                    { label: '<span class="visually-hidden">Actions</span>', sortable: false, cls: "actions" }
                ],
                rows: data.monitoring.map(record => ({
                    filter: record.progress,
                    sort: { 2: record.date },
                    cells: [
                        `<span class="text-id">${escapeHTML(record.id)}</span>`,
                        `<strong>${escapeHTML(record.beneficiary)}</strong>`,
                        escapeHTML(formatDate(record.date)),
                        statusBadge(record.progress),
                        escapeHTML(record.issue),
                        escapeHTML(record.recommendation),
                        button(`View<span class="visually-hidden"> ${escapeHTML(record.id)}</span>`, `viewMonitoring('${escapeHTML(record.id)}')`, { variant: "tertiary" })
                    ]
                })),
                emptyTitle: "No monitoring visits yet",
                emptyText: "Choose Add monitoring visit to record the first one."
            })}
        </section>`;
}

function viewMonitoring(id) {
    const record = data.monitoring.find(item => item.id === id);
    if (!record) return;

    openModal("Field monitoring details", `
        ${summaryList([
            ["Monitoring ID", `<span class="text-id">${escapeHTML(record.id)}</span>`],
            ["Participant", `<strong>${escapeHTML(record.beneficiary)}</strong>`],
            ["Visit Date", escapeHTML(formatDate(record.date))],
            ["Evaluation Status", statusBadge(record.progress)],
            ["Reported Issue", escapeHTML(record.issue || "None")],
            ["Staff Recommendation", `<span class="summary-list__pre">${escapeHTML(record.recommendation || "None")}</span>`]
        ])}
        <div class="modal__footer">
            ${button("Print record", "printPage()", { icon: "printer" })}
            ${button("Close", "closeModal()", { variant: "primary" })}
        </div>`);
}

function openMonitoringForm(selected = "") {
    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can add monitoring records.", "error");
        return;
    }

    const beneficiaryOptions = [{ value: "", label: "Select a beneficiary" }].concat(
        data.beneficiaries.map(beneficiary => ({
            value: String(beneficiary.dbId),
            label: `${beneficiary.name} (${beneficiary.id})`,
            selected: beneficiary.id === selected
        }))
    );

    openModal("Add monitoring visit", modalForm({
        formId: "monitoringForm",
        saveFn: "saveMonitoring",
        confirmLabel: "Save monitoring record",
        fieldsHTML: `
            ${formField({ id: "monitoringBeneficiary", label: "Beneficiary", required: true, options: beneficiaryOptions })}
            ${formField({ id: "monitoringDate", label: "Visit Date", type: "date", required: true, value: getCurrentDate(), attrs: `max="${getCurrentDate()}"` })}
            ${formField({ id: "monitoringProgress", label: "Progress", options: codeOptions(LABELS.progress) })}
            ${formField({ id: "monitoringIssue", label: "Issue / Concern", hint: "Leave blank if there were no issues." })}
            ${formField({ id: "monitoringRecommendation", label: "Recommendation", type: "textarea", required: true, hint: "What should the participant or MSWDO do next?" })}`
    }));
}

async function saveMonitoring(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can add monitoring records.", "error");
        return;
    }

    await sendSave("api/monitoring.php", {
        beneficiaryId: Number(fieldValue("monitoringBeneficiary")) || null,
        visitDate: fieldValue("monitoringDate"),
        progress: fieldValue("monitoringProgress"),
        issue: fieldValue("monitoringIssue"),
        recommendation: fieldValue("monitoringRecommendation")
    }, "monitoring", result => `Monitoring record ${displayId("M", result.id)} was saved.`);
}


/* ==============================================================
   21. ASSISTANCE
   ============================================================== */

function assistancePage() {
    registerTable("assistanceTableBody", { countId: "assistanceRecordCount", noun: "grants", caption: "Assistance records" });

    const totalDisbursed = data.assistance.reduce((sum, item) => sum + parseAmount(item.amount), 0);

    return `
        <section class="card" aria-labelledby="assistanceTitle">
            ${cardHeader("Assistance records", "Livelihood and support assistance released to program participants.", registryActions("assistance", "Record assistance", "openAssistanceForm()"), "assistanceTitle")}
            ${tableToolbar({
                tableId: "assistanceTableBody",
                searchId: "assistanceSearch",
                searchHint: "Recipient, type or date",
                countId: "assistanceRecordCount",
                total: data.assistance.length,
                noun: "grants",
                filterLabel: "Support type",
                filterOptions: uniqueValues(data.assistance, "type"),
                summaryHTML: `<p class="table-summary">Total disbursed: <strong>${formatPeso(totalDisbursed)}</strong></p>`
            })}
            ${dataTable({
                id: "assistanceTableBody",
                caption: "Assistance records",
                columns: [
                    { label: "ID" },
                    { label: "Participant / Recipient" },
                    { label: "Support Type" },
                    { label: "Release Date" },
                    { label: "Amount Granted", num: true }
                ],
                rows: data.assistance.map(record => ({
                    filter: record.type,
                    sort: { 3: record.date, 4: parseAmount(record.amount) },
                    cells: [
                        `<span class="text-id">${escapeHTML(record.id)}</span>`,
                        `<strong>${escapeHTML(record.recipient)}</strong>`,
                        escapeHTML(record.type),
                        escapeHTML(formatDate(record.date)),
                        `<strong>${escapeHTML(record.amount)}</strong>`
                    ]
                })),
                emptyTitle: "No assistance recorded yet",
                emptyText: "Choose Record assistance to add the first grant."
            })}
        </section>`;
}

function openAssistanceForm() {
    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can record assistance.", "error");
        return;
    }

    const recipientOptions = [{ value: "", label: "Select a recipient" }].concat(
        data.beneficiaries.map(beneficiary => ({ value: String(beneficiary.dbId), label: `${beneficiary.name} (${beneficiary.id})` }))
    );

    openModal("Record assistance", modalForm({
        formId: "assistanceForm",
        saveFn: "saveAssistance",
        confirmLabel: "Save assistance record",
        fieldsHTML: `
            ${formField({ id: "assistanceRecipient", label: "Recipient", required: true, options: recipientOptions })}
            ${formField({ id: "assistanceType", label: "Support Type", options: codeOptions(LABELS.support) })}
            ${formField({ id: "assistanceDate", label: "Release Date", type: "date", required: true, value: getCurrentDate(), attrs: `max="${getCurrentDate()}"` })}
            ${formField({ id: "assistanceAmount", label: "Amount (₱)", hint: "Numbers only, for example 5000 or 5,000.50. Leave blank if not monetary.", attrs: 'inputmode="decimal" pattern="[₱0-9,. ]*" data-pattern-message="Enter the amount in numbers only, for example 5000"' })}`
    }));
}

async function saveAssistance(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can record assistance.", "error");
        return;
    }

    const amount = fieldValue("assistanceAmount").replace(/[₱,\s]/g, "");   // the server checks the number
    await sendSave("api/assistance.php", {
        beneficiaryId: Number(fieldValue("assistanceRecipient")) || null,
        supportType: fieldValue("assistanceType"),
        releaseDate: fieldValue("assistanceDate"),
        amount: amount === "" ? null : amount
    }, "assistance", result => `Assistance record ${displayId("A", result.id)} was saved.`);
}


/* ==============================================================
   22. REPORTS
   ============================================================== */

function reportsPage() {
    registerTable("reportsTableBody", { countId: "reportRecordCount", noun: "reports", caption: "Reports" });

    const actions = isStaff()
        ? registryActions("reports", "Create report", "openReportForm()")
        : button("Print", "printPage()", { icon: "printer" });

    return `
        <section class="card" aria-labelledby="reportsTitle">
            ${cardHeader(isStaff() ? "Generated reports" : "Shared reports", "Official project, progress and status reports.", actions, "reportsTitle")}
            ${tableToolbar({
                tableId: "reportsTableBody",
                searchId: "reportSearch",
                searchHint: "Report ID, type or date",
                countId: "reportRecordCount",
                total: data.reports.length,
                noun: "reports",
                filterLabel: "Review status",
                filterOptions: uniqueValues(data.reports, "status")
            })}
            ${dataTable({
                id: "reportsTableBody",
                caption: "Reports",
                columns: [
                    { label: "ID" },
                    { label: "Report Type" },
                    { label: "Date Filed" },
                    { label: "Review Status" },
                    { label: '<span class="visually-hidden">Actions</span>', sortable: false, cls: "actions" }
                ],
                rows: data.reports.map(report => ({
                    filter: report.status,
                    sort: { 2: report.date },
                    cells: [
                        `<span class="text-id">${escapeHTML(report.id)}</span>`,
                        `<strong>${escapeHTML(report.type)}</strong>`,
                        escapeHTML(formatDate(report.date)),
                        statusBadge(report.status),
                        button(`View<span class="visually-hidden"> ${escapeHTML(report.id)}</span>`, `viewReport('${escapeHTML(report.id)}')`, { variant: "tertiary" })
                    ]
                })),
                emptyTitle: "No reports yet",
                emptyText: isStaff() ? "Choose Create report to file the first one." : "Reports shared by the MSWDO will appear here."
            })}
        </section>`;
}

function openReportForm() {
    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can create reports.", "error");
        return;
    }

    openModal("Create report", modalForm({
        formId: "reportForm",
        saveFn: "saveReport",
        confirmLabel: "Save report",
        fieldsHTML: `
            ${formField({ id: "reportType", label: "Report Type", options: codeOptions(LABELS.reportType) })}
            ${formField({ id: "reportPeriod", label: "Report Period", required: true, hint: "The months or quarter covered, for example September 2026 or Q3 2026." })}
            ${formField({ id: "reportDetails", label: "Report Details", type: "textarea", required: true, hint: "Summarise findings, figures and recommendations." })}`
    }));
}

async function saveReport(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can create reports.", "error");
        return;
    }

    await sendSave("api/reports.php", {
        reportType: fieldValue("reportType"),
        period: fieldValue("reportPeriod"),
        details: fieldValue("reportDetails")
    }, "reports", result => `Report ${displayId("R", result.id)} was created and is now For Review.`);
}

function viewReport(id) {
    const report = data.reports.find(item => item.id === id);
    if (!report) {
        return;
    }

    const pairs = [
        ["Report ID", `<span class="text-id">${escapeHTML(report.id)}</span>`],
        ["Type", `<strong>${escapeHTML(report.type)}</strong>`]
    ];
    if (report.period) pairs.push(["Coverage Period", escapeHTML(report.period)]);
    pairs.push(["Date Filed", escapeHTML(formatDate(report.date))]);
    pairs.push(["Status", statusBadge(report.status)]);

    openModal("Report details", `
        <div class="modal__section">${summaryList(pairs)}</div>
        <div class="modal__section">
            <h3 class="modal__section-title">Report content</h3>
            ${report.details
                ? `<p class="summary-list__pre measure">${escapeHTML(report.details)}</p>`
                : alertBox("neutral", "", "Official report filed on record with the Municipal Social Welfare and Development Office.", "file-text")}
        </div>
        <div class="modal__footer">
            ${button("Print report", "printPage()", { icon: "printer" })}
            ${button("Close", "closeModal()", { variant: "primary" })}
        </div>`);
}


/* ==============================================================
   23. NOTIFICATIONS
   ============================================================== */

/* Notifications the current user is allowed to see. */
/* The server already sent only what this user may see (schema spec §7). */
function getVisibleNotifications() {
    return data.notifications;
}

function notificationsPage() {
    const visibleNotifications = getVisibleNotifications();
    const unreadCount = visibleNotifications.filter(n => !n.read).length;

    const actions = [
        unreadCount ? button("Mark all as read", "markAllNotificationsAsRead()", { icon: "check-check" }) : "",
        isStaff() ? button("Send notification", "openNotificationForm()", { variant: "primary", icon: "send" }) : ""
    ].join("");

    const listHTML = visibleNotifications.length === 0
        ? emptyState("inbox", "No notifications", "Messages from the MSWDO will appear here.")
        : `
            <ul class="notice-list" id="noticeList">
                ${visibleNotifications.map(notification => {
                    const originalIndex = data.notifications.indexOf(notification);
                    const unread = !notification.read;
                    return `
                        <li class="notice ${unread ? "notice--unread" : "notice--read"}" data-read="${unread ? "false" : "true"}">
                            <div class="notice__meta">
                                ${unread ? `<span class="badge badge--info">${icon("circle", 16)}Unread</span>` : `<span class="badge badge--neutral">${icon("check", 16)}Read</span>`}
                                <span class="notice__meta-item">${icon("mail", 16)}To: ${escapeHTML(notification.recipient || "All Beneficiaries")}</span>
                                <span class="notice__meta-item">${icon("calendar", 16)}${escapeHTML(formatDate(notification.date))}</span>
                            </div>
                            <h3 class="notice__title">${escapeHTML(notification.title)}</h3>
                            <p class="notice__message">${escapeHTML(notification.message)}</p>
                            ${unread ? `<div class="notice__actions">${button(`Mark as read<span class="visually-hidden">: ${escapeHTML(notification.title)}</span>`, `markNotificationAsRead(${originalIndex})`, { variant: "tertiary", icon: "check" })}</div>` : ""}
                        </li>`;
                }).join("")}
            </ul>
            <div id="noticeEmptyUnread" hidden>${emptyState("check-check", "You are all caught up", "There are no unread notifications.")}</div>`;

    return `
        <section class="card" aria-labelledby="noticesTitle">
            ${cardHeader("Notifications", "Alerts, correction requests and monitoring reminders.", actions, "noticesTitle")}
            <div class="tabs">
                <div class="tabs__list" role="tablist" aria-label="Filter notifications">
                    <button type="button" class="tabs__tab" role="tab" id="noticeTabAll" aria-selected="true" aria-controls="noticePanel" onclick="selectNoticeTab('all')">All <span class="text-secondary">(${visibleNotifications.length})</span></button>
                    <button type="button" class="tabs__tab" role="tab" id="noticeTabUnread" aria-selected="false" aria-controls="noticePanel" tabindex="-1" onclick="selectNoticeTab('unread')">Unread <span class="text-secondary">(${unreadCount})</span></button>
                </div>
                <div id="noticePanel" role="tabpanel" aria-labelledby="noticeTabAll">
                    ${listHTML}
                </div>
            </div>
        </section>`;
}

/* Tabs: show all or only unread notifications. */
function selectNoticeTab(tab) {
    if (!isBrowser()) return;
    const showUnread = tab === "unread";
    const allTab = get("noticeTabAll");
    const unreadTab = get("noticeTabUnread");
    [[allTab, !showUnread], [unreadTab, showUnread]].forEach(([el, selected]) => {
        if (!el) return;
        el.setAttribute("aria-selected", selected ? "true" : "false");
        el.setAttribute("tabindex", selected ? "0" : "-1");
    });
    const panel = get("noticePanel");
    if (panel) panel.setAttribute("aria-labelledby", showUnread ? "noticeTabUnread" : "noticeTabAll");

    let visible = 0;
    document.querySelectorAll("#noticeList .notice").forEach(item => {
        const hide = showUnread && item.getAttribute("data-read") === "true";
        item.hidden = hide;
        if (!hide) visible++;
    });
    const emptyEl = get("noticeEmptyUnread");
    if (emptyEl) emptyEl.hidden = !(showUnread && visible === 0);
}

async function markNotificationAsRead(index) {
    const notification = data.notifications[index];
    if (!notification) return;
    await sendSave("api/notifications.php", { action: "read", id: notification.dbId }, "notifications", "Notification marked as read.");
}

async function markAllNotificationsAsRead() {
    await sendSave("api/notifications.php", { action: "read_all" }, "notifications", "All notifications marked as read.");
}

function openNotificationForm() {
    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can send notifications.", "error");
        return;
    }

    const recipientOptions = [{ value: "", label: "All beneficiaries" }].concat(
        data.beneficiaries.map(beneficiary => ({ value: String(beneficiary.dbId), label: `${beneficiary.name} (${beneficiary.id})` }))
    );

    openModal("Send notification", modalForm({
        formId: "notificationForm",
        saveFn: "saveNotification",
        confirmLabel: "Send notification",
        fieldsHTML: `
            ${formField({ id: "notificationRecipient", label: "Recipient", options: recipientOptions, hint: "Only the selected participant will see a private message." })}
            ${formField({ id: "notificationTitle", label: "Title", required: true, hint: "A short subject, for example Monitoring visit on 10 October." })}
            ${formField({ id: "notificationMessage", label: "Message", type: "textarea", required: true, hint: "Use plain words. Say what the participant needs to do and by when." })}`
    }));
}

async function saveNotification(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can send notifications.", "error");
        return;
    }

    const recipient = fieldValue("notificationRecipient");
    await sendSave("api/notifications.php", {
        action: "send",
        beneficiaryId: recipient ? Number(recipient) : null,
        title: fieldValue("notificationTitle"),
        message: fieldValue("notificationMessage")
    }, "notifications", "Notification sent.");
}


/* ==============================================================
   24. USER ACCOUNTS
   ============================================================== */

function accountsPage() {
    const userList = Object.keys(users).map(key => ({
        username: key,
        role: users[key].role,
        name: users[key].name,
        status: users[key].status
    }));

    registerTable("accountsTableBody", { countId: "accountRecordCount", noun: "accounts", caption: "User accounts" });

    return `
        <section class="card" aria-labelledby="accountsTitle">
            ${cardHeader("User accounts", "People who can sign in, and what each account type is allowed to do.", registryActions("accounts", "Add account", "openAccountForm()"), "accountsTitle")}
            ${tableToolbar({
                tableId: "accountsTableBody",
                searchId: "accountSearch",
                searchHint: "Username, role or name",
                countId: "accountRecordCount",
                total: userList.length,
                noun: "accounts",
                filterLabel: "Role",
                filterOptions: uniqueValues(userList, "role")
            })}
            ${dataTable({
                id: "accountsTableBody",
                caption: "User accounts",
                columns: [
                    { label: "Username" },
                    { label: "Designated Role" },
                    { label: "Full Name" },
                    { label: "Status" }
                ],
                rows: userList.map(u => ({
                    filter: u.role,
                    sort: { 1: u.role },
                    cells: [
                        `<span class="text-id">${escapeHTML(u.username)}</span>`,
                        roleBadge(u.role),
                        escapeHTML(u.name),
                        statusBadge(u.status)
                    ]
                }))
            })}
        </section>`;
}

function openAccountForm() {
    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can create user accounts.", "error");
        return;
    }

    const accountForOptions = [{ value: "staff", label: "MSWDO Personnel" }].concat(
        data.beneficiaries.filter(beneficiary => !beneficiary.hasAccount)
            .map(beneficiary => ({ value: String(beneficiary.dbId), label: `${beneficiary.name} (${beneficiary.id})` }))
    );

    openModal("Add user account", modalForm({
        formId: "accountForm",
        saveFn: "saveAccount",
        confirmLabel: "Create account",
        fieldsHTML: `
            ${formField({ id: "newAccountFor", label: "Account For", options: accountForOptions, hint: "MSWDO Personnel, or a participant who does not have an account yet." })}
            ${formField({ id: "newFullName", label: "Full Name", hint: "MSWDO Personnel only. Participants use their registry name." })}
            ${formField({ id: "newUsername", label: "Username", required: true, hint: "Letters, numbers, dots, dashes or underscores. Used to sign in.", attrs: 'autocomplete="off" autocapitalize="none" pattern="[A-Za-z0-9._\\-]+" data-pattern-message="Use only letters, numbers, dots, dashes or underscores"' })}
            ${formField({ id: "newPassword", label: "Password", type: "password", required: true, hint: "At least 8 characters. Share it with the user privately; they should change it after first sign in.", attrs: 'autocomplete="new-password" minlength="8"' })}`
    }));
}

async function saveAccount(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can create user accounts.", "error");
        return;
    }

    const accountFor = fieldValue("newAccountFor");
    const username = fieldValue("newUsername");
    const password = get("newPassword") ? get("newPassword").value : "";   // not trimmed: spaces count
    const body = accountFor === "staff"
        ? { accountType: "staff", fullName: fieldValue("newFullName"), username, password }
        : { accountType: "participant", beneficiaryId: Number(accountFor) || null, username, password };
    await sendSave("api/accounts.php", body, "accounts", `Account "${username}" created.`);
}


/* ==============================================================
   25. LIVELIHOOD PROJECTS
   ============================================================== */

function projectsPage() {
    registerTable("projectsTableBody", { countId: "projectRecordCount", noun: "projects", caption: "Livelihood projects" });

    return `
        <section class="card" aria-labelledby="projectsTitle">
            ${cardHeader("Livelihood projects", "Approved community enterprise projects and their designated leaders.", registryActions("projects", "Add project", "openProjectForm()"), "projectsTitle")}
            ${tableToolbar({
                tableId: "projectsTableBody",
                searchId: "projectSearch",
                searchHint: "Project name, ID or leader",
                countId: "projectRecordCount",
                total: data.projects.length,
                noun: "projects",
                filterLabel: "Project status",
                filterOptions: uniqueValues(data.projects, "status")
            })}
            ${dataTable({
                id: "projectsTableBody",
                caption: "Livelihood projects",
                columns: [
                    { label: "ID" },
                    { label: "Project Name" },
                    { label: "Project Leader" },
                    { label: "Project Status" },
                    { label: '<span class="visually-hidden">Actions</span>', sortable: false, cls: "actions" }
                ],
                rows: data.projects.map(project => ({
                    filter: project.status,
                    cells: [
                        `<span class="text-id">${escapeHTML(project.id)}</span>`,
                        `<strong>${escapeHTML(project.name)}</strong>`,
                        escapeHTML(project.leader),
                        statusBadge(project.status),
                        button(`View<span class="visually-hidden"> ${escapeHTML(project.name)}</span>`, `viewProject('${escapeHTML(project.id)}')`, { variant: "tertiary" })
                    ]
                })),
                emptyTitle: "No projects yet",
                emptyText: "Choose Add project to register the first one."
            })}
        </section>`;
}

function openProjectForm() {
    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can add livelihood projects.", "error");
        return;
    }

    // An association runs the project, or one participant on the individual track.
    const ownerOptions = [{ value: "", label: "Select an owner" }].concat(
        referenceData.associations.map(association => ({ value: `a:${association.id}`, label: association.name })),
        data.beneficiaries.filter(beneficiary => beneficiary.associationId === null)
            .map(beneficiary => ({ value: `b:${beneficiary.dbId}`, label: `${beneficiary.name} (${beneficiary.id}), individual track` }))
    );
    const livelihoodOptions = [{ value: "", label: "Select a livelihood type" }].concat(
        referenceData.livelihoodTypes.map(type => ({ value: String(type.id), label: type.name }))
    );

    openModal("Add livelihood project", modalForm({
        formId: "projectForm",
        saveFn: "saveProject",
        confirmLabel: "Save project",
        fieldsHTML: `
            ${formField({ id: "projectName", label: "Project Name", required: true, hint: "For example: Barangay Tilik Community Store." })}
            ${formField({ id: "projectOwner", label: "Owner", required: true, options: ownerOptions, hint: "The association that runs it, or one participant on the individual track." })}
            ${formField({ id: "projectLivelihood", label: "Livelihood Type", required: true, options: livelihoodOptions })}
            ${formField({ id: "projectStatus", label: "Status", options: codeOptions(LABELS.project) })}`
    }));
}

async function saveProject(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    if (!isStaff()) {
        showToast("Access denied: Only MSWDO Personnel can add livelihood projects.", "error");
        return;
    }

    const [kind, id] = fieldValue("projectOwner").split(":");
    await sendSave("api/projects.php", {
        name: fieldValue("projectName"),
        associationId: kind === "a" ? Number(id) : null,
        beneficiaryId: kind === "b" ? Number(id) : null,
        livelihoodTypeId: Number(fieldValue("projectLivelihood")) || null,
        status: fieldValue("projectStatus")
    }, "projects", result => `Project ${displayId("P", result.id)} was saved.`);
}

function viewProject(id) {
    const project = data.projects.find(item => item.id === id);
    if (!project) {
        return;
    }

    openModal("Project details", `
        ${summaryList([
            ["Project ID", `<span class="text-id">${escapeHTML(project.id)}</span>`],
            ["Project", `<strong>${escapeHTML(project.name)}</strong>`],
            ["Leader", escapeHTML(project.leader)],
            ["Status", statusBadge(project.status)]
        ])}
        <div class="modal__footer">
            ${button("Print record", "printPage()", { icon: "printer" })}
            ${button("Close", "closeModal()", { variant: "primary" })}
        </div>`);
}


/* ==============================================================
   26. MODAL FORM REVIEW & VALIDATION
   ============================================================== */

/* Visible label text for a control, without "(required)". */
function labelTextFor(control) {
    if (!control || !control.id || typeof document === "undefined") return "";
    const label = document.querySelector(`label[for="${control.id}"]`);
    return label ? label.textContent.replace("(required)", "").trim() : control.id;
}

/* Plain-language error message for one control, or "" if valid. */
function fieldErrorMessage(control) {
    const validity = control.validity;
    if (!validity) return "";
    const label = labelTextFor(control);
    if (validity.valueMissing) {
        if (control.tagName === "SELECT") return `Select ${label.toLowerCase()}`;
        if (control.type === "file") return "Choose a file to upload";
        if (control.type === "date") return `Enter the ${label.toLowerCase()}`;
        return `Enter ${label.toLowerCase()}`;
    }
    if (validity.typeMismatch && control.type === "email") return "Enter an email address in the correct format, like name@example.com";
    if (validity.patternMismatch) return control.getAttribute("data-pattern-message") || `Enter ${label.toLowerCase()} in the correct format`;
    if (validity.rangeOverflow && control.type === "date") return `${label} cannot be in the future`;
    if (validity.badInput || validity.rangeUnderflow || validity.rangeOverflow) return `Enter a valid ${label.toLowerCase()}`;
    return "";
}

/* Show or clear the inline error for one control. Returns true if valid. */
function validateField(control) {
    if (!control || !control.id) return true;
    const message = fieldErrorMessage(control);
    const errorEl = get(control.id + "Error");
    const hintId = control.id + "Hint";
    const describedBy = [get(hintId) ? hintId : "", message ? control.id + "Error" : ""].filter(Boolean).join(" ");

    if (message) {
        control.setAttribute("aria-invalid", "true");
    } else {
        control.removeAttribute("aria-invalid");
    }
    if (describedBy) {
        control.setAttribute("aria-describedby", describedBy);
    } else {
        control.removeAttribute("aria-describedby");
    }
    if (errorEl) {
        errorEl.innerHTML = message ? `${icon("circle-alert", 16)}<span><span class="visually-hidden">Error: </span>${escapeHTML(message)}</span>` : "";
        errorEl.hidden = !message;
    }
    return !message;
}

/* Validate a whole form and show an error summary linking to each problem. */
function validateForm(form) {
    const controls = Array.from(form.querySelectorAll("input, select, textarea"));
    const problems = [];
    controls.forEach(control => {
        if (!validateField(control)) {
            problems.push({ id: control.id, message: fieldErrorMessage(control) });
        }
    });

    const summary = get(form.id + "Errors");
    if (summary) {
        if (problems.length) {
            summary.innerHTML = `
                <h3 class="error-summary__title">${icon("circle-alert")}There ${problems.length === 1 ? "is a problem" : `are ${problems.length} problems`}</h3>
                <ul class="error-summary__list">
                    ${problems.map(p => `<li><a href="#${p.id}" onclick="focusElement(document.getElementById('${p.id}')); return false;">${escapeHTML(p.message)}</a></li>`).join("")}
                </ul>`;
            summary.hidden = false;
            focusElement(summary);
        } else {
            summary.hidden = true;
            summary.innerHTML = "";
        }
    }
    return problems.length === 0;
}

/* Turn a control's current value into readable review text. */
function displayValue(control) {
    if (control.tagName === "SELECT") {
        const option = control.options[control.selectedIndex];
        return option && option.value !== "" ? option.textContent.trim() : "";
    }
    if (control.type === "password") return control.value ? "•••••••• (hidden)" : "";
    if (control.type === "file") return control.files && control.files[0] ? control.files[0].name : "";
    if (control.type === "date") return formatDate(control.value);
    return control.value.trim();
}

/* Form submit → validate → show "Check your answers". Nothing is saved yet. */
function reviewForm(event, saveFnName, confirmLabel) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event.target;
    if (!validateForm(form)) return false;

    const rows = Array.from(form.querySelectorAll(".field")).map(field => {
        const control = field.querySelector("input, select, textarea");
        if (!control) return "";
        const value = displayValue(control);
        return `
            <dt>${escapeHTML(labelTextFor(control))}</dt>
            <dd class="summary-list__value--with-action">${value ? `<span class="summary-list__pre">${escapeHTML(value)}</span>` : '<span class="text-secondary">Not provided</span>'}</dd>
            <dd class="summary-list__action">${button(`Change<span class="visually-hidden"> ${escapeHTML(labelTextFor(control))}</span>`, `editForm('${form.id}', '${control.id}')`, { variant: "tertiary" })}</dd>`;
    }).join("");

    const review = get(form.id + "Review");
    review.innerHTML = `
        ${alertBox("info", "Check your answers", "Nothing has been saved yet. Make sure everything is correct, then confirm.")}
        <dl class="summary-list">${rows}</dl>
        <div class="modal__footer">
            ${button("Back to edit", `editForm('${form.id}')`, { icon: "arrow-left" })}
            ${button(confirmLabel, `${saveFnName}()`, { variant: "primary", icon: "check", attrs: 'id="confirmButton" data-confirm' })}
        </div>`;
    form.hidden = true;
    review.hidden = false;
    focusElement(get("modalTitle"));
    return false;
}

/* Return from the review step to the form, optionally to one field. */
function editForm(formId, fieldId) {
    const form = get(formId);
    const review = get(formId + "Review");
    if (!form || !review) return;
    review.hidden = true;
    form.hidden = false;
    focusElement(fieldId ? get(fieldId) : form.querySelector && form.querySelector("input, select, textarea"));
}


/* ==============================================================
   27. BENEFICIARY PROFILE (SLP ELIGIBILITY ASSESSMENT FORM)
   ============================================================== */

/*
   Create one radio option.
   readOnly radios are disabled and NOT attached to profileForm,
   so they can never be saved by a participant.
   opts.label        visible text (defaults to the value)
   opts.labelClass   e.g. "visually-hidden" for table cells
   opts.describedBy  id of the question text
*/
function radio(name, value, selectedValue, readOnly = false, opts = {}) {
    const checked = selectedValue === value ? "checked" : "";
    const disabled = readOnly ? "disabled" : "";
    const formAttr = readOnly ? "" : `form="${opts.form || "profileForm"}"`;
    const described = opts.describedBy ? ` aria-describedby="${opts.describedBy}"` : "";
    const labelText = opts.label || value;
    const labelCls = opts.labelClass ? ` class="${opts.labelClass}"` : "";
    return `<label class="choice"><input type="radio" name="${escapeHTML(name)}" value="${escapeHTML(value)}" ${formAttr} ${checked} ${disabled}${described}><span${labelCls}>${escapeHTML(labelText)}</span></label>`;
}

/* --------------------------------------------------------------
   PAPER-FORM BUILDING BLOCKS
   The profile page reproduces Annex G.1 (SLP Eligibility
   Assessment and Profile Form) as closely as possible, as a
   fillable form. Every editable input has form="profileForm";
   personnel inputs never do.
   -------------------------------------------------------------- */

/* Editable input. `label` is trusted static text.
   below:  label sits under the line, like the paper captions
   inline: label and input share one line                       */
function pfInput(name, profile, label, options = {}) {
    const { type = "text", below = false, inline = false, hiddenLabel = false, caption = "", attrs = "", form = "profileForm" } = options;
    const id = "pf-" + name;
    const control = `<input type="${type}" id="${id}" name="${name}" form="${form}" value="${escapeHTML(profile[name])}"${attrs ? " " + attrs : ""}>`;
    const labelClass = hiddenLabel ? "visually-hidden" : (below ? "pf-caption" : "pf-label");
    const labelHTML = `<label for="${id}" class="${labelClass}">${label}</label>`;
    const captionHTML = caption ? `<span class="pf-caption">${caption}</span>` : "";
    if (below) return `<div class="pf-field pf-field--below">${control}${labelHTML}</div>`;
    return `<div class="pf-field${inline ? " pf-field--inline" : ""}">${labelHTML}${control}${captionHTML}</div>`;
}

/* Read-only personnel input. Never attached to profileForm. */
function pfReadonly(name, value, label, options = {}) {
    const { type = "text", inline = false } = options;
    const id = "pf-" + name;
    return `<div class="pf-field${inline ? " pf-field--inline" : ""}"><label for="${id}" class="pf-label">${label}</label><input type="${type}" id="${id}" name="${name}" value="${escapeHTML(value)}" readonly></div>`;
}

/* Radio group laid out like the paper: label, then options on one line. */
function pfRadios(label, name, values, profile, options = {}) {
    const { readOnly = false, labels = {}, extraHTML = "", form, column = false, legend } = options;
    const plain = legend || label.replace(/<[^>]+>/g, "");
    return `
        <fieldset class="pf-group">
            <legend class="visually-hidden">${plain}</legend>
            ${label ? `<span class="pf-label" aria-hidden="true">${label}</span>` : ""}
            <div class="pf-options${column ? " pf-options--column" : ""}">
                ${values.map(value => radio(name, value, profile[name], readOnly, { label: labels[value], form })).join("")}
                ${extraHTML}
            </div>
        </fieldset>`;
}

/* Declaration check box ("put check on the space provided"). */
function pfConsent(name, text, profile) {
    return `<label class="choice"><input type="checkbox" name="${name}" form="profileForm" ${profile[name] ? "checked" : ""}><span>${text}</span></label>`;
}

/* Read-only check box for the personnel section. */
function pfCheckbox(checked, label) {
    return `<input type="checkbox" disabled ${checked ? "checked" : ""} aria-label="${escapeHTML(label)}">`;
}

/* One household-expense cell (item 22). `area` places it in the paper grid. */
function expenseInput(label, name, profile, area) {
    const id = "pf-" + name;
    return `
        <div class="pf-exp${area ? " pf-exp--" + area : ""}">
            <label for="${id}">${label}</label>
            <input type="number" id="${id}" name="${name}" form="profileForm" value="${escapeHTML(profile[name])}" inputmode="decimal" min="0" step="any">
        </div>`;
}

/* One vulnerability question (item 24): English, Filipino, then 3 / 2 / 1. */
function vulnerabilityQuestion(index, question, profile, filipino) {
    const name = "vulnerability" + index;
    const qid = "vq" + index;
    const choices = [["3", "Always"], ["2", "Sometimes"], ["1", "Never"]];
    return `
        <tr>
            <th scope="row" id="${qid}">${question}${filipino ? `<span class="pf-fil" lang="fil">(${filipino})</span>` : ""}</th>
            ${choices.map(([value, word]) => `
                <td class="pf-score" data-label="${word.toUpperCase()}">
                    <label class="choice"><input type="radio" name="${name}" value="${value}" form="profileForm" ${profile[name] === value ? "checked" : ""} aria-describedby="${qid}"><span>${value}<span class="visually-hidden"> – ${word}</span></span></label>
                </td>`).join("")}
        </tr>`;
}

function getCurrentProfile() {
    return currentUser ? profileForms[currentUser.username] : undefined;
}

/* Reference slip (page 3). suffix "" = SLP copy, "2" = client's copy. */
function referenceSlip(profile, suffix, title, copyLabel) {
    return `
        <div class="pf-slip">
            <div class="paper__head paper__head--shade">${title}</div>
            <div class="pf-row pf-row--slip">
                <label class="pf-label" for="pf-referenceId${suffix}">SLP Participant ID No:</label>
                <input id="pf-referenceId${suffix}" name="referenceId${suffix}" value="${escapeHTML(profile.referenceId)}" readonly>
                <label class="pf-label" for="pf-intakeDate${suffix}">Intake Date:</label>
                <input type="date" id="pf-intakeDate${suffix}" name="intakeDate${suffix}" value="${escapeHTML(profile.intakeDate)}" readonly>
            </div>
            <div class="pf-row pf-row--slip-wide">
                <label class="pf-label" for="pf-officeAddress${suffix}">SLP Office Address:</label>
                <input id="pf-officeAddress${suffix}" name="officeAddress${suffix}" value="${escapeHTML(profile.officeAddress)}" readonly>
            </div>
            <div class="pf-row pf-row--slip">
                <label class="pf-label" for="pf-officeEmail${suffix}">SLP Office Email Address:</label>
                <input id="pf-officeEmail${suffix}" name="officeEmail${suffix}" value="${escapeHTML(profile.officeEmail)}" readonly>
                <label class="pf-label" for="pf-officeContact${suffix}">SLP Office Contact No:</label>
                <input id="pf-officeContact${suffix}" name="officeContact${suffix}" value="${escapeHTML(profile.officeContact)}" readonly>
            </div>
            <div class="paper__text">
                <p>This is to certify that Mr./Ms. <span class="pf-blank"><span class="visually-hidden">(name of client)</span></span> appeared at the SLP [National/Regional/Provincial] Office requesting livelihood assistance. Action to be taken may include further validation and assessment as to the individual's eligibility under the existing SLP Guidelines.</p>
                <p class="paper__signature">Signature over Printed Name of SLP Personnel</p>
                <p class="pf-slip__copy">${copyLabel}</p>
            </div>
        </div>`;
}

function profilePage() {

    /*
       BENEFICIARY MANAGE PROFILE — Annex G.1

       Page 1 and page 2 are filled in by the participant.
       Page 3 is the SLP Personnel portion: shown read-only here,
       and none of its inputs are attached to profileForm.
       The values are saved in the browser only in this prototype.
    */

    const profile = getCurrentProfile();
    profileDirty = false;

    // PCN: 16 single-digit boxes that feed one hidden "pcn" field.
    const pcnDigits = String(profile.pcn || "").replace(/\D/g, "").slice(0, 16).padEnd(16, " ");
    let pcnBoxes = "";
    for (let i = 0; i < 16; i++) {
        const digit = pcnDigits[i].trim();
        pcnBoxes += `<input class="pf-box" id="pcnBox${i}" value="${digit}" maxlength="1" inputmode="numeric" autocomplete="off" aria-label="PCN digit ${i + 1} of 16" oninput="pcnInput(this, ${i})" onkeydown="pcnKey(event, ${i})">`;
    }

    // Item 18: six household-member rows.
    const householdColumns = [
        ["Name", "Name", "text"],
        ["Birthday", "Birthday", "date"],
        ["Sex", "Sex (m/f)", "text"],
        ["Relation", "Relationship to Participant", "text"],
        ["IncomeSource", "Sources of Income", "text"],
        ["Income", "Monthly Gross Income (Php)", "number"]
    ];
    let householdRows = "";
    for (let i = 0; i < 6; i++) {
        householdRows += `
            <tr>
                <td class="pf-num-cell" data-label="Member">${i + 1}</td>
                ${householdColumns.map(([key, label, type]) => {
                    const name = "hh" + i + key;
                    const extra = type === "number" ? ' inputmode="decimal" min="0" step="any"' : (key === "Sex" ? ' maxlength="1"' : "");
                    return `<td data-label="${label}"><input type="${type}" name="${name}" form="profileForm" value="${escapeHTML(profile[name])}" aria-label="Member ${i + 1}: ${label}"${extra}></td>`;
                }).join("")}
            </tr>`;
    }

    const education = [
        "Post Graduate", "College Graduate", "College Level",
        "Vocational/Technical", "High School Graduate (Senior High/K-12)", "High School Graduate (Junior High-4 Years)",
        "High School Level", "Elementary Graduate", "Elementary Level",
        "ALS Graduate", "No grade completed"
    ];
    const educationLabels = {
        "High School Graduate (Senior High/K-12)": "High School Graduate (Senior High/K-12)",
        "High School Graduate (Junior High-4 Years)": "High School Graduate (Junior High-4 Years)"
    };

    const toolbar = `
        <div class="profile-toolbar no-print">
            ${button("Print form", "printPage()", { icon: "printer" })}
            ${button("Review and save", "openProfileReview()", { variant: "primary", icon: "clipboard-list" })}
        </div>`;

    return `
        <div class="profile-form-page exact-slp-form-page stack">

            ${alertBox("info", "SLP Eligibility Assessment and Profile Form (Annex G.1)", "Fill in pages 1 and 2. Page 3 is for SLP personnel only. When you are done, choose <strong>Review and save</strong> to check your answers.")}
            ${toolbar}

            <!-- ==================================================
                 PAGE 1 — I. DECLARATION · II. PROFILE FORM (items 1–14)
                 ================================================== -->
            <p class="paper-page-label no-print">Page 1 of 3</p>
            <div class="paper slp-official-sheet" id="paperPage1">

                <header class="paper__masthead">
                    <div class="paper__logos" aria-hidden="true">
                        <span class="paper__logo">DSWD</span>
                        <span class="paper__logo">SUSTAINABLE LIVELIHOOD PROGRAM</span>
                        <span class="paper__logo">BAGONG PILIPINAS</span>
                    </div>
                    <h2 class="paper__title">SLP ELIGIBILITY ASSESSMENT AND PROFILE FORM</h2>
                    <div class="paper__ids">
                        <div class="pf-pcn" role="group" aria-labelledby="pcnLabel">
                            <span class="pf-label" id="pcnLabel">PCN<span class="visually-hidden"> (PhilSys Card Number, 16 digits)</span></span>
                            <div class="pf-pcn__boxes">${pcnBoxes}</div>
                            <input type="hidden" id="pf-pcn" name="pcn" form="profileForm" value="${escapeHTML(profile.pcn)}">
                        </div>
                        ${pfInput("participantId", profile, "SLP Participant ID No:", { inline: true })}
                    </div>
                </header>

                <section aria-labelledby="pfSection1">
                    <h3 class="paper__head" id="pfSection1">I. DECLARATION OF INTENT, DATA PRIVACY CONSENT, AND ATTESTATION</h3>
                    <div class="paper__text">
                        <p>I am expressing my sincere intention to participate in the Sustainable Livelihood Program (SLP). <strong>By signing, I commit to actively participate in <u>all</u> activities or undertakings associated with the Program.</strong></p>
                        <p><strong>I also hereby agree and consent to the DSWD-SLP for collecting, using, processing, updating, storing, and disclosing my personal information during the course of assessment and <em><u>throughout the SLP Implementation Phases</u></em>,</strong> in compliance with the Republic Act No. 10173, or the Data Privacy Act (DPA) of 2012, and its Implementing Rules and Regulations (IRR).</p>
                        <p id="pfConsentIntro">I understand that the DSWD-SLP will maintain my personal information in a secured database and allow them to process my personal information, whether manual or electronic, to determine appropriate social protection assistance through the provision of Program modalities and recommendations for livelihood sustainability and mainstreaming. As such, I agree and authorize SLP to: <strong><em>(put check on the space provided)</em></strong></p>
                        <div class="pf-consents" role="group" aria-labelledby="pfConsentIntro">
                            ${pfConsent("consentAssess", "Use my personal data to assess my eligibility to the program and for the provision of grants;", profile)}
                            ${pfConsent("consentPolicy", "Continue to use my personal data for policy development and statistical analysis;", profile)}
                            ${pfConsent("consentRetain", "Retain my personal, sensitive, and privileged information for 2 years, but may be processed further and stored for longer periods, subject to implementation of the appropriate security measures; and", profile)}
                            ${pfConsent("consentShare", "Share my personal data to other stakeholders, evaluation firms, and/or academe for potential partnership engagement and livelihood interventions.", profile)}
                        </div>
                        <p>I hereby affirm my right to be informed, object, access and rectify, erase, and be protected in case of damages pursuant to the provisions of the DPA of 2012 and its IRR. I also acknowledge and warrant that I have acquired the consent from DSWD-SLP and hold them free from any liability.</p>
                        <p><strong>I also acknowledge that <u>any falsification or misrepresentation of the information recorded</u> herein may invalidate my application to the DSWD-Sustainable Livelihood Program or result in the withdrawal of the livelihood granted to me.</strong></p>
                    </div>

                    <div class="pf-sign">
                        <p class="pf-sign__by">Accomplished by:</p>
                        <div class="pf-sign__grid">
                            ${pfInput("participantSignature", profile, "Signature over Printed Name of Program Participant", { below: true, attrs: 'autocomplete="name"' })}
                            ${pfInput("participantDate", profile, "Date", { type: "date", below: true })}
                            <div class="pf-thumb">
                                <div class="pf-thumb__box">
                                    <input id="pf-thumbmark" name="thumbmark" form="profileForm" value="${escapeHTML(profile.thumbmark)}">
                                </div>
                                <label for="pf-thumbmark" class="pf-caption">(Put a thumbmark if unable to write)</label>
                            </div>
                        </div>
                    </div>
                </section>

                <section aria-labelledby="pfSection2">
                    <h3 class="paper__head" id="pfSection2">II. PROFILE FORM</h3>

                    <div class="pf-row pf-row--c2">
                        ${pfRadios("1.Type of Participant:", "participantType", ["4Ps", "Non-4Ps"], profile)}
                        ${pfInput("householdNumber", profile, "2. 4Ps Household Number:", { inline: true })}
                    </div>

                    <div class="pf-row">
                        ${pfRadios("3. Type of Eligibility:", "eligibility", ["Regular", "Disaster-affected", "Area-Based Convergence", "Walk-in", "Referral"], profile, {
                            extraHTML: pfInput("referringParty", profile, "<em>(Please specify the Referring Party:</em>", { inline: true, caption: "<em>)</em>" })
                        })}
                    </div>

                    <div class="pf-row pf-row--stack">
                        <span class="pf-label">4. Name</span>
                        <div class="pf-cols pf-cols--4">
                            ${pfInput("lastName", profile, "Last Name", { below: true, attrs: 'autocomplete="family-name"' })}
                            ${pfInput("firstName", profile, "First Name", { below: true, attrs: 'autocomplete="given-name"' })}
                            ${pfInput("middleName", profile, "Middle Name", { below: true, attrs: 'autocomplete="additional-name"' })}
                            ${pfInput("extensionName", profile, "Extension Name", { below: true, attrs: 'autocomplete="honorific-suffix"' })}
                        </div>
                    </div>

                    <div class="pf-row pf-row--stack">
                        <span class="pf-label">5. Address</span>
                        <div class="pf-cols pf-cols--5">
                            ${pfInput("houseNo", profile, "House/Block/Lot No.", { below: true })}
                            ${pfInput("street", profile, "Street/Purok/Zone", { below: true })}
                            ${pfInput("barangay", profile, "Barangay", { below: true })}
                            ${pfInput("municipality", profile, "City/Municipality", { below: true })}
                            ${pfInput("province", profile, "Province", { below: true })}
                        </div>
                    </div>

                    <div class="pf-row pf-row--bday">
                        ${pfInput("birthday", profile, "6. Birthday", { type: "date", caption: "(mm/dd/yyyy)", attrs: 'autocomplete="bday"' })}
                        ${pfInput("age", profile, "7. Age:", { type: "number", attrs: 'inputmode="numeric" min="0" max="130"' })}
                        ${pfRadios("8. Sex :", "sex", ["Male", "Female"], profile)}
                        ${pfRadios("9. Civil Status:", "civilStatus", ["Single", "Married", "Others"], profile, {
                            labels: { Others: "Others:" },
                            extraHTML: pfInput("civilOther", profile, "Other civil status (please specify)", { hiddenLabel: true })
                        })}
                    </div>

                    <div class="pf-row pf-row--c2">
                        ${pfInput("contactNo", profile, "10. Contact No.:", { type: "tel", inline: true, attrs: 'autocomplete="tel" inputmode="tel"' })}
                        ${pfInput("email", profile, "11. Email Address:", { type: "email", inline: true, attrs: 'autocomplete="email"' })}
                    </div>

                    <div class="pf-row">
                        ${pfRadios("12. Gender Identity:", "genderIdentity", ["Man", "Woman", "LGBTQIA +", "Chose not to mention"], profile)}
                    </div>

                    <div class="pf-row">
                        <fieldset class="pf-group pf-group--block">
                            <legend class="visually-hidden">13. Sector</legend>
                            <span class="pf-label" aria-hidden="true">13. Sector:</span>
                            <div class="pf-sector">
                                <div>
                                    ${radio("sector", "Indigenous People (IP)", profile.sector)}
                                    ${pfInput("sectorGroup", profile, "<em>Please specify group:</em>", { inline: true })}
                                    ${radio("sector", "Senior Citizen", profile.sector)}
                                    ${radio("sector", "Solo Parent", profile.sector)}
                                </div>
                                <div>
                                    ${radio("sector", "Internally Displaced Person (IDP)", profile.sector)}
                                    ${radio("sector", "Overseas Filipino Worker (OFW)", profile.sector)}
                                    ${radio("sector", "Fisherfolks", profile.sector)}
                                    ${radio("sector", "Farmers", profile.sector)}
                                </div>
                                <div>
                                    ${radio("sector", "Person with Disability", profile.sector)}
                                    ${pfInput("disability", profile, "<em>Please specify the disability:</em>", { inline: true })}
                                    ${radio("sector", "Not Applicable", profile.sector)}
                                    <div class="pf-other">
                                        ${radio("sector", "Others", profile.sector, false, { label: "Others:" })}
                                        ${pfInput("otherSector", profile, "Other sector (please specify)", { hiddenLabel: true })}
                                    </div>
                                </div>
                            </div>
                        </fieldset>
                    </div>

                    <div class="pf-row">
                        <fieldset class="pf-group pf-group--block">
                            <legend class="visually-hidden">14. Highest Educational Attainment</legend>
                            <span class="pf-label" aria-hidden="true">14. Highest Educational Attainment</span>
                            <div class="pf-edu">
                                ${education.map(value => radio("education", value, profile.education, false, { label: educationLabels[value] })).join("")}
                            </div>
                        </fieldset>
                    </div>
                </section>
            </div>

            <!-- ==================================================
                 PAGE 2 — ITEMS 15–24
                 ================================================== -->
            <p class="paper-page-label no-print">Page 2 of 3</p>
            <div class="paper slp-official-sheet" id="paperPage2">

                <div class="pf-row pf-row--q">
                    ${pfRadios('<span lang="fil">15. Ikaw ba ay mayroon ng karanasan sa pagnenegosyo?</span>', "q15", ["Meron", "Wala"], profile)}
                </div>
                <div class="pf-row pf-row--q">
                    ${pfRadios('<span lang="fil">16. Ikaw ba ay mayroon ng karanasan sa pagtatrabaho?</span>', "q16", ["Meron", "Wala"], profile)}
                </div>
                <div class="pf-row pf-row--q">
                    ${pfRadios('<span lang="fil">17. Ikaw ba ay nakadalo na sa mga pagsasanay o kurso na maaaring magamit sa pagnenegosyo o pagtatrabaho?</span>', "q17", ["Oo", "Hindi"], profile)}
                </div>

                <section aria-labelledby="pfSection3">
                    <h3 class="paper__head" id="pfSection3">III. HOUSEHOLD PROFILE</h3>
                    <p class="paper__sub">18. Household Composition</p>
                    <div class="pf-table-wrap" role="region" aria-label="18. Household Composition" tabindex="0">
                        <table class="pf-table table--stack">
                            <caption class="visually-hidden">18. Household Composition</caption>
                            <thead>
                                <tr>
                                    <th scope="col"><span class="visually-hidden">Member number</span></th>
                                    <th scope="col">Name<span class="pf-hint">(Last Name, First Name, Middle Name, Ext)</span></th>
                                    <th scope="col">Birthday<span class="pf-hint">(mm/dd/yyyy)</span></th>
                                    <th scope="col">Sex<span class="pf-hint">(m/f)</span></th>
                                    <th scope="col">Relationship to Participant</th>
                                    <th scope="col">Sources of Income<span class="pf-hint">(Salary, Business, Remittance, Pension etc.)</span></th>
                                    <th scope="col">Monthly Gross Income<span class="pf-hint">(Php)</span></th>
                                </tr>
                            </thead>
                            <tbody>${householdRows}</tbody>
                        </table>
                    </div>

                    <div class="pf-row pf-row--income">
                        <label class="pf-label" for="pf-programIncomeSource">19. Program Participant Sources of Income:<span class="pf-hint">(Salary, Business, Remittance, Pension etc.)</span></label>
                        <input id="pf-programIncomeSource" name="programIncomeSource" form="profileForm" value="${escapeHTML(profile.programIncomeSource)}">
                        <label class="pf-label" for="pf-programGrossIncome">20. Program Participant Monthly Gross Income:</label>
                        <input type="number" id="pf-programGrossIncome" name="programGrossIncome" form="profileForm" value="${escapeHTML(profile.programGrossIncome)}" inputmode="decimal" min="0" step="any">
                    </div>

                    <div class="pf-row pf-row--total">
                        <label class="pf-label" for="pf-totalGrossIncome">21. Total Household Monthly Gross Income <span class="pf-hint pf-hint--inline">(Household Members <u>and</u> Program Participant):</span></label>
                        <input type="number" id="pf-totalGrossIncome" name="totalGrossIncome" form="profileForm" value="${escapeHTML(profile.totalGrossIncome)}" inputmode="decimal" min="0" step="any">
                    </div>
                </section>

                <section aria-labelledby="pfSection4a">
                    <h3 class="paper__head" id="pfSection4a">IV.A. ELIGIBILITY ASSESSMENT <span class="paper__note">(This section is not applicable for 4Ps participants, LGU-endorsed participants affected by natural disasters and human-induced hazards, and Area-Based Convergence participants)</span></h3>
                    <p class="paper__sub">22. Household Monthly Expenses</p>
                    <div class="pf-expenses">
                        ${expenseInput("A. Housing/<wbr>Rent", "housing", profile, "a")}
                        ${expenseInput('B. Utilities <span class="pf-hint">(Water, Electricity, etc.)</span>', "utilities", profile, "b")}
                        ${expenseInput("C. Food", "food", profile, "c")}
                        ${expenseInput("D. Transportation", "transportation", profile, "d")}
                        ${expenseInput("E. Healthcare/<wbr>Medicines", "healthcare", profile, "e")}
                        ${expenseInput("F. Education", "educationExpense", profile, "f")}
                        ${expenseInput("G. Childcare", "childcare", profile, "g")}
                        ${expenseInput("H. Others", "otherExpense", profile, "h")}
                        <div class="pf-exp pf-exp--x" aria-hidden="true"></div>
                        <div class="pf-exp-total">
                            <label for="pf-totalExpenses">Total Household Monthly Gross Expenses <span class="pf-hint">(A+B+C+D+E+F+G+H)</span></label>
                            <input type="number" id="pf-totalExpenses" name="totalExpenses" form="profileForm" value="${escapeHTML(profile.totalExpenses)}" inputmode="decimal" min="0" step="any">
                            <span class="pf-compute">${button("Calculate", "computeExpenseTotal()", { variant: "tertiary", icon: "calculator" })}</span>
                        </div>
                    </div>

                    <div class="pf-row pf-row--total">
                        <label class="pf-label" for="pf-netIncome">23. Household Monthly Net Income <span class="pf-hint pf-hint--inline">(Total Household Monthly Gross Income <u><strong>less</strong></u> Total Household Monthly Gross Expenses):</span></label>
                        <div class="pf-with-compute">
                            <input type="number" id="pf-netIncome" name="netIncome" form="profileForm" value="${escapeHTML(profile.netIncome)}" step="any">
                            <span class="pf-compute">${button("Calculate", "computeNetIncome()", { variant: "tertiary", icon: "calculator" })}</span>
                        </div>
                    </div>

                    <p class="paper__sub">24. Household Vulnerability</p>
                    <p class="paper__instruction"><em>Instruction: Encircle the corresponding number that best applies to your situation.</em> <span class="no-print">(On screen, select the number.)</span><br><strong><em>Always</em></strong><em> – 6 times or more in the past 6 months; </em><strong><em>Sometimes</em></strong><em> – Not all the time in the past 6 months; </em><strong><em>Never</em></strong><em> – Not at all</em></p>
                    <div class="pf-table-wrap" role="region" aria-label="24. Household Vulnerability" tabindex="0">
                        <table class="pf-table pf-table--vuln table--stack vulnerability-official-table">
                            <caption class="visually-hidden">24. Household Vulnerability</caption>
                            <thead><tr><th scope="col">In the past six (6) months until present:</th><th scope="col">ALWAYS</th><th scope="col">SOMETIMES</th><th scope="col">NEVER</th></tr></thead>
                            <tbody>
                                ${vulnerabilityQuestion(0, "Have you or your family experienced not eating sufficiently and/or not being able to eat three (3) times a day due to financial constraints?", profile, "Ikaw ba o ang iyong pamilya ay nakaranas na hindi kumain ng sapat at tatlong beses sa isang araw dahil sa wala o kakulangan sa pera na pambili nito?")}
                                ${vulnerabilityQuestion(1, "Have you or your family experienced not sending/withdrawing to school any family members to support the family’s basic needs?", profile, "Ikaw ba o ang iyong pamilya ay nakaranas na hindi pag-aralin o pahintuin sa pag-aaral ang sinumang miyembro ng pamilya (gaya ng anak) upang matugunan ang kakulangan sa mga pangunahing pangangailangan ng pamilya?")}
                                ${vulnerabilityQuestion(2, "Have you or your family ever experienced danger during typhoons/earthquakes/heavy rains due to the quality of materials used in the structure of your house?", profile, "Ikaw ba o ang iyong pamilya ay nakaranas na ba ng panganib sa panahon ng bagyo/lindol/malakas na ulan dahil sa istruktura (gawa sa hindi matibay na materyales) ng inyong bahay?")}
                                ${vulnerabilityQuestion(3, "Have you or your family experienced being unable to save because you prioritize your family's basic needs?", profile, "Ikaw ba o ang iyong pamilya ay nakaranas na hindi makaipon dahil sa kailangang unahin ang mga pangangailangan ng pamilya?")}
                                ${vulnerabilityQuestion(4, "Have you or your family experienced asking for financial assistance from relatives, neighbors, local government units, government agencies, private institutions, and lending institutions among others?", profile, "Ikaw ba o ang iyong pamilya ay nakaranas na humingi ng tulong pinansyal mula sa mga kamag-anak, kapit-bahay, local government units, ahensya ng gobyerno, pribadong institusyon, mga pautangan at iba pa?")}
                            </tbody>
                        </table>
                    </div>
                    <div class="pf-row pf-row--total pf-row--right">
                        <label class="pf-label" for="pf-vulnerabilityTotal">Total Household Vulnerability Score:</label>
                        <div class="pf-with-compute">
                            <input type="number" id="pf-vulnerabilityTotal" name="vulnerabilityTotal" form="profileForm" value="${escapeHTML(profile.vulnerabilityTotal)}" inputmode="numeric" min="0" max="15">
                            <span class="pf-compute">${button("Calculate", "computeVulnerabilityTotal()", { variant: "tertiary", icon: "calculator" })}</span>
                        </div>
                    </div>
                </section>
            </div>

            <!-- ==================================================
                 PAGE 3 — SLP PERSONNEL ONLY (read-only for participants)
                 No input on this page is attached to profileForm.
                 ================================================== -->
            <p class="paper-page-label no-print">Page 3 of 3</p>
            ${alertBox("neutral", "", "This page is for SLP personnel only. You can view it, but only MSWDO personnel can fill it in.", "lock")}
            <div class="paper slp-official-sheet personnel-only-sheet" id="paperPage3">
                <div class="paper__head paper__head--shade">THIS PORTION IS FOR SLP PERSONNEL's USE ONLY</div>

                <h3 class="paper__head">IV.B. ELIGIBILITY ASSESSMENT <span class="paper__note">(This section is not applicable for 4Ps participants, LGU-endorsed participants affected by natural disasters and human-induced hazards, and Area-Based Convergence participants)</span></h3>

                <div class="pf-row pf-row--c2 pf-row--flush">
                    <div class="pf-assess-box">
                        <p class="paper__sub paper__sub--flush">25. Income Assessment</p>
                        <div class="pf-row pf-row--check">
                            <span class="pf-hint">(check appropriate box below)</span>
                            ${pfReadonly("povertyThreshold", profile.povertyThreshold, "PSA Regional Poverty Threshold: Php", { inline: true })}
                        </div>
                        <label class="pf-row pf-row--check">
                            <span class="pf-checkcell">${pfCheckbox(profile.incomeAssessment === "less", "Net income is less than or equal to the Regional Poverty Threshold")}</span>
                            <span>Household Monthly Net Income <em>(refer to item 23)</em> is <strong>less than or equal</strong> to the Regional Poverty Threshold</span>
                        </label>
                        <label class="pf-row pf-row--check pf-row--last">
                            <span class="pf-checkcell">${pfCheckbox(profile.incomeAssessment === "greater", "Net income is greater than the Regional Poverty Threshold")}</span>
                            <span>Household Monthly Net Income <em>(refer to item 23)</em> is <strong>greater than</strong> the Regional Poverty Threshold</span>
                        </label>
                    </div>
                    <div class="pf-assess-box">
                        <p class="paper__sub paper__sub--flush">26. Vulnerability Assessment</p>
                        <div class="pf-row pf-row--total">
                            <label class="pf-label" for="pf-personnelVulnerabilityScore">Total Household Vulnerability Score: <span class="pf-hint pf-hint--inline">(refer to item 24)</span></label>
                            <input id="pf-personnelVulnerabilityScore" name="personnelVulnerabilityScore" value="${escapeHTML(profile.personnelVulnerabilityScore)}" readonly>
                        </div>
                        <table class="pf-table pf-table--severity">
                            <caption class="visually-hidden">Vulnerability severity</caption>
                            <thead><tr><th scope="col"><span class="visually-hidden">Selected</span></th><th scope="col">Household Vulnerability Score</th><th scope="col">Vulnerability Severity</th></tr></thead>
                            <tbody>
                                <tr><td class="pf-checkcell">${pfCheckbox(profile.vulnerabilitySeverity === "High", "High")}</td><td>11-15 Points</td><td>High</td></tr>
                                <tr><td class="pf-checkcell">${pfCheckbox(profile.vulnerabilitySeverity === "Medium", "Medium")}</td><td>6-10 Points</td><td>Medium</td></tr>
                                <tr><td class="pf-checkcell">${pfCheckbox(profile.vulnerabilitySeverity === "Low", "Low")}</td><td>0-5 Points</td><td>Low</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <p class="paper__sub">27. Overall Assessment <em class="pf-hint pf-hint--inline">(Refer to Annex H.2 - Eligibility Matrix)</em></p>
                <fieldset class="pf-assessment">
                    <legend class="paper__sub">RECOMMENDATION/ASSESSMENT <em class="pf-hint pf-hint--inline">(check appropriate box)</em>:</legend>
                    <div class="pf-row pf-row--c2 pf-row--flush-bottom">
                        <label class="choice pf-assess-choice"><input type="radio" name="overallAssessment" value="Qualified" disabled ${profile.overallAssessment === "Qualified" ? "checked" : ""}><span>The Household is <strong><em>Qualified</em></strong> as an SLP Target Participant and may undergo the succeeding processes to be considered an eligible participant and receive SLP intervention.</span></label>
                        <label class="choice pf-assess-choice"><input type="radio" name="overallAssessment" value="Not Qualified" disabled ${profile.overallAssessment === "Not Qualified" ? "checked" : ""}><span>The Household is <strong><em>Not Qualified</em></strong> as an SLP Target Participant and will no longer proceed to the succeeding processes but can be referred to other partners/stakeholders for appropriate intervention.</span></label>
                    </div>
                </fieldset>

                <div class="pf-row pf-row--stack">
                    <label class="pf-label" for="pf-remarks">28. Remarks and other Recommendation/s of the PDO:</label>
                    <textarea id="pf-remarks" name="remarks" readonly>${escapeHTML(profile.remarks)}</textarea>
                </div>

                <h3 class="paper__head">V. TRACK SELECTION</h3>
                <div class="pf-row pf-row--stack">
                    <fieldset class="pf-group pf-group--block">
                        <legend class="visually-hidden">29. SLP Track selected by the target participant</legend>
                        <span class="pf-label" aria-hidden="true">29. SLP Track selected by the target participant based on the his/her experience, skills, and interests.</span>
                        <div class="pf-track">
                            <strong>Enterprise:</strong>
                            ${radio("track", "Association", profile.track, true)}
                            ${radio("track", "Individual", profile.track, true)}
                            <span class="pf-track__employment">${radio("track", "Employment", profile.track, true, { label: "Employment" })}</span>
                        </div>
                    </fieldset>
                </div>

                <div class="paper__text pf-confirm">
                    <p>I hereby confirm that the information provided by the respondents was captured, and all collected information will be treated with strict confidentiality and shall be used only for the intended purpose of the program.</p>
                    <p class="paper__signature">Signature Over Printed Name of the SLP Personnel</p>
                </div>

                ${referenceSlip(profile, "", "SLP REFERENCE SLIP <span class=\"pf-hint pf-hint--inline\">(for Walk-in Clients only)</span>", "SLP COPY")}
                <div class="pf-cut" aria-hidden="true"></div>
                ${referenceSlip(profile, "2", "SLP REFERENCE SLIP", "SLP CLIENT'S COPY")}
            </div>

            ${toolbar}

            <!-- One form element is used for every page. -->
            <form id="profileForm" class="hidden-form" onsubmit="return false;"></form>
        </div>`;
}

/* PCN boxes: one digit each, auto-advance, paste fills all 16. */
function syncPcn() {
    const digits = [];
    for (let i = 0; i < 16; i++) {
        const box = get("pcnBox" + i);
        digits.push(box ? box.value : "");
    }
    const hidden = get("pf-pcn");
    if (hidden) hidden.value = digits.join("").trim();
    profileDirty = true;
}

function pcnInput(box, index) {
    const digits = String(box.value).replace(/\D/g, "");
    if (digits.length > 1) {
        // Pasted or typed several digits: spread them across the boxes.
        for (let i = 0; i < digits.length && index + i < 16; i++) {
            get("pcnBox" + (index + i)).value = digits[i];
        }
        focusElement(get("pcnBox" + Math.min(index + digits.length, 15)));
    } else {
        box.value = digits;
        if (digits && index < 15) focusElement(get("pcnBox" + (index + 1)));
    }
    syncPcn();
}

function pcnKey(event, index) {
    if (event.key === "Backspace" && !event.target.value && index > 0) {
        const previous = get("pcnBox" + (index - 1));
        previous.value = "";
        focusElement(previous);
        syncPcn();
        event.preventDefault();
    } else if (event.key === "ArrowLeft" && index > 0) {
        focusElement(get("pcnBox" + (index - 1)));
    } else if (event.key === "ArrowRight" && index < 15) {
        focusElement(get("pcnBox" + (index + 1)));
    }
}

/* Read the current value of a profile control from the page. */
function profileValue(name) {
    const radioChecked = document.querySelector(`input[type="radio"][form="profileForm"][name="${name}"]:checked`);
    if (radioChecked) return radioChecked.value;
    const field = document.querySelector(`[form="profileForm"][name="${name}"]`);
    if (!field) return "";
    if (field.type === "checkbox") return field.checked;
    if (field.type === "radio") return "";
    return String(field.value || "").trim();
}

/* Close the review and put the cursor on one field of the form. */
function focusProfileField(name) {
    closeModal();
    const target = name === "pcn"
        ? get("pcnBox0")
        : document.querySelector(`[form="profileForm"][name="${name}"]`);
    if (target && target.scrollIntoView) target.scrollIntoView({ block: "center" });
    focusElement(target);
}

/* Review step: summary of the answers before saving. */
function openProfileReview() {
    if (!isBrowser()) return;

    const missing = `<span class="summary-list__missing">${icon("triangle-alert", 16)}Not provided</span>`;
    const show = value => value ? escapeHTML(value) : missing;
    const yesNo = value => value ? `${icon("check", 16)} Yes` : "No";
    const peso = value => value !== "" ? escapeHTML(formatPeso(parseAmount(value))) : missing;

    const fullName = ["firstName", "middleName", "lastName", "extensionName"].map(profileValue).filter(Boolean).join(" ");
    const address = ["houseNo", "street", "barangay", "municipality", "province"].map(profileValue).filter(Boolean).join(", ");
    let householdCount = 0;
    for (let i = 0; i < 6; i++) {
        if (profileValue("hh" + i + "Name")) householdCount++;
    }
    const sector = profileValue("sector") === "Others" ? `Others: ${profileValue("otherSector")}` : profileValue("sector");

    const groups = [
        { title: "I. Declaration and consent", rows: [
            ["PCN", show(profileValue("pcn")), "pcn"],
            ["SLP Participant ID No.", show(profileValue("participantId")), "participantId"],
            ["Use data to assess eligibility", yesNo(profileValue("consentAssess")), "consentAssess"],
            ["Use data for policy and statistics", yesNo(profileValue("consentPolicy")), "consentPolicy"],
            ["Retain information for 2 years", yesNo(profileValue("consentRetain")), "consentRetain"],
            ["Share data with partners", yesNo(profileValue("consentShare")), "consentShare"],
            ["Signature (printed name)", show(profileValue("participantSignature")), "participantSignature"],
            ["Date", show(formatDate(profileValue("participantDate"))), "participantDate"]
        ]},
        { title: "II. Profile form", rows: [
            ["1. Type of Participant", show(profileValue("participantType")), "participantType"],
            ["3. Type of Eligibility", show(profileValue("eligibility")), "eligibility"],
            ["4. Name", show(fullName), "lastName"],
            ["5. Address", show(address), "houseNo"],
            ["6. Birthday", show(formatDate(profileValue("birthday"))), "birthday"],
            ["7. Age", show(profileValue("age")), "age"],
            ["8. Sex", show(profileValue("sex")), "sex"],
            ["9. Civil Status", show(profileValue("civilStatus") === "Others" ? `Others: ${profileValue("civilOther")}` : profileValue("civilStatus")), "civilStatus"],
            ["10. Contact No.", show(profileValue("contactNo")), "contactNo"],
            ["11. Email Address", show(profileValue("email")), "email"],
            ["12. Gender Identity", show(profileValue("genderIdentity")), "genderIdentity"],
            ["13. Sector", show(sector), "sector"],
            ["14. Highest Educational Attainment", show(profileValue("education")), "education"]
        ]},
        { title: "III. Household profile", rows: [
            ["15. Karanasan sa pagnenegosyo", show(profileValue("q15")), "q15"],
            ["16. Karanasan sa pagtatrabaho", show(profileValue("q16")), "q16"],
            ["17. Nakadalo sa pagsasanay", show(profileValue("q17")), "q17"],
            ["18. Household members listed", String(householdCount), "hh0Name"],
            ["20. Your monthly gross income", peso(profileValue("programGrossIncome")), "programGrossIncome"],
            ["21. Total household monthly gross income", peso(profileValue("totalGrossIncome")), "totalGrossIncome"]
        ]},
        { title: "IV.A. Eligibility assessment", rows: [
            ["22. Total monthly gross expenses", peso(profileValue("totalExpenses")), "totalExpenses"],
            ["23. Monthly net income", peso(profileValue("netIncome")), "netIncome"],
            ["24. Vulnerability score", show(profileValue("vulnerabilityTotal")), "vulnerabilityTotal"]
        ]}
    ];

    openModal("Review your form", `
        ${alertBox("info", "Check your answers", "Nothing has been saved yet. Choose <strong>Change</strong> to correct an answer, or <strong>Confirm and save</strong> when everything is correct.")}
        ${groups.map(group => `
            <div class="modal__section">
                <h3 class="modal__section-title">${group.title}</h3>
                <dl class="summary-list">
                    ${group.rows.map(([label, value, field]) => `
                        <dt>${label}</dt>
                        <dd class="summary-list__value--with-action">${value}</dd>
                        <dd class="summary-list__action">${button(`Change<span class="visually-hidden"> ${label}</span>`, `focusProfileField('${field}')`, { variant: "tertiary" })}</dd>`).join("")}
                </dl>
            </div>`).join("")}
        <div class="modal__footer">
            ${button("Back to form", "closeModal()", { icon: "arrow-left" })}
            ${button("Confirm and save", "saveProfile()", { variant: "primary", icon: "check" })}
        </div>`);
}

/* Calculation helpers (participants can still edit the results). */
function setProfileValue(name, value) {
    const field = isBrowser() ? document.querySelector(`[form="profileForm"][name="${name}"]`) : null;
    if (!field) return;
    field.value = value;
    profileDirty = true;
}

function computeExpenseTotal() {
    if (!isBrowser()) return;
    const total = ["housing", "utilities", "food", "transportation", "healthcare", "educationExpense", "childcare", "otherExpense"]
        .reduce((sum, name) => sum + parseAmount(profileValue(name)), 0);
    setProfileValue("totalExpenses", total);
    showToast(`Total monthly expenses calculated: ${formatPeso(total)}.`, "info");
}

function computeNetIncome() {
    if (!isBrowser()) return;
    const net = parseAmount(profileValue("totalGrossIncome")) - parseAmount(profileValue("totalExpenses"));
    setProfileValue("netIncome", net);
    showToast(`Monthly net income calculated: ${formatPeso(net)}.`, "info");
}

function computeVulnerabilityTotal() {
    if (!isBrowser()) return;
    let total = 0;
    for (let i = 0; i < 5; i++) {
        total += parseInt(profileValue("vulnerability" + i), 10) || 0;
    }
    setProfileValue("vulnerabilityTotal", total);
    showToast(`Vulnerability score calculated: ${total}.`, "info");
}

/*
   Save the complete SLP profile form.
   The prototype stores the information in profileForms so it remains
   available while the page is open. A real system will send this data
   to PHP/MySQL instead.
*/
function saveProfile() {

    if (!currentUser || isStaff()) {
        showToast("Access denied: Personnel cannot edit beneficiary profiles directly here.", "error");
        return;
    }

    const form = get("profileForm");

    if (!form) {
        showToast("Profile form is not available.", "error");
        return;
    }

    const profile = profileForms[currentUser.username];
    if (!profile) {
        showToast("Profile record not found.", "error");
        return;
    }

    // SLP personnel fields that must remain protected and not written by participants.
    const personnelFields = new Set([
        "povertyThreshold",
        "personnelVulnerabilityScore",
        "incomeAssessment",
        "vulnerabilitySeverity",
        "overallAssessment",
        "remarks",
        "track",
        "personnelSignature",
        "referenceId",
        "intakeDate",
        "officeAddress",
        "officeEmail",
        "officeContact",
        "referenceId2",
        "intakeDate2",
        "officeAddress2",
        "officeEmail2",
        "officeContact2"
    ]);

    function isFieldAllowed(field) {
        if (!field || !field.name) return false;
        if (personnelFields.has(field.name)) return false;
        if (field.name.endsWith("2")) return false;
        if (field.closest && field.closest(".personnel-only-sheet")) return false;
        if (field.hasAttribute("readonly") || field.hasAttribute("disabled")) return false;
        return true;
    }

    // Read all normal text/date/number fields.
    document.querySelectorAll("[form='profileForm']:not([type='radio']):not([type='checkbox'])").forEach(function (field) {
        if (isFieldAllowed(field)) {
            profile[field.name] = field.value;
        }
    });

    // Read radio buttons. Only the selected option is saved.
    document.querySelectorAll("input[type='radio'][form='profileForm']").forEach(function (radioButton) {
        if (radioButton.checked && isFieldAllowed(radioButton)) {
            profile[radioButton.name] = radioButton.value;
        }
    });

    // Read checkboxes used in the declaration section.
    document.querySelectorAll("input[type='checkbox'][form='profileForm']").forEach(function (checkbox) {
        if (isFieldAllowed(checkbox)) {
            profile[checkbox.name] = checkbox.checked;
        }
    });

    // Keep the simple beneficiary table synchronized with the profile.
    const beneficiary = getCurrentBeneficiary();
    if (beneficiary) {
        beneficiary.name = [profile.firstName, profile.middleName, profile.lastName, profile.extensionName]
            .filter(Boolean)
            .join(" ") || beneficiary.name;
        beneficiary.location = [profile.barangay, profile.municipality, profile.province]
            .filter(Boolean)
            .join(", ") || beneficiary.location;
    }

    profileDirty = false;
    updateUserInformation();
    showProfileSavedConfirmation();
}

/* Confirmation screen after saving the profile. */
function showProfileSavedConfirmation() {
    const savedAt = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
    openModal("Profile saved", `
        ${emptyState("circle-check", "Your profile has been saved", `Saved on ${escapeHTML(savedAt)}. SLP personnel will review your information and contact you if anything needs to be corrected.`)}
        <div class="modal__footer">
            ${button("Keep editing", "closeModal()", { variant: "tertiary" })}
            ${button("Print a copy", "closeModal(); printPage()", { icon: "printer" })}
            ${button("Go to dashboard", "closeModal(); navigate('dashboard')", { variant: "primary", icon: "home" })}
        </div>`);
    showToast("Profile changes saved successfully.");
}


/* ==============================================================
   27B. MONITORING TOOLS (Annex AA, AC, AF.1)
   Fillable replicas of the official SLP monitoring tools: AA and
   AC for association leaders, AF.1 for MSWDO personnel (see
   LEADER_PAGES / STAFF_PAGES). Inputs bind with form="toolForm"; saveTool()
   keeps one working copy per tool in toolForms (memory only,
   like the rest of the prototype). Filled copies: the browser's
   "Print / save as PDF". Blank copies: the original PDFs.
   ============================================================== */

const toolForms = { mdmonitoring: {}, orgassessment: {}, usbongassessment: {} };

const MONITORING_TOOLS = {
    mdmonitoring: {
        title: "MD Monitoring Tool (Association)",
        annex: "Annex AA",
        description: "Annex AA. Track the microenterprise of an SLP Association during each monitoring visit.",
        icon: "clipboard-pen",
        pdf: "assets/forms/annex-aa-md-monitoring-tool-association.pdf",
        render: mdMonitoringToolPage
    },
    orgassessment: {
        title: "Organization Assessment Tool",
        annex: "Annex AC",
        description: "Annex AC. Rate how well an SLP Association governs and runs itself.",
        icon: "network",
        pdf: "assets/forms/annex-ac-organization-assessment-tool.pdf",
        render: orgAssessmentToolPage
    },
    usbongassessment: {
        title: "MD Usbong Assessment Tool",
        annex: "Annex AF.1",
        description: "Annex AF.1. Final assessment for the Usbong phase and eligibility for the Sibol phase.",
        icon: "badge-check",
        pdf: "assets/forms/annex-af1-final-assessment-tool-usbong.pdf",
        render: usbongAssessmentToolPage
    }
};

const CLOSED_REASONS = [
    "Income was used for personal expenses", "Harvest was used for family consumption", "Due to pest infestation",
    "Due to disaster/calamity", "Due to injury/illness", "Due to disease outbreak (e.g. endemic, pandemic, ASF, etc.)",
    "Participant died/passed away", "Organizational Problem", "Financial Problem", "Unmotivated participant/members"
];
const VERIFICATION_MEANS = [
    "Financial Reports", "Operations Reports", "Marketing Agreements",
    "Documentation of Products/Services", "Key documents/Certification (e.g. MOA, contracts)"
];
const ASSET_TYPES = [[1, "1 = Financial"], [2, "2 = Human"], [3, "3 = Physical"], [4, "4 = Social"], [5, "5 = Natural"], [6, "6 = Insurance"]];
const SOURCE_TYPES = [[1, "1 = Acquired by Association"], [2, "2 = PDAG"], [3, "3 = DSWD (Other Programs)"], [4, "4 = Other Government Agencies"],
    [5, "5 = Private Institutions"], [6, "6 = CSO"], [7, "7 = NGO"], [8, "8 = Others; please specify"]];
const PROCUREMENT_MODES = [[1, "1 = Public Bidding"], [2, "2 = Direct Purchase"], [3, "3 = Negotiated Procurement — Community Participation"], [4, "4 = Others (please specify)"]];

const stripTags = html => String(html || "").replace(/<[^>]+>/g, "");
const hint = text => `<em class="pf-hint pf-hint--inline">${text}</em>`;

/* ---- Small building blocks bound to toolForm ---- */

function tInput(name, v, label, options = {}) {
    return pfInput(name, v, label, { ...options, form: "toolForm" });
}

function tRadios(label, name, values, v, options = {}) {
    return pfRadios(label, name, values, v, { ...options, form: "toolForm" });
}

function tCheck(name, label, v) {
    return `<label class="choice"><input type="checkbox" name="${name}" form="toolForm" ${v[name] ? "checked" : ""}><span>${label}</span></label>`;
}

function tChecks(items, v) {
    return items.map(([name, label]) => tCheck(name, label, v)).join("");
}

/* Check box followed by a "please specify" field. */
function tCheckSpecify(name, label, v) {
    return `<div class="pf-other">${tCheck(name, label, v)}${tInput(name + "Specify", v, stripTags(label) + " (please specify)", { hiddenLabel: true })}</div>`;
}

function tTextarea(name, v, label, options = {}) {
    const id = "pf-" + name;
    return `<div class="pf-field"><label for="${id}" class="${options.hiddenLabel ? "visually-hidden" : "pf-label"}">${label}</label><textarea id="${id}" name="${name}" form="toolForm">${escapeHTML(v[name])}</textarea></div>`;
}

/* Select; options are values or [value, text] pairs. extra = trusted attributes. */
function tSelect(name, options, v, label, extra = "") {
    const id = "pf-" + name;
    const current = String(v[name] ?? "");
    const optionHTML = [["", "—"]].concat(options.map(o => Array.isArray(o) ? o : [o, o]))
        .map(([value, text]) => `<option value="${escapeHTML(value)}"${current === String(value) ? " selected" : ""}>${escapeHTML(text)}</option>`)
        .join("");
    return `<label for="${id}" class="visually-hidden">${label}</label><select id="${id}" name="${name}" form="toolForm"${extra ? " " + extra : ""}>${optionHTML}</select>`;
}

/* Calculated, read-only total. Sums [data-add~=key] minus [data-sub~=key]. */
function tTotal(name, key, v, label, extra = "") {
    return tInput(name, v, label, { attrs: `readonly data-total="${key}"${extra ? " " + extra : ""}` });
}

/* Calculated status level from a total field: "28,15" = Level 3 at 28+, Level 2 at 15+. */
function tLevel(name, totalId, levels, v, label) {
    return tInput(name, v, label, { attrs: `readonly data-level-of="${totalId}" data-levels="${levels}"` });
}

function tSignature(name, v, caption) {
    return tInput(name, v, caption, { below: true });
}

function sectionHead(text) {
    return `<h3 class="paper__head paper__head--bar">${text}</h3>`;
}

function toolMasthead(title, page, pages, note) {
    return `
        <header class="paper__masthead">
            <div class="paper__logos" aria-hidden="true">
                <span class="paper__logo">DSWD</span>
                <span class="paper__logo">SUSTAINABLE LIVELIHOOD PROGRAM</span>
                <span class="paper__logo">BAGONG PILIPINAS</span>
            </div>
            <h2 class="paper__title">${title}${page ? ` ${hint(`(page ${page} of ${pages})`)}` : ""}</h2>
            ${note ? `<p class="pf-caption">${note}</p>` : ""}
        </header>`;
}

function toolConsent(intro, clause, v) {
    return `
        <div class="pf-row pf-row--intro"><p class="pf-colhead">INTRODUCTION</p><p class="pf-colhead">CONSENT &amp; CONFIDENTIALITY CLAUSE</p></div>
        <div class="pf-row pf-row--intro">
            <p>${intro}</p>
            <div class="pf-stack">
                <p>${clause}</p>
                <div class="pf-consent-sign">
                    ${tCheck("consent", "I agree to participate in this assessment visit and allow my answers to be used as indicated above.", v)}
                    ${tSignature("consentSignature", v, "Signature over Printed Name")}
                </div>
            </div>
        </div>`;
}

function toolMonitoringRow(label, v) {
    return `
        <div class="pf-row pf-row--monitor pf-row--shade">
            <p class="pf-label">${label}</p>
            <div class="pf-inline-fields">
                ${tInput("dateMonitored", v, "<em>Date Monitored* (mm/dd/yyyy):</em>", { type: "date", inline: true })}
                ${tInput("timeStarted", v, "<em>Time Started*:</em>", { type: "time", inline: true })}
                ${tInput("timeEnded", v, "<em>Time Ended*:</em>", { type: "time", inline: true })}
                ${tInput("implementationPhase", v, "<em>Implementation Phase*:</em>", { inline: true })}
                ${tInput("visitNo", v, "<em>No. of Visit*:</em>", { type: "number", inline: true, attrs: 'min="1" inputmode="numeric"' })}
            </div>
        </div>`;
}

function toolLocation(label, v, wrapClass = "pf-row pf-row--stack") {
    const parts = [["locHouse", "House &amp; Lot No."], ["locStreet", "Street"], ["locBarangay", "Barangay"],
        ["locCity", "City/Municipality"], ["locProvince", "Province"], ["locRegion", "Region"]];
    return `
        <div class="${wrapClass}">
            <span class="pf-label">${label}</span>
            <div class="pf-cols pf-cols--6">${parts.map(([name, caption]) => tInput(name, v, `<em>${caption}</em>`, { below: true })).join("")}</div>
        </div>`;
}

function toolName(label, v) {
    const parts = [["repLastName", "Last Name"], ["repFirstName", "First Name"], ["repMiddleName", "Middle Name"], ["repExtName", "Ext."]];
    return `
        <div class="pf-stack">
            <span class="pf-label">${label}</span>
            <div class="pf-cols pf-cols--4">${parts.map(([name, caption]) => tInput(name, v, `<em>${caption}</em>`, { below: true })).join("")}</div>
        </div>`;
}

/* Modalities with "Date Provided"; items: [[name, label], ...]. */
function toolModalities(label, items, othersLabel, v) {
    return `
        <div class="pf-row pf-row--stack">
            <span class="pf-label">${label}</span>
            <div class="pf-modalities">
                ${items.map(([name, text]) => `<div class="pf-modality">${tCheck(name, text, v)}${tInput(name + "Date", v, `<span class="visually-hidden">${text} </span>Date Provided:`, { type: "date", inline: true })}</div>`).join("")}
                <div class="pf-modality">
                    ${tCheck("modOthers", othersLabel, v)}
                    ${tInput("modOthersSpecify", v, "Other modality (please specify)", { hiddenLabel: true })}
                    ${tInput("modOthersDate", v, '<span class="visually-hidden">Other modality </span>Date Provided:', { type: "date", inline: true })}
                </div>
            </div>
        </div>`;
}

/* Male/Female counts. cols: [[heading, namePrefix]]; top: [[label, colCount]] optional. */
function memberCounts(caption, cols, v, top) {
    return `
        <div class="pf-table-wrap pf-table-wrap--plain" role="region" aria-label="${caption}" tabindex="0">
        <table class="pf-table pf-table--counts">
            <caption class="visually-hidden">${caption}</caption>
            <thead>
                ${top ? `<tr>${top.map(([label, n]) => `<th scope="colgroup" colspan="${n * 2}"><em>${label}</em></th>`).join("")}</tr>` : ""}
                <tr>${cols.map(([heading]) => `<th scope="colgroup" colspan="2">${heading}</th>`).join("")}</tr>
            </thead>
            <tbody>
                <tr>${cols.map(([heading, prefix]) => ["Male", "Female"].map(sex => {
                    const name = prefix + sex;
                    return `<td><label class="pf-caption" for="pf-${name}"><span class="visually-hidden">${stripTags(heading)}, </span><em>${sex}:</em></label><input type="number" id="pf-${name}" name="${name}" form="toolForm" value="${escapeHTML(v[name])}" min="0" inputmode="numeric"></td>`;
                }).join("")).join("")}</tr>
            </tbody>
        </table>
        </div>`;
}

function toolRegistrations(v) {
    const main = [["regCda", "CDA Registration No."], ["regSec", "SEC Registration No."], ["regBir", "BIR Registration No."], ["regMayor", "Mayor’s Permit No."]];
    return `
        <div class="pf-cols pf-cols--2">
            <div>${main.map(([name, label]) => `<div class="pf-other">${tCheck(name, label, v)}${tInput(name + "No", v, label, { hiddenLabel: true })}</div>`).join("")}</div>
            <div>
                ${tCheck("regOther", "Other registration(s)/permit(s) (please specify):", v)}
                ${[1, 2, 3].map(i => `
                    <div class="pf-other">
                        ${tInput(`regOther${i}Name`, v, `Other registration or permit ${i}`, { hiddenLabel: true })}
                        ${tInput(`regOther${i}No`, v, `No.<span class="visually-hidden"> of other registration ${i}</span>`, { inline: true })}
                    </div>`).join("")}
            </div>
        </div>`;
}

/* Issues table (MD K, OAT C). heads: 4 column headings; statuses: first one takes a date. */
function issuesTable(caption, heads, rows, statuses, v) {
    return `
        <div class="pf-table-wrap" role="region" aria-label="${caption}" tabindex="0">
            <table class="pf-table pf-table--issues table--stack">
                <caption class="visually-hidden">${caption}</caption>
                <thead><tr>${heads.map(h => `<th scope="col">${h}</th>`).join("")}</tr></thead>
                <tbody>
                    ${rows.map((row, i) => `
                        <tr>
                            <th scope="row">${row}</th>
                            <td data-label="${stripTags(heads[1])}"><textarea name="issue${i}" form="toolForm" aria-label="${row}: ${stripTags(heads[1])}">${escapeHTML(v["issue" + i])}</textarea></td>
                            <td data-label="${stripTags(heads[2])}"><textarea name="rec${i}" form="toolForm" aria-label="${row}: ${stripTags(heads[2])}">${escapeHTML(v["rec" + i])}</textarea></td>
                            <td data-label="${stripTags(heads[3])}">
                                <fieldset class="pf-group pf-group--block">
                                    <legend class="visually-hidden">${row}: status</legend>
                                    ${statuses.map((status, j) => j === 0
                                        ? `<div class="pf-other">${radio("status" + i, status, v["status" + i], false, { form: "toolForm" })}${tInput(`status${i}Date`, v, "(Date:", { type: "date", inline: true, caption: ")" })}</div>`
                                        : radio("status" + i, status, v["status" + i], false, { form: "toolForm" })).join("")}
                                </fieldset>
                            </td>
                        </tr>`).join("")}
                </tbody>
            </table>
        </div>`;
}

/*
   Scored rubric table (MD I, OAT B, Usbong C).
   groups: [{ head, sum, na, items: [{ label, sum, indicators: [{ label, rows: [[[score, text], ...], ...] }] }] }]
   Every row gets one score select; its value adds into the group, item and table totals.
*/
function rubricTable({ caption, heads, subheads, groups, total, prefix, indicatorCol, totalRow, v }) {
    const cols = heads.length;
    let body = "";
    groups.forEach((group, g) => {
        if (group.head) body += `<tr class="pf-group-row"><th scope="rowgroup" colspan="${cols}">${group.head}</th></tr>`;
        group.items.forEach((item, i) => {
            const itemRows = item.indicators.reduce((n, indicator) => n + indicator.rows.length, 0);
            let first = true;
            item.indicators.forEach((indicator, k) => {
                indicator.rows.forEach((lines, r) => {
                    const name = `${prefix}${g}_${i}_${k}_${r}`;
                    const sums = [group.sum, item.sum, total].filter(Boolean).join(" ");
                    const scores = [...new Set(lines.map(([score]) => score).concat(0))].sort((a, b) => b - a);
                    const label = `${stripTags(item.label)} ${stripTags(indicator.label || "")} score ${r + 1}`;
                    body += `
                        <tr>
                            ${first ? `<th scope="row" rowspan="${itemRows}">${item.label}</th>` : ""}
                            ${indicatorCol && r === 0 ? `<td rowspan="${indicator.rows.length}" data-label="${heads[1]}">${indicator.label}</td>` : ""}
                            <td class="pf-guide" data-label="${heads[cols - 2]}">${lines.map(([score, text]) => `<p><strong>${score}</strong> = ${text}</p>`).join("")}</td>
                            <td class="pf-scorecell" data-label="${heads[cols - 1]}">${tSelect(name, scores.concat(group.na ? ["N/A"] : []), v, label, `data-add="${sums}"`)}</td>
                        </tr>`;
                    first = false;
                });
            });
        });
    });
    if (totalRow) {
        body += `<tr class="pf-total-row"><th scope="row" colspan="${cols - 1}"><label for="pf-${totalRow.name}">${totalRow.label}</label></th><td class="pf-scorecell"><input id="pf-${totalRow.name}" name="${totalRow.name}" form="toolForm" value="${escapeHTML(v[totalRow.name])}" readonly data-total="${total}"></td></tr>`;
    }
    return `
        <div class="pf-table-wrap" role="region" aria-label="${caption}" tabindex="0">
            <table class="pf-table pf-table--rubric table--stack">
                <caption class="visually-hidden">${caption}</caption>
                <thead>
                    <tr>${heads.map(h => `<th scope="col">${h}</th>`).join("")}</tr>
                    ${subheads ? `<tr class="pf-subheads">${subheads.map(s => `<td><em>${s}</em></td>`).join("")}</tr>` : ""}
                </thead>
                <tbody>${body}</tbody>
            </table>
        </div>`;
}

/* Summary of ratings. cols: [[label, key, max]]. */
function ratingSummary(caption, cols, totalKey, totalMax, statusLabel, levels, guideLabel, guide, v) {
    const scoreCell = (label, key, max) => `
        <label class="pf-caption" for="pf-sum_${key}">Score<span class="visually-hidden"> for ${stripTags(label)}</span>:</label>
        <span class="pf-scoreout"><input id="pf-sum_${key}" name="sum_${key}" form="toolForm" value="${escapeHTML(v["sum_" + key])}" readonly data-total="${key}"> / ${max}</span>`;
    return `
        <div class="pf-table-wrap" role="region" aria-label="${caption}" tabindex="0">
            <table class="pf-table pf-table--summary table--stack">
                <caption class="visually-hidden">${caption}</caption>
                <thead><tr>${cols.map(([label]) => `<th scope="col"><em>${label}</em></th>`).join("")}<th scope="col" colspan="2"><em>Total Rating*:</em></th><th scope="col"><em>${guideLabel}</em></th></tr></thead>
                <tbody>
                    <tr>
                        ${cols.map(([label, key, max]) => `<td data-label="${stripTags(label)}">${scoreCell(label, key, max)}</td>`).join("")}
                        <td data-label="Total Score">${scoreCell("Total Score", totalKey, totalMax)}</td>
                        <td data-label="${statusLabel}">${tLevel("level_" + totalKey, "pf-sum_" + totalKey, levels, v, statusLabel)}</td>
                        <td>${levelGuide(guide)}</td>
                    </tr>
                </tbody>
            </table>
        </div>`;
}

/* Status/score guide. rows: [[status, score]] */
function levelGuide(rows, heads = ["Status", "Score"]) {
    return `<table class="pf-table pf-table--guide"><thead><tr>${heads.map(h => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td><strong>${b}</strong></td></tr>`).join("")}</tbody></table>`;
}

/* Static descriptive-rating matrix (Usbong). rows: [[score, cell, cell, cell]] */
function ratingMatrix(indicator, columns, rows) {
    return `
        <tr><th scope="rowgroup" rowspan="${rows.length + 1}">${indicator}</th><td></td>${columns.map(c => `<th scope="col">${c}</th>`).join("")}</tr>
        ${rows.map(([score, ...cells]) => `<tr><td class="pf-num-cell"><strong>${score}</strong></td>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}`;
}

function toolPage(key, sheets) {
    const tool = MONITORING_TOOLS[key];
    profileDirty = false;
    const toolbar = `
        <div class="profile-toolbar no-print">
            <a class="btn btn--secondary" href="${tool.pdf}" download>${icon("download")}<span>Download blank form (PDF)</span></a>
            ${button("Print / save as PDF", "printPage()", { icon: "printer" })}
            ${button("Save", `saveTool('${key}')`, { variant: "primary", icon: "save" })}
        </div>`;
    return `
        <div class="profile-form-page stack">
            ${alertBox("info", `${tool.annex}: ${tool.title}`, "Fill in the form, then choose <strong>Save</strong>. Totals and status levels are calculated for you. To keep a filled-in copy, choose <strong>Print / save as PDF</strong>.")}
            ${toolbar}
            ${sheets.map((sheet, i) => `<p class="paper-page-label no-print">Page ${i + 1} of ${sheets.length}</p><div class="paper slp-official-sheet" id="toolSheet${i + 1}">${sheet}</div>`).join("")}
            ${toolbar}
            <form id="toolForm" class="hidden-form" onsubmit="return false;"></form>
        </div>`;
}

/* Save the tool on screen. Only a role that may open the tool's page may save it. */
function saveTool(key) {
    if (!allowedPages().includes(key)) {
        showToast("Access denied: Your account cannot fill in this monitoring tool.", "error");
        return;
    }
    if (!MONITORING_TOOLS[key] || typeof document === "undefined" || !document.querySelectorAll) return;
    const record = {};
    document.querySelectorAll("[form='toolForm']").forEach(field => {
        if (!field.name) return;
        if (field.type === "radio") {
            if (field.checked) record[field.name] = field.value;
        } else if (field.type === "checkbox") {
            record[field.name] = field.checked;
        } else {
            record[field.name] = field.value;
        }
    });
    toolForms[key] = record;
    profileDirty = false;
    showToast(`${MONITORING_TOOLS[key].title} saved.`);
}

/* Recalculate every total and status level on the page. Blank stays blank. */
function updateToolTotals() {
    if (!isBrowser()) return;
    document.querySelectorAll("[data-total]").forEach(target => {
        const key = target.getAttribute("data-total");
        let sum = 0;
        let filled = false;
        document.querySelectorAll(`[data-add~="${key}"], [data-sub~="${key}"]`).forEach(field => {
            if (field.value === "") return;
            filled = true;
            sum += (field.matches(`[data-sub~="${key}"]`) ? -1 : 1) * (Number(field.value) || 0);
        });
        target.value = filled ? Math.round(sum * 100) / 100 : "";
    });
    document.querySelectorAll("[data-level-of]").forEach(out => {
        const source = get(out.getAttribute("data-level-of"));
        if (!source || source.value === "") {
            out.value = "";
            return;
        }
        const total = Number(source.value) || 0;
        const [level3, level2] = out.getAttribute("data-levels").split(",").map(Number);
        out.value = total >= level3 ? "Level 3" : total >= level2 ? "Level 2" : "Level 1";
    });
}


/* ---------------- Annex AA: MD Monitoring Tool (Association) ---------------- */

function enterpriseBlock(p, ids, v) {
    return `
        <div class="pf-row pf-row--c4">
            <div class="pf-stack">
                ${tInput(p + "Name", v, `${ids[0]} Specific Name of Microenterprise*`)}
                ${tInput(p + "Psic", v, `<em>${ids[1]} PSIC Code*</em> ${hint("(may input code)")}:`)}
                ${ids[6] ? tRadios(`<em>${ids[6]} Kind of Enterprise</em>`, p + "Kind", ["New Enterprise", "Additional Enterprise"], v, { column: true }) : ""}
            </div>
            <div class="pf-stack">
                ${tRadios(`${ids[2]} Products/Services Offered*`, p + "Products", ["Product", "Service", "Product and Service"], v)}
                ${tTextarea(p + "ProductsList", v, "<em>Enumerate:</em>")}
            </div>
            <div class="pf-stack">
                ${tRadios(`${ids[3]} Enterprise Status*`, p + "Status", ["Operational", "Closed"], v)}
                <p class="pf-hint">If the status is closed, check all the applicable reasons:</p>
                <div>${tChecks(CLOSED_REASONS.map((label, i) => [p + "Closed" + i, label]), v)}${tCheckSpecify(p + "ClosedOther", "Others (please specify):", v)}</div>
            </div>
            <div class="pf-stack">
                ${tInput(p + "StartDate", v, `${ids[4]} Start Date of Operations* ${hint("(mm/dd/yyyy)")}`, { type: "date" })}
                ${tRadios(`${ids[5]} Production/Operation Cycle*`, p + "Cycle", ["Daily", "Weekly", "Monthly", "Every two (2) months", "Quarterly", "Every six (6) months", "Annual"], v, { column: true })}
            </div>
        </div>`;
}

function mdMonitoringToolPage() {
    const v = toolForms.mdmonitoring;
    const title = "MD MONITORING TOOL (ASSOCIATION)";
    const note = "Note: Fields marked with an asterisk (*) are required fields. If not applicable, put N/A on the space/s provided.";
    const money = (name, label, attrs = "") => tInput(name, v, `${label}<span class="visually-hidden"> in pesos</span>`, { type: "number", caption: "Php", attrs: `step="any" inputmode="decimal" ${attrs}` });
    const mov = prefix => `${tChecks(VERIFICATION_MEANS.map((label, i) => [prefix + i, label]), v)}${tCheckSpecify(prefix + "Other", "Others, please specify:", v)}`;

    const page1 = `
        ${toolMasthead(title, 1, 3, note)}
        ${toolConsent(
            "Good morning/afternoon, my name is (MPDO’s FULL NAME). We are conducting a monitoring visit which aims to collect your basic information and track the status of your microenterprise as a result of being a SLP beneficiary. May I have some of your time for an interview?",
            "All information contained herein shall be maintained in a secured database and shall be processed manually or electronically to track the status of the microenterprise for further monitoring in identifying appropriate assistance that can be given by SLP, to mainstream to other stakeholders/ partners, or validate to other databases of social protection/ welfare programs. Further, any controlled disclosure or transfer of any personal information or sensitive personal information to development partners, evaluation firms, academe, and other stakeholders shall be in accordance with the Data Privacy Policy and Sharing Protocol of the program and provisions under the DPA of 2012. You have the right to object to the processing of your personal data, the right to access your personal data that we will process, and the right to have your personal data corrected.",
            v)}
        ${toolMonitoringRow("MD PROJECT MONITORING", v)}

        ${sectionHead("A. MD ASSOCIATION INFORMATION")}
        ${toolLocation("A.1 Location of the MD Project*", v)}
        ${toolModalities(`A.2 Modality/ies Provided ${hint("(please check/specify)")} &amp; Date Provided* ${hint("(mm/dd/yyyy)")}`, [["modScf", "SCF"], ["modStfMd", "STF-MD"], ["modCblaf", "CBLAF"]], "Others (please specify)", v)}
        <div class="pf-row pf-row--rep">
            ${toolName(`A.3 Name of SLP Participant/Association Representative* ${hint("(Put N/A if no Middle Name)")}`, v)}
            ${tInput("participantId", v, "A.4 SLP Participant ID No.*")}
            ${tInput("contactNo", v, "A.5 Contact No.*", { type: "tel", attrs: 'inputmode="tel"' })}
        </div>
        <div class="pf-row pf-row--assoc">
            ${tInput("associationName", v, "A.6 Name of SLP Association")}
            ${tInput("designation", v, `A.7 Designation within SLPA ${hint("(if SLPA member)")}`)}
            <div>${memberCounts("Number of active and inactive members", [["No. of Active Members", "active"], ["No. of Inactive Members", "inactive"]], v)}</div>
        </div>

        ${sectionHead(`B. DETAILS OF THE ENTERPRISE ${hint("(Original Enterprise)")}`)}
        ${enterpriseBlock("b", ["B.1", "B.1.A", "B.2", "B.3", "B.4", "B.5"], v)}

        ${sectionHead(`C. DETAILS OF THE ENTERPRISE ${hint("(New/Additional Enterprise) - Add sheet if necessary")}`)}
        <div class="pf-row pf-row--scale">
            ${tRadios("<em>C.1. Did the Enterprise Scale-up/ Expand/Diversify?</em>", "scaleUp", ["Yes", "No"], v, { labels: { Yes: "Yes (Proceed to C.2)", No: "No (Proceed to Section D)" }, column: true })}
            <div class="pf-stack">
                <span class="pf-label"><em>C.2 Means of Scale-up/Expansion/Diversification</em></span>
                <div class="pf-options">
                    ${tChecks([["meansPdag", "Project Development and Advancement Grant (PDAG)"], ["meansPersonal", "Personal (SLPA)"], ["meansPartners", "Partners"]], v)}
                    ${tCheckSpecify("meansOther", "Others (please specify):", v)}
                </div>
            </div>
            ${tInput("scaleUpDate", v, `<em>C.2.A Date of Assistance</em> ${hint("(mm/dd/yyyy)")} <span class="pf-hint">Scale-up/Expansion/Diversification:</span>`, { type: "date" })}
        </div>
        ${enterpriseBlock("c", ["C.3", "C.3.A", "C.4", "C.5", "C.6", "C.7", "C.3.B"], v)}

        ${sectionHead(`D. BUSINESS REGISTRATIONS AND PERMITS ${hint("- Add sheet if necessary")}`)}
        <div class="pf-row pf-row--stack">
            ${tRadios("D.1 With business registration?", "hasRegistration", ["Yes", "No"], v)}
            ${toolRegistrations(v)}
        </div>

        ${sectionHead("E. EMPLOYMENT GENERATION")}
        <div class="pf-row pf-row--c2">
            ${tRadios("E.1 Did the SLPA generate employment?", "generatedEmployment", ["Yes", "No"], v)}
            ${tInput("generatedEmploymentCount", v, "E.2 If Yes, provide no. of Generated Employment:", { type: "number", inline: true, attrs: 'min="0" inputmode="numeric"' })}
        </div>

        ${sectionHead("F. ADDITIONAL FUNDS FROM OTHER STAKEHOLDERS")}
        <div class="pf-row pf-row--c3">
            <div class="pf-stack">
                ${tRadios("F.1 Did the Participant received additional funds?", "additionalFunds", ["Yes", "No"], v)}
                ${tInput("additionalFundsAmount", v, "If ‘Yes’, specify amount:", { type: "number", inline: true, attrs: 'min="0" step="any" inputmode="decimal"' })}
            </div>
            <div class="pf-stack">
                <span class="pf-label">F.2 Type of Source</span>
                <div>${tChecks([["fundDswd", "DSWD (Other Programs)"], ["fundOga", "Other Government Agencies"]], v)}${tCheckSpecify("fundOther", "Others (please specify):", v)}</div>
            </div>
            ${tTextarea("fundUsage", v, "F.3 Usage of additional funds")}
        </div>`;

    const assetRows = [1, 2, 3, 4].map(i => `
        <tr>
            <td data-label="Acquired/Received Asset"><span class="pf-rownum">${i}.</span><input name="asset${i}" form="toolForm" value="${escapeHTML(v["asset" + i])}" aria-label="Asset ${i}"></td>
            <td data-label="Type of Asset">${tSelect("asset" + i + "Type", ASSET_TYPES, v, `Asset ${i} type`)}</td>
            <td data-label="Name of Provider"><input name="asset${i}Provider" form="toolForm" value="${escapeHTML(v["asset" + i + "Provider"])}" aria-label="Asset ${i} name of provider"></td>
            <td data-label="Date of Acquisition"><input type="month" name="asset${i}Date" form="toolForm" value="${escapeHTML(v["asset" + i + "Date"])}" aria-label="Asset ${i} date of acquisition"></td>
            <td data-label="Type of Source">${tSelect("asset" + i + "Source", SOURCE_TYPES, v, `Asset ${i} type of source`)}</td>
        </tr>`).join("");

    const buyerRows = [1, 2, 3, 4, 5].map(i => `
        <tr>
            <td data-label="Name of Buyer"><span class="pf-rownum">${i}.</span><input name="buyer${i}" form="toolForm" value="${escapeHTML(v["buyer" + i])}" aria-label="Buyer ${i} name"></td>
            <td data-label="Type of Buyer">${tSelect("buyer" + i + "Type", ["Traditional", "Institutional"], v, `Buyer ${i} type`)}</td>
            <td data-label="Gross Sales (SLPA)"><input type="number" name="buyer${i}Sales" form="toolForm" value="${escapeHTML(v["buyer" + i + "Sales"])}" step="any" inputmode="decimal" aria-label="Buyer ${i} gross sales"></td>
            <td data-label="Mode of Procurement">${tSelect("buyer" + i + "Mode", PROCUREMENT_MODES, v, `Buyer ${i} mode of procurement`)}</td>
            <td data-label="Start Date of Engagement"><input type="date" name="buyer${i}Start" form="toolForm" value="${escapeHTML(v["buyer" + i + "Start"])}" aria-label="Buyer ${i} start date of engagement"></td>
        </tr>`).join("");

    const page2 = `
        ${toolMasthead(title, 2, 3, note)}
        ${sectionHead(`G. FINANCIAL STATUS ${hint("(Actual details should capture both Original &amp; Additional Enterprise)")}`)}
        <div class="pf-row pf-row--c5">
            ${money("g1", "G.1 Quarterly Gross Sales*", 'data-add="g3"')}
            ${money("g2", "G.2 Quarterly Cost of Sales*", 'data-sub="g3"')}
            ${tInput("g3", v, `G.3 Quarterly Gross Profit* ${hint("(G1-G2)")}`, { caption: "Php", attrs: 'readonly data-total="g3" data-add="g5"' })}
            ${money("g4", "G.4 Operating Expenses*", 'data-sub="g5"')}
            ${tInput("g5", v, `G.5 Quarterly Net Income/ Loss* ${hint("(G3-G4)")}`, { caption: "Php", attrs: 'readonly data-total="g5"' })}
        </div>
        <div class="pf-row pf-row--c4">
            <div class="pf-stack">
                <span class="pf-label">G.6 Savings</span>
                ${money("cashInBank", "Cash in Bank:", 'data-add="savings"')}
                ${money("cashOnHand", "Cash on Hand:", 'data-add="savings"')}
                ${tTotal("totalSavings", "savings", v, "<strong>Total savings:</strong> (Php)")}
            </div>
            <div class="pf-stack">
                ${tRadios(`G.7 Profit Sharing in SLPA ${hint("(if SLPA member)")}`, "profitSharing", ["Yes", "No"], v)}
                ${money("profitSharePerMember", "G.7.A Ave. Amount per SLPA member:")}
            </div>
            <div class="pf-stack">
                ${tRadios("G.8 Frequency of Profit Sharing", "profitFrequency", ["Once a year", "Twice a year", "Thrice a year", "Others, please specify:"], v, { column: true })}
                ${tInput("profitFrequencyOther", v, "Other frequency of profit sharing", { hiddenLabel: true })}
            </div>
            <div class="pf-stack">
                <span class="pf-label">G.9 Means of Verification for income-related fields* ${hint("(check all applicable)")}</span>
                <div>${mov("incomeMov")}</div>
            </div>
        </div>

        ${sectionHead(`H. ASSETS AND BUYERS ${hint("(May use additional sheet if necessary)")}`)}
        <div class="pf-row pf-row--legend pf-row--flush">
            <div class="pf-table-wrap" role="region" aria-label="H.1 Acquired/Received Assets" tabindex="0">
                <table class="pf-table table--stack">
                    <caption class="visually-hidden">H.1 Acquired/Received Assets</caption>
                    <thead><tr>
                        <th scope="col">H.1 Acquired/Received Assets*<span class="pf-hint">(Specific asset/s acquired through other means outside the initial grant under Punla Phase)</span></th>
                        <th scope="col">Type of Asset<span class="pf-hint">(input code)</span></th>
                        <th scope="col">Name of Provider<span class="pf-hint">(Do not abbreviate)</span></th>
                        <th scope="col">Date of Acquisition<span class="pf-hint">(mm/yyyy)</span></th>
                        <th scope="col">Type of Source<span class="pf-hint">(input code)</span></th>
                    </tr></thead>
                    <tbody>${assetRows}</tbody>
                </table>
            </div>
            <div class="pf-legend">
                <p><strong><u>Code for Type of Asset:</u></strong></p>
                ${ASSET_TYPES.map(([, text]) => `<p>${text}</p>`).join("")}
                <p><strong><u>Code for Type of Source:</u></strong></p>
                ${SOURCE_TYPES.map(([, text]) => `<p>${text}</p>`).join("")}
            </div>
        </div>
        <div class="pf-row pf-row--legend pf-row--flush">
            <div class="pf-table-wrap" role="region" aria-label="H.2 Name of Buyers" tabindex="0">
                <table class="pf-table table--stack">
                    <caption class="visually-hidden">H.2 Name of Buyers</caption>
                    <thead><tr>
                        <th scope="col">H.2 Name of Buyers*<span class="pf-hint">(Do not abbreviate/ acronymize)</span></th>
                        <th scope="col">Type of Buyer<span class="pf-hint">(Traditional or Institutional)</span></th>
                        <th scope="col">Gross Sales (SLPA)</th>
                        <th scope="col">Mode of Procurement<span class="pf-hint">(input code)</span></th>
                        <th scope="col">Start Date of Engagement<span class="pf-hint">(mm/dd/yyyy)</span></th>
                    </tr></thead>
                    <tbody>${buyerRows}</tbody>
                </table>
            </div>
            <div class="pf-legend">
                <p><strong><u>Code for Mode of Procurement:</u></strong></p>
                ${PROCUREMENT_MODES.map(([, text]) => `<p>${text}</p>`).join("")}
                <p class="pf-label">H.3 Means of Verification* ${hint("(check all applicable)")}</p>
                <div>${mov("buyerMov")}</div>
            </div>
        </div>

        ${sectionHead("I. MD ATTRIBUTES")}
        <p class="paper__instruction"><em>Instruction: The corresponding score per MD Attribute will be tallied to determine the quarterly operations performance of the livelihood project. If the SLPA does not exhibit the mentioned attributes, kindly rate them “0”.</em></p>
        ${rubricTable({
            caption: "I. MD Attributes", prefix: "mdAttr", total: "mdTotal", v,
            heads: ["MD Attributes*", "Indicators*", "Rating Score*"],
            groups: [
                { head: "Technical", items: [
                    { label: "I.1 Market Demand", sum: "md1", indicators: [{ rows: [[
                        [10, "Has a stable market and can readily respond to demand."],
                        [7, "Has a stable market but with limited capacity to respond <u><strong>or</strong></u> has a seasonal market but can readily respond to demand."],
                        [5, "Has a seasonal market and with limited capacity to respond."],
                        [3, "Has unstable market but can readily respond to market demands <u><strong>or</strong></u> with limited capacity to respond to market demands."]
                    ]] }] },
                    { label: "I.2 Market Supply", sum: "md2", indicators: [{ rows: [[
                        [10, "Necessary raw materials are available and accessible, and logistical requirements are sufficient."],
                        [7, "Necessary raw materials are available and accessible <u><strong>but</strong></u> logistical requirements are not sufficient."],
                        [5, "Necessary raw materials are not available and accessible <u><strong>but</strong></u> logistical requirements are sufficient."],
                        [3, "Necessary raw materials are not available and accessible, and logistical requirements are not sufficient."]
                    ]] }] },
                    { label: "I.3 Enterprise Plan", sum: "md3", indicators: [{ rows: [[
                        [10, "Enterprise plan is regularly updated for adjustments and improvements."],
                        [5, "Enterprise plan is not regularly updated."]
                    ]] }] }
                ] },
                { head: "Financial", items: [
                    { label: "I.4 Financial Stability and Savings", sum: "md4", indicators: [{ rows: [[
                        [10, "Generates a monthly income; able to financially support its operating expenses using the monthly income."],
                        [5, "Generates a monthly income; needs additional support (i.e., through credit facilities) to fund its operating expenses."],
                        [3, "Does not generate a monthly income; unable to support its operating expenses."]
                    ]] }] }
                ] }
            ]
        })}

        ${sectionHead(`J. NOTES/REMARKS ${hint("(Write important notes/remarks about the enterprise/s and include names of inactive members.)")}`)}
        <div class="pf-row pf-row--stack">${tTextarea("notes", v, "J. Notes/Remarks", { hiddenLabel: true })}</div>`;

    const page3 = `
        ${toolMasthead(title, 3, 3, note)}
        ${sectionHead("K. MAJOR ISSUSES/CHALLENGES ENCOUNTERED*")}
        <p class="paper__instruction"><em>Instructions: 1. Any major issues/concerns relative to each attribute can be written in the provided portion as well as the recommendations of the Field PDO and its status.<br>2. Put under ‘Others’ if issues and concerns do not fall under any MD Attributes</em></p>
        ${issuesTable("K. Major issues/challenges encountered", ["MD Attributes", "Issues and Concerns", "MPDO Recommendations", "Status"],
            ["Market Demand", "Market Supply", "Enterprise Plan", "Financial Stability and Savings", "Others"],
            ["Resolved/Completed", "Ongoing", "Pending"], v)}

        ${sectionHead("L. PARTICIPANT CERTIFICATION*")}
        <div class="paper__text">
            <p>This is to certify that all the aforementioned issues and concerns were discussed with the MPDO and I agree with the provided recommendations.</p>
            <div class="pf-sign__grid pf-sign__grid--2">
                ${tSignature("participantCertName", v, "<strong>Signature over Printed Name of the SLPA Representative</strong>")}
                ${tInput("participantCertDate", v, "<strong>Date</strong>", { type: "date", below: true })}
            </div>
        </div>

        ${sectionHead("M. SUMMARY OF RATINGS")}
        ${ratingSummary("M. Summary of ratings",
            [["Market Demand", "md1", 10], ["Market Supply", "md2", 10], ["Enterprise Plan", "md3", 10], ["Financial Stability and Savings", "md4", 10]],
            "mdTotal", 40, "Livelihood Status", "28,15", "Guide on Livelihood Status:",
            [["Level 3", "28—40"], ["Level 2", "15—27"], ["Level 1", "14 and below"]], v)}

        ${sectionHead("N. FORM CERTIFICATION*")}
        <div class="paper__text">
            <div class="pf-sign__grid pf-sign__grid--3">
                <div class="pf-stack"><p><strong>Accomplished by:</strong></p>${tSignature("accomplishedBy", v, "<strong>Signature over Printed Name of Monitoring PDO</strong>")}</div>
                <div class="pf-stack"><p><strong>Reviewed and Approved by:</strong></p>${tSignature("reviewedBy", v, "<strong>Signature over Printed Name of Provincial Coordinator</strong>")}</div>
                ${tInput("certDate", v, "<strong>Date</strong>", { type: "date", below: true })}
            </div>
        </div>`;

    return toolPage("mdmonitoring", [page1, page2, page3]);
}


/* ---------------- Annex AC: Organization Assessment Tool ---------------- */

const ORG_ASSESSMENT = [
    { head: "B.1 &nbsp;<u><strong>Governance and Internal Affairs:</strong></u> The SLPA is able to manage and improve its organizational performance.", sum: "oat1", items: [
        { label: "B.1.1 Effective governance through documented governing rules and elected officers", indicators: [
            { label: "Adherence to the Constitution and Bylaws and other rules of the association", rows: [[[2, "There is a written set of rules (Constitution &amp; Bylaws) recognized and adhered to by all its members."], [1, "There is a written set of rules but not recognized or adhered to by all its members."]]] },
            { label: "Performance of officers &amp; committees according to the Bylaws", rows: [[[3, "At least 75% of officers and committees are active and performing their duties and responsibilities."], [2, "50-74% of officers and committees are active and performing their duties and responsibilities."], [1, "Only 1-49% of officers and committee are active and performing their duties and responsibilities."]]] },
            { label: "Sanctions are discussed and strictly defined and imposed", rows: [[[3, "Sanctions are discussed with the members if there are changes or improvements and is being written and disseminated."], [2, "Sanctions are applied and are only discussed by officers and selected members."], [1, "Sanctions are applied and are only discussed by the officers."]]] }
        ] },
        { label: "B.1.2 Effective Management of association membership and meetings/activities", indicators: [
            { label: "Completeness of documentation for meetings or other activities", rows: [[[3, "All meetings/activities are documented and filed."], [2, "Not all meetings/activities are documented and filed."], [1, "Meetings are conducted but not documented and filed."]]] }
        ] },
        { label: "B.1.3 Effective Asset Management", indicators: [
            { label: "Utilization of assets acquired", rows: [[[1, "Assets acquired by the association such as office equipment and materials is utilized and is productive."]]] }
        ] }
    ] },
    { head: "B.2 &nbsp;<u><strong>Leadership Capabilities:</strong></u> The SLPA is managed by effective officers and has positive influenced to all of its members.", sum: "oat2", items: [
        { label: "B.2.1 Effective leadership by elected officials", indicators: [
            { label: "Leadership style of the President", rows: [
                [[2, "The President facilitates/presides over all activities/meetings."], [1, "The President sometimes facilitates/presides over meetings."]],
                [[1, "The President seeks the help of other officers."]],
                [[1, "The President consults the officers and members on issues."]],
                [[1, "The President intervenes during times of disagreements/conflicts."]]
            ] },
            { label: "Involvement of members in discussing the VMG &amp; its progress", rows: [[[2, "The officers discusses the organization’s VMG and revisits it in a timely manner to share its progress with members."], [1, "The organization’s progress is only discussed within officers."]]] }
        ] },
        { label: "B.2.2 Leadership roles taken by members", indicators: [
            { label: "Facilitation of meetings", rows: [[[1, "Members are able to facilitate meetings."]]] },
            { label: "Leadership and Participation in committees", rows: [[[1, "Members take on lead and/or participate in committees or ad-hoc teams."]]] },
            { label: "Addressing issues &amp; concerns", rows: [[[1, "Members are able to act and solve the issues and concerns of the association."]]] }
        ] }
    ] },
    { head: "B.3 &nbsp;<u><strong>Problem-Solving and Decision Making:</strong></u> The SLPA is able to resolve its issues and make decisions appropriately.", sum: "oat3", items: [
        { label: "B.3.1 Healthy resolution of organizational issues and conflict", indicators: [
            { label: "Resolving issues/concerns/ conflicts through series of consultations", rows: [[[2, "Issues are discussed and resolved fairly through consultations wherein the decisions are based on the consensus; not just on majority rule."], [1, "Issues are discussed and resolved fairly with members in regular meetings but only finalized through small group with select members."]]] },
            { label: "Transparency", rows: [[[2, "Updates on issues are disclosed to members during meetings."], [1, "Updates on issues are not disclosed to members during meetings."]]] }
        ] },
        { label: "Involvement in addressing community issues", indicators: [
            { label: "Identification and planning to address community issues", rows: [
                [[1, "There is a plan to create projects to address these community issues or needs"]],
                [[1, "The association has projects that address community issues or needs"]],
                [[1, "The association is involved in a project that address community issues or needs"]]
            ] }
        ] }
    ] },
    { head: "B.4 &nbsp;<u><strong>Members Participation:</strong></u> The SLPA has members that actively participate in the operation of the enterprise and organization.", sum: "oat4", items: [
        { label: "B.4.1 Active participation of members", indicators: [
            { label: "Attendance of members to <u>regular meetings</u>", rows: [[[2, "At least 75% of its members are attending regular meetings"], [1, "Only 50-74% of its members are attending regular meetings"]]] },
            { label: "Attendance of members to <u>emergency meetings</u>", rows: [[[2, "Emergency meetings are easily called with at least 60% of its members attend to discuss the issues and concerns"], [1, "Emergency meetings are called but only 40% of members are able to attend to discuss the issues and concerns."]]] },
            { label: "Involvement of members in Operationalization of their enterprise", rows: [[[2, "At least 30% of its members are active in monthly operationalization of their enterprise"], [1, "Only 10-29% of its members are active in monthly operationalization of their enterprise"]]] },
            { label: "Participation of members during trainings", rows: [
                [[2, "At least 75% of its members are actively participating in trainings"], [1, "Only 50-74% of its members are actively participating in trainings"]],
                [[2, "At least 75% of its members provide their own comments/inputs and provide suggestions during discussion"], [1, "Only 50-74% of its members provide their own comments/inputs and provide suggestions during discussion"]]
            ] }
        ] }
    ] },
    { head: "B.5 &nbsp;<u><strong>Financial Management:</strong></u> The SLPA is able to manage its finances for the benefit of the organization.", sum: "oat5", items: [
        { label: "B.5.1 Effective Management of Operational Funds", indicators: [
            { label: "Generation of operational funds", rows: [[[1, "The SLPA is able to generate operational funds from the profit of the enterprise/association."]]] },
            { label: "Transparency", rows: [[[1, "Utilization of generated operational funds is being presented and discussed during meetings."]]] },
            { label: "Use of Operational Funds", rows: [[[1, "Funds raised are managed effectively and used according to its purpose, including project development and advancement."]]] }
        ] },
        { label: "B.5.2 Savings collection", indicators: [
            { label: "Generation of Savings", rows: [[[1, "The SLPA is able to generate capital build-up, other funds such as operational and emergency funds by proper management of the collection of dues from its members or from the profit of the association."]]] },
            { label: "Transparency", rows: [[[1, "Use of the savings is being discussed during meetings."]], [[1, "Funds raised are managed effectively and used according to its purpose."]]] }
        ] }
    ] },
    { head: "B.6 &nbsp;<u><strong>Partnerships Initiative:</strong></u> The SLPA is seeking partners towards self-governance and operations of the established micro-enterprise.", sum: "oat6", items: [
        { label: "B.6.1 Openness to networking and alliance building", indicators: [
            { label: "Regularity in inviting partners", rows: [[[1, "Partners are invited to association meetings and other activities"]]] },
            { label: "Partnership Engagement", rows: [[[3, "All active partners engaged are initiated by the association"], [2, "There are partners initiated and engaged by the association"], [1, "All partnerships formed and engaged are facilitated by external actors."]]] }
        ] }
    ] },
    { head: "B.7 &nbsp;<u><strong>Job Generation:</strong></u> The SLP Association is able to provide livelihood and employment opportunities within members of association, family and community. <em>(If indicators pertaining to other phases are not applicable, put N/A)</em>", sum: "oat7", na: true, items: [
        { label: "B.7.1 Community Impact", indicators: [
            { label: "Job Generation <em>(For Usbong &amp; Sibol Phase Only)</em>", rows: [[[1, "The association was able to hire at least one (1) member from the SLPA or community for six (6) months"]]] },
            { label: "Job Generation <em>(For Yabong Phase Only)</em>", rows: [[[1, "The association was able to hire at least two (2) members from the SLPA or community for six (6) months"]]] }
        ] }
    ] }
];

function orgAssessmentToolPage() {
    const v = toolForms.orgassessment;
    const title = "ORGANIZATION ASSESSMENT TOOL";
    const note = "Note: Fields marked with an asterisk (*) are required fields. Any additional important notes may be written in the remarks section.";
    const rubric = groups => rubricTable({
        caption: "B. Organization Assessment", prefix: "oat", total: "oatTotal", indicatorCol: true, v, groups,
        heads: ["Organization Characteristics", "Indicators", "Guide for Rating", "Score"],
        subheads: [
            "This column captures the characteristics of a self-governing community organization.",
            "This column provides indicators to measure whether the SLPA has performed according to the set characteristics.",
            "This column assigns a numerical value to the varying levels of quality to meeting the criteria / indicators. For items to which the organization does not meet the criteria, input “0”.",
            "This column provides the user space to input actual rating."
        ]
    });
    // Rubric rows are named by group index, so splitting across pages keeps names stable.
    const groupsFor = indexes => ORG_ASSESSMENT.map((group, i) => indexes.includes(i) ? group : { ...group, items: [], head: null });

    const page1 = `
        ${toolMasthead(title, 1, 4, note)}
        ${toolConsent(
            "Good morning/afternoon, my name is (MPDO’s FULL NAME). We are conducting an assessment visit which aims to collect your basic information and track the status of your established association as a result of being a SLP beneficiary. May I have some of your time for an interview?",
            "All information contained herein shall be maintained in a secured database and shall be processed manually or electronically to track the status of the association for further assessment in identifying appropriate assistance that can be given by SLP, to mainstream to other stakeholders/ partners, or validate to other databases of social protection/ welfare programs. Further, any controlled disclosure or transfer of any personal information or sensitive personal information to development partners, evaluation firms, academe, and other stakeholders shall be in accordance with the Data Privacy Policy and Sharing Protocol of the program and provisions under the DPA of 2012. You have the right to object to the processing of your personal data, the right to access your personal data that we will process, and the right to have your personal data corrected.",
            v)}
        ${toolMonitoringRow("PROJECT MONITORING", v)}

        ${sectionHead("A. SLP ASSOCIATION INFORMATION")}
        ${toolLocation("A.1 Location of the SLPA*", v)}
        ${toolModalities(`A.2 Modality/ies Provided ${hint("(please check /specify)")} &amp; Date Provided ${hint("(mm/dd/yyyy)")}*`, [["modScf", "SCF"], ["modStMd", "ST-MD"], ["modCbla", "CBLA"]], "Others, specify:", v)}
        <div class="pf-row pf-row--rep2">
            ${toolName(`A.3 Name of SLP Association Representative* ${hint("(Put N/A if no Middle Name)")}`, v)}
            ${tInput("participantId", v, "A.4 SLPA Representative Participant ID No.*")}
        </div>
        <div class="pf-row pf-row--rep2">
            ${tInput("designation", v, "A.5 Designation within SLPA*")}
            ${tInput("contactNo", v, "A.6 Contact No.*", { type: "tel", attrs: 'inputmode="tel"' })}
        </div>
        <div class="pf-row pf-row--rep2">
            ${tInput("associationName", v, "A.7 Name of SLP Association*")}
            ${tInput("dateOrganized", v, `A.8 Date Organized* ${hint("(mm/dd/yyyy)")}`, { type: "date" })}
        </div>
        <div class="pf-row pf-row--members">
            <div class="pf-stack">
                ${tRadios("A.9 Status of SLP Association", "associationStatus", ["Operational", "Not Operational"], v, { labels: { "Not Operational": "Not Operational, cite reason/s:" }, column: true })}
                ${tTextarea("notOperationalReason", v, "Reasons the SLP Association is not operational", { hiddenLabel: true })}
            </div>
            <div class="pf-stack">
                <span class="pf-label">A.10 SLP Association Membership Status*</span>
                ${memberCounts("A.10 SLP Association Membership Status",
                    [["No. of Active Members", "origActive"], ["No. of Inactive Members", "origInactive"], ["No. of Active Members", "newActive"], ["No. of Inactive Members", "newInactive"]],
                    v, [["Original Members", 2], ["New Members", 2]])}
            </div>
            <div class="pf-stack">
                <span class="pf-label">A.11 Ratio of Male and Female Officers within SLPA* ${hint("(Provide Number)")}</span>
                ${memberCounts("A.11 Officers by sex", [["Officers", "officers"]], v)}
            </div>
        </div>
        <div class="pf-row pf-row--stack">
            <span class="pf-label">A.12 Reasons for being Inactive* ${hint("(check all that apply)")}</span>
            <div class="pf-options">
                ${tChecks([["inactiveUnmotivated", "Unmotivated"], ["inactiveOtherBusiness", "Engaged in other business"], ["inactiveMoved", "Changed residence/address"],
                    ["inactiveDied", "Participant died/passed away"], ["inactiveIllness", "Injury/illness"], ["inactiveOrgIssues", "Organizational Issues"]], v)}
                ${tCheckSpecify("inactiveOther", "Others, please specify:", v)}
            </div>
        </div>
        <div class="pf-row pf-row--stack">
            <span class="pf-label">A.13 Acquired Registrations/Accreditations/Certifications ${hint("(enumerate, if any)")}</span>
            ${toolRegistrations(v)}
        </div>

        ${sectionHead("B. ORGANIZATION ASSESSMENT")}
        <p class="paper__instruction"><em>Instructions: Kindly rate the SLPA based on the following characteristics identified below. If the SLPA does not exhibit the mentioned characteristics, kindly rate them “0”.</em></p>
        ${rubric(groupsFor([0]))}`;

    const page2 = `
        ${toolMasthead(title, 2, 4, note)}
        ${rubric(groupsFor([1, 2, 3, 4]))}`;

    const page3 = `
        ${toolMasthead(title, 3, 4, "Note: Fields marked with an asterisk (*) are required fields. Otherwise, put ‘N/A’.")}
        ${rubric(groupsFor([5, 6]))}
        ${sectionHead(`C. ACTIONS TO BE TAKEN ${hint("(Put under 'Others' if issues do not fall under any Organization Characteristics)")}`)}
        ${issuesTable("C. Actions to be taken", ["ORGANIZATION CHARACTERISTICS", "ISSUES/CONCERNS*", "RECOMMENDATIONS*", `STATUS OF RECOMMENDATIONS* ${hint("(please check)")}`],
            ["Governance and Internal Affairs", "Leadership Capabilities", "Problem-Solving and Decision Making", "Members Participation", "Financial Management", "Partnership Initiatives", "Job Generation", "Others"],
            ["Completed", "On-going", "Still for discussion with SLPA"], v)}`;

    const page4 = `
        ${toolMasthead(title, 4, 4, "")}
        ${sectionHead(`D. NOTES/REMARKS: ${hint("(Write important notes/remarks about the SLP Association)")}`)}
        <div class="pf-row pf-row--stack">${tTextarea("notes", v, "D. Notes/Remarks", { hiddenLabel: true })}</div>

        ${sectionHead("E. PARTICIPANT CERTIFICATION*")}
        <div class="paper__text">
            <p>This is to certify that all the aforementioned issues and concerns were discussed with the MPDO and I agree with the provided recommendations.</p>
            <div class="pf-sign__grid pf-sign__grid--2">
                ${tSignature("participantCertName", v, "<strong>Signature over Printed Name of the SLPA Representative</strong>")}
                ${tInput("participantCertDate", v, "<strong>Date</strong>", { type: "date", below: true })}
            </div>
        </div>

        ${sectionHead("F. SUMMARY OF RATINGS")}
        ${ratingSummary("F. Summary of ratings",
            [["Governance and Internal Affairs", "oat1", 12], ["Leadership Capabilities", "oat2", 10], ["Problem-Solving and Decision Making", "oat3", 7],
             ["Members Participation", "oat4", 10], ["Financial Management", "oat5", 6], ["Partnerships Initiative", "oat6", 4], ["Job Generation", "oat7", 1]],
            "oatTotal", 50, "SLPA Status", "34,17", "Guide on Adjectival Rating:",
            [["Level 3", "34—50"], ["Level 2", "17—33"], ["Level 1", "16 and below"]], v)}

        ${sectionHead("G. FORM CERTIFICATION")}
        <div class="paper__text">
            <div class="pf-sign__grid pf-sign__grid--3">
                <div class="pf-stack"><p><strong>Accomplished by:</strong></p>${tSignature("accomplishedBy", v, "<strong>Signature over Printed Name of Monitoring PDO</strong>")}</div>
                <div class="pf-stack"><p><strong>Reviewed and Approved by:</strong></p>${tSignature("reviewedBy", v, "<strong>Signature over Printed Name of Provincial Coordinator</strong>")}</div>
                ${tInput("certDate", v, "<strong>Date</strong>", { type: "date", below: true })}
            </div>
        </div>`;

    return toolPage("orgassessment", [page1, page2, page3, page4]);
}


/* ---------------- Annex AF.1: MD Usbong Assessment Tool ---------------- */

function usbongAssessmentToolPage() {
    const v = toolForms.usbongassessment;
    const visits = ["1<sup>st</sup> Visit", "2<sup>nd</sup> Visit", "3<sup>rd</sup> Visit", "4<sup>th</sup> Visit"];
    const visitGroup = (name, values, legend) => tRadios("", name, values, v, { legend, column: true });
    const visitAmount = (name, label, key, legend, attrs) => tInput(name, v, `${label}<span class="visually-hidden"> ${legend}</span>`, { type: "number", caption: "PHP", attrs: `step="any" inputmode="decimal" data-add="${key}"${attrs ? " " + attrs : ""}` });
    const plainVisit = i => stripTags(visits[i]);
    const dash = "-";

    const projectRows = `
        <tr>
            <th scope="row">Updated Enterprise Plan</th>
            ${visits.map((_, i) => `<td data-label="${plainVisit(i)}">${visitGroup("planV" + (i + 1), ["Yes", "No"], `Updated Enterprise Plan, ${plainVisit(i)}`)}</td>`).join("")}
            <td class="pf-scorecell" data-label="Project Score">${tSelect("projPlanScore", [10, 5, 0], v, "Updated Enterprise Plan project score", 'data-add="projTotal"')}</td>
        </tr>
        <tr>
            <th scope="row"><span class="pf-block">Gross Sales</span>${tTotal("grossTotal", "grossTotal", v, "Total Gross Sales: PHP")}</th>
            ${visits.map((_, i) => `<td data-label="${plainVisit(i)}">${visitGroup("salesV" + (i + 1), ["With Gross Sales", "Without Gross Sales"], `Gross Sales, ${plainVisit(i)}`)}${visitAmount("salesAmtV" + (i + 1), "Gross Sales:", "grossTotal", plainVisit(i))}</td>`).join("")}
            <td class="pf-scorecell" data-label="Project Score">${tSelect("projSalesScore", [10, 7, 5, 3, 0], v, "Gross Sales project score", 'data-add="projTotal"')}</td>
        </tr>
        <tr>
            <th scope="row"><span class="pf-block">Net Income</span>${tTotal("netTotal", "netTotal", v, "Total Net Income: PHP")}</th>
            ${visits.map((_, i) => `<td data-label="${plainVisit(i)}">${visitGroup("netV" + (i + 1), ["Positive", "Negative"], `Net Income, ${plainVisit(i)}`)}${visitAmount("netAmtV" + (i + 1), "Net Income:", "netTotal", plainVisit(i))}</td>`).join("")}
            <td class="pf-scorecell" data-label="Project Score">${tSelect("projNetScore", [10, 7, 5, 3, 0], v, "Net Income project score", 'data-add="projTotal"')}</td>
        </tr>
        <tr class="pf-total-row">
            <th scope="row" colspan="5"><label for="pf-projTotal">Total Project Score</label></th>
            <td class="pf-scorecell"><input id="pf-projTotal" name="projTotal" form="toolForm" value="${escapeHTML(v.projTotal)}" readonly data-total="projTotal"></td>
        </tr>`;

    const projectTypes = ["Projects with Daily/Weekly Income", "Long-Gestating Projects (below 6 months production cycle)", "Long-Gestating Projects (more than 6 months production cycle)"];
    const matrix = what => [
        [10, `Generated positive ${what} for four (4) quarters`, `Generated positive ${what} in at least two (2) production cycles`, `Generated positive ${what} in at least one (1) production cycle`],
        [7, `Generated positive ${what} for three (3) quarters`, dash, dash],
        [5, `Generated positive ${what} for two (2) quarters`, `Generated positive ${what} in at least one (1) production cycle`, dash],
        [3, `Generated positive ${what} for one (1) quarter`, dash, dash],
        [0, `Did not generate positive ${what}`, `Did not generate positive ${what}`, `Did not generate positive ${what}`]
    ];
    const ratingsTable = body => `
        <div class="pf-table-wrap" role="region" aria-label="Descriptive Ratings for Project Status" tabindex="0">
            <table class="pf-table pf-table--ratings">
                <caption class="visually-hidden">Descriptive Ratings for Project Status</caption>
                <thead><tr><th scope="col">Success Indicator</th><th scope="col" colspan="4">Descriptive Ratings for Project Status</th></tr></thead>
                <tbody>${body}</tbody>
            </table>
        </div>`;

    const page1 = `
        ${toolMasthead("MICROENTERPRISE DEVELOPMENT (MD) USBONG ASSESSMENT TOOL", 0, 0, "")}
        <div class="paper__text">
            <p class="pf-center"><strong>GENERAL INSTRUCTIONS</strong></p>
            <p>The MD Usbong Final Assessment Tool will be used to track and analyze the results of the monitoring and assessment visits during the Usbong Implementation Phase (Phase 2) and to determine who will qualify for the provision of the Project Development and Advancement Grant (PDAG).</p>
            <p>Specific points to take note of during the annual assessment:</p>
            <ol class="pf-instructions" type="a">
                <li>Use the accomplished MD Monitoring and Organization Assessment Tools as references for the Project/Association Status.</li>
                <li>Input the corresponding <strong>Project/Association rating score</strong> per success indicator based on the <strong>Descriptive Rating</strong> matrices.</li>
                <li>Use the <strong>“Description”</strong> box for additional remarks and/or observations on the Project and SLPA Association.</li>
                <li>Once the sub-level scores are computed, refer to the <strong>Rating Guide</strong> for Project Status and SLP Association <strong>to determine the corresponding Project/Association Status Levels and the Overall Livelihood Assessment.</strong></li>
            </ol>
        </div>

        ${sectionHead("A. SLP ASSOCIATION INFORMATION")}
        <div class="pf-row pf-row--usbong-a">
            ${tInput("microenterpriseName", v, "A.1 Name of Microenterprise")}
            ${toolLocation("A.2 Location of the MD Project", v, "pf-stack")}
        </div>
        <div class="pf-row pf-row--usbong-a2">
            ${tRadios("A.3 Enterprise Status", "enterpriseStatus", ["Operational", "Closed"], v, { column: true })}
            ${tInput("associationId", v, "A.4 SLP Association ID No.")}
            ${tInput("associationName", v, "A.5 Name of SLP Association")}
        </div>

        ${sectionHead(`B. PROJECT STATUS ${hint("(Instruction: Use the four (4) accomplished MD Monitoring Tools as reference.)")}`)}
        <div class="pf-table-wrap" role="region" aria-label="Assessment of Project Status" tabindex="0">
            <table class="pf-table pf-table--visits table--stack">
                <caption class="visually-hidden">Assessment of Project Status</caption>
                <thead>
                    <tr><th scope="colgroup" colspan="6">Assessment of Project Status</th></tr>
                    <tr><th scope="col">Success Indicator</th>${visits.map(visit => `<th scope="col">${visit}</th>`).join("")}<th scope="col">Project Score*</th></tr>
                </thead>
                <tbody>${projectRows}</tbody>
            </table>
        </div>
        <p class="pf-caption pf-right">*Refer to the <strong>Descriptive Rating</strong> below</p>
        <div class="pf-row pf-row--stack">${tTextarea("projectRemarks", v, "Other Remarks for Project Status:")}</div>

        ${ratingsTable(`
            <tr><th scope="rowgroup" rowspan="3">Updated MD Enterprise Plan</th><td class="pf-num-cell"><strong>10</strong></td><td colspan="3">MD Enterprise Plan is developed after the first MD Monitoring Visit, and updated after every succeeding visit</td></tr>
            <tr><td class="pf-num-cell"><strong>5</strong></td><td colspan="3">MD Enterprise Plan is updated after every Monitoring Visit, but is not implemented as planned <u><strong>or</strong></u> MD Enterprise Plan is implemented as planned, but not updated after every Monitoring Visit</td></tr>
            <tr><td class="pf-num-cell"><strong>0</strong></td><td colspan="3">MD Enterprise Plan is not updated and implemented</td></tr>
            ${ratingMatrix("Positive Gross Sales", projectTypes, matrix("gross sales"))}`)}`;

    const page2 = `
        ${ratingsTable(ratingMatrix("Positive Net Income", projectTypes, matrix("net income")))}

        ${sectionHead(`C. SLP ASSOCIATION STATUS ${hint("(Instructions: Use the last accomplished Organization Assessment Tool as a reference.)")}`)}
        ${rubricTable({
            caption: "C. SLP Association Status", prefix: "usa", total: "assocTotal", v,
            heads: ["Success Indicator", "Descriptive Rating", "SLP Association Score"],
            totalRow: { name: "assocTotal", label: "Total SLP Association Score" },
            groups: [{ items: [
                { label: "Active and Performing Officers", indicators: [{ rows: [[
                    [10, "At least 75% of the officers are active and performing their duties and responsibilities"],
                    [7, "50-74% of the officers are active and performing their duties and responsibilities"],
                    [5, "1-49% of the officers are active and performing their duties and responsibilities"],
                    [0, "All officers are not active and performing their duties and responsibilities"]
                ]] }] },
                { label: "Active Participation of Members", indicators: [{ rows: [[
                    [10, "SLP Association meetings are attended by at least 75% of its members"],
                    [7, "SLP Association meetings are attended by 50-74% of its members"],
                    [5, "SLP Association meetings are attended by 1-49% of its members"],
                    [0, "All members are not attending SLP Association meetings"]
                ]] }] },
                { label: "Resolving Issues", indicators: [{ rows: [[
                    [10, "SLP Association conducted a dialogue with the concerned individual/office to resolve all issues. <u><strong>or</strong></u> the SLP Association did not encounter any issues to resolve"],
                    [5, "SLP Association conducted dialogue with the concerned individual/office to resolve selected issues only"],
                    [0, "SLP Association did not solve any issues encountered"]
                ]] }] },
                { label: "Community Impact", indicators: [{ rows: [[
                    [10, "Employed at least one (1) member of the SLP Association or the community for six (6) months"],
                    [0, "No employment generated"]
                ]] }] }
            ] }]
        })}
        <div class="pf-row pf-row--stack">${tTextarea("associationRemarks", v, "Other Remarks for SLP Association Status:")}</div>

        ${sectionHead(`D. COMPETENCY STATUS ${hint("(Instructions: Use the accomplished Competence-based Assessment Result as a reference.)")}`)}
        <div class="pf-row pf-row--c3">
            ${tRadios(`SLPA Competency Level <span class="pf-hint">(based on CBAT Result)</span>`, "competencyLevel", ["Basic", "Intermediate", "Advanced"], v, { column: true })}
            <div class="pf-stack"><span class="pf-label">Top 3 Competencies</span>${[1, 2, 3].map(i => tInput("topCompetency" + i, v, `${i}.<span class="visually-hidden"> top competency</span>`, { inline: true })).join("")}</div>
            <div class="pf-stack"><span class="pf-label">Top 3 Competencies Needing Improvement</span>${[1, 2, 3].map(i => tInput("improveCompetency" + i, v, `${i}.<span class="visually-hidden"> competency needing improvement</span>`, { inline: true })).join("")}</div>
        </div>
        <div class="pf-row pf-row--stack">${tTextarea("learningRecommendations", v, "Learning &amp; Development Recommendation/s:")}</div>`;

    const overallGuide = `
        <div class="pf-table-wrap pf-table-wrap--plain" role="region" aria-label="Rating Guide for Overall Livelihood Assessment" tabindex="0">
        <table class="pf-table pf-table--guide">
            <caption><strong>Rating Guide for Overall Livelihood Assessment</strong></caption>
            <thead><tr><th scope="col">Project Status</th><th scope="col">SLP Association Status</th><th scope="col">Competency Status</th><th scope="col">Overall Assessment</th></tr></thead>
            <tbody>
                <tr><td>3</td><td>3</td><td>Intermediate - Advanced</td><td>Level 3</td></tr>
                <tr><td>3</td><td>3</td><td>Basic</td><td rowspan="3">Level 2</td></tr>
                <tr><td>3</td><td>2</td><td rowspan="2">Basic - Advanced</td></tr>
                <tr><td>2</td><td>3</td></tr>
                <tr><td>2</td><td>1</td><td rowspan="3">Basic-Advanced</td><td rowspan="3">Level 1</td></tr>
                <tr><td>1</td><td>2</td></tr>
                <tr><td>1</td><td>1</td></tr>
            </tbody>
        </table>
        </div>`;

    const eligibility = [
        ["Level 3", "The association is <strong>eligible</strong> to proceed to the Sibol Implementation Phase."],
        ["Level 2", "The association is <strong>deferred</strong> from proceeding to the Sibol Implementation Phase."],
        ["Level 1", "The association is <strong>not eligible</strong> to proceed to the Sibol Implementation Phase."]
    ];

    const page3 = `
        ${sectionHead("E. OVERALL ASSESSMENT AND RECOMMENDATION")}
        <div class="paper__instruction">
            <em>Instructions:</em>
            <ol class="pf-instructions">
                <li>Write down the total Project and SLP Association Score under the <strong>“Score” column</strong>.</li>
                <li>Reflect the corresponding Project and SLP Association Status under the <strong>“Status” column</strong> based on the <strong>Rating Guide for Project/Association Status.</strong></li>
                <li>Write down the SLPA Competency Level under the <strong>Competency Status Row</strong>.</li>
                <li>Specify the possible next steps/recommendations, if any.</li>
                <li>Based on the scores of the three (3) components, determine the overall score using the <strong>Rating Guide for Overall Livelihood Assessment</strong>.</li>
            </ol>
        </div>
        <div class="pf-row pf-row--c2">
            ${levelGuide([["Level 3", "21 – 30"], ["Level 2", "11 – 20"], ["Level 1", "10 and below"]], ["PROJECT STATUS — Status", "Total Score"])}
            ${levelGuide([["Level 3", "28 – 40"], ["Level 2", "15 – 27"], ["Level 1", "14 and below"]], ["SLP ASSOCIATION STATUS — Status", "Total Score"])}
        </div>
        <div class="pf-table-wrap" role="region" aria-label="Overall assessment" tabindex="0">
            <table class="pf-table table--stack">
                <caption class="visually-hidden">Overall assessment and recommendation</caption>
                <thead><tr><th scope="col">Component</th><th scope="col">Score</th><th scope="col">Status</th><th scope="col">Next Steps/Recommendations</th></tr></thead>
                <tbody>
                    <tr>
                        <th scope="row">Project Status</th>
                        <td data-label="Score">${tTotal("projTotalE", "projTotal", v, "Project Status score")}</td>
                        <td data-label="Status">${tLevel("projStatus", "pf-projTotalE", "21,11", v, "Project Status level")}</td>
                        <td data-label="Next Steps/Recommendations">${tTextarea("projNextSteps", v, "Project Status next steps", { hiddenLabel: true })}</td>
                    </tr>
                    <tr>
                        <th scope="row">SLP Association Status</th>
                        <td data-label="Score">${tTotal("assocTotalE", "assocTotal", v, "SLP Association Status score")}</td>
                        <td data-label="Status">${tLevel("assocStatus", "pf-assocTotalE", "28,15", v, "SLP Association Status level")}</td>
                        <td data-label="Next Steps/Recommendations">${tTextarea("assocNextSteps", v, "SLP Association Status next steps", { hiddenLabel: true })}</td>
                    </tr>
                    <tr>
                        <th scope="row">Competency Status</th>
                        <td colspan="2" data-label="Competency Status">${tSelect("competencyStatus", ["Basic", "Intermediate", "Advanced"], v, "Competency Status")}</td>
                        <td data-label="Next Steps/Recommendations">${tTextarea("competencyNextSteps", v, "Competency Status next steps", { hiddenLabel: true })}</td>
                    </tr>
                    <tr>
                        <th scope="row"><strong>Overall Livelihood Assessment</strong> <span class="pf-hint">(Refer to the rating guide below)</span></th>
                        <td colspan="2" data-label="Overall Livelihood Assessment">${tSelect("overallAssessment", ["Level 3", "Level 2", "Level 1"], v, "Overall Livelihood Assessment")}</td>
                        <td data-label="Next Steps/Recommendations">${tTextarea("overallNextSteps", v, "Overall assessment next steps", { hiddenLabel: true })}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="pf-row pf-row--c2">
            <div>${overallGuide}</div>
            <fieldset class="pf-group pf-group--block">
                <legend class="paper__sub">F. RECOMMENDATION FOR ELIGIBILITY</legend>
                <p><em>Check the appropriate recommendation based on the result of the overall livelihood assessment:</em></p>
                ${eligibility.map(([level, text]) => `<label class="choice pf-assess-choice"><input type="radio" name="eligibility" value="${level}" form="toolForm" ${v.eligibility === level ? "checked" : ""}><span><strong>${level}</strong> — ${text}</span></label>`).join("")}
            </fieldset>
        </div>

        ${sectionHead("G. CERTIFICATION")}
        <div class="paper__text">
            <div class="pf-sign__grid pf-sign__grid--3">
                <div class="pf-stack"><p><strong>Assessed by:</strong></p>${tSignature("assessedBy", v, "<em>Signature Over Printed Name of Monitoring PDO</em>")}${tInput("assessedDate", v, "<em>Date:</em>", { type: "date", inline: true })}</div>
                <div class="pf-stack"><p><strong>Reviewed by:</strong></p>${tSignature("reviewedBy", v, "<em>Signature Over Printed Name of Provincial Coordinator</em>")}${tInput("reviewedDate", v, "<em>Date:</em>", { type: "date", inline: true })}</div>
                <div class="pf-stack"><p><strong>Approved by:</strong></p>${tSignature("approvedBy", v, "<em>Signature Over Printed Name of Regional Program Coordinator</em>")}${tInput("approvedDate", v, "<em>Date:</em>", { type: "date", inline: true })}</div>
            </div>
        </div>`;

    return toolPage("usbongassessment", [page1, page2, page3]);
}


/* ==============================================================
   28. DOCUMENTS
   ============================================================== */

function documentsPage() {
    const myDocuments = data.documents;   // already limited by the server to this participant

    registerTable("documentsTableBody", { countId: "documentRecordCount", noun: "documents", caption: "My documents" });

    return `
        <section class="card" aria-labelledby="documentsTitle">
            ${cardHeader("Documents", "Upload required SLP compliance and verification documents and track their review.", button("Upload document", "openDocumentForm()", { variant: "primary", icon: "upload" }), "documentsTitle")}
            ${tableToolbar({
                tableId: "documentsTableBody",
                searchId: "documentSearch",
                searchHint: "Document name or type",
                countId: "documentRecordCount",
                total: myDocuments.length,
                noun: "documents",
                filterLabel: "Verification status",
                filterOptions: uniqueValues(myDocuments, "status")
            })}
            ${dataTable({
                id: "documentsTableBody",
                caption: "My documents",
                columns: [
                    { label: "Document Title" },
                    { label: "Category" },
                    { label: "Date Submitted" },
                    { label: "Verification Status" },
                    { label: '<span class="visually-hidden">Actions</span>', sortable: false, cls: "actions" }
                ],
                rows: myDocuments.map(docItem => {
                    const realIndex = data.documents.indexOf(docItem);
                    return {
                        filter: docItem.status,
                        sort: { 2: docItem.date || "" },
                        cells: [
                            `<strong>${escapeHTML(docItem.name)}</strong>`,
                            escapeHTML(docItem.type),
                            escapeHTML(formatDate(docItem.date) || "—"),
                            statusBadge(docItem.status),
                            button(`View<span class="visually-hidden"> ${escapeHTML(docItem.name)}</span>`, `viewDocument(${realIndex})`, { variant: "tertiary" })
                        ]
                    };
                }),
                emptyTitle: "No documents yet",
                emptyText: "Choose Upload document to send your first file."
            })}
        </section>`;
}

function openDocumentForm() {
    if (isStaff()) {
        showToast("Access denied: Personnel cannot upload documents as a beneficiary.", "error");
        return;
    }

    openModal("Upload document", modalForm({
        formId: "documentForm",
        saveFn: "saveDocument",
        confirmLabel: "Upload document",
        fieldsHTML: `
            ${formField({ id: "documentName", label: "Document Name", required: true, hint: "What is this document? For example: Barangay Clearance or Project Proposal." })}
            ${formField({ id: "documentType", label: "Document Type", options: ["Profile", "Project", "Progress", "Other"] })}
            ${formField({ id: "documentFile", label: "Select File", type: "file", required: true, hint: "PDF, JPG or PNG. A clear photo taken with your phone is fine.", attrs: 'accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"' })}`
    }));
}

function saveDocument(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    if (isStaff()) {
        showToast("Access denied: Personnel cannot upload documents as a beneficiary.", "error");
        return;
    }

    const beneficiary = getCurrentBeneficiary();
    const docName = get("documentName") ? get("documentName").value : "";

    data.documents.push({
        name: docName,
        type: get("documentType") ? get("documentType").value : "",
        status: "For Review",
        beneficiary: beneficiary ? beneficiary.name : "Maria Santos",
        date: getCurrentDate(),
        size: "1.2 MB"
    });

    showPage("documents");

    // Confirmation screen
    openModal("Document submitted", `
        ${emptyState("circle-check", "Your document was uploaded", `<strong>${escapeHTML(docName)}</strong> is now ${statusBadge("For Review")}. MSWDO personnel will check it and you will get a notification if anything needs to be corrected.`)}
        <div class="modal__footer">
            ${button("Upload another", "openDocumentForm()")}
            ${button("Done", "closeModal()", { variant: "primary" })}
        </div>`);
}

function viewDocument(index) {
    const docItem = data.documents[index];
    if (!docItem) {
        return;
    }

    openModal("Document details", `
        ${summaryList([
            ["Name", `<strong>${escapeHTML(docItem.name)}</strong>`],
            ["Type", escapeHTML(docItem.type)],
            ["Date Submitted", escapeHTML(formatDate(docItem.date) || "—")],
            ["Status", statusBadge(docItem.status)]
        ])}
        <div class="modal__section">
            ${alertBox("neutral", "", "Correction requests and approval status will appear here.", "info")}
        </div>
        <div class="modal__footer">
            ${button("Close", "closeModal()", { variant: "primary" })}
        </div>`);
}


/* ==============================================================
   29. HELPER FUNCTIONS
   ============================================================== */

/*
   Returns the beneficiary connected to the current user.
   This is demo logic only.
*/
function getCurrentBeneficiary() {
    if (!currentUser || currentUser.beneficiaryId == null) return null;
    return data.beneficiaries.find(b => b.dbId === currentUser.beneficiaryId) || null;
}


/* ==============================================================
   30. MODAL (forms & record details)
   ============================================================== */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let modalReturnFocus = null;

function setBackgroundInert(inert) {
    ["app", "loginScreen"].forEach(id => {
        const el = get(id);
        if (el) el.inert = inert;
    });
}

function openModal(title, content) {
    const wasOpen = get("modal") && get("modal").classList && !get("modal").classList.contains("hidden");
    if (!wasOpen && typeof document !== "undefined") {
        modalReturnFocus = document.activeElement || null;
    }

    get("modalTitle").textContent = title;
    get("modalContent").innerHTML = content;
    get("modal").classList.remove("hidden");

    if (document.body && document.body.classList) {
        document.body.classList.add("modal-open");
    }
    setBackgroundInert(true);

    // Focus the first field of a form, otherwise the dialog title.
    const contentEl = get("modalContent");
    const firstField = contentEl && contentEl.querySelector ? contentEl.querySelector("input, select, textarea") : null;
    focusElement(firstField || get("modalTitle"));
}

function closeModal() {
    const modal = get("modal");
    if (!modal) return;
    modal.classList.add("hidden");
    if (document.body && document.body.classList) {
        document.body.classList.remove("modal-open");
    }
    setBackgroundInert(false);

    // Return focus to what opened the modal, if it is still on the page.
    if (modalReturnFocus && document.contains && document.contains(modalReturnFocus)) {
        focusElement(modalReturnFocus);
    }
    modalReturnFocus = null;
}

/* Clicking the dark backdrop closes the modal. */
const modalEl = get("modal");
if (modalEl) {
    modalEl.addEventListener("click", function (event) {
        if (event.target && event.target.id === "modal") {
            closeModal();
        }
    });
}


/* ==============================================================
   31. ALERT DIALOG (confirmations, session timeout)
   ============================================================== */

let alertDialogState = null;

function isAlertDialogOpen() {
    const dialog = get("alertDialog");
    return !!(dialog && dialog.classList && !dialog.classList.contains("hidden"));
}

function openAlertDialog({ title, bodyHTML, actionsHTML, onConfirm, onCancel, focusLast }) {
    const dialog = get("alertDialog");
    if (!dialog) return;

    alertDialogState = {
        onConfirm: onConfirm || null,
        onCancel: onCancel || null,
        returnFocus: typeof document !== "undefined" ? document.activeElement : null
    };

    get("alertDialogTitle").textContent = title;
    get("alertDialogBody").innerHTML = bodyHTML;
    get("alertDialogActions").innerHTML = actionsHTML;
    dialog.classList.remove("hidden");

    setBackgroundInert(true);
    const modal = get("modal");
    if (modal) modal.inert = true;

    // Focus the safe (first) action, or the last one when asked.
    const actions = get("alertDialogActions");
    const buttons = actions && actions.querySelectorAll ? actions.querySelectorAll("button") : [];
    focusElement(buttons.length ? buttons[focusLast ? buttons.length - 1 : 0] : null);
}

function closeAlertDialog() {
    const dialog = get("alertDialog");
    if (!dialog || !dialog.classList || dialog.classList.contains("hidden")) {
        alertDialogState = null;
        return;
    }
    dialog.classList.add("hidden");
    const modal = get("modal");
    const modalOpen = modal && modal.classList && !modal.classList.contains("hidden");
    if (modal) modal.inert = false;
    setBackgroundInert(!!modalOpen);

    const returnFocus = alertDialogState && alertDialogState.returnFocus;
    if (returnFocus && document.contains && document.contains(returnFocus)) {
        focusElement(returnFocus);
    }
    alertDialogState = null;
}

/* Called by the dialog buttons. */
function resolveAlertDialog(confirmed) {
    const state = alertDialogState;
    closeAlertDialog();
    if (!state) return;
    if (confirmed && state.onConfirm) state.onConfirm();
    if (!confirmed && state.onCancel) state.onCancel();
}

/* Standard confirmation. The safe choice is focused first. */
function confirmAction({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive = false, onConfirm, onCancel }) {
    openAlertDialog({
        title,
        bodyHTML: `<p>${escapeHTML(message)}</p>`,
        actionsHTML:
            button(escapeHTML(cancelLabel), "resolveAlertDialog(false)") +
            button(escapeHTML(confirmLabel), "resolveAlertDialog(true)", { variant: destructive ? "destructive" : "primary" }),
        onConfirm,
        onCancel
    });
}


/* ==============================================================
   32. NOTIFICATION COUNT (only what this user can see)
   ============================================================== */

function updateNotificationCount() {
    const unread = currentUser ? getVisibleNotifications().filter(notification => !notification.read).length : 0;

    const notifCountEl = get("notificationCount");
    if (notifCountEl) {
        notifCountEl.textContent = unread;
        if (unread) {
            notifCountEl.classList.remove("hidden");
        } else {
            notifCountEl.classList.add("hidden");
        }
    }

    const buttonEl = get("notificationButton");
    if (buttonEl && buttonEl.setAttribute) {
        buttonEl.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications, none unread");
    }
}


/* ==============================================================
   33. TOAST MESSAGES
   ============================================================== */

/*
   Shows a short message.
   type: "success" (default), "info" or "error".
   Example: showToast("Saved successfully.");
*/
function showToast(message, type) {
    if (typeof document === "undefined" || !document.body) {
        return;
    }

    const kind = type || (/^access denied/i.test(message) ? "error" : "success");
    const icons = { success: "circle-check", info: "info", error: "circle-alert" };

    const toast = document.createElement("div");
    toast.className = `toast toast--${kind}`;
    if (kind === "error") toast.setAttribute("role", "alert");
    toast.innerHTML = `
        ${icon(icons[kind] || "info")}
        <p class="toast__text">${escapeHTML(message)}</p>
        <button type="button" class="btn btn--tertiary btn--icon" aria-label="Dismiss message" title="Dismiss" onclick="this.parentElement.remove()">${icon("x")}</button>`;

    const region = get("toastRegion") || document.body;
    region.appendChild(toast);

    // Long enough to read; errors stay longer.
    const timer = setTimeout(() => toast.remove(), kind === "error" ? 8000 : 5000);
    if (timer && typeof timer.unref === "function") timer.unref();
}


/* ==============================================================
   34. MOBILE MENU
   ============================================================== */

function openSidebar() {
    const sidebarEl = get("sidebar");
    const backdropEl = get("sidebarBackdrop");
    const menuBtn = get("mobileMenuButton");
    if (!sidebarEl) return;
    sidebarEl.classList.add("open");
    if (backdropEl) backdropEl.classList.remove("hidden");
    if (menuBtn && menuBtn.setAttribute) menuBtn.setAttribute("aria-expanded", "true");
    focusElement(get("sidebarCloseButton"));
}

function closeSidebar() {
    const sidebarEl = get("sidebar");
    const backdropEl = get("sidebarBackdrop");
    const menuBtn = get("mobileMenuButton");
    if (!sidebarEl || !sidebarEl.classList || !sidebarEl.classList.contains("open")) {
        if (backdropEl && backdropEl.classList) backdropEl.classList.add("hidden");
        return;
    }
    sidebarEl.classList.remove("open");
    if (backdropEl) backdropEl.classList.add("hidden");
    if (menuBtn && menuBtn.setAttribute) menuBtn.setAttribute("aria-expanded", "false");
}

const mobileMenuBtn = get("mobileMenuButton");
if (mobileMenuBtn && mobileMenuBtn.addEventListener) {
    mobileMenuBtn.addEventListener("click", openSidebar);
}

const sidebarCloseBtn = get("sidebarCloseButton");
if (sidebarCloseBtn && sidebarCloseBtn.addEventListener) {
    sidebarCloseBtn.addEventListener("click", function () {
        closeSidebar();
        focusElement(get("mobileMenuButton"));
    });
}

const sidebarBackdropEl = get("sidebarBackdrop");
if (sidebarBackdropEl && sidebarBackdropEl.addEventListener) {
    sidebarBackdropEl.addEventListener("click", closeSidebar);
}


/* ==============================================================
   35. KEYBOARD, FOCUS TRAP, ACTIVITY & UNSAVED-CHANGES TRACKING
   ============================================================== */

/* The open layer that should contain keyboard focus, if any. */
function topLayer() {
    if (isAlertDialogOpen()) return get("alertDialog");
    const modal = get("modal");
    if (modal && modal.classList && !modal.classList.contains("hidden")) return modal;
    const sidebar = get("sidebar");
    if (sidebar && sidebar.classList && sidebar.classList.contains("open")) return sidebar;
    return null;
}

if (isBrowser() && document.addEventListener) {

    document.addEventListener("keydown", function (event) {

        // Escape closes the top layer.
        if (event.key === "Escape") {
            if (isAlertDialogOpen()) {
                resolveAlertDialog(false);
            } else if (topLayer() === get("modal")) {
                closeModal();
            } else if (topLayer() === get("sidebar")) {
                closeSidebar();
                focusElement(get("mobileMenuButton"));
            }
            return;
        }

        // Keep Tab inside an open dialog or drawer.
        if (event.key === "Tab") {
            const layer = topLayer();
            if (!layer) return;
            const focusables = Array.from(layer.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null);
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && (document.activeElement === first || !layer.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
            return;
        }

        // Arrow keys move between tabs (ARIA tabs pattern).
        if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && event.target.getAttribute && event.target.getAttribute("role") === "tab") {
            const tabs = Array.from(event.target.closest("[role='tablist']").querySelectorAll("[role='tab']"));
            const index = tabs.indexOf(event.target);
            const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
            next.focus();
            next.click();
            event.preventDefault();
        }
    });

    // Session activity.
    ["pointerdown", "keydown", "input"].forEach(type => {
        document.addEventListener(type, recordActivity, { passive: true });
    });

    // Unsaved profile changes.
    ["input", "change"].forEach(type => {
        document.addEventListener(type, function (event) {
            const form = event.target && event.target.getAttribute ? event.target.getAttribute("form") : null;
            if (form === "profileForm" || form === "toolForm") {
                profileDirty = true;
            }
            if (form === "toolForm") {
                updateToolTotals();
            }
        });
    });

    // Inline validation: check a field when the user leaves it, and
    // re-check while typing once an error is showing.
    document.addEventListener("focusout", function (event) {
        const control = event.target;
        if (!control || !control.closest || !control.closest("#modalContent .field")) return;
        if (control.value || control.getAttribute("aria-invalid") === "true") {
            validateField(control);
        }
    });
    document.addEventListener("input", function (event) {
        const control = event.target;
        if (control && control.getAttribute && control.getAttribute("aria-invalid") === "true" && control.closest("#modalContent .field")) {
            validateField(control);
        }
    });

    // Browser Back / Forward moves between pages.
    window.addEventListener("popstate", function () {
        if (!currentUser) return;
        const page = pageFromUrl() || "dashboard";
        if (page !== currentPage) {
            closeModal();
            navigate(page, { fromHistory: true });
        }
    });

    // Warn before closing the tab with unsaved profile changes.
    window.addEventListener("beforeunload", function (event) {
        if (currentUser && profileDirty) {
            event.preventDefault();
            event.returnValue = "";
        }
    });
}

// Initialize the banner date on load, and resume a session that is still valid.
if (typeof document !== "undefined") {
    updateTopbarDate();
}
if (isBrowser()) {
    resumeSession();
}


/* ==============================================================
   36. HOW TO ADD A NEW FEATURE
   ==============================================================

   Example: you want to add "Training Management".

   STEP 1: Add an item to NAV_ITEMS.staff (or .beneficiary).
   STEP 2: Add the page name to STAFF_PAGES, BENEFICIARY_PAGES or LEADER_PAGES.
   STEP 3: Add a title to PAGE_TITLES and a description in pageDescription().
   STEP 4: Add a case to the switch in showPage():
               case "training": contentEl.innerHTML = trainingPage(); break;
   STEP 5: Build trainingPage() from the components in section 7 and 8:
               cardHeader(), tableToolbar(), dataTable(), statusBadge(),
               formField() + modalForm() for its "Add" form.
   STEP 6: If the page needs data, add a new array inside `data`.

   FUTURE MYSQL VERSION: see README.txt.
   ============================================================== */

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        users,
        data,
        profileForms,
        getCurrentUser: () => currentUser,
        setCurrentUser: (u) => { currentUser = u; },
        loginUser,
        logoutUser,
        isStaff,
        isLeader,
        isMember,
        escapeHTML,
        showPage,
        navigate,
        openBeneficiaryForm,
        saveBeneficiary,
        viewBeneficiary,
        beneficiaryTable,
        openMonitoringForm,
        saveMonitoring,
        openAssistanceForm,
        saveAssistance,
        openReportForm,
        saveReport,
        openAccountForm,
        saveAccount,
        openProjectForm,
        saveProject,
        openNotificationForm,
        saveNotification,
        openDocumentForm,
        saveDocument,
        viewDocument,
        saveProfile,
        profilePage,
        documentsPage,
        statusBadge,
        openModal,
        closeModal,
        viewReport,
        notificationsPage,
        dashboardPage,
        beneficiariesPage,
        monitoringPage,
        assistancePage,
        reportsPage,
        accountsPage,
        projectsPage,
        getCurrentBeneficiary,
        getCurrentProfile,
        api,
        ApiError,
        LABELS,
        displayId,
        applySnapshot,
        loadData,
        resumeSession,
        viewMonitoring,
        approveDocument,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        exportCSV,
        csvCell,
        getVisibleNotifications,
        MONITORING_TOOLS,
        toolForms,
        saveTool
    };
}
