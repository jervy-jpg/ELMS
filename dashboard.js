// dashboard.js
const supabase = window.supabaseClient;

// Safety check
if (!supabase) {
  console.error("❌ Supabase client is not available — check supabaseClient.js and script loading order");
  alert("System connection error. Please refresh or contact admin.");
  throw new Error("Supabase client missing");
}

// ... rest of your code stays exactly the same

let currentUserProfile = null; // Global variable to store current user's profile

// --- DOMContentLoaded: Main entry point when the page loads ---
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('User not authenticated or session expired:', authError?.message);
    window.location.href = '/login.html'; // Redirect to login if not authenticated
    return;
  }

  // 2. Fetch user profile data
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, department, user_type, avatar_url')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error fetching user profile:', profileError.message);
    document.getElementById('greeting-name').textContent = 'User'; // Fallback
    document.getElementById('welcome-user-name').textContent = 'User'; // Fallback
    document.getElementById('user-name-sidebar').textContent = 'User'; // Fallback
    return;
  }

  // LOAD USER AVATAR
  if (profile?.avatar_url) {
    document.getElementById("user").src = profile.avatar_url;
  }

  currentUserProfile = profile; // Store profile for other functions
  // Update all elements with dynamic user name
  document.getElementById('greeting-name').textContent = profile.full_name;
  document.getElementById('welcome-user-name').textContent = profile.full_name;
  document.getElementById('user-name-sidebar').textContent = profile.full_name;
  // Update other UI elements with profile data if needed, e.g., role

  // 3. Attach Event Listeners for Navigation and Forms
  document.getElementById('dashboard-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('dashboard');
  });
  document.getElementById('file-leave-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('file-leave');
  });
  document.getElementById('leave-history-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('leave-history');
  });
  document.getElementById('logout-button')?.addEventListener('click', handleLogout);


  const leaveRequestForm = document.getElementById('leave-request-form');
  if (leaveRequestForm) {
    leaveRequestForm.addEventListener('submit', handleFileLeaveSubmit);
  }

  document.getElementById('view-all-recent')?.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('leave-history');
  });

  // 4. Initial page load based on URL hash or default to 'dashboard'
  const initialPage = window.location.hash.substring(1) || 'dashboard';
  showPage(initialPage);

  // 🔥 ensure dashboard fully loads on first visit
  if (initialPage === 'dashboard') {
    autoLoadDashboard();
  }
  const startDateInput = document.getElementById("start_date");
  const endDateInput = document.getElementById("end_date");

  if (startDateInput && endDateInput) {

    startDateInput.addEventListener("change", () => {
      // set minimum end date = start date
      endDateInput.min = startDateInput.value;

      // auto-reset if invalid
      if (endDateInput.value && endDateInput.value < startDateInput.value) {
        endDateInput.value = "";
      }
    });

  }
  const avatarInput = document.getElementById("avatarinput");
  const avatarImg = document.getElementById("user");

  // click avatar to open file picker
  avatarImg.addEventListener("click", () => {
    avatarInput.click();
  });



  avatarInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const user = await supabaseClient.auth.getUser();
    const userId = user.data.user.id;

    const filePath = `${userId}/${Date.now()}-${file.name}`;

    // 1. Upload to Supabase Storage
    const { error: uploadError } = await supabaseClient
      .storage
      .from("profiles_photo")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true
      });

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      return;
    }

    // 2. Get public URL
    const { data } = supabaseClient
      .storage
      .from("profiles_photo")
      .getPublicUrl(filePath);

    const imageUrl = data.publicUrl;

    // 3. Save to profiles table
    const { error: dbError } = await supabaseClient
      .from("profiles")
      .update({ avatar_url: imageUrl })
      .eq("id", userId);

    if (dbError) {
      alert("Failed to save avatar");
      return;
    }

    // 4. Update UI instantly
    avatarImg.src = imageUrl;

    alert("Profile picture updated successfully!");
  });


});



// --- Page Navigation and Content Loading ---
async function showPage(pageId) {
  // Hide all page contents
  document.querySelectorAll('.content-section').forEach(page => {
    page.classList.remove('active'); // Use class for active state
  });

  // Show the requested page content
  const currentPageContent = document.getElementById(pageId + '-content'); // Note the '-content' suffix
  if (currentPageContent) {
    currentPageContent.classList.add('active');
  } else {
    console.warn(`Content div for pageId '${pageId}' not found. Make sure your HTML has <div id="${pageId}-content" class="content-section">`);
    return;
  }

  // Update navigation link active state
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.classList.remove('active');
  });
  const activeNavLink = document.querySelector(`.sidebar-nav a[href="#${pageId}"]`);
  if (activeNavLink) {
    activeNavLink.classList.add('active');
  }


  // Update page title
  const titles = {
    'dashboard': 'Dashboard',
    'file-leave': 'File New Leave Request',
    'leave-history': 'Leave History'
  };
  document.getElementById('page-title').textContent = titles[pageId];

  if (pageId === 'dashboard') {
    autoLoadDashboard();
  }

  if (pageId === 'leave-history') {
    loadLeaveHistory();
  }

}


//log-out
async function handleLogout() {
  const confirmLogout = confirm("Are you sure you want to log out?");

  if (!confirmLogout) return; // ❌ user cancelled

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Logout error:', error.message);
  } else {
    window.location.href = 'login.html';
  }
}


//leave-filing//
async function handleFileLeaveSubmit(e) {
  e.preventDefault();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("User not logged in");
    return;
  }

  const leaveType = document.getElementById('leave_type_form').value;
  const startDate = document.getElementById('start_date').value;
  const endDate = document.getElementById('end_date').value;
  const reason = document.getElementById('reason_brief').value;


  const { error } = await supabase
    .from('leave_requests')
    .insert([
      {
        user_id: user.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason,

        status: "Pending",

        // ✅ >>> NEW FIELDS ADDED HERE <<< ✅
        leave_code: getLeaveCode(leaveType),
        leave_type_full: getLeaveFullName(leaveType),
        duration_days: getLeaveDuration(leaveType),
        is_filed_to_do: checkIfFiledToDO(leaveType),
        leave_date: startDate
        // ✅ >>> END NEW FIELDS <<< ✅

      }
    ]);

  if (error) {
    console.error("Insert error:", error.message);
    alert("Failed to submit leave request.");
  } else {
    alert("Leave request submitted successfully!");
    document.getElementById('leave-request-form').reset();

    // 🔥 AUTO REFRESH DATA
    loadRecentRequests();
    loadLeaveHistory();
  }
}


//LEAVE HISTORY FUNCITIONS//

async function loadLeaveHistory() {
  // Get the currently authenticated employee
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError || !user) {
    console.error(
      "Unable to verify employee:",
      authError?.message
    );
    return;
  }

  // Retrieve only this employee's leave requests
  const { data, error } = await supabase
    .from('leave_requests')
    .select(`
      id,
      leave_type,
      start_date,
      end_date,
      reason,
      status,
      admin_note,
      created_at,
      profiles!leave_requests_user_id_fkey (
        full_name
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });


  if (error) {
    console.error("Leave history error:", error.message);
    return;
  }

  const tableBody = document.getElementById('leave-history-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = "";

  data.forEach(row => {
    const tr = document.createElement('tr');


    tr.innerHTML = `
      <td>${new Date(row.created_at).toLocaleDateString()}</td>
      <td>${row.leave_type}</td>
      <td>${row.start_date}</td>
      <td>${row.end_date}</td>
      <td>${calculateDays(row.start_date, row.end_date)}</td>
      <td>
        <div class="${getStatusClass(row.status)}">${row.status}</div>
        ${row.admin_note ? `<div class="admin-note">Note: ${row.admin_note}</div>` : ""}
      </td>
      <td>${row.profiles?.full_name || 'Unknown'}</td>
      <td>
        <button
          type="button"
          class="generate-cs-form6-btn"
          data-request-id="${row.id}">
          Generate CS Form No. 6
        </button>
      </td>
    `;


    tableBody.appendChild(tr);
  });
}


document.addEventListener('click', async function (event) {
  const button = event.target.closest('.generate-cs-form6-btn');

  if (!button) return;

  const requestId = button.dataset.requestId;

  if (!requestId) {
    alert('Unable to identify this leave request.');
    return;
  }

  // Prevent repeated clicks while generating
  if (button.disabled) return;

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Preparing form...';

  try {
    await generateEmployeeCSForm6(requestId);
  } catch (error) {
    console.error('Employee CS Form No. 6 error:', error);
    alert('Unable to generate CS Form No. 6. Please check the browser console.');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});



function getPhilippineTodayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

// recent leave request functions
async function loadRecentRequests() {
  const { data: { user } } = await supabase.auth.getUser();


  const { data, error } = await supabase
    .from('leave_requests')
    .select(`
      leave_type,
      status,
      created_at,
      start_date,
      end_date
    `)
    .eq('user_id', user.id)
    .gte('end_date', getPhilippineTodayISO())
    .order('created_at', { ascending: false })
    .limit(2);


  if (error) {
    console.error("Recent requests error:", error.message);
    return;
  }

  const tableBody = document.getElementById('Recent-request-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = "";

  data.forEach(row => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${new Date(row.created_at).toLocaleDateString()}</td>
      <td>${row.leave_type}</td>
      <td>${calculateDays(row.start_date, row.end_date)}</td>
      <td class="${getStatusClass(row.status)}">${row.status}</td>
    `;

    tableBody.appendChild(tr);
  });
}

//leave days calculator
function calculateDays(start, end) {
  if (!start || !end) return "-"; // 👈 safety

  const startDate = new Date(start);
  const endDate = new Date(end);

  const diffTime = endDate - startDate;

  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;


}

function getStatusClass(status) {
  const clean = status.trim().toLowerCase();

  switch (clean) {
    case "pending":
      return "status-pending";
    case "approved":
      return "status-approved";
    case "rejected":
    case "declined": // just in case old data exists
      return "status-rejected";
    default:
      return "";
  }
}

//dashboard functions
async function loadDashboardStats() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('leave_requests')
    .select('status, start_date, end_date')
    .eq('user_id', user.id);

  if (error) {
    console.error("Stats error:", error.message);
    return;
  }

  let pending = 0;
  let approved = 0;
  let totalDays = 0;
  let latestApproved = null;


  const today = getPhilippineTodayISO();

  data.forEach(row => {
    const isExpired = row.end_date < today;

    if (row.status === "Pending" && !isExpired) {
      pending++;
    }

    if (row.status === "Approved") {
      // Keep historical leave days in the total used days.
      totalDays += calculateDays(row.start_date, row.end_date);

      // Only count active or upcoming approved leave requests.
      if (!isExpired) {
        approved++;

        if (
          !latestApproved ||
          row.start_date > latestApproved.start_date
        ) {
          latestApproved = row;
        }
      }
    }
  });


  document.getElementById('pending-request-count').textContent = pending;
  document.getElementById('approved-leaves-count').textContent = approved;
  document.getElementById('total-used-days').textContent = totalDays;

  const upcomingElement = document.getElementById('upcoming-leave-date');
  if (upcomingElement) {
    upcomingElement.textContent = latestApproved
      ? `${latestApproved.start_date} → ${latestApproved.end_date}`
      : "-";
  }
}

async function autoLoadDashboard() {
  await loadDashboardStats();
  await loadRecentRequests();
}

// ===============================
// LEAVE HELPER FUNCTIONS (FIX)
// ===============================

function getLeaveCode(type) {
  const map = {
    "Vacation Leave": "VL",
    "Sick Leave": "SL",
    "Maternity Leave": "ML",
    "Paternity Leave": "PL"
  };

  return map[type] || "UNKNOWN";
}

function getLeaveFullName(type) {
  return type; // already full name from dropdown
}

function getLeaveDuration(type) {
  // optional logic (you can improve later)
  return 1;
}

function checkIfFiledToDO(type) {
  // adjust if you have rules later
  return false;
}



async function generateEmployeeCSForm6(requestId) {
  try {
    // 1. Check required libraries.
    if (!window.XLSX) {
      throw new Error("Excel library (XLSX) is not loaded.");
    }

    if (!window.JSZip) {
      throw new Error("JSZip is not loaded.");
    }

    // 2. Retrieve the selected leave request and employee name.

    // Verify the currently authenticated employee.
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Please sign in again to generate this form.");
    }

    // Retrieve only the selected request belonging to this employee.
    const { data: request, error } = await supabase
      .from("leave_requests")
      .select(`
                id,
                user_id,
                created_at,
                leave_type,
                start_date,
                end_date,
                profiles (
                    full_name
                )
            `)
      .eq("id", requestId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      throw new Error(
        "Unable to retrieve your leave request: " + error.message
      );
    }

    if (!request) {
      throw new Error("This leave request could not be found.");
    }


    // 3. Format dates for the official form.
    function formatDate(value) {
      if (!value) {
        return "";
      }

      const date = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? `${value}T00:00:00`
          : value
      );

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }

    const fullName = request.profiles?.full_name || "";
    const dateFiled = formatDate(request.created_at);
    const leaveType = request.leave_type || "";

    const normalizedLeaveType = String(leaveType)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    // 4. Recognize official leave names and ELMS abbreviations.
    const leaveTypeAliases = {
      vacationleave: "Vacation Leave",
      vl: "Vacation Leave",
      vl1: "Vacation Leave",
      vl2: "Vacation Leave",

      mandatoryforcedleave: "Mandatory/Forced Leave",
      mandatoryleave: "Mandatory/Forced Leave",
      forcedleave: "Mandatory/Forced Leave",
      fl: "Mandatory/Forced Leave",

      sickleave: "Sick Leave",
      sl: "Sick Leave",
      sl1: "Sick Leave",
      sl2: "Sick Leave",

      maternityleave: "Maternity Leave",
      ml: "Maternity Leave",

      paternityleave: "Paternity Leave",
      pl: "Paternity Leave",

      specialprivilegeleave: "Special Privilege Leave",
      spl: "Special Privilege Leave",
      soloparentleave: "Solo Parent Leave",
      solo: "Solo Parent Leave",
      studyleave: "Study Leave",
      stl: "Study Leave",
      

      "10dayvawc": "10-Day VAWC Leave",
      vawc: "10-Day VAWC Leave",

      rehabilitationprivilege: "Rehabilitation Privilege",
      rp: "Rehabilitation Privilege",

      specialleavebenefitsforwomen:
        "Special Leave Benefits for Women",
      slbw: "Special Leave Benefits for Women",

      specialemergencycalamityleave:
        "Special Emergency (Calamity) Leave", 
        sel: "Special Emergency (Calamity) Leave",

      adoptionleave: "Adoption Leave", 
      al: "Adoption Leave",

      wellnessleave: "Wellness Leave",
      wl: "Wellness Leave"
    };

    const officialLeaveTypes = [
      "Vacation Leave",
      "Mandatory/Forced Leave",
      "Sick Leave",
      "Maternity Leave",
      "Paternity Leave",
      "Special Privilege Leave",
      "Solo Parent Leave",
      "Study Leave",
      "10-Day VAWC Leave",
      "Rehabilitation Privilege",
      "Special Leave Benefits for Women",
      "Special Emergency (Calamity) Leave",
      "Adoption Leave"
    ];

    const displayLeaveType =
      leaveTypeAliases[normalizedLeaveType] || leaveType;

    const isWellnessLeave =
      normalizedLeaveType === "wellnessleave" ||
      normalizedLeaveType === "wl";

    const isOfficialLeaveType = officialLeaveTypes.some(
      type =>
        type.toLowerCase().replace(/[^a-z0-9]/g, "") ===
        normalizedLeaveType
    ) || Object.entries(leaveTypeAliases).some(
      ([alias, officialName]) =>
        alias === normalizedLeaveType &&
        officialLeaveTypes.includes(officialName)
    );
    console.log("CS Form 6 request:", request);
    console.log("Employee profile:", request.profiles);
    console.log("Employee name:", fullName);
    console.log("Filing date:", dateFiled);
    console.log("Leave type:", leaveType);
    console.log("Start date:", request.start_date);
    console.log("End date:", request.end_date);

    const inclusiveDates =
      request.start_date === request.end_date
        ? formatDate(request.start_date)
        : `${formatDate(request.start_date)} to ${formatDate(request.end_date)}`;

    // 5. Load the original official Excel template.
    const templatePath =
      "assets/templates/FASHS_Application_for_Leave.xlsx";

    const templateResponse = await fetch(templatePath);

    if (!templateResponse.ok) {
      throw new Error(
        `Could not load the official template. HTTP ${templateResponse.status}`
      );
    }

    const templateBuffer = await templateResponse.arrayBuffer();

    const zip = await window.JSZip.loadAsync(templateBuffer);

    const sheetPath = "xl/worksheets/sheet1.xml";
    const sheetFile = zip.file(sheetPath);

    if (!sheetFile) {
      throw new Error(
        "The first worksheet was not found in the template."
      );
    }

    // 6. Read the worksheet XML.
    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    const sheetXml = await sheetFile.async("text");

    const sheetDoc = parser.parseFromString(
      sheetXml,
      "application/xml"
    );

    if (sheetDoc.getElementsByTagName("parsererror").length > 0) {
      throw new Error("The original worksheet XML is invalid.");
    }

    const spreadsheetNs =
      "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

    // 7. Replace a cell's contents while preserving its style.
    function setTemplateCell(cellAddress, value) {
      const cells = Array.from(
        sheetDoc.getElementsByTagNameNS(spreadsheetNs, "c")
      );

      const cell = cells.find(
        item => item.getAttribute("r") === cellAddress
      );

      if (!cell) {
        throw new Error(
          `Template cell ${cellAddress} was not found.`
        );
      }

      // Keep cell attributes such as its original style.
      while (cell.firstChild) {
        cell.removeChild(cell.firstChild);
      }

      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        cell.removeAttribute("t");
        return;
      }

      cell.setAttribute("t", "inlineStr");

      const inlineString = sheetDoc.createElementNS(
        spreadsheetNs,
        "is"
      );

      const textNode = sheetDoc.createElementNS(
        spreadsheetNs,
        "t"
      );

      textNode.setAttributeNS(
        "http://www.w3.org/XML/1998/namespace",
        "xml:space",
        "preserve"
      );

      textNode.textContent = String(value);

      inlineString.appendChild(textNode);
      cell.appendChild(inlineString);
    }

    // 8. Populate the template.
    // NOTE: B6 is provisional and must be visually verified.
    setTemplateCell("E5", fullName);
    setTemplateCell("B6", dateFiled);
    setTemplateCell("B48", inclusiveDates);

    // TEMPORARY DEBUG: inspect the worksheet values before downloading.
    const debugCells = ["E5", "B6", "B48", "B41"];

    for (const address of debugCells) {
      const cell = Array.from(
        sheetDoc.getElementsByTagNameNS(spreadsheetNs, "c")
      ).find(item => item.getAttribute("r") === address);

      console.log(
        `Worksheet cell ${address}:`,
        cell ? cell.outerHTML : "CELL NOT FOUND"
      );
    }

    // Wellness Leave is entered under "Others" on this form.
    // Other unrecognized/custom leave types also go under "Others".
    
    // Only Wellness Leave may populate the "Others" field.
    if (isWellnessLeave) {
      setTemplateCell("B41", "Wellness Leave");
    }


    // Remove only the four empty text boxes that cover generated data.
    // This edits the downloaded copy, not the original template.


    // Automatically select the matching official leave checkbox.
    // This modifies only the generated workbook copy.
    const vmlPath = "xl/drawings/vmlDrawing1.vml";
    const vmlFile = zip.file(vmlPath);

    if (vmlFile) {
      const vmlXml = await vmlFile.async("text");
      const vmlDoc = parser.parseFromString(
        vmlXml,
        "application/xml"
      );

      const excelNs =
        "urn:schemas-microsoft-com:office:excel";

      // Checkbox anchor rows identified from the original template.
      const checkboxRows = {
        "Vacation Leave": 9,
        "Mandatory/Forced Leave": 11,
        "Sick Leave": 13,
        "Maternity Leave": 15,
        "Paternity Leave": 17,
        "Special Privilege Leave": 19,
        "Solo Parent Leave": 21,
        "Study Leave": 23,
        "10-Day VAWC Leave": 25,
        "Rehabilitation Privilege": 27,
        "Special Leave Benefits for Women": 29,
        "Special Emergency (Calamity) Leave": 31,
        "Adoption Leave": 33
      };

      const selectedRow =
        checkboxRows[displayLeaveType] ?? null;

      const clientDataNodes = Array.from(
        vmlDoc.getElementsByTagNameNS(
          excelNs,
          "ClientData"
        )
      );

      console.log(
        "VML checkbox controls:",
        JSON.stringify(
          clientDataNodes.map((clientData, index) => {
            const anchor = clientData.getElementsByTagNameNS(
              excelNs,
              "Anchor"
            )[0];

            return {
              index,
              objectType: clientData.getAttribute("ObjectType"),
              anchor: anchor?.textContent.trim(),
              checked: clientData.getElementsByTagNameNS(
                excelNs,
                "Checked"
              )[0]?.textContent
            };
          }),
          null,
          2
        )
      );


      for (const clientData of clientDataNodes) {
        if (
          clientData.getAttribute("ObjectType") !==
          "Checkbox"
        ) {
          continue;
        }

        const anchor = clientData.getElementsByTagNameNS(
          excelNs,
          "Anchor"
        )[0];

        if (!anchor) {
          continue;
        }

        const anchorValues = anchor.textContent
          .split(",")
          .map(value => Number(value.trim()));

        const startRow = anchorValues[2];

        // Only modify the 13 official leave-type checkboxes.
        if (!Object.values(checkboxRows).includes(startRow)) {
          continue;
        }

        let checkedNode = clientData.getElementsByTagNameNS(
          excelNs,
          "Checked"
        )[0];

        const shouldBeChecked =
          selectedRow !== null &&
          startRow === selectedRow;

        if (!checkedNode) {
          checkedNode = vmlDoc.createElementNS(
            excelNs,
            "Checked"
          );

          clientData.appendChild(checkedNode);
        }

        checkedNode.textContent =
          shouldBeChecked ? "1" : "0";
      }

      zip.file(
        vmlPath,
        serializer.serializeToString(vmlDoc)
      );

      console.log(
        "CS Form 6 checkbox selection:",
        displayLeaveType,
        "Selected row:",
        selectedRow
      );
    }

    // Remove only empty text boxes covering generated data.
    // The original template remains unchanged.
    const drawingPath = "xl/drawings/drawing1.xml";
    const drawingFile = zip.file(drawingPath);

    if (drawingFile) {
      const drawingXml = await drawingFile.async("text");
      const drawingDoc = parser.parseFromString(
        drawingXml,
        "application/xml"
      );

      const drawingNs =
        "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";

      const overlaysToRemove = new Set([
        "TextBox 2",
        "TextBox 48",
        "TextBox 50"
      ]);

      const shapes = Array.from(
        drawingDoc.getElementsByTagNameNS(drawingNs, "sp")
      );

      for (const shape of shapes) {
        const nameNode = shape.getElementsByTagNameNS(
          drawingNs,
          "cNvPr"
        )[0];

        const shapeName = nameNode?.getAttribute("name");

        if (shapeName && overlaysToRemove.has(shapeName)) {
          // Remove the entire drawing anchor, not just its shape.
          const anchor = shape.parentNode;

          if (anchor?.parentNode) {
            anchor.parentNode.removeChild(anchor);
            console.log("Removed empty overlay:", shapeName);
          }
        }
      }



      zip.file(
        drawingPath,
        serializer.serializeToString(drawingDoc)
      );
    }


    // 9. Validate the updated worksheet XML.
    const updatedXml = serializer.serializeToString(sheetDoc);

    const validationDoc = parser.parseFromString(
      updatedXml,
      "application/xml"
    );

    if (
      validationDoc.getElementsByTagName("parsererror").length > 0
    ) {
      throw new Error(
        "The updated worksheet failed XML validation."
      );
    }

    // 10. Replace only the first worksheet.
    // Other template files remain in the ZIP archive.
    zip.file(sheetPath, updatedXml);

    const outputBlob = await zip.generateAsync({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });


    // TEMPORARY DEBUG: verify values in the completed Excel file.
    const testWb = window.XLSX.read(
      await outputBlob.arrayBuffer(),
      { type: "array", cellStyles: true }
    );

    const testWs = testWb.Sheets[testWb.SheetNames[0]];

    console.log("Generated file — E5:", testWs["E5"]);
    console.log("Generated file — B6:", testWs["B6"]);
    console.log("Generated file — B48:", testWs["B48"]);
    console.log("Generated file — B41:", testWs["B41"]);


    // 11. Download the completed copy.
    const safeName = String(fullName || "Employee")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .trim()
      .replace(/\s+/g, "_") || "Employee";

    const downloadUrl = URL.createObjectURL(outputBlob);
    const downloadLink = document.createElement("a");

    downloadLink.href = downloadUrl;
    downloadLink.download = `CS_Form_6_${safeName}.xlsx`;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    // Release the temporary download URL.
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);

  } catch (error) {
    console.error("Error generating CS Form 6:", error);

    alert(
      "Unable to generate the leave application form. " +
      (error.message || "Please check the browser console.")
    );
  }
}
