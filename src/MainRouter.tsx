import React from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from "react-router-dom";
import InterviewPage from "./InterviewCompleted";

const Home: React.FC = () => {
  const navigate = useNavigate();

  const startMeeting = () => {
    const meetingId = Math.random().toString(36).substring(2, 10); // unique ID
    navigate(`/meeting/${meetingId}`);
  };

  return (
    <div style={{ display: "flex", height: "100vh", justifyContent: "center", alignItems: "center", background: "#181a1f", flexDirection: "column" }}>
      <h1 style={{ color: "white" }}>AI Interview</h1>
      <button onClick={startMeeting} style={{ padding: "10px 20px", fontSize: "16px", background: "#2173fa", color: "white", border: "none", borderRadius: "6px" }}>
        Start New Meeting
      </button>
    </div>
  );
};

const MainRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/meeting/:id" element={<InterviewPage />} />
      </Routes>
    </Router>
  );
};

export default MainRouter;
