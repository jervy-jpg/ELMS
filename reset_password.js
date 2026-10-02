document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("resetPasswordForm");
    const message = document.getElementById("message");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById("newPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (newPassword !== confirmPassword) {
            message.textContent = "Passwords do not match.";
            return;
        }

        if (newPassword.length < 6) {
            message.textContent = "Password must be at least 6 characters.";
            return;
        }

        try {

            const { error } = await window.supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                throw error;
            }

            message.textContent = "Password updated successfully!";

            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);

        } catch (error) {

            console.error("❌ Password update error:", error);

            message.textContent =
                "Could not update password: " + error.message;
        }
    });

});