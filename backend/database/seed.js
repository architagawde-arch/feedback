// Demo data. Run: npm run db:seed   (drops & recreates tables)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const M = require('../models');

const day = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d; };

(async () => {
  await M.sequelize.sync({ force: true });
  const pw = await bcrypt.hash('password123', 10);
  const roles = {};
  for (const r of ['Student', 'Faculty', 'Admin']) roles[r] = await M.Role.create({ role_name: r });
  const mk = async (full_name, email, role, ago = 30) => {
    const u = await M.User.create({ full_name, email, password_hash: pw, created_at: day(-ago) });
    await M.UserRole.create({ user_id: u.user_id, role_id: roles[role].role_id });
    return u;
  };

  const admin = await mk('Admin', 'admin@spes.edu', 'Admin', 200);
  const naik = await mk('Prof. R. Naik', 'naik@spes.edu', 'Faculty', 200);
  const desai = await mk('Prof. S. Desai', 'desai@spes.edu', 'Faculty', 200);
  const students = [];
  for (const [n, e] of [['Archita Gawde', 'archita@spes.edu'], ['Anisha Naik', 'anisha@spes.edu'], ['Shruti Dessai', 'shruti@spes.edu'], ['Priya Gaonkar', 'priya@spes.edu'], ['Mansi Vernekar', 'mansi@spes.edu'], ['Aman Shaikh', 'aman@spes.edu'], ['Rohan Kamat', 'rohan@spes.edu'], ['Neha Fernandes', 'neha@spes.edu']])
    students.push(await mk(n, e, 'Student', 20 + students.length * 9));

  const depts = {};
  for (const d of ['BCA', 'B.Sc.', 'B.A.', 'B.Com', 'M.Sc.']) depts[d] = await M.Department.create({ department_name: d });
  const term = await M.Term.create({ term_name: 'Fall 2026', start_date: '2026-07-15', end_date: '2026-12-20' });
  const mkOffering = async (code, name, dept, instr, section = 'A') => {
    const c = await M.Course.create({ course_code: code, course_name: name, department_id: depts[dept].department_id });
    return M.CourseOffering.create({ course_id: c.course_id, term_id: term.term_id, instructor_id: instr.user_id, section });
  };
  const wt = await mkOffering('BCA301', 'Web Technology', 'BCA', naik);
  const db = await mkOffering('BCA302', 'Database Systems', 'BCA', desai);
  const phy = await mkOffering('BSC201', 'Physics II', 'B.Sc.', desai);
  const acc = await mkOffering('BCM101', 'Financial Accounting', 'B.Com', naik);
  const eco = await mkOffering('BA101', 'Economics', 'B.A.', desai);
  const chem = await mkOffering('MSC101', 'Organic Chemistry', 'M.Sc.', naik);
  const plan = [[0, [wt, db]], [1, [wt, db]], [2, [wt]], [3, [wt, phy]], [4, [acc]], [5, [eco]], [6, [chem]], [7, [phy]]];
  for (const [i, offs] of plan) for (const o of offs) await M.Enrollment.create({ student_id: students[i].user_id, offering_id: o.offering_id });

  const RATE = ['Rating', true], TXT = ['Text', false];
  const forms = [
    ['Faculty Feedback - Web Technology', 'Rate your faculty on teaching quality.', 'Instructor', -15, 20, 'Published', false, wt, ['The faculty explains concepts clearly', 'The faculty is punctual and prepared', 'The pace of teaching is suitable']],
    ['Library Feedback', 'Help us improve library services.', 'College', -12, 18, 'Published', true, null, ['Availability of books and journals', 'Library staff support', 'Study environment']],
    ['Canteen Feedback', 'Tell us about hygiene, taste and pricing.', 'College', -9, 3, 'Published', true, null, ['Food quality and hygiene', 'Value for money', 'Cleanliness of the seating area']],
    ['Infrastructure Feedback', 'Classrooms, labs and campus facilities.', 'College', -6, 6, 'Published', true, null, ['Classroom comfort', 'Lab equipment', 'Wi-Fi and internet access']],
    ["Fresher's Event Feedback", 'Share your thoughts on the welcome event.', 'College', -33, -3, 'Closed', true, null, ['Event organisation', 'Overall experience']],
    ['Course Content Feedback', 'Syllabus and learning material.', 'Course', -20, 10, 'Published', true, db, ['Course content is relevant', 'Study material is helpful']],
    ['Curriculum Feedback', 'Curriculum design and workload.', 'Department', -40, -10, 'Closed', true, null, ['Curriculum is up to date', 'Workload is balanced']],
    ['Student Support Services', 'Counselling and placement support.', 'College', 1, 12, 'Draft', true, null, ['Support services are accessible']],
  ];
  const made = [];
  for (const [title, description, target_type, s, e, status, anon, off, qs] of forms) {
    const f = await M.FeedbackForm.create({ title, description, target_type, term_id: term.term_id, created_by: title.startsWith('Faculty') || title.startsWith('Course') || title.startsWith('Curric') ? naik.user_id : admin.user_id, start_at: day(s), end_at: day(e), is_anonymous: anon, status, form_type: 'Student' });
    let order = 1;
    const qrows = [];
    for (const text of qs) qrows.push(await M.Question.create({ form_id: f.form_id, question_text: text, question_type: 'Rating', is_required: true, display_order: order++ }));
    qrows.push(await M.Question.create({ form_id: f.form_id, question_text: 'Any suggestions for improvement?', question_type: 'Text', is_required: false, display_order: order++ }));
    made.push({ f, off, qrows });
  }

  // Assign every non-draft form to students; archita (student 0) gets 5, with 3 submitted
  const comments = ['Very helpful and well organised.', 'Could be improved with more examples.', 'Good overall, please add more facilities.', 'Loved the way it was handled.', 'Needs better scheduling.'];
  let n = 0;
  for (const [fi, { f, off, qrows }] of made.entries()) {
    if (f.status === 'Draft') continue;
    const pool = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => (fi === 0 ? [0, 1, 2, 3] : fi === 5 ? [0, 1] : [0, 1, 2, 3, 4, 5, 6, 7]).includes(i));
    for (const si of pool) {
      const enr = plan.find(([i]) => i === si)[1];
      const offering = off && enr.includes(off) ? off : enr[0];
      const submitted = si === 0 ? ['Faculty Feedback - Web Technology', 'Library Feedback', "Fresher's Event Feedback"].includes(f.title) : (n++ % 3 !== 0 || f.status === 'Closed');
      const a = await M.FeedbackAssignment.create({ form_id: f.form_id, respondent_id: students[si].user_id, offering_id: offering.offering_id, status: submitted ? 'Completed' : 'Pending', assigned_at: f.start_at });
      if (!submitted) continue;
      const when = day(-Math.floor(Math.random() * 240) , 11);
      const sub = await M.FeedbackSubmission.create({ assignment_id: a.assignment_id, submitted_at: when, status: 'Submitted' });
      for (const qq of qrows)
        await M.Answer.create(qq.question_type === 'Rating'
          ? { submission_id: sub.submission_id, question_id: qq.question_id, rating_value: Math.min(5, 3 + Math.round(Math.random() * 2.2) - (fi % 3 === 2 ? 1 : 0)) }
          : { submission_id: sub.submission_id, question_id: qq.question_id, answer_text: comments[(si + fi) % comments.length] });
    }
  }
  console.log('Seeded. Logins (password: password123): admin@spes.edu | naik@spes.edu | archita@spes.edu');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
