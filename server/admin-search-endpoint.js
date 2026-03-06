/* ========================
   ADMIN SEARCH
======================== */
app.get("/admin/search", async (req, res) => {
  try {
    const { query, userId, role, limit } = req.query;
    const searchTerm = query;

    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!searchTerm) return res.json([]);

    const limitNum = parseInt(limit) || 10;
    const results = [];

    const users = await UserModel.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } }
      ]
    })
      .select("name email role createdAt active")
      .limit(limitNum);

    users.forEach(user => {
      results.push({
        _id: user._id,
        type: 'user',
        name: user.name || user.email,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        active: user.active
      });
    });

    const groups = await Group.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } }
      ]
    })
      .select("name description createdAt members")
      .limit(limitNum);

    groups.forEach(group => {
      results.push({
        _id: group._id,
        type: 'group',
        name: group.name,
        description: group.description,
        createdAt: group.createdAt,
        memberCount: group.members?.length || 0
      });
    });

    const logs = await Log.find({
      $or: [
        { action: { $regex: searchTerm, $options: "i" } },
        { details: { $regex: searchTerm, $options: "i" } }
      ]
    })
      .populate("user", "email")
      .sort({ date: -1 })
      .limit(limitNum);

    logs.forEach(log => {
      results.push({
        _id: log._id,
        type: 'log',
        action: log.action,
        details: log.details,
        date: log.date,
        userEmail: log.user?.email || "System"
      });
    });

    results.sort((a, b) => {
      const aExact = (a.name || a.action || "").toLowerCase() === searchTerm.toLowerCase();
      const bExact = (b.name || b.action || "").toLowerCase() === searchTerm.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      const dateA = new Date(a.createdAt || a.date || 0);
      const dateB = new Date(b.createdAt || b.date || 0);
      return dateB - dateA;
    });

    res.json(results.slice(0, limitNum * 3));
  } catch (err) {
    console.error("Admin search error:", err);
    res.status(500).json({ error: "Failed to search" });
  }
});
