const express = require('express'), cors = require('cors'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const db = require('./models'); const { sequelize, M, User, Form, Question, Response } = db;
const SECRET = process.env.JWT_SECRET || 'dev_secret';
const app = express(); app.use(cors(), express.json());
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const wrap = fn => (req, res) => fn(req, res).catch(e => {
  console.error(req.method, req.url, '->', e.parent?.sqlMessage || e.message);
  res.status(e.name?.startsWith('Sequelize') && !e.parent ? 400 : 500).json({ error: e.errors?.[0]?.message || e.parent?.sqlMessage || e.message });
});
const auth = (...roles) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); }
  catch { return res.status(401).json({ error: 'Please log in again.' }); }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Not allowed.' });
  next();
};
app.post('/api/auth/login', wrap(async (req, res) => {
  const u = await User.findOne({ where: { email: req.body.email, status: 'Active' } });
  if (!u || !bcrypt.compareSync(req.body.password || '', u.password_hash)) return res.status(401).json({ error: 'Wrong email or password.' });
  const user = { user_id: u.user_id, name: u.full_name, role: u.role, ref_id: u.ref_id, email: u.email };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '8h' }), user });
}));

// Forms visible to a respondent: live query, so new admin forms reach the chosen audience instantly.
// Student: audience Student/All AND (no offering OR enrolled in the offering's batch). Faculty: audience Faculty/All.
const visibleSql = role => role === 'Student' ? `
  SELECT f.*, c.course_name, fa.faculty_name,
   (SELECT COUNT(*) FROM feedback_responses r WHERE r.feedback_id=f.feedback_id AND r.student_id=:me) AS done
  FROM feedback_forms f LEFT JOIN course_offerings o ON o.offering_id=f.offering_id
  LEFT JOIN courses c ON c.course_id=o.course_id LEFT JOIN faculty fa ON fa.faculty_id=o.faculty_id
  WHERE f.status IN ('Published','Closed') AND f.audience_type IN ('Student','All')
  AND (f.offering_id IS NULL OR o.batch_id IN (SELECT batch_id FROM enrollments WHERE student_id=:me AND status='Active'))
  ORDER BY f.created_at DESC` : `
  SELECT f.*, c.course_name, fa.faculty_name,
   (SELECT COUNT(*) FROM feedback_responses r WHERE r.feedback_id=f.feedback_id AND r.faculty_id=:me AND r.respondent_type='Faculty') AS done
  FROM feedback_forms f LEFT JOIN course_offerings o ON o.offering_id=f.offering_id
  LEFT JOIN courses c ON c.course_id=o.course_id LEFT JOIN faculty fa ON fa.faculty_id=o.faculty_id
  WHERE f.status IN ('Published','Closed') AND f.audience_type IN ('Faculty','All') AND f.offering_id IS NULL
  ORDER BY f.created_at DESC`;
const today = () => new Date().toISOString().slice(0, 10);
const tag = f => ({ ...f, done: +f.done > 0, open: f.status === 'Published' && f.start_date <= today() && f.end_date >= today() });

app.get('/api/forms', auth(), wrap(async (req, res) => {
  const { role, ref_id } = req.user;
  if (role === 'Admin') return res.json(await q(`SELECT f.*, (SELECT COUNT(DISTINCT CONCAT(r.respondent_type,IFNULL(r.student_id,r.faculty_id))) FROM feedback_responses r WHERE r.feedback_id=f.feedback_id) AS responses FROM feedback_forms f ORDER BY created_at DESC`));
  const fill = (await q(visibleSql(role), { me: ref_id })).map(tag);
  if (role === 'Student') return res.json(fill);
  const mine = await q(`SELECT f.*, c.course_name, (SELECT COUNT(DISTINCT r.student_id) FROM feedback_responses r WHERE r.feedback_id=f.feedback_id) AS responses FROM feedback_forms f JOIN course_offerings o ON o.offering_id=f.offering_id JOIN courses c ON c.course_id=o.course_id WHERE o.faculty_id=:me ORDER BY f.created_at DESC`, { me: ref_id });
  res.json([...mine.map(f => ({ ...f, mine: true })), ...fill]);
}));
app.get('/api/forms/:id', auth(), wrap(async (req, res) => {
  const f = await Form.findByPk(req.params.id, { include: [Question], order: [[Question, 'question_number', 'ASC']] });
  if (!f) return res.status(404).json({ error: 'Form not found.' });
  res.json(f);
}));
app.post('/api/forms', auth('Admin'), wrap(async (req, res) => {
  const { questions = [], ...data } = req.body;
  if (!questions.length) return res.status(400).json({ error: 'Add at least one question.' });
  if (data.end_date < data.start_date) return res.status(400).json({ error: 'End date must be after start date.' });
  const form = await sequelize.transaction(async t => {
    const f = await Form.create({ ...data, offering_id: data.offering_id || null, created_by: req.user.user_id }, { transaction: t });
    await Question.bulkCreate(questions.map((x, i) => ({ ...x, feedback_id: f.feedback_id, question_number: i + 1 })), { transaction: t });
    return f;
  });
  res.status(201).json(form);
}));
app.patch('/api/forms/:id/status', auth('Admin'), wrap(async (req, res) => { await Form.update({ status: req.body.status }, { where: { feedback_id: req.params.id } }); res.json({ ok: true }); }));
app.delete('/api/forms/:id', auth('Admin'), wrap(async (req, res) => { await Form.destroy({ where: { feedback_id: req.params.id } }); res.json({ ok: true }); }));

app.post('/api/forms/:id/submit', auth('Student', 'Faculty'), wrap(async (req, res) => {
  const { role, ref_id } = req.user;
  const visible = (await q(visibleSql(role), { me: ref_id })).map(tag).find(f => f.feedback_id == req.params.id);
  if (!visible) return res.status(403).json({ error: 'This form is not assigned to you.' });
  if (!visible.open) return res.status(400).json({ error: 'This form is closed.' });
  if (visible.done) return res.status(400).json({ error: 'You already submitted this form.' });
  const qs = await Question.findAll({ where: { feedback_id: req.params.id } });
  const ans = Object.fromEntries((req.body.answers || []).map(a => [a.question_id, a.answer]));
  const offering = visible.offering_id ? await db.Offering.findByPk(visible.offering_id) : null;
  await Response.bulkCreate(qs.filter(x => ans[x.question_id] !== undefined && ans[x.question_id] !== '').map(x => ({
    feedback_id: x.feedback_id, question_id: x.question_id, answer: String(ans[x.question_id]), respondent_type: role,
    student_id: role === 'Student' ? ref_id : null, faculty_id: role === 'Faculty' ? ref_id : offering?.faculty_id
  })));
  res.status(201).json({ ok: true });
}));

// Raw SQL: per-question results (anonymous - no student identity returned)
app.get('/api/forms/:id/results', auth('Admin', 'Faculty'), wrap(async (req, res) => {
  const questions = await q(`SELECT q.question_id,q.question_text,q.question_type, COUNT(r.response_id) AS n,
    ROUND(AVG(CASE WHEN q.question_type='Rating' THEN CAST(r.answer AS DECIMAL(4,2)) END),2) AS avg_rating
    FROM feedback_questions q LEFT JOIN feedback_responses r ON r.question_id=q.question_id WHERE q.feedback_id=:id GROUP BY q.question_id ORDER BY q.question_number`, { id: req.params.id });
  for (const x of questions) x.answers = x.question_type === 'Rating' ? [] : (await q(`SELECT answer FROM feedback_responses WHERE question_id=:id ORDER BY submitted_date DESC LIMIT 100`, { id: x.question_id })).map(a => a.answer);
  res.json(questions);
}));

app.get('/api/dashboard', auth(), wrap(async (req, res) => {
  const { role, ref_id } = req.user;
  const RESP = `COUNT(DISTINCT r.feedback_id,IFNULL(r.student_id,0),IFNULL(r.faculty_id,0),r.respondent_type)`;
  if (role === 'Admin') {
    const [t] = await q(`SELECT (SELECT COUNT(*) FROM feedback_forms) forms,(SELECT COUNT(*) FROM feedback_forms WHERE status='Published') active,(SELECT COUNT(*) FROM feedback_forms WHERE status='Closed') closed,
      (SELECT ${RESP} FROM feedback_responses r) responses,(SELECT COUNT(*) FROM students) students,(SELECT COUNT(*) FROM faculty) faculty,
      (SELECT ROUND(AVG(CAST(r.answer AS DECIMAL(4,2))),1) FROM feedback_responses r JOIN feedback_questions fq ON fq.question_id=r.question_id WHERE fq.question_type='Rating') avg_rating`);
    const monthly = await q(`SELECT DATE_FORMAT(r.submitted_date,'%b') m, ${RESP} n FROM feedback_responses r GROUP BY YEAR(r.submitted_date),MONTH(r.submitted_date),m ORDER BY YEAR(r.submitted_date),MONTH(r.submitted_date)`);
    const byType = await q(`SELECT IFNULL(f.feedback_types,'Other') label, ${RESP} n FROM feedback_responses r JOIN feedback_forms f ON f.feedback_id=r.feedback_id GROUP BY label`);
    const top = await q(`SELECT f.feedback_id,f.feedback_title, ROUND(AVG(CAST(r.answer AS DECIMAL(4,2))),1) rating FROM feedback_forms f JOIN feedback_questions fq ON fq.feedback_id=f.feedback_id AND fq.question_type='Rating' JOIN feedback_responses r ON r.question_id=fq.question_id GROUP BY f.feedback_id ORDER BY rating DESC LIMIT 5`);
    const recent = await q(`SELECT f.*, (SELECT COUNT(DISTINCT CONCAT(r.respondent_type,IFNULL(r.student_id,r.faculty_id))) FROM feedback_responses r WHERE r.feedback_id=f.feedback_id) responses FROM feedback_forms f ORDER BY created_at DESC LIMIT 5`);
    return res.json({ ...t, monthly, byType, top, recent });
  }
  if (role === 'Faculty') {
    const forms = await q(`SELECT f.feedback_id,f.feedback_title,f.status,f.feedback_types,f.created_at,
      (SELECT COUNT(DISTINCT r.student_id) FROM feedback_responses r WHERE r.feedback_id=f.feedback_id) responses,
      (SELECT ROUND(AVG(CAST(r.answer AS DECIMAL(4,2))),1) FROM feedback_responses r JOIN feedback_questions fq ON fq.question_id=r.question_id WHERE r.feedback_id=f.feedback_id AND fq.question_type='Rating') rating
      FROM feedback_forms f JOIN course_offerings o ON o.offering_id=f.offering_id WHERE o.faculty_id=:me`, { me: ref_id });
    const [c] = await q(`SELECT COUNT(*) n FROM feedback_responses r JOIN feedback_questions fq ON fq.question_id=r.question_id JOIN feedback_forms f ON f.feedback_id=r.feedback_id JOIN course_offerings o ON o.offering_id=f.offering_id WHERE o.faculty_id=:me AND fq.question_type='Text'`, { me: ref_id });
    const pending = (await q(visibleSql('Faculty'), { me: ref_id })).map(tag).filter(f => !f.done && f.open);
    return res.json({ forms, comments: c.n, pending });
  }
  res.json({ forms: (await q(visibleSql('Student'), { me: ref_id })).map(tag) });
}));

app.get('/api/lookups', auth(), wrap(async (req, res) => res.json({
  types: await db.FType.findAll(), facilities: await db.Facility.findAll(),
  offerings: await q(`SELECT o.offering_id, CONCAT(c.course_name,' - ',fa.faculty_name,' (',b.batch_name,')') label FROM course_offerings o JOIN courses c USING(course_id) JOIN faculty fa USING(faculty_id) JOIN batches b USING(batch_id)`)
})));

// Generic master-data CRUD (admin). Creating student/faculty also creates a login with a default password.
app.get('/api/master/:e', auth('Admin'), wrap(async (req, res) => res.json(await M[req.params.e][0].findAll({ order: [[M[req.params.e][1], 'DESC']] }))));
app.post('/api/master/:e', auth('Admin'), wrap(async (req, res) => {
  const [Model, pk] = M[req.params.e]; const row = await Model.create(req.body);
  if (['students', 'faculty'].includes(req.params.e)) {
    const s = req.params.e === 'students';
    await User.create({ full_name: row[s ? 'student_name' : 'faculty_name'], email: row.email, role: s ? 'Student' : 'Faculty', ref_id: row[pk], password_hash: bcrypt.hashSync(s ? 'student123' : 'faculty123', 8) });
  }
  res.status(201).json(row);
}));
app.delete('/api/master/:e/:id', auth('Admin'), wrap(async (req, res) => { const [Model, pk] = M[req.params.e]; await Model.destroy({ where: { [pk]: req.params.id } }); res.json({ ok: true }); }));

async function seed() {
  if (await User.count()) return;
  await sequelize.sync({ force: true }); // no users = setup never finished, so start from clean tables
  const h = p => bcrypt.hashSync(p, 8);
  const dep = await db.Department.create({ department_name: 'Computer Applications' });
  const prog = await db.Programme.create({ program_name: 'BCA', dept_id: dep.department_id });
  const batch = await db.Batch.create({ batch_name: 'SY BCA', academic_year: '2026-27', semester: 3, program_id: prog.program_id });
  const fac = await db.Faculty.create({ faculty_name: 'Prof. R. Naik', dept_id: dep.department_id, email: 'naik@gmfc.edu', designation: 'Assistant Professor' });
  const stu = await db.Student.create({ roll_no: 'BCA2301', student_name: 'Archita Gawde', email: 'archita@gmfc.edu' });
  await db.Enrollment.create({ student_id: stu.student_id, batch_id: batch.batch_id });
  const course = await db.Course.create({ course_code: 'BCA301', course_name: 'Web Technology', credits: 4, semester: 3 });
  const off = await db.Offering.create({ course_id: course.course_id, faculty_id: fac.faculty_id, batch_id: batch.batch_id, academic_year: '2026-27', semester: 3 });
  await db.FType.bulkCreate(['Course', 'Teaching', 'Non-Teaching', 'Sports', 'Counselling', 'Library Facilities'].map(type_name => ({ type_name })));
  await db.Facility.bulkCreate(['Canteen', 'Transport', 'Labs', 'Infrastructure', 'Library', 'Hostel', 'Sports Ground', 'Wi-Fi & Internet', 'Cleanliness', 'Administration Office'].map(facility_name => ({ facility_name })));
  await User.bulkCreate([
    { full_name: 'Admin', email: 'admin@gmfc.edu', password_hash: h('admin123'), role: 'Admin' },
    { full_name: fac.faculty_name, email: fac.email, password_hash: h('faculty123'), role: 'Faculty', ref_id: fac.faculty_id },
    { full_name: stu.student_name, email: stu.email, password_hash: h('student123'), role: 'Student', ref_id: stu.student_id }]);
  const f = await Form.create({ offering_id: off.offering_id, feedback_title: 'Faculty Feedback - Web Technology', description: 'Rate your teaching experience.', start_date: '2026-01-01', end_date: '2027-12-31', status: 'Published', feedback_types: 'Teaching', audience_type: 'Student', sub_type: 'Course' });
  await Question.bulkCreate([['How clear were the lectures?', 'Rating'], ['How helpful is the teacher with doubts?', 'Rating'], ['Any suggestions?', 'Text']].map(([question_text, question_type], i) => ({ feedback_id: f.feedback_id, question_text, question_type, question_number: i + 1 })));
  console.log('Seeded demo data.');
}
sequelize.sync().then(seed).then(() => app.listen(process.env.PORT || 5000, () => console.log('API on :' + (process.env.PORT || 5000))))
  .catch(e => { console.error('DB error:', e.message, e.errors?.map(x => x.message) || '', e.parent?.sqlMessage || ''); process.exit(1); });