import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import server from '../environment';

const server_url = server;

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

export default function VideoMeetComponent() {

    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoref = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState(false);
    let [audio, setAudio] = useState();
    let [screen, setScreen] = useState();
    let [showModal, setModal] = useState(false);
    let [screenAvailable, setScreenAvailable] = useState();
    let [messages, setMessages] = useState([])
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");
    const videoRef = useRef([])
    let [videos, setVideos] = useState([])

    useEffect(() => {
        getPermissions();
    }, [])

    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
    }

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) { setVideoAvailable(true); } else { setVideoAvailable(false); }
            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) { setAudioAvailable(true); } else { setAudioAvailable(false); }
            if (navigator.mediaDevices.getDisplayMedia) { setScreenAvailable(true); } else { setScreenAvailable(false); }
            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) { localVideoref.current.srcObject = userMediaStream; }
                }
            }
        } catch (error) { console.log(error); }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) { getUserMedia(); }
    }, [video, audio])

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    }

    let getUserMediaSuccess = (stream) => {
        try { window.localStream.getTracks().forEach(track => track.stop()) } catch (e) { console.log(e) }
        window.localStream = stream
        localVideoref.current.srcObject = stream
        for (let id in connections) {
            if (id === socketIdRef.current) continue
            connections[id].addStream(window.localStream)
            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => { socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })) })
                    .catch(e => console.log(e))
            })
        }
        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false); setAudio(false);
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }
            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream
            for (let id in connections) {
                connections[id].addStream(window.localStream)
                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => { socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })) })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }

    let getDislayMediaSuccess = (stream) => {
        try { window.localStream.getTracks().forEach(track => track.stop()) } catch (e) { console.log(e) }
        window.localStream = stream
        localVideoref.current.srcObject = stream
        for (let id in connections) {
            if (id === socketIdRef.current) continue
            connections[id].addStream(window.localStream)
            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => { socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription })) })
                    .catch(e => console.log(e))
            })
        }
        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }
            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream
            getUserMedia()
        })
    }

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)
        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }
            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }

    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false })
        socketRef.current.on('signal', gotMessageFromServer)
        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href)
            socketIdRef.current = socketRef.current.id
            socketRef.current.on('chat-message', addMessage)
            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })
            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {
                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }
                    connections[socketListId].onaddstream = (event) => {
                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);
                        if (videoExists) {
                            setVideos(videos => {
                                const updatedVideos = videos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: event.stream } : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        } else {
                            let newVideo = { socketId: socketListId, stream: event.stream, autoplay: true, playsinline: true };
                            setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        }
                    };
                    if (window.localStream !== undefined && window.localStream !== null) {
                        connections[socketListId].addStream(window.localStream)
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        connections[socketListId].addStream(window.localStream)
                    }
                })
                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue
                        try { connections[id2].addStream(window.localStream) } catch (e) { }
                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => { socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription })) })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start(); ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo = () => { setVideo(!video); }
    let handleAudio = () => { setAudio(!audio) }

    useEffect(() => {
        if (screen !== undefined) { getDislayMedia(); }
    }, [screen])

    let handleScreen = () => { setScreen(!screen); }

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        window.location.href = "/"
    }

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [...prevMessages, { sender: sender, data: data }]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };

    let sendMessage = () => {
        socketRef.current.emit('chat-message', message, username)
        setMessage("");
    }

    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }

    const getGridStyle = (count) => {
        if (count <= 1) return { gridTemplateColumns: '1fr' }
        if (count <= 4) return { gridTemplateColumns: 'repeat(2, 1fr)' }
        if (count <= 9) return { gridTemplateColumns: 'repeat(3, 1fr)' }
        return { gridTemplateColumns: 'repeat(4, 1fr)' }
    }

    const totalParticipants = videos.length + 1;

    return (
        <div>
            {askForUsername === true ? (

                /* ── LOBBY ── */
                <div style={{
                    minHeight: '100vh', background: '#1c1c1c',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '20px'
                }}>
                    <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 600, margin: 0 }}>Join Meeting</h2>

                    <div style={{
                        position: 'relative', borderRadius: '16px', overflow: 'hidden',
                        width: '400px', height: '250px', background: '#2d2d2d'
                    }}>
                        <video ref={localVideoref} autoPlay muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{
                            position: 'absolute', bottom: '10px', left: '50%',
                            transform: 'translateX(-50%)', color: 'white', fontSize: '0.8rem',
                            background: 'rgba(0,0,0,0.55)', padding: '3px 14px', borderRadius: '20px'
                        }}>Preview</div>
                    </div>

                    <TextField
                        variant="outlined" label="Your Name" value={username}
                        onChange={e => setUsername(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && connect()}
                        sx={{
                            width: '400px',
                            '& .MuiOutlinedInput-root': { background: '#2d2d2d', borderRadius: '8px', color: 'white' },
                            '& .MuiInputLabel-root': { color: '#aaa' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' }
                        }}
                    />

                    <Button onClick={connect} variant="contained" sx={{
                        width: '400px', height: '48px', borderRadius: '8px',
                        background: '#2d8cff', fontSize: '1rem', fontWeight: 600,
                        textTransform: 'none', '&:hover': { background: '#1a7ae8' }
                    }}>
                        Join Now
                    </Button>
                </div>

            ) : (

                /* ── MEETING ── */
                <div style={{
                    width: '100vw', height: '100vh', background: '#1c1c1c',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }}>

                    {/* TOP BAR */}
                    <div style={{
                        height: '48px', background: '#2d2d2d', flexShrink: 0,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', padding: '0 20px',
                        borderBottom: '1px solid #3d3d3d'
                    }}>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>📹 Video Call </span>
                        <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                            {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* MAIN AREA */}
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                        {/* VIDEO GRID */}
                        <div style={{
                            flex: 1, display: 'grid',
                            ...getGridStyle(totalParticipants),
                            gap: '8px', padding: '12px',
                            alignContent: 'center', justifyItems: 'stretch',
                            overflow: 'hidden'
                        }}>

                            {/* Local tile */}
                            <div style={{
                                position: 'relative', background: '#2d2d2d',
                                borderRadius: '12px', overflow: 'hidden',
                                border: '2px solid #444', aspectRatio: '16/9'
                            }}>
                                <video ref={localVideoref} autoPlay muted
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                {!video && (
                                    <div style={{
                                        position: 'absolute', inset: 0, background: '#2a2a2a',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <div style={{
                                            width: '72px', height: '72px', borderRadius: '50%',
                                            background: '#2d8cff', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontSize: '1.8rem', fontWeight: 700
                                        }}>
                                            {username ? username[0].toUpperCase() : 'Y'}
                                        </div>
                                    </div>
                                )}
                                <div style={{
                                    position: 'absolute', bottom: '8px', left: '8px',
                                    background: 'rgba(0,0,0,0.6)', color: 'white',
                                    fontSize: '0.75rem', padding: '2px 10px', borderRadius: '4px'
                                }}>
                                    {username || 'You'} (You)
                                </div>
                                {!audio && (
                                    <div style={{
                                        position: 'absolute', bottom: '8px', right: '8px',
                                        background: '#c00', borderRadius: '50%',
                                        width: '24px', height: '24px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <MicOffIcon sx={{ fontSize: '14px', color: 'white' }} />
                                    </div>
                                )}
                            </div>

                            {/* Remote tiles */}
                            {videos.map((v) => (
                                <div key={v.socketId} style={{
                                    position: 'relative', background: '#2d2d2d',
                                    borderRadius: '12px', overflow: 'hidden',
                                    border: '2px solid #444', aspectRatio: '16/9'
                                }}>
                                    <video
                                        data-socket={v.socketId}
                                        ref={ref => { if (ref && v.stream) ref.srcObject = v.stream; }}
                                        autoPlay
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                    <div style={{
                                        position: 'absolute', bottom: '8px', left: '8px',
                                        background: 'rgba(0,0,0,0.6)', color: 'white',
                                        fontSize: '0.75rem', padding: '2px 10px', borderRadius: '4px'
                                    }}>
                                        Participant
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* CHAT PANEL */}
                        {showModal && (
                            <div style={{
                                width: '300px', background: '#2d2d2d', flexShrink: 0,
                                display: 'flex', flexDirection: 'column',
                                borderLeft: '1px solid #3d3d3d'
                            }}>
                                <div style={{
                                    padding: '14px 16px', borderBottom: '1px solid #3d3d3d',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <span style={{ color: 'white', fontWeight: 600 }}>In-Meeting Chat</span>
                                    <span onClick={() => setModal(false)}
                                        style={{ color: '#aaa', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</span>
                                </div>

                                <div style={{
                                    flex: 1, overflowY: 'auto', padding: '12px',
                                    display: 'flex', flexDirection: 'column', gap: '10px'
                                }}>
                                    {messages.length === 0 ? (
                                        <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>
                                            No messages yet
                                        </p>
                                    ) : messages.map((item, index) => (
                                        <div key={index} style={{
                                            background: '#3a3a3a', borderRadius: '8px', padding: '8px 12px'
                                        }}>
                                            <p style={{ color: '#2d8cff', fontWeight: 600, fontSize: '0.78rem', margin: '0 0 2px 0' }}>
                                                {item.sender}
                                            </p>
                                            <p style={{ color: 'white', fontSize: '0.88rem', margin: 0 }}>{item.data}</p>
                                        </div>
                                    ))}
                                </div>

                                <div style={{
                                    padding: '10px 12px', borderTop: '1px solid #3d3d3d',
                                    display: 'flex', gap: '8px', alignItems: 'center'
                                }}>
                                    <TextField
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                        placeholder="Type a message..."
                                        size="small" fullWidth
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                background: '#3a3a3a', borderRadius: '8px',
                                                color: 'white', fontSize: '0.85rem'
                                            },
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                                            '& input::placeholder': { color: '#888' }
                                        }}
                                    />
                                    <Button onClick={sendMessage} variant="contained" sx={{
                                        minWidth: '40px', width: '40px', height: '40px',
                                        background: '#2d8cff', borderRadius: '8px', padding: 0,
                                        '&:hover': { background: '#1a7ae8' }
                                    }}>➤</Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* BOTTOM CONTROL BAR */}
                    <div style={{
                        height: '72px', background: '#2d2d2d', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '6px', borderTop: '1px solid #3d3d3d'
                    }}>

                        {/* Mic */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <IconButton onClick={handleAudio} sx={{
                                background: audio ? '#3d3d3d' : '#c00', borderRadius: '12px',
                                color: 'white', width: '48px', height: '48px',
                                '&:hover': { background: audio ? '#4d4d4d' : '#a00' }
                            }}>
                                {audio ? <MicIcon /> : <MicOffIcon />}
                            </IconButton>
                            <span style={{ color: '#ccc', fontSize: '0.62rem' }}>{audio ? 'Mute' : 'Unmute'}</span>
                        </div>

                        {/* Camera */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <IconButton onClick={handleVideo} sx={{
                                background: video ? '#3d3d3d' : '#c00', borderRadius: '12px',
                                color: 'white', width: '48px', height: '48px',
                                '&:hover': { background: video ? '#4d4d4d' : '#a00' }
                            }}>
                                {video ? <VideocamIcon /> : <VideocamOffIcon />}
                            </IconButton>
                            <span style={{ color: '#ccc', fontSize: '0.62rem' }}>{video ? 'Stop Video' : 'Start Video'}</span>
                        </div>

                        {/* Screen Share */}
                        {screenAvailable && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <IconButton onClick={handleScreen} sx={{
                                    background: screen ? '#2d8cff' : '#3d3d3d', borderRadius: '12px',
                                    color: 'white', width: '48px', height: '48px',
                                    '&:hover': { background: screen ? '#1a7ae8' : '#4d4d4d' }
                                }}>
                                    {screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                                </IconButton>
                                <span style={{ color: '#ccc', fontSize: '0.62rem' }}>Share Screen</span>
                            </div>
                        )}

                        {/* Chat */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <Badge badgeContent={newMessages} color="error">
                                <IconButton onClick={() => { setModal(!showModal); setNewMessages(0); }} sx={{
                                    background: showModal ? '#2d8cff' : '#3d3d3d', borderRadius: '12px',
                                    color: 'white', width: '48px', height: '48px',
                                    '&:hover': { background: showModal ? '#1a7ae8' : '#4d4d4d' }
                                }}>
                                    <ChatIcon />
                                </IconButton>
                            </Badge>
                            <span style={{ color: '#ccc', fontSize: '0.62rem' }}>Chat</span>
                        </div>

                        {/* Divider */}
                        <div style={{ width: '1px', height: '40px', background: '#4d4d4d', margin: '0 10px' }} />

                        {/* Leave */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <Button onClick={handleEndCall} sx={{
                                background: '#c00', color: 'white', borderRadius: '12px',
                                padding: '10px 22px', fontWeight: 600, textTransform: 'none',
                                fontSize: '0.9rem', height: '48px',
                                '&:hover': { background: '#a00' }
                            }}>
                                Leave
                            </Button>
                            <span style={{ color: '#ccc', fontSize: '0.62rem' }}>End</span>
                        </div>

                    </div>
                </div>
            )}
        </div>
    )
}