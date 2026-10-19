
/* =========================================
   THỞ ZỐC CHECK-IN
   ========================================= */

// DÁN URL WEB APP ĐANG HOẠT ĐỘNG CỦA BẠN VÀO ĐÂY
const API = "https://script.google.com/macros/s/AKfycbxoJg7XfvIUwEwEDCtfN_QClBRF1vLA25L2WTJGurNx_egT7xyw0xPfb6hzjVn5r6hHbg/exec";

let qr = null;
let currentTicket = "";
let isProcessing = false;

// Khởi động trang
window.addEventListener("load", () => {
    const btn = document.getElementById("btnCheckin");

    if (btn) {
        btn.addEventListener("click", checkin);
    }

    startScanner();
});

// Chuẩn hóa mã vé, không tự ý lấy mã từ URL hay nội dung khác
function normalizeTicketCode(value) {
    return String(value || "").trim();
}

// Mở camera và quét QR
async function startScanner() {
    if (isProcessing) return;

    const reader = document.getElementById("reader");
    const ticket = document.getElementById("ticket");

    ticket.classList.add("hide");
    reader.style.display = "block";

    try {
        if (qr) {
            try {
                if (qr.isScanning) {
                    await qr.stop();
                }
            } catch (e) {}

            try {
                qr.clear();
            } catch (e) {}
        }

        qr = new Html5Qrcode("reader");

        await qr.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            async (decodedText) => {
                if (isProcessing) return;

                isProcessing = true;
                currentTicket = normalizeTicketCode(decodedText);

                try {
                    await qr.stop();
                } catch (e) {}

                console.log("QR đọc được:", currentTicket);

                await timVe(currentTicket);
            },
            () => {}
        );

        const loading = document.getElementById("loading");
        if (loading) loading.style.display = "none";

    } catch (error) {
        console.error("Lỗi mở camera:", error);
        showToast("❌ Không mở được camera. Kiểm tra quyền truy cập camera.");
        isProcessing = false;
    }
}

// Tra cứu thông tin vé
async function timVe(maVe) {
    const code = normalizeTicketCode(maVe);

    if (!code) {
        showToast("❌ QR không chứa mã vé");
        resetScannerLater();
        return;
    }

    try {
        showToast("Đang tìm vé...");

        const url =
            API +
            "?action=timVe&maVe=" +
            encodeURIComponent(code) +
            "&_=" +
            Date.now();

        console.log("URL tra cứu:", url);

        const response = await fetch(url, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();

        console.log("Kết quả API:", data);

        if (
            data === "NOTFOUND" ||
            !data ||
            typeof data !== "object" ||
            data.error ||
            !data.maVe
        ) {
            const detail = data && data.error
                ? data.error
                : "Không tìm thấy mã " + code;

            showToast("❌ " + detail);
            resetScannerLater();
            return;
        }

        // Kiểm tra API trả đúng mã vừa quét
        if (
            normalizeTicketCode(data.maVe).toUpperCase() !==
            code.toUpperCase()
        ) {
            showToast("❌ Mã vé API trả về không khớp");
            resetScannerLater();
            return;
        }

        // Hiển thị thông tin vé đúng các ID trong index.html
        document.getElementById("reader").style.display = "none";
        document.getElementById("ticket").classList.remove("hide");

        document.getElementById("ten").textContent =
            "👤 " + (data.ten || "Chưa có tên");

        document.getElementById("mave").textContent =
            data.maVe;

        document.getElementById("soluong").textContent =
            Number(data.soLuong || 0);

        document.getElementById("thanhtoan").textContent =
            data.trangThai || "Chưa xác nhận";

        document.getElementById("checkin").textContent =
            "🚶 " +
            Number(data.daVao || 0) +
            "/" +
            Number(data.soLuong || 0) +
            " đã vào";

    } catch (error) {
        console.error("Lỗi tra cứu vé:", error);
        showToast("❌ Lỗi kết nối API: " + error.message);
        resetScannerLater();
    }
}

// Thực hiện check-in
async function checkin() {
    if (!currentTicket || !isProcessing) {
        showToast("❌ Vui lòng quét mã vé trước");
        return;
    }

    const btn = document.getElementById("btnCheckin");
    btn.disabled = true;

    try {
        showToast("Đang check-in...");

        const url =
            API +
            "?action=checkin&maVe=" +
            encodeURIComponent(currentTicket) +
            "&_=" +
            Date.now();

        const response = await fetch(url, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const msg = await response.json();

        showToast(msg);

        if (typeof msg === "string" && msg.startsWith("✅")) {
            document.body.classList.add("success");

            beep();

            if (navigator.vibrate) {
                navigator.vibrate(200);
            }

            // Đọc lại dữ liệu mới nhất từ Google Sheets
            await timVeSauCheckin(currentTicket);

        } else {
            document.body.classList.add("error");
        }

    } catch (error) {
        console.error("Lỗi check-in:", error);
        showToast("❌ Lỗi kết nối check-in: " + error.message);
        document.body.classList.add("error");

    } finally {
        btn.disabled = false;

        setTimeout(() => {
            document.body.classList.remove("success");
            document.body.classList.remove("error");
            startScanner();
        }, 1800);
    }
}

// Cập nhật thông tin sau check-in, không quét lại QR
async function timVeSauCheckin(maVe) {
    try {
        const url =
            API +
            "?action=timVe&maVe=" +
            encodeURIComponent(maVe) +
            "&_=" +
            Date.now();

        const response = await fetch(url, {
            cache: "no-store"
        });

        const data = await response.json();

        if (!data || typeof data !== "object" || !data.maVe) {
            return;
        }

        document.getElementById("ten").textContent =
            "👤 " + (data.ten || "Chưa có tên");

        document.getElementById("mave").textContent =
            data.maVe;

        document.getElementById("soluong").textContent =
            Number(data.soLuong || 0);

        document.getElementById("thanhtoan").textContent =
            data.trangThai || "Chưa xác nhận";

        document.getElementById("checkin").textContent =
            "🚶 " +
            Number(data.daVao || 0) +
            "/" +
            Number(data.soLuong || 0) +
            " đã vào";

    } catch (error) {
        console.error("Không cập nhật được thông tin sau check-in:", error);
    }
}

// Quay lại chế độ quét sau lỗi
function resetScannerLater() {
    setTimeout(() => {
        isProcessing = false;
        startScanner();
    }, 1800);
}

// Âm báo thành công
function beep() {
    const audio = new Audio(
        "https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg"
    );

    audio.play().catch((error) => {
        console.warn("Không phát được âm báo:", error);
    });
}

// Thông báo trên màn hình
function showToast(text) {
    const toast = document.getElementById("toast");

    if (!toast) {
        console.log(text);
        return;
    }

    toast.textContent =
        typeof text === "string"
            ? text
            : JSON.stringify(text);

    toast.style.display = "block";

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.style.display = "none";
    }, 2500);
}
