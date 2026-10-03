const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Role, UserRole, Department, Course, CourseOffering, Enrollment, sequelize } = require('../models');
const { requireAuth } = require('../middleware/auth');

const sign = (u, roles) => jwt.sign({ id: u.user_id, roles }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '8h' });
const publicUser = (u, roles) => ({ user_id: u.user_id, full_name: u.full_name, email: u.email, status: u.status, roles });
const rolesOf = (u) => u.roles.map((r) => r.role_name);

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const u = await User.findOne({ where: { email: (email || '').trim().toLowerCase() }, include: [{ model: Role, as: 'roles' }] });
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  if (u.status !== 'Active') return res.status(403).json({ message: 'This account is inactive. Contact the admin.' });
  const roles = rolesOf(u);
  res.json({ token: sign(u, roles), user: publicUser(u, roles) });
});

// Self-registration is for students only
router.post('/register', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { full_name, email, password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    const u = await User.create({ full_name, email: (email || '').toLowerCase(), password_hash: await bcrypt.hash(password, 10) }, { transaction: t });
    const role = await Role.findOne({ where: { role_name: 'Student' } });
    await UserRole.create({ user_id: u.user_id, role_id: role.role_id }, { transaction: t });
    await t.commit();
    res.status(201).json({ token: sign(u, ['Student']), user: publicUser(u, ['Student']) });
  } catch (e) {
    await t.rollback();
    const dup = e.name === 'SequelizeUniqueConstraintError';
    res.status(dup ? 409 : 400).json({ message: dup ? 'That email is already registered.' : e.errors?.[0]?.message || e.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const u = await User.findByPk(req.user.id, { include: [{ model: Role, as: 'roles' }] });
  if (!u) return res.status(404).json({ message: 'User not found.' });
  // Student programme = department of the first enrolled course
  const enr = await Enrollment.findOne({
    where: { student_id: u.user_id },
    include: [{ model: CourseOffering, as: 'offering', include: [{ model: Course, as: 'course', include: [{ model: Department, as: 'department' }] }] }],
  });
  res.json({ ...publicUser(u, rolesOf(u)), created_at: u.created_at, program: enr?.offering?.course?.department?.department_name || null });
});

router.put('/me', requireAuth, async (req, res) => {
  try {
    const u = await User.findByPk(req.user.id);
    const { full_name, current_password, new_password } = req.body;
    if (full_name) u.full_name = full_name;
    if (new_password) {
      if (!(await bcrypt.compare(current_password || '', u.password_hash))) return res.status(400).json({ message: 'Current password is incorrect.' });
      if (new_password.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters.' });
      u.password_hash = await bcrypt.hash(new_password, 10);
    }
    await u.save();
    res.json({ message: 'Profile updated.', full_name: u.full_name });
  } catch (e) { res.status(400).json({ message: e.errors?.[0]?.message || e.message }); }
});

module.exports = router;
