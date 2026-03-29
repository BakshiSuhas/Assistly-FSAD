document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const themeToggle = document.getElementById("themeToggle");
    const storedTheme = localStorage.getItem("assistly-theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = storedTheme || (prefersDark ? "dark" : "light");

    function applyTheme(theme) {
        root.setAttribute("data-theme", theme);
        if (themeToggle) {
            const icon = themeToggle.querySelector("i");
            if (icon) {
                icon.className = theme === "dark" ? "bi bi-moon-stars-fill" : "bi bi-sun-fill";
            }
        }
    }

    applyTheme(initialTheme);

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
            localStorage.setItem("assistly-theme", nextTheme);
            applyTheme(nextTheme);
        });
    }

    const modeSelector = document.getElementById("modeSelector");
    if (modeSelector) {
        modeSelector.addEventListener("change", async (event) => {
            const mode = event.target.value;
            const response = await fetch("/dashboard/mode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
            });
            if (response.ok) {
                window.location.reload();
            }
        });
    }

    const mapEl = document.getElementById("map");
    if (mapEl && window.L) {
        const map = L.map("map").setView([12.9716, 77.5946], 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const latField = document.getElementById("latField");
        const lngField = document.getElementById("lngField");
        let marker = null;

        function setMarker(lat, lng) {
            if (marker) {
                marker.setLatLng([lat, lng]);
            } else {
                marker = L.marker([lat, lng]).addTo(map);
            }
            if (latField) latField.value = lat;
            if (lngField) lngField.value = lng;
        }

        map.on("click", async (e) => {
            const lat = e.latlng.lat.toFixed(6);
            const lng = e.latlng.lng.toFixed(6);
            setMarker(lat, lng);
            await fetch("/dashboard/location", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lng }),
            });
        });

        const detectBtn = document.getElementById("detectLocationBtn");
        if (detectBtn) {
            detectBtn.addEventListener("click", () => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const lat = position.coords.latitude.toFixed(6);
                    const lng = position.coords.longitude.toFixed(6);
                    map.setView([lat, lng], 14);
                    setMarker(lat, lng);
                    await fetch("/dashboard/location", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ lat, lng }),
                    });
                });
            });
        }
    }

    const notificationBadge = document.getElementById("notificationBadge");
    if (notificationBadge) {
        setInterval(async () => {
            try {
                const response = await fetch("/notifications");
                if (!response.ok) return;
                const data = await response.json();
                notificationBadge.textContent = `${data.accepted_count} accepted | ${data.completed_count} completed`;
            } catch (err) {
                // Ignore network hiccups for non-blocking polling.
            }
        }, 12000);
    }
});
