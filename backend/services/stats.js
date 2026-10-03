// 5. Raw SQL / advanced operations used by dashboards and analytics
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

// Faculty see forms they created or forms that evaluate their own offerings; Admin sees everything.
const scope = (user) =>
  user.roles.includes('Admin')
    ? { sql: '1=1', rep: {} }
    : {
        sql: `f.form_id IN (
          SELECT form_id FROM FeedbackForms WHERE created_by = :uid
          UNION
          SELECT a2.form_id FROM FeedbackAssignments a2
            JOIN CourseOfferings o2 ON o2.offering_id = a2.offering_id WHERE o2.instructor_id = :uid)`,
        rep: { uid: user.id },
      };

const SUB_JOIN = `FROM FeedbackSubmissions s
  JOIN FeedbackAssignments a ON a.assignment_id = s.assignment_id
  JOIN FeedbackForms f ON f.form_id = a.form_id`;

const last9Months = (rows) => {
  const out = [];
  const now = new Date();
  for (let i = 8; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const hit = rows.find((r) => r.ym === ym);
    out.push({ label: d.toLocaleString('en-GB', { month: 'short' }), value: hit ? Number(hit.c) : 0 });
  }
  return out;
};

exports.overview = async (user) => {
  const { sql, rep } = scope(user);
  const [forms] = await q(`SELECT COUNT(*) total, COALESCE(SUM(f.status='Published'),0) active, COALESCE(SUM(f.status='Closed'),0) closed FROM FeedbackForms f WHERE ${sql}`, rep);
  const [resp] = await q(`SELECT COUNT(*) total, COALESCE(SUM(s.submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)),0) week ${SUB_JOIN} WHERE s.status='Submitted' AND ${sql}`, rep);
  const [ans] = await q(`SELECT ROUND(AVG(an.rating_value),1) avg_rating, COALESCE(SUM(an.answer_text IS NOT NULL AND an.answer_text <> ''),0) comments
    FROM Answers an JOIN FeedbackSubmissions s ON s.submission_id = an.submission_id
    JOIN FeedbackAssignments a ON a.assignment_id = s.assignment_id JOIN FeedbackForms f ON f.form_id = a.form_id
    WHERE s.status='Submitted' AND ${sql}`, rep);
  const ratingsByForm = await q(`SELECT f.form_id, f.title, ROUND(AVG(an.rating_value),1) avg_rating, COUNT(DISTINCT s.submission_id) responses
    FROM FeedbackForms f JOIN FeedbackAssignments a ON a.form_id = f.form_id
    JOIN FeedbackSubmissions s ON s.assignment_id = a.assignment_id AND s.status='Submitted'
    JOIN Answers an ON an.submission_id = s.submission_id AND an.rating_value IS NOT NULL
    WHERE ${sql} GROUP BY f.form_id, f.title ORDER BY avg_rating DESC`, rep);
  const trendRows = await q(`SELECT DATE_FORMAT(s.submitted_at,'%Y-%m') ym, COUNT(*) c ${SUB_JOIN}
    WHERE s.status='Submitted' AND s.submitted_at >= DATE_SUB(DATE_FORMAT(NOW(),'%Y-%m-01'), INTERVAL 8 MONTH) AND ${sql} GROUP BY ym`, rep);
  const recentForms = await q(`SELECT f.form_id, f.title, f.target_type AS category, f.start_at, f.status,
      (SELECT COUNT(*) FROM FeedbackAssignments a JOIN FeedbackSubmissions s ON s.assignment_id = a.assignment_id AND s.status='Submitted' WHERE a.form_id = f.form_id) AS responses
    FROM FeedbackForms f WHERE ${sql} ORDER BY f.start_at DESC LIMIT 5`, rep);
  return {
    stats: {
      forms: Number(forms.total), active: Number(forms.active), closed: Number(forms.closed),
      responses: Number(resp.total), week: Number(resp.week),
      avgRating: ans.avg_rating ? Number(ans.avg_rating) : 0, comments: Number(ans.comments),
    },
    ratingsByForm, trend: last9Months(trendRows), recentForms, scope: { sql, rep },
  };
};

exports.facultyExtras = async ({ sql, rep }) => {
  const recentResponses = await q(`SELECT s.submission_id, f.form_id, f.title, f.is_anonymous, u.full_name, s.submitted_at ${SUB_JOIN}
    JOIN Users u ON u.user_id = a.respondent_id WHERE s.status='Submitted' AND ${sql} ORDER BY s.submitted_at DESC LIMIT 5`, rep);
  const upcoming = await q(`SELECT f.form_id, f.title, f.end_at, f.status FROM FeedbackForms f
    WHERE f.status IN ('Draft','Published') AND f.end_at >= NOW() AND ${sql} ORDER BY f.end_at LIMIT 3`, rep);
  return { recentResponses: recentResponses.map((r) => ({ ...r, full_name: r.is_anonymous ? 'Anonymous student' : r.full_name })), upcoming };
};

exports.adminExtras = async () => {
  const [stu] = await q(`SELECT COUNT(*) c FROM Users u JOIN UserRoles ur ON ur.user_id = u.user_id JOIN Roles r ON r.role_id = ur.role_id WHERE r.role_name='Student'`);
  const byDepartment = await q(`SELECT d.department_name AS name, COUNT(DISTINCT s.submission_id) AS value
    FROM FeedbackSubmissions s JOIN FeedbackAssignments a ON a.assignment_id = s.assignment_id
    JOIN CourseOfferings o ON o.offering_id = a.offering_id JOIN Courses c ON c.course_id = o.course_id
    JOIN Departments d ON d.department_id = c.department_id WHERE s.status='Submitted' GROUP BY d.department_id, d.department_name ORDER BY value DESC`);
  const activity = await q(`SELECT * FROM (
      SELECT 'response' kind, 'New response submitted' title, f.title detail, s.submitted_at happened_at ${SUB_JOIN} WHERE s.status='Submitted'
      UNION ALL SELECT 'form', 'New form created', f.title, f.start_at FROM FeedbackForms f
      UNION ALL SELECT 'student', 'New student registered', CONCAT('STU', u.user_id, ' - ', u.full_name), u.created_at
        FROM Users u JOIN UserRoles ur ON ur.user_id = u.user_id JOIN Roles r ON r.role_id = ur.role_id AND r.role_name='Student'
    ) x WHERE happened_at IS NOT NULL ORDER BY happened_at DESC LIMIT 5`);
  return { students: Number(stu.c), byDepartment, activity };
};

// Per-question analytics for one form (raw SQL aggregation)
exports.formAnalytics = async (formId) => {
  const rows = await q(`SELECT qu.question_id, qu.question_text, qu.question_type, qu.display_order,
      COUNT(s.submission_id) answered, ROUND(AVG(an.rating_value),2) avg_rating
    FROM Questions qu LEFT JOIN Answers an ON an.question_id = qu.question_id
    LEFT JOIN FeedbackSubmissions s ON s.submission_id = an.submission_id AND s.status='Submitted'
    WHERE qu.form_id = :formId GROUP BY qu.question_id, qu.question_text, qu.question_type, qu.display_order ORDER BY qu.display_order`, { formId });
  const dist = await q(`SELECT an.question_id, COALESCE(CAST(an.rating_value AS CHAR), qo.option_text, an.answer_text) AS label, COUNT(*) AS c
    FROM Answers an JOIN Questions qu ON qu.question_id = an.question_id LEFT JOIN QuestionOptions qo ON qo.option_id = an.option_id
    WHERE qu.form_id = :formId AND qu.question_type <> 'Text' GROUP BY an.question_id, label ORDER BY an.question_id, label`, { formId });
  const texts = await q(`SELECT an.question_id, an.answer_text FROM Answers an JOIN Questions qu ON qu.question_id = an.question_id
    WHERE qu.form_id = :formId AND qu.question_type = 'Text' AND an.answer_text <> '' ORDER BY an.answer_id DESC LIMIT 100`, { formId });
  return rows.map((r) => ({
    ...r, avg_rating: r.avg_rating ? Number(r.avg_rating) : null,
    distribution: dist.filter((d) => d.question_id === r.question_id).map((d) => ({ label: String(d.label), count: Number(d.c) })),
    comments: texts.filter((t) => t.question_id === r.question_id).map((t) => t.answer_text),
  }));
};

exports.hasFormAccess = async (user, formId) => {
  const { sql, rep } = scope(user);
  const r = await q(`SELECT f.form_id FROM FeedbackForms f WHERE f.form_id = :formId AND ${sql}`, { ...rep, formId });
  return r.length > 0;
};
exports.q = q;
