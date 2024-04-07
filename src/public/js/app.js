const socket = io();

const myFace = document.getElementById("myFace");

let myStream;

async function getMedia() {
    try {
        myStream = await navigator.mediaDevice.getUserMedia({
            audio: true,
            video: true,
        });
        console.log(myStream);
    } catch (e) {
        console.log(e);
    }
}

getMedia();