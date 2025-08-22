import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaFileAlt,
  FaTh,
  FaList,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFileImage,
  FaFileArchive,
  FaFileVideo,
} from "react-icons/fa";
import axios from "axios";

function Home() {
  const role = localStorage.getItem("role"); // get saved role
  const [files, setFiles] = useState([]);
  const [view, setView] = useState("grid"); // "grid" or "list"

  // Fetch uploaded files
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await axios.get("http://localhost:3001/files", {
          params: {
            userId: localStorage.getItem("userId"),
            role: localStorage.getItem("role"),
          },
        });
        setFiles(res.data);
      } catch (err) {
        console.error("Error fetching files:", err);
      }
    };
    fetchFiles();
  }, []);

  // Function to choose correct icon by mimetype
  const getFileIcon = (mimetype) => {
    if (!mimetype) return <FaFileAlt size={40} className="text-secondary" />;

    if (mimetype.includes("pdf"))
      return <FaFilePdf size={40} className="text-danger" />;
    if (mimetype.includes("word") || mimetype.includes("doc"))
      return <FaFileWord size={40} className="text-primary" />;
    if (mimetype.includes("excel") || mimetype.includes("spreadsheet"))
      return <FaFileExcel size={40} className="text-success" />;
    if (mimetype.includes("image"))
      return <FaFileImage size={40} className="text-warning" />;
    if (mimetype.includes("zip") || mimetype.includes("rar"))
      return <FaFileArchive size={40} className="text-muted" />;
    if (mimetype.includes("video"))
      return <FaFileVideo size={40} className="text-info" />;

    return <FaFileAlt size={40} className="text-secondary" />;
  };

  return (
    <div className="container-fluid vh-100 d-flex flex-column">
      <div className="row flex-grow-1">
        <div className="col p-4">
          {/* Header with toggle buttons */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold">My Files</h5>
            <div>
              <button
                className={`btn me-2 ${
                  view === "grid" ? "btn-primary" : "btn-light"
                }`}
                onClick={() => setView("grid")}
              >
                <FaTh />
              </button>
              <button
                className={`btn ${
                  view === "list" ? "btn-primary" : "btn-light"
                }`}
                onClick={() => setView("list")}
              >
                <FaList />
              </button>
            </div>
          </div>

          {/* File Display */}
          {view === "grid" ? (
            <div className="row">
              {files.map((file) => (
                <div key={file._id} className="col-6 col-md-3 mb-4">
                  <div className="card shadow-sm p-3 text-center">
                    {getFileIcon(file.mimetype)}
                    <p className="fw-bold small text-truncate">
                      {file.originalName}
                    </p>
                    <div className="d-flex justify-content-center gap-2">
                      {/* Open Button */}
                      <a
                        href={`http://localhost:3001/view/${file.filename}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary"
                      >
                        Open
                      </a>

                      {/* Download Button */}
                      <a
                        href={`http://localhost:3001/download/${file.filename}`}
                        className="btn btn-sm btn-outline-success"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table className="table table-bordered align-middle">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Size (KB)</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file._id}>
                    <td className="d-flex align-items-center gap-2">
                      {getFileIcon(file.mimetype)}
                      {file.originalName}
                    </td>
                    <td>{file.mimetype}</td>
                    <td>{(file.size / 1024).toFixed(2)}</td>
                    <td>{new Date(file.uploadDate).toLocaleString()}</td>
                    <td className="d-flex gap-2">
                      {/* Open Button */}
                      <a
                        href={`http://localhost:3001/view/${file.filename}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary"
                      >
                        Open
                      </a>
                      {/* Download Button */}
                      <a
                        href={`http://localhost:3001/download/${file.filename}`}
                        className="btn btn-sm btn-outline-success"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
