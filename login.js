// login.js - Complete Login Functionality

async function handleLogin(e) {
    e.preventDefault();

    // Get form values
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    // Basic validation
    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    try {
        console.log("Attempting login with:", email);

        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            throw error;
        }

        // Login successful
        console.log("✅ Login successful!", data.user);

        // ✅ NEW CODE — Redirect based on user type
        // After login success...

        // Get current user details
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            alert("Login failed");
            return;
        }

        // Fetch their profile to check user_type
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('user_type')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error(profileError);
            alert("Could not verify user access");
            return;
        }

        // REDIRECT BASED ON ROLE
        if (profile.user_type.trim().toLowerCase() === 'admin') {
            // Send admins to admin panel
            window.location.href = 'admin_page.html';
        } else {
            // Send normal users to user dashboard
            window.location.href = "user_home_page.html";
        }
       


    } catch (error) {
        console.error("❌ FULL ERROR OBJECT:", error);
        alert("Login failed: " + error.message);
    }
}


// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');

    if (form) {
        form.addEventListener('submit', handleLogin);
        console.log("✅ Login form handler attached successfully");
    } else {
        console.error("❌ Login form not found in the HTML");
    }
})