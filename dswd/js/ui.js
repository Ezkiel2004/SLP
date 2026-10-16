/* DSWD design system behaviours: mobile menu, tabs, modal opening.
   Load with <script src="js/ui.js" defer>. No dependencies.
   The accordion is a native <details> element and needs no script.
   Everything here only enhances: the page stays usable if it never runs.
   A missing element (a typo in aria-controls, a toggle outside a <header>)
   skips that one behaviour instead of stopping the rest. */

/* Mark the page as scripted. CSS collapses the mobile nav only after this runs. */
document.documentElement.classList.add("js");

/* Mobile menu. aria-expanded on the toggle is the only state; CSS shows or hides
   the nav that follows it. Escape closes the menu while focus is in the header. */
document.querySelectorAll(".menu-toggle").forEach((toggle) => {
    const setOpen = (open) => toggle.setAttribute("aria-expanded", String(open));
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    toggle.closest("header")?.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
            setOpen(false);
            toggle.focus();
        }
    });
});

/* Tabs: WAI-ARIA tabs pattern with automatic activation. Only the selected tab is
   in the Tab order; Left/Right arrows, Home and End move between enabled tabs. */
document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const enabled = tabs.filter((tab) => tab.getAttribute("aria-disabled") !== "true");
    const select = (selected) => tabs.forEach((tab) => {
        const on = tab === selected;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(tab.getAttribute("aria-controls") || "");
        if (panel) panel.hidden = !on;
    });
    list.addEventListener("click", (event) => {
        const tab = event.target.closest('[role="tab"]');
        if (enabled.includes(tab)) select(tab);
    });
    list.addEventListener("keydown", (event) => {
        const i = enabled.indexOf(document.activeElement);
        const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: enabled.length - 1 }[event.key];
        if (i < 0 || next === undefined) return;
        event.preventDefault();
        const tab = enabled[(next + enabled.length) % enabled.length];
        tab.focus();
        select(tab);
    });
    select(tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || enabled[0]);
});

/* Modal: native <dialog>. A button with data-modal-open="id" opens it, and a click
   on the backdrop (the dialog element itself) closes it, but only when the press
   also started there, so selecting text and releasing outside keeps it open.
   returnValue is cleared on each opening so an old answer is never read twice.
   The browser does the rest. */
document.querySelectorAll("[data-modal-open]").forEach((button) => {
    const dialog = document.getElementById(button.dataset.modalOpen);
    if (!dialog) return;
    button.addEventListener("click", () => {
        dialog.returnValue = "";
        dialog.showModal();
    });
});
document.querySelectorAll("dialog.modal").forEach((dialog) => {
    let pressedBackdrop = false;
    dialog.addEventListener("pointerdown", (event) => {
        pressedBackdrop = event.target === dialog;
    });
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog && pressedBackdrop) dialog.close();
    });
});
