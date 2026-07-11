const API =
"https://script.google.com/macros/s/AKfycbwyM8rCotS82akaIoAEam1ylIqno04E-ABi-iY8_8kxCIvbN8bhpratQEXZ_tN9Qn36qw/exec";

let qr;
let currentTicket = "";

window.onload = () => {
    startScanner();

    document
        .getElementById("btnCheckin")
        .addEventListener("click", checkin);
};

async function startScanner() {

    document.getElementById("ticket").classList.add("hide");
    document.getElementById("reader").style.display = "block";

    if (qr) {
        try {
            await qr.stop();
        } catch (e) {}
    }

    qr = new Html5Qrcode("reader");

    qr.start(
        {
            facingMode: "environment"
        },
        {
            fps: 10,
            qrbox: 250
        },
        async (decodedText) => {

            currentTicket = decodedText;

            await qr.stop();

            timVe(decodedText);

        },
        () => {}
    );
}

async function timVe(maVe) {

    showToast("Đang tìm vé...");

    const res = await fetch(
        API +
        "?action=timVe&maVe=" +
        encodeURIComponent(maVe)
    );

    const data = await res.json();

    if (data == "NOTFOUND") {

        showToast("❌ Không tìm thấy vé");

        setTimeout(startScanner,1500);

        return;

    }

    document.getElementById("reader").style.display = "none";
    document.getElementById("ticket").classList.remove("hide");

    document.getElementById("ten").innerHTML = "👤 " + data.ten;
document.getElementById("mave").innerHTML = data.maVe;
document.getElementById("soluong").innerHTML = data.soLuong;
document.getElementById("thanhtoan").innerHTML = data.trangThai;

// Hiển thị số vé đã dùng
document.getElementById("checkin").innerHTML =
    data.daVao + "/" + data.soLuong + " vé";

}

async function checkin() {

    const res = await fetch(
        API +
        "?action=checkin&maVe=" +
        encodeURIComponent(currentTicket)
    );

    const msg = await res.json();

    showToast(msg);

    if (msg.startsWith("✅")) {

        document.body.classList.add("success");

        beep();

        if (navigator.vibrate)
            navigator.vibrate(200);

    } else {

        document.body.classList.add("error");

    }

    setTimeout(() => {

        document.body.classList.remove("success");
        document.body.classList.remove("error");

        startScanner();

    },1500);

}

function beep(){

    new Audio(
        "https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg"
    ).play();

}

function showToast(text){

    const t = document.getElementById("toast");

    t.innerHTML = text;

    t.style.display = "block";

    setTimeout(()=>{
        t.style.display="none";
    },1500);

}
