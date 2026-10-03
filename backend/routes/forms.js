// 4. CRUD with Sequelize finders (findAndCountAll, findByPk, create, update, destroy) + advanced filters
const router = require('express').Router();
const { Op } = require('sequelize');
const { requireAuth, allow } = require('../middleware/auth');
const { sequelize, FeedbackForm, Question, QuestionOption, FeedbackAssignment, FeedbackSubmission, Answer, Enrollment, User, Role, Term, CourseOffering } = require('../models');
const stats = require('../services/stats');

router.use(requireAuth, allow('Admin', 'Faculty'));
const isAdmin = (u) => u.roles.includes('Admin');
const err = (res, e, code = 400) => res.status(code).json({ message: e.errors?.[0]?.message || e.message });

async function guard(req, res, next) {
  if (isAdmin(req.user) || (await stats.hasFormAccess(req.user, req.params.id))) return next();
  res.status(403).json({ message: 'You do not have access to this form.' });
}

// GET /api/forms?status=&target_type=&form_type=&term_id=&q=&from=&to=&page=&limit=
router.get('/', async (req, res) => {
  const { status, target_type, form_type, term_id, q, from, to, page = 1, limit = 20 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (target_type) where.target_type = target_type;
  if (form_type) where.form_type = form_type;
  if (term_id) where.term_id = term_id;
  if (q) where.title = { [Op.like]: `%${q}%` };
  if (from || to) where.start_at = { ...(from && { [Op.gte]: from }), ...(to && { [Op.lte]: to }) };
  if (!isAdmin(req.user)) {
    // faculty: forms they created OR forms evaluating their offerings
    const ids = await stats.q(`SELECT DISTINCT a.form_id FROM FeedbackAssignments a JOIN CourseOfferings o ON o.offering_id = a.offering_id WHERE o.instructor_id = :uid`, { uid: req.user.id });
    where[Op.and] = [{ [Op.or]: [{ created_by: req.user.id }, { form_id: { [Op.in]: ids.length ? ids.map((i) => i.form_id) : [0] } }] }];
  }
  const { rows, count } = await FeedbackForm.findAndCountAll({
    where, order: [['start_at', 'DESC']], limit: Math.min(+limit, 100), offset: (+page - 1) * +limit,
    include: [{ model: Term, as: 'term', attributes: ['term_name'] }],
  });
  const counts = rows.length
    ? await stats.q(`SELECT a.form_id, COUNT(s.submission_id) responses FROM FeedbackAssignments a
        LEFT JOIN FeedbackSubmissions s ON s.assignment_id = a.assignment_id AND s.status='Submitted' WHERE a.form_id IN (:ids) GROUP BY a.form_id`, { ids: rows.map((r) => r.form_id) })
    : [];
  const rc = Object.fromEntries(counts.map((c) => [c.form_id, Number(c.responses)]));
  res.json({ total: count, forms: rows.map((r) => ({ ...r.toJSON(), category: r.target_type, responses: rc[r.form_id] || 0 })) });
});

router.get('/offerings', async (req, res) => {
  const rows = await stats.q(`SELECT o.offering_id, CONCAT(c.course_code, ' - ', c.course_name, ' (Sec ', o.section, ', ', t.term_name, ')') AS label,
      u.full_name AS instructor, (SELECT COUNT(*) FROM Enrollments e WHERE e.offering_id = o.offering_id) AS students
    FROM CourseOfferings o JOIN Courses c ON c.course_id = o.course_id JOIN Terms t ON t.term_id = o.term_id JOIN Users u ON u.user_id = o.instructor_id
    ${isAdmin(req.user) ? '' : 'WHERE o.instructor_id = :uid'} ORDER BY t.start_date DESC, c.course_code`, { uid: req.user.id });
  res.json(rows);
});
router.get('/terms', async (req, res) => res.json(await Term.findAll({ order: [['start_date', 'DESC']] })));

router.get('/:id', guard, async (req, res) => {
  const f = await FeedbackForm.findByPk(req.params.id, {
    include: [{ model: Question, as: 'questions', include: [{ model: QuestionOption, as: 'options' }] }],
    order: [[{ model: Question, as: 'questions' }, 'display_order', 'ASC']],
  });
  f ? res.json(f) : res.status(404).json({ message: 'Form not found.' });
});

router.post('/', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { questions = [], ...data } = req.body;
    if (!questions.length) throw new Error('Add at least one question.');
    const form = await FeedbackForm.create({ ...data, created_by: req.user.id }, { transaction: t });
    for (const [i, qn] of questions.entries()) {
      const qq = await Question.create({ ...qn, form_id: form.form_id, display_order: i + 1 }, { transaction: t });
      if (qn.question_type === 'Multiple Choice')
        await QuestionOption.bulkCreate((qn.options || []).filter((o) => o.option_text?.trim()).map((o, k) => ({ question_id: qq.question_id, option_text: o.option_text.trim(), option_value: o.option_value ?? String(k + 1) })), { transaction: t });
    }
    await t.commit();
    res.status(201).json(form);
  } catch (e) { await t.rollback(); err(res, e); }
});

router.put('/:id', guard, async (req, res) => {
  try {
    const f = await FeedbackForm.findByPk(req.params.id);
    if (!f) return res.status(404).json({ message: 'Form not found.' });
    const { title, description, form_type, target_type, term_id, start_at, end_at, is_anonymous, status } = req.body;
    await f.update({ title, description, form_type, target_type, term_id, start_at, end_at, is_anonymous, status });
    res.json(f);
  } catch (e) { err(res, e); }
});

router.patch('/:id/status', guard, async (req, res) => {
  const f = await FeedbackForm.findByPk(req.params.id);
  if (!f) return res.status(404).json({ message: 'Form not found.' });
  await f.update({ status: req.body.status });
  res.json(f);
});

router.delete('/:id', guard, async (req, res) => {
  const n = await FeedbackForm.destroy({ where: { form_id: req.params.id } });
  n ? res.json({ message: 'Form deleted.' }) : res.status(404).json({ message: 'Form not found.' });
});

// Assign a form to every student enrolled in the chosen offerings (or to all students)
router.post('/:id/assign', guard, async (req, res) => {
  try {
    const { offering_ids = [], all_students = false } = req.body;
    let pairs = [];
    if (offering_ids.length) {
      const en = await Enrollment.findAll({ where: { offering_id: { [Op.in]: offering_ids } } });
      pairs = en.map((e) => ({ respondent_id: e.student_id, offering_id: e.offering_id }));
    } else if (all_students) {
      pairs = await stats.q(`SELECT e.student_id AS respondent_id, MIN(e.offering_id) AS offering_id FROM Enrollments e GROUP BY e.student_id`);
    } else return res.status(400).json({ message: 'Choose at least one course offering or all students.' });
    const existing = await FeedbackAssignment.findAll({ where: { form_id: req.params.id } });
    const seen = new Set(existing.map((e) => `${e.respondent_id}-${e.offering_id}`));
    const fresh = pairs.filter((p) => !seen.has(`${p.respondent_id}-${p.offering_id}`)).map((p) => ({ ...p, form_id: req.params.id }));
    await FeedbackAssignment.bulkCreate(fresh);
    res.json({ message: `Assigned to ${fresh.length} student(s).`, assigned: fresh.length });
  } catch (e) { err(res, e); }
});

router.get('/:id/responses', guard, async (req, res) => {
  const f = await FeedbackForm.findByPk(req.params.id, { include: [{ model: Question, as: 'questions' }] });
  if (!f) return res.status(404).json({ message: 'Form not found.' });
  const subs = await FeedbackSubmission.findAll({
    where: { status: 'Submitted' }, order: [['submitted_at', 'DESC']],
    include: [
      { model: Answer, as: 'answers', include: [{ model: QuestionOption, as: 'option' }] },
      { model: FeedbackAssignment, as: 'assignment', required: true, where: { form_id: f.form_id }, include: [{ model: User, as: 'respondent', attributes: ['full_name'] }] },
    ],
  });
  res.json({
    form: { form_id: f.form_id, title: f.title, is_anonymous: f.is_anonymous, questions: f.questions.sort((a, b) => a.display_order - b.display_order) },
    responses: subs.map((s) => ({
      submission_id: s.submission_id, submitted_at: s.submitted_at,
      respondent: f.is_anonymous ? 'Anonymous student' : s.assignment.respondent.full_name,
      answers: s.answers.map((a) => ({ question_id: a.question_id, rating_value: a.rating_value, answer_text: a.answer_text || a.option?.option_text || null })),
    })),
  });
});

router.get('/:id/analytics', guard, async (req, res) => res.json(await stats.formAnalytics(req.params.id)));

module.exports = router;
