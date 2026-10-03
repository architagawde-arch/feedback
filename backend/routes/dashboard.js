const router = require('express').Router();
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { requireAuth, allow } = require('../middleware/auth');
const { User, Role, UserRole, sequelize } = require('../models');
const stats = require('../services/stats');

router.use(requireAuth);

router.get('/faculty/dashboard', allow('Faculty', 'Admin'), async (req, res) => {
  const { scope, ...o } = await stats.overview(req.user);
  res.json({ ...o, ...(await stats.facultyExtras(scope)) });
});

router.get('/admin/dashboard', allow('Admin'), async (req, res) => {
  const { scope, ...o } = await stats.overview(req.user);
  res.json({ ...o, ...(await stats.adminExtras()), topRated: o.ratingsByForm.slice(0, 5) });
});

// Student / faculty directory. GET /api/admin/users?role=Student&q=anisha&status=Active
router.get('/admin/users', allow('Admin'), async (req, res) => {
  const { role = 'Student', q, status } = req.query;
  const where = {};
  if (status) where.status = status;
  if (q) where[Op.or] = [{ full_name: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }];
  const users = await User.findAll({
    where, attributes: ['user_id', 'full_name', 'email', 'status', 'created_at'],
    include: [{ model: Role, as: 'roles', where: { role_name: role }, attributes: [], through: { attributes: [] } }],
    order: [['full_name', 'ASC']],
  });
  res.json(users);
});

router.post('/admin/users', allow('Admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { full_name, email, password, role = 'Faculty' } = req.body;
    const u = await User.create({ full_name, email: (email || '').toLowerCase(), password_hash: await bcrypt.hash(password || 'password123', 10) }, { transaction: t });
    const r = await Role.findOne({ where: { role_name: role } });
    await UserRole.create({ user_id: u.user_id, role_id: r.role_id }, { transaction: t });
    await t.commit();
    res.status(201).json({ user_id: u.user_id });
  } catch (e) { await t.rollback(); res.status(400).json({ message: e.errors?.[0]?.message || e.message }); }
});

router.patch('/admin/users/:id/status', allow('Admin'), async (req, res) => {
  const [n] = await User.update({ status: req.body.status }, { where: { user_id: req.params.id } });
  n ? res.json({ ok: true }) : res.status(404).json({ message: 'User not found.' });
});

// Role-aware notification feed
router.get('/notifications', async (req, res) => {
  const { id, roles } = req.user;
  let items;
  if (roles.includes('Student')) {
    const rows = await stats.q(`SELECT f.title, f.end_at, a.assignment_id FROM FeedbackAssignments a JOIN FeedbackForms f ON f.form_id = a.form_id
      WHERE a.respondent_id = :id AND a.status='Pending' AND f.status='Published' AND f.end_at >= NOW() ORDER BY f.end_at`, { id });
    items = rows.map((r) => ({ id: `a${r.assignment_id}`, title: `Please submit the ${r.title}`, detail: 'Your response is valuable.', at: r.end_at, link: `/student/forms/${r.assignment_id}`, kind: 'pending' }));
  } else {
    const o = await stats.overview(req.user);
    const x = await stats.facultyExtras(o.scope);
    items = x.recentResponses.map((r) => ({ id: `s${r.submission_id}`, title: `New response on ${r.title}`, detail: `From ${r.full_name}`, at: r.submitted_at, link: `/${roles.includes('Admin') ? 'admin' : 'faculty'}/responses?form=${r.form_id}`, kind: 'response' }));
  }
  res.json(items);
});

module.exports = router;
