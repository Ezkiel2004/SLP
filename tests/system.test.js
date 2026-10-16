const test = require("node:test");
const assert = require("node:assert/strict");

// Set up mock DOM environment before loading or exercising script.js
class MockClassList {
    constructor() {
        this.classes = new Set();
    }
    add(...names) { names.forEach(n => this.classes.add(n)); }
    remove(...names) { names.forEach(n => this.classes.delete(n)); }
    toggle(name) {
        if (this.classes.has(name)) {
            this.classes.delete(name);
            return false;
        } else {
            this.classes.add(name);
            return true;
        }
    }
    contains(name) { return this.classes.has(name); }
}

class MockElement {
    constructor(tagName = "div", id = "") {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.name = "";
        this.value = "";
        this.type = "text";
        this.checked = false;
        this.disabled = false;
        this.readOnly = false;
        this.attributes = {};
        this.textContent = "";
        this.innerHTML = "";
        this.classList = new MockClassList();
        this.children = [];
        this.parentElement = null;
        this.listeners = {};
    }
    getAttribute(name) { return this.attributes[name]; }
    setAttribute(name, val) { this.attributes[name] = String(val); }
    hasAttribute(name) {
        if (name === "readonly") return !!this.readOnly;
        if (name === "disabled") return !!this.disabled;
        return name in this.attributes;
    }
    closest(selector) {
        if (selector === ".personnel-only-sheet") {
            let curr = this.parentElement;
            while (curr) {
                if (curr.classList && curr.classList.contains("personnel-only-sheet")) return curr;
                curr = curr.parentElement;
            }
        }
        return null;
    }
    addEventListener(evt, fn) {
        this.listeners[evt] = this.listeners[evt] || [];
        this.listeners[evt].push(fn);
    }
    dispatchEvent(evt) {
        const fns = this.listeners[evt.type] || [];
        fns.forEach(fn => fn(evt));
    }
    appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }
    remove() {
        if (this.parentElement) {
            this.parentElement.children = this.parentElement.children.filter(c => c !== this);
            this.parentElement = null;
        }
    }
    reset() {
        this.value = "";
    }
}

// Global DOM registry
const domRegistry = {};
function getOrCreateElement(id, tagName = "div") {
    if (!domRegistry[id]) {
        domRegistry[id] = new MockElement(tagName, id);
    }
    return domRegistry[id];
}

// Prepopulate standard elements
[
    "loginScreen", "app", "loginError", "loginForm", "username", "password",
    "logoutButton", "sidebar", "navigation", "userInfo", "pageContent", "pageTitle",
    "pageDescription", "notificationCount", "modal", "modalTitle", "modalContent",
    "mobileMenuButton", "userRoleBadge", "currentUserName", "currentUserRole",
    "profileForm", "beneficiaryFirstName", "beneficiaryLastName", "beneficiaryLocation",
    "beneficiaryLivelihood", "householdInformation", "beneficiaryStatus"
].forEach(id => getOrCreateElement(id));

globalThis.document = {
    getElementById(id) {
        return getOrCreateElement(id);
    },
    createElement(tag) {
        return new MockElement(tag);
    },
    querySelectorAll(selector) {
        const all = globalThis._profileInputs || [];
        if (selector.includes("[form='profileForm']")) {
            if (selector.startsWith("input[type='radio']")) {
                return all.filter(el => el.type === "radio");
            }
            if (selector.startsWith("input[type='checkbox']")) {
                return all.filter(el => el.type === "checkbox");
            }
            return all.filter(el => el.type !== "radio" && el.type !== "checkbox");
        }
        return [];
    },
    querySelector(selector) {
        return null;
    },
    body: new MockElement("body", "body")
};

// Require script.js after mock DOM setup
const app = require("../js/script.js");
const fixtures = require("./fixtures.js");
const fs = require("node:fs");
const path = require("node:path");

/* ---------- Fake server: fetch is stubbed per test; calls are recorded ---------- */

let fetchCalls = [];

function stubFetch(routes) {
    globalThis.fetch = async (url, options = {}) => {
        const body = options.body ? JSON.parse(options.body) : undefined;
        fetchCalls.push({ path: url, method: options.method || "GET", body, headers: options.headers || {} });
        const route = routes[url];
        const { status = 200, json = { ok: true } } = route ? await route(body) : { status: 404, json: { ok: false, error: "Not found" } };
        return { ok: status >= 200 && status < 300, status, json: async () => json };
    };
}

const CSRF = "c".repeat(64);

/* Sign in as "staff", "leader" or "member" against the fixture snapshot. */
async function signIn(role, snapshot = fixtures.snapshot(role), extraRoutes = {}) {
    stubFetch({
        "api/login.php": () => ({ json: { ok: true, me: snapshot.me, csrf: CSRF } }),
        "api/bootstrap.php": () => ({ json: snapshot }),
        "api/logout.php": () => ({ json: { ok: true } }),
        ...extraRoutes
    });
    fetchCalls = [];
    const signedIn = await app.loginUser(snapshot.me.username, "secret");
    assert.equal(signedIn, true, `sign-in as ${role} must succeed`);
    return snapshot;
}

function statValue(html, label) {
    const match = html.match(new RegExp(`${label}</p>\\s*<p class="stat__value[^"]*">([^<]*)</p>`));
    return match ? match[1] : null;
}


/* ---------- Security ---------- */

test("Security 1: Password is never stored on the session currentUser object", async () => {
    await signIn("staff");
    const user = app.getCurrentUser();
    assert.ok(user, "User session should exist");
    assert.equal(user.username, "admin");
    assert.equal(user.role, "MSWDO Personnel");
    assert.equal(user.password, undefined, "currentUser.password must not exist");
    assert.equal("password" in user, false, "password property must not exist on currentUser");

    for (const role of ["leader", "member"]) {
        await signIn(role);
        assert.equal(app.getCurrentUser().password, undefined);
        assert.equal("password" in app.getCurrentUser(), false);
    }
});

test("Security 2: Role authorization in showPage() prevents unauthorized page access", async () => {
    const pageContent = document.getElementById("pageContent");
    await signIn("member");

    const staffOnlyPages = ["beneficiaries", "monitoring", "assistance", "projects", "accounts"];
    for (const page of staffOnlyPages) {
        app.showPage(page);
        assert.ok(pageContent.innerHTML.includes("Access Denied"), `Beneficiary should be denied access to ${page}`);
        assert.ok(!pageContent.innerHTML.includes("Add New"), "Denied page must not render action buttons");
    }

    app.showPage("dashboard");
    assert.ok(pageContent.innerHTML.includes("Profile Status") || pageContent.innerHTML.includes("Documents"));
    app.showPage("profile");
    assert.ok(pageContent.innerHTML.includes("Manage Profile") || pageContent.innerHTML.includes("profileForm"));
    app.showPage("documents");
    assert.ok(pageContent.innerHTML.includes("Documents") || pageContent.innerHTML.includes("Upload Document"));
    app.showPage("reports");
    assert.ok(!pageContent.innerHTML.includes("Access Denied"), "Beneficiary should be allowed to view shared reports page");

    await signIn("staff");
    for (const page of staffOnlyPages) {
        app.showPage(page);
        assert.ok(!pageContent.innerHTML.includes("Access Denied"), `Staff should be allowed access to ${page}`);
    }
    app.showPage("profile");
    assert.ok(pageContent.innerHTML.includes("Access Denied"), "Staff should not view participant profile edit page");
    app.showPage("documents");
    assert.ok(pageContent.innerHTML.includes("Access Denied"), "Staff should not access participant personal documents page");
});

test("Participant dashboard: profile status and project status come from the snapshot", async () => {
    await signIn("member");
    const html = app.dashboardPage();
    assert.equal(statValue(html, "Profile Status"), "Draft", "Profile Status is the profile's status from the database");
    assert.equal(statValue(html, "Project Status"), "Ongoing", "Project Status is the status of the participant's project");
});

test("Security 3: Action functions enforce role restrictions", async () => {
    await signIn("member");
    const initialBeneficiaryCount = app.data.beneficiaries.length;
    getOrCreateElement("beneficiaryFirstName").value = "Hacker";
    getOrCreateElement("beneficiaryLastName").value = "User";
    getOrCreateElement("beneficiaryLocation").value = "Nowhere";
    getOrCreateElement("beneficiaryLivelihood").value = "Farming";
    getOrCreateElement("householdInformation").value = "None";
    await app.saveBeneficiary();
    assert.equal(app.data.beneficiaries.length, initialBeneficiaryCount, "Beneficiary must not be able to execute saveBeneficiary");
    assert.ok(!fetchCalls.some(call => call.path === "api/beneficiaries.php"), "No request may be sent for a forbidden save");

    await signIn("staff");
    const profilesBefore = JSON.stringify(app.profileForms);
    app.saveProfile();
    assert.equal(JSON.stringify(app.profileForms), profilesBefore, "Staff must not be able to execute saveProfile");
});

test("Security 4: Stored XSS prevention in beneficiary fields, tables, and modal onclick", async () => {
    const xssFirst = "Test <script>alert('xss')</script>";
    const xssLast = "Beneficiary');alert(1);//";
    const fullName = `${xssFirst} ${xssLast}`;
    const xssLocation = "Brgy <img src=x onerror=alert('loc')> Central";
    const xssLivelihood = "Retail & <b>Grocery</b> \"store\"";
    const xssHousehold = "4 members <script>stealCookies()</script>";
    const snapshot = fixtures.snapshot("staff");
    snapshot.beneficiaries.push({ id: 99, firstName: xssFirst, middleName: null, lastName: xssLast, extensionName: null, barangay: xssLocation,
        associationId: null, associationName: null, livelihood: xssLivelihood, enrollmentStatus: "active", profileStatus: "draft",
        householdInformation: xssHousehold, hasAccount: false });
    await signIn("staff", snapshot);

    const tableHTML = app.beneficiaryTable();
    assert.ok(!tableHTML.includes("<script>alert('xss')</script>"), "Raw script tag must not appear in table HTML");
    assert.ok(tableHTML.includes(app.escapeHTML(fullName)), "Table must contain escaped name");
    assert.ok(tableHTML.includes(app.escapeHTML(xssLocation)), "Table must contain escaped location");
    assert.ok(tableHTML.includes(app.escapeHTML(xssLivelihood)), "Table must contain escaped livelihood");

    app.viewBeneficiary("B-099");
    const modalContent = document.getElementById("modalContent").innerHTML;
    assert.ok(!modalContent.includes("<script>stealCookies()</script>"), "Raw script in household info must not appear in modal");
    assert.ok(modalContent.includes(app.escapeHTML(xssHousehold)), "Household info must be escaped in modal");
    assert.ok(modalContent.includes("openMonitoringForm('B-099')"), "openMonitoringForm must receive the display ID");
    assert.ok(!modalContent.includes(`openMonitoringForm('${fullName}')`), "openMonitoringForm must not use the raw name");
});

test("Medium Issue 1: Household information is saved and rendered properly", async () => {
    const householdInfo = "Single mother with 3 dependent school-age children, elderly grandmother";
    const snapshot = fixtures.snapshot("staff");
    snapshot.beneficiaries[0].householdInformation = householdInfo;
    await signIn("staff", snapshot);

    assert.equal(app.data.beneficiaries[0].householdInformation, householdInfo, "householdInformation comes through the snapshot");
    app.viewBeneficiary("B-001");
    const modalHTML = document.getElementById("modalContent").innerHTML;
    assert.ok(modalHTML.includes("Household Information"), "Modal should have Household Information section");
    assert.ok(modalHTML.includes(app.escapeHTML(householdInfo)), "Modal should display the saved household information");
});

test("Medium Issue 2: Expense labels are A through H and formula helper includes all 8 items", async () => {
    await signIn("member");
    const html = app.profilePage();
    for (const label of ["A. Housing", "B. Utilities", "C. Food", "D. Transportation", "E. Healthcare", "F. Education", "G. Childcare", "H. Others"]) {
        assert.ok(html.includes(label), `${label} must be present`);
    }
    assert.ok(!html.includes("C. Healthcare"), "Healthcare must not be labeled C");
    assert.ok(html.includes("(A+B+C+D+E+F+G+H)"), "Estimated monthly expense helper must include all labels (A+B+C+D+E+F+G+H)");
});

test("Medium Issue 3: Personnel read-only fields are isolated from profileForm and cannot be saved", async () => {
    await signIn("member");
    const html = app.profilePage();

    const personnelSheetMatch = html.match(/<div[^>]*class="[^"]*personnel-only-sheet[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(personnelSheetMatch, "personnel-only-sheet must exist in profilePage");
    assert.ok(!personnelSheetMatch[1].includes('form="profileForm"'), "No input within personnel-only-sheet should have form='profileForm'");
    assert.equal(html.match(/name="overallAssessment"[\s\S]*?form="profileForm"/), null, "Read-only overallAssessment radios must not have form='profileForm'");

    const field = (name, value, extra = {}) => Object.assign(new MockElement("input"), { name, value }, extra);
    globalThis._profileInputs = [
        field("street", "Rizal Street"),
        field("overallAssessment", "Qualified"),
        field("personnelVulnerabilityScore", "15"),
        field("referenceId2", "Hacked-Slip-2"),
        field("somePersonnelNote", "Should be ignored", { disabled: true })
    ];
    app.saveProfile();

    const savedProfile = app.profileForms.member;
    assert.ok(savedProfile, "Profile must be saved");
    assert.equal(savedProfile.street, "Rizal Street", "Authorized field street must be saved");
    assert.notEqual(savedProfile.overallAssessment, "Qualified", "Personnel field overallAssessment must not be modified by participant save");
    assert.notEqual(savedProfile.personnelVulnerabilityScore, "15", "Personnel field personnelVulnerabilityScore must not be modified by participant save");
    assert.equal(savedProfile.referenceId2, undefined, "Duplicate slip field referenceId2 must be rejected");
    assert.equal(savedProfile.somePersonnelNote, undefined, "Disabled/read-only input must be rejected");
    globalThis._profileInputs = [];
});

test("Low Issue 2: viewDocument does not shadow global DOM document", async () => {
    await signIn("member");
    app.data.documents = [{ name: "Barangay Clearance", type: "Profile", status: "For Review" }];
    assert.equal(typeof globalThis.document.getElementById, "function");
    app.viewDocument(0);
    assert.ok(document.getElementById("modalContent").innerHTML.includes("Barangay Clearance"));
    assert.equal(typeof globalThis.document.getElementById, "function", "DOM document must not be overwritten or shadowed");
});

test("Critical Fix 1: saveReport preserves reportPeriod and reportDetails without data loss", async () => {
    const snapshot = fixtures.snapshot("staff");
    await signIn("staff", snapshot, {
        "api/reports.php": body => {
            snapshot.reports.push({ id: 4, reportType: body.reportType, period: body.period, details: body.details, status: "for_review", shared: false, createdAt: "2026-10-15 09:00:00" });
            return { json: { ok: true, id: 4 } };
        }
    });
    getOrCreateElement("reportType").value = "progress";
    getOrCreateElement("reportPeriod").value = "Q3 2026";
    getOrCreateElement("reportDetails").value = "Livelihood enterprise sales rose 18% following grant disbursement.";
    await app.saveReport();

    const sent = fetchCalls.find(call => call.path === "api/reports.php").body;
    assert.equal(sent.period, "Q3 2026", "reportPeriod must be sent");
    assert.equal(sent.details, "Livelihood enterprise sales rose 18% following grant disbursement.", "reportDetails must be sent");

    app.viewReport("R-004");
    const modalContent = document.getElementById("modalContent").innerHTML;
    assert.ok(modalContent.includes("Q3 2026"), "viewReport modal must display coverage period");
    assert.ok(modalContent.includes("sales rose 18%"), "viewReport modal must display report details");
});

test("Critical Fix 2: saveNotification captures the recipient", async () => {
    await signIn("staff", fixtures.snapshot("staff"), { "api/notifications.php": () => ({ json: { ok: true, id: 9 } }) });
    getOrCreateElement("notificationTitle").value = "Confidential Casework Review";
    getOrCreateElement("notificationMessage").value = "Private case notes for Maria Santos.";
    getOrCreateElement("notificationRecipient").value = "1";
    await app.saveNotification();
    const sent = fetchCalls.find(call => call.path === "api/notifications.php").body;
    assert.equal(sent.beneficiaryId, 1, "The recipient (Maria Santos, beneficiary 1) must be sent");
    // Who may see it is enforced by the server: api/tests/api-check.php "send to one or to all".
});

test("Critical Fix 3: Staff can review and approve beneficiary compliance documents in viewBeneficiary", async () => {
    await signIn("staff");
    const targetBeneficiary = app.data.beneficiaries[0];
    app.data.documents.push({ name: "Barangay Business Permit", type: "Compliance", status: "For Review", beneficiary: targetBeneficiary.name });

    app.viewBeneficiary(targetBeneficiary.id);
    const modalContent = document.getElementById("modalContent").innerHTML;
    assert.ok(modalContent.includes("Barangay Business Permit"), "viewBeneficiary must list submitted documents");
    assert.ok(modalContent.includes("approveDocument"), "viewBeneficiary must provide document approval action for For Review items");

    app.approveDocument("Barangay Business Permit", targetBeneficiary.id);
    assert.equal(app.data.documents.find(d => d.name === "Barangay Business Permit").status, "Approved", "Document status must be updated to Approved");
});

test("Medium Fix: saveAccount creates an account", async () => {
    await signIn("staff", fixtures.snapshot("staff"), { "api/accounts.php": () => ({ json: { ok: true, id: 4 } }) });
    getOrCreateElement("newAccountFor").value = "staff";
    getOrCreateElement("newUsername").value = "pdo_officer";
    getOrCreateElement("newPassword").value = "securepass123";
    getOrCreateElement("newFullName").value = "Carla Mendoza";
    await app.saveAccount();
    assert.deepEqual(fetchCalls.find(call => call.path === "api/accounts.php").body,
        { accountType: "staff", fullName: "Carla Mendoza", username: "pdo_officer", password: "securepass123" });
    // Signing in with the new account is checked against the server: api-check "account create".
});

test("Monitoring tools: AA and AC for leaders, AF.1 for staff, rendered from the official forms", async () => {
    const pageContent = document.getElementById("pageContent");
    const tools = Object.keys(app.MONITORING_TOOLS);
    assert.deepEqual(tools, ["mdmonitoring", "orgassessment", "usbongassessment"]);
    const owners = { leader: ["mdmonitoring", "orgassessment"], staff: ["usbongassessment"], member: [] };
    const expected = {
        mdmonitoring: ["MD MONITORING TOOL (ASSOCIATION)", "I.4 Financial Stability and Savings", "14 and below"],
        orgassessment: ["ORGANIZATION ASSESSMENT TOOL", "B.7.1 Community Impact", "34—50"],
        usbongassessment: ["MICROENTERPRISE DEVELOPMENT (MD) USBONG ASSESSMENT TOOL", "Total SLP Association Score", "Sibol Implementation Phase"]
    };

    for (const role of Object.keys(owners)) {
        await signIn(role);
        for (const page of tools) {
            const owned = owners[role].includes(page);
            app.showPage(page);
            const html = pageContent.innerHTML;
            assert.equal(html.includes("Access Denied"), !owned, `${role} ${owned ? "must open" : "must be denied"} ${page}`);
            if (owned) {
                assert.ok(html.includes(app.MONITORING_TOOLS[page].pdf), `${page} must offer its blank PDF for download`);
                for (const text of expected[page]) assert.ok(html.includes(text), `${page} must include "${text}"`);
            }
            app.toolForms[page] = { sentinel: "unchanged" };
            app.saveTool(page);
            assert.equal(app.toolForms[page].sentinel === undefined, owned, `${role} ${owned ? "must" : "must not"} be able to save ${page}`);
        }
    }
});


/* ---------- Sign-in, session and the snapshot (wiring part A, Task 5) ---------- */

test("applySnapshot maps codes to labels and display ids", () => {
    app.applySnapshot(fixtures.snapshot("staff"));
    const first = app.data.beneficiaries[0];
    assert.deepEqual([first.id, first.status, first.location], ["B-001", "Active", "Bagong Sikat"]);
    assert.equal(app.data.assistance[0].amount, "₱10,000");
    assert.equal(app.data.reports[0].type, "Project Report");
    assert.equal(app.data.notifications.find(n => n.dbId === 3).recipient, "All Beneficiaries");
});

test("getCurrentBeneficiary uses the signed-in beneficiary", async () => {
    await signIn("member");
    assert.equal(app.getCurrentBeneficiary().name, "Juan Dela Cruz");
    assert.equal(app.getCurrentProfile().firstName, "Juan");
});

test("failed sign-in shows the server message", async () => {
    stubFetch({ "api/login.php": () => ({ status: 401, json: { ok: false, error: "Wrong username or password." } }) });
    const signedIn = await app.loginUser("leader", "wrong");
    assert.equal(signedIn, false);
    assert.equal(document.getElementById("loginError").textContent, "Wrong username or password.");
});

test("sign-in sends no CSRF header but later posts do", async () => {
    await signIn("member");
    const login = fetchCalls.find(call => call.path === "api/login.php");
    assert.equal(login.headers["X-CSRF-Token"], undefined, "the sign-in request has no token yet");
    await app.api("api/logout.php", {});
    assert.equal(fetchCalls[fetchCalls.length - 1].headers["X-CSRF-Token"], CSRF, "later posts send the token from the sign-in response");
});

test("a 401 signs the user out", async () => {
    await signIn("member");
    stubFetch({ "api/bootstrap.php": () => ({ status: 401, json: { ok: false, error: "Your session has ended. Sign in again." } }) });
    await assert.rejects(app.loadData());
    assert.equal(app.getCurrentUser(), null);
    assert.ok(document.getElementById("loginNotice").innerHTML.includes("no activity for 15 minutes"), "the timeout notice must show");
});

test("network failure keeps the form open", async () => {
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(app.api("api/bootstrap.php"), error =>
        error instanceof app.ApiError && error.status === 0 && error.message === "Cannot reach the server. Check your connection and try again.");
});

test("client holds no passwords", () => {
    const source = fs.readFileSync(path.join(__dirname, "../js/script.js"), "utf8");
    for (const password of ["admin123", "leader123", "member123"]) {
        assert.ok(!source.includes(password), `js/script.js must not contain ${password}`);
    }
});

test("each save sends its payload", async () => {
    const cases = [
        ["saveBeneficiary", "api/beneficiaries.php",
            { beneficiaryFirstName: "Rosa", beneficiaryLastName: "Lim", beneficiaryBarangay: "15", beneficiaryAssociation: "2", householdInformation: "Household of 3" },
            { firstName: "Rosa", lastName: "Lim", barangayId: 15, associationId: 2, householdInformation: "Household of 3" }],
        ["saveProject", "api/projects.php",
            { projectName: "Tilik Egg Store", projectOwner: "a:2", projectLivelihood: "2", projectStatus: "ongoing" },
            { name: "Tilik Egg Store", associationId: 2, beneficiaryId: null, livelihoodTypeId: 2, status: "ongoing" }],
        ["saveMonitoring", "api/monitoring.php",
            { monitoringBeneficiary: "1", monitoringDate: "2026-10-01", monitoringProgress: "good", monitoringIssue: "", monitoringRecommendation: "Keep records" },
            { beneficiaryId: 1, visitDate: "2026-10-01", progress: "good", issue: "", recommendation: "Keep records" }],
        ["saveAssistance", "api/assistance.php",
            { assistanceRecipient: "2", assistanceType: "equipment", assistanceDate: "2026-10-01", assistanceAmount: "₱5,000.50" },
            { beneficiaryId: 2, supportType: "equipment", releaseDate: "2026-10-01", amount: "5000.50" }],
        ["saveReport", "api/reports.php",
            { reportType: "progress", reportPeriod: "October 2026", reportDetails: "Done" },
            { reportType: "progress", period: "October 2026", details: "Done" }],
        ["saveNotification", "api/notifications.php",
            { notificationRecipient: "", notificationTitle: "Hello", notificationMessage: "All welcome" },
            { action: "send", beneficiaryId: null, title: "Hello", message: "All welcome" }],
        ["saveAccount", "api/accounts.php",
            { newAccountFor: "5", newFullName: "", newUsername: "liza", newPassword: "securepass123" },
            { accountType: "participant", beneficiaryId: 5, username: "liza", password: "securepass123" }]
    ];
    for (const [save, path, fields, expected] of cases) {
        await signIn("staff", fixtures.snapshot("staff"), { [path]: () => ({ json: { ok: true, id: 7 } }) });
        for (const [id, value] of Object.entries(fields)) getOrCreateElement(id).value = value;
        await app[save]();
        const index = fetchCalls.findIndex(call => call.path === path);
        assert.ok(index >= 0, `${save} must POST to ${path}`);
        assert.deepEqual(fetchCalls[index].body, expected, `${save} payload`);
        assert.ok(fetchCalls.slice(index + 1).some(call => call.path === "api/bootstrap.php"), `${save} must reload the snapshot`);
    }
});

test("server error keeps the modal open", async () => {
    await signIn("staff", fixtures.snapshot("staff"), {
        "api/beneficiaries.php": () => ({ status: 422, json: { ok: false, error: "Choose a valid barangay." } })
    });
    app.openBeneficiaryForm();
    await app.saveBeneficiary();
    assert.ok(!document.getElementById("modal").classList.contains("hidden"), "the modal must stay open");
    const toasts = document.getElementById("toastRegion").children;
    assert.ok(toasts[toasts.length - 1].innerHTML.includes("Choose a valid barangay."), "the server's message must show");
});

test("confirm button is disabled while saving", async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    await signIn("staff", fixtures.snapshot("staff"), {
        "api/beneficiaries.php": async () => { await pending; return { status: 422, json: { ok: false, error: "Choose a valid barangay." } }; }
    });
    const confirm = document.getElementById("confirmButton");
    const saving = app.saveBeneficiary();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(confirm.disabled, true, "the confirm button must be disabled while the request is pending");
    release();
    await saving;
    assert.equal(confirm.disabled, false, "the confirm button must be enabled again after an error");
});

test("mark as read sends the notification id", async () => {
    await signIn("staff", fixtures.snapshot("staff"), { "api/notifications.php": () => ({ json: { ok: true } }) });
    const id = app.data.notifications[0].dbId;
    await app.markNotificationAsRead(0);
    assert.deepEqual(fetchCalls.find(call => call.path === "api/notifications.php").body, { action: "read", id });
});
