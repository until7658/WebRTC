const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const welcome = document.getElementById("welcome");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label === camera.label) {
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        });
    }catch (e) {
        console.log(e);
    }
}

async function getMedia(deviceId) {
    const initialConstrains = {
        audio: true,
        video: { facingMode: "user" },
    }
    const cameraConstraints = {
        audio: true,
        video: {
            video: {
                deviceId: {
                    exact: deviceId
                }
            }
        }
    }
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId? cameraConstraints: initialConstrains
        );
        myFace.srcObject = myStream;
        if(!deviceId) {
            await getCameras();
        }
    } catch (e) {
        console.log(e);
    }
}

function handleMuteBtnClick() {
    myStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    if(!muted) {
        muteBtn.innerHTML = "Unmute";
        muted = true;
    } else {
        muteBtn.innerHTML = "Mute";
        muted = false;
    }
}
function handleCameraBtnClick() {
    myStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    if(cameraOff) {
        cameraBtn.innerHTML = "Turn Camera Off";
        cameraOff = false;
    } else {
        cameraBtn.innerHTML = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange() {
    await getMedia(camerasSelect.value);
}

muteBtn.addEventListener("click", handleMuteBtnClick);
cameraBtn.addEventListener("click", handleCameraBtnClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome, Form (join a room )

const welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcome.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

socket.on("welcome", async () => {
    console.log("someone joined");
    const offer = await myPeerConnection.createOffer();
    await myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
    await myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    console.log(answer);
    await myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
});

socket.on("answer", async (answer) => {
    await myPeerConnection.setRemoteDescription(answer);
});

// RTC code
function makeConnection(){
    myPeerConnection = new RTCPeerConnection();
    myStream
        .getTracks()
        .forEach(track => myPeerConnection.addTrack(track, myStream));
}
