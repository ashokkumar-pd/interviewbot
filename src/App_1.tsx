import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import { useNavigate } from "react-router-dom";
import aiInterviewerLogo from "./assets/userLogo.jpg";
import userLogo from "./assets/aiInterviewerLogo.jpeg";

const App: React.FC = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [time, setTime] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(true);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const workletRegisteredRef = useRef(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const pendingAiMessageQueue = useRef<string[]>([]);
  const lastTranscriptRef = useRef<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    console.log("[MESSAGES STATE]", messages);
  }, [messages]);

  // 🔊 Play AI audio
  const playRawPCM = (arrayBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) {
      console.warn("AudioContext not initialized yet.");
      return;
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    setAiSpeaking(true);

    const pcmData = new Int16Array(arrayBuffer);
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }
    const audioBuffer = audioContextRef.current.createBuffer(
      1,
      float32Data.length,
      16000
    );
    audioBuffer.copyToChannel(float32Data, 0);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    setIsRecording(false);

    source.onended = () => {
      setIsRecording(false);
      setAiSpeaking(false);

      const aiText = pendingAiMessageQueue.current.shift();
      if (aiText) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: aiText,
            time: new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      }
    };

    source.start();
  };

  // WebSocket connect
  const connectWebSocket = () => {
    return new Promise<void>((resolve) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      // const socket = new WebSocket("ws://localhost:8000/ws/speech");
      const socket = new WebSocket("ws://ec2-13-200-222-241.ap-south-1.compute.amazonaws.com:8080/ws/speech")
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
        socket.send(JSON.stringify({ type: "meeting_id", value: 76856980 }));
        setIsReady(false);
        resolve();
      };

      socket.onmessage = (event) => {
        console.log("[RAW WEBSOCKET DATA]", event.data);
        try {
          if (event.data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = function () {
              const arrayBuffer = reader.result as ArrayBuffer;
              playRawPCM(arrayBuffer);
            };
            reader.readAsArrayBuffer(event.data);
          } else {
            const data = JSON.parse(event.data);
            if (data.type === "transcription") {
              pendingAiMessageQueue.current.push(data.text);
              setAiSpeaking(true);
              setUserSpeaking(false);
            } else if (data.type === "user" && data.text) {
              setMessages((prev) => [
                ...prev,
                {
                  sender: "user",
                  text: data.text,
                  time: new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
              ]);
              setAiSpeaking(false);
              setUserSpeaking(true);
            } else {
              console.log("[UNHANDLED MESSAGE TYPE]", data);
            }
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      socket.onclose = () => console.log("WebSocket closed");
      socket.onerror = (error) => console.error("WebSocket error:", error);
    });
  };

  connectWebSocket();

  // Ready button
  const handleReady = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new ((window.AudioContext ||
        (window as any).webkitAudioContext))({ sampleRate: 16000 });
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    if (!workletRegisteredRef.current) {
      const processorCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input.length > 0) {
              const samples = input[0];
              const pcmData = new Int16Array(samples.length);
              for (let i = 0; i < samples.length; i++) {
                let s = samples[i];
                s = Math.max(-1, Math.min(1, s));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              const pcmBuffer = new Uint8Array(pcmData.buffer);
              this.port.postMessage(pcmBuffer);
            }
            return true;
          }
        }
        registerProcessor("pcm-processor", PCMProcessor);
      `;
      const blob = new Blob([processorCode], { type: "application/javascript" });
      const blobURL = URL.createObjectURL(blob);
      await audioContextRef.current.audioWorklet.addModule(blobURL);
      workletRegisteredRef.current = true;
    }

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "intro" }));
    }

    setIsReady(true);
  };

  // Start recording
  const startRecording = async () => {
    try {
      if (!isReady) return;
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        await connectWebSocket();
      }

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          sampleSize: 16,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.onresult = (event: any) => {
          const currentTranscript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join("");
          if (event.results[event.results.length - 1].isFinal) {
            const newTranscript = currentTranscript
              .slice(lastTranscriptRef.current.length)
              .trim();
            if (newTranscript) {
              setMessages((prev) => [
                ...prev,
                {
                  sender: "user",
                  text: newTranscript,
                  time: new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                },
              ]);
              setUserSpeaking(true);
              setAiSpeaking(false);
            }
            lastTranscriptRef.current = currentTranscript;
          }
        };
        recognitionRef.current.onend = () => (lastTranscriptRef.current = "");
        recognitionRef.current.start();
      }

      processorNodeRef.current = new AudioWorkletNode(
        audioContextRef.current!,
        "pcm-processor"
      );
      processorNodeRef.current.port.onmessage = (event) => {
        const pcmChunk = event.data;
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(pcmChunk);
        }
      };

      streamSourceRef.current =
        audioContextRef.current!.createMediaStreamSource(micStream);
      streamSourceRef.current.connect(processorNodeRef.current);
      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (streamSourceRef.current) {
      streamSourceRef.current.disconnect();
      streamSourceRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    socketRef.current?.send(JSON.stringify({ type: "end" }));
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      lastTranscriptRef.current = "";
    }
  };

  // Camera toggle
  const toggleCamera = async () => {
    if (!isCameraOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraStreamRef.current = stream;
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
          userVideoRef.current.muted = true;
          await userVideoRef.current.play().catch((err) =>
            console.error("Play error:", err)
          );
        }
        setIsCameraOn(true);
      } catch (err) {
        console.error("Camera error:", err);
      }
    } else {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      setIsCameraOn(false);
    }
  };

  // End call
  const endCall = () => {
    socketRef.current?.send(JSON.stringify({ type: "endCall" }));
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
    setIsCameraOn(false);
    setMessages([]);

    navigate("/completed", {
      state: {
        duration: time,
        questionsAsked: messages.filter((m) => m.sender === "ai").length,
        interviewType: "Technical",
        status: "Completed",
      },
    });
  };

  return (
    <div className="app-container">
      {/* Overlay Ready Button */}
      {!isReady && (
        <div className="overlay">
          <button className="ready-btn" onClick={handleReady}>
            Ready to Start
          </button>
        </div>
      )}

      <header className="header">
        <span className="session-title">Senior Software Engineer Interview</span>
      </header>

      <div className="main-layout">
        {/* Video Panels */}
        <div className="video-panels">
          <div className={`panel ai-panel ${aiSpeaking ? "speaking" : ""}`}>
            <img src={aiInterviewerLogo} alt="AI" className="avatar" />
            <div className="panel-label">AI Interviewer</div>
          </div>
          <div className={`panel user-panel ${userSpeaking ? "speaking" : ""}`}>
            <video
              ref={userVideoRef}
              autoPlay
              playsInline
              muted
              className="video-feed"
              style={{ display: isCameraOn ? "block" : "none" }}
            />
            {!isCameraOn && (
              <>
                <img src={userLogo} alt="You" className="avatar" />
                <div className="panel-label">You</div>
              </>
            )}
          </div>
        </div>

        {/* Conversation Panel */}
        <div className="conversation-panel">
          <div className="conversation-header">Conversation</div>
          <div className="messages scrollable-chat">
            {messages.map((msg, i) => (
              <div
                key={`${msg.sender}-${msg.time}-${i}`}
                className={`message-bubble ${msg.sender}-bubble`}
              >
                {msg.text}
                <span className="timestamp">{msg.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-bar">
        <button
          className="record-btn"
          onClick={startRecording}
          disabled={aiSpeaking || isRecording || !isReady}
        >
          Start Recording
        </button>

        <button
          className="record-btn stop"
          onClick={stopRecording}
          disabled={aiSpeaking || !isRecording}
        >
          Stop Recording
        </button>

        <button
          className={`icon-btn ${isCameraOn ? "active" : ""}`}
          title="Camera"
          onClick={toggleCamera}
        >
          <i className="fas fa-video"></i>
        </button>

        <button className="icon-btn end" title="End Call" onClick={endCall}>
          <i className="fas fa-phone-slash"></i>
        </button>
      </div>
    </div>
  );
};

export default App;
