
 // signup.js

// Handle Signup Form
async function handleSignup(e) {
    e.preventDefault();

    // Read the separate name fields
    const lastName = document.getElementById("lastname").value.trim();
    const firstName = document.getElementById("firstname").value.trim();
    const middleName = document.getElementById("middlename").value.trim();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm_password").value;

    // Format: LAST NAME, FIRST NAME MIDDLE NAME
    const fullName = middleName
        ? `${lastName}, ${firstName} ${middleName}`
        : `${lastName}, ${firstName}`;

    if (!lastName || !firstName || !email || !password || !confirmPassword) {
        alert("Please fill in all required fields.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
    }

    try {
        const { data, error } = await window.supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    last_name: lastName,
                    first_name: firstName,
                    middle_name: middleName || null
                }
            }
        });

        if (error) throw error;

        alert("Sign up successful! Please check your email to confirm your account.");
        window.location.href = "login.html";

    } catch (error) {
        console.error("Signup error:", error);
        alert("Signup failed: " + error.message);
    }
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");

    if (form) {
        form.addEventListener("submit", handleSignup);
    }
});
