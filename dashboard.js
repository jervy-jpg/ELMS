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
      <td<div class="${getStatusClass(row.status)}">${row.status}</div>
           ${row.admin_note ? `<div class="admin-note">Note: ${row.admin_note}</div>` : ""}</td>
      <td>${row.profiles?.full_name || 'Unknown'}</td>
    `;

    tableBody.appendChild(tr);
  });
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

  data.forEach(row => {
    if (row.status === "Pending") pending++;

    if (row.status === "Approved") {
      approved++;
      totalDays += calculateDays(row.start_date, row.end_date);

      if (!latestApproved || new Date(row.start_date) > new Date(latestApproved.start_date)) {
        latestApproved = row;
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

