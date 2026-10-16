/*
   Bootstrap responses (GET api/bootstrap.php) for the Node tests, built
   from database/seed-demo.sql. snapshot(role) returns a fresh copy for
   "staff", "leader" or "member", filtered the way the server filters it.
*/

const reference = {
    barangays: [
        { id: 1, name: "Araw at Bituin" }, { id: 2, name: "Bagong Sikat" }, { id: 5, name: "Cabra" }, { id: 15, name: "Tilik" }
    ],
    livelihoodTypes: [
        { id: 1, name: "Sari-sari Store" }, { id: 2, name: "Poultry Raising" }, { id: 3, name: "Piggery" }, { id: 4, name: "Food Vending" }
    ],
    associations: [
        { id: 1, name: "Bagong Sikat Sari-sari Store SLPA", barangay: "Bagong Sikat", livelihoodType: "Sari-sari Store", leaderName: "Maria Santos" },
        { id: 2, name: "Tilik Poultry Raisers SLPA", barangay: "Tilik", livelihoodType: "Poultry Raising", leaderName: "Ramon Villanueva" }
    ]
};

const ASSOCIATION_1 = "Bagong Sikat Sari-sari Store SLPA";

const beneficiaries = [
    { id: 1, firstName: "Maria", middleName: null, lastName: "Santos", extensionName: null, barangay: "Bagong Sikat", associationId: 1, associationName: ASSOCIATION_1,
      livelihood: "Sari-sari Store", enrollmentStatus: "active", profileStatus: "draft", householdInformation: null, hasAccount: true },
    { id: 2, firstName: "Juan", middleName: null, lastName: "Dela Cruz", extensionName: null, barangay: "Bagong Sikat", associationId: 1, associationName: ASSOCIATION_1,
      livelihood: "Sari-sari Store", enrollmentStatus: "active", profileStatus: "draft", householdInformation: null, hasAccount: true },
    { id: 3, firstName: "Ana", middleName: null, lastName: "Reyes", extensionName: null, barangay: "Araw at Bituin", associationId: null, associationName: null,
      livelihood: "Food Vending", enrollmentStatus: "for_monitoring", profileStatus: "draft", householdInformation: null, hasAccount: false },
    { id: 5, firstName: "Liza", middleName: null, lastName: "Bautista", extensionName: null, barangay: "Bagong Sikat", associationId: 1, associationName: ASSOCIATION_1,
      livelihood: "Sari-sari Store", enrollmentStatus: "active", profileStatus: "draft", householdInformation: null, hasAccount: false }
];

const projects = [
    { id: 1, name: "Bagong Sikat Sari-sari Store", ownerName: "Maria Santos", associationName: ASSOCIATION_1, livelihood: "Sari-sari Store", status: "ongoing" },
    { id: 6, name: "Reyes Food Stall", ownerName: "Ana Reyes", associationName: null, livelihood: "Food Vending", status: "for_monitoring" }
];

const monitoring = [
    { id: 1, beneficiaryId: 1, beneficiaryName: "Maria Santos", visitDate: "2026-09-15", progress: "good", issue: null, recommendation: "Continue monitoring" },
    { id: 2, beneficiaryId: 3, beneficiaryName: "Ana Reyes", visitDate: "2026-09-18", progress: "needs_follow_up", issue: "Incomplete sales record", recommendation: "Submit updated record" }
];

const assistance = [
    { id: 1, beneficiaryId: 1, beneficiaryName: "Maria Santos", supportType: "livelihood_capital", releaseDate: "2026-08-20", amount: 10000 },
    { id: 2, beneficiaryId: 2, beneficiaryName: "Juan Dela Cruz", supportType: "training_support", releaseDate: "2026-08-28", amount: 5000 }
];

const reports = [
    { id: 1, reportType: "project", period: "August 2026", details: "Demo report.", status: "submitted", shared: true, createdAt: "2026-09-20 09:00:00" },
    { id: 2, reportType: "progress", period: "September 2026", details: "Demo report.", status: "submitted", shared: false, createdAt: "2026-09-21 09:00:00" },
    { id: 3, reportType: "status", period: "Q3 2026", details: "Demo report.", status: "for_review", shared: false, createdAt: "2026-09-22 09:00:00" }
];

const documents = [
    { id: 1, title: "Project Proposal - Sari-sari Store", category: "project", status: "approved", reviewNote: null, ownerName: ASSOCIATION_1, ownerBeneficiaryId: null, createdAt: "2026-09-12 10:00:00" },
    { id: 2, title: "Monthly Sales Record - September 2026", category: "progress", status: "returned", reviewNote: "Page 2 is missing. Send the complete record.", ownerName: ASSOCIATION_1, ownerBeneficiaryId: null, createdAt: "2026-09-25 14:00:00" },
    { id: 3, title: "Attendance Sheet - Poultry Training", category: "other", status: "for_review", reviewNote: null, ownerName: "Tilik Poultry Raisers SLPA", ownerBeneficiaryId: null, createdAt: "2026-10-01 09:30:00" },
    { id: 4, title: "Beneficiary Profile - Maria Santos", category: "profile", status: "approved", reviewNote: null, ownerName: "Maria Santos", ownerBeneficiaryId: 1, createdAt: "2026-09-10 08:30:00" }
];

const notifications = [
    { id: 1, title: "Monitoring Schedule", message: "Your field monitoring visit is scheduled.", recipientName: "Maria Santos", beneficiaryId: 1, createdAt: "2026-09-23 00:00:00", read: false },
    { id: 2, title: "Correction Request", message: "Your project record is incomplete. Please submit the missing pages.", recipientName: "Ana Reyes", beneficiaryId: 3, createdAt: "2026-09-22 00:00:00", read: false },
    { id: 3, title: "General Assembly & Program Orientation", message: "All SLP participants in Lubang are invited to the MSWDO Community Hall on Oct 10.", recipientName: null, beneficiaryId: null, createdAt: "2026-09-24 00:00:00", read: false }
];

const users = [
    { id: 1, username: "admin", role: "staff", name: "MSWDO Personnel", status: "active", beneficiaryId: null },
    { id: 2, username: "leader", role: "leader", name: "Maria Santos", status: "active", beneficiaryId: 1 },
    { id: 3, username: "member", role: "member", name: "Juan Dela Cruz", status: "active", beneficiaryId: 2 }
];

const ME = {
    staff:  { userId: 1, username: "admin",  role: "staff",  name: "MSWDO Personnel", beneficiaryId: null, associationId: null, associationName: null },
    leader: { userId: 2, username: "leader", role: "leader", name: "Maria Santos",    beneficiaryId: 1, associationId: 1, associationName: ASSOCIATION_1 },
    member: { userId: 3, username: "member", role: "member", name: "Juan Dela Cruz",  beneficiaryId: 2, associationId: 1, associationName: ASSOCIATION_1 }
};

const PROFILE = {
    leader: { firstName: "Maria", lastName: "Santos", municipality: "Lubang", province: "Occidental Mindoro" },
    member: { firstName: "Juan", lastName: "Dela Cruz", municipality: "Lubang", province: "Occidental Mindoro" }
};

function pick(records, ids) {
    return records.filter(record => ids.includes(record.id));
}

function snapshot(role) {
    const me = ME[role];
    const staff = role === "staff";
    const result = {
        ok: true,
        me,
        reference: { ...reference, associations: staff ? reference.associations : pick(reference.associations, [me.associationId]) },
        beneficiaries: staff ? beneficiaries : pick(beneficiaries, [me.beneficiaryId]),
        projects: staff ? projects : pick(projects, [1]),
        monitoring: staff ? monitoring : [],
        assistance: staff ? assistance : [],
        reports: staff ? reports : reports.filter(report => report.shared),
        documents: staff ? documents : documents.filter(doc => (doc.ownerName === ASSOCIATION_1 && doc.ownerBeneficiaryId === null) || doc.ownerBeneficiaryId === me.beneficiaryId),
        notifications: staff ? notifications : notifications.filter(n => n.beneficiaryId === null || n.beneficiaryId === me.beneficiaryId),
        users: staff ? users : [],
        profile: staff ? null : PROFILE[role]
    };
    return JSON.parse(JSON.stringify(result));
}

module.exports = { snapshot };
