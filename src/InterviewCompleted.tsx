import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./InterviewCompleted.css";

const InterviewCompleted: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { duration, questionsAsked, interviewType, status } = location.state || {
    duration: "00:00",
    questionsAsked: 0,
    interviewType: "Technical",
    status: "Completed",
  };

  return (
    <div className="completed-container">
      <div className="completed-icon">✅</div>
      <h2>Interview Completed!</h2>
      <p>Thank you for participating in the AI interview session.</p>

      <div className="summary-card">
        <h3>Interview Summary</h3>
        <div className="summary-row">
          <span>Duration</span> <span>{duration}</span>
        </div>
        <div className="summary-row">
          <span>Questions Asked</span> <span>{questionsAsked}</span>
        </div>
        <div className="summary-row">
          <span>Interview Type</span> <span>{interviewType}</span>
        </div>
        <div className="summary-row">
          <span>Status</span> <span className="status">{status}</span>
        </div>
      </div>

      <div className="completed-buttons">
        <button className="download-btn">⬇ Download Recording</button>
        <button className="new-interview-btn" onClick={() => navigate("/")}>
          Start New Interview
        </button>
      </div>

      <p className="note">
        Your interview responses have been recorded and will be reviewed by our team.
        You can expect to hear back within 2–3 business days.
      </p>
    </div>
  );
};

export default InterviewCompleted;