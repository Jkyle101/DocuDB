import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config";
import { FaComment, FaReply, FaTrash, FaEdit } from "react-icons/fa";

export default function CommentsModal({ onClose, target }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const userId = localStorage.getItem("userId");

  const fetchComments = useCallback(async () => {
    if (!target?.item?._id || !target?.type) return;
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND_URL}/comments`, {
        params: {
          itemId: target.item._id,
          itemType: target.type
        }
      });
      setComments(res.data);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await axios.post(`${BACKEND_URL}/comments`, {
        itemId: target.item._id,
        itemType: target.type,
        content: newComment.trim(),
        createdBy: userId
      });
      setComments([res.data, ...comments]);
      setNewComment("");
    } catch (err) {
      console.error("Failed to add comment:", err);
      alert("Failed to add comment");
    }
  };

  const handleReply = async (parentId) => {
    if (!replyText.trim()) return;

    try {
      await axios.post(`${BACKEND_URL}/comments`, {
        itemId: target.item._id,
        itemType: target.type,
        content: replyText.trim(),
        createdBy: userId,
        parentCommentId: parentId
      });
      
      // Refresh comments to get updated structure
      fetchComments();
      setReplyingTo(null);
      setReplyText("");
    } catch (err) {
      console.error("Failed to add reply:", err);
      alert("Failed to add reply");
    }
  };

  const handleEdit = async (commentId) => {
    if (!editText.trim()) return;

    try {
      await axios.patch(`${BACKEND_URL}/comments/${commentId}`, {
        content: editText.trim()
      });
      fetchComments();
      setEditingId(null);
      setEditText("");
    } catch (err) {
      console.error("Failed to edit comment:", err);
      alert("Failed to edit comment");
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;

    try {
      await axios.delete(`${BACKEND_URL}/comments/${commentId}`);
      fetchComments();
    } catch (err) {
      console.error("Failed to delete comment:", err);
      alert("Failed to delete comment");
    }
  };

  return (
    <div className="modal d-block" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <FaComment className="me-2" />
              Comments - {target.item.originalName || target.item.name}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {loading ? (
              <p>Loading comments...</p>
            ) : (
              <>
                {/* Add new comment */}
                <form onSubmit={handleSubmitComment} className="mb-4">
                  <div className="mb-2">
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Post Comment
                  </button>
                </form>

                {/* Comments list */}
                {comments.length === 0 ? (
                  <p className="text-muted">No comments yet. Be the first to comment!</p>
                ) : (
                  <div className="list-group">
                    {comments.map((comment) => (
                      <div key={comment._id} className="list-group-item">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="flex-grow-1">
                            <strong>{comment.createdBy?.email || "Unknown"}</strong>
                            <span className="text-muted ms-2 small">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {comment.createdBy?._id === userId && (
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-secondary"
                                onClick={() => {
                                  setEditingId(comment._id);
                                  setEditText(comment.content);
                                }}
                              >
                                <FaEdit />
                              </button>
                              <button
                                className="btn btn-outline-danger"
                                onClick={() => handleDelete(comment._id)}
                              >
                                <FaTrash />
                              </button>
                            </div>
                          )}
                        </div>
                        {editingId === comment._id ? (
                          <div className="mb-2">
                            <textarea
                              className="form-control mb-2"
                              rows="2"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-primary"
                                onClick={() => handleEdit(comment._id)}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditText("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mb-2">{comment.content}</p>
                        )}
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
                        >
                          <FaReply className="me-1" /> Reply
                        </button>

                        {/* Reply form */}
                        {replyingTo === comment._id && (
                          <div className="mt-2 ms-4">
                            <textarea
                              className="form-control mb-2"
                              rows="2"
                              placeholder="Write a reply..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                            />
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-primary"
                                onClick={() => handleReply(comment._id)}
                              >
                                Post Reply
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyText("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="ms-4 mt-2">
                            {comment.replies.map((reply) => (
                              <div key={reply._id} className="border-start ps-3 mb-2">
                                <div className="d-flex justify-content-between align-items-start">
                                  <div className="flex-grow-1">
                                    <strong className="small">{reply.createdBy?.email || "Unknown"}</strong>
                                    <span className="text-muted ms-2 small">
                                      {new Date(reply.createdAt).toLocaleString()}
                                    </span>
                                    <p className="mb-0 mt-1">{reply.content}</p>
                                  </div>
                                  {reply.createdBy?._id === userId && (
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => handleDelete(reply._id)}
                                    >
                                      <FaTrash />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
