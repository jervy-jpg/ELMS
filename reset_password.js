document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("resetPasswordForm");
    const message = document.getElementById("message");

    // Initially hide the form until we confirm
    // that the user has a valid recovery session.
    form.style.display = "none";

    function showMessage(text) {
        message.textContent = text;
    }

    // Listen for Supabase authentication events.
    const { data: authListener } =
        window.supabaseClient.auth.onAuthStateChange(async (event, session) => {

            console.log("Auth event:", event);

            if (event === "PASSWORD_RECOVERY") {

                if (!session) {
                    showMessage(
                        "This password recovery link is invalid or has expired."
                    );
                    return;
                }

                console.log("✅ Password recovery session established.");

                form.style.display = "block";
                showMessage("Enter your new password.");
            }
        });


    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const newPassword =
            document.getElementById("newPassword").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;


        // Check password confirmation
        if (newPassword !== confirmPassword) {

            showMessage("Passwords do not match.");

            return;
        }


        // Check minimum password length
        if (newPassword.length < 6) {

            showMessage(
                "Password must be at least 6 characters."
            );

            return;
        }


        try {

            // Make sure there is actually a logged-in
            // recovery session.
            const {
                data: { user },
                error: userError
            } = await window.supabaseClient.auth.getUser();


            if (userError || !user) {

                showMessage(
                    "Your recovery session is invalid or has expired. Please request a new password reset link."
                );

                return;
            }


            console.log(
                "Updating password for recovery user:",
                user.email
            );


            // Update the password of the authenticated
            // recovery user.
            const { error } =
                await window.supabaseClient.auth.updateUser({
                    password: newPassword
                });


            if (error) {
                throw error;
            }


            showMessage(
                "Password updated successfully! Redirecting to login..."
            );


            // Sign out the recovery session before
            // returning to the login page.
            await window.supabaseClient.auth.signOut();


            setTimeout(() => {

                window.location.href = "login.html";

            }, 2000);


        } catch (error) {

            console.error(
                "❌ Password update error:",
                error
            );

            showMessage(
                "Could not update password: " +
                error.message
            );
        }

    });

});