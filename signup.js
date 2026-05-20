// signup.js

// Handle Signup Form
async function handleSignup(e) {
    e.preventDefault();

    const fullName = document.querySelector('input[placeholder*="full name"], input[type="text"]').value.trim();
    const email = document.querySelector('input[type="email"]').value.trim();
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    const password = passwordInputs[0]?.value;
    const confirmPassword = passwordInputs[1]?.value;
    const departmentRaw = document.getElementById("department")?.value;
    const department = departmentRaw ? departmentRaw.trim() : null;

    if (!email || !password || !confirmPassword) {
        alert("Please fill in all fields");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters long");
        return;
    }

    try {
        const { data, error } = await window.supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName || null
                }
            }
        });

        if (error) throw error;

        alert("Sign up successful! Please check your email to confirm your account.");
        window.location.href = "login.html";   // Redirect to login after signup

    } catch (error) {
        console.error("Signup error:", error);
        alert("Signup failed: " + error.message);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', handleSignup);
    }
});