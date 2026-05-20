let allRequestsData = [];


const supabaseClient = window.supabaseClient;
let currentAdmin = null;
let currentCalendarDate = new Date();
let pendingDeclineId = null;



// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify Admin Authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        console.error('Not authenticated:', authError?.message);
        // From:

        // To:
        window.location.href = 'login.html';;
        return;
    }

    /// 2. Check if user is actually an Admin
    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('full_name, user_type')
        .eq('id', user.id)
        .single();

    console.log("DEBUG - Profile Data:", profile); // You can remove this after testing
    console.log("DEBUG - User Type:", profile?.user_type); // You can remove this after testing

    if (profileError) {
        console.error("Error loading profile:", profileError.message);

        showModal({
            title: "System Error",
            message: "Could not load profile data. You will be redirected to login.",
            buttons: [
                {
                    text: "OK",
                    className: "px-4 py-2 bg-red-600 text-white rounded",
                    onClick: () => {
                        window.location.href = 'login.html';
                    }
                }
            ]
        });

        return;
    }

    if (!profile || profile.user_type.trim().toLowerCase() !== 'admin') {

        showModal({
            title: "Access Denied",
            message: "Admin privileges are required to access this page.",
            buttons: [
                {
                    text: "Back to Login",
                    className: "px-4 py-2 bg-red-600 text-white rounded",
                    onClick: () => {
                        window.location.href = 'login.html';
                    }
                }
            ]
        });

        return;
    }

    // If we reach here — it IS an admin
    currentAdmin = profile;
    document.getElementById('admin-name-sidebar').textContent = profile.full_name;
    console.log("✅ Admin access granted");



    currentAdmin = profile;
    document.getElementById('admin-name-sidebar').textContent = profile.full_name;

    // 3. Navigation Events //
    // CLEAR ALL TABLE CONTENT WHEN SWITCHING PAGE
    document.querySelectorAll('tbody').forEach(tb => {
        if (tb.id === 'all-leave-requests-body') {
            tb.innerHTML = '';
        }
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            const pageId = e.currentTarget.getAttribute('href').substring(1);
            showAdminPage(pageId);
        });
    });

    document.getElementById('admin-logout').addEventListener('click', handleLogout);

    // 4. Modal Actions
    document.getElementById('cancel-decline').addEventListener('click', () => {
        document.getElementById('decline-modal').classList.add('hidden');
        pendingDeclineId = null;
    });

    document.getElementById('confirm-decline').addEventListener('click', handleDeclineRequest);

    // 5. Calendar Controls
    document.getElementById('prev-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderLeaveCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderLeaveCalendar();
    });

    // 6. Search & Filters
    document.getElementById('search-leave-employee').addEventListener('input', filterEmployeeSummary);
    document.getElementById('search-summary-employee').addEventListener('input', filterEmployeeSummary);
    document.getElementById('filter-month').addEventListener('change', filterEmployeeSummary);
    document.getElementById('filter-year').addEventListener('change', filterEmployeeSummary);

    // 7. Report Actions
    document.getElementById('generate-report').addEventListener('click', loadReportData);
    document.getElementById('export-pdf').addEventListener('click', exportAsPDF);
    document.getElementById('export-excel').addEventListener('click', exportAsExcel);

    // SEARCH & FILTERS
    document.getElementById('search-leave-employee').addEventListener('input', applyFilters);

    document.getElementById('search-summary-employee').addEventListener('input', applyFilters);

    document.getElementById('filter-start-date').addEventListener('change', applyFilters);

    document.getElementById('filter-end-date').addEventListener('change', applyFilters);




    // CLEAR FILTERS
    document.getElementById('clear-filters').addEventListener('click', () => {

        document.getElementById('search-leave-employee').value = "";

        document.getElementById('search-summary-employee').value = "";

        document.getElementById('filter-start-date').value = "";

        document.getElementById('filter-end-date').value = "";

        renderRequestsTable(allRequestsData);

    });


    function showConfirmModal(title, message, onConfirm) {
        document.getElementById("confirm-title").textContent = title;
        document.getElementById("confirm-message").textContent = message;

        const modal = document.getElementById("confirm-modal");
        modal.classList.remove("hidden");
        modal.classList.add("flex");

        confirmCallback = onConfirm;
    }

    // ======================================
    // EXPORT EXCEL REPORT
    // SAME DESIGN AS FASHS TRACKER
    // ======================================

    function mapLeaveCode(type) {
        switch (type) {
            case "VL": return "VL";
            case "VL1": return "VL1";
            case "VL2": return "VL2";
            case "SL": return "SL";
            case "SL1": return "SL1";
            case "SL2": return "SL2";
            case "ML": return "ML";
            case "VL-D": return "VL-D";
            case "SL-D": return "SL-D";
            default: return "";
        }
    }

    function createLeaveCounter() {
        return {
            totalAbsence: 0,
            VL: 0,
            VL1: 0,
            VL2: 0,
            SL: 0,
            SL1: 0,
            SL2: 0,
            ML: 0,
            VL_D: 0,
            SL_D: 0
        };
    }

    function normalizeLeaveType(type) {
        return type.replace("-", "_");
    }

    async function exportAsExcel() {

        const month = document.getElementById("report-month").value;
        const year = document.getElementById("report-year").value;
        const monthName = getMonthName(month);
        const employeeStats = {};

        const { data: employees, error: empError } = await supabaseClient
            .from('profiles')
            .select('id, full_name')
            .eq('employee_status', 'active');


        if (empError) {
            console.error(empError);
            alert("Failed to load employees");
            return;
        }

        const employeeMap = {};

        employees.forEach(emp => {
            employeeMap[emp.id] = emp.full_name;
        });


        // ======================================
        // CREATE WORKBOOK
        // ======================================
        const workbook = XLSX.utils.book_new();
        let sheetData = [];

        // ======================================
        // TITLE (Updated to show Month and Year)

        sheetData.push(["", "", "", "", "", `${monthName} ${year}`]);

        // ======================================
        // HEADER ROWS
        // ======================================
        let dayNameRow = ["Employee"];
        let dateRow = [""];

        const totalDays = new Date(year, month, 0).getDate();
        const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        for (let d = 1; d <= totalDays; d++) {
            const currentDate = new Date(year, month - 1, d);
            dayNameRow.push(weekdays[currentDate.getDay()]);
            dateRow.push(d);
        }

        // SUMMARY COLUMNS (UPDATED)
        dayNameRow.push(
            "Total Absence Days",
            "Vacation Leave Days",
            "Sick Leave Days",
            "Maternity/Paternity",
            "Vacation Leave (Division Office)",
            "Sick Leave (Division Office)"
        );

        dateRow.push("", "", "", "", "", "");

        sheetData.push(dayNameRow);
        sheetData.push(dateRow);

        // ======================================
        // EMPLOYEE ROWS
        // ======================================
        reportData.forEach(leave => {
            const name = leave.profiles?.full_name;
            if (!name) return;

            if (!employeeStats[name]) {
                employeeStats[name] = createLeaveCounter();
            }

            const stats = employeeStats[name];

            const leaveType = normalizeLeaveType(leave.leave_type);
            const days = calculateDays(leave.start_date, leave.end_date);

            // total absence always increases
            stats.totalAbsence += days;

            switch (leaveType) {
                case "VL":
                    stats.VL += days;
                    break;

                case "VL1":
                    stats.VL1 += days;
                    stats.VL += days;
                    break;

                case "VL2":
                    stats.VL2 += days;
                    stats.VL += days;
                    break;

                case "SL":
                    stats.SL += days;
                    break;

                case "SL1":
                    stats.SL1 += days;
                    stats.SL += days;
                    break;

                case "SL2":
                    stats.SL2 += days;
                    stats.SL += days;
                    break;

                case "ML":
                    stats.ML += days;
                    break;

                case "VL_D":
                    stats.VL_D += days;
                    break;

                case "SL_D":
                    stats.SL_D += days;
                    break;
            }
        });


        const rows = employees;

        employees.forEach(emp => {

            const employee = emp.full_name;
            let employeeRow = [employee];

            // fill calendar
            for (let d = 1; d <= totalDays; d++) {
                employeeRow.push("");
            }

            // get all leaves of THIS employee
            const empLeaves = reportData.filter(r => r.profiles?.full_name === employee);

            empLeaves.forEach(leave => {

                const startDate = new Date(leave.start_date);
                const startDay = startDate.getDate();
                const totalLeaveDays = calculateDays(leave.start_date, leave.end_date);

                let leaveCode = mapLeaveCode(leave.leave_type);

                for (let i = 0; i < totalLeaveDays; i++) {
                    employeeRow[startDay + i] = leaveCode;
                }
            });

            // push summary (temporary fix for now)
            const stats = employeeStats[emp.full_name] || createLeaveCounter();

            employeeRow.push(
                stats.totalAbsence,
                stats.VL,
                stats.SL,
                stats.ML,
                stats.VL_D,
                stats.SL_D
            );

            sheetData.push(employeeRow);
        });

        // ======================================
        // CREATE SHEET
        // ======================================
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

        // ======================================
        // COLUMN WIDTHS (UPDATED for 2 extra columns)
        // ======================================
        worksheet["!cols"] = [
            { wch: 35 },
            ...Array(totalDays).fill({ wch: 5 }),
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 15 },
            { wch: 20 },
            { wch: 20 }
        ];

        // ======================================
        // MERGE TITLE (UPDATED range)
        // ======================================
        worksheet["!merges"] = [
            {
                s: { r: 0, c: 0 },
                e: { r: 0, c: totalDays + 6 }
            }
        ];

        // ======================================
        // COLORS (UPDATED PALETTE)
        // ======================================
        const greenHeader = "00B050";   // Vacation Leave (Full Day)
        const lightGreen = "92D050";    // Vacation Leave (Partial)
        const blue = "00B0F0";          // Sick Leave (Full Day)
        const lightBlue = "9BC2E6";     // Sick Leave (Partial)
        const orange = "F4B183";        // Maternity/Paternity
        const darkOrange = "ED7D31";    // Vacation Leave filed to Division Office
        const purple = "7030A0";        // Sick Leave filed to Division Office
        const white = "FFFFFF";

        // ======================================
        // STYLE CELLS (UPDATED)
        // ======================================
        // ======================================
        // STYLE CELLS (Text color changed to black)
        // ======================================
        const range = XLSX.utils.decode_range(worksheet['!ref']);

        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                if (!worksheet[cellAddress]) continue;

                // DEFAULT STYLE
                worksheet[cellAddress].s = {
                    font: {
                        bold: true,
                        color: { rgb: "000000" }   // ✅ text is now black
                    },
                    alignment: {
                        horizontal: "center",
                        vertical: "center",
                        wrapText: true
                    },
                    border: {
                        top: { style: "thin" },
                        bottom: { style: "thin" },
                        left: { style: "thin" },
                        right: { style: "thin" }
                    },
                    fill: {
                        fgColor: { rgb: lightGreen }
                    }
                };

                // Title row
                if (R === 0) {
                    worksheet[cellAddress].s = {
                        font: {
                            bold: true,
                            sz: 18,
                            color: { rgb: "000000" } // ✅ Title text also black
                        },
                        alignment: { horizontal: "center" }
                    };
                }

                // Employee header
                if ((R === 1 || R === 2) && C === 0) {
                    worksheet[cellAddress].s.fill = { fgColor: { rgb: greenHeader } };
                }

                // Day headers
                if ((R === 1 || R === 2) && C > 0 && C <= totalDays) {
                    worksheet[cellAddress].s.fill = { fgColor: { rgb: lightGreen } };
                    worksheet[cellAddress].s.font.color = { rgb: "000000" }; // ✅ Black text
                }

                // Total Absence Days
                if (C === totalDays + 1) {
                    worksheet[cellAddress].s.fill = { fgColor: { rgb: greenHeader } };
                }

                // Vacation Leave Days
                if (C === totalDays + 2) {
                    worksheet[cellAddress].s.fill = { fgColor: { rgb: lightGreen } };
                }

                // Sick Leave Days
                if (C === totalDays + 3) {
                    worksheet[cellAddress].s.fill = { fgColor: { rgb: blue } };
                }

                // Maternity/Paternity
                if (C === totalDays + 4) {
                    worksheet[cellAddress].s.fill = { fgColor: { rgb: orange } };
                }

                // Vacation Leave filed to Division Office
                if (C === totalDays + 5) {
                    worksheet[cellAddress].s.fill = { fgColor: { rgb: darkOrange } };
                }

                // Sick Leave filed to Division Office
                if (C === totalDays + 6) {
                    worksheet[cellAddress].s.fill = { fgColor: { rgb: purple } };
                }

                // Employee names column
                if (R >= 3 && C === 0) {
                    worksheet[cellAddress].s.fill = { fgColor: { rgb: greenHeader } };
                }
            }
        }

        // ======================================
        // ADD SHEET
        // ======================================
        XLSX.utils.book_append_sheet(workbook, worksheet, monthName);

        // ======================================
        // DOWNLOAD
        // ======================================
        XLSX.writeFile(workbook, `FASHS-Leave-Tracker-${monthName}-${year}.xlsx`);
    }

    // ======================================
    // GET MONTH NAME
    // ======================================
    function getMonthName(month) {
        const months = {
            "01": "January", "02": "February", "03": "March", "04": "April",
            "05": "May", "06": "June", "07": "July", "08": "August",
            "09": "September", "10": "October", "11": "November", "12": "December"
        };
        return months[month];
    }

    // 8. Load Default Page
    showAdminPage('admin-dashboard');

});

// --- PAGE NAVIGATION ---
function showAdminPage(pageId) {
    // Clear leave table when leaving page
    const tbody = document.getElementById('all-leave-requests-body');
    if (tbody) tbody.innerHTML = '';
    // Hide all sections

    document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
    // Show selected section
    document.getElementById(`${pageId}-content`).classList.remove('hidden');

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('bg-gray-700'));
    const activeLink = document.querySelector(`a[href="#${pageId}"]`);
    if (activeLink) activeLink.classList.add('bg-gray-700');


    // Update page title
    const titles = {
        'admin-dashboard': 'Admin Dashboard',
        'leave-requests': 'Manage Leave Requests',
        'employee-summary': 'Employee Leave Summary',
        'leave-calendar': 'Leave Calendar',
        'reports': 'Generate Reports'
    };
    document.getElementById('page-title').textContent = titles[pageId];

    // Load data for page
    switch (pageId) {
        case 'admin-dashboard': loadAdminDashboard(); break;
        case 'leave-requests': loadAllLeaveRequests(); break;
        case 'employee-summary': loadEmployeeSummary(); break;
        case 'leave-calendar': renderLeaveCalendar(); break;
        case 'employee-management': loadEmployees(); break;
    }


}

//--load employee section--//
async function loadEmployees() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select(`
            id,
            full_name,
            department,
            employee_status
        `)
        .order('full_name', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    renderEmployeeTable(data);
}

function renderEmployeeTable(data) {
    const tbody = document.getElementById('employee-management-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    data.forEach(emp => {

        const status = emp.employee_status || 'active';

        const tr = document.createElement('tr');
        tr.id = `emp-${emp.id}`;

        let buttons = '';

        if (status === "active") {
            buttons = `
                <button onclick="setEmployeeInactive('${emp.id}')"
                    class="bg-gray-600 text-white text-xs px-3 py-1 rounded">
                    Set Inactive
                </button>
            `;
        }

        else if (status === "inactive") {
            buttons = `
                <button onclick="archiveEmployee('${emp.id}')"
                    class="bg-blue-600 text-white text-xs px-3 py-1 rounded">
                    Archive
                </button>

                <button onclick="deleteEmployee('${emp.id}')"
                    class="bg-black text-white text-xs px-3 py-1 rounded">
                    Delete
                </button>

                <button onclick="restoreEmployee('${emp.id}')"
                    class="bg-green-600 text-white text-xs px-3 py-1 rounded">
                    Cancel
                </button>
            `;
        }

        else if (status === "archived") {
            buttons = `
                <button onclick="restoreEmployee('${emp.id}')"
                    class="bg-green-600 text-white text-xs px-3 py-1 rounded">
                    Restore
                </button>

                <button onclick="deleteEmployee('${emp.id}')"
                    class="bg-black text-white text-xs px-3 py-1 rounded">
                    Delete Permanently
                </button>
            `;
        }

        tr.innerHTML = `
            <td class="px-3 py-2">${emp.full_name}</td>
            <td class="px-3 py-2">${emp.department || '-'}</td>
            <td class="px-3 py-2">${getEmployeeStatusBadge(status)}</td>
            <td class="px-3 py-2 text-right">
                <div class="flex gap-2 justify-end">
                    ${buttons}
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}



function getEmployeeStatusBadge(status) {
    const s = status || 'active';

    if (s === "active") {
        return `<span class="bg-green-100 text-green-700 px-2 py-1 text-xs rounded">Active</span>`;
    }

    if (s === "inactive") {
        return `<span class="bg-gray-200 text-gray-700 px-2 py-1 text-xs rounded">Inactive</span>`;
    }

    if (s === "archived") {
        return `<span class="bg-blue-100 text-blue-700 px-2 py-1 text-xs rounded">Archived</span>`;
    }

    return `<span class="bg-gray-100 text-gray-600 px-2 py-1 text-xs rounded">${s}</span>`;
}


async function updateEmployeeStatus(userId, newStatus) {

    if (!confirm(`Are you sure you want to set this employee as ${newStatus}?`)) {
        return;
    }

    const { error } = await supabaseClient
        .from('profiles')
        .update({
            employee_status: newStatus
        })
        .eq('id', userId);

    if (error) {
        showModal({
            title: "Error",
            message: error.message,
            buttons: [{ text: "Close" }]
        });
        return;
    }

    showModal({
        title: "Success",
        message: "Employee status updated successfully.",
        buttons: [{ text: "OK" }]
    });

    const row = document.getElementById(`emp-${userId}`);
    if (row) row.remove();
}

async function setEmployeeInactive(id) {

    const { error } = await supabaseClient
        .from('profiles')
        .update({ employee_status: 'inactive' })
        .eq('id', id);

    if (error) {

        showModal({
            title: "Update Failed",
            message: error.message,
            buttons: [
                {
                    text: "Close",
                    className: "px-4 py-2 bg-red-600 text-white rounded"
                }
            ]
        });

        return;
    }

    showModal({
        title: "Success",
        message: "Employee has been set to inactive.",
        buttons: [
            {
                text: "OK",
                className: "px-4 py-2 bg-blue-600 text-white rounded",
                onClick: () => {
                    loadEmployees();
                }
            }
        ]
    });
}

async function archiveEmployee(id) {

    const { error } = await supabaseClient
        .from('profiles')
        .update({ employee_status: 'archived' })
        .eq('id', id);

    if (error) {

        showModal({
            title: "Archive Failed",
            message: error.message,
            buttons: [
                {
                    text: "Close",
                    className: "px-4 py-2 bg-red-600 text-white rounded"
                }
            ]
        });

        return;
    }

    showModal({
        title: "Employee Archived",
        message: "The employee has been archived successfully.",
        buttons: [
            {
                text: "OK",
                className: "px-4 py-2 bg-blue-600 text-white rounded",
                onClick: () => {
                    loadEmployees();
                }
            }
        ]
    });
}

async function restoreEmployee(id) {

    const { error } = await supabaseClient
        .from('profiles')
        .update({ employee_status: 'active' })
        .eq('id', id);

    if (error) {

        showModal({
            title: "Restore Failed",
            message: error.message,
            buttons: [
                {
                    text: "Close",
                    className: "px-4 py-2 bg-red-600 text-white rounded"
                }
            ]
        });

        return;
    }

    showModal({
        title: "Employee Restored",
        message: "The employee has been restored successfully.",
        buttons: [
            {
                text: "OK",
                className: "px-4 py-2 bg-blue-600 text-white rounded",
                onClick: () => {
                    loadEmployees();
                }
            }
        ]
    });
}

async function deleteEmployee(id) {

    showModal({
        title: "Confirm Deletion",
        message: "Are you sure you want to permanently delete this employee?",
        buttons: [
            {
                text: "Cancel",
                className: "px-4 py-2 bg-gray-300 rounded"
            },
            {
                text: "Delete",
                className: "px-4 py-2 bg-red-600 text-white rounded",
                onClick: async () => {

                    const { error } = await supabaseClient
                        .from('profiles')
                        .delete()
                        .eq('id', id);

                    if (error) {
                        showModal({
                            title: "Delete Failed",
                            message: error.message,
                            buttons: [
                                {
                                    text: "Close",
                                    className: "px-4 py-2 bg-red-600 text-white rounded"
                                }
                            ]
                        });
                        return;
                    }

                    showModal({
                        title: "Success",
                        message: "Employee deleted successfully.",
                        buttons: [
                            {
                                text: "OK",
                                className: "px-4 py-2 bg-blue-600 text-white rounded",
                                onClick: () => {
                                    loadEmployees();
                                }
                            }
                        ]
                    });
                }
            }
        ]
    });
}



// --- HELPER FUNCTIONS ---
function calculateDays(start, end) {
    if (!start || !end) return "-";
    const diffTime = new Date(end) - new Date(start);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function getStatusClass(status) {
    const s = status.trim().toLowerCase();
    if (s === 'pending') return 'status-pending';
    if (s === 'approved') return 'status-approved';
    if (s === 'declined' || s === 'rejected') return 'status-declined';
    return '';
}

function getStatusBadge(status) {
    const s = status.trim().toLowerCase();

    if (s === "pending") {
        return `
            <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">
                ⏳ Pending
            </span>
        `;
    }

    if (s === "approved") {
        return `
            <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                ✔ Approved
            </span>
        `;
    }

    if (s === "declined") {
        return `
            <span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-semibold">
                ✖ Declined
            </span>
        `;
    }

    return `
        <span class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs">
            ${status}
        </span>
    `;
}



// --- 1. ADMIN DASHBOARD ---
async function loadAdminDashboard() {
    // Get counts
    const { data: allRequests, error } = await supabaseClient
        .from('leave_requests')
        .select('status, created_at', { count: 'exact' });

    if (error) return console.error(error);

    const total = allRequests.length;
    const pending = allRequests.filter(r => r.status === 'Pending').length;
    const approved = allRequests.filter(r => r.status === 'Approved').length;
    const declined = allRequests.filter(r => r.status === 'Declined').length;

    document.getElementById('admin-total-requests').textContent = total;
    document.getElementById('admin-pending-count').textContent = pending;
    document.getElementById('admin-approved-count').textContent = approved;
    document.getElementById('admin-declined-count').textContent = declined;

    // Recent 3 requests
    const { data: recent, err2 } = await supabaseClient
        .from('leave_requests')
        .select(`
            created_at,
            leave_type,
            start_date,
            end_date,
            status,
            profiles(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(3);

    if (err2) return console.error(err2);

    const tbody = document.getElementById('admin-recent-requests-body');
    tbody.innerHTML = '';
    recent.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'border-b';
        tr.innerHTML = `
            <td class="py-2">${new Date(row.created_at).toLocaleDateString()}</td>
            <td class="py-2">${row.profiles?.full_name || 'Unknown'}</td>
            <td class="py-2">${row.leave_type}</td>
            <td class="py-2">${calculateDays(row.start_date, row.end_date)} day(s)</td>
            <td class="px-3 py-2">
                    ${getStatusBadge(row.status)}
                                                    </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- 2. MANAGE LEAVE REQUESTS ---

function renderRequestsTable(data) {
    const tbody = document.getElementById('all-leave-requests-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">No requests found</td></tr>`;
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td class="px-3 py-2">${new Date(row.created_at).toLocaleDateString()}</td>

            <td class="px-3 py-2 font-medium text-gray-700">${row.profiles?.full_name || "Unknown"}</td>
            <td class="px-3 py-2">${row.leave_type}</td>
            <td class="px-3 py-2">${row.start_date}</td>
            <td class="px-3 py-2">${row.end_date}</td>
            <td class="px-3 py-2 text-gray-600">${row.reason || "-"}</td>
         <td class="px-3 py-2">
                    ${getStatusBadge(row.status)}
                                                    </td>
          
            
           
           
           
         <td class="py-3 px-2 text-right">
<div class="flex justify-end gap-2 items-center">

${row.status === "Pending" ? `
    
    <button onclick="updateRequestStatus('${row.id}', 'Approved')"
        class="bg-green-600 text-white text-xs px-3 py-1 rounded">
        Approve
    </button>

    <button onclick="updateRequestStatus('${row.id}', 'Declined')"
        class="bg-red-500 text-white text-xs px-3 py-1 rounded">
        Decline
    </button>

` : row.status === "Approved" ? `

    <button onclick="toggleDOStatus('${row.id}', ${row.is_filed_to_do})"
        class="bg-blue-600 text-white text-xs px-3 py-1 rounded">
        ${row.is_filed_to_do ? "Mark as Not Filed to DO" : "Mark as Filed to DO"}
    </button>

    <button onclick="archiveRequest('${row.id}')"
        class="bg-gray-600 text-white text-xs px-3 py-1 rounded">
        Archive
    </button>

    <button onclick="cancelRequest('${row.id}')"
        class="bg-yellow-500 text-white text-xs px-3 py-1 rounded">
        Cancel
    </button>

` : row.status === "Declined" ? `

    <button onclick="archiveRequest('${row.id}')"
        class="bg-gray-600 text-white text-xs px-3 py-1 rounded">
        Archive
    </button>

    <button onclick="cancelRequest('${row.id}')"
        class="bg-yellow-500 text-white text-xs px-3 py-1 rounded">
        Cancel
    </button>

    <button onclick="deleteRequest('${row.id}')"
        class="bg-black text-white text-xs px-3 py-1 rounded">
        Delete
    </button>

` : ``}

</div>
</td>
        `;

        tbody.appendChild(tr);

    });
}

async function archiveRequest(requestId) {
    const { error } = await supabaseClient
        .from('leave_requests')
        .update({
            archived: true,
            admin_note: "Archived by admin"
        })
        .eq('id', requestId);

    if (error) {
        showModal({
            title: "Archive Failed",
            message: error.message,
            buttons: [
                {
                    text: "Close",
                    className: "px-4 py-2 bg-red-600 text-white rounded"
                }
            ]
        });
        return;
    }

    showModal({
        title: "Archived",
        message: "📦 Request archived successfully.",
        buttons: [
            {
                text: "OK",
                className: "px-4 py-2 bg-blue-600 text-white rounded",
                onClick: () => {
                    loadAllLeaveRequests();
                    loadAdminDashboard();
                }
            }
        ]
    });
}

async function cancelRequest(requestId) {
    const { error } = await supabaseClient
        .from('leave_requests')
        .update({
            status: "Pending",
            admin_note: "Reverted to pending"
        })
        .eq('id', requestId);

    if (error) {
        showModal({
            title: "Cancel Failed",
            message: error.message,
            buttons: [
                {
                    text: "Close",
                    className: "px-4 py-2 bg-red-600 text-white rounded"
                }
            ]
        });
        return;
    }

    showModal({
        title: "Request Updated",
        message: "🔄 The request has been returned to Pending.",
        buttons: [
            {
                text: "OK",
                className: "px-4 py-2 bg-blue-600 text-white rounded",
                onClick: () => {
                    loadAllLeaveRequests();
                    loadAdminDashboard();
                }
            }
        ]
    });
}

async function deleteRequest(requestId) {

    confirmModal("Permanently delete this declined request?", async () => {

        const { data, error } = await supabaseClient
            .from('leave_requests')
            .delete()
            .eq('id', requestId)
            .select(); // 🔥 IMPORTANT: confirms deletion actually happened

        if (error) {
            errorModal("Delete failed: " + error.message);
            return;
        }

        if (!data || data.length === 0) {
            errorModal("Delete failed: No record was removed (check permissions).");
            return;
        }

        successModal("Request deleted successfully");

        await loadAllLeaveRequests();
        await loadAdminDashboard();
    });
}

async function toggleDOStatus(requestId, currentStatus) {

    const { error } = await supabaseClient
        .from('leave_requests')
        .update({
            is_filed_to_do: !currentStatus
        })
        .eq('id', requestId);

    if (error) {
        showModal({
            title: "Update Failed",
            message: error.message,
            buttons: [
                {
                    text: "Close",
                    className: "px-4 py-2 bg-red-600 text-white rounded"
                }
            ]
        });
        return;
    }

    showModal({
        title: "Updated",
        message: "✅ Division Office status updated successfully.",
        buttons: [
            {
                text: "OK",
                className: "px-4 py-2 bg-blue-600 text-white rounded",
                onClick: () => {
                    loadAllLeaveRequests();
                    loadReportData();
                }
            }
        ]
    });
}

// --- 2. MANAGE LEAVE REQUESTS ---
// --- 2. MANAGE LEAVE REQUESTS ---
// --- 2. MANAGE LEAVE REQUESTS ---
async function loadAllLeaveRequests() {
    try {
        console.log("Loading all leave requests...");

        const { data, error } = await supabaseClient
            .from('leave_requests')
            .select(`
                id,
                created_at,
                leave_type,
                start_date,
                end_date,
                reason,
                status,
                is_filed_to_do,
                admin_note,
                user_id,
                profiles (
                    full_name,
                    department
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            return;
        }

        allRequestsData = data || [];

        renderRequestsTable(allRequestsData);

    } catch (err) {
        console.error(err);
    }
}

async function updateRequestStatus(requestId, status, note = '') {
    const { error } = await supabaseClient
        .from('leave_requests')
        .update({
            status: status,
            admin_note: note,
            updated_at: new Date()
        })
        .eq('id', requestId);

    if (error) {
        showModal({
            title: "Update Failed",
            message: error.message,
            buttons: [
                {
                    text: "Close",
                    className: "px-4 py-2 bg-red-600 text-white rounded"
                }
            ]
        });
        return;
    }

    showModal({
        title: "Status Updated",
        message: `✅ Request successfully marked as ${status}.`,
        buttons: [
            {
                text: "confirmed",
                className: "px-4 py-2 bg-blue-600 text-white rounded",
                onClick: () => {
                    loadAllLeaveRequests();
                    loadAdminDashboard();
                }
            }
        ]
    });
}



async function handleDeclineRequest() {
    const note = document.getElementById('decline-reason').value.trim();

    if (!note) {
        showModal({
            title: "Missing Reason",
            message: "Please enter a reason for declining this request.",
            buttons: [
                {
                    text: "confirmed",
                    className: "px-4 py-2 bg-blue-600 text-white rounded"
                }
            ]
        });
        return;
    }

    await updateRequestStatus(pendingDeclineId, 'Declined', note);

    const declineModal = document.getElementById('decline-modal');
    if (declineModal) {
        declineModal.classList.add('hidden');
    }

    pendingDeclineId = null;
}





// --- 3. EMPLOYEE LEAVE SUMMARY ---
let summaryData = [];

async function loadEmployeeSummary() {
    const { data, error } = await supabaseClient
        .from('leave_requests')
        .select(`
        start_date,
        end_date,
        status,
        profiles!inner (
            full_name,
            department,
            id,
            employee_status
        )
    `);

    if (error) return console.error(error);

    // Aggregate data
    const map = {};
    data.forEach(row => {
        if (row.status !== 'Approved') return;
        if (row.profiles.employee_status !== 'active') return;
        const uid = row.profiles.id;
        if (!map[uid]) {
            map[uid] = {
                name: row.profiles.full_name || 'Unknown',
                dept: row.profiles.department || 'N/A',
                count: 0,
                days: 0,
                months: new Set()
            };
        }
        map[uid].count++;
        map[uid].days += calculateDays(row.start_date, row.end_date);
        map[uid].months.add(row.start_date.substring(0, 7)); // YYYY-MM
    });

    summaryData = Object.values(map);
    filterEmployeeSummary();
}

function filterEmployeeSummary() {
    const search = document.getElementById('search-summary-employee').value.toLowerCase();
    const month = document.getElementById('filter-month').value;
    const year = document.getElementById('filter-year').value;

    let filtered = summaryData;

    if (search) {
        filtered = filtered.filter(emp => emp.name.toLowerCase().includes(search));
    }
    if (month && year) {
        const targetMonth = `${year}-${month}`;
        filtered = filtered.filter(emp => emp.months.has(targetMonth));
    }

    const tbody = document.getElementById('employee-summary-body');
    tbody.innerHTML = '';
    filtered.forEach(emp => {
        const tr = document.createElement('tr');
        tr.className = 'border-b';
        tr.innerHTML = `
            <td class="py-2">${emp.name}</td>
            <td class="py-2">${emp.dept}</td>
            <td class="py-2">${emp.count}</td>
            <td class="py-2">${emp.days}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- 4. LEAVE CALENDAR ---
async function renderLeaveCalendar() {

    const month = currentCalendarDate.getMonth();
    const year = currentCalendarDate.getFullYear();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Update title
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;

    // Get approved leaves for this month
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`;

    const { data, error } = await supabaseClient
        .from('leave_requests')
        .select('start_date, end_date, profiles(full_name)')
        .eq('status', 'Approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

    if (error) return console.error(error);

    // Prepare leave map
    const leaveMap = {};
    data.forEach(l => {
        const s = new Date(l.start_date);
        const e = new Date(l.end_date);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            const key = d.toISOString().split('T')[0];
            if (!leaveMap[key]) leaveMap[key] = [];
            leaveMap[key].push(l.profiles.full_name);
        }
    });

    // Render grid
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // Empty days before month starts
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'h-20 border rounded bg-gray-50';
        grid.appendChild(empty);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEl = document.createElement('div');
        dayEl.className = 'h-20 border rounded p-1 relative overflow-hidden';
        dayEl.innerHTML = `<div class="font-medium">${day}</div>`;

        if (leaveMap[dateStr]) {
            dayEl.classList.add('bg-blue-50', 'border-blue-200');
            leaveMap[dateStr].forEach(name => {
                const nameEl = document.createElement('div');
                nameEl.className = 'text-[10px] bg-blue-100 px-1 mt-0.5 rounded truncate';
                nameEl.textContent = name;
                dayEl.appendChild(nameEl);
            });
        }
        grid.appendChild(dayEl);
    }
}

// --- 5. REPORTS ---
let reportData = [];

async function loadReportData() {
    const month = document.getElementById('report-month').value;
    const year = document.getElementById('report-year').value;
    const monthName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][parseInt(month) - 1];

    document.getElementById('report-month-text').textContent = monthName;
    document.getElementById('report-year-text').textContent = year;

    const start = `${year}-${month}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const end = `${year}-${month}-${daysInMonth}`;

    const { data, error } = await supabaseClient
        .from('leave_requests')
        .select(`
        leave_type,
        start_date,
        end_date,
        is_filed_to_do,
        status,
        profiles!inner(full_name, employee_status)
    `)
        .eq('status', 'Approved')
        .lte('start_date', end)
        .gte('end_date', start);

    if (error) return console.error(error);

    reportData = data;

    // Build table
    const tbody = document.getElementById('report-table-body');
    tbody.innerHTML = '';

    let totalLeaves = 0;
    let totalDays = 0;
    let filedDO = 0;
    let notFiledDO = 0;
    const uniqueEmployees = new Set();

    data.forEach(row => {

        totalLeaves++;

        const days = calculateDays(row.start_date, row.end_date);
        totalDays += days;

        uniqueEmployees.add(row.profiles?.full_name || 'Unknown');

        // Use your real column
        if (row.is_filed_to_do === true) {
            filedDO++;
        } else {
            notFiledDO++;
        }

        const tr = document.createElement('tr');
        tr.className = 'border-b';
        tr.innerHTML = `
        <td class="p-2">${row.profiles?.full_name || 'Unknown'}</td>
        <td class="p-2">${row.start_date} → ${row.end_date}</td>
        <td class="p-2 text-center">${row.leave_type}</td>
        <td class="p-2 text-center">${days}</td>
    `;
        tbody.appendChild(tr);
    });

    // Update summary numbers
    document.getElementById('report-total-employees').textContent = uniqueEmployees.size;

    document.getElementById('report-total-leaves').textContent = totalLeaves;

    document.getElementById('report-total-filed-do').textContent = filedDO;

    document.getElementById('report-total-not-filed-do').textContent = notFiledDO;

    document.getElementById('report-total-days').textContent = totalDays;

    // Show report area & export buttons
    document.getElementById('report-content').classList.remove('hidden');
    document.getElementById('export-pdf').classList.remove('hidden');
    document.getElementById('export-excel').classList.remove('hidden');
}

// --- EXPORT FUNCTIONS ---


async function exportAsPDF() {
    if (!reportData || reportData.length === 0) return alert('No data to export!');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const monthText = document.getElementById('report-month-text').textContent;
    const yearText = document.getElementById('report-year-text').textContent;

    // Header
    doc.setFontSize(16);
    doc.text('LEAVE MANAGEMENT REPORT', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`For the Month of ${monthText} ${yearText}`, 105, 30, { align: 'center' });

    // Table headers
    let yPos = 45;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Employee Name', 15, yPos);
    doc.text('Leave Dates', 60, yPos);
    doc.text('Type', 120, yPos);
    doc.text('Days', 150, yPos);
    doc.setDrawColor(200);
    doc.line(15, yPos + 3, 175, yPos + 3);
    yPos += 10;

    // Table rows
    doc.setTextColor(0);
    reportData.forEach(row => {
        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
        }
        const days = calculateDays(row.start_date, row.end_date);
        doc.text(`${row.profiles?.full_name || 'Unknown'}`, 15, yPos);
        doc.text(`${row.start_date} → ${row.end_date}`, 60, yPos);
        doc.text(`${row.leave_type}`, 120, yPos, { align: 'center' });
        doc.text(`${days}`, 150, yPos, { align: 'center' });
        yPos += 8;
    });

    // Summary
    yPos += 5;
    doc.setDrawColor(200);
    doc.line(15, yPos, 175, yPos);
    yPos += 8;
    doc.setFontSize(11);
    doc.text(`Total Employees on Leave: ${document.getElementById('report-total-employees').textContent}`, 15, yPos);
    yPos += 8;
    doc.text(`Total Approved Leaves: ${document.getElementById('report-total-leaves').textContent}`, 15, yPos);
    yPos += 8;
    doc.text(`Total Leave Days Combined: ${document.getElementById('report-total-days').textContent}`, 15, yPos);

    // Save file
    doc.save(`Leave_Report_${monthText}_${yearText}.pdf`);
}

// log out button //
async function handleLogout() {
    if (confirm("Are you sure you want to log out?")) {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    }
}


function applyFilters() {
    const searchInput = document.getElementById('search-leave-employee');
    const startInput = document.getElementById('filter-start-date');
    const endInput = document.getElementById('filter-end-date');

    const search = searchInput ? searchInput.value.toLowerCase() : "";
    const startDate = startInput ? startInput.value : "";
    const endDate = endInput ? endInput.value : "";

    let filtered = allRequestsData;

    if (search) {
        filtered = filtered.filter(r =>
            r.profiles?.full_name?.toLowerCase().includes(search)
        );
    }

    if (startDate) {
        filtered = filtered.filter(r => r.start_date >= startDate);
    }

    if (endDate) {
        filtered = filtered.filter(r => r.end_date <= endDate);
    }

    renderRequestsTable(filtered);
}




function showModal({ title, message, buttons = [] }) {
    const modal = document.getElementById("global-modal");
    const modalBox = document.getElementById("modal-box");
    const modalTitle = document.getElementById("modal-title");
    const modalMessage = document.getElementById("modal-message");
    const modalActions = document.getElementById("modal-actions");

    if (!modal || !modalBox) return;

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    modalActions.innerHTML = "";

    buttons.forEach(btn => {
        const button = document.createElement("button");
        button.textContent = btn.text;
        button.className = btn.className || "";

        button.onclick = () => {
            if (btn.onClick) btn.onClick();
            hideModal();
        };

        modalActions.appendChild(button);
    });

    // SHOW MODAL PROPERLY CENTERED
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    // trigger animation
    setTimeout(() => {
        modalBox.classList.remove("scale-95", "opacity-0");
        modalBox.classList.add("scale-100", "opacity-100");
    }, 10);
}


// ===== GLOBAL MODAL CONTROLLER =====


function hideModal() {
    const modal = document.getElementById("global-modal");
    const modalBox = document.getElementById("modal-box");

    if (!modal || !modalBox) return;

    modalBox.classList.add("scale-95", "opacity-0");
    modalBox.classList.remove("scale-100", "opacity-100");

    setTimeout(() => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }, 150);
}


function alertModal(message, title = "Notice") {
    showModal({
        title,
        message,
        buttons: [
            {
                text: "OK",
                className: "px-4 py-2 bg-blue-600 text-white rounded"
            }
        ]
    });
}

function successModal(message) {
    showModal({
        title: "Success",
        message,
        buttons: [
            {
                text: "OK",
                className: "px-4 py-2 bg-green-600 text-white rounded"
            }
        ]
    });
}

function errorModal(message) {
    showModal({
        title: "Error",
        message,
        buttons: [
            {
                text: "Close",
                className: "px-4 py-2 bg-red-600 text-white rounded"
            }
        ]
    });
}

function confirmModal(message, onConfirm) {
    showModal({
        title: "Confirm Action",
        message,
        buttons: [
            {
                text: "Cancel",
                className: "px-4 py-2 bg-gray-300 rounded"
            },
            {
                text: "Confirm",
                className: "px-4 py-2 bg-red-600 text-white rounded",
                onClick: onConfirm
            }
        ]
    });
}