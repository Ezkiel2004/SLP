SLP MONITORING SYSTEM - CLEAN BEGINNER VERSION
================================================

This version includes the changes requested:

1. Three login roles
   - MSWDO Personnel
   - Beneficiary Leader
   - Beneficiary Member

2. Login now uses a ROLE SELECTION dropdown instead of typing a username.

3. Beneficiary Leader and Beneficiary Member now use the SLP Eligibility
   Assessment and Profile Form supplied for this project when they open
   Manage Profile.

4. The profile form contains the main sections and fields from the supplied
   three-page SLP form, including:
   - Declaration and consent
   - Participant profile
   - Household composition
   - Income and expenses
   - Household vulnerability
   - Personnel-only eligibility assessment
   - Track selection
   - Reference slip information

5. The personnel-only section is read-only for beneficiary accounts.
   MSWDO/SLP personnel can later be given editing access when the system
   is connected to a real database.

6. All existing menus remain clickable.

FOLDER STRUCTURE
================

SLP_MSWDO_Monitoring_System/
|
|-- index.html
|
|-- README.txt
|
|-- css/
|     |-- style.css
|
|-- js/
      |-- script.js

DEMO LOGIN
==========

Type the username and password on the sign-in page (or choose a demo
account to fill them in). The accounts come from the demo database.

admin   / admin123    MSWDO Personnel
leader  / leader123   Maria Santos, association leader
member  / member123   Juan Dela Cruz, association member

IMPORTANT
=========

Data is kept in the MariaDB database slp_monitoring (XAMPP) through the
PHP API in api/. Install it once with:

    C:\xampp\php\php.exe database\install.php --demo

Sign-in, the records you see and staff saves (beneficiaries, projects,
monitoring, assistance, reports, notifications, accounts) are stored in
the database and survive a reload. Profile saves, document uploads and
the AA/AC/AF.1 tool saves are not connected yet and are lost on reload.

WHERE TO EDIT THE SYSTEM
========================

LOGIN
-----
Open js/script.js and look for:

1. DEMO USER ACCOUNTS
2. LOGIN

The login role options are in index.html under the login form.

SIDEBAR MENUS
-------------
Open js/script.js and find:

function createNavigation()

This function creates the menus for MSWDO Personnel and beneficiaries.

PAGE NAVIGATION
---------------
Find:

function showPage(pageName)

Add a new page title, description, and switch case here when adding a page.

BENEFICIARY PROFILE
-------------------
Find:

function profilePage()

This contains the HTML for the SLP profile form.

SAVE PROFILE
------------
Find:

function saveProfile()

This reads the form fields and saves them to browser memory.

PROFILE STARTING DATA
---------------------
Find:

const profileForms = {

The leader and member starting profile data are created here.

CSS FOR THE SLP FORM
--------------------
Open css/style.css and find:

21. PAGE: SLP ELIGIBILITY ASSESSMENT & PROFILE FORM

This section controls the appearance of the official-style profile form.

ADDING A NEW FIELD
==================

1. Add the property to createEmptyProfile() in js/script.js.
2. Add the input to profilePage().
3. Give the input a name that matches the property.
4. saveProfile() will automatically read it.

DEBUGGING TIPS
==============

If a button does not work:
1. Check its onclick="..." function name.
2. Search for that function in js/script.js.
3. Open the browser Developer Tools (F12).
4. Check the Console for JavaScript errors.

If a field does not save:
1. Make sure it has a name="...".
2. Make sure it has form="profileForm".
3. Make sure the same name exists in the profile object.

FUTURE PHP + MYSQL VERSION
===========================

Suggested structure:

project/
|
|-- index.html
|-- css/style.css
|-- js/script.js
|-- php/
|     |-- login.php
|     |-- profile.php
|     |-- beneficiaries.php
|     |-- monitoring.php
|     |-- assistance.php
|     |-- reports.php
|     |-- notifications.php
|     |-- accounts.php
|-- database/
      |-- schema.sql, seed-reference.sql, seed-demo.sql
      |-- install.php   (php database/install.php --demo)

The current HTML/CSS/JavaScript interface can be kept while PHP and MySQL
are added for real authentication, permanent records, file uploads,
notifications, and report generation.


IMPORTANT UPDATE
----------------
Login now uses a User Role dropdown instead of requiring the user to type a username. Select MSWDO Personnel, Beneficiary Leader, or Beneficiary Member, then enter that role's demo password.

Beneficiary Manage Profile now uses the SLP Eligibility Assessment and Profile Form structure supplied for this project, including all three form sections/pages, Items 1-29, household composition, income/expense fields, vulnerability assessment, and the SLP Personnel-only section. The personnel section is read-only when a beneficiary is logged in.


DESIGN SYSTEM (VERSION 2, OCTOBER 2026)
=======================================

The interface was redesigned as a single, accessible design system.

- Design rules, tokens, accessibility checklist and audit:  docs/DESIGN-SYSTEM.md
- Live component gallery:  http://localhost/SLP/docs/components.html
- Design tokens (colours, type, spacing):  css/tokens.css
- Official seal placeholder (replace the file):  assets/img/seal.svg

Build new pages from the components in js/script.js sections 7 and 8
(button, formField, modalForm, cardHeader, tableToolbar, dataTable,
statusBadge). Do not add inline style="" attributes.
