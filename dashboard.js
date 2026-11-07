// dashboard.js
const supabase = window.supabaseClient;

/* ===== GLOBAL CUSTOM MODAL FUNCTIONS ===== */



function hideModal() {
  const modal = document.getElementById("global-modal");
  const modalBox = document.getElementById("modal-box");

  if (!modal || !modalBox) return;

  modal.classList.add("hidden");
  modal.classList.remove("flex");

  modalBox.classList.remove("scale-100", "opacity-100");
  modalBox.classList.add("scale-95", "opacity-0");
}


function showModal({
  title = "Notification",
  message = "",
  type = "info",
  buttons = []
}) {
  const modal = document.getElementById("global-modal");
  const modalBox = document.getElementById("modal-box");
  const modalTitle = document.getElementById("modal-title");
  const modalMessage = document.getElementById("modal-message");
  const modalActions = document.getElementById("modal-actions");

  if (!modal || !modalBox || !modalTitle || !modalMessage || !modalActions) {
    console.error("Custom modal elements are missing.");
    return;
  }

  const allowedTypes = ["info", "success", "error", "warning", "confirm"];
  const modalType = allowedTypes.includes(type) ? type : "info";

  modalTitle.textContent = title;
  modalMessage.textContent = message;

  // Apply the color theme for this notification.
  modalBox.classList.remove(
    "modal-info",
    "modal-success",
    "modal-error",
    "modal-warning",
    "modal-confirm"
  );
  modalBox.classList.add(`modal-${modalType}`);

  modalActions.innerHTML = "";

  buttons.forEach(btn => {
    const button = document.createElement("button");
    button.textContent = btn.text;
    button.className = `modal-btn ${btn.className || ""}`;

    button.onclick = () => {
      hideModal();

      if (btn.onClick) {
        setTimeout(() => btn.onClick(), 220);
      }
    };

    modalActions.appendChild(button);
  });

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  modalBox.classList.remove("scale-95", "opacity-0");
  modalBox.classList.add("scale-100", "opacity-100");
}

function alertModal(message, title = "Notification", type) {
  // Choose a theme automatically from the title when none is specified.
  const titleText = title.toLowerCase();



  if (!type) {
    if (titleText.includes("success")) type = "success";
    else if (titleText.includes("error") || titleText.includes("failed")) type = "error";
    else if (titleText.includes("warning")) type = "warning";
    else type = "info";
  }

  showModal({
    title,
    message,
    type,
    buttons: [
      { text: "OK", className: "modal-primary" }
    ]
  });
}

function confirmModal(message, onConfirm, title = "Confirm Action") {
  showModal({
    title,
    message,
    type: "confirm",
    buttons: [
      { text: "Cancel", className: "modal-cancel" },
      { text: "Confirm", className: "modal-primary", onClick: onConfirm }
    ]
  });
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

  /* ===== EMPLOYEE PROFILE EDITOR: PREVIEW ONLY ===== */

  const avatarImg = document.getElementById("user");
  const avatarChangeButton = document.querySelector(".change-avatar-btn");

  const profileEditor = document.getElementById("profile-editor-modal");
  const closeProfileEditor = document.getElementById("close-profile-editor");
  const cancelProfileEditor = document.getElementById("cancel-profile-editor");

  const profilePhotoFile = document.getElementById("profile-photo-file");
  const previewImage = document.getElementById("profile-preview-image");
  const initialsPreview = document.getElementById("profile-initials-preview");
  const initialsText = document.getElementById("profile-initials-text");
  const previewCaption = document.getElementById("profile-preview-caption");
  const profileStatus = document.getElementById("profile-editor-status");

  const zoomSlider = document.getElementById("profile-photo-zoom");
  const horizontalSlider = document.getElementById("profile-photo-horizontal");
  const verticalSlider = document.getElementById("profile-photo-vertical");

  const initialsButton = document.getElementById("use-initials-avatar");
  const restoreDefaultButton = document.getElementById("restore-default-avatar");
  const colorOptions = document.querySelectorAll(".avatar-color-option");

  const DEFAULT_AVATAR = "gojo.jpeg";

  let profilePreviewMode = "photo";
  let selectedInitialsColor = "#002F6C";
  let previewObjectUrl = null;

  function getEmployeeInitials() {
    const name =
      document.getElementById("user-name-sidebar")?.textContent?.trim() || "User";

    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function updateProfilePreview() {
    if (profilePreviewMode === "initials") {
      previewImage.hidden = true;
      initialsPreview.hidden = false;
      initialsPreview.style.backgroundColor = selectedInitialsColor;
      initialsText.textContent = getEmployeeInitials();
      previewCaption.textContent = "Initials avatar preview";
      return;
    }

    previewImage.hidden = false;
    initialsPreview.hidden = true;

    previewImage.style.transform = `scale(${zoomSlider.value})`;
    previewImage.style.objectPosition =
      `${horizontalSlider.value}% ${verticalSlider.value}%`;

    previewCaption.textContent =
      profilePreviewMode === "default"
        ? "Default picture preview"
        : "Profile picture preview";
  }

  function openProfileEditor() {
    if (!profileEditor) return;

    // Start with the currently displayed avatar.
    if (avatarImg?.getAttribute("src")) {
      previewImage.src = avatarImg.src;
    }

    zoomSlider.value = 1;
    horizontalSlider.value = 50;
    verticalSlider.value = 50;

    profilePreviewMode = "photo";
    profilePhotoFile.value = "";
    profileStatus.textContent = "";

    colorOptions.forEach((option) => {
      const selected = option.dataset.color === selectedInitialsColor;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });

    updateProfilePreview();
    profileEditor.hidden = false;
  }

  function closeProfileEditorModal() {
    profileEditor.hidden = true;
    profilePhotoFile.value = "";

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  // Open editor when clicking the avatar or its change-picture control.
  avatarImg?.addEventListener("click", openProfileEditor);

  avatarChangeButton?.addEventListener("click", (event) => {
    event.preventDefault();
    openProfileEditor();
  });

  // Close or cancel without saving.
  closeProfileEditor?.addEventListener("click", closeProfileEditorModal);
  cancelProfileEditor?.addEventListener("click", closeProfileEditorModal);

  profileEditor?.addEventListener("click", (event) => {
    if (event.target === profileEditor) {
      closeProfileEditorModal();
    }
  });

  // Select a photo and preview it locally. Nothing uploads yet.
  profilePhotoFile?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      profileStatus.textContent = "Please select a valid image file.";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      profileStatus.textContent = "Please choose an image smaller than 5 MB.";
      profilePhotoFile.value = "";
      return;
    }

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }

    previewObjectUrl = URL.createObjectURL(file);
    previewImage.src = previewObjectUrl;

    profilePreviewMode = "photo";
    zoomSlider.value = 1;
    horizontalSlider.value = 50;
    verticalSlider.value = 50;
    profileStatus.textContent = "Photo selected. Changes have not been saved.";

    updateProfilePreview();
  });

  // Live crop/reposition preview.
  zoomSlider?.addEventListener("input", updateProfilePreview);
  horizontalSlider?.addEventListener("input", updateProfilePreview);
  verticalSlider?.addEventListener("input", updateProfilePreview);

  // Choose an initials avatar.
  initialsButton?.addEventListener("click", () => {
    profilePreviewMode = "initials";
    profileStatus.textContent = "Initials avatar selected. Changes have not been saved.";
    updateProfilePreview();
  });

  // Choose an initials background color.
  colorOptions.forEach((option) => {
    option.addEventListener("click", () => {
      selectedInitialsColor = option.dataset.color;

      colorOptions.forEach((item) => {
        const selected = item === option;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });

      if (profilePreviewMode === "initials") {
        updateProfilePreview();
      }
    });
  });

  // Preview the default picture again.
  restoreDefaultButton?.addEventListener("click", () => {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }

    previewImage.src = DEFAULT_AVATAR;
    profilePhotoFile.value = "";

    zoomSlider.value = 1;
    horizontalSlider.value = 50;
    verticalSlider.value = 50;

    profilePreviewMode = "default";
    profileStatus.textContent =
      "Default picture selected. It will not change until you save.";

    updateProfilePreview();
  });

  // Escape closes the editor while it is open.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && profileEditor && !profileEditor.hidden) {
      closeProfileEditorModal();
    }
  });


  // ===== SAVE PROFILE AVATAR TO SUPABASE =====

  const saveProfileButton = document.getElementById("save-profile-editor");

  async function createFinalAvatarBlob() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Unable to prepare the avatar image.");
    }

    // High-quality square avatar.
    const size = 512;
    canvas.width = size;
    canvas.height = size;

    if (profilePreviewMode === "initials") {
      ctx.fillStyle = selectedInitialsColor;
      ctx.fillRect(0, 0, size, size);

      const initials = getEmployeeInitials();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 190px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials, size / 2, size / 2, size - 40);
    } else {
      const image = new Image();

      // Must be set before assigning the image URL.
      image.crossOrigin = "anonymous";
      image.src = previewImage.src;
      await new Promise((resolve, reject) => {
        if (image.complete && image.naturalWidth > 0) {
          resolve();
          return;
        }

        image.onload = resolve;
        image.onerror = () => reject(
          new Error("Unable to load the selected profile picture.")
        );
      });

      const zoom = Number(zoomSlider.value);
      const horizontal = Number(horizontalSlider.value) / 100;
      const vertical = Number(verticalSlider.value) / 100;

      // Calculate the same cover crop used by the preview.
      const scale = Math.max(
        size / image.naturalWidth,
        size / image.naturalHeight
      ) * zoom;

      const cropWidth = size / scale;
      const cropHeight = size / scale;

      const sourceX =
        (image.naturalWidth - cropWidth) * horizontal;
      const sourceY =
        (image.naturalHeight - cropHeight) * vertical;

      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        cropWidth,
        cropHeight,
        0,
        0,
        size,
        size
      );
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Could not create the final avatar image."));
          }
        },
        "image/jpeg",
        0.92
      );
    });
  }

  saveProfileButton?.addEventListener("click", async () => {
    if (saveProfileButton.disabled) return;

    const originalText = saveProfileButton.textContent;

    saveProfileButton.disabled = true;
    saveProfileButton.textContent = "Saving...";
    profileStatus.textContent = "Preparing your profile picture...";

    try {
      // Verify the current user.
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      // Create the finished image from the preview.
      const avatarBlob = await createFinalAvatarBlob();

      const filePath = `${user.id}/avatar-${Date.now()}.jpg`;

      // Upload the finished image to the existing bucket.
      const { error: uploadError } = await supabase
        .storage
        .from("profiles_photo")
        .upload(filePath, avatarBlob, {
          cacheControl: "3600",
          contentType: "image/jpeg",
          upsert: false
        });

      if (uploadError) {
        throw new Error("Avatar upload failed: " + uploadError.message);
      }

      // Get its public URL.
      const { data: publicData } = supabase
        .storage
        .from("profiles_photo")
        .getPublicUrl(filePath);

      const imageUrl = publicData?.publicUrl;

      if (!imageUrl) {
        throw new Error("Could not retrieve the uploaded avatar URL.");
      }

      // Save the URL to the employee's profile.
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ avatar_url: imageUrl })
        .eq("id", user.id);

      if (dbError) {
        throw new Error("Profile update failed: " + dbError.message);
      }

      // Update the interface only after the database update succeeds.
      avatarImg.src = imageUrl;
      if (typeof currentUserProfile !== "undefined" && currentUserProfile) {
        currentUserProfile.avatar_url = imageUrl;
      }

      profileStatus.textContent = "Profile picture saved successfully!";

      if (typeof alertModal === "function") {
        alertModal("Your profile picture has been saved successfully!", "Success");
      }

      closeProfileEditorModal();

    } catch (error) {
      console.error("Profile avatar save error:", error);
      profileStatus.textContent = error.message || "Unable to save your profile picture.";

      console.error("Avatar save failed:", error.message);
    } finally {
      saveProfileButton.disabled = false;
      saveProfileButton.textContent = originalText;
    }
  });

  // ===== END SAVE PROFILE AVATAR TO SUPABASE =====


  /* ===== END EMPLOYEE PROFILE EDITOR ===== */




  // --- Page Navigation and Content Loading ---

  async function showPage(pageId) {
    // Hide all page contents and reset their animations
    document.querySelectorAll('.content-section').forEach(page => {
      page.classList.remove('active', 'elms-page-enter');
    });

    // Show the requested page content
    const currentPageContent = document.getElementById(pageId + '-content');

    if (currentPageContent) {
      currentPageContent.classList.add('active');

      // Restart the animation each time the page is opened
      void currentPageContent.offsetWidth;
      currentPageContent.classList.add('elms-page-enter');
    } else {
      console.warn(
        `Content div for pageId '${pageId}' not found.`
      );
      return;
    }

    // Update navigation link active state
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      link.classList.remove('active');
    });

    const activeNavLink = document.querySelector(
      `.sidebar-nav a[href="#${pageId}"]`
    );

    if (activeNavLink) {
      activeNavLink.classList.add('active');
    }

    // Update page title
    const titles = {
      'dashboard': 'Dashboard',
      'file-leave': 'File New Leave Request',
      'leave-history': 'Leave History'
    };

    const pageTitle = document.getElementById('page-title');

    if (pageTitle) {
      pageTitle.textContent = titles[pageId] || 'ELMS';
    }

    // Preserve existing page-loading behavior
    if (pageId === 'dashboard') {
      await autoLoadDashboard();
    }

    if (pageId === 'leave-history') {
      await loadLeaveHistory();
    }
  }


  //log-out

  async function handleLogout() {
    confirmModal(
      "Are you sure you want to log out?",
      async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
          console.error("Logout error:", error.message);
          alertModal("Unable to log out. Please try again.", "Logout Error");
        } else {
          window.location.href = "login.html";
        }
      },
      "Confirm Logout"
    );
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
      if (isWellnessLeave || !isOfficialLeaveType) {
        setTemplateCell(
          "B41",
          displayLeaveType || "Other Leave"
        );
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



  /* ==========================================
     ELMS EMPLOYEE GUIDED TOUR
     Does not submit forms or modify employee data
     ========================================== */

  const employeeTour = (() => {
    const overlay = document.getElementById("employee-tour-overlay");
    const card = document.getElementById("employee-tour-card");
    const title = document.getElementById("employee-tour-title");
    const description = document.getElementById("employee-tour-description");
    const stepLabel = document.getElementById("employee-tour-step-label");
    const progress = document.getElementById("employee-tour-progress");
    const progressFill = document.getElementById("employee-tour-progress-fill");
    const backButton = document.getElementById("employee-tour-back");
    const nextButton = document.getElementById("employee-tour-next");
    const skipButton = document.getElementById("employee-tour-skip");
    const helpButton = document.getElementById("start-employee-tour");

    const storageKey = `elms_employee_tour_seen_${user.id}_v1`;

    let currentStep = 0;
    let activeTarget = null;
    let tourOpen = false;
    let positionTimer = null;

    const steps = [
      {
        label: "Welcome",
        title: "Welcome to ELMS!",
        description:
          "This quick tour will introduce your employee dashboard, leave application, leave history, and profile customization. You can skip the tour at any time.",
        page: "dashboard",
        target: null,
        button: "Start Tour"
      },
      {
        label: "Step 1 of 7",
        title: "Your Dashboard",
        description:
          "Here you can review your leave statistics, including pending requests, approved leaves, total leave days, and your upcoming leave. The information updates from your existing leave records.",
        page: "dashboard",
        target: ".stats-container",
        button: "Next"
      },
      {
        label: "Step 2 of 7",
        title: "File a Leave Request",
        description:
          "Choose File Leave from the sidebar whenever you need to apply for leave. We'll look at the form together without submitting anything.",
        page: "file-leave",
        target: "#leave_type_form",
        button: "Next"
      },
      {
        label: "Step 3 of 7",
        title: "Choose Your Leave Dates",
        description:
          "Select the appropriate leave type, then enter your start date and end date. Make sure the dates match your intended application.",
        page: "file-leave",
        target: ".form-row.two-columns",
        button: "Next"
      },
      {
        label: "Step 4 of 7",
        title: "Provide Your Reason",
        description:
          "Enter the reason for your leave in this field. Before submitting a real application, review all your entries carefully. This tour will not submit the form.",
        page: "file-leave",
        target: "#reason_brief",
        button: "Next"
      },
      {
        label: "Step 5 of 7",
        title: "Check Your Leave History",
        description:
          "Your leave history lets you review previously filed requests, dates, statuses, and any notes from the administrator. Available requests may also have a CS Form No. 6 generation button.",
        page: "leave-history",
        target: "#leave-history-content .history-preview",
        button: "Next"
      },
      {
        label: "Step 6 of 7",
        title: "Personalize Your Profile",
        description:
          "Click your profile picture in the sidebar to open the profile editor. You can preview a photo, adjust its crop, use initials, or restore the default picture. Saving is not part of this tour.",
        page: "leave-history",
        target: ".avatar-wrapper",
        button: "Next"
      },
      {
        label: "Step 7 of 7",
        title: "You're Ready to Use ELMS!",
        description:
          "You're all set! Use the sidebar to navigate the system, check your application status, and keep your profile up to date. Remember to review your details before filing a real leave request.",
        page: "dashboard",
        target: null,
        button: "Finish Tour"
      }
    ];

    function clearHighlight() {
      if (activeTarget) {
        activeTarget.classList.remove("elms-tour-highlight");
        activeTarget = null;
      }
    }

    function positionCard() {
      if (!tourOpen || !card || card.hidden) return;

      const target = activeTarget;

      // Welcome and finish screens appear in the center.
      if (!target || !target.isConnected) {
        card.style.left = "50%";
        card.style.top = "50%";
        card.style.transform = "translate(-50%, -50%)";
        return;
      }

      const rect = target.getBoundingClientRect();
      const margin = 12;
      const cardWidth = card.offsetWidth;
      const cardHeight = card.offsetHeight;

      let left = Math.max(
        margin,
        Math.min(
          rect.left + rect.width / 2 - cardWidth / 2,
          window.innerWidth - cardWidth - margin
        )
      );

      let top = rect.bottom + 18;

      // Place the instructions above the target when there isn't enough room.
      if (top + cardHeight > window.innerHeight - margin) {
        top = rect.top - cardHeight - 18;
      }

      // If the target is near the top or bottom, keep the card on screen.
      top = Math.max(
        margin,
        Math.min(top, window.innerHeight - cardHeight - margin)
      );

      left = Math.max(
        margin,
        Math.min(left, window.innerWidth - cardWidth - margin)
      );

      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      card.style.transform = "none";
    }

    function closeTour({ remember = true } = {}) {
      tourOpen = false;
      clearTimeout(positionTimer);
      clearHighlight();

      if (overlay) overlay.hidden = true;
      if (card) card.hidden = true;

      if (remember) {
        try {
          localStorage.setItem(storageKey, "1");
        } catch (error) {
          console.warn("Unable to save tour preference:", error);
        }
      }
    }

    async function renderStep(index) {
      if (!steps.length || !tourOpen) return;

      currentStep = Math.max(0, Math.min(index, steps.length - 1));

      const step = steps[currentStep];

      clearHighlight();

      // Navigate using the existing ELMS page-navigation function.
      if (step.page) {
        await showPage(step.page);
      }

      if (!tourOpen) return;

      title.textContent = step.title;
      description.textContent = step.description;
      stepLabel.textContent = step.label;
      nextButton.textContent = step.button;

      backButton.hidden = currentStep === 0;

      const percentage =
        Math.round(((currentStep + 1) / steps.length) * 100);

      progressFill.style.width = `${percentage}%`;
      progress.setAttribute("aria-valuenow", String(percentage));

      const target = step.target
        ? document.querySelector(step.target)
        : null;

      if (target) {
        activeTarget = target;

        // Make the target visible before calculating the card position.
        target.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "nearest"
        });

        target.classList.add("elms-tour-highlight");
      }

      positionCard();
    }

    async function startTour() {
      if (!overlay || !card || !title || !description ||
        !stepLabel || !progress || !progressFill ||
        !backButton || !nextButton || !skipButton) {
        console.error("Employee tour HTML is incomplete.");
        return;
      }

      // Do not interrupt the profile editor if it is already open.
      const profileEditor = document.getElementById("profile-editor-modal");

      if (profileEditor && !profileEditor.hidden) {
        alertModal(
          "Please close the profile editor before starting the guided tour.",
          "Close Profile Editor"
        );
        return;
      }

      tourOpen = true;
      currentStep = 0;

      overlay.hidden = false;
      card.hidden = false;

      await renderStep(0);
    }

    nextButton?.addEventListener("click", async () => {
      if (currentStep === steps.length - 1) {
        closeTour();
        return;
      }

      await renderStep(currentStep + 1);
    });

    backButton?.addEventListener("click", async () => {
      if (currentStep > 0) {
        await renderStep(currentStep - 1);
      }
    });

    skipButton?.addEventListener("click", () => {
      closeTour();
    });

    helpButton?.addEventListener("click", () => {
      startTour();
    });

    document.addEventListener("keydown", (event) => {
      if (tourOpen && event.key === "Escape") {
        closeTour();
      }
    });

    window.addEventListener("resize", () => {
      if (tourOpen) positionCard();
    });

    window.addEventListener("scroll", () => {
      if (tourOpen) positionCard();
    }, true);

    // Start automatically for employees who haven't seen the tour
    // in this browser. The Help button remains available for replay.
    try {
      if (!localStorage.getItem(storageKey)) {
        setTimeout(() => {
          startTour();
        }, 700);
      }
    } catch (error) {
      console.warn("Unable to read tour preference:", error);
    }

    return {
      start: startTour,
      close: closeTour
    };
  })();

  /* ===== END EMPLOYEE GUIDED TOUR ===== */

});