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
let myDataChannel;

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
    if(myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection
            .getSenders()
            .find(sender=>sender.track.kind === 'video');
        await videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteBtnClick);
cameraBtn.addEventListener("click", handleCameraBtnClick);
camerasSelect.addEventListener("change", handleCameraChange);

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
    myDataChannel = myPeerConnection.createDataChannel("chat");
    myDataChannel.addEventListener("message", (event) => console.log(event.data));
    console.log("made data channel");
    const offer = await myPeerConnection.createOffer();
    await myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
    myPeerConnection.addEventListener("datachannel", (event)=>{
        myDataChannel = event.channel;
        myDataChannel.addEventListener("message", (event) => console.log(event.data));
    });
    console.log("received the offer");
    await myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    await myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log("sent the answer");
});

socket.on("answer", async (answer) => {
    console.log("received the answer");
    await myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", async (ice) => {
    console.log("received candidate");
    await myPeerConnection.addIceCandidate(ice);
});

// RTC code
function makeConnection(){
    myPeerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
            ]
        }]
        // iceServers: [{
        //     urls: [ "stun:hk-turn1.xirsys.com" ]
        // }, {
        //     username: "s91XRMPFa4xJEuWfvTSSHsW2-kNJXlx_aAACyBJBZ1EQsUjJM-O6_FbDWWp2XzHbAAAAAGYSMZh1bnRpbDc2NTg=",
        //     credential: "385dab6a-f4a1-11ee-8053-0242ac120004",
        //     urls: [
        //         "turn:hk-turn1.xirsys.com:80?transport=udp",
        //         "turn:hk-turn1.xirsys.com:3478?transport=udp",
        //         "turn:hk-turn1.xirsys.com:80?transport=tcp",
        //         "turn:hk-turn1.xirsys.com:3478?transport=tcp",
        //         "turns:hk-turn1.xirsys.com:443?transport=tcp",
        //         "turns:hk-turn1.xirsys.com:5349?transport=tcp"
        //     ]
        // }]
    });
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myStream
        .getTracks()
        .forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
    console.log("sent candidate");
    socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
    // console.log("got an stream from my peer");
    // console.log("Peer's Stream", data.stream);
    // console.log("My stream", myStream);
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = data.stream;
}
