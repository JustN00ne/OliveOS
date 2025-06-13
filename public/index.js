feather.replace(); // Initialize Feather icons globally

document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    // --- Time/Date Update ---
    function pad(num) { return num.toString().padStart(2, '0'); }
    function updateDateTime() {
        const now = new Date();
        const timeEl = document.getElementById('time_currently');
        const dateEl = document.getElementById('date_currently');
        if (timeEl) timeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        if (dateEl) dateEl.textContent = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);
    // --- End Time/Date ---

    // --- Animate status pills (hidden-anim) ---
    const items = document.querySelectorAll('.hidden-anim');
    items.forEach((item, index) => {
        item.classList.add('animated-item');
        item.style.animationDelay = `${index * 0.1}s`;
    });
    setTimeout(() => {
        items.forEach(item => {
            item.classList.remove('hidden-anim');
        });
    }, 50);
    // --- End status pill animation ---
});