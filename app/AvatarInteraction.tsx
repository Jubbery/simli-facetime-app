import React, { useCallback, useEffect, useRef, useState } from "react";
import { SimliClient } from "simli-client";
import VideoBox from "./VideoBox";
import Toolbar from "./Toolbar";
import videoIcon from "../media/camera_icon.png";

interface AvatarInteractionProps {
  simli_faceid: string;
  elevenlabs_voiceid: string;
  initialPrompt: string;
  onStart: () => void;
  showDottedFace: boolean;
}

const AvatarInteraction: React.FC<AvatarInteractionProps> = ({
  simli_faceid,
  elevenlabs_voiceid,
  initialPrompt,
  onStart,
  showDottedFace,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [error, setError] = useState("");
  const [startWebRTC, setStartWebRTC] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const simliClientRef = useRef<SimliClient | null>(null);
  const textAreaRef = useRef<HTMLDivElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setIsRecording(true);
      const audioData = new Uint8Array(6000).fill(0);
      simliClientRef.current?.sendAudioData(audioData);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Error accessing microphone. Please check your permissions.");
    }
  };

  const handleMuteToggle = () => {
    // Implement actual mute/unmute functionality here
  };

  const handleVideoToggle = () => {
    // Implement actual video on/off functionality here
  };

  const handleFacetimeAction = () => {
    // Implement FaceTime specific actions here
    console.log("FaceTime Action Triggered");
  };

  const handleEndCall = () => {
    handleCancel();
    console.log("Call Ended");
  };

  /* initializeSimliClient() initializes a new client if videoRef and audioRef are set */
  const initializeSimliClient = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      const SimliConfig = {
        apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY || "",
        faceID: simli_faceid,
        handleSilence: true,
        videoRef: videoRef,
        audioRef: audioRef,
      };
      // console.log("Simli API Key:", process.env.NEXT_PUBLIC_SIMLI_API_KEY);

      simliClientRef.current = new SimliClient();
      simliClientRef.current.Initialize(SimliConfig);
      console.log("Simli Client initialized");
    }
  }, []);

  /* startConversation() queries our local backend to start an elevenLabs conversation over Websockets */
  const startConversation = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.BACKEND_URL}:8080/start-conversation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: initialPrompt,
            voiceId: elevenlabs_voiceid,
          }),
        }
      );

      if (!response.ok) {
        console.log("ISSUE in startConversation");
        throw new Error("Failed to start conversation");
      }

      const data = await response.json();
      console.log(data.message);
      setConnectionId(data.connectionId);

      // After successful response, connect to WebSocket
      initializeWebSocket(data.connectionId);
    } catch (error) {
      console.error("Error starting conversation:", error);
      setError("Failed to start conversation. Please try again.");
    }
  }, []);

  /* initializeWebSocket() sets up a websocket that we can use to talk to our local backend */
  const initializeWebSocket = useCallback((connectionId: string) => {
    socketRef.current = new WebSocket(
      `ws://localhost:8080/ws?connectionId=${connectionId}`
    );

    socketRef.current.onopen = () => {
      console.log("Connected to server");
    };

    socketRef.current.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((arrayBuffer) => {
          const uint8Array = new Uint8Array(arrayBuffer);
          simliClientRef.current?.sendAudioData(uint8Array);
        });
      } else {
        const message = JSON.parse(event.data);
      }
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError(
        "WebSocket connection error. Please check if the server is running."
      );
    };
  }, []);

  /* isWebRTCConnected() checks if SimliClient has an open data channel and peer-connection  */
  const isWebRTCConnected = useCallback(() => {
    if (!simliClientRef.current) return false;

    // Access the private properties of SimliClient
    // Note: This is not ideal and breaks encapsulation, but it avoids modifying SimliClient
    const pc = (simliClientRef.current as any).pc as RTCPeerConnection | null;
    const dc = (simliClientRef.current as any).dc as RTCDataChannel | null;

    return (
      pc !== null &&
      pc.iceConnectionState === "connected" &&
      dc !== null &&
      dc.readyState === "open"
    );
  }, []);
  const handleCancel = useCallback(async () => {
    setIsLoading(false);
    setError("");
    setStartWebRTC(false);
    setIsRecording(false);
    setAudioStream(null);
    simliClientRef.current?.close();
    socketRef.current?.close();
    window.location.href =
      "/"; /* TODO: Is it bad practice to do this? Just sending user back to '/' */
  }, []);
  /* handleStart() is called when the Start button is called. It starts the websocket conversation and then checks if webRTC is connected   */
  const handleStart = useCallback(async () => {
    startRecording();
    onStart();
    setIsLoading(true);
    setError("");

    console.log("Starting ElevenLabs conversation");
    await startConversation();
    console.log("Starting WebRTC");
    simliClientRef.current?.start();
    setStartWebRTC(true);

    // Wait for the WebRTC connection to be established
    const checkConnection = async () => {
      if (isWebRTCConnected()) {
        setIsAvatarVisible(true);
        console.log("WebRTC connection established");
        const audioData = new Uint8Array(6000).fill(0);
        simliClientRef.current?.sendAudioData(audioData);
        console.log("Sent initial audio data");
      } else {
        console.log("Waiting for WebRTC connection...");
        setTimeout(checkConnection, 1000); // Check again after 1 second
      }
    };

    setTimeout(checkConnection, 4000); // Start checking after 4 seconds
  }, []);

  useEffect(() => {
    initializeSimliClient();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (simliClientRef.current) {
        simliClientRef.current.close();
      }
    };
  }, [initializeSimliClient]);

  useEffect(() => {
    if (
      audioStream &&
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN
    ) {
      const mediaRecorder = new MediaRecorder(audioStream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          socketRef.current?.send(event.data);
        }
      };

      mediaRecorder.start(100);

      return () => {
        mediaRecorder.stop();
      };
    }
  }, [audioStream]);
  // ${showDottedFace ? "h-0 overflow-hidden" : "h-auto"}
  return (
    <div className="flex justify-center max-w-[550px]">
      {/* Video Display Area */}
      <div className={``}>
        <VideoBox video={videoRef} audio={audioRef} />
      </div>

      {/* Toolbar */}
      <div className="flex absolute top-[700px] justify-center">
        {isRecording ? (
          <Toolbar
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isLoading={false}
            onMuteToggle={handleMuteToggle}
            onVideoToggle={handleVideoToggle}
            onEndCall={handleCancel}
            error={error}
          />
        ) : (
          <div className="flex flex-col items-center justify-center max-w-[550px] space-x-6 opacity-90">
            <button
              onClick={handleStart}
              className={`flex flex-col items-center justify-center bg-gray-800 text-white p-4 rounded-full shadow-md transition-all duration-300
                ${isLoading ? "cursor-not-allowed opacity-50" : ""}
                sm:p-5 sm:rounded-full
                md:p-6
              `}
              aria-label="FaceTime Action"
            >
              <img
                src={videoIcon.src}
                alt="Microphone Icon"
                className="lg:h-10 lg:w-10 sm:h-8 sm:w-8"
              />
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && <p className="mt-4 text-red-500">{error}</p>}
    </div>
  );
};

export default AvatarInteraction;
