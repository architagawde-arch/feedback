const router = require('express').Router();
const { requireAuth, allow } = require('../middleware/auth');
const { FeedbackAssignment, FeedbackForm, FeedbackSubmission, Question, QuestionOption, Answer, sequelize } = require('../models');
const { q } = require('../services/stats');

router.use(requireAuth, allow('Student'));

// Derived status shown in the UI: Submitted | Pending | Closed
const LIST_SQL = `SELECT a.assignment_id, f.form_id, f.title, f.target_type AS category, f.start_at, f.end_at, f.status AS form_status,
    a.status AS assignment_status, s.submitted_at,
    CASE WHEN a.status='Completed' THEN 'Submitted' WHEN f.status='Closed' OR f.end_at < NOW() THEN 'Closed' ELSE 'Pending' END AS display_status
  FROM FeedbackAssignments a JOIN FeedbackForms f ON f.form_id = a.form_id
  LEFT JOIN FeedbackSubmissions s ON s.assignment_id = a.assignment_id
  WHERE a.respondent_id = :uid AND f.status <> 'Draft' ORDER BY f.start_at DESC`;

router.get('/dashboard', async (req, res) => {
  const assignments = await q(LIST_SQL, { uid: req.user.id });
  const count = (s) => assignments.filter((a) => a.display_status === s).length;
  const pending = assignments.filter((a) => a.display_status === 'Pending').sort((a, b) => new Date(a.end_at) - new Date(b.end_at));
  res.json({
    assignments,
    stats: { total: assignments.length, submitted: count('Submitted'), pending: count('Pending'), closed: count('Closed') },
    notice: pending[0] ? { assignment_id: pending[0].assignment_id, title: pending[0].title, end_at: pending[0].end_at } : null,
  });
});

router.get('/assignments/:id', async (req, res) => {
  const a = await FeedbackAssignment.findOne({
    where: { assignment_id: req.params.id, respondent_id: req.user.id },
    include: [
      { model: FeedbackForm, as: 'form', include: [{ model: Question, as: 'questions', include: [{ model: QuestionOption, as: 'options' }] }] },
      { model: FeedbackSubmission, as: 'submission', include: [{ model: Answer, as: 'answers' }] },
    ],
    order: [[{ model: FeedbackForm, as: 'form' }, { model: Question, as: 'questions' }, 'display_order', 'ASC']],
  });
  if (!a) return res.status(404).json({ message: 'This feedback form is not assigned to you.' });
  const closed = a.form.status === 'Closed' || new Date(a.form.end_at) < new Date();
  res.json({ assignment_id: a.assignment_id, status: a.status, closed, form: a.form, answers: a.submission?.answers || [] });
});

router.post('/assignments/:id/submit', async (req, res) => {
  const a = await FeedbackAssignment.findOne({
    where: { assignment_id: req.params.id, respondent_id: req.user.id },
    include: [{ model: FeedbackForm, as: 'form', include: [{ model: Question, as: 'questions' }] }],
  });
  if (!a) return res.status(404).json({ message: 'This feedback form is not assigned to you.' });
  if (a.status === 'Completed') return res.status(409).json({ message: 'You have already submitted this form.' });
  const f = a.form;
  if (f.status !== 'Published' || new Date(f.end_at) < new Date() || new Date(f.start_at) > new Date())
    return res.status(400).json({ message: 'This form is not open for responses.' });

  const answers = req.body.answers || [];
  const byQ = Object.fromEntries(answers.map((x) => [x.question_id, x]));
  const missing = f.questions.filter((qq) => qq.is_required && !(byQ[qq.question_id] && (byQ[qq.question_id].rating_value || byQ[qq.question_id].option_id || (byQ[qq.question_id].answer_text || '').trim())));
  if (missing.length) return res.status(400).json({ message: `Please answer all required questions (${missing.length} left).`, missing: missing.map((m) => m.question_id) });

  const t = await sequelize.transaction();
  try {
    const sub = await FeedbackSubmission.create({ assignment_id: a.assignment_id, submitted_at: new Date(), status: 'Submitted' }, { transaction: t });
    const valid = new Set(f.questions.map((x) => x.question_id));
    await Answer.bulkCreate(
      answers.filter((x) => valid.has(x.question_id)).map((x) => ({
        submission_id: sub.submission_id, question_id: x.question_id, option_id: x.option_id || null,
        answer_text: x.answer_text || null, rating_value: x.rating_value || null,
      })), { transaction: t, validate: true });
    await a.update({ status: 'Completed' }, { transaction: t });
    await t.commit();
    res.status(201).json({ message: 'Thank you! Your feedback was submitted.' });
  } catch (e) { await t.rollback(); res.status(400).json({ message: e.errors?.[0]?.message || e.message }); }
});

module.exports = router;
