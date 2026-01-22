import React, { useState } from "react";
import { FaQuestionCircle, FaEnvelope, FaBug, FaLightbulb, FaBook, FaComments, FaPaperPlane } from "react-icons/fa";

function Help() {
  const [feedbackForm, setFeedbackForm] = useState({
    type: "general",
    subject: "",
    message: "",
    email: localStorage.getItem("email") || ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const handleFeedbackChange = (e) => {
    const { name, value } = e.target;
    setFeedbackForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Here you would typically send the feedback to your backend
      // For now, we'll just simulate a successful submission
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      setSubmitMessage("Thank you for your feedback! We'll review it and get back to you if needed.");
      setFeedbackForm({
        type: "general",
        subject: "",
        message: "",
        email: feedbackForm.email // Keep the email
      });
    } catch (error) {
      setSubmitMessage("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const helpTopics = [
    {
      icon: <FaBook className="text-primary" />,
      title: "Getting Started",
      description: "Learn the basics of using DocuDB for document management.",
      content: [
        "Upload files by clicking the upload button or dragging files to the page",
        "Create folders to organize your documents",
        "Use the search bar to quickly find files and folders",
        "Share files and folders with other users or groups"
      ]
    },
    {
      icon: <FaComments className="text-success" />,
      title: "File Management",
      description: "Tips for organizing and managing your documents.",
      content: [
        "Right-click files for quick actions like rename, move, or delete",
        "Use groups to collaborate with multiple users",
        "Version control automatically saves changes to your files",
        "Trash provides a safety net for accidentally deleted items"
      ]
    },
    {
      icon: <FaLightbulb className="text-warning" />,
      title: "Advanced Features",
      description: "Discover powerful features for better productivity.",
      content: [
        "Search within file contents for text-based documents",
        "Use keyboard shortcuts for faster navigation",
        "Set up notifications for important updates",
        "Export and share files in various formats"
      ]
    },
    {
      icon: <FaBug className="text-danger" />,
      title: "Troubleshooting",
      description: "Common issues and their solutions.",
      content: [
        "File upload issues: Check file size (max 100MB) and format compatibility",
        "Search not working: Try clearing your browser cache",
        "Permission errors: Contact your administrator for access rights",
        "Slow loading: Check your internet connection"
      ]
    }
  ];

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <h2 className="mb-4">
            <FaQuestionCircle className="me-2 text-primary" />
            Help & Feedback
          </h2>

          {/* Help Topics */}
          <div className="row g-4 mb-5">
            {helpTopics.map((topic, index) => (
              <div key={index} className="col-lg-6">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-3">
                      <div className="me-3" style={{ fontSize: "24px" }}>
                        {topic.icon}
                      </div>
                      <div>
                        <h5 className="card-title mb-1">{topic.title}</h5>
                        <p className="card-subtitle text-muted small">{topic.description}</p>
                      </div>
                    </div>
                    <ul className="list-unstyled">
                      {topic.content.map((item, itemIndex) => (
                        <li key={itemIndex} className="mb-2">
                          <small className="text-muted">• {item}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="card shadow-sm mb-5">
            <div className="card-header">
              <h5 className="mb-0">
                <FaQuestionCircle className="me-2" />
                Frequently Asked Questions
              </h5>
            </div>
            <div className="card-body">
              <div className="accordion" id="faqAccordion">
                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                      What file types does DocuDB support?
                    </button>
                  </h2>
                  <div id="faq1" className="accordion-collapse collapse show" data-bs-parent="#faqAccordion">
                    <div className="accordion-body">
                      DocuDB supports all common file types including documents (PDF, DOC, DOCX, XLS, XLSX),
                      images (JPG, PNG, GIF), videos, and archives (ZIP, RAR). Maximum file size is 100MB.
                    </div>
                  </div>
                </div>

                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                      How do I share files with others?
                    </button>
                  </h2>
                  <div id="faq2" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body">
                      Right-click on any file or folder and select "Share", or use the share button in the file details.
                      You can share with individual users by email or with entire groups.
                    </div>
                  </div>
                </div>

                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                      Is my data secure?
                    </button>
                  </h2>
                  <div id="faq3" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body">
                      Yes, DocuDB uses industry-standard security measures including encrypted file storage,
                      secure user authentication, and access controls. All data is backed up regularly.
                    </div>
                  </div>
                </div>

                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq4">
                      How do I recover deleted files?
                    </button>
                  </h2>
                  <div id="faq4" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body">
                      Deleted files are moved to the Trash where they remain for 30 days before permanent deletion.
                      Administrators can restore files from the Trash section.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Form */}
          <div className="card shadow-sm">
            <div className="card-header">
              <h5 className="mb-0">
                <FaEnvelope className="me-2" />
                Send Feedback
              </h5>
            </div>
            <div className="card-body">
              {submitMessage && (
                <div className={`alert ${submitMessage.includes('Thank you') ? 'alert-success' : 'alert-danger'} alert-dismissible fade show`} role="alert">
                  {submitMessage}
                  <button type="button" className="btn-close" onClick={() => setSubmitMessage("")}></button>
                </div>
              )}

              <form onSubmit={handleFeedbackSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="feedbackType" className="form-label">Feedback Type</label>
                    <select
                      className="form-select"
                      id="feedbackType"
                      name="type"
                      value={feedbackForm.type}
                      onChange={handleFeedbackChange}
                      required
                    >
                      <option value="general">General Feedback</option>
                      <option value="bug">Bug Report</option>
                      <option value="feature">Feature Request</option>
                      <option value="help">Help Request</option>
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="feedbackEmail" className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      id="feedbackEmail"
                      name="email"
                      value={feedbackForm.email}
                      onChange={handleFeedbackChange}
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label htmlFor="feedbackSubject" className="form-label">Subject</label>
                    <input
                      type="text"
                      className="form-control"
                      id="feedbackSubject"
                      name="subject"
                      value={feedbackForm.subject}
                      onChange={handleFeedbackChange}
                      placeholder="Brief description of your feedback"
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label htmlFor="feedbackMessage" className="form-label">Message</label>
                    <textarea
                      className="form-control"
                      id="feedbackMessage"
                      name="message"
                      rows="5"
                      value={feedbackForm.message}
                      onChange={handleFeedbackChange}
                      placeholder="Please provide detailed feedback, bug description, or feature suggestions..."
                      required
                    ></textarea>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    <FaPaperPlane className="me-2" />
                    {isSubmitting ? "Sending..." : "Send Feedback"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Contact Information */}
          <div className="card shadow-sm mt-4">
            <div className="card-body text-center">
              <h6 className="mb-2">Need More Help?</h6>
              <p className="text-muted mb-0">
                For additional support, contact your system administrator or email support@docudb.com
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Help;
